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

    // Inject the miku-theme.css stylesheet
    if (!document.getElementById("miku-theme-styles")) {
        const link = document.createElement("link");
        link.id = "miku-theme-styles";
        link.rel = "stylesheet";
        link.href = "/miku-theme.css";
        document.head.appendChild(link);
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
