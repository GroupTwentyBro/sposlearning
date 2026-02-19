import { app, auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, getDocs, query, orderBy, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from '../js/theming.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

// State Variables
let allFeedback = [];
let currentSort = 'desc';
let hideResolved = false;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {

            await loadFeedbackUI();

            setupControls();
            // Call the NEW data loader that populates the cache
            await loadFeedbackData();

            initThemeListeners();
            const loader = document.querySelector('.dot-container');
            if (loader) loader.classList.add('hidden');
        } catch (err) {
            console.error("Initialization failed:", err);
        }
    } else {
        window.location.href = '/admin';
    }
});

async function loadFeedbackUI() {
    const docRef = doc(db, "admin-pages", "feedback");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
    } else {
        container.innerHTML = "<h3>Error: Feedback UI shell not found.</h3>";
        throw new Error("UI Shell Missing");
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

    searchInput?.addEventListener('input', (e) => {
        renderFeedback(e.target.value); // Instant local search
    });
}

async function loadFeedbackData() {
    const loadingText = document.getElementById('loading');
    const listContainer = document.getElementById('feedback-list');
    if (!listContainer || !loadingText) return;

    loadingText.style.display = 'block';
    listContainer.innerHTML = '';

    try {
        // Fetch everything once
        const q = query(collection(db, 'feedback'), orderBy('timestamp', currentSort));
        const snapshot = await getDocs(q);

        allFeedback = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        loadingText.style.display = 'none';
        renderFeedback();
    } catch (error) {
        console.error("Fetch error:", error);
        loadingText.textContent = 'Error loading data.';
    }
}

function renderFeedback(term = "") {
    const listContainer = document.getElementById('feedback-list');
    if (!listContainer) return;

    const searchTerm = (term || '').trim().toLowerCase();
    listContainer.innerHTML = '';

    // 1. Filter local array
    let filtered = allFeedback.filter(item => {
        const matchesResolved = hideResolved ? !item.resolved : true;
        const matchesSearch = searchTerm === "" ||
            (item.title || '').toLowerCase().includes(searchTerm) ||
            (item.page || '').toLowerCase().includes(searchTerm) ||
            (item.message || '').toLowerCase().includes(searchTerm);

        return matchesResolved && matchesSearch;
    });

    // 2. Sort (Resolved at bottom, then by timestamp)
    filtered.sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved - b.resolved;
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return currentSort === 'desc' ? timeB - timeA : timeA - timeB;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="text-center mt-3">No matching feedback found.</p>';
        return;
    }

    // 3. Render
    filtered.forEach(data => {
        const preview = (data.message || '').substring(0, 100) + (data.message?.length > 100 ? '...' : '');
        const a = document.createElement('a');
        a.href = `/admin/feedback/post?id=${data.id}`;
        a.className = `feedback-item list-group-item list-group-item-action ${data.resolved ? 'read' : ''}`;

        a.innerHTML = `
            <div class="feedback-header">
                <div class="feedback-title">
                    ${escapeHtml(data.page)} - ${escapeHtml(data.title)}
                    ${data.resolved ? '<span class="badge badge-success ml-2">Resolved</span>' : ''}
                </div>
                <div class="feedback-meta">
                    <div>${escapeHtml(data.contact)}</div>
                    <div class="text-muted" style="font-size: 0.75rem;">IP: ${escapeHtml(data.ip || 'Unknown')}</div>
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