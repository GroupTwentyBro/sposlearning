import { app, auth } from './firebaseConfig.js';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { sendPasswordResetEmail, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { createServerLog } from './logger.js';

const db = getFirestore(app);
const tbody = document.getElementById('user-list-tbody');

async function loadUsers() {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Načítání...</td></tr>';
    const querySnapshot = await getDocs(collection(db, "users"));

    // Also fetch the admin list to compare
    const adminSnapshot = await getDocs(collection(db, "administrators"));
    const adminIds = adminSnapshot.docs.map(d => d.id);

    let html = '';
    querySnapshot.forEach((userDoc) => {
        const u = userDoc.data();
        const uid = userDoc.id;
        const isAdmin = adminIds.includes(uid);

        html += `
            <tr>
                <td>
                    <b>${u.displayName || 'Bezejmenný'}</b><br>
                    <small class="text-muted">${u.email}</small>
                </td>
                <td>
                    ${u.emailVerified ? '<span class="badge bg-success">Ověřen</span>' : '<span class="badge bg-warning">Neověřen</span>'}
                </td>
                <td>
                    ${isAdmin ? '<span class="badge bg-danger">ADMIN</span>' : '<span class="badge bg-secondary">Uživatel</span>'}
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-info" onclick="adminAction('verify', '${uid}', '${u.email}')" title="Znovu ověřit">
                            <span class="material-symbols-outlined fs-6">mail</span>
                        </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="adminAction('reset', '${uid}', '${u.email}')" title="Reset hesla">
                            <span class="material-symbols-outlined fs-6">lock_reset</span>
                        </button>
                        <button class="btn btn-sm ${isAdmin ? 'btn-danger' : 'btn-outline-danger'}" onclick="toggleAdmin('${uid}', ${isAdmin})" title="Toggle Admin">
                            <span class="material-symbols-outlined fs-6">shield_person</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// Handle Admin Toggle
window.toggleAdmin = async (uid, currentStatus) => {
    if (confirm(`Opravdu chcete ${currentStatus ? 'odebrat' : 'přidat'} admin práva?`)) {
        const adminRef = doc(db, "administrators", uid);
        if (currentStatus) {
            await deleteDoc(adminRef);
        } else {
            await setDoc(adminRef, { addedBy: auth.currentUser.email });
        }
        await createServerLog('admin', `Změna admin práv pro UID: ${uid}`, { targetUid: uid, newStatus: !currentStatus });
        loadUsers();
    }
};

// Handle Reset/Verify
window.adminAction = async (action, uid, email) => {
    try {
        if (action === 'reset') {
            await sendPasswordResetEmail(auth, email);
            alert("Email pro reset hesla odeslán.");
        } else if (action === 'verify') {
            // Note: Firebase client SDK usually requires the user to be signed in to resend.
            // For a true "admin resend", you'd typically use a Cloud Function.
            alert("Funkce vyžaduje Cloud Functions, nebo se uživatel musí přihlásit sám.");
        }
    } catch (e) {
        console.error(e);
    }
};

loadUsers();