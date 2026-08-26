import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken } from "/js/auth.js";

const API_URL = CONFIG.API_URL;
let currentUser = null;
let allSubmissions = [];
let activeKpi = 'all';
let selectedSub = null;
let modalEditor = null; // CodeMirror instance inside modal

// ─── Auth ──────────────────────────────────────────────────────────────────

async function checkAuth() {
    try {
        const loggedIn = await initAuth();
        if (!loggedIn) { window.location.href = '/login'; return; }
        currentUser = getUser();
        if (!currentUser?.roles?.includes('admin')) { window.location.href = '/'; return; }
    } catch (e) {
        window.location.href = '/login';
        return;
    }
    setupControls();
    await fetchSubmissions();
}

// ─── API ───────────────────────────────────────────────────────────────────

async function getAuthHeaders() {
    const h = { 'Content-Type': 'application/json' };
    try { const t = await getAccessToken(); if (t) h['Authorization'] = `Bearer ${t}`; } catch (e) {}
    return h;
}

async function fetchSubmissions() {
    setListLoading();
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/submissions`, { headers, credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allSubmissions = await res.json();
        updateKPIs();
        renderList();
    } catch (err) {
        document.getElementById('submissions-list').innerHTML = `
            <div class="empty-state">
                <span class="icon">error</span>
                <p>Failed to load submissions: ${escapeHtml(err.message)}</p>
            </div>`;
    }
}

async function submitReview(id, payload) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/submissions/${id}/review`, {
        method: 'PUT', headers, credentials: 'include',
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Review failed');
    }
    return res.json();
}

async function deleteSubmission(id) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/submissions/${id}`, {
        method: 'DELETE', headers, credentials: 'include'
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Delete failed');
    }
    return res.json();
}

// ─── KPIs ──────────────────────────────────────────────────────────────────

function updateKPIs() {
    document.getElementById('kpi-total').textContent   = allSubmissions.length;
    document.getElementById('kpi-pending').textContent = allSubmissions.filter(s => s.status === 'pending').length;
    document.getElementById('kpi-needs').textContent   = allSubmissions.filter(s => s.status === 'needs_changes').length;
    document.getElementById('kpi-approved').textContent= allSubmissions.filter(s => s.status === 'approved').length;
    document.getElementById('kpi-rejected').textContent= allSubmissions.filter(s => s.status === 'rejected').length;
}

// ─── Render list ───────────────────────────────────────────────────────────

function renderList() {
    const list = document.getElementById('submissions-list');
    const term = (document.getElementById('sub-search')?.value || '').toLowerCase().trim();
    const sort = document.getElementById('sort-select')?.value || 'date-desc';

    let items = allSubmissions.filter(s => {
        if (activeKpi !== 'all' && s.status !== activeKpi) return false;
        if (term) {
            return (s.title || '').toLowerCase().includes(term)
                || (s.submitted_by || '').toLowerCase().includes(term)
                || (s.suggested_path || '').toLowerCase().includes(term);
        }
        return true;
    });

    items.sort((a, b) => {
        const da = new Date(a.created_at), db = new Date(b.created_at);
        return sort === 'date-asc' ? da - db : db - da;
    });

    if (items.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <span class="icon">inbox</span>
                <p>${activeKpi === 'all' ? 'No submissions yet.' : `No ${activeKpi.replace('_',' ')} submissions.`}</p>
            </div>`;
        return;
    }

    list.innerHTML = '';
    items.forEach(sub => {
        const card = document.createElement('div');
        card.className = `sub-card status-${sub.status}`;
        const gradeMap = { 0: 'All Grades', 1: '1st Grade', 2: '2nd Grade', 3: '3rd Grade', 4: '4th Grade' };
        const dateStr = sub.created_at ? new Date(sub.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : 'N/A';
        const statusLabel = { pending: 'Pending', needs_changes: 'Needs Changes', approved: 'Approved', rejected: 'Rejected' }[sub.status] || sub.status;

        card.innerHTML = `
            <div class="sub-card-top">
                <span class="sub-card-title">${escapeHtml(sub.title)}</span>
                <span class="status-badge ${sub.status}">${statusLabel}</span>
            </div>
            <div class="sub-card-path">/${escapeHtml(sub.suggested_path)}</div>
            <div class="sub-card-meta">
                <span><span class="icon">person</span> ${escapeHtml(sub.submitted_by)}</span>
                <span><span class="icon">school</span> ${gradeMap[sub.grade] || `Grade ${sub.grade}`}</span>
                <span><span class="icon">calendar_today</span> ${dateStr}</span>
            </div>`;
        card.addEventListener('click', () => openModal(sub));
        list.appendChild(card);
    });
}

// ─── Review Modal ──────────────────────────────────────────────────────────

function openModal(sub) {
    selectedSub = sub;
    const statusLabel = { pending: 'Pending', needs_changes: 'Needs Changes', approved: 'Approved', rejected: 'Rejected' }[sub.status] || sub.status;

    document.getElementById('modal-sub-title').textContent = sub.title || 'Review Submission';
    document.getElementById('modal-author').textContent = sub.submitted_by || 'Unknown';
    document.getElementById('modal-date').textContent = sub.created_at
        ? new Date(sub.created_at).toLocaleString() : 'N/A';

    document.getElementById('modal-title-input').value = sub.title || '';
    document.getElementById('modal-path-input').value  = sub.suggested_path || '';
    document.getElementById('modal-grade-select').value = sub.grade ?? 0;
    document.getElementById('modal-admin-note').value   = sub.admin_note || '';

    const statusBadge = document.getElementById('modal-current-status');
    statusBadge.textContent = statusLabel;
    statusBadge.className = `status-badge ${sub.status}`;

    // Set editor content
    if (modalEditor) {
        modalEditor.setValue(sub.content || '');
        modalEditor.refresh();
    } else {
        document.getElementById('modal-editor').value = sub.content || '';
    }

    // Reset preview
    document.getElementById('modal-preview-pane').classList.add('hidden');
    document.getElementById('modal-editor').classList.remove('hidden');
    document.getElementById('modal-preview-icon').textContent = 'preview';

    document.getElementById('review-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Init CodeMirror in modal on first open
    if (!modalEditor && window.CodeMirror) {
        const ta = document.getElementById('modal-editor');
        modalEditor = CodeMirror.fromTextArea(ta, {
            mode: { name: 'gfm' },
            lineWrapping: true,
            theme: 'default',
            viewportMargin: Infinity
        });
        modalEditor.setValue(sub.content || '');
    }
}

function closeModal() {
    document.getElementById('review-modal').classList.add('hidden');
    document.body.style.overflow = '';
    selectedSub = null;
}

function getModalContent() {
    if (modalEditor) return modalEditor.getValue();
    return document.getElementById('modal-editor').value;
}

// ─── Decision actions ──────────────────────────────────────────────────────

async function handleDecision(status) {
    if (!selectedSub) return;

    const finalTitle   = document.getElementById('modal-title-input').value.trim();
    const finalPath    = document.getElementById('modal-path-input').value.trim().replace(/^\/|\/$/g, '');
    const finalGrade   = parseInt(document.getElementById('modal-grade-select').value, 10);
    const finalContent = getModalContent().trim();
    const adminNote    = document.getElementById('modal-admin-note').value.trim();

    if (!finalTitle || !finalPath || !finalContent) {
        showNotification('Title, path, and content are required', 'error');
        return;
    }

    const payload = {
        status,
        admin_note: adminNote || null,
        ...(status === 'approved' ? {
            final_title:   finalTitle,
            final_path:    finalPath,
            final_grade:   finalGrade,
            final_content: finalContent
        } : {})
    };

    const btnMap = { approved: 'btn-approve', needs_changes: 'btn-changes', rejected: 'btn-reject' };
    const btn = document.getElementById(btnMap[status]);
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="icon spinner">sync</span> Processing…';

    try {
        await submitReview(selectedSub.id, payload);
        const labels = { approved: 'Approved & published!', needs_changes: 'Changes requested', rejected: 'Submission rejected' };
        showNotification(labels[status] || 'Done');
        closeModal();
        await fetchSubmissions();
    } catch (err) {
        showNotification(`Error: ${err.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = origText;
    }
}

// ─── Controls setup ────────────────────────────────────────────────────────

function setupControls() {
    document.getElementById('refresh-btn')?.addEventListener('click', fetchSubmissions);
    document.getElementById('sub-search')?.addEventListener('input', renderList);
    document.getElementById('sort-select')?.addEventListener('change', renderList);

    // KPI filter
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            activeKpi = card.dataset.kpi;
            renderList();
        });
    });

    // Modal close
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('review-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('review-modal')) closeModal();
    });

    // Fullscreen editor
    document.getElementById('modal-fullscreen-btn')?.addEventListener('click', () => {
        if (!selectedSub) return;
        window.location.href = `/admin/edit-page?sid=${encodeURIComponent(selectedSub.id)}`;
    });

    // Admin delete
    document.getElementById('btn-delete-sub')?.addEventListener('click', async () => {
        if (!selectedSub) return;
        const confirmed = confirm(`Permanently delete submission "${selectedSub.title}"?\n\nThis cannot be undone.`);
        if (!confirmed) return;
        const id = selectedSub.id;
        const btn = document.getElementById('btn-delete-sub');
        btn.disabled = true;
        try {
            await deleteSubmission(id);
            showNotification('Submission deleted');
            closeModal();
            await fetchSubmissions();
        } catch (err) {
            showNotification(`Error: ${err.message}`, 'error');
            btn.disabled = false;
        }
    });

    // Decision buttons
    document.getElementById('btn-approve').addEventListener('click',  () => handleDecision('approved'));
    document.getElementById('btn-changes').addEventListener('click',  () => handleDecision('needs_changes'));
    document.getElementById('btn-reject').addEventListener('click',   () => handleDecision('rejected'));

    // Mini toolbar
    document.querySelectorAll('.tb-btn[data-before]').forEach(btn => {
        btn.addEventListener('click', () => {
            const before = btn.dataset.before;
            const after  = btn.dataset.after || '';
            if (modalEditor) {
                const sel = modalEditor.getSelection();
                modalEditor.replaceSelection(before + sel + after);
                modalEditor.focus();
            } else {
                const ta = document.getElementById('modal-editor');
                const s = ta.selectionStart, e = ta.selectionEnd;
                const sel = ta.value.substring(s, e);
                ta.value = ta.value.substring(0, s) + before + sel + after + ta.value.substring(e);
                ta.focus();
            }
        });
    });

    // Preview toggle inside modal
    document.getElementById('modal-toggle-preview')?.addEventListener('click', () => {
        const pane = document.getElementById('modal-preview-pane');
        const icon = document.getElementById('modal-preview-icon');
        if (pane.classList.contains('hidden')) {
            const content = getModalContent();
            pane.innerHTML = marked.parse(content || '');
            pane.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
            pane.classList.remove('hidden');
            document.getElementById('modal-editor').classList.add('hidden');
            icon.textContent = 'edit';
        } else {
            pane.classList.add('hidden');
            document.getElementById('modal-editor').classList.remove('hidden');
            icon.textContent = 'preview';
            if (modalEditor) modalEditor.refresh();
        }
    });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function setListLoading() {
    document.getElementById('submissions-list').innerHTML = `
        <div class="empty-state">
            <span class="icon spinner">sync</span>
            <p>Loading submissions…</p>
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
