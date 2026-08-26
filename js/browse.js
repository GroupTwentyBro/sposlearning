import { CONFIG } from "/js/config.js";
import { getPages, getGradeCookie, getGradeName } from "/js/search.js";

const API_URL = CONFIG.API_URL;

let allPages   = [];   // grade-filtered flat list
let filterTerm = '';

// ─── Grade-aware label ────────────────────────────────────────────────────────

function updateGradeSubtitle() {
    const grade = getGradeCookie();
    const el = document.getElementById('grade-subtitle');
    if (!el) return;
    el.textContent = grade === 0
        ? 'Showing pages for all grades'
        : `Showing pages for ${getGradeName(grade)}`;
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadPages() {
    await getPages(); // warm up the shared fuse cache in search.js

    const res  = await fetch(`${API_URL}/pages`);
    const data = await res.json();
    const grade = getGradeCookie();

    allPages = data
        .filter(p => {
            if ((p.accessLevel || 'public').toLowerCase() === 'admin') return false;
            const g = parseInt(p.grade || 0, 10);
            return g === 0 || g === grade;
        })
        .map(p => ({
            id:    p.id,
            title: p.title || '(untitled)',
            path:  (p.path || '').replace(/^\/|\/$/g, ''),
            grade: parseInt(p.grade || 0, 10)
        }))
        .sort((a, b) => a.path.localeCompare(b.path));

    render();
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

/**
 * Converts a flat page list into a nested tree.
 * ALL path segments except the last are folders.
 * The LAST segment is the page itself — it lives in its parent's _pages array.
 *
 * e.g. "osy/linux/zakladni-prikazy" →
 *   root._children.osy._children.linux._pages = [{ title: "Základní příkazy", ... }]
 */
function buildTree(pages) {
    const root = { _pages: [], _children: {} };

    pages.forEach(page => {
        const segments = page.path.split('/').filter(Boolean);

        if (segments.length === 0) {
            root._pages.push(page);
            return;
        }

        let node = root;
        // Navigate/create folders for every segment except the last
        for (let i = 0; i < segments.length - 1; i++) {
            const seg = segments[i];
            if (!node._children[seg]) {
                node._children[seg] = { _pages: [], _children: {} };
            }
            node = node._children[seg];
        }

        // The page itself is the leaf — add to the parent's _pages
        node._pages.push(page);
    });

    return root;
}

// Recursively count pages in a node (including its index page)
function countPagesInNode(node) {
    let n = (node._pages || []).length + (node._indexPage ? 1 : 0);
    for (const key of Object.keys(node._children || {})) {
        n += countPagesInNode(node._children[key]);
    }
    return n;
}

/**
 * Post-process the tree: if a page in node._pages has the same last path segment
 * as a key in node._children, attach it as _indexPage on that folder instead.
 * This merges e.g. the /fyz file into the FYZ folder header.
 */
function mergeIndexPages(node) {
    const remaining = [];
    for (const page of (node._pages || [])) {
        const segs = page.path.split('/').filter(Boolean);
        const lastSeg = segs[segs.length - 1];
        if (lastSeg && node._children[lastSeg] && !node._children[lastSeg]._indexPage) {
            // Attach as the folder's index page
            node._children[lastSeg]._indexPage = page;
        } else {
            remaining.push(page);
        }
    }
    node._pages = remaining;
    for (const key of Object.keys(node._children || {})) {
        mergeIndexPages(node._children[key]);
    }
}

// ─── DOM rendering ────────────────────────────────────────────────────────────

function render() {
    updateGradeSubtitle();

    const tree      = document.getElementById('browse-tree');
    const statsEl   = document.getElementById('browse-stats');
    const statsText = document.getElementById('browse-stats-text');

    const term = filterTerm.toLowerCase().trim();

    const visible = term
        ? allPages.filter(p =>
            p.title.toLowerCase().includes(term) ||
            p.path.toLowerCase().includes(term))
        : allPages;

    // Stats bar
    statsEl.classList.remove('hidden');
    statsText.textContent = term
        ? `${visible.length} of ${allPages.length} pages match "${filterTerm}"`
        : `${allPages.length} page${allPages.length === 1 ? '' : 's'} available`;

    if (visible.length === 0) {
        tree.innerHTML = `<div class="tree-empty">
            <span class="icon">search_off</span>
            <p>${term ? 'No pages match your filter.' : 'No pages available for this grade.'}</p>
        </div>`;
        return;
    }

    const treeData = buildTree(visible);
    mergeIndexPages(treeData);  // merge /x pages into the x/ folder when both exist

    tree.innerHTML = '';
    renderChildren(treeData, tree, 0, term);
}

/**
 * Render a node's direct children (sub-folders + leaf pages) into a DOM parent.
 * @param {object}  node   - Tree node with _pages and _children
 * @param {Element} parent - DOM element to append into
 * @param {number}  depth  - Nesting depth (0 = top level)
 * @param {string}  term   - Current filter term (for auto-expand + highlight)
 */
function renderChildren(node, parent, depth, term) {
    const folderKeys = Object.keys(node._children || {}).sort();
    const pages      = node._pages || [];

    // Leaf pages first, then sub-folders
    pages.forEach(page => parent.appendChild(makeFileEl(page, depth, term)));
    folderKeys.forEach(key => {
        parent.appendChild(makeFolderEl(key, node._children[key], depth, term));
    });
}

function makeFolderEl(name, node, depth, term) {
    const total     = countPagesInNode(node);
    const indexPage = node._indexPage || null;

    const folderEl = document.createElement('div');
    folderEl.className = `tree-folder${term ? ' open' : ''}`;
    folderEl.dataset.depth = depth;
    folderEl.setAttribute('role', 'treeitem');
    folderEl.setAttribute('aria-expanded', term ? 'true' : 'false');

    const displayName = prettifySegment(name);
    const labelHtml   = term ? highlight(escapeHtml(displayName), term) : escapeHtml(displayName);

    // If this folder has an index page, make the name a navigable link
    const nameEl = indexPage
        ? `<a class="folder-name folder-name-link" href="/${escapeHtml(indexPage.path)}" title="${escapeHtml(indexPage.title)}">${labelHtml}</a>`
        : `<span class="folder-name">${labelHtml}</span>`;

    folderEl.innerHTML = `
        <div class="tree-folder-header">
            <span class="icon folder-toggle-icon">chevron_right</span>
            <span class="icon folder-icon">folder</span>
            ${indexPage ? '<span class="icon folder-file-badge" title="Also has an overview page">description</span>' : ''}
            ${nameEl}
            <span class="folder-count">${total}</span>
        </div>
        <div class="tree-folder-children" role="group"></div>
    `;

    const header   = folderEl.querySelector('.tree-folder-header');
    const children = folderEl.querySelector('.tree-folder-children');
    const fIcon    = folderEl.querySelector('.folder-icon');

    // Prevent the index-page link from also triggering the fold toggle
    folderEl.querySelector('.folder-name-link')?.addEventListener('click', e => e.stopPropagation());

    header.addEventListener('click', () => {
        const isOpen = folderEl.classList.toggle('open');
        folderEl.setAttribute('aria-expanded', String(isOpen));
        fIcon.textContent = isOpen ? 'folder_open' : 'folder';
    });

    renderChildren(node, children, depth + 1, term);

    return folderEl;
}

/**
 * A page leaf — looks like a folder header row but uses a file icon, no arrow, and is a link.
 */
function makeFileEl(page, depth, term) {
    const a = document.createElement('a');
    a.className = 'tree-file';
    a.href  = `/${page.path}`;
    a.title = `/${page.path}`;
    a.setAttribute('role', 'treeitem');
    a.dataset.depth = depth;

    const titleHtml = term
        ? highlight(escapeHtml(page.title), term)
        : escapeHtml(page.title);

    // Depth-keyed colours mirror folder icon colours
    const fileColors = ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#f87171'];
    const color = fileColors[Math.min(depth, fileColors.length - 1)];

    a.innerHTML = `
        <span class="file-arrow-spacer"></span>
        <span class="icon file-icon" style="color:${color}">description</span>
        <span class="file-title">${titleHtml}</span>
    `;
    return a;
}

// ─── Expand / collapse all ────────────────────────────────────────────────────

function setAllFolders(open) {
    document.querySelectorAll('.tree-folder').forEach(el => {
        el.classList.toggle('open', open);
        el.setAttribute('aria-expanded', String(open));
        const icon = el.querySelector('.folder-icon');
        if (icon) icon.textContent = open ? 'folder_open' : 'folder';
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prettifySegment(seg) {
    if (!seg) return seg;
    if (seg.length <= 4) return seg.toUpperCase();
    return seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function highlight(html, term) {
    if (!term) return html;
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return html.replace(new RegExp(`(${esc})`, 'gi'), '<mark class="hl">$1</mark>');
}

// ─── Grade change watcher ─────────────────────────────────────────────────────

function watchGradeChanges() {
    let last = getGradeCookie();
    setInterval(() => {
        const current = getGradeCookie();
        if (current !== last) { last = current; loadPages(); }
    }, 400);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
    const filterInput = document.getElementById('browse-filter');
    const clearBtn    = document.getElementById('browse-filter-clear');

    filterInput?.addEventListener('input', () => {
        filterTerm = filterInput.value;
        clearBtn?.classList.toggle('hidden', !filterTerm);
        render();
    });

    clearBtn?.addEventListener('click', () => {
        filterInput.value = '';
        filterTerm = '';
        clearBtn.classList.add('hidden');
        filterInput.focus();
        render();
    });

    document.getElementById('expand-all-btn')?.addEventListener('click',   () => setAllFolders(true));
    document.getElementById('collapse-all-btn')?.addEventListener('click', () => setAllFolders(false));

    watchGradeChanges();

    try {
        await loadPages();
    } catch (err) {
        document.getElementById('browse-tree').innerHTML = `
            <div class="tree-empty">
                <span class="icon">error</span>
                <p>Failed to load pages. Please try again later.</p>
            </div>`;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
