import { CONFIG } from "/js/config.js";
import { getPages, getGradeCookie, getGradeName } from "/js/search.js";

const API_URL = CONFIG.API_URL;

let allPages    = [];   // full unfiltered list (already grade-filtered)
let filterTerm  = '';

// ─── Grade-aware label ────────────────────────────────────────────────────────

function updateGradeSubtitle() {
    const grade = getGradeCookie();
    const el = document.getElementById('grade-subtitle');
    if (!el) return;
    if (grade === 0) {
        el.textContent = 'Showing pages for all grades';
    } else {
        el.textContent = `Showing pages for ${getGradeName(grade)}`;
    }
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadPages() {
    await getPages();   // populates the shared pages cache in search.js

    // Fetch raw list directly so we can apply our own grade filter
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
 * Convert a flat list of pages with path strings into a nested object tree.
 * e.g. "prg/arrays/basics" → { prg: { arrays: { basics: [pages…] } } }
 */
function buildTree(pages) {
    const root = {};

    pages.forEach(page => {
        const segments = page.path.split('/').filter(Boolean);
        // All segments except the last are folder names;
        // the last segment is the "leaf" label (but we use the page title for display).
        // If there's only one segment (or zero), put it in a synthetic root folder "_root".
        if (segments.length === 0) return;

        let node = root;
        // Traverse / create folder nodes for all-but-last segments
        for (let i = 0; i < segments.length - 1; i++) {
            const seg = segments[i];
            if (!node[seg]) node[seg] = { _pages: [], _children: {} };
            node = node[seg]._children;
        }
        // Last segment is just the "leaf" folder name; page lives there
        const leaf = segments[segments.length - 1];
        if (!node[leaf]) node[leaf] = { _pages: [], _children: {} };
        node[leaf]._pages.push(page);
    });

    return root;
}

// Count total pages recursively inside a node
function countPages(node) {
    let n = (node._pages || []).length;
    for (const key of Object.keys(node).filter(k => k !== '_pages' && k !== '_children')) {
        n += countPages(node[key]);
    }
    for (const key of Object.keys(node._children || {})) {
        n += countPages(node._children[key]);
    }
    return n;
}

// ─── DOM rendering ────────────────────────────────────────────────────────────

function render() {
    updateGradeSubtitle();

    const tree = document.getElementById('browse-tree');
    const statsEl = document.getElementById('browse-stats');
    const statsText = document.getElementById('browse-stats-text');

    const term = filterTerm.toLowerCase().trim();

    // Filter pages by search term (title or path)
    const visible = term
        ? allPages.filter(p =>
            p.title.toLowerCase().includes(term) ||
            p.path.toLowerCase().includes(term))
        : allPages;

    // Stats
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

    tree.innerHTML = '';
    renderNode(treeData, tree, 0, term, true);
}

/**
 * Render a tree node (folder or page) recursively.
 * @param {object} node   - The current tree node object
 * @param {Element} parent - DOM element to append into
 * @param {number} depth  - Nesting depth (0 = top-level)
 * @param {string} term   - Current filter term (for highlighting)
 * @param {boolean} isRoot - Whether we're rendering the root (no wrapper folder)
 */
function renderNode(node, parent, depth, term, isRoot = false) {
    const folderKeys = Object.keys(node).filter(k => k !== '_pages' && k !== '_children');

    if (isRoot) {
        // Top-level: just iterate all folder keys, each becomes a top-level folder card
        folderKeys.sort().forEach(key => {
            const child = node[key];
            const folderEl = makeFolderEl(key, child, depth, term);
            parent.appendChild(folderEl);
        });
        return;
    }

    // Non-root node: render _pages first, then sub-folders
    (node._pages || []).forEach(page => {
        parent.appendChild(makePageEl(page, term));
    });

    // Sub-folders inside _children
    const childKeys = Object.keys(node._children || {}).sort();
    childKeys.forEach(key => {
        const child = node._children[key];
        const folderEl = makeFolderEl(key, child, depth, term);
        parent.appendChild(folderEl);
    });
}

function makeFolderEl(name, node, depth, term) {
    const total = countPagesInNode(node);

    const folderEl = document.createElement('div');
    folderEl.className = `tree-folder${term ? ' open' : ''}`;
    folderEl.setAttribute('data-depth', depth);
    folderEl.setAttribute('role', 'treeitem');
    folderEl.setAttribute('aria-expanded', term ? 'true' : 'false');

    const displayName = prettifySegment(name);
    const highlightedName = term ? highlight(displayName, term) : escapeHtml(displayName);

    folderEl.innerHTML = `
        <div class="tree-folder-header">
            <span class="icon folder-toggle-icon">chevron_right</span>
            <span class="icon folder-icon">folder</span>
            <span class="folder-name">${highlightedName}</span>
            <span class="folder-count">${total}</span>
        </div>
        <div class="tree-folder-children" role="group"></div>
    `;

    const header   = folderEl.querySelector('.tree-folder-header');
    const children = folderEl.querySelector('.tree-folder-children');
    const icon     = folderEl.querySelector('.folder-icon');

    // Click to toggle
    header.addEventListener('click', () => {
        const isOpen = folderEl.classList.toggle('open');
        folderEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        icon.textContent = isOpen ? 'folder_open' : 'folder';
    });

    // Populate children
    renderNode(node, children, depth + 1, term, false);

    return folderEl;
}

function makePageEl(page, term) {
    const a = document.createElement('a');
    a.className = 'tree-page';
    a.href = `/${page.path}`;
    a.setAttribute('role', 'treeitem');
    a.title = page.path;

    const displayTitle = term ? highlight(escapeHtml(page.title), term) : escapeHtml(page.title);

    // Show the last path segment as a hint (helpful when title is generic)
    const pathHint = page.path.split('/').pop() || '';
    const displayHint = term ? highlight(escapeHtml(pathHint), term) : escapeHtml(pathHint);

    a.innerHTML = `
        <span class="page-dot"></span>
        <span class="page-title">${displayTitle}</span>
        <span class="page-path-hint">${displayHint}</span>
    `;
    return a;
}

// Count pages recursively inside a plain node (with _pages and _children)
function countPagesInNode(node) {
    let n = (node._pages || []).length;
    for (const key of Object.keys(node._children || {})) {
        n += countPagesInNode(node._children[key]);
    }
    return n;
}

// ─── Expand / collapse all ────────────────────────────────────────────────────

function setAllFolders(open) {
    document.querySelectorAll('.tree-folder').forEach(el => {
        if (open) {
            el.classList.add('open');
            el.setAttribute('aria-expanded', 'true');
            const icon = el.querySelector('.folder-icon');
            if (icon) icon.textContent = 'folder_open';
        } else {
            el.classList.remove('open');
            el.setAttribute('aria-expanded', 'false');
            const icon = el.querySelector('.folder-icon');
            if (icon) icon.textContent = 'folder';
        }
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Turn a raw path segment into a human-friendly label.
 * e.g. "prg" → "PRG", "pocitacove-site" → "Počítačové sítě" (just capitalise for now)
 */
function prettifySegment(seg) {
    if (!seg) return seg;
    // All-caps short codes (likely subject abbreviations: prg, mat, cj…)
    if (seg.length <= 4) return seg.toUpperCase();
    // Otherwise: replace hyphens with spaces, title-case
    return seg
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function highlight(html, term) {
    if (!term) return html;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return html.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="hl">$1</mark>');
}

// ─── Grade change listener ────────────────────────────────────────────────────

// When the user switches grade via the navbar dropdown, reload the page list.
// We do this by listening for cookie changes — simplest is a small polling check
// or we can hook into the grade buttons directly.
function watchGradeChanges() {
    let lastGrade = getGradeCookie();
    setInterval(() => {
        const current = getGradeCookie();
        if (current !== lastGrade) {
            lastGrade = current;
            loadPages();
        }
    }, 400);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
    // Filter input
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
