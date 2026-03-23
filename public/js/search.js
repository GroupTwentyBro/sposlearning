import { initThemeListeners } from './theming.js';

const KRATOS_URL = "https://auth.sposlearning.cz";
const API_URL = "https://api.sposlearning.cz";

let allPages = [];
let isAdminUser = false;
let currentUser = null;

const searchInput = document.getElementById('search-input');
const welcomeMessage = document.getElementById('welcome-message');
const disclamerInfo = document.getElementById('disclamer-info');
const searchResultsContainer = document.getElementById('search-results');

async function fetchSession() {
    try {
        const response = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            const session = await response.json();
            currentUser = session.identity;
            isAdminUser = currentUser.metadata_public?.admin === true;
        } else {
            currentUser = null;
            isAdminUser = false;
        }
    } catch (error) {
        console.error("Auth check failed:", error);
        currentUser = null;
        isAdminUser = false;
    }
}

async function fetchAllPages() {
    try {
        const response = await fetch(`${API_URL}/pages`);
        if (!response.ok) throw new Error("Failed to load pages API");

        const data = await response.json();
        allPages = data.map(page => ({
            title: page.title || '',
            path: page.path || '',
            accessLevel: (page.accessLevel || 'public').toLowerCase().trim(),
            content: page.content ? page.content.toLowerCase() : ''
        }));

        console.log(`Loaded ${allPages.length} pages.`);
    } catch (err) {
        console.error("Failed to fetch pages:", err);
    }
}

async function handleLogout() {
    try {
        const response = await fetch(`${KRATOS_URL}/self-service/logout/browser`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            window.location.href = data.logout_url;
        }
    } catch (err) {
        console.error("Logout failed", err);
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

function renderAdminBar() {
    const adminBar = document.getElementById('admin-bar');
    if (!adminBar) return;

    adminBar.innerHTML = '';

    const dashboardLink = isAdminUser ? `
        <a href="https://admin.sposlearning.cz/" class="btn btn-sm btn-white pc">Dashboard</a>
        <a href="https://admin.sposlearning.cz/" class="btn btn-sm btn-white ctrl-btn mobile"><span class="icon">team_dashboard</span></a>
    ` : '';

    if (currentUser) {
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

        document.getElementById('logout-button-pc')?.addEventListener('click', handleLogout);
        document.getElementById('logout-button-mob')?.addEventListener('click', handleLogout);
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

    await Promise.all([
        fetchSession(),
        fetchAllPages()
    ]);

    renderAdminBar();

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