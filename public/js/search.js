import {app, auth} from './firebaseConfig.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners, applyTheme } from './theming.js';

// --- Global cache ---
const db = getFirestore(app);
let allPages = [];
let currentPage = null;
let currentUser = null;

// --- Elements ---
const searchInput = document.getElementById('search-input');
const welcomeMessage = document.getElementById('welcome-message');
const disclamerInfo = document.getElementById('disclamer-info');
const searchResultsContainer = document.getElementById('search-results');

/**
 * Helper to safely extract access level from messy data
 */
function getAccessLevel(data) {
    const rawValue = data['access-level'] || data['accessLevel'] || data['access_level'] || 'public';
    return String(rawValue).toLowerCase().trim();
}

/**
 * 1. Fetch Pages
 */
async function fetchAllPages() {
    try {
        // Firestore Rules will automatically filter this based on auth status!
        const querySnapshot = await getDocs(collection(db, 'pages'));
        allPages = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // We no longer need to check accessLevel here for security,
            // because if the user wasn't allowed to see it, 'doc' wouldn't exist here.

            if (data.type !== 'redirection') {
                allPages.push({
                    title: data.title,
                    path: data.fullPath,
                    accessLevel: getAccessLevel(data),
                    content: (data.type === 'markdown' || data.type === 'html') ? data.content.toLowerCase() : ''
                });
            }
        });

        searchInput.placeholder = "Hledej v zápisech...";
        searchInput.disabled = false;

    } catch (err) {
        // If the rules are set up correctly, this might trigger if a guest
        // tries to access a restricted collection, but usually, it just returns
        // the allowed documents.
        console.error("Failed to fetch pages:", err);
    }
}
/**
 * 2. Handle Search
 */
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();

    if (searchTerm.length === 0) {
        welcomeMessage.style.display = 'none';
        if(disclamerInfo) disclamerInfo.style.display = 'none';
        searchResultsContainer.style.display = 'block';

        const allVisible = allPages.filter(page => {
            if (page.accessLevel === 'admin' && !currentUser) return false;
            return true;
        });

        renderResults(allVisible);
        return;
    }

    // Basic UI Toggle
    if (searchTerm.length < 2) {
        welcomeMessage.style.display = 'block';
        if(disclamerInfo) disclamerInfo.style.display = 'block';
        searchResultsContainer.style.display = 'none';
        searchResultsContainer.innerHTML = '';
        return;
    }

    // --- KEY FILTERING LOGIC ---

    // A. Pre-calculate paths of pages that match the TITLE
    // We do this first so we don't have to re-scan for every single page.
    const matchedTitlePaths = allPages
        .filter(p => {
            // Security: Don't use a parent path if the user isn't allowed to see that parent
            if (p.accessLevel === 'admin' && !currentUser) return false;
            return p.title.toLowerCase().includes(searchTerm);
        })
        .map(p => p.path);

    // B. Filter the actual results
    const results = allPages.filter(page => {
        // 1. Access Check (Security)
        if (page.accessLevel === 'admin') {
            if (!currentUser) return false;
        }

        // 2. Direct Match Checks
        const matchesPath = page.path.toLowerCase().includes(searchTerm);
        const matchesTitle = page.title.toLowerCase().includes(searchTerm);

        // 3. Parent Logic Check
        // Does this page's path include any of the paths we found in Step A?
        const isChildOfTitleMatch = matchedTitlePaths.some(parentPath =>
            page.path.includes(parentPath)
        );

        return matchesPath || matchesTitle || isChildOfTitleMatch;
    });

    welcomeMessage.style.display = 'none';
    if(disclamerInfo) disclamerInfo.style.display = 'none';
    searchResultsContainer.style.display = 'block';

    renderResults(results);
}

/**
 * 3. Render Results (Tree View)
 */
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
                currentLevel[part] = {
                    children: {},
                    name: part,
                    pageData: null
                };

                // Check if this folder is actually a page itself
                const parentPageExists = allPages.find(p => p.path === currentPathAccumulator);

                // If the parent folder is a page, ensure we respect its privacy too
                if (parentPageExists) {
                    const isHidden = (parentPageExists.accessLevel === 'admin' && !currentUser);
                    if (!isHidden) {
                        currentLevel[part].pageData = parentPageExists;
                    }
                }
            }

            if (index === parts.length - 1) {
                currentLevel[part].pageData = page;
            }

            currentLevel = currentLevel[part].children;
        });
    });

    return root;
}

function createTreeDOM(node) {
    const li = document.createElement('li');
    let contentElement;

    if (node.pageData) {
        contentElement = document.createElement('a');
        contentElement.href = `/${node.pageData.path}`;
        contentElement.className = 'search-result-link';
        contentElement.textContent = node.pageData.title;

        if(node.pageData.accessLevel === 'admin') {
            contentElement.innerHTML += ' <span style="font-size:0.8em; color:red;">(Admin)</span>';
        }
    } else {
        contentElement = document.createElement('span');
        contentElement.className = 'search-result-folder';
        contentElement.textContent = node.name;
    }

    li.appendChild(contentElement);

    const childKeys = Object.keys(node.children);
    if (childKeys.length > 0) {
        const ul = document.createElement('ul');
        childKeys.sort().forEach(key => {
            ul.appendChild(createTreeDOM(node.children[key]));
        });
        li.appendChild(ul);
    }

    return li;
}

function setupAdminTools() {
    const adminBar = document.getElementById('admin-bar');
    const authUiContainer = document.getElementById('auth-ui-container');
    const auth = getAuth(app);

    onAuthStateChanged(auth, (user) => {
        currentUser = user;

        // Reset containers
        authUiContainer.innerHTML = '';
        adminBar.innerHTML = '';

        if (user) {
            // --- USER IS LOGGED IN ---
            // 1. Desktop Admin Buttons
            adminBar.innerHTML = `
                <div class="admin-controls">
                    <div id="logged-in-buttons" style="display: flex; gap: 10px; align-items: center;">
                        <a href="/admin/dashboard" class="btn btn-sm btn-white pc">Dashboard</a>
                        <button class="btn btn-sm btn-danger pc" id="logout-button-pc">Logout</button>
                        
                        <a href="/admin/dashboard" class="btn btn-sm btn-white ctrl-btn mobile">
                            <span class="icon">team_dashboard</span>
                        </a>
                        <button class="btn btn-sm btn-danger ctrl-btn mobile" id="logout-button-mob">
                            <span class="icon">logout</span>
                        </button>
                    </div>
                </div>`;

            // Attach listeners to both logout buttons
            const logoutAction = () => signOut(auth).catch(err => console.error(err));
            document.getElementById('logout-button-pc')?.addEventListener('click', logoutAction);
            document.getElementById('logout-button-mob')?.addEventListener('click', logoutAction);

        } else {
            // --- USER IS A GUEST ---
            // Inject Login buttons with your responsive classes
            authUiContainer.innerHTML = `
                <a href="/login" class="btn btn-sm btn-primary pc">Přihlásit se</a>
                
                <a href="/login" class="btn btn-sm btn-primary ctrl-btn mobile" aria-label="Přihlášení">
                    <span class="icon">login</span>
                </a>
            `;
        }

        // Trigger search refresh if user permissions changed while searching
        if(searchInput.value.length >= 2) {
            searchInput.dispatchEvent(new Event('input'));
        }
    });
}

function initHomeTheming() {
    // 1. Core listeners (handles hue slider and standard buttons)
    initThemeListeners();

    // 2. Multi-toggle logic (Desktop, Mobile, Mike)
    const toggles = [
        { id: "theme-toggle", type: "toggle" },
        { id: "theme-toggle-ctrl", type: "toggle" },
        { id: "mike-toggle", type: "mike" }
    ];

    toggles.forEach(t => {
        const btn = document.getElementById(t.id);
        if (!btn) return;

        btn.addEventListener("click", () => {
            const current = localStorage.getItem("theme");
            if (t.type === "mike") {
                applyTheme("mike");
            } else {
                applyTheme(current === "dark" ? "light" : "dark");
            }
            syncToggleUI();
        });
    });

    syncToggleUI();
}

function syncToggleUI() {
    const isDark = localStorage.getItem("theme") === "dark";
    const pcBtn = document.getElementById("theme-toggle");
    const mobBtn = document.getElementById("theme-toggle-ctrl");

    if (pcBtn) pcBtn.classList.toggle("is-dark", isDark);
    if (mobBtn) mobBtn.classList.toggle("is-dark", isDark);
}

// --- Initialize ---
async function initializePage() {
    setupAdminTools();
    initHomeTheming();
}

initializePage();
fetchAllPages();
searchInput.addEventListener('input', handleSearch);
searchInput.addEventListener('focus', handleSearch);
