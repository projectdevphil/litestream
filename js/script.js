document.addEventListener('DOMContentLoaded', async () => {
    
    // ==========================================
    // CONFIGURATION
    // ==========================================
    const AD_URL = '/assets/ads/boots-trailer.mp4'; // Your 2:13 ad
    const API_GET_CHANNELS = '/api/getChannels';
    const API_GET_DATA = '/api/getData';
    const CHANNELS_PER_PAGE = 50;
    const BASE_URL_PATH = '/home';
    const POSTER_MOBILE = '/assets/poster/mobile.png';
    const POSTER_DESKTOP = '/assets/poster/desktop.png';

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
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
    const channelHeader = document.getElementById("channel-list-header") || document.querySelector(".section-header h2"); 
    const playerView = document.getElementById('player-view');
    const videoElement = document.getElementById('video');
    const playerWrapper = document.getElementById('video-container'); 
    const minimizeBtn = document.getElementById('minimize-player-btn');
    const minimizedPlayer = document.getElementById('minimized-player');
    const exitBtn = document.getElementById('exit-player-btn');
    const mainPlayerName = document.getElementById('player-channel-name');
    const mainPlayerStatus = document.getElementById('player-channel-status');
    const miniPlayerName = document.getElementById('minimized-player-name');
    const miniPlayerStatus = document.getElementById('minimized-player-status');
    const miniPlayerLogo = document.getElementById("minimized-player-logo");

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    let player = null;
    let ui = null;
    let allStreams = [];
    let currentFilteredStreams = [];
    let currentlyDisplayedCount = 0;
    let isAdPlaying = false; // Tracks if ad is currently active
    
    const defaultPageTitle = document.title; 

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================
    const createSlug = (name) => {
        if (!name) return '';
        return name.toString().toLowerCase()
            .trim()
            .replace(/\s+/g, '-')           
            .replace(/[^\w\-]+/g, '')       
            .replace(/\-\-+/g, '-');        
    };
    
    const setResponsivePoster = () => {
        if (!videoElement) return;
        const isDesktop = window.innerWidth > 1024; 
        videoElement.poster = isDesktop ? POSTER_DESKTOP : POSTER_MOBILE;
    };
    
    setResponsivePoster();
    window.addEventListener('resize', setResponsivePoster);

    const renderMenu = () => {
        if (!floatingMenu) return;
        floatingMenu.innerHTML = `
        <ul>
            <li><a href="/home/about"><span class="material-symbols-rounded">info</span> About Us</a></li>
            <li><a href="/home/faq"><span class="material-symbols-rounded">quiz</span> FAQ</a></li>
            <li><a href="/home/privacy"><span class="material-symbols-rounded">shield</span> Privacy Policy</a></li>
            <li><a href="/home/terms"><span class="material-symbols-rounded">gavel</span> Terms of Service</a></li>
            <li><a href="https://projectdevphil.github.io/stream-tester"><span class="material-symbols-rounded">labs</span> Stream Tester</a></li>            
        </ul>`;

        const menuLinks = floatingMenu.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; });
            link.style.userSelect = 'none';              
        });
    };

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

    // ==========================================
    // SHAKA PLAYER & AD LOGIC
    // ==========================================

    const initPlayer = async () => {
        shaka.polyfill.installAll();
        if (shaka.Player.isBrowserSupported()) {
            player = new shaka.Player(videoElement);
            try {
                ui = new shaka.ui.Overlay(player, playerWrapper, videoElement);
                ui.configure({ addSeekBar: false });
            } catch (e) {
                console.warn("UI init failed", e);
                videoElement.controls = true;
            }
            player.addEventListener('error', (event) => {
                console.error('Error code', event.detail.code);
                updateStatusText("Stream Offline", "red");
            });
            return true;
        } else {
            alert("Browser not supported");
            return false;
        }
    };

    /**
     * Plays the MP4 ad and waits for it to finish.
     * Guaranteed to work for any duration (2 seconds or 2 minutes).
     */
    const playAd = async () => {
        // 1. Unload Shaka if it's active
        if (player) {
            await player.unload();
        }
        
        // 2. Hide Shaka UI (spinner, controls) so they don't block the ad
        if (ui) ui.setEnabled(false);

        updateStatusText("Advertisement", "yellow");
        isAdPlaying = true;

        return new Promise((resolve) => {
            const onAdEnded = () => {
                console.log("Ad finished normally");
                cleanUpAdListeners();
                resolve();
            };

            const onAdError = (e) => {
                console.warn("Ad failed to load/play, skipping to live stream...", e);
                cleanUpAdListeners();
                resolve(); 
            };

            const cleanUpAdListeners = () => {
                isAdPlaying = false;
                videoElement.removeEventListener('ended', onAdEnded);
                videoElement.removeEventListener('error', onAdError);
            };

            // 3. Set the video source to the Ad
            videoElement.src = AD_URL;
            videoElement.loop = false;
            videoElement.controls = false; // Disable controls during ad
            
            videoElement.addEventListener('ended', onAdEnded);
            videoElement.addEventListener('error', onAdError);

            // 4. Attempt to play
            videoElement.play().catch(e => {
                console.log("Browser blocked autoplay:", e);
                cleanUpAdListeners();
                resolve(); // Skip ad if browser blocks it
            });
        });
    };

    const openPlayer = async (publicStreamInfo) => {
        // --- 1. OPEN UI ---
        if (playerView) {
            playerView.classList.add('active');
            document.body.classList.add('no-scroll');
            if (minimizedPlayer) minimizedPlayer.classList.remove('active');
        }

        mainPlayerName.textContent = publicStreamInfo.name;
        const groupTitle = publicStreamInfo.group || "Live Stream"; 
        
        if(miniPlayerName) miniPlayerName.textContent = publicStreamInfo.name;
        if(miniPlayerLogo) {
            miniPlayerLogo.src = publicStreamInfo.logo || '/assets/favicon.svg';
            miniPlayerLogo.style.display = 'block'; 
        }

        const slug = createSlug(publicStreamInfo.name);
        const newUrl = `${BASE_URL_PATH}?channel=${slug}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
        document.title = `${publicStreamInfo.name} - Litestream`;

        // --- 2. PLAY AD (Wait for 2:13s or 'ended' event) ---
        await playAd();

        // --- 3. CHECK IF USER CLOSED PLAYER ---
        if (!playerView.classList.contains('active')) return;

        // --- 4. PREPARE FOR LIVE STREAM ---
        updateStatusText("Loading Stream...", "var(--theme-color)"); 

        // CRITICAL FIX: Reset video element to remove MP4 trace
        videoElement.removeAttribute('src'); 
        videoElement.load(); 

        try {
            const res = await fetch(`${API_GET_DATA}?channel=${encodeURIComponent(publicStreamInfo.name)}`);
            
            if (res.status === 400 || res.status === 404) {
                throw new Error("Channel data not found or access denied.");
            }
            
            const secureData = await res.json();

            // Initialize Shaka if not ready
            if (!player) {
                const success = await initPlayer();
                if (!success) return;
            }

            const config = { drm: { servers: {}, clearKeys: {} } };
            
            if (secureData.ClearKey && secureData.ClearKey.k1 && secureData.ClearKey.k2) {
                config.drm.clearKeys[secureData.ClearKey.k1] = secureData.ClearKey.k2;
            }
            player.configure(config);

            // Re-enable Shaka UI now that Ad is gone
            if (ui) ui.setEnabled(true);

            await player.load(secureData.manifestUri);
            
            videoElement.play().catch(() => console.log("Auto-play blocked"));
            
            updateStatusText(groupTitle, "var(--theme-color)");

        } catch (e) {
            console.error('Load failed', e);
            updateStatusText("Failed to Load", "red");
        }
    };

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
        // --- SAFE EXIT LOGIC ---
        // 1. Force stop the Ad
        isAdPlaying = false;
        videoElement.pause();
        videoElement.removeAttribute('src'); 
        videoElement.load(); // Clears buffer

        // 2. Unload Shaka
        if (player) await player.unload();
        
        // 3. Close UI
        if(playerView) playerView.classList.remove('active');
        if(minimizedPlayer) minimizedPlayer.classList.remove('active');
        document.body.classList.remove('no-scroll');

        window.history.pushState({}, '', BASE_URL_PATH);
        document.title = defaultPageTitle;
    };

    // ==========================================
    // CHANNEL LISTINGS & UI EVENTS
    // ==========================================

    async function fetchChannels() {
        spinner.style.display = 'flex';
        try {
            const response = await fetch(API_GET_CHANNELS);
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
            const logo = stream.logo || '/assets/favicon.svg';
            
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

    // ==========================================
    // INITIALIZATION
    // ==========================================

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
        
        currentFilteredStreams = allStreams.filter(s => {
            const nameMatch = s.name.toLowerCase().includes(query);
            const groupMatch = s.group ? s.group.toLowerCase().includes(query) : false;
            return nameMatch || groupMatch;
        });

        if(channelHeader) {
            channelHeader.textContent = query === '' ? 
                "All Channels" : `Search Results (${currentFilteredStreams.length})`;
        }
        renderChannels(true);
    });

    if(minimizeBtn) minimizeBtn.addEventListener('click', minimizePlayer);
    if(minimizedPlayer) minimizedPlayer.addEventListener('click', restorePlayer);
    if(exitBtn) exitBtn.addEventListener('click', closePlayer);
    if(loadMoreBtn) loadMoreBtn.addEventListener('click', () => renderChannels(false));

    window.addEventListener("scroll", () => {
        header.classList.toggle("scrolled", window.scrollY > 10);
    });

    // --- Boot Sequence ---
    allStreams = await fetchChannels();
    currentFilteredStreams = [...allStreams];
    renderChannels(true);

    const urlParams = new URLSearchParams(window.location.search);
    const channelSlug = urlParams.get('channel');
    let hasPlayedLink = false;

    if (channelSlug) {
        const foundChannel = allStreams.find(s => createSlug(s.name) === channelSlug);
        if (foundChannel) {
            console.log("Deep link detected for:", foundChannel.name);
            openPlayer(foundChannel);
            hasPlayedLink = true;
        }
    }

    if (!hasPlayedLink && window.innerWidth > 1024) {
        if (playerView) {
            playerView.classList.add('active');
            document.body.classList.add('no-scroll');
        }
        if (mainPlayerName) mainPlayerName.textContent = "Select a Channel";
        updateStatusText("", "var(--text-color)");
        if(videoElement) videoElement.poster = POSTER_DESKTOP;
    }
});
