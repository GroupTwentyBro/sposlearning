// --- Imports ---
import { auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore,
    serverTimestamp,
    getDoc,
    doc,
    setDoc,
    collection,
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ADDED: Modular Theme Imports
import { initThemeListeners, applyTheme } from '../js/theming.js';

// --- !! CONFIGURATION !! ---
const CLOUDINARY_CLOUD_NAME = "dmrefvudz";
const CLOUDINARY_UPLOAD_PRESET = "sposlearning-upload-v1";

// --- Initialize ---
const db = getFirestore();
let currentPathSelection = "/";
let allPagesCache = [];

// --- Get Elements ---
const pageForm = document.getElementById('page-form');
const pageTypeSelect = document.getElementById('page-type');
const saveButton = document.getElementById('save-button');
const editorMarkdown = document.getElementById('editor-markdown');
const editorHTML = document.getElementById('editor-html');
const editorFiles = document.getElementById('editor-files');
const editorRedirection = document.getElementById('editor-redirection');
const pageTitle = document.getElementById('page-title');
const pagePath = document.getElementById('page-path');
const statusSuccess = document.getElementById('page-success-status');
const statusError = document.getElementById('page-error-status');

const pickPathButton = document.getElementById('pickpath-button');
const pathModal = document.getElementById('path-picker-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalTreeContainer = document.getElementById('path-tree-container');
const modalSelectedPathDisplay = document.getElementById('modal-selected-path');
const modalSelectBtn = document.getElementById('modal-select-btn');
const modalNewFolderBtn = document.getElementById('modal-new-folder-btn');

// --- Auth Check ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('Welcome, admin user:', user.email);
        // Page logic is already initialized below
    } else {
        window.location.href = '../admin';
    }
});

// --- Tab Indentation ---
enableTabIndentation(document.getElementById('md-content'));
enableTabIndentation(document.getElementById('html-content'));

// --- Show/Hide Editors ---
pageTypeSelect.addEventListener('change', (e) => {
    const type = e.target.value;
    editorMarkdown.style.display = (type === 'markdown') ? 'block' : 'none';
    editorHTML.style.display = (type === 'html') ? 'block' : 'none';
    editorFiles.style.display = (type === 'files') ? 'block' : 'none';
    editorRedirection.style.display = (type === 'redirection') ? 'block' : 'none';
});

// --- Main Save Logic ---
pageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    statusSuccess.textContent = '';
    statusError.textContent = '';

    try {
        let rawInput = pagePath.value.trim();
        if (rawInput.endsWith('/')) rawInput = rawInput.slice(0, -1);

        const lastSlashIndex = rawInput.lastIndexOf('/');
        let path = '';
        let name = '';

        if (lastSlashIndex === -1) {
            path = '/';
            name = rawInput;
        } else if (lastSlashIndex === 0) {
            path = '/';
            name = rawInput.substring(1);
        } else {
            path = rawInput.substring(0, lastSlashIndex);
            name = rawInput.substring(lastSlashIndex + 1);
        }

        if (!name) throw new Error("You must provide a page name.");

        let fullPath = (path === '/') ? name : `${path}/${name}`;
        fullPath = fullPath.replace(/^\/+/, '');
        const newDocId = fullPath.replace(/\//g, '|');

        const docRef = doc(db, 'pages', newDocId);
        const existingDoc = await getDoc(docRef);
        if (existingDoc.exists()) throw new Error(`Page already exists at: /${fullPath}`);

        const pageData = {
            title: pageTitle.value,
            name: name,
            path: path,
            fullPath: fullPath,
            type: pageTypeSelect.value,
            content: null,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.email
        };

        if (pageData.type === 'markdown') pageData.content = document.getElementById('md-content').value;
        else if (pageData.type === 'html') pageData.content = document.getElementById('html-content').value;
        else if (pageData.type === 'redirection') pageData.content = document.getElementById('redirect-url').value.trim();
        else if (pageData.type === 'files') {
            const fileInput = document.getElementById('file-upload-input');
            pageData.content = fileInput.files.length > 0 ? await uploadFilesToCloudinary(fileInput.files) : [];
        }

        await setDoc(docRef, pageData);
        statusSuccess.textContent = `Success! Page created at /${fullPath}`;
        pageForm.reset();
        pageTypeSelect.dispatchEvent(new Event('change'));

    } catch (error) {
        statusError.textContent = `Error: ${error.message}`;
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Page';
    }
});

// --- Path Picker Logic ---
pickPathButton.addEventListener('click', async (e) => {
    e.preventDefault();
    pathModal.style.display = 'flex';
    modalTreeContainer.innerHTML = 'Loading directory structure...';
    currentPathSelection = "/";
    updateSelectionDisplay();
    await fetchAndBuildTree();
});

closeModalBtn.addEventListener('click', () => pathModal.style.display = 'none');
modalSelectBtn.addEventListener('click', () => {
    let formattedPath = currentPathSelection.replace(/^\/+|\/+$/g, '');
    formattedPath = `/${formattedPath}/`.replace('//', '/');
    pagePath.value = formattedPath;
    pathModal.style.display = 'none';
});

// ... (Rest of your tree building, rendering, and Cloudinary functions are identical to original) ...
// [Skipping redundant tree code for brevity, but it stays exactly as you wrote it]

function updateSelectionDisplay() {
    let display = currentPathSelection;
    if(!display.startsWith('/')) display = '/' + display;
    if(!display.endsWith('/')) display = display + '/';
    modalSelectedPathDisplay.innerText = display;
}

async function uploadFilesToCloudinary(files) {
    const fileList = [];
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, { method: 'POST', body: formData });
        const result = await res.json();
        fileList.push({ name: result.original_filename, url: result.secure_url, bytes: result.bytes, format: result.format });
    }
    return fileList;
}

function enableTabIndentation(textarea) {
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            var start = this.selectionStart;
            var end = this.selectionEnd;
            this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 1;
        }
    });
}

// --- ADDED: THEME INITIALIZATION ---
initThemeListeners();
const toggleBtn = document.getElementById("theme-toggle");
if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
        const current = localStorage.getItem("theme");
        applyTheme(current === "dark" ? "light" : "dark");
        toggleBtn.classList.toggle("is-dark", localStorage.getItem("theme") === "dark");
    });
    toggleBtn.classList.toggle("is-dark", localStorage.getItem("theme") === "dark");
}