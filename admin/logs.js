import {CONFIG} from "/js/config.js";

const KRATOS_URL = CONFIG.AUTH_URL;
const API_URL = `${CONFIG.BASE_URL}/api/read-logs.php`;

async function checkAuth() {
    try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) throw new Error("Unauthorized");
        const session = await res.json();

        if (session.identity?.metadata_public?.admin !== true) {
            window.location.href = '/';
            return;
        }

        // Show UI and fetch
        document.querySelector('.dot-container')?.classList.add('hidden');
        document.getElementById('secure-container')?.classList.add('visible');
        fetchLogData();
    } catch (err) {
        window.location.href = `${CONFIG.BASE_URL}/login`;
    }
}

async function fetchLogData() {
    const tbody = document.getElementById('logs-tbody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'GET',
            credentials: 'include', // Important to send the Kratos cookie to PHP
            headers: {
                'X-Admin-Secret': 'a8Fk2#9zLp$5vQx1@wErT'
            }
        });

        if (!response.ok) throw new Error("Access Denied");

        const text = await response.text();
        const logs = text.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => JSON.parse(line))
            .reverse();

        let html = '';
        logs.forEach(log => {
            let badgeClass = 'badge-secondary';
            if (log.type === 'auth') badgeClass = 'badge-info';
            if (log.type === 'page') badgeClass = 'badge-primary';
            if (log.type === 'feedback') badgeClass = 'badge-warning';
            if (log.type === 'admin') badgeClass = 'badge-danger';

            const { type, action, timestamp, userEmail, requestIP, ...extraDetails } = log;

            let detailsString = Object.entries(extraDetails).length > 0
                ? `<br><small style="color: gray;">${Object.entries(extraDetails).map(([k, v]) => `<b>${k}:</b> ${v}`).join(' | ')}</small>`
                : '';

            html += `
                <tr>
                    <td>${timestamp || 'Unknown'}</td>
                    <td><span class="badge ${badgeClass}">${(type || 'system').toUpperCase()}</span></td>
                    <td>${userEmail || 'Neznámý'}</td>
                    <td>${action} ${detailsString}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Chyba načítání: ${error.message}</td></tr>`;
    }
}

checkAuth();