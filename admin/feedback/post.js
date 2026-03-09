import { app, auth } from '/js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from '/js/theming.js';
import { createServerLog } from '/js/logging.js';

const db = getFirestore(app);
const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (!postId) return;
        try {
            // Note: Ensure your 'admin-pages/feedback.post' shell includes
            // a container for the status/priority controls.
            await loadPostData();
            initThemeListeners();
            document.querySelector('.dot-container')?.classList.add('hidden');
        } catch (err) { console.error(err); }
    } else { window.location.href = '/login'; }
});

async function loadPostData() {
    const contentArea = document.getElementById('content-area');
    const docRef = doc(db, 'feedback', postId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return;
    const data = docSnap.data();

    // Map existing 'resolved' boolean to new system if status is missing
    const currentStatus = data.status || (data.resolved ? 'resolved' : 'open');
    const currentPriority = data.priority || 'medium';

    contentArea.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <h2>${escapeHtml(data.page)} - ${escapeHtml(data.title)}</h2>
            <div class="text-right">
                <select id="status-select" class="form-control mb-2">
                    <option value="open" ${currentStatus === 'open' ? 'selected' : ''}>Open</option>
                    <option value="in-progress" ${currentStatus === 'in-progress' ? 'selected' : ''}>In Progress</option>
                    <option value="high-priority" ${currentStatus === 'high-priority' ? 'selected' : ''}>High Priority</option>
                    <option value="resolved" ${currentStatus === 'resolved' ? 'selected' : ''}>Resolved</option>
                    <option value="denied" ${currentStatus === 'denied' ? 'selected' : ''}>Denied</option>
                </select>
                <select id="priority-select" class="form-control">
                    <option value="low" ${currentPriority === 'low' ? 'selected' : ''}>Low Priority</option>
                    <option value="medium" ${currentPriority === 'medium' ? 'selected' : ''}>Medium Priority</option>
                    <option value="high" ${currentPriority === 'high' ? 'selected' : ''}>High Priority</option>
                </select>
            </div>
        </div>
        <div class="meta-row mt-3">
            <strong>From:</strong> ${escapeHtml(data.contact)}<br>
            <strong>IP:</strong> <span class="code-info">${escapeHtml(data.ip)}</span>
        </div>
        <div class="message-body">${escapeHtml(data.message)}</div>
    `;

    // Handle Updates
    const updateStatus = async () => {
        const newStatus = document.getElementById('status-select').value;
        const newPriority = document.getElementById('priority-select').value;

        await updateDoc(docRef, {
            status: newStatus,
            priority: newPriority,
            resolved: newStatus === 'resolved' // keep boolean for safety
        });

        await createServerLog('admin', `Updated Feedback Status`, {
            feedbackID: postId,
            newStatus: newStatus,
            newPriority: newPriority,
            user: auth.currentUser.email
        });

        alert("Saved!");
    };

    document.getElementById('status-select').onchange = updateStatus;
    document.getElementById('priority-select').onchange = updateStatus;

    document.getElementById('delete-btn').onclick = async () => {
        if (confirm("Delete?")) {
            await deleteDoc(docRef);
            window.location.href = '/feedback';
        }
    };
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m]));
}