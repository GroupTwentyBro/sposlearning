/**
 * theming.js - Centralized Theme Management
 */

const root = document.documentElement;
const themeLink = document.getElementById("theme-link");

// 1. Core logic to change the CSS file and LocalStorage
export function applyTheme(themeName) {
    let newHref = "/style/theme-light.css"; // Default

    switch (themeName) {
        case 'hueshift':
            newHref = "/style/theme-hueshift.css";
            const savedHue = localStorage.getItem("hue-val") || 0;
            root.style.setProperty('--hue-val', savedHue);
            break;
        case 'teddy':
            newHref = "/style/theme-teddy.css";
            break;
        case 'mike':
            newHref = "/style/theme-mike.css";
            break;
        case 'dark':
            newHref = "/style/theme-dark.css";
            break;
        default:
            newHref = "/style/theme-light.css";
    }

    if (themeLink && themeLink.getAttribute("href") !== newHref) {
        themeLink.href = newHref;
    }
    localStorage.setItem("theme", themeName);
}

// 2. Initialize listeners for dashboard buttons
export function initThemeListeners() {
    const themeMap = {
        "darktheme-btn": "dark",
        "lighttheme-btn": "light",
        "miketheme-btn": "mike",
        "teddytheme-btn": "teddy"
    };

    // Attach click listeners to buttons
    Object.entries(themeMap).forEach(([id, theme]) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener("click", () => applyTheme(theme));
    });

    // Handle Hue Slider
    const hueSlider = document.getElementById("hueSlider");
    if (hueSlider) {
        if (localStorage.getItem("theme") === 'hueshift') {
            hueSlider.value = localStorage.getItem("hue-val") || 0;
        }

        hueSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            localStorage.setItem("hue-val", val);
            root.style.setProperty('--hue-val', val);

            if (localStorage.getItem("theme") !== "hueshift") {
                applyTheme("hueshift");
            }
        });
    }
}

// 3. Immediate execution on import to prevent "flash of unstyled content"
const savedTheme = localStorage.getItem("theme") || "light";
applyTheme(savedTheme);