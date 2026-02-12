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

  const isTetrisPage = window.location.pathname.toLowerCase().includes('tetris');
  const soundEnabled = localStorage.getItem("miku-sound") === "true";

  if (isTetrisPage) {
    mainVideo.muted = true;
    
    if (!tetrisAudio) {
      tetrisAudio = new Audio('/media/mikunes.mp3');
      tetrisAudio.loop = true;
    }

    if (soundEnabled) {
      // SYNC: Match MP3 time to video time before playing
      tetrisAudio.currentTime = mainVideo.currentTime;
      tetrisAudio.play().catch((err) => console.log("MP3 Autoplay blocked:", err));
    }
  } else {
    mainVideo.muted = !soundEnabled;
  }

  mainVideo.play().then(() => {
    videoActivated = true;
    updateSoundButtonIcon(isTetrisPage ? (tetrisAudio ? tetrisAudio.paused : true) : mainVideo.muted);
  }).catch((error) => console.log("Video Autoplay prevented:", error.message));
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
    // SYNC: If we are on tetris and audio is active, sync MP3 to video start
    if (tetrisAudio && !tetrisAudio.paused) {
        tetrisAudio.currentTime = mainVideo.currentTime;
    }
  });

  mainVideo.addEventListener("timeupdate", () => {
    videos.forEach((video, index) => {
      if (index > 0 && Math.abs(video.currentTime - mainVideo.currentTime) > 0.3) {
        video.currentTime = mainVideo.currentTime;
      }
    });
  });
}

const mediaQuery = window.matchMedia('(max-width: 500px)');

function handleTabletChange(e) {
  if (e.matches) {

  } else {

  }
}

mediaQuery.addEventListener('change', handleTabletChange);

handleTabletChange(mediaQuery);

function createSoundToggle() {
  const existingToggle = document.querySelector(".miku-sound-toggle");
  if (existingToggle) existingToggle.remove();

  const soundEnabled = localStorage.getItem("miku-sound") === "true";
  const isMuted = !soundEnabled;

  const toggleBtn = document.createElement("button");

  // FIX 1: Use .matches to actually get a true/false value
  const isMobile = window.matchMedia('(max-width: 500px)').matches;

  if (isMobile) {
    const userControls = document.querySelector(".user-controls");
    if (userControls) {
      userControls.appendChild(toggleBtn);
      toggleBtn.className = "miku-sound-toggle btn btn-sm btn-primary ctrl-btn mobile";
    }
  } else {
    // FIX 2: This will now actually run on PC
    document.body.appendChild(toggleBtn);
    toggleBtn.className = "miku-sound-toggle pc";
  }

  // Set HTML after appending so it's clean
  toggleBtn.innerHTML = `
    <span class="material-symbols-outlined">
      ${isMuted ? "volume_off" : "volume_up"}
    </span>
  `;

  toggleBtn.title = isMuted ? "Zapnout hudbu" : "Ztlumit hudbu";
  toggleBtn.addEventListener("click", toggleMikuSound);
}

function toggleMikuSound(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }

  const mainVideo = document.getElementById("miku-main-video");
  const isTetrisPage = window.location.pathname.toLowerCase().includes('tetris');
  
  if (!mainVideo) return;

  const currentlyMuted = isTetrisPage ? (tetrisAudio ? tetrisAudio.paused : true) : mainVideo.muted;
  const shouldBeMuted = !currentlyMuted;

  if (isTetrisPage && tetrisAudio) {
    if (shouldBeMuted) {
      tetrisAudio.pause();
    } else {
      // SYNC: Match MP3 time to video time exactly when unmuting
      tetrisAudio.currentTime = mainVideo.currentTime;
      tetrisAudio.play().catch(e => console.log("MP3 playback error:", e));
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
  let newHref = "/style/theme-light.css";

  if (themeName !== "miku") {
    const soundToggle = document.querySelector(".miku-sound-toggle");
    if (soundToggle) soundToggle.remove();
    const videoBackground = document.querySelector(".video-background");
    if (videoBackground) videoBackground.remove();
    if (tetrisAudio) { tetrisAudio.pause(); tetrisAudio = null; }
    videoInitialized = false;
  }

  switch (themeName) {
    case "hueshift": newHref = "/style/theme-hueshift.css"; break;
    case "miku": newHref = "/style/theme-miku.css"; break;
    case "dark": newHref = "/style/theme-dark.css"; break;
    case "teddy": newHref = "/style/theme-teddy.css"; break;
    case "mike": newHref = "/style/theme-mike.css"; break;
    default: newHref = "/style/theme-light.css";
  }

  if (themeLink) themeLink.href = newHref;
  localStorage.setItem("theme", themeName);
  initVideoBackground();
}

export function initThemeListeners() {
  const themeMap = { 
      "mikutheme-btn": "miku", 
      "darktheme-btn": "dark", 
      "lighttheme-btn": "light",
      "miketheme-btn": "mike",
      "teddytheme-btn": "teddy"
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
  if (!videoInitialized && localStorage.getItem("theme") === "miku") {
    initVideoBackground();
  }
});
