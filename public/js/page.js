// public/js/page.js

import { app } from './firebaseConfig.js';
// Added Auth imports
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
// Imports are complete
import { getFirestore, collection, query, where, getDocs, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Initialize
const db = getFirestore(app);
const contentContainer = document.getElementById('wiki-content-container');

// This will store the loaded page's ID and data
let currentPage = null;

/**
 * Main function to load and render content
 */
async function loadContent() {
    // 1. Get the page "fullPath" from the URL
    let fullPath = window.location.pathname.substring(1);
    fullPath = fullPath.replace(/\/+$/, ''); // Remove trailing slash

    if (fullPath === '') {
        window.location.href = '/';
        return;
    }

    try {
        // 3. Query Firestore for a document in "pages" with this fullPath
        const pagesRef = collection(db, 'pages');
        const q = query(pagesRef, where("fullPath", "==", fullPath));
        const querySnapshot = await getDocs(q);

        // 4. Check if we found a page
        if (querySnapshot.empty) {
            renderError(fullPath);
            return;
        }

        // 5. We found it! Get the data and the document ID
        const pageDoc = querySnapshot.docs[0]; // Get the full document
        const pageData = pageDoc.data();     // Get its data

        // **FIX**: Correctly save the page ID and data for our admin tools
        currentPage = { id: pageDoc.id, data: pageData };

        // Set the browser tab title
        document.title = pageData.title;

        // 6. Render the content based on its type
        if (pageData.type === 'markdown') {
            contentContainer.innerHTML = marked.parse(pageData.content, { breaks: true });
        } else if (pageData.type === 'html') {
            contentContainer.innerHTML = pageData.content;
        } else if (pageData.type === 'files') {
            renderFileExplorer(pageData.title, pageData.content);
        }

        contentContainer.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

    } catch (error) {
        console.error("Error loading content:", error);
        renderError(fullPath, error);
    }
}

/**
 * Helper function to render the new File Explorer page
 */
function renderFileExplorer(title, files) {
    let fileListHtml = files.map(file => {
        // Simple file size formatter
        const size = (file.bytes / (1024 * 1024) > 1)
            ? `${(file.bytes / (1024 * 1024)).toFixed(2)} MB`
            : `${(file.bytes / 1024).toFixed(0)} KB`;

        return `
            <a href="${file.url}" target="_blank" rel="noopener noreferrer" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                ${file.name}
                <span class="badge badge-primary badge-pill">${size}</span>
            </a>
        `;
    }).join('');

    contentContainer.innerHTML = `
        <h1>${title}</h1>
        <p>Soubory ke stažení:</p>
        <div class="list-group">
            ${fileListHtml}
        </div>
    `;
}

/**
 * Helper function to show a 404 error
 */
function renderError(slug) {
    contentContainer.innerHTML = `
        <h1>404 - Stránka nenalezena</h1>
        <hr>
        <p>Bohužel, stránka s názvem "<code>${slug}</code>" neexistuje.</p>
        <a href="/">Vrátit se domů</a>
    `;
}

// --- NEW Admin Tools Section ---

/**
 * Adds Edit/Delete buttons if the user is logged in
 */
function setupAdminTools() {
    const auth = getAuth(app);
    onAuthStateChanged(auth, (user) => {
        const adminBar = document.getElementById('admin-bar');
        if (user && currentPage) {
            // User is logged in AND we are on a valid page

            let editButton = '';
            // Only show "Edit" for text pages
            if (currentPage.data.type === 'markdown' || currentPage.data.type === 'html') {
                editButton = `<a href="/admin/edit.html?path=${currentPage.data.fullPath}" class="btn btn-sm btn-primary" id="edit-button">Edit Page</a>`;
            }

            adminBar.innerHTML = `
                <div class="admin-controls">
                    <span>Vítej, admine!</span>
                    ${editButton}
                    <button id="delete-button" class="btn btn-sm btn-danger">Delete Page</button>
                    <a href="/admin/dashboard" class="btn btn-sm btn-dark btn-admin">Admin Panel</a>
                </div>
            `;

            // Add click listener for the new delete button
            document.getElementById('delete-button').addEventListener('click', handleDeletePage);

        } else {
            adminBar.innerHTML = '';
        }
    });
}

/**
 * Handles the delete page logic
 */
async function handleDeletePage() {
    if (!currentPage) return;

    const title = currentPage.data.title;
    if (confirm(`Opravdu chcete smazat stránku "${title}"?\n\nTato akce je nevratná.`)) {
        try {
            // Delete the document from Firestore using its unique ID
            await deleteDoc(doc(db, 'pages', currentPage.id));
            alert('Stránka byla smazána.');
            window.location.href = '/'; // Redirect to home page
        } catch (error) {
            console.error('Error deleting page:', error);
            alert('Chyba: Stránka nemohla být smazána.');
        }
    }
}


// --- NEW Run the app ---
// We create an async function to make sure we wait
// for the page to load BEFORE we try to add the admin buttons.
async function initializePage() {
    await loadContent(); // 1. Wait for page data to load (and set currentPage)
    setupAdminTools(); // 2. Now set up admin tools, which depend on currentPage
}

initializePage();