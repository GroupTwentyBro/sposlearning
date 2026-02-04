// public/admin/feedback/post.js
import { app, auth } from '../../js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from '../../js/theming.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');
const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (!postId) {
            container.innerHTML = "<h3>No Post ID specified.</h3>";
            document.querySelector('.dot-container')?.classList.add('hidden');
            return;
        }

        try {
            // 1. Load the UI Shell
            await loadPostUI();

            // 2. Load the Feedback Data
            await loadPostData();

            // 3. Finalize UI
            initThemeListeners();
            document.querySelector('.dot-container')?.classList.add('hidden');
        } catch (err) {
            console.error("Initialization failed:", err);
        }
    } else {
        window.location.href = '/admin';
    }
});

async function loadPostUI() {
    const docRef = doc(db, "admin", "feedback_post");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
    } else {
        container.innerHTML = "<h3>Error: UI shell 'admin/feedback_post' not found.</h3>";
        throw new Error("UI missing");
    }
}

async function loadPostData() {
    const contentArea = document.getElementById('content-area');
    const resolveBtn = document.getElementById('resolve-btn');
    const deleteBtn = document.getElementById('delete-btn');

    const docRef = doc(db, 'feedback', postId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        contentArea.innerHTML = "Feedback post not found.";
        return;
    }

    const data = docSnap.data();
    const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : 'Unknown';

    // Update button state based on resolved status
    if (data.resolved) {
        resolveBtn.textContent = "Mark Unresolved";
        resolveBtn.classList.replace('btn-success', 'btn-warning');
    }

    // Populate Content
    contentArea.innerHTML = `
        <h2>${escapeHtml(data.page)} - ${escapeHtml(data.title)}</h2>
        <div class="meta-row">
            <strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.contact)}&gt;<br>
            <strong>Date:</strong> ${date}<br>
            <strong>IP:</strong> <span class="code-info">${escapeHtml(data.ip)}</span><br>
            <strong>Page Context:</strong> <span class="code-info">${escapeHtml(data.relatedPage)}</span>
        </div>
        <div class="message-body">${escapeHtml(data.message)}</div>
        <hr>
        <small class="text-muted">User Agent: ${escapeHtml(data.userAgent)}</small>
    `;

    // Event Listeners
    resolveBtn.onclick = async () => {
        resolveBtn.disabled = true;
        await updateDoc(docRef, { resolved: !data.resolved });
        location.reload();
    };

    deleteBtn.onclick = async () => {
        if (confirm("Permanently delete this feedback?")) {
            deleteBtn.disabled = true;
            await deleteDoc(docRef);
            window.location.href = '/admin/feedback.html';
        }
    };
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}