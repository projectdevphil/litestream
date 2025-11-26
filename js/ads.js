(function() {
    const AD_CONFIG = {
        videoUrl: '/assets/ads/boots-trailer.mp4',
        linkUrl: 'https://www.netflix.com/ph-en/title/81427990?preventIntent=true',
        skipText: 'Skip Ad'
    };

    let adContainer = null;
    let skipBtn = null;
    let visitBtn = null;

    function createAdUI(playerWrapper) {
        if (adContainer) return;

        adContainer = document.createElement("div");
        adContainer.id = "ad-controls-container";
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
        
        if(playerWrapper) {
            const style = window.getComputedStyle(playerWrapper);
            if(style.position === 'static') {
                playerWrapper.style.position = 'relative';
            }
            playerWrapper.appendChild(adContainer);
        }
    }

    window.playVideoAd = async function(videoElement, playerWrapper, shakaPlayer, shakaUI, statusCallback) {
        createAdUI(playerWrapper);

        if (shakaPlayer) {
            await shakaPlayer.unload();
        }

        if (shakaUI) shakaUI.setEnabled(false);

        if (statusCallback) statusCallback("Advertisement", "yellow");

        adContainer.style.display = 'flex';

        return new Promise((resolve) => {
            
          const finishAd = () => {
                videoElement.removeEventListener('ended', finishAd);
                videoElement.removeEventListener('error', onError);
                if (skipBtn) skipBtn.onclick = null;
                if (visitBtn) visitBtn.onclick = null;
                adContainer.style.display = 'none';
                resolve();
            };

            const onError = (e) => {
                console.warn("Ad failed to play/load", e);
                finishAd();
            };

            const onSkipClicked = (e) => {
                if(e) e.stopPropagation();
                console.log("Ad Skipped");
                finishAd();
            };

            const onVisitClicked = (e) => {
                if(e) e.stopPropagation();
                console.log("Ad Link Clicked");
                window.open(AD_CONFIG.linkUrl, '_blank');
            };

            videoElement.src = AD_CONFIG.videoUrl;
            videoElement.loop = false;
            videoElement.controls = false;
            videoElement.muted = false;
            videoElement.addEventListener('ended', finishAd);
            videoElement.addEventListener('error', onError);
            skipBtn.onclick = onSkipClicked;
            visitBtn.onclick = onVisitClicked;
            videoElement.play().catch(e => {
                console.log("Ad Autoplay Blocked (Browser Policy):", e);
                finishAd();
            });
        });
    };

    window.stopVideoAd = function(videoElement) {
        if(adContainer) adContainer.style.display = 'none';
        
        if(videoElement) {
            videoElement.pause();
            videoElement.removeAttribute('src'); 
            videoElement.load();
        }
    };

})();
