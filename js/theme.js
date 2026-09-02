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

function getMikuModeCookie() {
    const match = document.cookie.match(/(?:^|; )spos_miku_mode=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : 'default';
}

function getMikuProofreadCookie() {
    const match = document.cookie.match(/(?:^|; )spos_miku_proofread=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : 'false';
}

function getMikuLyricsCookie() {
    const match = document.cookie.match(/(?:^|; )spos_miku_lyrics=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : 'false';
}

let currentLyricsData = [];
let currentActiveLineIndex = -1;

function initMikuVideo() {
    if (document.querySelector(".video-background")) return;

    const mode = getMikuModeCookie();

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
        link.href = "/themes/miku-theme.css";
        document.head.appendChild(link);
    }

    if (mode !== 'default') {
        const audio = document.createElement("audio");
        audio.className = "miku-audio";
        audio.id = "miku-main-audio";
        audio.autoplay = true;
        audio.loop = true;
        audio.src = `/media/mikutheme-${mode}-audio.opus`;
        videoDiv.appendChild(audio);
    }

    document.body.insertBefore(videoDiv, document.body.firstChild);
    
    setTimeout(() => {
        const mainVideo = document.getElementById("miku-main-video");
        const mainAudio = document.getElementById("miku-main-audio");
        
        if (mainVideo) {
            if (mainAudio) {
                mainVideo.muted = true;
                mainAudio.muted = !mikuAudioEnabled;
                mainAudio.play().catch(() => {});
                mainVideo.play().catch(() => {});
            } else {
                mainVideo.muted = !mikuAudioEnabled;
                mainVideo.play().catch(() => {});
            }
        }
        synchronizeVideos();
        createSoundToggle();
    }, 100);
    
    // Process words to Miku
    if (getMikuProofreadCookie() === 'true') {
        mikuifyText();
    }
    
    // Load lyrics if enabled
    if (getMikuLyricsCookie() === 'true') {
        if (mode === 'default') {
            loadTtmlLyrics('/media/miku.ttml', false);
        } else if (mode === 'japanese') {
            loadTtmlLyrics('/media/mikujap.ttml', true);
        }
    }
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
    const audio = document.getElementById("miku-main-audio");
    if (videos.length === 0) return;
    const mainVideo = videos[0];

    let rafId = null;
    function syncLoop() {
        if (currentLyricsData.length > 0) {
            updateLyricsDisplay(mainVideo.currentTime);
        }
        rafId = requestAnimationFrame(syncLoop);
    }

    mainVideo.addEventListener("play", () => {
        videos.forEach((video, index) => {
            if (index > 0) {
                video.currentTime = mainVideo.currentTime;
                video.play().catch(() => {});
            }
        });
        if (audio) {
            audio.currentTime = mainVideo.currentTime;
            audio.play().catch(() => {});
        }
        if (!rafId) rafId = requestAnimationFrame(syncLoop);
    });
    
    mainVideo.addEventListener("pause", () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
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
        if (audio && Math.abs(audio.currentTime - mainVideo.currentTime) > 0.3) {
            audio.currentTime = mainVideo.currentTime;
        }
        
        if (currentLyricsData.length > 0 && mainVideo.paused) {
            updateLyricsDisplay(mainVideo.currentTime);
        }
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
        const mainAudio = document.getElementById("miku-main-audio");
        if (mainAudio) {
            mainAudio.muted = !mikuAudioEnabled;
        } else if (mainVideo) {
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
    
    const lyricsContainer = document.getElementById("miku-lyrics-container");
    if (lyricsContainer) {
        lyricsContainer.remove();
    }
    currentLyricsData = [];
    currentActiveLineIndex = -1;
    
    demikuifyText();
}

function initMikeTheme() {
    if (!document.getElementById("mike-theme-styles")) {
        const link = document.createElement("link");
        link.id = "mike-theme-styles";
        link.rel = "stylesheet";
        link.href = "/themes/mike-theme.css";
        document.head.appendChild(link);
    }
}

function removeMikeTheme() {
    const link = document.getElementById("mike-theme-styles");
    if (link) {
        link.remove();
    }
}

async function loadTtmlLyrics(url, isJapanese) {
    try {
        const response = await fetch(url);
        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "application/xml");
        
        const lines = [];
        const pTags = xml.getElementsByTagName("p");
        
        let transliterationSpans = [];
        if (isJapanese) {
            const transTags = xml.getElementsByTagName("transliteration");
            if (transTags.length > 0) {
                transliterationSpans = Array.from(transTags[0].getElementsByTagName("span"));
            }
        }

        for (let i = 0; i < pTags.length; i++) {
            const p = pTags[i];
            const lineBegin = parseFloat(p.getAttribute("begin"));
            const lineEnd = parseFloat(p.getAttribute("end"));
            const nodes = [];
            for (let j = 0; j < p.childNodes.length; j++) {
                const node = p.childNodes[j];
                if (node.nodeType === Node.TEXT_NODE) {
                    nodes.push({ type: 'text', text: node.textContent });
                } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === "span") {
                    const begin = parseFloat(node.getAttribute("begin"));
                    const end = parseFloat(node.getAttribute("end"));
                    const textContent = node.textContent;
                    
                    let rtContent = null;
                    if (isJapanese && transliterationSpans.length > 0) {
                        const match = transliterationSpans.find(t => 
                            Math.abs(parseFloat(t.getAttribute("begin")) - begin) < 0.01 && 
                            Math.abs(parseFloat(t.getAttribute("end")) - end) < 0.01
                        );
                        if (match) {
                            rtContent = match.textContent.trim();
                        }
                    }
                    nodes.push({ type: 'span', begin, end, text: textContent, rt: rtContent });
                }
            }
            
            lines.push({ begin: lineBegin, end: lineEnd, nodes });
        }
        
        currentLyricsData = lines;
        renderLyricsContainer(isJapanese);
    } catch (e) {
        console.error("Failed to load TTML", e);
    }
}

function renderLyricsContainer(isJapanese) {
    if (document.getElementById("miku-lyrics-container")) {
        document.getElementById("miku-lyrics-container").remove();
    }
    const container = document.createElement("div");
    container.id = "miku-lyrics-container";
    container.className = isJapanese ? "miku-lyrics-japanese" : "miku-lyrics-english";
    document.body.appendChild(container);
}

function updateLyricsDisplay(time) {
    const container = document.getElementById("miku-lyrics-container");
    if (!container) return;

    let activeLineIndex = -1;
    for (let i = 0; i < currentLyricsData.length; i++) {
        const line = currentLyricsData[i];
        // Allow a 0.5s linger ONLY if it doesn't bleed into the next line
        const nextLineBegin = i < currentLyricsData.length - 1 ? currentLyricsData[i+1].begin : Infinity;
        const endLinger = Math.min(line.end + 0.5, nextLineBegin - 0.01);
        
        if (time >= line.begin && time <= endLinger) {
            activeLineIndex = i;
            break;
        }
    }

    if (activeLineIndex !== currentActiveLineIndex) {
        currentActiveLineIndex = activeLineIndex;
        if (activeLineIndex === -1) {
            container.innerHTML = "";
        } else {
            const lineData = currentLyricsData[activeLineIndex];
            container.innerHTML = "";
            const lineDiv = document.createElement("div");
            lineDiv.className = "miku-lyric-line active-line";
            
            lineData.nodes.forEach(node => {
                if (node.type === 'text') {
                    lineDiv.appendChild(document.createTextNode(node.text));
                } else if (node.type === 'span') {
                    const wordSpan = document.createElement("span");
                    wordSpan.className = "miku-lyric-word";
                    wordSpan.dataset.begin = node.begin;
                    wordSpan.dataset.end = node.end;
                    
                    if (node.rt) {
                        wordSpan.innerHTML = `<ruby>${node.text}<rt>${node.rt}</rt></ruby>`;
                    } else {
                        wordSpan.textContent = node.text;
                    }
                    lineDiv.appendChild(wordSpan);
                }
            });
            container.appendChild(lineDiv);
        }
    }

    if (currentActiveLineIndex !== -1) {
        const wordSpans = container.querySelectorAll(".miku-lyric-word");
        wordSpans.forEach(span => {
            const begin = parseFloat(span.dataset.begin);
            const end = parseFloat(span.dataset.end);
            if (time >= begin && time <= end) {
                span.classList.add("active-word");
                span.classList.add("visible-word");
            } else if (time > end) {
                span.classList.remove("active-word");
                span.classList.add("visible-word");
            } else {
                span.classList.remove("active-word");
                span.classList.remove("visible-word");
            }
        });
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
        removeMikuVideo();
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
