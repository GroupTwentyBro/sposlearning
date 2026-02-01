import { app, auth } from './firebaseConfig.js';
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    EmailAuthProvider,
    reauthenticateWithCredential,
    GoogleAuthProvider,
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

// Import modular theming functions
import { initThemeListeners, applyTheme } from './theming.js';

const db = getFirestore(app);
const contentContainer = document.getElementById('wiki-content-container');

// Store the current page data globally for admin tools
let currentPage = null;

/**
 * 1. MARKDOWN CONFIGURATION
 * Custom extension to prevent Marked from breaking MathJax delimiters
 */
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

/**
 * 2. CONTENT LOADING LOGIC
 */
async function loadContent() {
    let fullPath = window.location.pathname.substring(1);
    fullPath = fullPath.replace(/\/+$/, ''); // Clean trailing slashes

    if (fullPath === '') {
        window.location.href = '/';
        return;
    }

    try {
        // Try New ID format (path|to|page)
        const newDocId = fullPath.replace(/\//g, '|');
        const docRef = doc(db, 'pages', newDocId);
        let docSnap = await getDoc(docRef);
        let pageDoc = docSnap;

        // Fallback to Old Query method (field search)
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

        onAuthStateChanged(auth, (user) => {
            // Security Check
            if (accessLevel === "admin" && !user) {
                window.location.href = '/';
                return;
            }

            document.title = pageData.title;

            // Render by Type
            if (pageData.type === 'markdown') {
                contentContainer.innerHTML = marked.parse(pageData.content, { breaks: true });
                contentContainer.classList.add('tex2jax_process');
            } else if (pageData.type === 'html') {
                contentContainer.innerHTML = pageData.content;
            } else if (pageData.type === 'files') {
                renderFileExplorer(pageData.title, pageData.content);
            } else if (pageData.type === 'redirection') {
                const dest = pageData.content;
                dest.startsWith('http') ? window.location.replace(dest) : window.location.href = dest;
            }

            // Trigger Syntax Highlighting
            contentContainer.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));

            // Trigger MathJax
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([contentContainer]).catch(err => console.error(err));
            }
        });

    } catch (error) {
        console.error("Critical Load Error:", error);
        renderError(fullPath);
    }
}

/**
 * 3. UI RENDERING HELPERS
 */
function renderFileExplorer(title, files) {
    const fileListHtml = files.map(file => {
        const size = (file.bytes / 1048576 > 1)
            ? `${(file.bytes / 1048576).toFixed(2)} MB`
            : `${(file.bytes / 1024).toFixed(0)} KB`;

        return `
            <a href="${file.url}" target="_blank" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
               style="background: var(--root-box-bg-clr); color: var(--root-txt-clr); border: 1px solid var(--box-overlay-border-clr); margin-bottom: 5px; border-radius: 8px;">
                ${file.name}
                <span class="badge" style="background: var(--primary-fg-clr); color: white; border-radius: 20px;">${size}</span>
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
        <p>Stránka "<code>${slug}</code>" v databázi neexistuje.</p>
        <a href="/" class="btn btn-primary">Zpět domů</a>`;
}

/**
 * 4. ADMIN TOOLS & DELETION
 */
function setupAdminTools() {
    initThemeListeners(); // Call modular theme setup
    const adminBar = document.getElementById('admin-bar');
    adminBar.innerHTML = `<div class="admin-controls"><div id="logged-in-buttons" style="display: flex; gap: 10px; align-items: center;"></div></div>`;

    onAuthStateChanged(auth, (user) => {
        const loggedInContainer = document.getElementById('logged-in-buttons');
        if (user) {
            let editBtn = (currentPage && (currentPage.data.type === 'markdown' || currentPage.data.type === 'html'))
                ? `<a href="/admin/edit.html?path=${currentPage.data.fullPath}" class="btn btn-sm btn-primary pc">Upravit</a>` : '';

            let deleteBtn = currentPage ? `<button id="delete-button" class="btn btn-sm btn-danger pc">Smazat</button>` : '';

            loggedInContainer.innerHTML = `
                ${editBtn} ${deleteBtn}
                <a href="/admin/dashboard" class="btn btn-sm btn-white pc">Dashboard</a>
                <button class="btn btn-sm btn-danger pc" id="logout-button">Logout</button>
            `;

            document.getElementById('logout-button')?.addEventListener('click', () => signOut(auth).then(() => window.location.reload()));
            document.getElementById('delete-button')?.addEventListener('click', handleDeletePage);
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

// Start everything
async function initializePage() {
    await loadContent();
    setupAdminTools();
    setupFeedbackLink();
}

initializePage();