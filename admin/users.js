// users.js
import { app, auth } from '/js/firebaseConfig.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { createServerLog } from '/js/logging.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

/**
 * Call an admin action on the PHP backend.
 */
async function callAdminEndpoint(action, data = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const idToken = await user.getIdToken(true);
    console.log('Sending token:', idToken.substring(0,20) + '...');

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

/**
 * Load the admin page HTML from Firestore (existing logic).
 */
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

/**
 * Fetch the list of users and render the table.
 */
async function loadUserList() {
    const tbody = document.getElementById('user-list-tbody');
    const searchInput = document.getElementById('user-search');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

    try {
        const result = await callAdminEndpoint('listUsers');
        const users = result.users;

        renderUserTable(users);

        // Set up search filtering
        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            const filtered = users.filter(u =>
                (u.email && u.email.toLowerCase().includes(term)) ||
                (u.displayName && u.displayName.toLowerCase().includes(term))
            );
            renderUserTable(filtered);
        });
    } catch (error) {
        console.error("Error loading users:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load users: ${error.message}</td></tr>`;
    }
}

/**
 * Render the user table rows.
 * @param {Array} users
 */
function renderUserTable(users) {
    const tbody = document.getElementById('user-list-tbody');
    let html = '';

    users.forEach(user => {
        const isAdmin = user.customClaims?.admin || false; // from custom claims
        html += `
            <tr data-uid="${user.uid}">
                <td>
                    ${user.displayName ? `<b>${escapeHtml(user.displayName)}</b><br>` : '' }
                    ${user.displayName ? `<small class="text-muted">${escapeHtml(user.email)}</small>` : `<b>${escapeHtml(user.email)}</b>`}
        </td>
                <td>
                    ${user.emailVerified || (user.providerData && user.providerData.some(p => p.providerId !== 'password')) ? '<span class="badge bg-success">Verified</span>' : '<span class="badge bg-warning">Unverified</span>'}
                </td>
                <td>
                    ${isAdmin ? '<span class="badge bg-danger">Admin</span>' : '<span class="badge bg-secondary">User</span>'}
                </td>
                <td>
                    <div class="btn-group">
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

    // Attach click event listeners (delegation)
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
                    await callAdminEndpoint('toggleAdmin', { uid });
                    // Refresh the list to show updated admin status
                    loadUserList();
                }
            }
            else if (target.classList.contains('delete-btn')) {
                if (confirm(`⚠️ Permanently delete user ${email}? This cannot be undone.`)) {
                    await callAdminEndpoint('deleteUser', { uid });
                    alert('User deleted.');
                    loadUserList();
                }
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
}

/**
 * Simple HTML escaping.
 */
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

// Start the page
loadUsersPage();