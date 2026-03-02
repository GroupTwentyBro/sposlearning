import { app, auth } from '/js/firebaseConfig.js';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { createServerLog } from '/js/logging.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

async function loadUsersPage() {
    const docRef = doc(db, "admin-pages", "users");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
        document.querySelector('.dot-container')?.classList.add('hidden');
        container.classList.add('visible');

        loadUserList();
    } else {
        container.innerHTML = "<h3 class='text-center text-danger'>User page configuration not found in Firestore.</h3>";
        document.querySelector('.dot-container')?.classList.add('hidden');
    }
}

async function loadUserList() {
    const tbody = document.getElementById('user-list-tbody');
    const searchInput = document.getElementById('user-search');

    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    try {
        const usersSnap = await getDocs(collection(db, "users"));
        const adminSnap = await getDocs(collection(db, "administrators"));
        const adminIds = adminSnap.docs.map(d => d.id);

        let users = [];
        usersSnap.forEach(doc => {
            users.push({ uid: doc.id, ...doc.data() });
        });

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
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load users.</td></tr>';
    }
}

function renderUserTable(users, adminIds) {
    const tbody = document.getElementById('user-list-tbody');
    let html = '';

    users.forEach(user => {
        const isAdmin = adminIds.includes(user.uid);
        const emailVerified = user.emailVerified || false;

        html += `
            <tr data-uid="${user.uid}">
                <td>
                    <b>${escapeHtml(user.displayName || 'No name')}</b><br>
                    <small class="text-muted">${escapeHtml(user.email || 'No email')}</small>
                </td>
                <td>
                    ${emailVerified ? '<span class="badge bg-success">Verified</span>' : '<span class="badge bg-warning">Unverified</span>'}
                </td>
                <td>
                    ${isAdmin ? '<span class="badge bg-danger">ADMIN</span>' : '<span class="badge bg-secondary">User</span>'}
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-info verify-btn" data-email="${user.email}" title="Send email verification (user must log in)">
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

        if (target.classList.contains('reset-btn')) {
            const email = target.dataset.email;
            if (confirm(`Send password reset email to ${email}?`)) {
                try {
                    await sendPasswordResetEmail(auth, email);
                    alert('Password reset email sent.');
                    await createServerLog('admin', `Password reset sent to ${email}`);
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }
        else if (target.classList.contains('toggle-admin-btn')) {
            const uid = target.dataset.uid;
            const current = target.dataset.current === 'true';
            if (confirm(`Are you sure you want to ${current ? 'remove' : 'grant'} admin privileges?`)) {
                try {
                    const adminRef = doc(db, "administrators", uid);
                    if (current) {
                        await deleteDoc(adminRef);
                    } else {
                        await setDoc(adminRef, { addedBy: auth.currentUser?.email || 'unknown' });
                    }
                    await createServerLog('admin', `Toggled admin for ${uid}`, { newStatus: !current });
                    loadUserList();
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }
        else if (target.classList.contains('delete-btn')) {
            const uid = target.dataset.uid;
            const email = target.dataset.email;
            if (confirm(`⚠️ Permanently delete user ${email}? This action cannot be undone.`)) {
                alert('Deletion requires a server endpoint. For now, use Firebase Console.');
            }
        }
        else if (target.classList.contains('verify-btn')) {
            alert('Email verification can only be sent by the user themselves. Use password reset if needed.');
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