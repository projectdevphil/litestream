document.addEventListener('DOMContentLoaded', async () => {
    
    // --- CONFIGURATION ---
    // IMPORTANT: Ensure this file exists and is a valid JSON array
    const CHANNELS_DB_PATH = 'assets/database/channels.json'; 
    const CHANNELS_PER_PAGE = 50;

    // --- SELECTORS ---
    const header = document.querySelector("header");
    const menuBtn = document.getElementById("menu-btn");
    const floatingMenu = document.getElementById("floating-menu");
    const searchContainer = document.getElementById("search-container");
    const searchToggle = document.getElementById("search-toggle");
    const searchInput = document.getElementById("search-input");
    
    // Content Selectors
    const channelListingsContainer = document.querySelector(".channel-list");
    const spinner = document.getElementById("spinner");
    const loadMoreContainer = document.getElementById("load-more-container");
    const loadMoreBtn = document.getElementById("load-more-btn");
    const channelHeader = document.getElementById("channel-list-header");
    
    // Player UI Selectors
    const playerView = document.getElementById('player-view');
    const videoElement = document.getElementById('video');
    const playerWrapper = document.getElementById('video-container'); 
    const minimizeBtn = document.getElementById('minimize-player-btn');
    const minimizedPlayer = document.getElementById('minimized-player');
    const exitBtn = document.getElementById('exit-player-btn');

    // Player Text Selectors
    const mainPlayerName = document.getElementById('player-channel-name');
    const mainPlayerStatus = document.getElementById('player-channel-status');
    const miniPlayerName = document.getElementById('minimized-player-name');
    const miniPlayerStatus = document.getElementById('minimized-player-status');
    const miniPlayerLogo = document.getElementById("minimized-player-logo");

    // --- STATE VARIABLES ---
    let player = null;
    let ui = null;
    let allStreams = [];
    let currentFilteredStreams = [];
    let activeStream = null;
    let currentlyDisplayedCount = 0;
    const originalTitle = document.title;

    // --- HELPER: CHECK BROWSER SUPPORT ---
    const isDesktop = () => window.innerWidth >= 1024;

    // --- 1. INITIALIZE SHAKA PLAYER ---
    const initPlayer = async () => {
        // Install Polyfills (Crucial for some browsers)
        shaka.polyfill.installAll();

        if (shaka.Player.isBrowserSupported()) {
            player = new shaka.Player(videoElement);
            
            // Create UI Overlay
            // This enables the play/volume/fullscreen buttons on top of the video
            try {
                ui = new shaka.ui.Overlay(player, playerWrapper, videoElement);
                ui.configure({
                    addSeekBar: false, // Live TV usually doesn't need a seek bar
                    controlPanelElements: ['play_pause', 'mute', 'volume', 'fullscreen', 'overflow_menu']
                });
            } catch (e) {
                console.warn("Shaka UI failed, using native controls", e);
                videoElement.controls = true;
            }

            // Configure Network Logic (Matches your Alternative Site's stability)
            player.configure({
                streaming: {
                    bufferingGoal: 30,
                    rebufferingGoal: 5,
                    bufferBehind: 10,
                    retryParameters: {
                        maxAttempts: 5,
                        baseDelay: 1000,
                        backoffFactor: 2,
                        fuzzFactor: 0.5,
                    }
                }
            });

            player.addEventListener('error', onPlayerError);
            console.log("Shaka Player Initialized Successfully");
            return true;
        } else {
            console.error('Browser not supported!');
            alert("Your browser does not support the video player.");
            return false;
        }
    };

    const onPlayerError = (event) => {
        const error = event.detail;
        console.error('Shaka Error Code:', error.code, error);
        
        let errorMsg = "Stream Offline or Error";
        
        // DRM / Key Errors
        if (error.code >= 6000 && error.code < 7000) {
            errorMsg = "DRM Key Expired";
            console.warn("The keys (k1/k2) for this channel may be invalid.");
        }
        
        mainPlayerStatus.textContent = errorMsg;
        mainPlayerStatus.style.color = "#ff4444"; // Red for error
    };

    // --- 2. OPEN PLAYER (THE CORE LOGIC) ---
    const openPlayer = async (stream) => {
        activeStream = stream;
        console.log("Opening Channel:", stream.name);

        // STEP A: SHOW THE UI IMMEDIATELY
        // This ensures "something happens" when you click
        if (playerView) {
            playerView.classList.add('active');
            // Hide mini player if it was open
            if (minimizedPlayer) minimizedPlayer.classList.remove('active');
        }

        // STEP B: UPDATE TEXT INFO
        mainPlayerName.textContent = stream.name;
        mainPlayerStatus.textContent = "Connecting...";
        mainPlayerStatus.style.color = "var(--theme-color)";
        document.title = `${stream.name} - Phillite`;

        if (miniPlayerName) miniPlayerName.textContent = stream.name;
        if (miniPlayerLogo) miniPlayerLogo.src = stream.logo || 'assets/favicon.png';

        // STEP C: INIT PLAYER IF MISSING
        if (!player) {
            const success = await initPlayer();
            if (!success) return; // Stop if browser unsupported
        }

        // STEP D: CONFIGURE DRM (CLEARKEY)
        // This matches the logic from your working site
        const config = {
            drm: {
                servers: {},
                clearKeys: {}
            }
        };

        // Check if channel has Keys (k1/k2)
        if (stream.k1 && stream.k2) {
            console.log(`Applying DRM Keys for ${stream.name}`);
            // Your JSON has Hex keys, so we apply them directly
            config.drm.clearKeys[stream.k1] = stream.k2;
        } else {
            console.log("No DRM Keys found, attempting clear playback.");
        }

        player.configure(config);

        // STEP E: LOAD & PLAY
        try {
            // Enable UI
            if (ui) ui.setEnabled(true);
            
            // Unload previous
            await player.unload();

            // Load new manifest
            await player.load(stream.manifestUri);
            
            // Attempt to play
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.warn("Autoplay prevented by browser. User must click play.", e);
                });
            }
            
            // Success UI
            mainPlayerStatus.textContent = "Now Playing";
            mainPlayerStatus.style.color = "#00ff00"; // Green for success

        } catch (e) {
            console.error('Load failed:', e);
            mainPlayerStatus.textContent = "Failed to Load";
            mainPlayerStatus.style.color = "#ff4444";
            onPlayerError({ detail: e });
        }
    };

    // --- 3. UI CONTROLS (Minimize, Close, etc) ---
    
    const minimizePlayer = (e) => {
        if(e) e.stopPropagation();
        if (playerView && playerView.classList.contains('active')) {
            playerView.classList.remove('active');
            setTimeout(() => {
                if (minimizedPlayer) minimizedPlayer.classList.add('active');
            }, 300);
        }
    };

    const restorePlayer = (e) => {
        // Don't restore if clicking the 'X' button
        if (e.target.closest('#exit-player-btn')) return;
        
        if (minimizedPlayer && minimizedPlayer.classList.contains('active')) {
            minimizedPlayer.classList.remove('active');
            if (playerView) playerView.classList.add('active');
        }
    };

    const closePlayer = async (e) => {
        if(e) e.stopPropagation();

        if (player) await player.unload();
        
        activeStream = null;
        document.title = originalTitle;

        // Hide all players
        if (playerView) playerView.classList.remove('active');
        if (minimizedPlayer) minimizedPlayer.classList.remove('active');
        
        // Reset UI text
        setTimeout(() => {
            mainPlayerName.textContent = 'Select a Channel';
            mainPlayerStatus.textContent = 'Idle';
            mainPlayerStatus.style.color = "var(--text-secondary)";
        }, 300);
    };

    // --- 4. DATA FETCHING ---
    async function fetchChannels() {
        spinner.style.display = 'flex';
        try {
            const response = await fetch(CHANNELS_DB_PATH);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const channels = await response.json();
            spinner.style.display = 'none';
            return channels;
        } catch (error) {
            console.error("Failed to load channels:", error);
            spinner.style.display = 'none';
            channelListingsContainer.innerHTML = `
                <div style="text-align:center; padding:20px; color: #ff4444;">
                    <p>Unable to load channel list.</p>
                    <p>Please ensure <strong>assets/database/channels.json</strong> exists.</p>
                </div>`;
            return [];
        }
    }

    // --- 5. RENDER LIST ---
    const renderChannels = (reset = false) => {
        if (reset) {
            channelListingsContainer.innerHTML = '';
            currentlyDisplayedCount = 0;
        }

        const channelsToRender = currentFilteredStreams.slice(currentlyDisplayedCount, currentlyDisplayedCount + CHANNELS_PER_PAGE);

        if(channelsToRender.length === 0 && reset) {
            channelListingsContainer.innerHTML = '<p style="text-align:center; padding:20px;">No channels found.</p>';
            loadMoreContainer.style.display = 'none';
            return;
        }

        channelsToRender.forEach(stream => {
            const item = document.createElement('div');
            item.className = 'channel-list-item';
            
            const logoSrc = stream.logo || 'assets/favicon.png';
            
            item.innerHTML = `
                <div class="channel-info-left">
                    <img src="${logoSrc}" alt="${stream.name}" class="channel-logo" loading="lazy" onerror="this.style.opacity='0'">
                    <span class="channel-name">${stream.name}</span>
                </div>
                <div class="channel-info-right">
                    <span class="material-symbols-rounded">play_circle</span>
                </div>`;

            // CLICK EVENT -> TRIGGERS PLAYER
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

    // --- 6. SETUP SEARCH, MENU, SLIDER ---
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

    const setupSlider = () => {
        const slider = document.querySelector(".slider");
        if (!slider) return;
        const slides = slider.querySelectorAll(".slide");
        const dots = slider.parentElement.querySelectorAll(".slider-nav .dot");
        
        if(slides.length === 0) return;
        let currentSlide = 0;
        let slideInterval = setInterval(nextSlide, 6000);

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
                slideInterval = setInterval(nextSlide, 6000);
            });
        });
    };

    // --- 7. EVENT LISTENERS ---
    window.addEventListener("scroll", () => {
        if(header) header.classList.toggle("scrolled", window.scrollY > 10);
    });

    // Menu Logic
    if(floatingMenu && menuBtn) {
        floatingMenu.innerHTML = `
        <ul>
            <li><a href="#"><span class="material-symbols-rounded">info</span> About</a></li>
            <li><a href="#"><span class="material-symbols-rounded">bug_report</span> Report Issue</a></li>
        </ul>`;
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            floatingMenu.classList.toggle("active");
        });
        document.addEventListener("click", () => floatingMenu.classList.remove("active"));
    }

    // Player Button Listeners
    if(minimizeBtn) minimizeBtn.addEventListener('click', minimizePlayer);
    if(minimizedPlayer) minimizedPlayer.addEventListener('click', restorePlayer);
    if(exitBtn) exitBtn.addEventListener('click', closePlayer);
    if(loadMoreBtn) loadMoreBtn.addEventListener('click', () => renderChannels(false));

    // --- 8. START APP ---
    setupSearch();
    setupSlider();

    // Load Data
    allStreams = await fetchChannels();
    if (allStreams && allStreams.length > 0) {
        currentFilteredStreams = [...allStreams];
        renderChannels(true);
    }
});
