import {app} from './firebaseConfig.js';
import {getAuth, onAuthStateChanged, signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {applyTheme, initThemeListeners} from './theming.js';

function getGlobalItem(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

const db = getFirestore(app);
let allPages = [];
let currentPage = null;
let currentUser = null;
let isAdminUser = false;

const searchInput = document.getElementById('search-input');
const welcomeMessage = document.getElementById('welcome-message');
const disclamerInfo = document.getElementById('disclamer-info');
const searchResultsContainer = document.getElementById('search-results');

function getAccessLevel(data) {
    const rawValue = data['access-level'] || data['accessLevel'] || data['access_level'] || 'public';
    return String(rawValue).toLowerCase().trim();
}

async function isUserAdmin() {
    if (!currentUser) { return false; }
    const adminDocRef = doc(db, 'administrators', currentUser.uid);
    const adminSnap = await getDoc(adminDocRef);
    return adminSnap.exists();
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
                    accessLevel: getAccessLevel(data),
                    content: (data.type === 'markdown' || data.type === 'html') ? data.content.toLowerCase() : ''
                });
            }
        });

        searchInput.placeholder = "Hledej v zápisech...";
        searchInput.disabled = false;

    } catch (err) {
        console.error("Failed to fetch pages:", err);
    }
}
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();

    if (searchTerm.length === 0) {
        welcomeMessage.style.display = 'none';
        if(disclamerInfo) disclamerInfo.style.display = 'none';
        searchResultsContainer.style.display = 'block';

        const allVisible = allPages.filter(page => {
            if (page.accessLevel === 'admin' && !isAdminUser) return false;
            return true;
        });

        renderResults(allVisible);
        return;
    }

    if (searchTerm.length < 2) {
        welcomeMessage.style.display = 'block';
        if(disclamerInfo) disclamerInfo.style.display = 'block';
        searchResultsContainer.style.display = 'none';
        searchResultsContainer.innerHTML = '';
        return;
    }

    const matchedTitlePaths = allPages
        .filter(p => {
            if (p.accessLevel === 'admin' && !isAdminUser) return false;
            return p.title.toLowerCase().includes(searchTerm);
        })
        .map(p => p.path);

    const results = allPages.filter(page => {
        if (page.accessLevel === 'admin') {
            if (!isAdminUser) return false;
        }

        const matchesPath = page.path.toLowerCase().includes(searchTerm);
        const matchesTitle = page.title.toLowerCase().includes(searchTerm);

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

                const parentPageExists = allPages.find(p => p.path === currentPathAccumulator);

                if (parentPageExists) {
                    const isHidden = (parentPageExists.accessLevel === 'admin' && !isAdminUser);
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
            contentElement.innerHTML += ' <span style="font-size:0.8em; color:red;"> (Admin)</span>';
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

async function setupAdminTools() {
    const adminBar = document.getElementById('admin-bar');
    if(!adminBar) return;

    const auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        adminBar.innerHTML = '';
        isAdminUser = await isUserAdmin();

        if (user) {

            adminBar.innerHTML = `
                <div class="admin-controls">
                    <div id="logged-in-buttons" style="display: flex; gap: 10px; align-items: center;">
                        
                        ${isAdminUser ? `
                            <a href="https://admin.sposlearning.cz/" class="btn btn-sm btn-white pc">Dashboard</a>
                            <a href="https://admin.sposlearning.cz/" class="btn btn-sm btn-white ctrl-btn mobile">
                                <span class="icon">team_dashboard</span>
                            </a>
                        ` : ''}

                        <button class="btn btn-sm btn-danger pc" id="logout-button-pc">Logout</button>
                        <button class="btn btn-sm btn-danger ctrl-btn mobile" id="logout-button-mob">
                            <span class="icon">logout</span>
                        </button>
                        
                    </div>
                </div>`;

            const performLogout = () => signOut(auth).catch(err => console.error(err));
            document.getElementById('logout-button-pc')?.addEventListener('click', performLogout);
            document.getElementById('logout-button-mob')?.addEventListener('click', performLogout);

        } else {
            adminBar.innerHTML = `
                <div class="admin-controls">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <a href="/login" class="btn btn-sm btn-primary pc">Přihlásit se</a>
                        <a href="/login" class="btn btn-sm btn-primary ctrl-btn mobile" aria-label="Přihlášení">
                            <span class="icon">login</span>
                        </a>
                    </div>
                </div>`;
        }

        if(searchInput.value.length >= 2) {
            searchInput.dispatchEvent(new Event('input'));
        }
    });
}

function initHomeTheming() {
    initThemeListeners();

    const toggles = [
        { id: "theme-toggle", type: "toggle" },
        { id: "theme-toggle-ctrl", type: "toggle" }
    ];

    toggles.forEach(t => {
        const btn = document.getElementById(t.id);
        if (!btn) return;

        btn.addEventListener("click", () => {
            const current = getGlobalItem("theme") || "dark";
            document.body.style.setProperty("transition", "ease 350ms");

            applyTheme(current === "dark" ? "light" : "dark");
            syncToggleUI();
        });
    });

    syncToggleUI();
    document.body.style.setProperty("transition", "none")
}

function syncToggleUI() {
    const currentTheme = getGlobalItem("theme") || "dark";
    const isDark = currentTheme === "dark";

    const pcBtn = document.getElementById("theme-toggle");
    const mobBtn = document.getElementById("theme-toggle-ctrl");

    if (pcBtn) pcBtn.classList.toggle("is-dark", isDark);
    if (mobBtn) mobBtn.classList.toggle("is-dark", isDark);
}

async function initializePage() {
    setupAdminTools();
    initHomeTheming();
}

function hideResults() {
    setTimeout(() => {
        searchResultsContainer.style.display = 'none';

        if (welcomeMessage) welcomeMessage.style.display = 'block';
        if (disclamerInfo) disclamerInfo.style.display = 'block';
    }, 200);
}

initializePage();
fetchAllPages();
searchInput.addEventListener('input', handleSearch);
searchInput.addEventListener('focus', handleSearch);
searchInput.addEventListener('focusout', hideResults);
