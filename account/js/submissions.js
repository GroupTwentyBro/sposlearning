import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken } from "/js/auth.js";

const API_URL = CONFIG.API_URL;
let currentUser = null;
let allSubmissions = [];
let activeFilter = 'all';
let pendingDeleteId = null;

// ─── Auth ──────────────────────────────────────────────────────────────────

async function checkAuth() {
    try {
        const loggedIn = await initAuth();
        if (!loggedIn) { window.location.href = '/login'; return; }
        currentUser = getUser();
    } catch (e) {
        window.location.href = '/login';
        return;
    }
    setupFilters();
    setupDeleteModal();
    await fetchSubmissions();
}

// ─── API ───────────────────────────────────────────────────────────────────

async function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
        const token = await getAccessToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) { /* ignore */ }
    return headers;
}

async function fetchSubmissions() {
    setListLoading();
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/submissions/mine`, { headers, credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allSubmissions = await res.json();
        renderSubmissions();
    } catch (err) {
        document.getElementById('submissions-list').innerHTML = `
            <div class="empty-state">
                <span class="icon">error</span>
                <p>Failed to load submissions. Please try again.</p>
                <button class="btn btn-secondary" onclick="location.reload()">Retry</button>
            </div>`;
    }
}

async function deleteSubmission(id) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/submissions/${id}`, {
            method: 'DELETE', headers, credentials: 'include'
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
        showNotification('Submission deleted');
        await fetchSubmissions();
    } catch (err) {
        showNotification(`Error: ${err.message}`, 'error');
    }
}

// ─── Render ────────────────────────────────────────────────────────────────

function renderSubmissions() {
    const list = document.getElementById('submissions-list');
    const filtered = activeFilter === 'all'
        ? allSubmissions
        : allSubmissions.filter(s => s.status === activeFilter);

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <span class="icon">description</span>
                <p>${activeFilter === 'all' ? "You haven't submitted any articles yet." : `No ${activeFilter.replace('_', ' ')} submissions.`}</p>
                ${activeFilter === 'all' ? '<a href="/submit" class="btn btn-primary"><span class="icon">add_circle</span> Submit Your First Article</a>' : ''}
            </div>`;
        return;
    }

    list.innerHTML = '';
    filtered.forEach(sub => list.appendChild(buildCard(sub)));
}

function buildCard(sub) {
    const card = document.createElement('div');
    card.className = `submission-card status-${sub.status}`;

    const gradeMap = { 0: 'All Grades', 1: '1st Grade', 2: '2nd Grade', 3: '3rd Grade', 4: '4th Grade' };
    const gradeName = gradeMap[sub.grade] || `Grade ${sub.grade}`;
    const dateStr = sub.created_at ? new Date(sub.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const updatedStr = sub.updated_at ? new Date(sub.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
    const statusLabel = { pending: 'Pending Review', needs_changes: 'Needs Changes', approved: 'Approved', rejected: 'Rejected' }[sub.status] || sub.status;

    // Admin note block
    let adminNoteHtml = '';
    if (sub.admin_note && (sub.status === 'needs_changes' || sub.status === 'rejected')) {
        const cls = sub.status === 'rejected' ? 'rejected-note' : '';
        adminNoteHtml = `
            <div class="admin-note ${cls}">
                <span class="icon note-icon">feedback</span>
                <div>
                    <div class="note-label">Admin Note</div>
                    <div class="note-text">${escapeHtml(sub.admin_note)}</div>
                </div>
            </div>`;
    }

    // Action buttons
    const canEdit   = ['pending', 'needs_changes', 'approved'].includes(sub.status);
    const canDelete = ['pending', 'needs_changes', 'rejected'].includes(sub.status);
    const canView   = sub.status === 'approved' && sub.live_page_id;
    const editLabel = sub.status === 'approved' ? 'Edit & Resubmit' : 'Edit';
    const editIcon  = sub.status === 'approved' ? 'refresh' : 'edit';

    let actions = '';
    if (canEdit)   actions += `<button class="btn-sm btn-sm-primary action-edit" data-id="${sub.id}"><span class="icon">${editIcon}</span>${editLabel}</button>`;
    if (canView)   actions += `<a href="/${sub.suggested_path}" class="btn-sm btn-sm-success" target="_blank"><span class="icon">open_in_new</span>View Live</a>`;
    if (canDelete) actions += `<button class="btn-sm btn-sm-danger action-delete" data-id="${sub.id}"><span class="icon">delete</span>Delete</button>`;

    card.innerHTML = `
        <div class="card-top">
            <div class="card-title">${escapeHtml(sub.title)}</div>
            <span class="status-badge ${sub.status}">${statusLabel}</span>
        </div>
        <div class="card-path">/${escapeHtml(sub.suggested_path)}</div>
        <div class="card-meta">
            <span class="meta-item"><span class="icon">school</span>${escapeHtml(gradeName)}</span>
            <span class="meta-item"><span class="icon">calendar_today</span>Submitted ${dateStr}</span>
            ${updatedStr && updatedStr !== dateStr ? `<span class="meta-item"><span class="icon">update</span>Updated ${updatedStr}</span>` : ''}
        </div>
        ${adminNoteHtml}
        <div class="card-actions">${actions}</div>
    `;

    // Wire up buttons
    card.querySelector('.action-edit')?.addEventListener('click', () => {
        window.location.href = `/submit?id=${sub.id}`;
    });
    card.querySelector('.action-delete')?.addEventListener('click', () => {
        openDeleteModal(sub.id, sub.title);
    });

    return card;
}

// ─── Filters ───────────────────────────────────────────────────────────────

function setupFilters() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            renderSubmissions();
        });
    });
}

// ─── Delete modal ──────────────────────────────────────────────────────────

function setupDeleteModal() {
    document.getElementById('delete-cancel-btn').addEventListener('click', closeDeleteModal);
    document.getElementById('delete-confirm-btn').addEventListener('click', async () => {
        if (!pendingDeleteId) return;
        closeDeleteModal();
        await deleteSubmission(pendingDeleteId);
        pendingDeleteId = null;
    });
    document.getElementById('delete-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
    });
}

function openDeleteModal(id, title) {
    pendingDeleteId = id;
    document.getElementById('delete-modal-desc').textContent = `"${title}" will be permanently deleted.`;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
    pendingDeleteId = null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function setListLoading() {
    document.getElementById('submissions-list').innerHTML = `
        <div class="loading-state">
            <span class="icon spinner">sync</span>
            <p>Loading your submissions…</p>
        </div>`;
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function showNotification(message, type = 'success') {
    const n = document.getElementById('notification');
    n.textContent = message;
    n.className = `notification${type === 'error' ? ' error' : ''}`;
    n.classList.remove('hidden');
    clearTimeout(n._t);
    n._t = setTimeout(() => n.classList.add('hidden'), 3500);
}

// ─── Init ──────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
} else {
    checkAuth();
}
