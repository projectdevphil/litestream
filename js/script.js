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

    async function initShaka() {
        shaka.Polyfill.installAll();

        if (!shaka.Player.isBrowserSupported()) {
            console.error('Browser not supported!');
            return;
        }

        const video = document.getElementById('video');
        const videoContainer = document.querySelector('[data-shaka-player-container]');
        
        const player = new shaka.Player(video);
        const ui = new shaka.ui.Overlay(player, videoContainer, video);
        
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

        const config = {
            drm: {
                servers: {} 
            }
        };

        if (stream.drm && stream.drm.clearkey) {
            config.drm.clearKeys = stream.drm.clearkey;
        }

        shakaPlayer.configure(config);

        try {
            console.log("Loading stream:", stream.name);
            await shakaPlayer.load(stream.manifestUri);
            const video = document.getElementById('video');
            video.play(); 
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
            
            const lines = m3uText.trim().split('\n');
            const parsedStreams = [];
            
            let currentInfo = {};
            let currentDrm = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                    const keyString = line.split('license_key=')[1];
                    if (keyString && keyString.includes(':')) {
                        const [kid, key] = keyString.split(':');
                        currentDrm = {
                            clearkey: {
                                [kid]: key 
                            }
                        };
                    }
                }

                if (line.startsWith('#EXTINF:')) {
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

                if (line.startsWith('http')) {
                    parsedStreams.push({
                        name: currentInfo.name || 'Unknown Channel',
                        logo: currentInfo.logo,
                        group: currentInfo.group,
                        manifestUri: line,
                        drm: currentDrm
                    });
                    currentInfo = {};
                    currentDrm = null;
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

        // Update Player View Labels
        document.getElementById("player-channel-name").textContent = stream.name;
        
        // CHANGE: Set status to "Now Playing" always
        document.getElementById("player-channel-status").textContent = "Now Playing";
        
        // Update Minimized Player Labels
        document.getElementById("minimized-player-name").textContent = stream.name;
        
        // CHANGE: Set status to "Now Playing" always
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
            // CHANGE: Reset to Channels
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
