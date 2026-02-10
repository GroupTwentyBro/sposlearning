import { app, auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, getDocs, query, orderBy, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from '../js/theming.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

// State Variables
let currentSort = 'desc';
let hideResolved = false;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 1. MUST wait for the HTML to be injected
        await loadFeedbackUI();

        // 2. NOW that the HTML is in the DOM, we can find the buttons/inputs
        setupControls();

        // 3. Load the actual data
        await loadFeedback();

        initThemeListeners();
        const loader = document.querySelector('.dot-container');
        if (loader) loader.classList.add('hidden');
    } else {
        window.location.href = '/admin';
    }
});

async function loadFeedbackUI() {
    const docRef = doc(db, "admin-pages", "feedback");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
        // Optional: Trigger a custom event or a small delay if the DOM is slow
        return Promise.resolve();
    } else {
        container.innerHTML = "<h3>Error: Feedback UI shell not found.</h3>";
        return Promise.reject("UI not found");
    }
}

function setupControls() {
    const sortSelect = document.getElementById('sort-select');
    const hideResolvedCheckbox = document.getElementById('hide-resolved');
    const searchInput = document.getElementById('search-input');

    sortSelect?.addEventListener('change', (e) => {
        currentSort = e.target.value;
        loadFeedback(searchInput?.value); // Pass current search term
    });

    hideResolvedCheckbox?.addEventListener('change', (e) => {
        hideResolved = e.target.checked;
        loadFeedback(searchInput?.value); // Pass current search term
    });

    // Handle search input here once
    searchInput?.addEventListener('input', (e) => {
        loadFeedback(e.target.value);
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function loadFeedback(term = "") {
    const loadingText = document.getElementById('loading');
    const listContainer = document.getElementById('feedback-list');

    if (!listContainer) return;

    loadingText.style.display = 'block';
    listContainer.innerHTML = '';

    try {
        const q = query(
            collection(db, 'feedback'),
            orderBy('resolved', 'asc'),
            orderBy('timestamp', currentSort)
        );

        const snapshot = await getDocs(q);
        loadingText.style.display = 'none';

        if (snapshot.empty) {
            listContainer.innerHTML = '<p class="text-center">No feedback found.</p>';
            return;
        }

        let visibleCount = 0;
        const searchTerm = term.trim().toLowerCase();

        snapshot.forEach(doc => {
            const data = doc.data();

            // 1. Filter Resolved
            if (hideResolved && data.resolved) return;

            // 2. Filter Search
            if (searchTerm !== "") {
                const titleMatch = (data.title || '').toLowerCase().includes(searchTerm);
                const pageMatch = (data.page || '').toLowerCase().includes(searchTerm);
                if (!titleMatch && !pageMatch) return;
            }

            visibleCount++;
            const id = doc.id;
            let preview = (data.message || '').substring(0, 100) + (data.message?.length > 100 ? '...' : '');

            const a = document.createElement('a');
            a.href = `/admin/feedback/post?id=${id}`;
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

        if (visibleCount === 0) {
            listContainer.innerHTML = '<p class="text-center">No matching feedback.</p>';
        }

    } catch (error) {
        console.error(error);
        if (loadingText) loadingText.textContent = 'Error loading feedback.';
    }
}