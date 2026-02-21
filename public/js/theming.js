/**
 * theming.js - Centralized Theme Management
 */

const root = document.documentElement;
const themeLink = document.getElementById("theme-link");

let videoInitialized = false;
let videoActivated = false;
let tetrisAudio = null;

function initVideoBackground() {
  const currentTheme = localStorage.getItem("theme");

  const existingVideo = document.querySelector(".video-background");
  if (existingVideo) {
    const videos = existingVideo.querySelectorAll("video");
    videos.forEach((video) => {
      video.pause();
      video.src = "";
      video.load();
    });
    existingVideo.remove();
  }

  if (tetrisAudio) {
    tetrisAudio.pause();
    tetrisAudio = null;
  }

  videoInitialized = false;
  videoActivated = false;

  if (currentTheme === "miku") {
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


    document.body.insertBefore(videoDiv, document.body.firstChild);

    videoInitialized = true;

    setTimeout(() => {
      initMikuAudio();
    }, 100);

    synchronizeVideos();
    createSoundToggle();
  }
}

function initMikuAudio() {
  const mainVideo = document.getElementById("miku-main-video");
  if (!mainVideo) return;

  const isTetrisPage = window.location.pathname
    .toLowerCase()
    .includes("tetris");
  const soundEnabled = localStorage.getItem("miku-sound") === "true";

  if (isTetrisPage) {
    mainVideo.muted = true;

    if (!tetrisAudio) {
      tetrisAudio = new Audio("/media/audio-miku-nes.mp3");
      tetrisAudio.loop = true;
    }

    if (soundEnabled) {
      tetrisAudio.currentTime = mainVideo.currentTime;
      tetrisAudio
        .play()
        .catch((err) => console.log("MP3 Autoplay blocked:", err));
    }
  } else {
    mainVideo.muted = !soundEnabled;
  }

  mainVideo
    .play()
    .then(() => {
      videoActivated = true;
      updateSoundButtonIcon(
        isTetrisPage
          ? tetrisAudio
            ? tetrisAudio.paused
            : true
          : mainVideo.muted,
      );
    })
    .catch((error) => console.log("Video Autoplay prevented:", error.message));
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
    if (tetrisAudio && !tetrisAudio.paused) {
      tetrisAudio.currentTime = mainVideo.currentTime;
    }
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

const mediaQuery = window.matchMedia("(max-width: 500px)");

function handleTabletChange(e) {
  if (e.matches) {
  } else {
  }
}

mediaQuery.addEventListener("change", handleTabletChange);

handleTabletChange(mediaQuery);

function createSoundToggle() {
  const existingToggle = document.querySelector(".miku-sound-toggle");
  if (existingToggle) existingToggle.remove();

  const soundEnabled = localStorage.getItem("miku-sound") === "true";
  const isMuted = !soundEnabled;

  const toggleBtn = document.createElement("button");

  const isMobile = window.matchMedia("(max-width: 500px)").matches;

  if (isMobile) {
    const userControls = document.querySelector(".user-controls");
    if (userControls) {
      userControls.appendChild(toggleBtn);
      toggleBtn.className =
        "miku-sound-toggle btn btn-sm btn-primary ctrl-btn mobile";
    }
  } else {
    document.body.appendChild(toggleBtn);
    toggleBtn.className = "miku-sound-toggle pc";
  }

  toggleBtn.innerHTML = `
    <span class="material-symbols-outlined">
      ${isMuted ? "volume_off" : "volume_up"}
    </span>
  `;

  toggleBtn.title = isMuted ? "Zapnout hudbu" : "Ztlumit hudbu";
  toggleBtn.addEventListener("click", toggleMikuSound);
}

function toggleMikuSound(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const mainVideo = document.getElementById("miku-main-video");
  const isTetrisPage = window.location.pathname
    .toLowerCase()
    .includes("tetris");

  if (!mainVideo) return;

  const currentlyMuted = isTetrisPage
    ? tetrisAudio
      ? tetrisAudio.paused
      : true
    : mainVideo.muted;
  const shouldBeMuted = !currentlyMuted;

  if (isTetrisPage && tetrisAudio) {
    if (shouldBeMuted) {
      tetrisAudio.pause();
    } else {
      tetrisAudio.currentTime = mainVideo.currentTime;
      tetrisAudio.play().catch((e) => console.log("MP3 playback error:", e));
    }
    mainVideo.muted = true;
  } else {
    mainVideo.muted = shouldBeMuted;
    if (!shouldBeMuted && mainVideo.paused) mainVideo.play();
  }

  localStorage.setItem("miku-sound", (!shouldBeMuted).toString());
  updateSoundButtonIcon(shouldBeMuted);
}

function updateSoundButtonIcon(isMuted) {
  const btn = document.querySelector(".miku-sound-toggle");
  if (btn) {
    const icon = btn.querySelector("span");
    icon.textContent = isMuted ? "volume_off" : "volume_up";
  }
}

export function applyTheme(themeName) {
  let newHref = "/style/theme-dark.css";

  const isVideoTheme = themeName === "miku";
  const guideShown = localStorage.getItem("autoplay-guide-shown");

  if (!isVideoTheme) {
    const mikuToggle = document.querySelector(".miku-sound-toggle");
    if (mikuToggle) mikuToggle.remove();
    const videoBackground = document.querySelector(".video-background");
    if (videoBackground) videoBackground.remove();
    if (tetrisAudio) {
      tetrisAudio.pause();
      tetrisAudio = null;
    }
    videoInitialized = false;
  } else if (!guideShown && !window.matchMedia("(max-width: 500px)").matches) {
    // Show guide if it's a video theme and hasn't been shown yet
    showAutoplayGuide();
  }

  switch (themeName) {
    case "hueshift":
      newHref = "/style/theme-hueshift.css";
      const savedHue = localStorage.getItem("hue-val") || 0;
      root.style.setProperty('--hue-val', savedHue);
      break;
    case "miku":
      newHref = "/style/theme-miku.css";
      break;
    case "light":
      newHref = "/style/theme-light.css";
      break;
    case "teddy":
      newHref = "/style/theme-teddy.css";
      break;
    case "mike":
      newHref = "/style/theme-mike.css";
      break;
    default:
      newHref = "/style/theme-dark.css";
  }

  if (themeLink) themeLink.href = newHref;
  localStorage.setItem("theme", themeName);
  initVideoBackground();
}

function showAutoplayGuide() {
  const overlay = document.createElement("div");
  overlay.className = "guide-overlay";

  // Scoped styles for the guide to match your Miku theme
  const style = document.createElement('style');
  style.textContent = `
    .guide-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
      display: flex; align-items: center; justify-content: center; z-index: 10000;
    }
    .guide-content {
      background: var(--root-box-bg-clr, #0a1e23);
      border: 3px solid var(--primary-fg-clr, #00B2A9);
      padding: 2rem; border-radius: 20px; max-width: 450px; text-align: center;
      box-shadow: 0 0 30px var(--primary-sd-clr); color: white;
    }
    .guide-content h2 { margin-top: 0; color: var(--primary-fg-clr) !important; }
    .guide-steps { text-align: left; margin: 1.5rem 0; font-size: 0.9rem; line-height: 1.6; }
    .guide-btn {
      background: linear-gradient(135deg, var(--primary-fg-clr), var(--secondary-fg-clr));
      border: none; padding: 10px 25px; border-radius: 50px; color: white;
      font-weight: bold; cursor: pointer; transition: transform 0.2s;
    }
    .guide-btn:hover { transform: scale(1.05); }
    .browser-icon { vertical-align: middle; margin-right: 8px; }
  `;
  document.head.appendChild(style);

  overlay.innerHTML = `
    <div class="guide-content">
      <span class="material-symbols-outlined" style="font-size: 3rem; color: var(--secondary-fg-clr)">settings_suggest</span>
      <h2>Autoplay Audio Guide</h2>
      <p>Browsers block music by default. To hear Miku:</p>
      <div class="guide-steps">
        <strong>Chrome/Edge:</strong> Click the 🔒 icon next to URL → Site Settings → Set 'Sound' to <b>Allow</b>.<br><br>
        <strong>Firefox:</strong> Click the 🎙️ icon in the URL bar → <b>Allow Autoplay</b>.<br><br>
      </div>
      <button class="guide-btn">Got it, let's go!</button>
    </div>
  `;

  overlay.querySelector('button').onclick = () => {
    overlay.remove();
    localStorage.setItem("autoplay-guide-shown", "true");
  };

  document.body.appendChild(overlay);
}

export function initThemeListeners() {
  const themeMap = {
    "mikutheme-btn": "miku",
    "darktheme-btn": "dark",
    "lighttheme-btn": "light",
    "miketheme-btn": "mike",
    "teddytheme-btn": "teddy",
  };
  Object.entries(themeMap).forEach(([id, theme]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => applyTheme(theme));
  });
}

const savedTheme = localStorage.getItem("theme") || "light";
applyTheme(savedTheme);

document.addEventListener("DOMContentLoaded", () => {
  initThemeListeners();

  const savedTheme = localStorage.getItem("theme") || "dark";
  applyTheme(savedTheme);

  createSecretMikuButton();
  console.log("Secret btn:", document.getElementById("secret-miku-btn"));
  if (!videoInitialized && localStorage.getItem("theme") === "miku") {
    initVideoBackground();
  }
});
