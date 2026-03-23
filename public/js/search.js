import { app } from './firebaseConfig.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, getDocs, getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from './theming.js';

const KRATOS_URL = "https://auth.sposlearning.cz";
const db = getFirestore(app);

let allPages = [];
let isAdminUser = false;
let currentUser = null;

const searchInput = document.getElementById('search-input');
const welcomeMessage = document.getElementById('welcome-message');
const disclamerInfo = document.getElementById('disclamer-info');
const searchResultsContainer = document.getElementById('search-results');

async function checkKratosAdmin() {
    try {
        const response = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) return false;

        const session = await response.json();
        return session.identity?.metadata_public?.admin === true;
    } catch (error) {
        console.error("Kratos check failed:", error);
        return false;
    }
}

async function fetchAllPages() {
    try {
        const querySnapshot = await getDocs(collection(db, 'pages'));
        allPages = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.type !== 'redirection') {
                allPages.push({
                    title: data.title,
                    path: data.fullPath,
                    accessLevel: (data.accessLevel || 'public').toLowerCase().trim(),
                    content: data.content ? data.content.toLowerCase() : ''
                });
            }
        });

        console.log(`Loaded ${allPages.length} pages.`);
    } catch (err) {
        console.error("Failed to fetch pages:", err);
    }
}

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();

    if (searchTerm.length === 0) {
        showResults(true);
        const allVisible = allPages.filter(p => p.accessLevel !== 'admin' || isAdminUser);
        renderResults(allVisible);
        return;
    }

    if (searchTerm.length < 2) {
        showResults(false);
        return;
    }

    const matchedTitlePaths = allPages
        .filter(p => (p.accessLevel !== 'admin' || isAdminUser) && p.title.toLowerCase().includes(searchTerm))
        .map(p => p.path);

    const results = allPages.filter(page => {
        if (page.accessLevel === 'admin' && !isAdminUser) return false;

        const matchesPath = page.path.toLowerCase().includes(searchTerm);
        const matchesTitle = page.title.toLowerCase().includes(searchTerm);
        const isChildOfMatch = matchedTitlePaths.some(parentPath => page.path.startsWith(parentPath + '/'));

        return matchesPath || matchesTitle || isChildOfMatch;
    });

    showResults(true);
    renderResults(results);
}

function showResults(visible) {
    if (visible) {
        welcomeMessage.style.display = 'none';
        if (disclamerInfo) disclamerInfo.style.display = 'none';
        searchResultsContainer.style.display = 'block';
    } else {
        welcomeMessage.style.display = 'block';
        if (disclamerInfo) disclamerInfo.style.display = 'block';
        searchResultsContainer.style.display = 'none';
        searchResultsContainer.innerHTML = '';
    }
}

function renderResults(results) {
    searchResultsContainer.innerHTML = '';
    if (results.length === 0) {
        searchResultsContainer.innerHTML = '<h3>Nebyly nalezeny žádné výsledky.</h3>';
        return;
    }

    const treeRoot = buildTree(results);
    const treeContainer = document.createElement('ul');
    treeContainer.className = 'search-tree';

    Object.keys(treeRoot).sort().forEach(key => {
        treeContainer.appendChild(createTreeDOM(treeRoot[key]));
    });

    searchResultsContainer.appendChild(treeContainer);
}

function buildTree(results) {
    const root = {};
    results.forEach(page => {
        const parts = page.path.split('/').filter(p => p);
        let currentLevel = root;
        let currentPathAccumulator = '';

        parts.forEach((part, index) => {
            currentPathAccumulator += (index > 0 ? '/' : '') + part;

            if (!currentLevel[part]) {
                currentLevel[part] = { children: {}, name: part, pageData: null };
                const parentPage = allPages.find(p => p.path === currentPathAccumulator);
                if (parentPage && (parentPage.accessLevel !== 'admin' || isAdminUser)) {
                    currentLevel[part].pageData = parentPage;
                }
            }

            if (index === parts.length - 1) currentLevel[part].pageData = page;
            currentLevel = currentLevel[part].children;
        });
    });
    return root;
}

function createTreeDOM(node) {
    const li = document.createElement('li');
    let el;

    if (node.pageData) {
        el = document.createElement('a');
        el.href = `/${node.pageData.path}`;
        el.className = 'search-result-link';
        el.textContent = node.pageData.title;
        if (localStorage.getItem('openPreference') === 'new') el.target = '_blank';
        if (node.pageData.accessLevel === 'admin') {
            el.innerHTML += ' <span style="font-size:0.8em; color:red;"> (Admin)</span>';
        }
    } else {
        el = document.createElement('span');
        el.className = 'search-result-folder';
        el.textContent = node.name;
    }

    li.appendChild(el);
    const childKeys = Object.keys(node.children);
    if (childKeys.length > 0) {
        const ul = document.createElement('ul');
        childKeys.sort().forEach(key => ul.appendChild(createTreeDOM(node.children[key])));
        li.appendChild(ul);
    }
    return li;
}

function renderAdminBar(user, isAdmin) {
    const adminBar = document.getElementById('admin-bar');
    if (!adminBar) return;

    const auth = getAuth(app);
    adminBar.innerHTML = '';

    const dashboardLink = isAdmin ? `
        <a href="https://admin.sposlearning.cz/" class="btn btn-sm btn-white pc">Dashboard</a>
        <a href="https://admin.sposlearning.cz/" class="btn btn-sm btn-white ctrl-btn mobile"><span class="icon">team_dashboard</span></a>
    ` : '';

    if (user) {
        adminBar.innerHTML = `
            <div class="admin-controls">
                <div id="logged-in-buttons" style="display: flex; gap: 10px; align-items: center;">
                    <a href="/settings" class="btn btn-sm btn-primary pc">Nastavení</a>
                    <a href="/settings" class="btn btn-sm btn-primary ctrl-btn mobile"><span class="icon">settings</span></a>
                    ${dashboardLink}
                    <button class="btn btn-sm btn-danger pc" id="logout-button-pc">Logout</button>
                    <button class="btn btn-sm btn-danger ctrl-btn mobile" id="logout-button-mob"><span class="icon">logout</span></button>
                </div>
            </div>`;

        const logout = () => signOut(auth).catch(console.error);
        document.getElementById('logout-button-pc')?.addEventListener('click', logout);
        document.getElementById('logout-button-mob')?.addEventListener('click', logout);
    } else {
        adminBar.innerHTML = `
            <div class="admin-controls">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <a href="/settings" class="btn btn-sm btn-primary pc">Nastavení</a>
                    <a href="/settings" class="btn btn-sm btn-primary ctrl-btn mobile"><span class="icon">settings</span></a>
                    <a href="/login" class="btn btn-sm btn-primary pc">Přihlásit se</a>
                    <a href="/login" class="btn btn-sm btn-primary ctrl-btn mobile"><span class="icon">login</span></a>
                </div>
            </div>`;
    }
}

async function bootApp() {
    initThemeListeners();
    document.body.style.setProperty("transition", "none");

    const auth = getAuth(app);

    await new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            isAdminUser = await checkKratosAdmin();
            renderAdminBar(user, isAdminUser);
            resolve();
        });
    });

    await fetchAllPages();

    searchInput.disabled = false;
    searchInput.placeholder = "Hledej v zápisech...";

    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('focus', handleSearch);

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResultsContainer.contains(e.target)) {
            showResults(false);
        }
    });

    if (searchInput.value.length >= 2) handleSearch({ target: searchInput });
}

bootApp();