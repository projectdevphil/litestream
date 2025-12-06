document.addEventListener('DOMContentLoaded', async () => {
    
    // API Endpoints
    const API_GET_CHANNELS = '/api/getChannels';
    const API_GET_DATA = '/api/getData';
    const API_GET_SLIDES = '/api/getSlides';
    const API_GET_ADS = '/api/getAds';
    const API_INCREMENT_VIEW = '/api/incrementView'; // New
    const API_GET_TOP_CHANNELS = '/api/getTopChannels'; // New

    const CHANNELS_PER_PAGE = 40;
    const BASE_URL_PATH = '/home';
    const POSTER_MOBILE = '/assets/poster/mobile.png';
    const POSTER_DESKTOP = '/assets/poster/desktop.png';

    const header = document.querySelector("header");
    const menuBtn = document.getElementById("menu-btn");
    const floatingMenu = document.getElementById("floating-menu");
    const searchContainer = document.getElementById("search-container");
    const searchToggle = document.getElementById("search-toggle");
    const searchInput = document.getElementById("search-input");
    
    const sliderContainer = document.getElementById('featured-slider');
    const sliderSkeleton = document.getElementById('slider-skeleton');

    const topWatchSection = document.getElementById('top-watch-channels');
    const topWatchList = document.querySelector('.top-watch-list');
    const topWatchSkeleton = document.getElementById('top-watch-skeleton');

    const channelListingsContainer = document.querySelector(".channel-list");
    const channelSkeleton = document.getElementById("channel-skeleton");
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
    const mainPlayerIcon = document.getElementById('main-live-icon'); 
    
    const miniPlayerName = document.getElementById('minimized-player-name');
    const miniPlayerStatus = document.getElementById('minimized-player-status');
    const miniPlayerLogo = document.getElementById("minimized-player-logo");
    const miniPlayerIcon = document.querySelector(".live-sensor-mini"); 

    let player = null;
    let ui = null;
    let allStreams = [];
    let currentFilteredStreams = [];
    let currentlyDisplayedCount = 0;
    let currentActiveChannelSlug = null; 
    const defaultPageTitle = document.title; 
    const offlineChannels = new Set(); 

    let adContainer = null;
    let adTimerDisplay = null;
    let adSkipBtn = null;
    let adVisitBtn = null;

    async function fetchAds() {
        try {
            const response = await fetch(API_GET_ADS);
            if (!response.ok) throw new Error('Failed to load ads');
            const data = await response.json();
            if(Array.isArray(data) && data.length > 0) return data;
            return null;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    function formatAdTime(seconds) {
        if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function createAdUI() {
        if(playerWrapper) {
            const style = window.getComputedStyle(playerWrapper);
            if(style.position === 'static') playerWrapper.style.position = 'relative';
        }

        if (!adContainer) {
            adContainer = document.createElement("div");
            adContainer.id = "ad-controls-right";
            adContainer.style.cssText = `position: absolute; bottom: 20px; right: 20px; display: none; gap: 10px; z-index: 9999; align-items: center;`;

            const btnStyle = `background-color: #FFFFFF; color: #000000; border: none; border-radius: 50%; width: 38px; height: 38px; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.3); transition: transform 0.2s ease, background-color 0.2s;`;

            adVisitBtn = document.createElement("button");
            adVisitBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 22px; line-height: 0;">open_in_new</span>';
            adVisitBtn.style.cssText = btnStyle;
            adVisitBtn.title = "Visit Link";
            
            adSkipBtn = document.createElement("button");
            adSkipBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 26px; line-height: 0;">skip_next</span>';
            adSkipBtn.style.cssText = btnStyle;
            adSkipBtn.title = "Skip Ad";

            const addHover = (btn) => {
                btn.onmouseover = () => { btn.style.transform = "scale(1.1)"; btn.style.backgroundColor = "#f0f0f0"; };
                btn.onmouseout = () => { btn.style.transform = "scale(1)"; btn.style.backgroundColor = "#FFFFFF"; };
            };
            addHover(adVisitBtn);
            addHover(adSkipBtn);

            adContainer.appendChild(adVisitBtn);
            adContainer.appendChild(adSkipBtn);
            playerWrapper.appendChild(adContainer);
        }

        if (!adTimerDisplay) {
            adTimerDisplay = document.createElement("div");
            adTimerDisplay.id = "ad-timer-left";
            adTimerDisplay.textContent = "Ad • 0:00";
            adTimerDisplay.style.cssText = `position: absolute; bottom: 20px; left: 20px; display: none; background-color: rgba(0, 0, 0, 0.6); color: #FFFFFF; padding: 8px; border-radius: 15px; font-weight: 700; font-size: 14px; font-family: inherit; pointer-events: none; z-index: 9999; box-shadow: 0 2px 4px rgba(0,0,0,0.3);`;
            playerWrapper.appendChild(adTimerDisplay);
        }
    }

    async function playVideoAd(vidElem, wrapper, shakaP, shakaUI, statusCallback) {
        createAdUI();

        const adPlaylist = await fetchAds();
        if (!adPlaylist) {
            return;
        }

        const currentAd = adPlaylist[Math.floor(Math.random() * adPlaylist.length)];
        
        if (shakaP) await shakaP.unload();
        if (shakaUI) shakaUI.setEnabled(false);
        if (statusCallback) statusCallback("Advertisement", "yellow");

        adContainer.style.display = 'flex';
        adTimerDisplay.style.display = 'block';
        adTimerDisplay.textContent = "Loading Ad...";

        const preventContextMenu = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
        vidElem.addEventListener('contextmenu', preventContextMenu);
        vidElem.setAttribute('controlsList', 'nodownload');

        return new Promise((resolve) => {
            const finishAd = () => {
                vidElem.removeEventListener('ended', finishAd);
                vidElem.removeEventListener('error', onError);
                vidElem.removeEventListener('timeupdate', onTimeUpdate);
                vidElem.removeEventListener('contextmenu', preventContextMenu);

                if (adSkipBtn) adSkipBtn.onclick = null;
                if (adVisitBtn) adVisitBtn.onclick = null;

                adContainer.style.display = 'none';
                adTimerDisplay.style.display = 'none';
                resolve();
            };

            const onError = (e) => { finishAd(); };
            const onSkipClicked = (e) => { if(e) e.stopPropagation(); finishAd(); };
            const onVisitClicked = (e) => {
                if(e) e.stopPropagation();
                if (currentAd.linkUrl && currentAd.linkUrl !== '#') window.open(currentAd.linkUrl, '_blank');
            };

            const onTimeUpdate = () => {
                if(vidElem.duration && vidElem.currentTime > 0) {
                    const remaining = vidElem.duration - vidElem.currentTime;
                    adTimerDisplay.textContent = "Ad • " + formatAdTime(remaining);
                }
            };

            vidElem.src = currentAd.videoUrl;
            vidElem.loop = false;
            vidElem.controls = false;
            vidElem.muted = false;

            vidElem.addEventListener('ended', finishAd);
            vidElem.addEventListener('error', onError);
            vidElem.addEventListener('timeupdate', onTimeUpdate);

            adSkipBtn.onclick = onSkipClicked;
            adVisitBtn.onclick = onVisitClicked;

            vidElem.play().catch(e => { finishAd(); });
        });
    }

    function stopVideoAd() {
        if(adContainer) adContainer.style.display = 'none';
        if(adTimerDisplay) adTimerDisplay.style.display = 'none';
        if(videoElement) {
            videoElement.pause();
            videoElement.removeAttribute('src'); 
            videoElement.load();
        }
    }

    const fetchSlides = async () => {
        try {
            const response = await fetch(API_GET_SLIDES);
            if (!response.ok) throw new Error('Failed to load slides');
            return await response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    };

    const renderSlider = (slidesData) => {
        if (sliderSkeleton) sliderSkeleton.style.display = 'none';
        if (sliderContainer) sliderContainer.style.display = 'block';

        if (!slidesData || slidesData.length === 0 || !sliderContainer) return;

        const sliderWrapper = document.createElement('div');
        sliderWrapper.className = 'slider';

        const navWrapper = document.createElement('div');
        navWrapper.className = 'slider-nav';

        slidesData.forEach((data, index) => {
            let slide;
            if (data.link) {
                slide = document.createElement('a');
                slide.href = data.link;
                slide.addEventListener('contextmenu', e => e.preventDefault());
                slide.addEventListener('dragstart', e => e.preventDefault());
            } else {
                slide = document.createElement('div');
            }

            slide.className = index === 0 ? 'slide active' : 'slide';
            slide.style.setProperty('--slide-bg', `url('${data.image}')`);

            slide.innerHTML = `
                <div class="slide-wipe-wrapper">
                    <img src="${data.image}" alt="${data.title}" class="slide-bg">
                    <div class="slide-overlay"></div>
                    <div class="slide-content">
                        <h2 class="slide-title">${data.title}</h2>
                        <p class="slide-description">${data.description}</p>
                        <div class="slide-badge visit-badge">${data.badge}</div>
                    </div>
                </div>
            `;
            sliderWrapper.appendChild(slide);

            const dot = document.createElement('button');
            dot.className = index === 0 ? 'dot active' : 'dot';
            navWrapper.appendChild(dot);
        });

        sliderContainer.appendChild(sliderWrapper);
        sliderContainer.appendChild(navWrapper);

        initSliderLogic(sliderWrapper, navWrapper);
    };

    const initSliderLogic = (slider, nav) => {
        const slides = slider.querySelectorAll(".slide");
        const dots = nav.querySelectorAll(".dot");
        if (slides.length === 0) return;

        const SLIDE_DURATION = 5000;
        slider.style.setProperty('--slide-timer', `${SLIDE_DURATION}ms`);

        let currentSlide = 0;
        let slideInterval = setInterval(nextSlide, SLIDE_DURATION);

        function goToSlide(n) { 
            const index = (n + slides.length) % slides.length;
            slides.forEach((s, i) => s.classList.toggle("active", i === index)); 
            dots.forEach((d, i) => d.classList.toggle("active", i === index)); 
            currentSlide = index;
        }

        function nextSlide() { goToSlide(currentSlide + 1); }

        dots.forEach((dot, index) => {
            dot.addEventListener("click", () => {
                goToSlide(index);
                clearInterval(slideInterval);
                slideInterval = setInterval(nextSlide, SLIDE_DURATION);
            });
        });
    };

    const createSlug = (name) => {
        if (!name) return '';
        return name.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');        
    };
    
    const setResponsivePoster = () => {
        if (!videoElement) return;
        const isDesktop = window.innerWidth > 1024; 
        videoElement.poster = isDesktop ? POSTER_DESKTOP : POSTER_MOBILE;
    };
    
    function updateOfflineState(isOffline) {
        const iconName = isOffline ? 'sensors_off' : 'sensors';
        const colorClass = 'status-offline';

        if(mainPlayerIcon) {
            mainPlayerIcon.textContent = iconName;
            if(isOffline) mainPlayerIcon.classList.add(colorClass);
            else mainPlayerIcon.classList.remove(colorClass);
        }
        
        if(mainPlayerStatus) {
            mainPlayerStatus.textContent = isOffline ? "Stream Offline" : "Now Playing";
            mainPlayerStatus.style.color = isOffline ? "red" : "var(--theme-color)";
        }

        if(miniPlayerIcon) {
            miniPlayerIcon.textContent = iconName;
            if(isOffline) miniPlayerIcon.classList.add(colorClass);
            else miniPlayerIcon.classList.remove(colorClass);
        }
        
        if(miniPlayerStatus) {
            miniPlayerStatus.textContent = isOffline ? "Stream Offline" : "Now Playing";
            miniPlayerStatus.style.color = isOffline ? "red" : "var(--theme-color)";
        }

        if(currentActiveChannelSlug) {
            const listIcon = document.getElementById(`sensor-${currentActiveChannelSlug}`);
            if(listIcon) {
                listIcon.textContent = iconName;
                if(isOffline) listIcon.classList.add(colorClass);
                else listIcon.classList.remove(colorClass);
            }
        }
    }

    const renderMenu = () => {
        if (!floatingMenu) return;
        floatingMenu.innerHTML = `
        <ul>
            <li><a href="/home/updates"><span class="material-symbols-rounded">notifications_active</span> Updates</a></li>
            <li><a href="https://projectdevphil.github.io/stream-tester"><span class="material-symbols-rounded">experiment</span> Stream Tester</a></li>            
            <li><a href="https://projectdevphil.github.io/speedup"><span class="material-symbols-rounded">speed</span> SpeedUp</a></li>            
            <li><a href="/home/about"><span class="material-symbols-rounded">info</span> About Us</a></li>
            <li><a href="/home/faq"><span class="material-symbols-rounded">quiz</span> FAQ</a></li>
            <li><a href="/home/privacy"><span class="material-symbols-rounded">shield</span> Privacy Policy</a></li>
            <li><a href="/home/terms"><span class="material-symbols-rounded">gavel</span> Terms of Service</a></li>
        </ul>`;
        
        const menuLinks = floatingMenu.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; });
            link.style.userSelect = 'none';              
        });
    };

    // --- NEW: Send view to Vercel KV ---
    async function trackChannelView(channel) {
        try {
            const slug = createSlug(channel.name);
            // Fire and forget, don't await response to speed up UI
            fetch(`${API_INCREMENT_VIEW}?channel=${slug}`);
        } catch (e) {
            console.error("Tracking error", e);
        }
    }

    // --- NEW: Fetch Global Top 5 from Vercel KV ---
    async function renderTopWatch() {
        if (!topWatchSection || !topWatchList) return;

        // Show Skeleton initially
        if(topWatchSkeleton && topWatchList.style.display === 'none') {
            topWatchSkeleton.style.display = 'flex';
        }

        try {
            // Fetch list of slugs ['cnn', 'abc', ...]
            const res = await fetch(API_GET_TOP_CHANNELS);
            const topSlugs = await res.json();

            // Hide skeleton
            if(topWatchSkeleton) topWatchSkeleton.style.display = 'none';
            
            if (!Array.isArray(topSlugs) || topSlugs.length === 0) {
                topWatchSection.style.display = 'none';
                return;
            }

            topWatchList.style.display = 'flex';
            topWatchSection.style.display = 'block';
            topWatchList.innerHTML = '';

            topSlugs.forEach((slug, index) => {
                // Find full channel details from the main list
                const channel = allStreams.find(s => createSlug(s.name) === slug);
                if (channel) {
                    const item = document.createElement('div');
                    item.className = 'top-watch-item';
                    item.onclick = () => openPlayer(channel);
                    
                    const logo = channel.logo || '/assets/favicon.svg';
                    
                    // Design: Number overlaps card
                    item.innerHTML = `
                        <div class="top-rank-number">${index + 1}</div>
                        <div class="top-watch-logo-container">
                            <img src="${logo}" class="top-watch-logo" alt="${channel.name}">
                        </div>
                    `;
                    topWatchList.appendChild(item);
                }
            });

        } catch (e) {
            console.error("Failed to load top channels:", e);
            if(topWatchSkeleton) topWatchSkeleton.style.display = 'none';
            topWatchSection.style.display = 'none';
        }
    }

    const initPlayer = async () => {
        shaka.polyfill.installAll();
        if (shaka.Player.isBrowserSupported()) {
            player = new shaka.Player(videoElement);
            try {
                ui = new shaka.ui.Overlay(player, playerWrapper, videoElement);
                ui.configure({ addSeekBar: false });
            } catch (e) {
                console.warn(e);
                videoElement.controls = true;
            }

            player.addEventListener('error', (event) => {
                console.error(event.detail.code);
                
                if(currentActiveChannelSlug) {
                    offlineChannels.add(currentActiveChannelSlug);
                }
                
                updateOfflineState(true); 
            });
            return true;
        } else {
            alert("Browser not supported");
            return false;
        }
    };

    const openPlayer = async (publicStreamInfo) => {
        // Track the view globally
        trackChannelView(publicStreamInfo);

        if(currentActiveChannelSlug && !offlineChannels.has(currentActiveChannelSlug)) {
            const prevIcon = document.getElementById(`sensor-${currentActiveChannelSlug}`);
            if(prevIcon) {
                prevIcon.textContent = 'sensors';
                prevIcon.classList.remove('status-offline');
            }
        }

        currentActiveChannelSlug = createSlug(publicStreamInfo.name);

        if (playerView) {
            playerView.classList.add('active');
            document.body.classList.add('no-scroll');
            if (minimizedPlayer) minimizedPlayer.classList.remove('active');
        }

        updateOfflineState(offlineChannels.has(currentActiveChannelSlug));
        
        if(mainPlayerStatus) {
            mainPlayerStatus.textContent = "Loading Stream...";
            mainPlayerStatus.style.color = "var(--theme-color)";
        }

        mainPlayerName.textContent = publicStreamInfo.name;
        const groupTitle = publicStreamInfo.group || "Live Stream"; 
        
        if(miniPlayerName) miniPlayerName.textContent = publicStreamInfo.name;
        if(miniPlayerLogo) {
            miniPlayerLogo.src = publicStreamInfo.logo || '/assets/favicon.svg';
            miniPlayerLogo.style.display = 'block'; 
        }

        const newUrl = `${BASE_URL_PATH}?channel=${currentActiveChannelSlug}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
        document.title = `${publicStreamInfo.name} - Litestream`;

        await playVideoAd(videoElement, playerWrapper, player, ui, (text, color) => {
             if(mainPlayerStatus) {
                mainPlayerStatus.textContent = text;
                mainPlayerStatus.style.color = color;
             }
        });

        if (!playerView.classList.contains('active')) return;
        
        videoElement.removeAttribute('src'); 
        videoElement.load(); 

        try {
            const res = await fetch(`${API_GET_DATA}?channel=${encodeURIComponent(publicStreamInfo.name)}`);
            if (res.status === 400 || res.status === 404) throw new Error("Channel data not found.");
            const secureData = await res.json();

            if (!player) {
                const success = await initPlayer();
                if (!success) return;
            }

            const config = { drm: { servers: {}, clearKeys: {} } };
            if (secureData.ClearKey && secureData.ClearKey.k1 && secureData.ClearKey.k2) {
                config.drm.clearKeys[secureData.ClearKey.k1] = secureData.ClearKey.k2;
            }
            player.configure(config);
            if (ui) ui.setEnabled(true);

            await player.load(secureData.manifestUri);
            videoElement.play().catch(() => console.log("Stream Auto-play blocked"));
            
            offlineChannels.delete(currentActiveChannelSlug);
            updateOfflineState(false); 
            if(mainPlayerStatus) mainPlayerStatus.textContent = groupTitle;

        } catch (e) {
            console.error(e);
            offlineChannels.add(currentActiveChannelSlug);
            updateOfflineState(true);
        }
    };

    const minimizePlayer = () => {
        if (playerView.classList.contains('active')) {
            playerView.classList.remove('active');
            document.body.classList.remove('no-scroll');
            setTimeout(() => { if(minimizedPlayer) minimizedPlayer.classList.add('active'); }, 300);
        }
    };

    const restorePlayer = (e) => {
        if (e.target.closest('#exit-player-btn')) return; 
        if(minimizedPlayer) minimizedPlayer.classList.remove('active');
        if(playerView) playerView.classList.add('active');
        document.body.classList.add('no-scroll');
    };

    const closePlayer = async () => {
        stopVideoAd();
        if (player) await player.unload();
        
        if(playerView) playerView.classList.remove('active');
        if(minimizedPlayer) minimizedPlayer.classList.remove('active');
        document.body.classList.remove('no-scroll');

        if(currentActiveChannelSlug) {
            const listIcon = document.getElementById(`sensor-${currentActiveChannelSlug}`);
            if(listIcon && !offlineChannels.has(currentActiveChannelSlug)) {
                listIcon.textContent = 'sensors';
                listIcon.classList.remove('status-offline');
            }
            currentActiveChannelSlug = null;
        }

        window.history.pushState({}, '', BASE_URL_PATH);
        document.title = defaultPageTitle;
    };

    async function fetchChannels() {
        try {
            const response = await fetch(API_GET_CHANNELS);
            const channels = await response.json();
            return channels;
        } catch (error) {
            console.error(error);
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
            const slug = createSlug(stream.name);
            
            if (stream.status === 'offline' || stream.active === false) {
                offlineChannels.add(slug);
            }

            const isOffline = offlineChannels.has(slug);
            const iconName = isOffline ? 'sensors_off' : 'sensors';
            const colorClass = isOffline ? 'status-offline' : '';

            item.innerHTML = `
                <div class="channel-info-left">
                    <img src="${logo}" class="channel-logo" onerror="this.style.opacity=0">
                    <span class="channel-name">${stream.name}</span>
                </div>
                <div class="channel-info-right">
                    <span id="sensor-${slug}" class="material-symbols-rounded ${colorClass}">${iconName}</span>
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

    setResponsivePoster();
    window.addEventListener('resize', setResponsivePoster);
    renderMenu();
    
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

    const slidesData = await fetchSlides();
    renderSlider(slidesData);

    allStreams = await fetchChannels();
    currentFilteredStreams = [...allStreams];
    
    if(channelSkeleton) channelSkeleton.style.display = 'none';
    channelListingsContainer.style.display = 'flex';
    
    renderChannels(true);

    // Call Global Top Watch (it will wait for API)
    renderTopWatch();

    const urlParams = new URLSearchParams(window.location.search);
    const channelSlug = urlParams.get('channel');
    let hasPlayedLink = false;

    if (channelSlug) {
        const foundChannel = allStreams.find(s => createSlug(s.name) === channelSlug);
        if (foundChannel) {
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
        if (mainPlayerStatus) mainPlayerStatus.textContent = "";
        updateOfflineState(false);
        if(videoElement) videoElement.poster = POSTER_DESKTOP;
    }

    const headerLogo = document.querySelector('.header-left .logo');
    if (headerLogo) {
        headerLogo.addEventListener('contextmenu', e => e.preventDefault());
        headerLogo.addEventListener('dragstart', e => e.preventDefault());
        headerLogo.style.webkitTouchCallout = 'none';
        headerLogo.style.userSelect = 'none';
    }

});
