import { initThemeListeners } from '/js/theming.js';
import { createServerLog } from '/js/logging.js';

const KRATOS_URL = "https://auth.sposlearning.cz";
const API_URL = "https://api.sposlearning.cz";

let currentUser = null;
let allPagesCache = [];
let currentPathSelection = "/";

// 1. Check Auth with Kratos
async function checkAuth() {
    try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, { credentials: 'include', headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error();
        const session = await res.json();
        currentUser = session.identity;

        // Hide loader and show UI
        document.querySelector('.dot-container')?.classList.add('hidden');
        initializeEventListeners();
    } catch (err) {
        window.location.href = '/login';
    }
}

function initializeEventListeners() {
    const pageForm = document.getElementById('page-form');
    enableTabIndentation(document.getElementById('md-content'));

    pageForm?.addEventListener('submit', handlePageSubmit);
    document.getElementById('pickpath-button')?.addEventListener('click', openPathPicker);
    document.getElementById('close-modal-btn')?.addEventListener('click', () => document.getElementById('path-picker-modal').style.display = 'none');
    document.getElementById('modal-select-btn')?.addEventListener('click', confirmPathSelection);

    initThemeListeners();
}

async function handlePageSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('save-button');
    const statusSuccess = document.getElementById('page-success-status');
    const statusError = document.getElementById('page-error-status');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        let rawPathInput = document.getElementById('page-path').value.trim();
        let title = document.getElementById('page-title').value;
        let isAdmin = document.getElementById('page-is-admin').checked;
        let content = document.getElementById('md-content').value;

        // Clean up path logic
        let fullPath = rawPathInput.replace(/^\/|\/$/g, '');

        const pageData = {
            title: title,
            fullPath: fullPath,
            accessLevel: isAdmin ? 'admin' : 'public',
            content: content,
            type: 'markdown',
            createdBy: currentUser.traits.email
        };

        const res = await fetch(`${API_URL}/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pageData),
            credentials: 'include'
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to save");

        await createServerLog('page', `Added Page: ${title}`, {
            userEmail: currentUser.traits.email,
            pageFullPath: fullPath
        });

        statusSuccess.textContent = `Success! Created /${fullPath}`;
        window.location.href = `/${fullPath}`;

    } catch (err) {
        statusError.textContent = `Error: ${err.message}`;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Page';
    }
}

// Path Picker Logic
async function openPathPicker() {
    const modal = document.getElementById('path-picker-modal');
    const treeContainer = document.getElementById('path-tree-container');
    modal.style.display = 'flex';
    treeContainer.innerHTML = 'Loading...';

    const res = await fetch(`${API_URL}/pages`);
    const pages = await res.json();
    allPagesCache = pages.map(p => p.path);

    renderTree();
}

function renderTree() {
    const container = document.getElementById('path-tree-container');
    // Extract unique directories
    const paths = [...new Set(allPagesCache.map(p => {
        const lastSlash = p.lastIndexOf('/');
        return lastSlash === -1 ? "/" : p.substring(0, lastSlash);
    }))];
    if (!paths.includes("/")) paths.push("/");
    paths.sort();

    container.innerHTML = paths.map(p => `
        <div class="path-option" onclick="window.selectPath('${p}')" style="cursor:pointer; padding:8px; border-bottom:1px solid var(--box-border-clr);">
            <span class="material-symbols-outlined" style="vertical-align:middle;">folder</span> ${p}
        </div>
    `).join('');

    window.selectPath = (p) => {
        currentPathSelection = p;
        document.getElementById('modal-selected-path').innerText = p;
    };
}

function confirmPathSelection() {
    let formatted = currentPathSelection === "/" ? "/" : currentPathSelection + "/";
    document.getElementById('page-path').value = formatted;
    document.getElementById('path-picker-modal').style.display = 'none';
}

function enableTabIndentation(textarea) {
    textarea?.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            this.value = this.value.substring(0, start) + '\t' + this.value.substring(this.selectionEnd);
            this.selectionStart = this.selectionEnd = start + 1;
        }
    });
}

checkAuth();