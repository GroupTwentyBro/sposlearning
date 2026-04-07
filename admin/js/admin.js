import {CONFIG} from "/js/config.js";

const KRATOS_URL = CONFIG.AUTH_URL;
const LOGIN_URL = `${CONFIG.BASE_URL}/login`;

async function checkAdminSession() {
    try {
        const response = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('No active session');
        }

        const session = await response.json();
        const user = session.identity;

        const isAdmin = user.metadata_public?.admin === true;

        if (!isAdmin) {
            console.warn("User is not an administrator.");
            window.location.href = LOGIN_URL;
            return;
        }

        console.log("Admin session verified:", user.traits.email);
        return user;

    } catch (error) {
        console.error("Auth check failed:", error);
        window.location.href = LOGIN_URL;
    }
}

const adminUser = await checkAdminSession();

if (adminUser) {
    const emailDisplay = document.getElementById('admin-email');
    if (emailDisplay && adminUser) {
        emailDisplay.textContent = adminUser.traits.email;
    }
}