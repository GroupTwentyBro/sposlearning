import { auth } from '/js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore,
    serverTimestamp,
    getDoc,
    doc,
    setDoc,
    collection,
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { initThemeListeners } from '/js/theming.js';

// 1. Import your global logger function
import { createServerLog } from '/logs.js';

const CLOUDINARY_CLOUD_NAME = "dmrefvudz";
const CLOUDINARY_UPLOAD_PRESET = "sposlearning-upload-v1";
const db = getFirestore();

let currentPathSelection = "/";
let allPagesCache = [];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            await loadAddPageUI();
            initializeEventListeners();

            initThemeListeners();
            document.querySelector('.dot-container')?.classList.add('hidden');
        } catch (err) {
            console.error("Initialization failed:", err);
        }
    } else {
        window.location.href = '/login';
    }
});

async function loadAddPageUI() {
    const docRef = doc(db, "admin-pages", "add-page");
    const docSnap = await getDoc(docRef);
    const container = document.getElementById('secure-container');

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
    } else {
        container.innerHTML = `<div class="alert alert-danger">Error: UI document 'admin/add_page' not found.</div>`;
        throw new Error("UI document missing");
    }
}

function initializeEventListeners() {
    const pageForm = document.getElementById('page-form');
    const pickPathBtn = document.getElementById('pickpath-button');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalSelectBtn = document.getElementById('modal-select-btn');

    enableTabIndentation(document.getElementById('md-content'));
    enableTabIndentation(document.getElementById('html-content'));

    pageForm.addEventListener('submit', handlePageSubmit);

    pickPathBtn.addEventListener('click', openPathPicker);
    closeModalBtn.addEventListener('click', () => document.getElementById('path-picker-modal').style.display = 'none');
    modalSelectBtn.addEventListener('click', confirmPathSelection);
}

async function handlePageSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('save-button');
    const statusSuccess = document.getElementById('page-success-status');
    const statusError = document.getElementById('page-error-status');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    statusSuccess.textContent = '';
    statusError.textContent = '';

    try {
        let rawInput = document.getElementById('page-path').value.trim();
        if (rawInput.endsWith('/')) rawInput = rawInput.slice(0, -1);

        const lastSlashIndex = rawInput.lastIndexOf('/');
        let path = (lastSlashIndex <= 0) ? '/' : rawInput.substring(0, lastSlashIndex);
        let name = (lastSlashIndex === -1) ? rawInput : rawInput.substring(lastSlashIndex + 1);

        if (!name) throw new Error("Page name is required.");

        const fullPath = (path === '/') ? name : `${path}/${name}`.replace(/^\/+/, '');
        const newDocId = fullPath.replace(/\//g, '|');

        const docRef = doc(db, 'pages', newDocId);
        const existing = await getDoc(docRef);
        if (existing.exists()) throw new Error(`Page already exists at /${fullPath}`);

        const pageData = {
            title: document.getElementById('page-title').value,
            name: name,
            path: path,
            fullPath: fullPath,
            type: 'markdown',
            accessLevel: document.getElementById('page-is-admin').checked ? 'admin' : 'public',
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.email
        };

        if (pageData.type === 'markdown') pageData.content = document.getElementById('md-content').value;

        await setDoc(docRef, pageData);

        // 2. Call the logger with detailed parameters BEFORE the redirect
        await createServerLog('page', `Add Page: ${pageData.title}`, {
            isUser: !!auth.currentUser,
            userEmail: auth.currentUser.email,
            userEmailVerified: auth.currentUser.emailVerified,
            userName: auth.currentUser.displayName || 'none',
            pageAccessLevel: pageData.accessLevel,
            pageContent: pageData.content || 'none', // Logs the raw content
            pageFullPath: pageData.fullPath,
            pageCreatedBy: auth.currentUser.email,
            pageTitle: pageData.title
        });

        statusSuccess.textContent = `Success! Created /${fullPath}`;
        document.getElementById('page-form').reset();

        window.location.href = `https://www.sposlearning.cz/${fullPath}`;
    } catch (err) {
        statusError.textContent = `Error: ${err.message}`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Page';
    }
}

async function openPathPicker() {
    const modal = document.getElementById('path-picker-modal');
    const treeContainer = document.getElementById('path-tree-container');
    modal.style.display = 'flex';
    treeContainer.innerHTML = 'Loading directory...';

    currentPathSelection = "/";
    updateSelectionUI();

    const snapshot = await getDocs(collection(db, 'pages'));
    allPagesCache = snapshot.docs.map(d => d.data().fullPath);
    renderTree();
}

function renderTree() {
    const container = document.getElementById('path-tree-container');
    const paths = [...new Set(allPagesCache.map(p => p.substring(0, p.lastIndexOf('/'))))].filter(p => p !== "");
    paths.push("/");
    paths.sort();

    container.innerHTML = paths.map(p => `
        <div class="path-option" onclick="selectPath('${p}')" style="cursor:pointer; padding:5px; border-bottom:1px solid var(--box-border-clr);">
            <span class="material-symbols-outlined" style="font-size:1.2rem; vertical-align:middle;">folder</span> ${p}
        </div>
    `).join('');

    window.selectPath = (p) => {
        currentPathSelection = p;
        updateSelectionUI();
    };
}

function updateSelectionUI() {
    document.getElementById('modal-selected-path').innerText = currentPathSelection;
}

function confirmPathSelection() {
    let formatted = currentPathSelection.endsWith('/') ? currentPathSelection : currentPathSelection + '/';
    if (!formatted.startsWith('/')) formatted = '/' + formatted;
    document.getElementById('page-path').value = formatted;
    document.getElementById('path-picker-modal').style.display = 'none';
}

async function uploadFilesToCloudinary(files) {
    const uploaded = [];
    for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        uploaded.push({ name: data.original_filename, url: data.secure_url, bytes: data.bytes });
    }
    return uploaded;
}

function enableTabIndentation(textarea) {
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            this.value = this.value.substring(0, start) + '\t' + this.value.substring(this.selectionEnd);
            this.selectionStart = this.selectionEnd = start + 1;
        }
    });
}