import Keycloak from '/js/keycloak.js';
import { CONFIG } from '/js/config.js';

const keycloakConfig = {
    url: 'https://auth.sposlearning.cz',
    realm: 'sposlearning',
    clientId: 'sposlearning'
};

let keycloak = null;

export function setCookie(name, value, days) {
    const domain = '.sposlearning.cz';
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; domain=${domain}; Secure; SameSite=Lax`;
}

function getCookie(name) {
    return document.cookie.split('; ').find(row => row.startsWith(name + '='))?.split('=')[1];
}

function deleteCookie(name) {
    setCookie(name, '', -1);
}

export async function logAuthEvent(action, email, details = {}) {
    try {
        await fetch(`${CONFIG.API_URL}/log-auth-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, email, details })
        });
    } catch (e) {
        console.warn('Failed to log auth event:', e);
    }
}

export async function initAuth() {
    if (keycloak) return keycloak.authenticated;

    const storedAccessToken = getCookie('kc_access');
    const storedRefreshToken = getCookie('kc_refresh');

    keycloak = new Keycloak(keycloakConfig);

    const initOptions = {
        onLoad: 'check-sso',
        checkLoginIframe: false,
        redirectUri: window.location.href
    };

    if (storedAccessToken && storedRefreshToken) {
        initOptions.token = storedAccessToken;
        initOptions.refreshToken = storedRefreshToken;
        initOptions.onLoad = 'check-sso';
    }

    try {
        const loggedIn = await keycloak.init(initOptions);
        if (loggedIn && keycloak.token) {
            setCookie('kc_access', keycloak.token, 0.1);
            if (keycloak.refreshToken) {
                setCookie('kc_refresh', keycloak.refreshToken, 30);
            }
            if (!sessionStorage.getItem('kc_logged_in_logged')) {
                sessionStorage.setItem('kc_logged_in_logged', 'true');
                const email = keycloak.tokenParsed?.email || keycloak.tokenParsed?.preferred_username || 'User';
                logAuthEvent('LOGIN', email, { name: keycloak.tokenParsed?.name });
            }
        }
        return loggedIn;
    } catch (err) {
        console.error('Auth init failed', err);
        deleteCookie('kc_access');
        deleteCookie('kc_refresh');
        return false;
    }

}

export function login(provider) {
    const options = { redirectUri: window.location.href };
    if (provider) options.idpHint = provider;
    keycloak.login(options);
}

export function logout() {
    deleteCookie('kc_access');
    deleteCookie('kc_refresh');
    const redirectUri = window.location.origin + '/';
    if (keycloak) {
        keycloak.logout({ redirectUri });
    } else {
        window.location.href = redirectUri;
    }
}

export async function getAccessToken() {
    if (!keycloak.authenticated) throw new Error('Not logged in');
    await keycloak.updateToken(30);
    setCookie('kc_access', keycloak.token, 0.1);
    if (keycloak.refreshToken) {
        setCookie('kc_refresh', keycloak.refreshToken, 30);
    }
    return keycloak.token;
}

export function getUser() {
    if (!keycloak.authenticated) return null;
    return {
        id: keycloak.subject,
        email: keycloak.tokenParsed?.email,
        name: keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username || 'User',
        roles: keycloak.tokenParsed?.realm_access?.roles || []
    };
}