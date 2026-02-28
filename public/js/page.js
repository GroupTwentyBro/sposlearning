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

function getGlobalItem(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

const db = getFirestore(app);
const contentContainer = document.getElementById('wiki-content-container');

let currentPage = null;

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

async function loadContent() {
    let fullPath = window.location.pathname.substring(1);
    fullPath = fullPath.replace(/\/+$/, '');

    if (fullPath === '') {
        window.location.href = '/';
        return;
    }

    try {
        const newDocId = fullPath.replace(/\//g, '|');
        const docRef = doc(db, 'pages', newDocId);
        let docSnap = await getDoc(docRef);
        let pageDoc = docSnap;

        if (!docSnap.exists()) {
            const q = query(collection(db, 'pages'), where("fullPath", "==", fullPath));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                pageDoc = querySnapshot.docs[0];
            }
        }

        if (!pageDoc.exists()) {
            renderError(fullPath);
            return;
        }

        const pageData = pageDoc.data();
        currentPage = { id: pageDoc.id, data: pageData };

        const accessLevel = (pageData['accessLevel'] || pageData['access-level'] || 'public').toLowerCase();

        onAuthStateChanged(auth, async (user) => {
            if (accessLevel === "admin" && !user) {
                window.location.href = '/';
                return;
            }

            document.title = pageData.title;

            let htmlToRender = "";
            if (pageData.type === 'markdown') {
                htmlToRender = marked.parse(pageData.content, {breaks: true});
                contentContainer.classList.add('tex2jax_process');
            } else if (pageData.type === 'html') {
                htmlToRender = pageData.content;
            } else if (pageData.type === 'files') {
                htmlToRender = getFileExplorerHtml(pageData.title, pageData.content);
            }

            contentContainer.innerHTML = htmlToRender;

            contentContainer.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
            if (window.MathJax && window.MathJax.typesetPromise) {
                await window.MathJax.typesetPromise([contentContainer]);
            }

            const loader = document.querySelector('.dot-container');
            if (loader) {
                loader.classList.add('hidden');
            }
            contentContainer.classList.add('visible');
        });

    } catch (error) {
        console.error("Critical Load Error:", error);
        renderError(fullPath);
    }
}

function renderFileExplorer(title, files) {
    const fileListHtml = files.map(file => {
        const size = (file.bytes / 1048576 > 1)
            ? `${(file.bytes / 1048576).toFixed(2)} MB`
            : `${(file.bytes / 1024).toFixed(0)} KB`;

        return `
            <a href="${file.url}" target="_blank" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
               style="background: var(--root-box-bg-clr); color: var(--root-txt-clr); border: 1px solid var(--box-overlay-border-clr); margin-bottom: 5px; border-radius: 8px;">
                ${file.name}
                <span class="badge" style="background: var(--primary-fg-clr); color: white; border-radius: var(--box-border-radius);">${size}</span>
            </a>`;
    }).join('');

    contentContainer.innerHTML = `
        <h1 style="color: var(--primary-hl-clr)">${title}</h1>
        <p style="color: var(--root-fgd-clr)">Dostupné soubory:</p>
        <div class="list-group" style="max-width: 600px;">${fileListHtml}</div>`;
}

function renderError(slug) {
    contentContainer.innerHTML = `
        <h1>404 - Nenalezeno</h1>
        <hr>
        <p>Stránka <code>${slug}</code> v databázi neexistuje.</p>
        <a href="/" class="btn btn-primary">Zpět domů</a>`;

    const loader = document.querySelector('.dot-container');
    if (loader) {
        loader.classList.add('hidden');
    }
    contentContainer.classList.add('visible');
}

function setupAdminTools() {
    const adminBar = document.getElementById('admin-bar');
    if(!adminBar) return;

    onAuthStateChanged(auth, async (user) => {
        adminBar.innerHTML = '';

        if (user) {
            const adminDocRef = doc(db, 'administrators', user.uid);
            const adminSnap = await getDoc(adminDocRef);
            const isAdmin = adminSnap.exists();

            if (!isAdmin) {
                adminBar.innerHTML = `
                    <div class="admin-controls">
                        <button class="btn btn-sm btn-danger pc" id="logout-button-pc">Logout</button>
                        <button class="btn btn-sm btn-danger ctrl-btn mobile" id="logout-button-mob">
                            <span class="icon">logout</span>
                        </button>
                    </div>`;
            } else {
                let editBtn = (currentPage && (currentPage.data.type === 'markdown' || currentPage.data.type === 'html'))
                    ? `<a href="https://admin.sposlearning.cz/edit.html?path=${currentPage.data.fullPath}" class="btn btn-sm btn-primary pc">Upravit</a>` : '';

                let deleteBtn = currentPage ? `<button id="delete-button" class="btn btn-sm btn-danger pc">Smazat</button>` : '';

                adminBar.innerHTML = `
                    <div class="admin-controls">
                        <div id="logged-in-buttons" style="display: flex; gap: 10px; align-items: center;">
                            ${editBtn} 
                            ${deleteBtn}
                            <a href="https://admin.sposlearning.cz/" class="btn btn-sm btn-white pc">Dashboard</a>
                            <button class="btn btn-sm btn-danger pc" id="logout-button-pc">Logout</button>
                            
                            <a href="https://admin.sposlearning.cz/" class="btn btn-sm btn-white ctrl-btn mobile">
                                <span class="icon">team_dashboard</span>
                            </a>
                            <button class="btn btn-sm btn-danger ctrl-btn mobile" id="logout-button-mob">
                                <span class="icon">logout</span>
                            </button>
                        </div>
                    </div>`;

                document.getElementById('delete-button')?.addEventListener('click', handleDeletePage);
            }

            const performLogout = () => signOut(auth).then(() => window.location.reload());
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
    });
}

async function handleDeletePage() {
    if (!currentPage) return;
    const user = auth.currentUser;
    const providerId = user.providerData[0]?.providerId;

    try {
        if (providerId === 'google.com') {
            await reauthenticateWithPopup(user, new GoogleAuthProvider());
        } else if (providerId === 'github.com') {
            await reauthenticateWithPopup(user, new GithubAuthProvider());
        } else {
            const password = await requestPassword();
            if (!password) return;
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
        }

        await deleteDoc(doc(db, 'pages', currentPage.id));
        alert('Smazáno.');
        window.location.href = '/';
    } catch (error) {
        console.error(error);
        alert('Chyba při ověřování: ' + error.message);
    }
}

function requestPassword() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('password-modal-overlay');
        const input = document.getElementById('modal-password-input');
        overlay.style.display = 'flex';
        input.focus();

        const clean = (val) => {
            overlay.style.display = 'none';
            resolve(val);
        };

        document.getElementById('modal-confirm-btn').onclick = () => clean(input.value);
        document.getElementById('modal-cancel-btn').onclick = () => clean(null);
        input.onkeydown = (e) => { if (e.key === 'Enter') clean(input.value); };
    });
}

function setupFeedbackLink() {
    const feedbackLink = document.getElementById("feedback-button");
    if (feedbackLink) feedbackLink.href += window.location.pathname;
}

function initHomeTheming() {
    initThemeListeners();

    const toggles = [
        { id: "theme-toggle", type: "toggle" },
        { id: "theme-toggle-ctrl", type: "toggle" },
        { id: "mike-toggle", type: "mike" }
    ];

    toggles.forEach(t => {
        const btn = document.getElementById(t.id);
        if (!btn) return;

        btn.addEventListener("click", () => {
            const current = getGlobalItem("theme") || "dark";

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
    const currentTheme = getGlobalItem("theme") || "dark";
    const isDark = currentTheme === "dark";

    const pcBtn = document.getElementById("theme-toggle");
    const mobBtn = document.getElementById("theme-toggle-ctrl");

    if (pcBtn) pcBtn.classList.toggle("is-dark", isDark);
    if (mobBtn) mobBtn.classList.toggle("is-dark", isDark);
}

async function initializePage() {
    await loadContent();
    setupAdminTools();
    setupFeedbackLink();
    initHomeTheming();
}

initializePage();