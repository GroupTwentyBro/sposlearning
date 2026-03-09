import { app, auth } from '/js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, getDocs, query, orderBy, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from '/js/theming.js';

const db = getFirestore(app);
const container = document.getElementById('secure'); // Changed from 'secure-container' to match your HTML ID

let allFeedback = [];
let currentSort = 'desc';
let hideResolved = false;
let currentPriority = 'all'; // New filter state

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // If using a DB shell, load it first
            await loadFeedbackUI();
            setupControls();
            await loadFeedbackData();
            initThemeListeners();
            document.querySelector('.dot-container')?.classList.add('hidden');
        } catch (err) {
            console.error("Initialization failed:", err);
        }
    } else {
        window.location.href = '/login';
    }
});

async function loadFeedbackUI() {
    const docRef = doc(db, "admin-pages", "feedback");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
    }
}

function setupControls() {
    const searchInput = document.getElementById('search-input');

    document.getElementById('sort-select')?.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderFeedback(searchInput?.value);
    });

    document.getElementById('hide-resolved')?.addEventListener('change', (e) => {
        hideResolved = e.target.checked;
        renderFeedback(searchInput?.value);
    });

    // New Priority Filter Listener
    document.getElementById('priority-filter')?.addEventListener('change', (e) => {
        currentPriority = e.target.value;
        renderFeedback(searchInput?.value);
    });

    searchInput?.addEventListener('input', (e) => {
        renderFeedback(e.target.value);
    });
}

async function loadFeedbackData() {
    const listContainer = document.getElementById('feedback-list');
    const loadingText = document.getElementById('loading');
    if (!listContainer) return;

    try {
        const q = query(collection(db, 'feedback'), orderBy('timestamp', currentSort));
        const snapshot = await getDocs(q);

        allFeedback = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if(loadingText) loadingText.style.display = 'none';
        renderFeedback();
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

function renderFeedback(term = "") {
    const listContainer = document.getElementById('feedback-list');
    if (!listContainer) return;

    const searchTerm = (term || '').trim().toLowerCase();
    listContainer.innerHTML = '';

    const statusConfig = {
        'open': { class: 'badge-primary', label: 'Open' },
        'in-progress': { class: 'badge-info', label: 'In Progress' },
        'denied': { class: 'badge-danger', label: 'Denied' },
        'resolved': { class: 'badge-success', label: 'Resolved' }
    };

    let filtered = allFeedback.filter(item => {
        // Backward compatibility: if no status, use resolved bool
        const status = item.status || (item.resolved ? 'resolved' : 'open');
        const priority = item.priority || 'medium';

        const matchesResolved = hideResolved ? status !== 'resolved' : true;
        const matchesPriority = currentPriority === 'all' || priority === currentPriority;
        const matchesSearch = searchTerm === "" ||
            (item.title || '').toLowerCase().includes(searchTerm) ||
            (item.page || '').toLowerCase().includes(searchTerm) ||
            (item.message || '').toLowerCase().includes(searchTerm);

        return matchesResolved && matchesPriority && matchesSearch;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="text-center mt-3">No matching feedback found.</p>';
        return;
    }

    filtered.forEach(data => {
        const currentStatus = data.status || (data.resolved ? 'resolved' : 'open');
        const config = statusConfig[currentStatus] || statusConfig['open'];
        const priority = data.priority || 'medium';

        const preview = (data.message || '').substring(0, 100) + (data.message?.length > 100 ? '...' : '');

        const a = document.createElement('a');
        a.href = `/feedback/post?id=${data.id}`;
        a.className = `feedback-item list-group-item list-group-item-action ${currentStatus === 'resolved' ? 'read' : ''}`;

        // Visual indicator for high priority
        if (priority === 'high') {
            a.style.borderLeft = "5px solid #dc3545";
        }

        a.innerHTML = `
            <div class="feedback-header">
                <div class="feedback-title">
                    <span class="badge ${config.class} mr-2">${config.label}</span>
                    ${priority === 'high' ? '<span class="badge badge-warning mr-2">HIGH</span>' : ''}
                    ${escapeHtml(data.page || 'General')} - ${escapeHtml(data.title)}
                </div>
                <div class="feedback-meta">
                    <div>${escapeHtml(data.contact)}</div>
                </div>
            </div>
            <div class="feedback-preview">${escapeHtml(preview)}</div>
        `;
        listContainer.appendChild(a);
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}