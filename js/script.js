document.addEventListener('DOMContentLoaded', async () => {
    
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
    
    // Player Selectors
    const playerView = document.getElementById('player-view');
    const videoElement = document.getElementById('video');
    const playerWrapper = document.getElementById('video-container'); // Wrapper for Shaka UI
    const minimizeBtn = document.getElementById('minimize-player-btn');
    const minimizedPlayer = document.getElementById('minimized-player');
    const exitBtn = document.getElementById('exit-player-btn');

    // --- STATE VARIABLES ---
    let player = null;
    let ui = null;
    let allStreams = [];
    let currentFilteredStreams = [];
    let activeStream = null;
    
    const CHANNELS_PER_PAGE = 50;
    let currentlyDisplayedCount = 0;
    const originalTitle = "Phillite - Free Lite Access Philippines IPTV";

    // --- HELPER FUNCTIONS ---
    const isDesktop = () => window.innerWidth >= 1024;

    const setVideoPoster = () => {
        if (!videoElement) return;
        // You can customize these paths or remove this function if you don't have these images
        if (isDesktop()) {
            videoElement.poster = 'assets/desktop-poster.png'; 
        } else {
            videoElement.poster = 'assets/attention.png';
        }
    };

    // --- PLAYER INITIALIZATION (From Alternative Site) ---
    const initPlayer = async () => {
        shaka.Polyfill.installAll();

        if (shaka.Player.isBrowserSupported()) {
            player = new shaka.Player(videoElement);
            
            // Initialize Shaka UI Overlay
            ui = new shaka.ui.Overlay(player, playerWrapper, videoElement);

            // Configure UI
            ui.configure({
                addSeekBar: false, // Hide seek bar for live TV
                controlPanelElements: ['play_pause', 'mute', 'volume', 'fullscreen', 'overflow_menu']
            });

            // Configure Player Network Logic
            player.configure({
                streaming: {
                    bufferingGoal: 60,
                    rebufferingGoal: 15,
                    bufferBehind: 30,
                    retryParameters: {
                        maxAttempts: 5,
                        baseDelay: 1000,
                        backoffFactor: 2,
                        fuzzFactor: 0.5,
                    }
                }
            });

            player.addEventListener('error', onError);
            console.log("Shaka Player Initialized");
        } else {
            console.error('Browser not supported!');
            alert("Browser not supported");
        }
    };

    const onError = (event) => {
        console.error('Player Error', event.detail);
        // Optional: Add logic here to handle key expiration
        if(event.detail.code === 6007 || event.detail.code === 6008) {
             console.warn("DRM License invalid or expired.");
        }
    };

    // --- OPEN PLAYER LOGIC (Merged) ---
    const openPlayer = async (stream) => {
        activeStream = stream;

        // 1. Prepare UI
        if (videoElement) videoElement.style.display = 'block';
        
        // 2. Initialize Player if needed
        if (!player) await initPlayer();
        if (ui) ui.setEnabled(true);

        try {
            // Unload previous content
            await player.unload();

            // 3. Configure DRM (Adapted for local JSON data)
            const config = {
                drm: {
                    servers: {},
                    clearKeys: {}
                }
            };

            // Map k1/k2 from your JSON to ClearKeys
            if (stream.k1 && stream.k2) {
                config.drm.clearKeys[stream.k1] = stream.k2;
            }

            player.configure(config);

            console.log(`Loading Channel: ${stream.name}`);

            // 4. Load Manifest
            await player.load(stream.manifestUri);
            
            // 5. Play
            videoElement.play().catch(e => console.warn("Autoplay prevented:", e));

        } catch (e) {
            console.error('Player Load Error', e);
            onError({ detail: e });
        }

        // 6. Update UI Text
        document.getElementById('player-channel-name').textContent = stream.name;
        document.getElementById('player-channel-status').textContent = "Now Playing"; // or stream.group
        document.title = `${stream.name} - Phillite`;

        // 7. Handle Layout (Mobile/Desktop)
        if (!isDesktop()) {
            const miniLogo = document.getElementById("minimized-player-logo");
            if(miniLogo) {
                miniLogo.src = stream.logo || 'assets/favicon.png';
                miniLogo.style.display = 'block';
            }
            
            document.getElementById('minimized-player-name').textContent = stream.name;
            document.getElementById('minimized-player-status').textContent = "Now Playing";

            if (minimizedPlayer) minimizedPlayer.classList.remove('active');
            if (playerView) playerView.classList.add('active');
        } else {
            // Desktop behavior
            if (playerView) playerView.classList.add('active');
        }
    };

    // --- PLAYER CONTROLS (Minimize/Close/Restore) ---
    const minimizePlayer = () => {
        if (isDesktop()) return; // Desktop usually keeps player visible or different layout
        
        if (playerView && playerView.classList.contains('active')) {
            playerView.classList.remove('active');
            setTimeout(() => {
                if (minimizedPlayer) minimizedPlayer.classList.add('active');
            }, 250);
        }
    };

    const restorePlayer = (e) => {
        if (isDesktop() || e.target.closest('#exit-player-btn')) return;
        
        if (minimizedPlayer && minimizedPlayer.classList.contains('active')) {
            minimizedPlayer.classList.remove('active');
            if (playerView) playerView.classList.add('active');
        }
    };

    const closePlayer = async (e) => {
        e.stopPropagation();

        if (videoElement) videoElement.style.display = 'block'; // Reset display
        if (ui) ui.setEnabled(false);
        
        if (player) {
            await player.unload();
            setVideoPoster(); // Show poster when idle
        }
        
        activeStream = null;
        document.title = originalTitle;

        if (playerView) playerView.classList.remove('active');
        if (minimizedPlayer) minimizedPlayer.classList.remove('active');
        
        // Reset text
        document.getElementById('player-channel-name').textContent = 'Select a Channel';
        document.getElementById('player-channel-status').textContent = 'Idle';
    };


    // --- CHANNEL DATA & RENDERING ---
    async function fetchChannels() {
        spinner.style.display = 'flex';
        try {
            const response = await fetch('assets/database/getChannels.js'); // Ensure this file exists
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const channels = await response.json();
            spinner.style.display = 'none';
            return channels;
        } catch (error) {
            console.error("Failed to load channels:", error);
            spinner.style.display = 'none';
            channelListingsContainer.innerHTML = '<p style="text-align:center; padding:20px;">Failed to load channels.</p>';
            return [];
        }
    }

    const renderChannels = (reset = false) => {
        if (reset) {
            channelListingsContainer.innerHTML = '';
            currentlyDisplayedCount = 0;
        }

        const channelsToRender = currentFilteredStreams.slice(currentlyDisplayedCount, currentlyDisplayedCount + CHANNELS_PER_PAGE);

        if(channelsToRender.length === 0 && reset) {
            channelListingsContainer.innerHTML = '<p style="text-align:center; width:100%; padding:20px;">No results found.</p>';
        }

        channelsToRender.forEach(stream => {
            const item = document.createElement('div');
            item.className = 'channel-list-item';
            const logoSrc = stream.logo || 'assets/favicon.png';
            
            item.innerHTML = `
                <div class="channel-info-left">
                    <img src="${logoSrc}" alt="${stream.name}" class="channel-logo" loading="lazy" onerror="this.src='assets/favicon.png'">
                    <span class="channel-name">${stream.name}</span>
                </div>
                <div class="channel-info-right">
                    <span class="material-symbols-rounded">sensors</span>
                </div>`;

            item.addEventListener('click', () => openPlayer(stream));
            channelListingsContainer.appendChild(item);
        });

        currentlyDisplayedCount += channelsToRender.length;
        
        if (currentlyDisplayedCount >= currentFilteredStreams.length) {
            loadMoreContainer.style.display = 'none';
        } else {
            loadMoreContainer.style.display = 'block';
        }
    };

    // --- SEARCH LOGIC ---
    const setupSearch = () => {
        searchToggle.addEventListener('click', () => {
            searchContainer.classList.toggle('active');
            if(searchContainer.classList.contains('active')) {
                searchInput.focus();
            } else {
                searchInput.value = '';
                performSearch('');
            }
        });

        searchInput.addEventListener('input', (e) => {
            performSearch(e.target.value.toLowerCase());
        });
    };

    const performSearch = (query) => {
        if (query.length > 0) {
            currentFilteredStreams = allStreams.filter(s => s.name.toLowerCase().includes(query));
            channelHeader.textContent = `Search Results (${currentFilteredStreams.length})`;
        } else {
            currentFilteredStreams = [...allStreams];
            channelHeader.textContent = "Channels";
        }
        renderChannels(true);
    };

    // --- MENU & SLIDER LOGIC ---
    const renderMenu = () => {
        // Keeping your original simple menu for now
        floatingMenu.innerHTML = `
        <ul>
            <li><a href="#"><span class="material-symbols-rounded">info</span> About Us</a></li>
            <li><a href="#"><span class="material-symbols-rounded">quiz</span> FAQ</a></li>
            <li><a href="#"><span class="material-symbols-rounded">shield</span> Privacy Policy</a></li>
            <li><a href="#"><span class="material-symbols-rounded">gavel</span> Terms of Service</a></li>
        </ul>`;

        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            floatingMenu.classList.toggle("active");
        });
        document.addEventListener("click", () => floatingMenu.classList.remove("active"));
    };

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

    // --- EVENT LISTENERS ---
    window.addEventListener('resize', () => {
        setVideoPoster();
        // Optional: Re-check layout if needed
    });
    
    window.addEventListener("scroll", () => {
        header.classList.toggle("scrolled", window.scrollY > 10);
    });

    if(minimizeBtn) minimizeBtn.addEventListener('click', minimizePlayer);
    if(minimizedPlayer) minimizedPlayer.addEventListener('click', restorePlayer);
    if(exitBtn) exitBtn.addEventListener('click', closePlayer);
    if(loadMoreBtn) loadMoreBtn.addEventListener('click', () => renderChannels(false));

    // --- INITIALIZE ---
    setupSearch();
    renderMenu();
    setupSlider();
    setVideoPoster();

    // Load Data
    allStreams = await fetchChannels();
    currentFilteredStreams = [...allStreams];
    renderChannels(true);
});
