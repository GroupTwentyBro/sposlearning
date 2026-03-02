import { app, auth } from '/js/firebaseConfig.js';
import { getFirestore, collection, doc, setDoc, deleteDoc, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { createServerLog } from '/js/logging.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

async function callAdminEndpoint(action, data = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const idToken = await user.getIdToken();

    const response = await fetch('/users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, idToken, ...data })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }
    return response.json();
}

async function loadUsersPage() {
    const docRef = doc(db, "admin-pages", "users");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
        document.querySelector('.dot-container')?.classList.add('hidden');
        container.classList.add('visible');
        loadUserList();
    } else {
        container.innerHTML = "<h3 class='text-center text-danger'>User page configuration not found.</h3>";
        document.querySelector('.dot-container')?.classList.add('hidden');
    }
}

async function loadUserList() {
    const tbody = document.getElementById('user-list-tbody');
    const searchInput = document.getElementById('user-search');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

    try {
        const adminSnap = await getDocs(collection(db, "administrators"));
        const adminIds = adminSnap.docs.map(d => d.id);

        const result = await callAdminEndpoint('listUsers');
        const users = result.users;

        renderUserTable(users, adminIds);

        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            const filtered = users.filter(u =>
                (u.email && u.email.toLowerCase().includes(term)) ||
                (u.displayName && u.displayName.toLowerCase().includes(term))
            );
            renderUserTable(filtered, adminIds);
        });
    } catch (error) {
        console.error("Error loading users:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load users: ${error.message}</td></tr>`;
    }
}

function renderUserTable(users, adminIds) {
    const tbody = document.getElementById('user-list-tbody');
    let html = '';

    users.forEach(user => {
        const isAdmin = adminIds.includes(user.uid);
        html += `
            <tr data-uid="${user.uid}">
                <td>
                    <b>${escapeHtml(user.displayName || 'No name')}</b><br>
                    <small class="text-muted">${escapeHtml(user.email || 'No email')}</small>
                </td>
                <td>
                    ${user.emailVerified ? '<span class="badge bg-success">Verified</span>' : '<span class="badge bg-warning">Unverified</span>'}
                </td>
                <td>
                    ${isAdmin ? '<span class="badge bg-danger">ADMIN</span>' : '<span class="badge bg-secondary">User</span>'}
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-info verify-btn" data-email="${user.email}" title="Generate verification link">
                            <span class="material-symbols-outlined fs-6">mail</span>
                        </button>
                        <button class="btn btn-sm btn-outline-warning reset-btn" data-email="${user.email}" title="Send password reset">
                            <span class="material-symbols-outlined fs-6">lock_reset</span>
                        </button>
                        <button class="btn btn-sm ${isAdmin ? 'btn-danger' : 'btn-outline-danger'} toggle-admin-btn" data-uid="${user.uid}" data-current="${isAdmin}" title="Toggle admin">
                            <span class="material-symbols-outlined fs-6">shield_person</span>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-uid="${user.uid}" data-email="${user.email}" title="Delete user">
                            <span class="material-symbols-outlined fs-6">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    tbody.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const uid = target.dataset.uid;
        const email = target.dataset.email;

        try {
            if (target.classList.contains('reset-btn')) {
                if (confirm(`Send password reset email to ${email}?`)) {
                    const result = await callAdminEndpoint('sendPasswordReset', { email });
                    if (result.link) {
                        window.open(result.link, '_blank');
                    }
                    await createServerLog('admin', `Password reset sent to ${email}`);
                }
            }
            else if (target.classList.contains('verify-btn')) {
                if (confirm(`Generate email verification link for ${email}?`)) {
                    const result = await callAdminEndpoint('sendEmailVerification', { email });
                    if (result.link) {
                        window.open(result.link, '_blank');
                    }
                    await createServerLog('admin', `Verification link generated for ${email}`);
                }
            }
            else if (target.classList.contains('toggle-admin-btn')) {
                const current = target.dataset.current === 'true';
                if (confirm(`Are you sure you want to ${current ? 'remove' : 'grant'} admin privileges?`)) {
                    const result = await callAdminEndpoint('toggleAdmin', { uid });
                    loadUserList();
                }
            }
            else if (target.classList.contains('delete-btn')) {
                if (confirm(`⚠️ Permanently delete user ${email}? This cannot be undone.`)) {
                    const result = await callAdminEndpoint('deleteUser', { uid });
                    alert('User deleted.');
                    loadUserList();
                }
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
}

function escapeHtml(unsafe) {
    return unsafe.replace(/[&<>"']/g, function(m) {
        if(m === '&') return '&amp;';
        if(m === '<') return '&lt;';
        if(m === '>') return '&gt;';
        if(m === '"') return '&quot;';
        if(m === "'") return '&#039;';
        return m;
    });
}

loadUsersPage();