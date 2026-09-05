import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken } from "/js/auth.js";
import { getGradeCookie } from "/js/search.js";

const API_URL = CONFIG.API_URL;

const skeletonLoader = document.getElementById('skeleton-loader');
const tocSidebar = document.getElementById('toc-sidebar');
const tocContent = document.getElementById('toc-content');
const mainContent = document.getElementById('main-content');
const articleContent = document.getElementById('article-content');
const errorContainer = document.getElementById('error-container');
const breadcrumbsDiv = document.getElementById('breadcrumbs');
const editButton = document.getElementById('edit-button');
const metadataSidebar = document.getElementById('metadata-sidebar');
const metaAddedBy = document.getElementById('meta-added-by');
const metaAddedDate = document.getElementById('meta-added-date');
const metaEditedBy = document.getElementById('meta-edited-by');
const metaEditedDate = document.getElementById('meta-edited-date');

let currentPage = null;
let currentUser = null;
let isAdminUser = false;
let allHeadings = [];

async function fetchSession() {
    try {
        const loggedIn = await initAuth();
        if (loggedIn) {
            currentUser = getUser();
            isAdminUser = currentUser.roles.includes("admin");
            if (isAdminUser && editButton) {
                editButton.classList.remove("nd");
            }
        }
    } catch (e) {
        console.error("Auth check failed");
    }
}

async function loadContent() {
    let fullPath = window.location.pathname.substring(1).replace(/\/+$/, '');

    if (fullPath === '') {
        window.location.href = '/';
        return;
    }

    try {
        const selectedGrade = getGradeCookie();
        
        const fetchOptions = {};
        if (currentUser) {
            try {
                const token = await getAccessToken();
                fetchOptions.headers = { 'Authorization': `Bearer ${token}` };
            } catch (e) {
                console.warn("Failed to get token for page content request", e);
            }
        }

        const res = await fetch(`${API_URL}/page-content?path=${encodeURIComponent(fullPath)}&grade=${selectedGrade}`, fetchOptions);

        if (!res.ok) {
            renderError(fullPath);
            return;
        }

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
            let mathBlocks = [];
            let processedMarkdown = pageData.content.replace(/!\[(.*?)\]\((.*?)\)\{width=(.*?) height=(.*?)\}/g, (match, alt, url, w, h) => {
                return `<img src="${url}" alt="${alt}" style="width:${w}; height:${h}; max-width: 100%;" />`;
            });

            processedMarkdown = processedMarkdown.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
                mathBlocks.push(match);
                return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
            });
            processedMarkdown = processedMarkdown.replace(/\\\[([\s\S]+?)\\\]/g, (match) => {
                mathBlocks.push(match);
                return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
            });
            processedMarkdown = processedMarkdown.replace(/\\\((.+?)\\\)/g, (match) => {
                mathBlocks.push(match);
                return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
            });
            processedMarkdown = processedMarkdown.replace(/\$([^\$\n]+?)\$/g, (match) => {
                mathBlocks.push(match);
                return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
            });
            processedMarkdown = processedMarkdown.replace(/\\begin\{([a-zA-Z0-9*]+)\}([\s\S]+?)\\end\{\1\}/g, (match) => {
                mathBlocks.push(match);
                return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
            });

            // Custom renderer: strip spurious leading/trailing newlines from code blocks
            // that breaks:true can inject into <pre> content.
            const renderer = new marked.Renderer();
            renderer.code = function({ text, lang }) {
                const language = lang || '';
                const langClass = language ? ` class="language-${language}"` : '';
                // Trim only the outermost leading/trailing newline added by marked
                const cleanCode = text.replace(/^\n/, '').replace(/\n$/, '');
                const escaped = cleanCode
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                return `<pre><code${langClass}>${escaped}</code></pre>\n`;
            };

            htmlToRender = marked.parse(processedMarkdown, { breaks: true, renderer });
            
            htmlToRender = htmlToRender.replace(/@@MATH_BLOCK_(\d+)@@/g, (match, p1) => {
                return mathBlocks[parseInt(p1, 10)];
            });
            
            articleContent.classList.add('tex2jax_process');
        } else {
            htmlToRender = pageData.content;
        }

        articleContent.innerHTML = htmlToRender;

        articleContent.querySelectorAll('pre code').forEach((block) => {
            // Dedent: strip common leading whitespace from all lines so that
            // code stored with extra indentation in the HTML renders correctly.
            const raw = block.textContent;
            const lines = raw.split('\n');
            const nonEmpty = lines.filter(l => l.trim().length > 0);
            if (nonEmpty.length > 0) {
                const minIndent = Math.min(
                    ...nonEmpty.map(l => (l.match(/^(\s*)/) || ['', ''])[1].length)
                );
                if (minIndent > 0) {
                    block.textContent = lines
                        .map(l => l.slice(minIndent))
                        .join('\n')
                        .replace(/^\n/, '')
                        .replace(/\n$/, '');
                }
            }
            hljs.highlightElement(block);
        });

        if (window.MathJax?.typesetPromise) {
            await window.MathJax.typesetPromise([articleContent]);
        }

        generateTableOfContents();

        updateBreadcrumbs(pageData.title, fullPath);

        // Populate metadata sidebar
        if (metaAddedBy) metaAddedBy.textContent = pageData.createdBy || '-';
        if (metaAddedDate) {
            metaAddedDate.textContent = pageData.createdAt ? new Date(pageData.createdAt).toLocaleString('cs-CZ') : '-';
        }
        if (metaEditedBy) metaEditedBy.textContent = pageData.lastEditedBy || '-';
        if (metaEditedDate) {
            metaEditedDate.textContent = pageData.lastEditedAt ? new Date(pageData.lastEditedAt).toLocaleString('cs-CZ') : '-';
        }
        
        if (metadataSidebar) metadataSidebar.classList.remove('hidden');

        hideSkeletonLoader();
        showContent();

    } catch (error) {
        console.error("Load Error:", error);
        renderError(fullPath);
    }
}

function generateTableOfContents() {
    allHeadings = [];
    const headings = articleContent.querySelectorAll('h1, h2, h3');

    if (headings.length <= 1) {
        tocSidebar.classList.add('hidden');
        return;
    }

    tocSidebar.classList.remove('hidden');
    tocContent.innerHTML = '';

    headings.forEach((heading, index) => {
        const level = heading.tagName.toLowerCase();
        const id = heading.id || `heading-${index}`;
        heading.id = id;

        const link = document.createElement('a');
        link.href = `#${id}`;
        link.className = `toc-item level-${level.charAt(1)}`;
        link.textContent = heading.textContent;

        link.addEventListener('click', (e) => {
            e.preventDefault();
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        tocContent.appendChild(link);
        allHeadings.push({ element: heading, link: link, id: id });
    });

    updateActiveTocItem();
    window.addEventListener('scroll', updateActiveTocItem);
}

function updateActiveTocItem() {
    let current = null;

    for (let heading of allHeadings) {
        const rect = heading.element.getBoundingClientRect();
        if (rect.top <= 100) {
            current = heading;
        } else {
            break;
        }
    }

    allHeadings.forEach(item => item.link.classList.remove('active'));
    if (current) {
        current.link.classList.add('active');
    }
}

function updateBreadcrumbs(title, fullPath) {
    breadcrumbsDiv.innerHTML = '';

    const parts = fullPath.split('/').filter(p => p);

    const homeDiv = document.createElement('div');
    homeDiv.className = 'crumb-item';
    homeDiv.innerHTML = `<a href="/" title="Home">Home</a><span class="separator">/</span>`;
    breadcrumbsDiv.appendChild(homeDiv);

    let current = '';
    parts.slice(0, -1).forEach((part) => {
        current += '/' + part;

        const formattedName = part
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        const item = document.createElement('div');
        item.className = 'crumb-item';
        item.innerHTML = `<a href="${current}" title="${escapeHtml(formattedName)}">${escapeHtml(formattedName)}</a><span class="separator">/</span>`;
        breadcrumbsDiv.appendChild(item);
    });

    const currentDiv = document.createElement('div');
    currentDiv.className = 'crumb-item current-crumb';
    currentDiv.innerHTML = `<span class="current" title="${escapeHtml(title)}">${escapeHtml(title)}</span>`;
    breadcrumbsDiv.appendChild(currentDiv);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function hideSkeletonLoader() {
    skeletonLoader.classList.add('hidden');
}

function showContent() {
    mainContent.classList.remove('hidden');
}

function renderError(slug) {
    const pageWrapper = document.getElementById('page-wrapper');
    if (pageWrapper) pageWrapper.classList.add('hidden');
    mainContent.classList.add('hidden');
    if (metadataSidebar) metadataSidebar.classList.add('hidden');
    skeletonLoader.classList.add('hidden');

    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = `The page "${slug}" does not exist.`;

    errorContainer.classList.remove('hidden');
}

async function initializePage() {
    await fetchSession();
    await loadContent();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

if (editButton) {
    editButton.addEventListener('click', () => {
        if (currentPage) {
            const identifier = currentPage.id || currentPage.fullPath;
            if (identifier) {
                window.location.href = `/admin/edit-page?id=${encodeURIComponent(identifier)}`;
            }
        }
    });
}

document.addEventListener('click', (e) => {
    if (e.target.closest('[href^="#"]')) {
        const href = e.target.closest('[href^="#"]').getAttribute('href');
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
});