(function() {
    const AD_CONFIG = {
        videoUrl: '/assets/ads/boots-trailer.mp4',
        linkUrl: 'https://www.netflix.com/ph-en/title/81427990?preventIntent=true',
        skipText: 'Skip Ad'
    };

    let adContainer = null;
    let timerDisplay = null;
    let skipBtn = null;
    let visitBtn = null;

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
                bottom: 25px;
                right: 25px;
                display: none;
                gap: 12px;
                z-index: 9999;
                align-items: center;
            `;

            visitBtn = document.createElement("button");
            visitBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 20px; line-height: 0;">open_in_new</span>';
            visitBtn.style.cssText = `
                background-color: #FFFFFF;
                color: #000000;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                justify-content: center;
                align-items: center;
                cursor: pointer;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                transition: transform 0.2s ease, background-color 0.2s;
            `;

            skipBtn = document.createElement("button");
            skipBtn.textContent = AD_CONFIG.skipText;
            skipBtn.style.cssText = `
                background-color: #FFFFFF;
                color: #000000;
                border: none;
                border-radius: 50px;
                padding: 0 24px;
                height: 40px;
                font-weight: 700;
                font-size: 14px;
                cursor: pointer;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                font-family: inherit;
                transition: transform 0.2s ease, background-color 0.2s;
            `;

            const addHover = (btn) => {
                btn.onmouseover = () => { btn.style.transform = "scale(1.05)"; btn.style.backgroundColor = "#f0f0f0"; };
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
                bottom: 25px;
                left: 25px;
                display: none;
                background-color: rgba(0, 0, 0, 0.6);
                color: #FFFFFF;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: 700;
                font-size: 14px;
                font-family: inherit;
                pointer-events: none; /* User can't click it */
                z-index: 9999;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
            playerWrapper.appendChild(timerDisplay);
        }
    }
    
    window.playVideoAd = async function(videoElement, playerWrapper, shakaPlayer, shakaUI, statusCallback) {
        createAdUI(playerWrapper);

        if (shakaPlayer) await shakaPlayer.unload();
        if (shakaUI) shakaUI.setEnabled(false);
        if (statusCallback) statusCallback("Advertisement", "yellow");

        adContainer.style.display = 'flex';
        timerDisplay.style.display = 'block';
        timerDisplay.textContent = "Loading Ad...";

        return new Promise((resolve) => {
            
            const finishAd = () => {
                videoElement.removeEventListener('ended', finishAd);
                videoElement.removeEventListener('error', onError);
                videoElement.removeEventListener('timeupdate', onTimeUpdate);
                
                if (skipBtn) skipBtn.onclick = null;
                if (visitBtn) visitBtn.onclick = null;
                adContainer.style.display = 'none';
                timerDisplay.style.display = 'none';

                resolve();
            };

            const onError = (e) => {
                console.warn("Ad failed", e);
                finishAd();
            };

            const onSkipClicked = (e) => {
                if(e) e.stopPropagation();
                console.log("Ad Skipped");
                finishAd();
            };

            const onVisitClicked = (e) => {
                if(e) e.stopPropagation();
                window.open(AD_CONFIG.linkUrl, '_blank');
            };

            const onTimeUpdate = () => {
                if(videoElement.duration) {
                    const remaining = videoElement.duration - videoElement.currentTime;
                    // Formats to "Ad: 2:13" then counts down
                    timerDisplay.textContent = "Ad • " + formatTime(remaining);
                }
            };

            videoElement.src = AD_CONFIG.videoUrl;
            videoElement.loop = false;
            videoElement.controls = false;
            videoElement.muted = false; 
            videoElement.addEventListener('ended', finishAd);
            videoElement.addEventListener('error', onError);
            videoElement.addEventListener('timeupdate', onTimeUpdate);
            skipBtn.onclick = onSkipClicked;
            visitBtn.onclick = onVisitClicked;
            videoElement.play().catch(e => {
                console.log("Ad Autoplay Blocked:", e);
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
