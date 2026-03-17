import { app } from '/js/firebaseConfig.js';
import {
    getFirestore, collection, getDocs, query, orderBy, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from '/js/theming.js';

const KRATOS_URL = "https://auth.sposlearning.cz";
const LOGIN_REDIRECT = "https://sposlearning.cz/login";
const db = getFirestore(app);

const container = document.getElementById('secure-container');
let allFeedback = [];
let currentSort = 'desc';
let hideResolved = false;
let currentPriority = 'all';

async function checkAuthAndInit() {
    try {
        const response = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error("Unauthorized");

        const session = await response.json();
        const isAdmin = session.identity.metadata_public?.admin === true;

        if (!isAdmin) {
            console.error("Access denied: Not an administrator");
            window.location.href = LOGIN_REDIRECT;
            return;
        }

        console.log("Logged in as:", session.identity.traits.email);

        await loadFeedbackUI();
        setupControls();
        await loadFeedbackData();
        initThemeListeners();

        document.querySelector('.dot-container')?.classList.add('hidden');

    } catch (err) {
        console.warn("Session invalid or network error:", err);
        window.location.href = LOGIN_REDIRECT;
    }
}

async function loadFeedbackUI() {
    if (!container) return;
    try {
        const docRef = doc(db, "admin-pages", "feedback");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            container.innerHTML = docSnap.data().html;
        } else {
            throw new Error("UI Shell Missing in Firestore");
        }
    } catch (err) {
        container.innerHTML = `<h3 class="m-5 text-center">Error: Could not load UI shell.</h3>`;
        throw err;
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

    document.getElementById('priority-filter')?.addEventListener('change', (e) => {
        currentPriority = e.target.value;
        renderFeedback(searchInput?.value);
    });

    searchInput?.addEventListener('input', (e) => {
        renderFeedback(e.target.value);
    });
}

async function loadFeedbackData() {
    const loadingText = document.getElementById('loading');
    const listContainer = document.getElementById('feedback-list');
    if (!listContainer) return;

    try {
        const q = query(collection(db, 'feedback'), orderBy('timestamp', currentSort));
        const snapshot = await getDocs(q);

        allFeedback = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (loadingText) loadingText.style.display = 'none';
        renderFeedback();
    } catch (error) {
        console.error("Firestore Fetch Error:", error);
        if (loadingText) loadingText.textContent = 'Error: Check Firestore Public Rules.';
    }
}

function renderFeedback(term = "") {
    const listContainer = document.getElementById('feedback-list');
    if (!listContainer) return;

    const searchTerm = (term || '').trim().toLowerCase();
    listContainer.innerHTML = '';

    const statusConfig = {
        'open': { class: 'badge-primary', label: 'Open', weight: 10 },
        'in-progress': { class: 'badge-info', label: 'In Progress', weight: 20 },
        'resolved': { class: 'badge-success', label: 'Resolved', weight: 30 },
        'denied': { class: 'badge-danger', label: 'Denied', weight: 40 }
    };

    const priorityWeight = { 'high': 1, 'medium': 2, 'low': 3 };

    let filtered = allFeedback.filter(item => {
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

    filtered.sort((a, b) => {
        const statusA = a.status || (a.resolved ? 'resolved' : 'open');
        const statusB = b.status || (b.resolved ? 'resolved' : 'open');
        const prioA = a.priority || 'medium';
        const prioB = b.priority || 'medium';

        const isClosedA = (statusA === 'resolved' || statusA === 'denied');
        const isClosedB = (statusB === 'resolved' || statusB === 'denied');

        if (isClosedA !== isClosedB) return isClosedA ? 1 : -1;

        if (priorityWeight[prioA] !== priorityWeight[prioB]) {
            return priorityWeight[prioA] - priorityWeight[prioB];
        }

        if (statusConfig[statusA].weight !== statusConfig[statusB].weight) {
            return statusConfig[statusA].weight - statusConfig[statusB].weight;
        }

        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return currentSort === 'desc' ? timeB - timeA : timeA - timeB;
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

        if (priority === 'high') {
            a.style.borderLeft = "6px solid #ff4d4d";
            a.style.backgroundColor = "rgba(255, 77, 77, 0.05)";
        }

        a.innerHTML = `
            <div class="feedback-header">
                <div class="feedback-title">
                    <span class="badge ${config.class} mr-2">${config.label}</span>
                    ${priority === 'high' ? '<span class="badge badge-warning mr-2" style="color: #000; font-weight: bold;">HIGH PRIORITY</span>' : ''}
                    ${escapeHtml(data.page)} - ${escapeHtml(data.title)}
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

checkAuthAndInit();