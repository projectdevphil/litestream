document.addEventListener('DOMContentLoaded', async () => {
    
    // --- CONFIGURATION ---
    const CHANNELS_DB_PATH = 'assets/database/channels.json'; 
    const CHANNELS_PER_PAGE = 50;

    // --- SELECTORS ---
    const header = document.querySelector("header");
    const menuBtn = document.getElementById("menu-btn");
    const floatingMenu = document.getElementById("floating-menu");
    
    const searchContainer = document.getElementById("search-container");
    const searchToggle = document.getElementById("search-toggle");
    const searchInput = document.getElementById("search-input");
    
    const channelListingsContainer = document.querySelector(".channel-list");
    const spinner = document.getElementById("spinner");
    const loadMoreContainer = document.getElementById("load-more-container");
    const loadMoreBtn = document.getElementById("load-more-btn");
    const channelHeader = document.getElementById("channel-list-header");
    
    const playerView = document.getElementById('player-view');
    const videoElement = document.getElementById('video');
    const playerWrapper = document.getElementById('video-container'); 
    const minimizeBtn = document.getElementById('minimize-player-btn');
    const minimizedPlayer = document.getElementById('minimized-player');
    const exitBtn = document.getElementById('exit-player-btn');

    // Text Elements
    const mainPlayerName = document.getElementById('player-channel-name');
    const mainPlayerStatus = document.getElementById('player-channel-status');
    const miniPlayerName = document.getElementById('minimized-player-name');
    const miniPlayerStatus = document.getElementById('minimized-player-status');
    const miniPlayerLogo = document.getElementById("minimized-player-logo");

    // --- VARIABLES ---
    let player = null;
    let ui = null;
    let allStreams = [];
    let currentFilteredStreams = [];
    let currentlyDisplayedCount = 0;

    // --- 1. RENDER MENU ---
    const renderMenu = () => {
        if (!floatingMenu) return;
        floatingMenu.innerHTML = `
        <ul>
            <li><a href="/litestream/about-us"><span class="material-symbols-rounded">info</span> About Us</a></li>
            <li><a href="/litestream/faq"><span class="material-symbols-rounded">quiz</span> FAQ</a></li>
            <li><a href="/litestream/privacy"><span class="material-symbols-rounded">shield</span> Privacy Policy</a></li>
            <li><a href="/litestream/terms"><span class="material-symbols-rounded">gavel</span> Terms of Service</a></li>
            <li><a href="/stream-tester"><span class="material-symbols-rounded">labs</span> Stream Tester</a></li>            
        </ul>`;
    };

    // --- 2. INIT PLAYER ---
    const initPlayer = async () => {
        shaka.polyfill.installAll();

        if (shaka.Player.isBrowserSupported()) {
            player = new shaka.Player(videoElement);
            
            // Initialize UI overlay (Standard Position)
            try {
                ui = new shaka.ui.Overlay(player, playerWrapper, videoElement);
            } catch (e) {
                console.warn("UI init failed", e);
                videoElement.controls = true;
            }

            player.addEventListener('error', (event) => {
                console.error('Error code', event.detail.code);
                updateStatusText("Stream Offline / Error", "red");
            });

            return true;
        } else {
            alert("Browser not supported");
            return false;
        }
    };

    // --- 3. OPEN PLAYER ---
    const openPlayer = async (stream) => {
        // 1. Show UI
        if (playerView) {
            playerView.classList.add('active');
            document.body.classList.add('no-scroll');
            if (minimizedPlayer) minimizedPlayer.classList.remove('active');
        }

        // 2. Update Info & RESET LOGO VISIBILITY
        mainPlayerName.textContent = stream.name;
        updateStatusText("Connecting...", "var(--theme-color)"); // Blue while loading

        if(miniPlayerName) miniPlayerName.textContent = stream.name;
        
        // LOGO FIX: Ensure display is block so it shows up in minimized player
        if(miniPlayerLogo) {
            miniPlayerLogo.src = stream.logo || 'assets/favicon.png';
            miniPlayerLogo.style.display = 'block'; 
        }

        // 3. Init Player
        if (!player) {
            const success = await initPlayer();
            if (!success) return;
        }

        // 4. Configure DRM
        const config = { drm: { servers: {}, clearKeys: {} } };
        if (stream.k1 && stream.k2) {
            config.drm.clearKeys[stream.k1] = stream.k2;
        }
        player.configure(config);

        // 5. Load & Play
        try {
            if (ui) ui.setEnabled(true);
            await player.unload();
            await player.load(stream.manifestUri);
            videoElement.play().catch(() => console.log("Auto-play blocked"));
            
            // Success Color (Blue/Theme Color)
            updateStatusText("Now Playing", "var(--theme-color)");

        } catch (e) {
            console.error('Load failed', e);
            updateStatusText("Failed to Load", "red");
        }
    };

    // Helper to change text and color simultaneously
    function updateStatusText(text, color) {
        if(mainPlayerStatus) {
            mainPlayerStatus.textContent = text;
            mainPlayerStatus.style.color = color;
        }
        if(miniPlayerStatus) {
            miniPlayerStatus.textContent = text;
            miniPlayerStatus.style.color = color;
        }
    }

    // --- 4. UI ACTIONS ---
    const minimizePlayer = () => {
        if (playerView.classList.contains('active')) {
            playerView.classList.remove('active');
            document.body.classList.remove('no-scroll');
            setTimeout(() => {
                if(minimizedPlayer) minimizedPlayer.classList.add('active');
            }, 300);
        }
    };

    const restorePlayer = (e) => {
        if (e.target.closest('#exit-player-btn')) return; 
        if(minimizedPlayer) minimizedPlayer.classList.remove('active');
        if(playerView) playerView.classList.add('active');
        document.body.classList.add('no-scroll');
    };

    const closePlayer = async () => {
        if (player) await player.unload();
        if(playerView) playerView.classList.remove('active');
        if(minimizedPlayer) minimizedPlayer.classList.remove('active');
        document.body.classList.remove('no-scroll');
    };

    // --- 5. FETCH & RENDER ---
    async function fetchChannels() {
        spinner.style.display = 'flex';
        try {
            const response = await fetch(CHANNELS_DB_PATH);
            const channels = await response.json();
            spinner.style.display = 'none';
            return channels;
        } catch (error) {
            console.error(error);
            spinner.style.display = 'none';
            return [];
        }
    }

    const renderChannels = (reset = false) => {
        if (reset) {
            channelListingsContainer.innerHTML = '';
            currentlyDisplayedCount = 0;
        }
        const slice = currentFilteredStreams.slice(currentlyDisplayedCount, currentlyDisplayedCount + CHANNELS_PER_PAGE);

        slice.forEach(stream => {
            const item = document.createElement('div');
            item.className = 'channel-list-item';
            const logo = stream.logo || 'assets/favicon.png';
            
            item.innerHTML = `
                <div class="channel-info-left">
                    <img src="${logo}" class="channel-logo" onerror="this.style.opacity=0">
                    <span class="channel-name">${stream.name}</span>
                </div>
                <div class="channel-info-right">
                    <span class="material-symbols-rounded">sensors</span>
                </div>`;
            
            item.addEventListener('click', () => openPlayer(stream));
            channelListingsContainer.appendChild(item);
        });

        currentlyDisplayedCount += slice.length;
        
        if (currentlyDisplayedCount >= currentFilteredStreams.length) {
            loadMoreContainer.style.display = 'none';
        } else {
            loadMoreContainer.style.display = 'block';
        }
    };

    // --- 6. SLIDER ---
    const setupSlider = () => {
        const slider = document.querySelector(".slider");
        if (!slider) return;
        const slides = slider.querySelectorAll(".slide");
        const dots = slider.parentElement.querySelectorAll(".slider-nav .dot");
        
        if(slides.length === 0) return;
        let currentSlide = 0;
        let slideInterval = setInterval(nextSlide, 5000);

        function goToSlide(n) { 
            slides.forEach((s, i) => s.classList.toggle("active", i === n)); 
            dots.forEach((d, i) => d.classList.toggle("active", i === n)); 
        }
        function nextSlide() { 
            currentSlide = (currentSlide + 1) % slides.length; 
            goToSlide(currentSlide); 
        }
        dots.forEach((dot, index) => {
            dot.addEventListener("click", () => {
                currentSlide = index;
                goToSlide(index);
                clearInterval(slideInterval);
                slideInterval = setInterval(nextSlide, 5000);
            });
        });
    };

    // --- 7. SETUP & START ---
    renderMenu();
    setupSlider();

    menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        floatingMenu.classList.toggle("active");
    });
    document.addEventListener("click", () => floatingMenu.classList.remove("active"));

    searchToggle.addEventListener("click", () => {
        searchContainer.classList.toggle("active");
        if(searchContainer.classList.contains("active")) searchInput.focus();
    });
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        currentFilteredStreams = allStreams.filter(s => s.name.toLowerCase().includes(query));
        renderChannels(true);
    });

    if(minimizeBtn) minimizeBtn.addEventListener('click', minimizePlayer);
    if(minimizedPlayer) minimizedPlayer.addEventListener('click', restorePlayer);
    if(exitBtn) exitBtn.addEventListener('click', closePlayer);
    if(loadMoreBtn) loadMoreBtn.addEventListener('click', () => renderChannels(false));

    window.addEventListener("scroll", () => {
        header.classList.toggle("scrolled", window.scrollY > 10);
    });

    allStreams = await fetchChannels();
    currentFilteredStreams = [...allStreams];
    renderChannels(true);
});
