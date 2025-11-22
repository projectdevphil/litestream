document.addEventListener('DOMContentLoaded', async () => {
    
    // --- CONFIGURATION ---
    // Ensure this path matches where you saved your file. 
    // It is highly recommended to rename getChannels.js to channels.json
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
    
    // Player Selectors
    const playerView = document.getElementById('player-view');
    const videoElement = document.getElementById('video');
    const playerWrapper = document.getElementById('video-container'); 
    const minimizeBtn = document.getElementById('minimize-player-btn');
    const minimizedPlayer = document.getElementById('minimized-player');
    const exitBtn = document.getElementById('exit-player-btn');

    // Player Info Selectors
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

    // --- HELPER FUNCTIONS ---
    const isDesktop = () => window.innerWidth >= 1024;

    const setVideoPoster = () => {
        if (!videoElement) return;
        // Set a generic poster or specific one based on device
        videoElement.poster = isDesktop() ? 'assets/desktop-poster.png' : 'assets/mobile-poster.png';
    };

    // --- SHAKA PLAYER INITIALIZATION ---
    const initPlayer = async () => {
        // Check if Shaka is loaded
        if (!shaka) {
            console.error("Shaka Player library not loaded!");
            alert("Error: Video Player library missing.");
            return false;
        }

        shaka.Polyfill.installAll();

        if (shaka.Player.isBrowserSupported()) {
            player = new shaka.Player(videoElement);
            
            // Initialize Shaka UI Overlay
            // We wrap this in try-catch in case UI library is missing
            try {
                ui = new shaka.ui.Overlay(player, playerWrapper, videoElement);
                ui.configure({
                    addSeekBar: false, // Live TV usually doesn't need seeking
                    controlPanelElements: ['play_pause', 'mute', 'volume', 'fullscreen', 'overflow_menu']
                });
            } catch (e) {
                console.warn("Shaka UI failed to initialize, falling back to native controls", e);
                videoElement.controls = true;
            }

            // Configure Network & Buffer logic for slower connections
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
            console.log("Shaka Player Initialized");
            return true;
        } else {
            console.error('Browser not supported!');
            alert("Your browser does not support this video player.");
            return false;
        }
    };

    const onPlayerError = (event) => {
        const error = event.detail;
        console.error('Player Error Code:', error.code, error);
        
        // DRM Errors (6000-6999)
        if (error.code >= 6000 && error.code < 7000) {
            mainPlayerStatus.textContent = "Error: DRM Key Expired or Invalid";
            if(miniPlayerStatus) miniPlayerStatus.textContent = "DRM Error";
        } else {
            mainPlayerStatus.textContent = "Stream Offline / Connection Error";
            if(miniPlayerStatus) miniPlayerStatus.textContent = "Offline";
        }
    };

    // --- OPEN PLAYER LOGIC (FIXED) ---
    const openPlayer = async (stream) => {
        activeStream = stream;

        // 1. UPDATE UI IMMEDIATELY (Before loading video)
        // This fixes the "nothing happens" issue
        if (playerView) {
            playerView.classList.add('active');
            // Ensure minimized player is hidden when opening main player
            if (minimizedPlayer) minimizedPlayer.classList.remove('active');
        }

        // 2. Update Text Info
        mainPlayerName.textContent = stream.name;
        mainPlayerStatus.textContent = "Loading Stream...";
        mainPlayerStatus.style.color = "var(--theme-color)";
        document.title = `${stream.name} - Phillite`;

        // Update Mini Player Info
        if (miniPlayerName) miniPlayerName.textContent = stream.name;
        if (miniPlayerStatus) miniPlayerStatus.textContent = "Loading...";
        if (miniPlayerLogo) {
            miniPlayerLogo.src = stream.logo || 'assets/favicon.png';
            miniPlayerLogo.style.display = 'block';
        }

        // 3. Initialize Player Instance if it doesn't exist
        if (!player) {
            const success = await initPlayer();
            if (!success) return;
        }

        if (ui) ui.setEnabled(true);

        try {
            // 4. Unload previous stream
            await player.unload();

            // 5. Configure DRM (ClearKeys)
            // This maps the k1/k2 from your JSON to the player
            const config = {
                drm: {
                    servers: {},
                    clearKeys: {}
                }
            };

            if (stream.k1 && stream.k2) {
                config.drm.clearKeys[stream.k1] = stream.k2;
            }

            player.configure(config);

            console.log(`Attempting to load: ${stream.name}`);

            // 6. Load the Stream
            await player.load(stream.manifestUri);
            
            // 7. Play
            await videoElement.play();
            
            // 8. Success UI Update
            mainPlayerStatus.textContent = "Now Playing";
            if(miniPlayerStatus) miniPlayerStatus.textContent = "Live";

        } catch (e) {
            console.error('Load Error:', e);
            mainPlayerStatus.textContent = "Stream Failed to Load";
            mainPlayerStatus.style.color = "red";
            
            // Don't close the player automatically so user sees the error
        }
    };

    // --- PLAYER CONTROLS ---
    
    // Minimize: Hides full screen, shows bottom bar
    const minimizePlayer = (e) => {
        if(e) e.stopPropagation();
        
        if (playerView && playerView.classList.contains('active')) {
            playerView.classList.remove('active');
            // Small delay for animation
            setTimeout(() => {
                if (minimizedPlayer) minimizedPlayer.classList.add('active');
            }, 300);
        }
    };

    // Restore: Hides bottom bar, shows full screen
    const restorePlayer = (e) => {
        // Ignore if clicking the close button inside the mini player
        if (e.target.closest('#exit-player-btn')) return;
        
        if (minimizedPlayer && minimizedPlayer.classList.contains('active')) {
            minimizedPlayer.classList.remove('active');
            if (playerView) playerView.classList.add('active');
        }
    };

    // Close: Stops everything
    const closePlayer = async (e) => {
        if(e) e.stopPropagation();

        if (player) {
            await player.unload();
        }
        
        activeStream = null;
        document.title = originalTitle;

        // Hide all player UIs
        if (playerView) playerView.classList.remove('active');
        if (minimizedPlayer) minimizedPlayer.classList.remove('active');
        
        // Reset Text
        setTimeout(() => {
            mainPlayerName.textContent = 'Select a Channel';
            mainPlayerStatus.textContent = 'Idle';
        }, 300);
    };


    // --- DATA FETCHING ---
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
                    <p>Unable to load channels.</p>
                    <small>${error.message}</small>
                </div>`;
            return [];
        }
    }

    // --- RENDERING ---
    const renderChannels = (reset = false) => {
        if (reset) {
            channelListingsContainer.innerHTML = '';
            currentlyDisplayedCount = 0;
        }

        const channelsToRender = currentFilteredStreams.slice(currentlyDisplayedCount, currentlyDisplayedCount + CHANNELS_PER_PAGE);

        if(channelsToRender.length === 0 && reset) {
            channelListingsContainer.innerHTML = '<p style="text-align:center; width:100%; padding:20px; color:gray;">No channels found.</p>';
            loadMoreContainer.style.display = 'none';
            return;
        }

        channelsToRender.forEach(stream => {
            const item = document.createElement('div');
            item.className = 'channel-list-item';
            
            // Use a transparent placeholder if logo fails
            const logoSrc = stream.logo || 'assets/favicon.png';
            
            item.innerHTML = `
                <div class="channel-info-left">
                    <img src="${logoSrc}" alt="${stream.name}" class="channel-logo" loading="lazy" onerror="this.style.opacity='0'">
                    <span class="channel-name">${stream.name}</span>
                </div>
                <div class="channel-info-right">
                    <span class="material-symbols-rounded">play_circle</span>
                </div>`;

            // CLICK EVENT
            item.addEventListener('click', () => openPlayer(stream));
            channelListingsContainer.appendChild(item);
        });

        currentlyDisplayedCount += channelsToRender.length;
        
        // Handle Load More Button Visibility
        if (currentlyDisplayedCount >= currentFilteredStreams.length) {
            loadMoreContainer.style.display = 'none';
        } else {
            loadMoreContainer.style.display = 'block';
        }
    };

    // --- SEARCH ---
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

    // --- SLIDER ---
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
        
        // Dot click events
        dots.forEach((dot, index) => {
            dot.addEventListener("click", () => {
                currentSlide = index;
                goToSlide(index);
                clearInterval(slideInterval);
                slideInterval = setInterval(nextSlide, 6000);
            });
        });
    };

    // --- EVENT LISTENERS ---
    
    // Header scroll effect
    window.addEventListener("scroll", () => {
        header.classList.toggle("scrolled", window.scrollY > 10);
    });

    // Floating Menu
    const renderMenu = () => {
        if(floatingMenu) {
            floatingMenu.innerHTML = `
            <ul>
                <li><a href="#"><span class="material-symbols-rounded">info</span> About</a></li>
                <li><a href="#"><span class="material-symbols-rounded">bug_report</span> Report Issue</a></li>
            </ul>`;
        }

        if(menuBtn) {
            menuBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                floatingMenu.classList.toggle("active");
            });
        }
        document.addEventListener("click", () => {
            if(floatingMenu) floatingMenu.classList.remove("active");
        });
    };

    // Player Buttons
    if(minimizeBtn) minimizeBtn.addEventListener('click', minimizePlayer);
    if(minimizedPlayer) minimizedPlayer.addEventListener('click', restorePlayer);
    if(exitBtn) exitBtn.addEventListener('click', closePlayer);
    if(loadMoreBtn) loadMoreBtn.addEventListener('click', () => renderChannels(false));

    // --- INITIALIZATION SEQUENCE ---
    setupSearch();
    renderMenu();
    setupSlider();
    setVideoPoster();

    // Fetch and Render
    allStreams = await fetchChannels();
    if (allStreams && allStreams.length > 0) {
        currentFilteredStreams = [...allStreams];
        renderChannels(true);
    }
});
