import { initThemeListeners } from '/js/theming.js';
import { createServerLog } from '/js/logging.js';

const KRATOS_URL = "https://auth.sposlearning.cz";
const API_URL = "https://api.sposlearning.cz";

let currentUser = null;
let originalPath = "";
let pageType = 'markdown';

async function checkAuth() {
    try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, { credentials: 'include', headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error();
        const session = await res.json();
        currentUser = session.identity;

        if (currentUser.metadata_public?.admin !== true) {
            window.location.href = 'https://www.sposlearning.cz/';
            return;
        }

        await loadPageForEditing();
        initThemeListeners();
        document.querySelector('.dot-container')?.classList.add('hidden');
    } catch (err) {
        window.location.href = 'https://www.sposlearning.cz/login';
    }
}

async function loadPageForEditing() {
    const params = new URLSearchParams(window.location.search);
    const path = params.get('path');
    if (!path) return;
    originalPath = path;

    try {
        const res = await fetch(`${API_URL}/page-content?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error("Page not found");
        const data = await res.json();

        pageType = data.type || 'markdown';
        document.getElementById('page-title').value = data.title;
        document.getElementById('page-url-display').value = `/${data.fullPath}`;
        document.getElementById('page-is-admin').checked = (data.accessLevel === 'admin');

        const mdEditor = document.getElementById('md-content');
        const htmlEditor = document.getElementById('html-content');

        if (pageType === 'markdown') {
            mdEditor.value = data.content;
            document.getElementById('editor-markdown').style.display = 'block';
            enableTabIndentation(mdEditor);
        } else {
            htmlEditor.value = data.content;
            document.getElementById('editor-html').style.display = 'block';
            enableTabIndentation(htmlEditor);
        }

        document.getElementById('edit-form').addEventListener('submit', handleSave);
    } catch (error) {
        document.getElementById('page-status').textContent = `Error: ${error.message}`;
    }
}

async function handleSave(e) {
    e.preventDefault();
    const saveButton = document.getElementById('save-button');
    const status = document.getElementById('page-status');

    const newPath = document.getElementById('page-url-display').value.trim().replace(/^\/|\/$/g, '');
    const newContent = (pageType === 'markdown')
        ? document.getElementById('md-content').value
        : document.getElementById('html-content').value;

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
        const updatedData = {
            title: document.getElementById('page-title').value,
            fullPath: newPath,
            originalPath: originalPath,
            accessLevel: document.getElementById('page-is-admin').checked ? 'admin' : 'public',
            content: newContent,
            lastEditedBy: currentUser.traits.email
        };

        const res = await fetch(`${API_URL}/pages`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData),
            credentials: 'include'
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Save failed");
        }

        await createServerLog('page', `Page Edited: ${updatedData.title}`, {
            userEmail: currentUser.traits.email,
            oldPath: originalPath,
            newPath: newPath
        });

        window.location.href = `https://www.sposlearning.cz/${newPath}`;
    } catch (error) {
        status.innerHTML = `<span class="text-danger">⚠️ ${error.message}</span>`;
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
    }
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

checkAuth();