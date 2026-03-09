import { app, auth } from '/js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from '/js/theming.js';
import { createServerLog } from '/js/logging.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');
const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (!postId) {
            if (container) container.innerHTML = "<h3>No Post ID specified.</h3>";
            document.querySelector('.dot-container')?.classList.add('hidden');
            return;
        }

        try {
            await loadPostUI();
            await loadPostData();
            initThemeListeners();
            document.querySelector('.dot-container')?.classList.add('hidden');
        } catch (err) {
            console.error("Initialization failed:", err);
        }
    } else {
        window.location.href = '/login';
    }
});

async function loadPostUI() {
    if (!container) return;
    const docRef = doc(db, "admin-pages", "feedback.post");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
    } else {
        container.innerHTML = "<h3>Error: UI shell not found.</h3>";
        throw new Error("UI missing");
    }
}

async function loadPostData() {
    const contentArea = document.getElementById('content-area');
    const deleteBtn = document.getElementById('delete-btn');
    if (!contentArea) return; // Safety check

    const docRef = doc(db, 'feedback', postId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        contentArea.innerHTML = "Feedback post not found.";
        return;
    }

    const data = docSnap.data();
    const currentStatus = data.status || (data.resolved ? 'resolved' : 'open');
    const currentPriority = data.priority || 'medium';
    const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : 'Unknown';

    contentArea.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <h2>${escapeHtml(data.page)} - ${escapeHtml(data.title)}</h2>
            <div class="text-right">
                <select id="status-select" class="form-control mb-2" style="width: 200px;">
                    <option value="open" ${currentStatus === 'open' ? 'selected' : ''}>Open</option>
                    <option value="in-progress" ${currentStatus === 'in-progress' ? 'selected' : ''}>In Progress</option>
                    <option value="resolved" ${currentStatus === 'resolved' ? 'selected' : ''}>Resolved</option>
                    <option value="denied" ${currentStatus === 'denied' ? 'selected' : ''}>Denied</option>
                </select>
                <select id="priority-select" class="form-control" style="width: 200px;">
                    <option value="low" ${currentPriority === 'low' ? 'selected' : ''}>Low Priority</option>
                    <option value="medium" ${currentPriority === 'medium' ? 'selected' : ''}>Medium Priority</option>
                    <option value="high" ${currentPriority === 'high' ? 'selected' : ''}>High Priority</option>
                </select>
            </div>
        </div>
        <div class="meta-row">
            <strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.contact)}&gt;<br>
            <strong>Date:</strong> ${date}<br>
            <strong>IP:</strong> <span class="code-info">${escapeHtml(data.ip)}</span>
        </div>
        <div class="message-body">${escapeHtml(data.message)}</div>
    `;

    // Save changes when dropdowns change
    const handleUpdate = async () => {
        const newStatus = document.getElementById('status-select').value;
        const newPriority = document.getElementById('priority-select').value;

        await updateDoc(docRef, {
            status: newStatus,
            priority: newPriority,
            resolved: newStatus === 'resolved'
        });

        await createServerLog('admin', `Updated Feedback: ${data.title}`, {
            feedbackID: postId,
            newStatus,
            newPriority,
            user: auth.currentUser.email
        });
    };

    document.getElementById('status-select').onchange = handleUpdate;
    document.getElementById('priority-select').onchange = handleUpdate;

    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            if (confirm("Permanently delete?")) {
                await deleteDoc(docRef);
                window.location.href = '/feedback';
            }
        };
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}