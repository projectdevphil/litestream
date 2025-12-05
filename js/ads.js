(function() {
    let adContainer = null;
    let timerDisplay = null;
    let skipBtn = null;
    let visitBtn = null;

    async function fetchAds() {
        try {
            const response = await fetch('/api/getAds');
            if (!response.ok) throw new Error('Failed to load ads');
            const data = await response.json();
            if(Array.isArray(data) && data.length > 0) {
                return data;
            }
            return null;
        } catch (error) {
            console.error("Ad Fetch Error:", error);
            return null;
        }
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function createAdUI(playerWrapper) {
        if(playerWrapper) {
            const style = window.getComputedStyle(playerWrapper);
            if(style.position === 'static') {
                playerWrapper.style.position = 'relative';
            }
        }

        if (!adContainer) {
            adContainer = document.createElement("div");
            adContainer.id = "ad-controls-right";
            adContainer.style.cssText = `
                position: absolute;
                bottom: 20px;
                right: 20px;
                display: none;
                gap: 10px;
                z-index: 9999;
                align-items: center;
            `;

            const btnStyle = `
                background-color: #FFFFFF;
                color: #000000;
                border: none;
                border-radius: 50%;
                width: 38px;
                height: 38px;
                display: flex;
                justify-content: center;
                align-items: center;
                cursor: pointer;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                transition: transform 0.2s ease, background-color 0.2s;
            `;

            visitBtn = document.createElement("button");
            visitBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 22px; line-height: 0;">open_in_new</span>';
            visitBtn.style.cssText = btnStyle;
            visitBtn.title = "Visit Link";
            
            skipBtn = document.createElement("button");
            skipBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 26px; line-height: 0;">skip_next</span>';
            skipBtn.style.cssText = btnStyle;
            skipBtn.title = "Skip Ad";

            const addHover = (btn) => {
                btn.onmouseover = () => { btn.style.transform = "scale(1.1)"; btn.style.backgroundColor = "#f0f0f0"; };
                btn.onmouseout = () => { btn.style.transform = "scale(1)"; btn.style.backgroundColor = "#FFFFFF"; };
            };
            addHover(visitBtn);
            addHover(skipBtn);

            adContainer.appendChild(visitBtn);
            adContainer.appendChild(skipBtn);
            playerWrapper.appendChild(adContainer);
        }

        if (!timerDisplay) {
            timerDisplay = document.createElement("div");
            timerDisplay.id = "ad-timer-left";
            timerDisplay.textContent = "Ad • 0:00";
            timerDisplay.style.cssText = `
                position: absolute;
                bottom: 20px;
                left: 20px;
                display: none;
                background-color: rgba(0, 0, 0, 0.6);
                color: #FFFFFF;
                padding: 8px;
                border-radius: 15px;
                font-weight: 700;
                font-size: 14px;
                font-family: inherit;
                pointer-events: none;
                z-index: 9999;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
            playerWrapper.appendChild(timerDisplay);
        }
    }

    window.playVideoAd = async function(videoElement, playerWrapper, shakaPlayer, shakaUI, statusCallback) {
        createAdUI(playerWrapper);

        const adPlaylist = await fetchAds();

        if (!adPlaylist) {
            console.log("No ads to play.");
            return;
        }

        const currentAd = adPlaylist[Math.floor(Math.random() * adPlaylist.length)];
        
        if (shakaPlayer) await shakaPlayer.unload();
        if (shakaUI) shakaUI.setEnabled(false);
        if (statusCallback) statusCallback("Advertisement", "yellow");

        adContainer.style.display = 'flex';
        timerDisplay.style.display = 'block';
        timerDisplay.textContent = "Loading Ad...";

        const preventContextMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };
        videoElement.addEventListener('contextmenu', preventContextMenu);
        videoElement.setAttribute('controlsList', 'nodownload');

        return new Promise((resolve) => {
            
            const finishAd = () => {
                videoElement.removeEventListener('ended', finishAd);
                videoElement.removeEventListener('error', onError);
                videoElement.removeEventListener('timeupdate', onTimeUpdate);
                videoElement.removeEventListener('contextmenu', preventContextMenu);

                if (skipBtn) skipBtn.onclick = null;
                if (visitBtn) visitBtn.onclick = null;

                adContainer.style.display = 'none';
                timerDisplay.style.display = 'none';

                resolve();
            };

            const onError = (e) => {
                console.warn("Ad failed to load or play:", e);
                finishAd();
            };

            const onSkipClicked = (e) => {
                if(e) e.stopPropagation();
                finishAd();
            };

            const onVisitClicked = (e) => {
                if(e) e.stopPropagation();
                if (currentAd.linkUrl && currentAd.linkUrl !== '#') {
                    window.open(currentAd.linkUrl, '_blank');
                }
            };

            const onTimeUpdate = () => {
                if(videoElement.duration && videoElement.currentTime > 0) {
                    const remaining = videoElement.duration - videoElement.currentTime;
                    timerDisplay.textContent = "Ad • " + formatTime(remaining);
                }
            };

            videoElement.src = currentAd.videoUrl;
            videoElement.loop = false;
            videoElement.controls = false;
            videoElement.muted = false;

            videoElement.addEventListener('ended', finishAd);
            videoElement.addEventListener('error', onError);
            videoElement.addEventListener('timeupdate', onTimeUpdate);

            skipBtn.onclick = onSkipClicked;
            visitBtn.onclick = onVisitClicked;

            videoElement.play().catch(e => {
                console.log("Ad Autoplay Blocked or Failed:", e);
                finishAd();
            });
        });
    };

    window.stopVideoAd = function(videoElement) {
        if(adContainer) adContainer.style.display = 'none';
        if(timerDisplay) timerDisplay.style.display = 'none';
        
        if(videoElement) {
            videoElement.pause();
            videoElement.removeAttribute('src'); 
            videoElement.load();
        }
    };

})();
