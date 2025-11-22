window.addEventListener('load', () => {
    const allSelectors = {
        menuBtn: document.getElementById("menu-btn"),
        floatingMenu: document.getElementById("floating-menu"),
        searchWrapper: document.getElementById("search-wrapper"),
        searchBtn: document.getElementById("search-btn"),
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

    let playerInstance = null;
    let allStreams = [];
    let currentFilteredStreams = [];
    const CHANNELS_PER_PAGE = 20;
    let currentlyDisplayedCount = 0;

    // --- Restored Slider Logic ---
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

    // --- Restored Menu Logic ---
    const renderMenu = () => {
        allSelectors.floatingMenu.innerHTML = `
        <ul>
            <li><a href="/home/about-us"><span class="material-symbols-outlined">info</span> About Us</a></li>
            <li><a href="/home/faq"><span class="material-symbols-outlined">quiz</span> FAQ</a></li>
            <li><a href="/home/privacy-policy"><span class="material-symbols-outlined">shield</span> Privacy Policy</a></li>
            <li><a href="/home/terms-of-service"><span class="material-symbols-outlined">gavel</span> Terms of Service</a></li>
        </ul>`;

        allSelectors.floatingMenu.querySelectorAll("li").forEach(e => e.addEventListener("click", t => {
            const n = e.querySelector("a");
            if (n) { 
                // Prevent default for demo purposes as pages don't exist
                t.preventDefault(); 
                console.log("Navigating to:", n.href);
            }
        }));
        
        allSelectors.menuBtn.addEventListener("click", e => { e.stopPropagation(); allSelectors.floatingMenu.classList.toggle("active"); });
        document.addEventListener("click", () => allSelectors.floatingMenu.classList.remove("active"));
        allSelectors.floatingMenu.addEventListener("click", e => e.stopPropagation());
    };

    // --- M3U Parsing with DRM Support ---
    async function fetchAndProcessM3U() {
        const M3U_URL = "https://raw.githubusercontent.com/projectdevphil/iptv-playlist/refs/heads/new-path/visionlite/index.m3u";
        allSelectors.spinner.style.display = 'flex';
        
        try {
            const response = await fetch(M3U_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const m3uText = await response.text();
            
            const lines = m3uText.trim().split('\n');
            const parsedStreams = [];
            
            let currentInfo = {};
            let currentDrm = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Parse DRM Props (Kodi format)
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

                // Parse Info
                if (line.startsWith('#EXTINF:')) {
                    const infoPart = line.substring(line.indexOf(':') + 1);
                    const name = infoPart.split(',').pop().trim();
                    
                    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                    const logo = logoMatch ? logoMatch[1] : '';

                    const groupMatch = line.match(/group-title="([^"]*)"/);
                    const group = groupMatch ? groupMatch[1] : 'General';

                    currentInfo = { name, logo, group };
                }

                // Parse URL
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
            allSelectors.channelListingsContainer.innerHTML = '<p style="text-align:center; padding:20px; color: #666;">Unable to load channels.</p>';
            return [];
        }
    }

    // --- Rendering ---
    const renderChannels = (reset = false) => {
        if (reset) {
            allSelectors.channelListingsContainer.innerHTML = '';
            currentlyDisplayedCount = 0;
        }

        const channelsToRender = currentFilteredStreams.slice(
            currentlyDisplayedCount, 
            currentlyDisplayedCount + CHANNELS_PER_PAGE
        );

        if (channelsToRender.length === 0 && currentlyDisplayedCount === 0) {
             allSelectors.channelListingsContainer.innerHTML = '<p style="text-align:center; width:100%; padding:20px; color: #666;">No channels found.</p>';
             allSelectors.loadMoreContainer.style.display = 'none';
             return;
        }

        channelsToRender.forEach(stream => {
            const item = document.createElement('div');
            item.className = 'channel-list-item';
            item.innerHTML = `
                <div class="channel-info-left">
                    <img src="${stream.logo}" alt="${stream.name}" class="channel-logo" onerror="this.style.opacity='0.3'">
                    <span class="channel-name">${stream.name}</span>
                </div>
                <div class="channel-info-right">
                    <span class="material-symbols-outlined">play_circle</span>
                </div>`;
            
            item.addEventListener('click', () => openPlayer(stream));
            allSelectors.channelListingsContainer.appendChild(item);
        });

        currentlyDisplayedCount += channelsToRender.length;
        
        if (currentlyDisplayedCount >= currentFilteredStreams.length) {
            allSelectors.loadMoreContainer.style.display = 'none';
        } else {
            allSelectors.loadMoreContainer.style.display = 'block';
        }
    };

    // --- Search Logic ---
    const setupSearch = () => {
        allSelectors.searchBtn.addEventListener('click', () => {
            allSelectors.searchWrapper.classList.toggle('active');
            if(allSelectors.searchWrapper.classList.contains('active')) {
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

    // --- Player Logic (JW Player) ---
    const initJWPlayer = () => {
        if (!playerInstance) {
            playerInstance = jwplayer("jw-player-container");
        }
    };

    const openPlayer = (stream) => {
        initJWPlayer();

        const playlistItem = {
            file: stream.manifestUri,
            title: stream.name,
            image: stream.logo,
            type: "dash", 
            autostart: true,
            mute: false
        };

        if (stream.drm) {
            playlistItem.drm = stream.drm;
        }

        playerInstance.setup({
            playlist: [playlistItem],
            width: "100%",
            height: "100%",
            autostart: true,
            stretching: "uniform",
        });

        document.getElementById("player-channel-name").textContent = stream.name;
        document.getElementById("player-channel-group").textContent = stream.group || 'Live TV';
        
        allSelectors.playerView.classList.add("active");
        allSelectors.minimizedPlayer.classList.remove("active");

        document.getElementById("minimized-player-name").textContent = stream.name;
        const miniLogo = document.getElementById("minimized-player-logo");
        miniLogo.src = stream.logo;
        miniLogo.style.display = stream.logo ? 'block' : 'none';
    };

    const minimizePlayer = () => {
        allSelectors.playerView.classList.remove("active");
        allSelectors.minimizedPlayer.classList.add("active");
    };

    const restorePlayer = (e) => {
        if(e.target.closest('#exit-player-btn')) return;
        allSelectors.minimizedPlayer.classList.remove("active");
        allSelectors.playerView.classList.add("active");
    };

    const closePlayer = (e) => {
        e.stopPropagation();
        if (playerInstance) {
            playerInstance.stop();
        }
        allSelectors.minimizedPlayer.classList.remove("active");
        allSelectors.playerView.classList.remove("active");
    };

    // --- Initialization ---
    const init = async () => {
        setupSlider();
        renderMenu();
        setupSearch();
        
        allStreams = await fetchAndProcessM3U();
        currentFilteredStreams = [...allStreams];
        renderChannels();

        allSelectors.loadMoreBtn.addEventListener('click', () => renderChannels(false));
        allSelectors.minimizeBtn.addEventListener('click', minimizePlayer);
        allSelectors.minimizedPlayer.addEventListener('click', restorePlayer);
        allSelectors.exitBtn.addEventListener('click', closePlayer);
    };

    init();
});
