import { app, auth } from './js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadLogsPage();
    } else {
        window.location.href = '/login';
    }
});

async function loadLogsPage() {
    const docRef = doc(db, "admin-pages", "logs");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
        document.querySelector('.dot-container')?.classList.add('hidden');
        container.classList.add('visible');

        fetchLogData();
    }
}

async function fetchLogData() {
    const tbody = document.getElementById('logs-tbody');

    try {
        const response = await fetch(`https://www.sposlearning.cz/api/read-logs.php?t=${new Date().getTime()}`, {
            method: 'GET',
            headers: {
                'X-Admin-Secret': 'a8Fk2#9zLp$5vQx1@wErT'
            }
        });

        if (!response.ok) {
            throw new Error("Log file not found, empty, or access denied.");
        }

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

            let detailsString = '';
            if (Object.keys(extraDetails).length > 0) {
                detailsString = `<br><small style="color: gray;">${
                    Object.entries(extraDetails)
                        .map(([key, val]) => {
                            if (typeof val === 'string' && val.length > 100) {
                                val = val.substring(0, 100) + '...';
                            }
                            return `<b>${key}:</b> ${val}`;
                        })
                        .join(' | ')
                }</small>`;
            }

            html += `
                <tr>
                    <td>${timestamp || 'Unknown'}<br><small style="color:gray;">IP: ${requestIP || 'unknown'}</small></td>
                    <td><span class="badge ${badgeClass}">${(type || 'system').toUpperCase()}</span></td>
                    <td>${userEmail || 'Neznámý'}</td>
                    <td>${action} ${detailsString}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Zatím žádné logy nebo chyba načítání.</td></tr>`;
    }
}

export async function createServerLog(type, actionDescription, details = {}) {
    try {
        const payload = {
            type: type,
            action: actionDescription,
            ...details
        };

        if (!payload.userEmail) {
            payload.userEmail = 'Anonym/Neznámý';
        }

        const response = await fetch('https://www.sposlearning.cz/api/write-log.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Nepodařilo se zapsat log.");
        }
    } catch (error) {
        console.error("Chyba sítě při logování:", error);
    }
}