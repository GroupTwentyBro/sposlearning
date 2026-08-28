export function getThemeCookie() {
    const match = document.cookie.match(/(?:^|; )spos_theme=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : 'dark';
}

export function setThemeCookie(theme) {
    document.cookie = `spos_theme=${encodeURIComponent(theme)}; path=/; max-age=31536000; SameSite=Lax`;
    applyTheme(theme);
}

window.setThemeCookie = setThemeCookie;

let mikuAudioEnabled = false;

function initMikuVideo() {
    if (document.querySelector(".video-background")) return;

    const videoDiv = document.createElement("div");
    videoDiv.className = "video-background";

    const isMobile = window.matchMedia('(max-width: 500px)').matches;

    if (isMobile) {
        videoDiv.innerHTML = `
        <video autoplay loop muted playsinline class="miku-video" id="miku-main-video">
            <source src="/media/bg-mikutheme-video.webm" type="video/webm">
        </video>
        `;
    } else {
        videoDiv.innerHTML = `
        <video autoplay loop muted playsinline class="miku-video" id="miku-main-video">
            <source src="/media/bg-mikutheme-video.webm" type="video/webm">
        </video>
        <video autoplay loop muted playsinline class="miku-video">
            <source src="/media/bg-mikutheme-video.webm" type="video/webm">
        </video>
        <video autoplay loop muted playsinline class="miku-video">
            <source src="/media/bg-mikutheme-video.webm" type="video/webm">
        </video>
        `;
    }

    // Inject styles dynamically to ensure they work even if global.css is not present
    if (!document.getElementById("miku-theme-styles")) {
        const style = document.createElement("style");
        style.id = "miku-theme-styles";
        style.textContent = `
            [data-theme="miku"] {
                --main-bg: rgba(10, 30, 35, 0.4) !important;
                --surface-1: rgba(10, 30, 35, 0.85) !important;
                --surface-2: rgba(10, 30, 35, 0.9) !important;
                --surface-3: rgba(10, 30, 35, 0.95) !important;
                --border-color: hsl(177, 70%, 35%) !important;
                --text-primary: #FFF !important;
                --text-secondary: hsl(177, 30%, 75%) !important;
                --text-tertiary: rgba(255, 255, 255, 0.5) !important;
                --accent-primary: hsl(177, 70%, 50%) !important;
                --accent-secondary: hsl(328, 85%, 53%) !important;
            }
            body {
                background: transparent !important;
            }
            .video-background {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: -1 !important;
                overflow: hidden !important;
                display: flex !important;
                pointer-events: none !important;
            }
            .video-background video {
                flex: 1 !important;
                min-width: 33.33% !important;
                height: 100% !important;
                object-fit: cover !important;
            }
            .video-background::after {
                content: "" !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: linear-gradient(
                    135deg,
                    rgba(0, 178, 169, 0.3),
                    rgba(225, 40, 133, 0.2)
                ) !important;
                box-shadow: inset 0 0 200px rgba(0, 0, 0, 0.5) !important;
            }
            .miku-sound-toggle {
                position: fixed !important;
                bottom: 30px !important;
                right: 30px !important;
                width: 50px !important;
                height: 50px !important;
                border-radius: 50% !important;
                background: linear-gradient(
                    135deg,
                    var(--accent-primary),
                    var(--accent-secondary)
                ) !important;
                border: 2px solid var(--accent-secondary) !important;
                color: white !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                z-index: 1000 !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
                transition: all 0.3s ease !important;
            }
            .miku-sound-toggle:hover {
                transform: scale(1.1) !important;
                box-shadow: 0 6px 20px rgba(225, 40, 133, 0.6) !important;
            }
            .miku-sound-toggle span {
                font-size: 24px !important;
            }
        `;
        document.head.appendChild(style);
    }

    document.body.insertBefore(videoDiv, document.body.firstChild);
    
    setTimeout(() => {
        const mainVideo = document.getElementById("miku-main-video");
        if (mainVideo) {
            mainVideo.muted = !mikuAudioEnabled;
            mainVideo.play().catch(() => {});
        }
        synchronizeVideos();
        createSoundToggle();
    }, 100);
}

function synchronizeVideos() {
    const videos = document.querySelectorAll(".miku-video");
    if (videos.length === 0) return;
    const mainVideo = videos[0];

    mainVideo.addEventListener("play", () => {
        videos.forEach((video, index) => {
            if (index > 0) {
                video.currentTime = mainVideo.currentTime;
                video.play().catch(() => {});
            }
        });
    });

    mainVideo.addEventListener("timeupdate", () => {
        videos.forEach((video, index) => {
            if (
                index > 0 &&
                Math.abs(video.currentTime - mainVideo.currentTime) > 0.3
            ) {
                video.currentTime = mainVideo.currentTime;
            }
        });
    });
}

function createSoundToggle() {
    if (document.querySelector(".miku-sound-toggle")) return;

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "miku-sound-toggle";
    
    toggleBtn.innerHTML = `
        <span class="icon">
        ${mikuAudioEnabled ? "volume_up" : "volume_off"}
        </span>
    `;

    document.body.appendChild(toggleBtn);
    
    toggleBtn.addEventListener("click", () => {
        mikuAudioEnabled = !mikuAudioEnabled;
        const mainVideo = document.getElementById("miku-main-video");
        if (mainVideo) {
            mainVideo.muted = !mikuAudioEnabled;
        }
        toggleBtn.querySelector("span").textContent = mikuAudioEnabled ? "volume_up" : "volume_off";
    });
}

function removeMikuVideo() {
    const videoBg = document.querySelector(".video-background");
    if (videoBg) {
        const videos = videoBg.querySelectorAll("video");
        videos.forEach(v => {
            v.pause();
            v.src = "";
            v.load();
        });
        videoBg.remove();
    }
    const soundToggle = document.querySelector(".miku-sound-toggle");
    if (soundToggle) {
        soundToggle.remove();
    }
    const injectedStyles = document.getElementById("miku-theme-styles");
    if (injectedStyles) {
        injectedStyles.remove();
    }
}

export function applyTheme(theme = getThemeCookie()) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        removeMikuVideo();
    } else if (theme === 'miku') {
        document.documentElement.setAttribute('data-theme', 'miku');
        initMikuVideo();
    } else {
        document.documentElement.removeAttribute('data-theme');
        removeMikuVideo();
    }
}

applyTheme();
