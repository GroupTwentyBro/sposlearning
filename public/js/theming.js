/**
 * theming.js - Centralized Theme Management
 */

const root = document.documentElement;
const themeLink = document.getElementById("theme-link");

// Video background initialization
function initVideoBackground() {
  const currentTheme = localStorage.getItem("theme");

  console.log("Initializing video background, theme:", currentTheme);

  // Remove existing video background if present
  const existingVideo = document.querySelector(".video-background");
  if (existingVideo) {
    existingVideo.remove();
  }

  // Add video background only for Miku theme
  if (currentTheme === "miku") {
    const videoDiv = document.createElement("div");
    videoDiv.className = "video-background";
    videoDiv.innerHTML = `
      <video autoplay loop playsinline class="miku-video miku-audio-video" id="miku-main-video">
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

    // Initialize audio on first video
    setTimeout(() => {
      initMikuAudio();
    }, 100);

    // Synchronize all videos
    synchronizeVideos();

    // Add sound toggle button
    createSoundToggle();
  }
}

// Initialize Miku audio using the first video
function initMikuAudio() {
  const mainVideo = document.getElementById("miku-main-video");
  if (!mainVideo) {
    console.error("Main video not found!");
    return;
  }

  // Check if user wants sound (default: muted)
  const soundEnabled = localStorage.getItem("miku-sound") === "true";

  // Set initial mute state
  mainVideo.muted = !soundEnabled;

  console.log("Miku audio initialized:", {
    soundEnabled: soundEnabled,
    videoMuted: mainVideo.muted,
    localStorage: localStorage.getItem("miku-sound"),
  });

  // Flag to track if video has been "activated" by user interaction
  let videoActivated = false;

  // Try to play immediately (will fail if browser blocks autoplay)
  const playPromise = mainVideo.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        console.log("Miku video/audio autoplay successful");
        videoActivated = true;
      })
      .catch((error) => {
        console.log("Autoplay prevented (normal browser behavior)");

        // Wait for ANY user interaction to activate video
        const activateVideo = (e) => {
          if (!videoActivated) {
            console.log("Activating video on user interaction");
            mainVideo
              .play()
              .then(() => {
                videoActivated = true;
                console.log("Video activated successfully");
              })
              .catch((err) =>
                console.log("Video activation failed:", err.message),
              );
          }
        };

        // Listen for any interaction
        document.addEventListener("click", activateVideo, { once: true });
        document.addEventListener("keydown", activateVideo, { once: true });
      });
  }
}

// Synchronize all 3 videos to play at the same time
function synchronizeVideos() {
  const videos = document.querySelectorAll(".miku-video");
  if (videos.length === 0) return;

  const mainVideo = videos[0]; // First video has audio

  // When main video plays, sync others
  mainVideo.addEventListener("play", () => {
    videos.forEach((video, index) => {
      if (index > 0) {
        video.currentTime = mainVideo.currentTime;
        video.play().catch((e) => console.log("Video sync play error:", e));
      }
    });
  });

  // Sync periodically to prevent drift
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

  // Also sync when main video seeks
  mainVideo.addEventListener("seeked", () => {
    videos.forEach((video, index) => {
      if (index > 0) {
        video.currentTime = mainVideo.currentTime;
      }
    });
  });
}

// Create floating sound toggle button
function createSoundToggle() {
  // Remove existing toggle if present
  const existingToggle = document.querySelector(".miku-sound-toggle");
  if (existingToggle) {
    existingToggle.remove();
  }

  // Get current state from video element (not localStorage directly)
  const mainVideo = document.getElementById("miku-main-video");
  const isMuted = mainVideo ? mainVideo.muted : true;

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "miku-sound-toggle";
  toggleBtn.innerHTML = `
    <span class="material-symbols-outlined">
      ${isMuted ? "volume_off" : "volume_up"}
    </span>
  `;
  toggleBtn.title = isMuted ? "Zapnout hudbu" : "Ztlumit hudbu";

  // Use the toggle function
  toggleBtn.addEventListener("click", toggleMikuSound);

  document.body.appendChild(toggleBtn);

  console.log("Sound toggle button created, showing icon for muted:", isMuted);
}

// Toggle sound on/off
function toggleMikuSound(e) {
  // Prevent any default behavior
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const mainVideo = document.getElementById("miku-main-video");
  if (!mainVideo) {
    console.error("Main video not found!");
    return;
  }

  // Get current state
  const currentlyMuted = mainVideo.muted;

  console.log("Toggle clicked, current state:", {
    muted: currentlyMuted,
    paused: mainVideo.paused,
  });

  // Toggle mute state
  mainVideo.muted = !currentlyMuted;

  // If unmuting, ensure video is playing
  if (!mainVideo.muted) {
    if (mainVideo.paused) {
      mainVideo
        .play()
        .then(() => console.log("Video playing after unmute"))
        .catch((e) => console.log("Could not play video:", e.message));
    }
  }

  // Save new state to localStorage
  // muted=false means sound is ON, so save as "true"
  // muted=true means sound is OFF, so save as "false"
  const newSoundState = !mainVideo.muted ? "true" : "false";
  localStorage.setItem("miku-sound", newSoundState);

  console.log("New state:", {
    muted: mainVideo.muted,
    localStorage: newSoundState,
  });

  // Update button icon
  updateSoundButtonIcon(!currentlyMuted);
}

// Helper function to update button icon
function updateSoundButtonIcon(isMuted) {
  const btn = document.querySelector(".miku-sound-toggle");
  if (btn) {
    const icon = btn.querySelector("span");
    icon.textContent = isMuted ? "volume_off" : "volume_up";
    btn.title = isMuted ? "Zapnout hudbu" : "Ztlumit hudbu";
  }
}

// Core logic to change the CSS file and LocalStorage
export function applyTheme(themeName) {
  let newHref = "/style/theme-light.css"; // Default

  // Clean up when switching away from Miku theme
  if (themeName !== "miku") {
    const soundToggle = document.querySelector(".miku-sound-toggle");
    if (soundToggle) {
      soundToggle.remove();
    }

    // Stop and remove video background
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
  }

  switch (themeName) {
    case "hueshift":
      newHref = "/style/theme-hueshift.css";
      const savedHue = localStorage.getItem("hue-val") || 0;
      root.style.setProperty("--hue-val", savedHue);
      break;
    case "teddy":
      newHref = "/style/theme-teddy.css";
      break;
    case "mike":
      newHref = "/style/theme-mike.css";
      break;
    case "dark":
      newHref = "/style/theme-dark.css";
      break;
    case "miku":
      newHref = "/style/theme-miku.css";
      break;
    default:
      newHref = "/style/theme-light.css";
  }

  if (themeLink && themeLink.getAttribute("href") !== newHref) {
    themeLink.href = newHref;
  }
  localStorage.setItem("theme", themeName);

  // Initialize video background after theme change
  initVideoBackground();
}

// Initialize listeners for dashboard buttons
export function initThemeListeners() {
  const themeMap = {
    "darktheme-btn": "dark",
    "lighttheme-btn": "light",
    "miketheme-btn": "mike",
    "teddytheme-btn": "teddy",
    "mikutheme-btn": "miku",
  };

  // Attach click listeners to buttons
  Object.entries(themeMap).forEach(([id, theme]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => applyTheme(theme));
  });

  // Handle Hue Slider
  const hueSlider = document.getElementById("hueSlider");
  if (hueSlider) {
    if (localStorage.getItem("theme") === "hueshift") {
      hueSlider.value = localStorage.getItem("hue-val") || 0;
    }

    hueSlider.addEventListener("input", (e) => {
      const val = e.target.value;
      localStorage.setItem("hue-val", val);
      root.style.setProperty("--hue-val", val);

      if (localStorage.getItem("theme") !== "hueshift") {
        applyTheme("hueshift");
      }
    });
  }
}

// Immediate execution on import to prevent "flash of unstyled content"
const savedTheme = localStorage.getItem("theme") || "light";
applyTheme(savedTheme);

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing theme system");
    initThemeListeners();
    // Video background was already initialized by applyTheme() above
    // But let's call it again to be sure
    setTimeout(() => {
      initVideoBackground();
    }, 200);
  });
} else {
  console.log("DOM already ready, initializing theme system");
  initThemeListeners();
  setTimeout(() => {
    initVideoBackground();
  }, 200);
}
