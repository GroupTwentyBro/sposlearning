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
    
    // Process words to Miku
    mikuifyText();
}

const originalTextNodes = new Map();
let mikuObserver = null;

function mikuifyText() {
    processForMiku(document.body);

    if (!mikuObserver) {
        mikuObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
                        processForMiku(node);
                    }
                });
            });
        });
        mikuObserver.observe(document.body, { childList: true, subtree: true });
    }
}

function demikuifyText() {
    if (mikuObserver) {
        mikuObserver.disconnect();
        mikuObserver = null;
    }
    originalTextNodes.forEach((originalText, node) => {
        if (node.parentNode) {
            node.nodeValue = originalText;
        }
    });
    originalTextNodes.clear();
}

function processForMiku(rootNode) {
    if (rootNode.nodeType === Node.TEXT_NODE) {
        processTextNode(rootNode);
        return;
    }
    if (rootNode.nodeType !== Node.ELEMENT_NODE && rootNode.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    if (rootNode.tagName) {
        const tag = rootNode.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'CODE' || tag === 'PRE') return;
        if (rootNode.classList && (rootNode.classList.contains('icon') || rootNode.classList.contains('material-symbols-outlined'))) return;
    }

    const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                const parent = node.parentNode;
                if (!parent) return NodeFilter.FILTER_REJECT;
                
                const tag = parent.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'CODE' || tag === 'PRE') {
                    return NodeFilter.FILTER_REJECT;
                }
                if (parent.classList && (parent.classList.contains('icon') || parent.classList.contains('material-symbols-outlined'))) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (node.nodeValue.trim() === '') {
                    return NodeFilter.FILTER_SKIP;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let node;
    const nodesToProcess = [];
    while ((node = walker.nextNode())) {
        nodesToProcess.push(node);
    }

    nodesToProcess.forEach(processTextNode);
}

function processTextNode(node) {
    if (originalTextNodes.has(node)) return;

    const parent = node.parentNode;
    if (!parent) return;
    const tag = parent.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'CODE' || tag === 'PRE') return;
    if (parent.classList && (parent.classList.contains('icon') || parent.classList.contains('material-symbols-outlined'))) return;
    if (node.nodeValue.trim() === '') return;

    const originalText = node.nodeValue;
    let changed = false;
    
    const words = originalText.split(/(\s+)/);
    const newWords = words.map(word => {
        if (word.trim().length > 0) {
            if (Math.floor(Math.random() * 10) + 1 === 1) {
                changed = true;
                return "Miku";
            }
        }
        return word;
    });

    if (changed) {
        originalTextNodes.set(node, originalText);
        node.nodeValue = newWords.join('');
    }
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
    demikuifyText();
}

function initMikeTheme() {
    if (!document.getElementById("mike-theme-styles")) {
        const link = document.createElement("link");
        link.id = "mike-theme-styles";
        link.rel = "stylesheet";
        link.href = "/mike-theme.css";
        document.head.appendChild(link);
    }
}

function removeMikeTheme() {
    const link = document.getElementById("mike-theme-styles");
    if (link) {
        link.remove();
    }
}

export function applyTheme(theme = getThemeCookie()) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        removeMikuVideo();
        removeMikeTheme();
    } else if (theme === 'miku') {
        document.documentElement.setAttribute('data-theme', 'miku');
        removeMikeTheme();
        initMikuVideo();
    } else if (theme === 'mike') {
        document.documentElement.setAttribute('data-theme', 'mike');
        removeMikuVideo();
        initMikeTheme();
    } else {
        document.documentElement.removeAttribute('data-theme');
        removeMikuVideo();
        removeMikeTheme();
    }
}

applyTheme();
