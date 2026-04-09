import {CONFIG} from "/js/config.js";

const API_URL = CONFIG.API_URL;
const KRATOS_URL = "https://auth.sposlearning.cz";

async function checkAdmin() {
    const res = await fetch(`${KRATOS_URL}/sessions/whoami`, { credentials: 'include' });
    const session = await res.json();
    if (session.identity?.metadata_public?.admin !== true) {
        window.location.href = '/';
    }
}

async function loadUserList() {
    const tbody = document.getElementById('user-list-tbody');
    const searchInput = document.getElementById('user-search');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Načítání...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/admin/users`, { credentials: 'include' });
        const data = await res.json();
        const users = data.users;

        renderUserTable(users);

        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            const filtered = users.filter(u =>
                u.email.toLowerCase().includes(term) ||
                (u.displayName && u.displayName.toLowerCase().includes(term))
            );
            renderUserTable(filtered);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Chyba: ${error.message}</td></tr>`;
    }
}

function renderUserTable(users) {
    const tbody = document.getElementById('user-list-tbody');
    tbody.innerHTML = users.map(user => {
        const isAdmin = user.customClaims?.admin === true;
        const isDev = user.customClaims?.developer === true;
        const adminLink = !isDev ? `
            <button class="btn btn-sm btn-outline-danger toggle-admin-btn" data-uid="${user.uid}">
                <span class="material-symbols-outlined fs-6">shield_person</span>
            </button>` : '';
        const deletionLink = !isDev ? `
            <button class="btn btn-sm btn-outline-danger delete-btn" data-uid="${user.uid}">
                <span class="material-symbols-outlined fs-6">delete</span>
            </button>` : '';


        return `
            <tr>
                <td>
                    <b>${user.displayName}</b><br>
                    <small class="text-muted">${user.email}</small>
                </td>
                <td>
                    <span class="badge ${user.emailVerified ? 'bg-success' : 'bg-warning'}">
                        ${user.emailVerified ? 'Verified' : 'Unverified'}
                    </span>
                </td>
                <td>
                    <span class="badge ${(isAdmin ? (isDev ? 'bg-primary' : 'bg-danger') : 'bg-secondary')}">
                        ${(isAdmin ? (isDev ? 'Developer' : 'Admin') : 'User')}
                    </span>
                </td>
                <td>
                    <div class="btn-group">
                        ${adminLink}
                        
                        ${deletionLink}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Attach listeners for buttons
document.getElementById('user-list-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const uid = btn.dataset.uid;

    if (btn.classList.contains('toggle-admin-btn')) {
        if (confirm("Změnit admin práva?")) {
            await fetch(`${API_URL}/admin/toggle-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid }),
                credentials: 'include'
            });
            loadUserList();
        }
    } else if (btn.classList.contains('delete-btn')) {
        if (confirm("Smazat uživatele navždy?")) {
            await fetch(`${API_URL}/admin/users/${uid}`, { method: 'DELETE', credentials: 'include' });
            loadUserList();
        }
    }
});

checkAdmin().then(loadUserList);