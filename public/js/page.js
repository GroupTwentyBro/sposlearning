import { initThemeListeners } from './theming.js';
import { createServerLog } from '/js/logging.js';
import {CONFIG} from "/js/config.js";

const KRATOS_URL = CONFIG.AUTH_URL;
const API_URL = CONFIG.API_URL;

const contentContainer = document.getElementById('wiki-content-container');
let currentPage = null;
let currentUser = null;
let isAdminUser = false;

const mathExtension = {
    name: 'math',
    level: 'inline',
    start(src) { return src.indexOf('$'); },
    tokenizer(src) {
        const blockMatch = /^\$\$\s*([\s\S]*?)\s*\$\$/.exec(src);
        if (blockMatch) return { type: 'text', raw: blockMatch[0], text: blockMatch[0] };
        const inlineMatch = /^\$((?:[^\$\\]|\\.)*)\$/.exec(src);
        if (inlineMatch) return { type: 'text', raw: inlineMatch[0], text: inlineMatch[0] };
    },
    renderer(token) { return token.text; }
};
marked.use({ extensions: [mathExtension] });

async function fetchSession() {
    try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, { credentials: 'include', headers: { 'Accept': 'application/json' } });
        if (res.ok) {
            const session = await res.json();
            currentUser = session.identity;
            isAdminUser = currentUser.metadata_public?.admin === true;
        }
    } catch (e) { console.error("Auth check failed"); }
}

async function loadContent() {
    let fullPath = window.location.pathname.substring(1).replace(/\/+$/, '');
    if (fullPath === '') { window.location.href = '/'; return; }

    try {
        const res = await fetch(`${API_URL}/page-content?path=${encodeURIComponent(fullPath)}`);
        if (!res.ok) { renderError(fullPath); return; }

        const pageData = await res.json();
        currentPage = pageData;
        const accessLevel = (pageData.accessLevel || 'public').toLowerCase();

        if (accessLevel === "admin" && !isAdminUser) {
            window.location.href = '/login';
            return;
        }

        document.title = pageData.title;
        let htmlToRender = "";

        if (pageData.type === 'markdown') {
            htmlToRender = marked.parse(pageData.content, { breaks: true });
            contentContainer.classList.add('tex2jax_process');
        } else if (pageData.type === 'html') {
            htmlToRender = pageData.content;
        } else if (pageData.type === 'files') {
            htmlToRender = getFileExplorerHtml(pageData.title, JSON.parse(pageData.content));
        }

        contentContainer.innerHTML = htmlToRender;
        contentContainer.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
        if (window.MathJax?.typesetPromise) await window.MathJax.typesetPromise([contentContainer]);

        document.querySelector('.dot-container')?.classList.add('hidden');
        contentContainer.classList.add('visible');

    } catch (error) {
        console.error("Load Error:", error);
        renderError(fullPath);
    }
}

async function handleDeletePage() {
    if (!currentPage) return;

    const password = await requestPassword();
    if (!password) return;

    try {
        const loginRes = await fetch(`${KRATOS_URL}/self-service/login/browser?refresh=true`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        const flow = await loginRes.json();

        if (!loginRes.ok) {
            throw new Error(flow.error?.message || "Nelze inicializovat ověření.");
        }

        const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

        const authCheck = await fetch(`${KRATOS_URL}/self-service/login?flow=${flow.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                method: 'password',
                identifier: currentUser.traits.email,
                password: password,
                csrf_token: csrfToken
            }),
            credentials: 'include'
        });

        const authResult = await authCheck.json();
        if (!authCheck.ok) {
            const errorMsg = authResult.ui?.messages?.[0]?.text || "Nesprávné heslo.";
            throw new Error(errorMsg);
        }

        const deleteRes = await fetch(`${API_URL}/page?path=${encodeURIComponent(currentPage.fullPath)}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (deleteRes.ok) {
            await createServerLog('page', `Deleted Page: ${currentPage.title}`, {
                userEmail: currentUser.traits.email,
                pageTitle: currentPage.title
            });
            alert('Smazáno.');
            window.location.href = '/';
        } else {
            const errData = await deleteRes.json();
            throw new Error(errData.error || "Chyba při mazání na serveru.");
        }

    } catch (error) {
        console.error("Delete Flow Error:", error);
        alert('Chyba: ' + error.message);
    }
}

function requestPassword() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('password-modal-overlay');
        const input = document.getElementById('modal-password-input');
        overlay.style.display = 'flex';
        input.value = '';
        input.focus();

        const clean = (val) => { overlay.style.display = 'none'; resolve(val); };

        document.getElementById('modal-confirm-btn').onclick = () => clean(input.value);
        document.getElementById('modal-cancel-btn').onclick = () => clean(null);
        input.onkeydown = (e) => { if (e.key === 'Enter') clean(input.value); };
    });
}

function getFileExplorerHtml(title, files) {
    const fileListHtml = files.map(file => {
        const size = (file.bytes / 1048576 > 1) ? `${(file.bytes / 1048576).toFixed(2)} MB` : `${(file.bytes / 1024).toFixed(0)} KB`;
        return `<a href="${file.url}" target="_blank" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
                style=""https://api.sposlearning.cz"background: var(--root-box-bg-clr); color: var(--root-txt-clr); border: 1px solid var(--box-overlay-border-clr); margin-bottom: 5px; border-radius: 8px;">
                ${file.name} <span class="badge" style="background: var(--primary-fg-clr);">${size}</span></a>`;
    }).join('');
    return `<h1 style="color: var(--primary-hl-clr)">${title}</h1><div class="list-group" style="max-width: 600px;">${fileListHtml}</div>`;
}

function renderError(slug) {
    contentContainer.innerHTML = `<h1>404 - Nenalezeno</h1><hr><p>Stránka <code>${slug}</code> neexistuje.</p><a href="/" class="btn btn-primary">Zpět domů</a>`;
    document.querySelector('.dot-container')?.classList.add('hidden');
    contentContainer.classList.add('visible');
}

async function handleLogout() {
    const res = await fetch(`${KRATOS_URL}/self-service/logout/browser`, { credentials: 'include', headers: { 'Accept': 'application/json' } });
    if (res.ok) { window.location.href = (await res.json()).logout_url; }
}

function setupAdminTools() {
    const adminBar = document.getElementById('admin-bar');
    if (!adminBar) return;
    adminBar.innerHTML = '';

    if (currentUser) {
        let editBtn = (isAdminUser && (currentPage.type === 'markdown' || currentPage.type === 'html'))
            ? `<a href="${CONFIG.ADMIN_URL}/edit.html?path=${currentPage.fullPath}" class="btn btn-sm btn-primary pc">Upravit</a>` : '';
        let deleteBtn = isAdminUser ? `<button id="delete-button" class="btn btn-sm btn-danger pc">Smazat</button>` : '';

        adminBar.innerHTML = `
            <div class="admin-controls">
                <div style="display: flex; gap: 10px; align-items: center;">
                    ${editBtn} ${deleteBtn}
                    <a href="/settings" class="btn btn-sm btn-primary pc">Nastavení</a>
                    <button class="btn btn-sm btn-danger pc" id="logout-btn">Logout</button>
                </div>
            </div>`;
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
        document.getElementById('delete-button')?.addEventListener('click', handleDeletePage);
    } else {
        adminBar.innerHTML = `<div class="admin-controls"><a href="/login" class="btn btn-sm btn-primary">Přihlásit se</a></div>`;
    }
}

async function initializePage() {
    initThemeListeners();
    await fetchSession();
    await loadContent();
    setupAdminTools();
    const fb = document.getElementById("feedback-button");
    if (fb) fb.href += window.location.pathname;
}

initializePage();