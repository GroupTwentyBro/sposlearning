import { initThemeListeners } from '/js/theming.js';
import { createServerLog } from '/js/logging.js';

const KRATOS_URL = "https://auth.sposlearning.cz";
const API_URL = "https://api.sposlearning.cz";

const container = document.getElementById('secure-container');
const params = new URLSearchParams(window.location.search);
const postId = params.get('id');
let currentUser = null;

async function checkAuth() {
    try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error();
        const session = await res.json();
        currentUser = session.identity;

        if (currentUser.metadata_public?.admin !== true) {
            window.location.href = '/login';
            return;
        }

        if (!postId) {
            container.innerHTML = "<h3>No Post ID specified.</h3>";
            return;
        }

        await loadPostData();
        initThemeListeners();
        document.querySelector('.dot-container')?.classList.add('hidden');
    } catch (err) {
        window.location.href = '/login';
    }
}

async function loadPostData() {
    const contentArea = document.getElementById('content-area');
    const deleteBtn = document.getElementById('delete-btn');

    try {
        const res = await fetch(`${API_URL}/feedback/${postId}`, { credentials: 'include' });
        if (!res.ok) {
            contentArea.innerHTML = "Feedback post not found.";
            return;
        }

        const data = await res.json();
        const currentStatus = data.status || (data.resolved ? 'resolved' : 'open');
        const currentCategory = data.category || 'other';
        const currentPriority = data.priority || 'medium';
        const date = new Date(data.timestamp).toLocaleString();

        contentArea.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <h2>${escapeHtml(data.page)} - ${escapeHtml(data.title)}</h2>
                <div class="text-right">
                    <select id="category-select" class="form-control mb-2" style="width: 200px;">
                        <option value="articles" ${currentCategory === 'articles' ? 'selected' : ''}>Zápisy</option>
                        <option value="bug" ${currentCategory === 'bug' ? 'selected' : ''}>Chyba webu</option>
                        <option value="idea" ${currentCategory === 'idea' ? 'selected' : ''}>Nápad</option>
                        <option value="other" ${currentCategory === 'other' ? 'selected' : ''}>Ostatní</option>
                    </select>
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
                <strong>From:</strong> ${escapeHtml(data.name || 'Anonymous')} &lt;${escapeHtml(data.contact)}&gt;<br>
                <strong>Date:</strong> ${date}<br>
                <strong>IP:</strong> <span class="code-info">${escapeHtml(data.ip)}</span>
            </div>
            <div class="message-body">${escapeHtml(data.message)}</div>
        `;

        // Update logic
        const handleUpdate = async () => {
            const newCategory = document.getElementById('category-select').value;
            const newStatus = document.getElementById('status-select').value;
            const newPriority = document.getElementById('priority-select').value;

            const updateRes = await fetch(`${API_URL}/feedback/${postId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: newCategory,
                    status: newStatus,
                    priority: newPriority,
                    resolved: newStatus === 'resolved'
                }),
                credentials: 'include'
            });

            if (updateRes.ok) {
                await createServerLog('admin', `Updated Feedback: ${data.title}`, {
                    feedbackID: postId,
                    newStatus,
                    user: currentUser.traits.email
                });
            }
        };

        document.getElementById('status-select').onchange = handleUpdate;
        document.getElementById('priority-select').onchange = handleUpdate;

        deleteBtn.onclick = async () => {
            if (confirm("Permanently delete this feedback?")) {
                const delRes = await fetch(`${API_URL}/feedback/${postId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                if (delRes.ok) window.location.href = '/feedback';
            }
        };

    } catch (err) {
        contentArea.innerHTML = "Error loading feedback details.";
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

checkAuth();