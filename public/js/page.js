import { app, auth } from './firebaseConfig.js';
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    EmailAuthProvider,
    reauthenticateWithCredential,
    GoogleAuthProvider,
    GithubAuthProvider,
    reauthenticateWithPopup
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore,
    collection,
    query,
    where,
    getDoc,
    getDocs,
    doc,
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { initThemeListeners, applyTheme } from './theming.js';

const db = getFirestore(app);
const contentContainer = document.getElementById('wiki-content-container');
let currentPage = null;

/** 1. MARKDOWN CONFIGURATION **/
const mathExtension = {
    name: 'math',
    level: 'inline',
    start(src) { return src.indexOf('$'); },
    tokenizer(src) {
        const blockRule = /^\$\$\s*([\s\S]*?)\s*\$\$/;
        const blockMatch = blockRule.exec(src);
        if (blockMatch) return { type: 'text', raw: blockMatch[0], text: blockMatch[0] };

        const inlineRule = /^\$((?:[^\$\\]|\\.)*)\$/;
        const inlineMatch = inlineRule.exec(src);
        if (inlineMatch) return { type: 'text', raw: inlineMatch[0], text: inlineMatch[0] };
    },
    renderer(token) { return token.text; }
};
marked.use({ extensions: [mathExtension] });

/** 2. CONTENT LOADING **/
async function loadContent() {
    let fullPath = window.location.pathname.substring(1).replace(/\/+$/, '');
    if (fullPath === '') { window.location.href = '/'; return; }

    try {
        const newDocId = fullPath.replace(/\//g, '|');
        const docRef = doc(db, 'pages', newDocId);
        let docSnap = await getDoc(docRef);
        let pageDoc = docSnap;

        if (!docSnap.exists()) {
            const q = query(collection(db, 'pages'), where("fullPath", "==", fullPath));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) pageDoc = querySnapshot.docs[0];
        }

        if (!pageDoc.exists()) { renderError(fullPath); return; }

        const pageData = pageDoc.data();
        currentPage = { id: pageDoc.id, data: pageData };
        const accessLevel = (pageData['accessLevel'] || 'public').toLowerCase();

        onAuthStateChanged(auth, async (user) => {
            if (accessLevel === "admin" && !user) { window.location.href = '/'; return; }
            document.title = pageData.title;

            let htmlToRender = "";
            if (pageData.type === 'markdown') {
                htmlToRender = marked.parse(pageData.content, {breaks: true});
                contentContainer.classList.add('tex2jax_process');
            } else if (pageData.type === 'html') {
                htmlToRender = pageData.content;
            }

            contentContainer.innerHTML = htmlToRender;
            contentContainer.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
            if (window.MathJax?.typesetPromise) await window.MathJax.typesetPromise([contentContainer]);

            const loader = document.querySelector('.dot-container');
            if (loader) loader.classList.add('hidden');
            contentContainer.classList.add('visible');
        });
    } catch (error) {
        renderError(fullPath);
    }
}

/** 3. ADMIN TOOLS LOGIC **/
function setupAdminTools() {
    const adminBar = document.getElementById('admin-bar');
    if(!adminBar) return;

    onAuthStateChanged(auth, async (user) => {
        adminBar.innerHTML = '';
        if (!user) {
            adminBar.innerHTML = `
                <div class="admin-controls">
                    <a href="/login" class="btn btn-sm btn-primary pc">Přihlásit se</a>
                    <a href="/login" class="btn btn-sm btn-primary ctrl-btn mobile"><span class="icon">login</span></a>
                </div>`;
            return;
        }

        const adminDocRef = doc(db, 'administrators', user.uid);
        const adminSnap = await getDoc(adminDocRef);
        const isAdmin = adminSnap.exists();

        if (!isAdmin) {
            adminBar.innerHTML = `
                <div class="admin-controls">
                    <button class="btn btn-sm btn-danger pc" id="logout-button-pc">Logout</button>
                    <button class="btn btn-sm btn-danger ctrl-btn mobile" id="logout-button-mob"><span class="icon">logout</span></button>
                </div>`;
        } else {
            const editBtnPc = (currentPage && (currentPage.data.type === 'markdown' || currentPage.data.type === 'html'))
                ? `<a href="/admin/edit.html?path=${currentPage.data.fullPath}" class="btn btn-sm btn-primary pc">Upravit</a>` : '';

            const editBtnMob = (currentPage && (currentPage.data.type === 'markdown' || currentPage.data.type === 'html'))
                ? `<a href="/admin/edit.html?path=${currentPage.data.fullPath}" class="btn btn-sm btn-primary ctrl-btn"><span class="icon">edit</span></a>` : '';

            const deleteBtnPc = currentPage ? `<button id="delete-button-pc" class="btn btn-sm btn-danger pc">Smazat</button>` : '';
            const deleteBtnMob = currentPage ? `<button id="delete-button-mob" class="btn btn-sm btn-danger ctrl-btn"><span class="icon">delete</span></button>` : '';

            adminBar.innerHTML = `
                <div class="admin-controls">
                    <div class="pc" style="display: flex; gap: 10px;">
                        ${editBtnPc} ${deleteBtnPc}
                        <a href="/admin/dashboard" class="btn btn-sm btn-white">Dashboard</a>
                        <button class="btn btn-sm btn-danger" id="logout-button-pc">Logout</button>
                    </div>

                    <div class="mobile-admin-wrapper mobile">
                        <div id="mobile-admin-menu" class="admin-menu-vertical">
                            ${editBtnMob}
                            ${deleteBtnMob}
                            <a href="/admin/dashboard" class="btn btn-sm btn-white ctrl-btn"><span class="icon">team_dashboard</span></a>
                            <button class="btn btn-sm btn-danger ctrl-btn" id="logout-button-mob"><span class="icon">logout</span></button>
                        </div>
                        <button id="mobile-admin-toggle" class="btn btn-sm btn-primary ctrl-btn">
                            <span class="icon">settings</span>
                        </button>
                    </div>
                </div>`;

            // Setup Mobile Toggle Event
            const toggle = document.getElementById('mobile-admin-toggle');
            const menu = document.getElementById('mobile-admin-menu');
            toggle?.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('show');
                toggle.classList.toggle('active');
            });

            // Close on outside click
            document.addEventListener('click', () => {
                menu?.classList.remove('show');
                toggle?.classList.remove('active');
            });

            document.getElementById('delete-button-pc')?.addEventListener('click', handleDeletePage);
            document.getElementById('delete-button-mob')?.addEventListener('click', handleDeletePage);
        }

        const performLogout = () => signOut(auth).then(() => window.location.reload());
        document.getElementById('logout-button-pc')?.addEventListener('click', performLogout);
        document.getElementById('logout-button-mob')?.addEventListener('click', performLogout);
    });
}

/** 4. REMAINING HELPERS (Deletion, Theme Sync, etc.) **/
async function handleDeletePage() {
    if (!currentPage) return;
    const user = auth.currentUser;
    const providerId = user.providerData[0]?.providerId;
    try {
        if (providerId === 'google.com' || providerId === 'github.com') {
            await reauthenticateWithPopup(user, providerId === 'google.com' ? new GoogleAuthProvider() : new GithubAuthProvider());
        } else {
            const password = await requestPassword();
            if (!password) return;
            await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
        }
        await deleteDoc(doc(db, 'pages', currentPage.id));
        window.location.href = '/';
    } catch (e) { alert(e.message); }
}

function requestPassword() {
    return new Promise((res) => {
        const overlay = document.getElementById('password-modal-overlay');
        overlay.style.display = 'flex';
        document.getElementById('modal-confirm-btn').onclick = () => { overlay.style.display='none'; res(document.getElementById('modal-password-input').value); };
        document.getElementById('modal-cancel-btn').onclick = () => { overlay.style.display='none'; res(null); };
    });
}

function renderError(slug) {
    contentContainer.innerHTML = `<h1>404</h1><p>Stránka ${slug} neexistuje.</p><a href="/">Zpět</a>`;
}

function setupFeedbackLink() {
    const btn = document.getElementById("feedback-button");
    if (btn) btn.href += window.location.pathname;
}

function initHomeTheming() {
    initThemeListeners();
    const toggles = ["theme-toggle", "theme-toggle-ctrl", "mike-toggle"];
    toggles.forEach(id => {
        document.getElementById(id)?.addEventListener("click", () => {
            const current = localStorage.getItem("theme");
            applyTheme(id === "mike-toggle" ? "mike" : (current === "dark" ? "light" : "dark"));
            syncToggleUI();
        });
    });
    syncToggleUI();
}

function syncToggleUI() {
    const isDark = localStorage.getItem("theme") === "dark";
    document.getElementById("theme-toggle")?.classList.toggle("is-dark", isDark);
    document.getElementById("theme-toggle-ctrl")?.classList.toggle("is-dark", isDark);
}

async function initializePage() {
    await loadContent();
    setupAdminTools();
    setupFeedbackLink();
    initHomeTheming();
}
initializePage();