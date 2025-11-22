window.addEventListener('load', initApp);

async function initApp() {
    
    const allSelectors = {
        header: document.querySelector("header"),
        menuBtn: document.getElementById("menu-btn"),
        floatingMenu: document.getElementById("floating-menu"),
        searchContainer: document.getElementById("search-container"),
        searchToggle: document.getElementById("search-toggle"),
        searchInput: document.getElementById("search-input"),
        channelListingsContainer: document.querySelector(".channel-list"),
        spinner: document.getElementById("spinner"),
        playerView: document.getElementById("player-view"),
        minimizeBtn: document.getElementById("minimize-player-btn"),
        minimizedPlayer: document.getElementById("minimized-player"),
        exitBtn: document.getElementById("exit-player-btn"),
        loadMoreContainer: document.getElementById("load-more-container"),
        loadMoreBtn: document.getElementById("load-more-btn"),
        channelHeader: document.getElementById("channel-list-header")
    };

    let shakaPlayer = null;
    let uiOverlay = null;
    let allStreams = [];
    let currentFilteredStreams = [];
    const CHANNELS_PER_PAGE = 50;
    let currentlyDisplayedCount = 0;
    let activeStream = null;

    // --- Helper from Stream Tester: Decode Base64 keys if needed ---
    function base64UrlToHex(base64Url) {
        try {
            let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) {
                base64 += '=';
            }
            const raw = atob(base64);
            let hex = '';
            for (let i = 0; i < raw.length; i++) {
                hex += raw.charCodeAt(i).toString(16).padStart(2, '0');
            }
            return hex;
        } catch (e) {
            console.error('Failed to decode base64 string:', base64Url, e);
            return null;
        }
    }

    async function initShaka() {
        shaka.Polyfill.installAll();

        if (!shaka.Player.isBrowserSupported()) {
            console.error('Browser not supported!');
            return;
        }

        const video = document.getElementById('video');
        const videoContainer = document.getElementById('video-container');
        
        const player = new shaka.Player(video);
        const ui = new shaka.ui.Overlay(player, videoContainer, video);

        // Configure Shaka for better streaming stability
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
        
        shakaPlayer = player;
        uiOverlay = ui;

        shakaPlayer.addEventListener('error', (event) => {
            console.error('Shaka Error code', event.detail.code, 'object', event.detail);
        });
    }

    async function loadStream(stream) {
        if (!shakaPlayer) {
            await initShaka();
        }

        // Unload previous stream completely
        await shakaPlayer.unload();

        const config = {
            drm: {
                servers: {} 
            }
        };

        // Logic from Stream Tester: Handle ClearKey properly
        if (stream.licenseType === 'org.w3.clearkey' && stream.k1 && stream.k2) {
             config.drm.clearKeys = {
                [stream.k1]: stream.k2
            };
        } 
        // Handle Widevine or License Servers if present
        else if (stream.licenseType && stream.licenseKey && !stream.k1) {
            config.drm.servers[stream.licenseType] = stream.licenseKey;
        }

        shakaPlayer.configure(config);

        try {
            console.log("Loading stream:", stream.name);
            await shakaPlayer.load(stream.manifestUri);
            const video = document.getElementById('video');
            video.play().catch(e => console.warn("Auto-play failed, waiting for user interaction", e)); 
        } catch (e) {
            console.error('Error loading video:', e);
        }
    }

    async function fetchAndProcessM3U() {
        const M3U_URL = "https://raw.githubusercontent.com/projectdevphil/iptv-playlist/refs/heads/new-path/visionlite/index.m3u";
        allSelectors.spinner.style.display = 'flex';
        
        try {
            const response = await fetch(M3U_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            const m3uText = await response.text();
            
            // --- ADVANCED PARSING LOGIC (From Stream Tester) ---
            const lines = m3uText.trim().split('\n');
            const parsedStreams = [];
            
            let currentInfo = {};
            let currentDrm = {}; 

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // 1. Check for License Type
                if (line.startsWith('#KODIPROP:inputstream.adaptive.license_type=')) {
                    const type = line.split('=')[1]?.trim();
                    if (type.toLowerCase() === 'clearkey') {
                        currentDrm.licenseType = 'org.w3.clearkey';
                    } else {
                        currentDrm.licenseType = type;
                    }
                } 

                // 2. Check for License Key (Handles JSON, URL, and Key:Kid format)
                else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                    const keyData = line.split('=').slice(1).join('=');
                    
                    // A. Handle JSON keys (e.g. {"keys":...})
                    if (keyData.trim().startsWith('{')) {
                        try {
                            const parsedJson = JSON.parse(keyData);
                            if (parsedJson.keys && parsedJson.keys.length > 0) {
                                const keyInfo = parsedJson.keys[0];
                                if (keyInfo.k && keyInfo.kid) {
                                    currentDrm.k2 = base64UrlToHex(keyInfo.k);
                                    currentDrm.k1 = base64UrlToHex(keyInfo.kid);
                                    currentDrm.licenseType = 'org.w3.clearkey';
                                }
                            }
                        } catch (e) {
                            console.error('Failed to parse license_key JSON:', keyData, e);
                        }
                    }
                    // B. Handle License URL (Widevine/Playready)
                    else if (keyData.includes('http://') || keyData.includes('https://')) {
                        currentDrm.licenseKey = keyData.trim();
                    } 
                    // C. Handle Standard Hex ID:Key
                    else {
                        const keyParts = keyData.split(':');
                        if (keyParts.length === 2 && keyParts[0].trim() && keyParts[1].trim()) {
                            currentDrm.k1 = keyParts[0].trim(); // kid
                            currentDrm.k2 = keyParts[1].trim(); // key
                            currentDrm.licenseType = 'org.w3.clearkey';
                        }
                    }
                }

                // 3. Check for Channel Info
                else if (line.startsWith('#EXTINF:')) {
                    const infoPart = line.substring(line.indexOf(':') + 1);
                    const name = infoPart.split(',').pop().trim();
                    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                    const groupMatch = line.match(/group-title="([^"]*)"/);
                    
                    currentInfo = { 
                        name, 
                        logo: logoMatch ? logoMatch[1] : '/assets/favicon.png', 
                        group: groupMatch ? groupMatch[1] : 'General' 
                    };
                }

                // 4. Check for Stream URL
                else if (line.startsWith('http')) {
                    parsedStreams.push({
                        name: currentInfo.name || 'Unknown Channel',
                        logo: currentInfo.logo,
                        group: currentInfo.group,
                        manifestUri: line,
                        // Merge DRM info
                        licenseType: currentDrm.licenseType,
                        k1: currentDrm.k1,
                        k2: currentDrm.k2,
                        licenseKey: currentDrm.licenseKey
                    });
                    // Reset buffers
                    currentInfo = {};
                    currentDrm = {};
                }
            }

            allSelectors.spinner.style.display = 'none';
            return parsedStreams;

        } catch (error) {
            console.error("Failed to load playlist:", error);
            allSelectors.spinner.style.display = 'none';
            allSelectors.channelListingsContainer.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">Failed to load channels.</p>';
            return [];
        }
    }

    const renderChannels = (reset = false) => {
        if (reset) {
            allSelectors.channelListingsContainer.innerHTML = '';
            currentlyDisplayedCount = 0;
        }

        const channelsToRender = currentFilteredStreams.slice(currentlyDisplayedCount, currentlyDisplayedCount + CHANNELS_PER_PAGE);

        channelsToRender.forEach(stream => {
            const item = document.createElement('div');
            item.className = 'channel-list-item';
            
            item.innerHTML = `
                <div class="channel-info-left">
                    <img src="${stream.logo}" alt="${stream.name}" class="channel-logo" onerror="this.src='/assets/favicon.png'; this.style.opacity='0.5'">
                    <span class="channel-name">${stream.name}</span>
                </div>
                <div class="channel-info-right">
                    <span class="material-symbols-rounded">sensors</span>
                </div>`;

            item.addEventListener('click', () => openPlayer(stream));
            allSelectors.channelListingsContainer.appendChild(item);
        });

        currentlyDisplayedCount += channelsToRender.length;
        allSelectors.loadMoreContainer.style.display = currentlyDisplayedCount < currentFilteredStreams.length ? 'block' : 'none';
    };

    const openPlayer = (stream) => {
        activeStream = stream;
        loadStream(stream);

        document.getElementById("player-channel-name").textContent = stream.name;
        document.getElementById("player-channel-status").textContent = "Now Playing";
        
        document.getElementById("minimized-player-name").textContent = stream.name;
        document.getElementById("minimized-player-status").textContent = "Now Playing";

        const miniLogo = document.getElementById("minimized-player-logo");
        miniLogo.src = stream.logo;
        miniLogo.style.display = 'block';

        allSelectors.playerView.classList.add("active");
        allSelectors.minimizedPlayer.classList.remove("active");
    };

    const minimizePlayer = () => {
        allSelectors.playerView.classList.remove("active");
        setTimeout(() => {
            allSelectors.minimizedPlayer.classList.add("active");
        }, 300);
    };

    const restorePlayer = (e) => {
        if(e.target.closest('#exit-player-btn')) return;
        allSelectors.minimizedPlayer.classList.remove("active");
        allSelectors.playerView.classList.add("active");
    };

    const closePlayer = (e) => {
        e.stopPropagation();
        if (shakaPlayer) {
            shakaPlayer.unload();
            // Visual reset
            document.getElementById('video').removeAttribute('src'); 
            document.getElementById('video').load();
        }
        allSelectors.minimizedPlayer.classList.remove("active");
        allSelectors.playerView.classList.remove("active");
        activeStream = null;
    };

    const setupSearch = () => {
        allSelectors.searchToggle.addEventListener('click', () => {
            allSelectors.searchContainer.classList.toggle('active');
            if(allSelectors.searchContainer.classList.contains('active')) {
                allSelectors.searchInput.focus();
            } else {
                allSelectors.searchInput.value = '';
                performSearch('');
            }
        });

        allSelectors.searchInput.addEventListener('input', (e) => {
            performSearch(e.target.value.toLowerCase());
        });
    };

    const performSearch = (query) => {
        if (query.length > 0) {
            currentFilteredStreams = allStreams.filter(s => s.name.toLowerCase().includes(query));
            allSelectors.channelHeader.textContent = `Search Results (${currentFilteredStreams.length})`;
        } else {
            currentFilteredStreams = [...allStreams];
            allSelectors.channelHeader.textContent = "Channels";
        }
        renderChannels(true);
    };

    const renderMenu = () => {
        allSelectors.floatingMenu.innerHTML = `
        <ul>
            <li><a href="#"><span class="material-symbols-rounded">info</span> About Us</a></li>
            <li><a href="#"><span class="material-symbols-rounded">quiz</span> FAQ</a></li>
            <li><a href="#"><span class="material-symbols-rounded">shield</span> Privacy Policy</a></li>
            <li><a href="#"><span class="material-symbols-rounded">gavel</span> Terms of Service</a></li>
        </ul>`;

        allSelectors.menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            allSelectors.floatingMenu.classList.toggle("active");
        });
        document.addEventListener("click", () => allSelectors.floatingMenu.classList.remove("active"));
    };

    const setupSlider = () => {
        const slider = document.querySelector(".slider");
        if (!slider) return;
        const slides = slider.querySelectorAll(".slide");
        const dots = slider.parentElement.querySelectorAll(".slider-nav .dot");
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

    window.addEventListener("scroll", () => allSelectors.header.classList.toggle("scrolled", window.scrollY > 10));
    
    setupSearch();
    renderMenu();
    setupSlider();

    allSelectors.loadMoreBtn.addEventListener('click', () => renderChannels(false));
    allSelectors.minimizeBtn.addEventListener('click', minimizePlayer);
    allSelectors.minimizedPlayer.addEventListener('click', restorePlayer);
    allSelectors.exitBtn.addEventListener('click', closePlayer);

    allStreams = await fetchAndProcessM3U();
    currentFilteredStreams = [...allStreams];
    renderChannels();
}
