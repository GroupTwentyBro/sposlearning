export function getThemeCookie() {
    const match = document.cookie.match(/(?:^|; )spos_theme=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : 'dark';
}

export function setThemeCookie(theme) {
    document.cookie = `spos_theme=${encodeURIComponent(theme)}; path=/; max-age=31536000; SameSite=Lax`;
    applyTheme(theme);
}

export function applyTheme(theme = getThemeCookie()) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

applyTheme();
