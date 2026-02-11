/**
 * theming.js - Centralized Theme Management
 */

const root = document.documentElement;
const themeLink = document.getElementById("theme-link");

// Track if we've already initialized to prevent double-init on pageshow
let videoInitialized = false;
let videoActivated = false;
let tetrisAudio = null; // New: Global reference for the Tetris-specific audio

// Video background initialization
function initVideoBackground() {
  const currentTheme = localStorage.getItem("theme");

  console.log("Initializing video background, theme:", currentTheme);

  // Remove existing video background if present
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

  // Stop Tetris audio if it's playing during a theme re-init
  if (tetrisAudio) {
    tetrisAudio.pause();
    tetrisAudio = null;
  }

  // Reset initialization flags
  videoInitialized = false;
  videoActivated = false;

  // Add video background only for Miku theme
  if (currentTheme === "miku") {
    const videoDiv = document.createElement("div");
    videoDiv.className = "video-background";

    // IMPORTANT: All videos start muted for autoplay compliance
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
    document.body.insertBefore(videoDiv, document.body.firstChild);

    videoInitialized = true;

    // Initialize audio (logic now branches for Tetris)
    setTimeout(() => {
      initMikuAudio();
    }, 100);

    // Synchronize all videos
    synchronizeVideos();

    // Add sound toggle button
    createSoundToggle();
  }
}

// Initialize Miku audio using the first video OR the Tetris MP3
function initMikuAudio() {
  const mainVideo = document.getElementById("miku-main-video");
  if (!mainVideo) {
    console.error("Main video not found!");
    return;
  }

  const isTetrisPage = window.location.pathname.includes('/tetris/');
  const soundEnabled = localStorage.getItem("miku-sound") === "true";

  console.log("Miku audio initialized:", {
    soundEnabled: soundEnabled,
    isTetris: isTetrisPage
  });

  if (isTetrisPage) {
    // 1. Ensure video stays silent
    mainVideo.muted = true;
    
    // 2. Initialize the Tetris MP3 if not already done
    if (!tetrisAudio) {
      tetrisAudio = new Audio('/media/mikunes.mp3');
      tetrisAudio.loop = true;
    }

    // 3. Play if user has sound enabled
    if (soundEnabled) {
      tetrisAudio.play().catch((err) => console.log("MP3 Autoplay blocked:", err));
    }
  } else {
    // Standard Miku behavior: Use the video's audio track
    mainVideo.muted = !soundEnabled;
  }

  // Always attempt to play the video (visuals)
  const playPromise = mainVideo.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        videoActivated = true;
        updateSoundButtonIcon(isTetrisPage ? (tetrisAudio ? tetrisAudio.paused : true) : mainVideo.muted);
      })
      .catch((error) => console.log("Video Autoplay prevented:", error.message));
  }
}

// Synchronize all 3 videos to play at the same time
function synchronizeVideos() {
  const videos = document.querySelectorAll(".miku-video");
  if (videos.length === 0) return;

  const mainVideo = videos[0];

  mainVideo.addEventListener("play", () => {
    videos.forEach((video, index) => {
      if (index > 0) {
        video.currentTime = mainVideo.currentTime;
        video.play().catch((e) => console.log("Video sync play error:", e));
      }
    });
  });

  mainVideo.addEventListener("timeupdate", () => {
    videos.forEach((video, index) => {
      if (index > 0 && Math.abs(video.currentTime - mainVideo.currentTime) > 0.3) {
        video.currentTime = mainVideo.currentTime;
      }
    });
  });

  mainVideo.addEventListener("seeked", () => {
    videos.forEach((video, index) => {
      if (index > 0) video.currentTime = mainVideo.currentTime;
    });
  });
}

// Create floating sound toggle button
function createSoundToggle() {
  const existingToggle = document.querySelector(".miku-sound-toggle");
  if (existingToggle) existingToggle.remove();

  const soundEnabled = localStorage.getItem("miku-sound") === "true";
  const isMuted = !soundEnabled;

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "miku-sound-toggle";
  toggleBtn.innerHTML = `
    <span class="material-symbols-outlined">
      ${isMuted ? "volume_off" : "volume_up"}
    </span>
  `;
  toggleBtn.title = isMuted ? "Zapnout hudbu" : "Ztlumit hudbu";

  toggleBtn.addEventListener("click", toggleMikuSound);
  document.body.appendChild(toggleBtn);
}

// Toggle sound on/off for either the Video or the Tetris MP3
function toggleMikuSound(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const mainVideo = document.getElementById("miku-main-video");
  const isTetrisPage = window.location.pathname.includes('/tetris/');
  
  if (!mainVideo) return;

  // Determine current "muted" state based on the active source
  const currentlyMuted = isTetrisPage ? (tetrisAudio ? tetrisAudio.paused : true) : mainVideo.muted;
  const newMutedState = !currentlyMuted;

  if (isTetrisPage && tetrisAudio) {
    if (newMutedState) {
      tetrisAudio.pause();
    } else {
      tetrisAudio.play().catch(e => console.log("MP3 playback error:", e));
    }
    mainVideo.muted = true; // Video always stays muted on Tetris
  } else {
    mainVideo.muted = newMutedState;
    if (!newMutedState && mainVideo.paused) mainVideo.play();
  }

  videoActivated = true;
  const newSoundPref = !newMutedState ? "true" : "false";
  localStorage.setItem("miku-sound", newSoundPref);
  updateSoundButtonIcon(newMutedState);
}

function updateSoundButtonIcon(isMuted) {
  const btn = document.querySelector(".miku-sound-toggle");
  if (btn) {
    const icon = btn.querySelector("span");
    icon.textContent = isMuted ? "volume_off" : "volume_up";
    btn.title = isMuted ? "Zapnout hudbu" : "Ztlumit hudbu";
  }
}

export function applyTheme(themeName) {
  let newHref = "/style/theme-light.css";

  // Clean up
  if (themeName !== "miku") {
    const soundToggle = document.querySelector(".miku-sound-toggle");
    if (soundToggle) soundToggle.remove();

    const videoBackground = document.querySelector(".video-background");
    if (videoBackground) {
      const videos = videoBackground.querySelectorAll("video");
      videos.forEach((video) => {
        video.pause();
        video.src = "";
        video.load();
      });
      videoBackground.remove();
    }
    
    if (tetrisAudio) {
      tetrisAudio.pause();
      tetrisAudio = null;
    }

    videoInitialized = false;
    videoActivated = false;
  }

  switch (themeName) {
    case "hueshift":
      newHref = "/style/theme-hueshift.css";
      const savedHue = localStorage.getItem("hue-val") || 0;
      root.style.setProperty("--hue-val", savedHue);
      break;
    case "teddy": newHref = "/style/theme-teddy.css"; break;
    case "mike": newHref = "/style/theme-mike.css"; break;
    case "dark": newHref = "/style/theme-dark.css"; break;
    case "miku": newHref = "/style/theme-miku.css"; break;
    default: newHref = "/style/theme-light.css";
  }

  if (themeLink && themeLink.getAttribute("href") !== newHref) {
    themeLink.href = newHref;
  }
  localStorage.setItem("theme", themeName);
  initVideoBackground();
}

export function initThemeListeners() {
  const themeMap = {
    "darktheme-btn": "dark",
    "lighttheme-btn": "light",
    "miketheme-btn": "mike",
    "teddytheme-btn": "teddy",
    "mikutheme-btn": "miku",
  };

  Object.entries(themeMap).forEach(([id, theme]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => applyTheme(theme));
  });

  const hueSlider = document.getElementById("hueSlider");
  if (hueSlider) {
    if (localStorage.getItem("theme") === "hueshift") {
      hueSlider.value = localStorage.getItem("hue-val") || 0;
    }
    hueSlider.addEventListener("input", (e) => {
      const val = e.target.value;
      localStorage.setItem("hue-val", val);
      root.style.setProperty("--hue-val", val);
      if (localStorage.getItem("theme") !== "hueshift") applyTheme("hueshift");
    });
  }
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    const currentTheme = localStorage.getItem("theme");
    if (currentTheme === "miku") {
      setTimeout(() => { initVideoBackground(); }, 100);
    }
  }
});

const savedTheme = localStorage.getItem("theme") || "light";
applyTheme(savedTheme);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initThemeListeners();
    setTimeout(() => {
      if (!videoInitialized && localStorage.getItem("theme") === "miku") initVideoBackground();
    }, 200);
  });
} else {
  initThemeListeners();
  setTimeout(() => {
    if (!videoInitialized && localStorage.getItem("theme") === "miku") initVideoBackground();
  }, 200);
}
