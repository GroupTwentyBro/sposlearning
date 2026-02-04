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
        // 1. Load the UI Shell from Firestore
        await loadFeedbackUI();

        // 2. Initial Data Load
        await loadFeedbackData();

        // 3. Setup Filter Listeners
        setupControls();

        // 4. Cleanup UI
        initThemeListeners();
        const loader = document.querySelector('.dot-container');
        if (loader) loader.classList.add('hidden');
    } else {
        window.location.href = '/admin';
    }
});

async function loadFeedbackUI() {
    // You'll store the HTML structure in Firestore at admin/feedback_inbox
    const docRef = doc(db, "admin", "feedback");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
    } else {
        container.innerHTML = "<h3>Error: Feedback UI shell not found.</h3>";
    }
}

function setupControls() {
    const sortSelect = document.getElementById('sort-select');
    const hideResolvedCheckbox = document.getElementById('hide-resolved');

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            loadFeedbackData();
        });
    }

    if (hideResolvedCheckbox) {
        hideResolvedCheckbox.addEventListener('change', (e) => {
            hideResolved = e.target.checked;
            loadFeedbackData();
        });
    }
}

async function loadFeedbackData() {
    const listContainer = document.getElementById('feedback-list');
    const loadingText = document.getElementById('loading');

    if (!listContainer) return;

    loadingText.style.display = 'block';
    listContainer.innerHTML = '';

    try {
        const q = query(collection(db, 'feedback'), orderBy('timestamp', currentSort));
        const snapshot = await getDocs(q);

        loadingText.style.display = 'none';

        if (snapshot.empty) {
            listContainer.innerHTML = '<p class="text-center">No feedback found.</p>';
            return;
        }

        let visibleCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (hideResolved && data.resolved) return;

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
                        <div>IP: ${escapeHtml(data.ip)}</div>
                    </div>
                </div>
                <div class="feedback-preview">${escapeHtml(preview)}</div>
            `;
            listContainer.appendChild(a);
        });

        if (visibleCount === 0) listContainer.innerHTML = '<p class="text-center">No matching feedback.</p>';

    } catch (error) {
        console.error(error);
        if (loadingText) loadingText.textContent = 'Error loading feedback.';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}