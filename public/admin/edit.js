// public/admin/edit.js
import { app, auth } from '/js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Initialize ---
const db = getFirestore(app);

// --- Get Elements ---
const pageUrlDisplay = document.getElementById('page-url-display');
const pageTitle = document.getElementById('page-title');
const editForm = document.getElementById('edit-form');
const saveButton = document.getElementById('save-button');
const status = document.getElementById('page-status');

const editorMarkdown = document.getElementById('editor-markdown');
const mdContent = document.getElementById('md-content');
const editorHTML = document.getElementById('editor-html');
const htmlContent = document.getElementById('html-content');

enableTabIndentation(document.getElementById('md-content'));
enableTabIndentation(document.getElementById('html-content'));

// --- Global variables to store page info ---
let pageDocId = null;
let pageType = null;
let pageFullPath = null;

/**
 * 1. Auth Guard: Redirect if not logged in
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is logged in, load the page data
        loadPageForEditing();
    } else {
        // Not logged in, redirect to admin login
        console.log('No user logged in, redirecting...');
        window.location.href = '/admin';
    }
});

/**
 * 2. Load the page data based on the URL parameter
 */
async function loadPageForEditing() {
    try {
        // Get the page path from the URL (e.g., ?path=wep/html/div)
        const params = new URLSearchParams(window.location.search);
        pageFullPath = params.get('path');

        if (!pageFullPath) {
            throw new Error('No page path specified in URL.');
        }

        // Find the page in Firestore
        const q = query(collection(db, "pages"), where("fullPath", "==", pageFullPath));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error(`Page not found: /${pageFullPath}`);
        }

        const pageDoc = querySnapshot.docs[0];
        pageDocId = pageDoc.id;
        const data = pageDoc.data();
        pageType = data.type;

        // Populate the form fields
        pageUrlDisplay.value = `/${data.fullPath}`;
        pageTitle.value = data.title;

        // Show the correct editor and fill it
        if (data.type === 'markdown') {
            mdContent.value = data.content;
            editorMarkdown.style.display = 'block';
        } else if (data.type === 'html') {
            htmlContent.value = data.content;
            editorHTML.style.display = 'block';
        }

    } catch (error) {
        console.error('Error loading page:', error);
        status.className = 'text-danger';
        status.textContent = `Error: ${error.message}`;
        saveButton.disabled = true;
    }
}

/**
 * 3. Handle the form submission
 */
editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pageDocId) return;

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    status.textContent = '';

    try {
        // Get the correct doc reference
        const docRef = doc(db, 'pages', pageDocId);

        // Get the new content from the visible editor
        let newContent = '';
        if (pageType === 'markdown') {
            newContent = mdContent.value;
        } else if (pageType === 'html') {
            newContent = htmlContent.value;
        }

        // Update the document
        await updateDoc(docRef, {
            title: pageTitle.value,
            content: newContent,
            lastEditedBy: auth.currentUser.email,
            lastEditedAt: serverTimestamp()
        });

        status.className = 'text-success';
        status.textContent = 'Success! Redirecting...';

        // Redirect back to the page they were editing
        setTimeout(() => {
            window.location.href = `/${pageFullPath}`;
        }, 1000);

    } catch (error) {
        console.error('Error updating document:', error);
        status.className = 'text-danger';
        status.textContent = `Error: ${error.message}`;
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
    }
});
// --- HELPER FUNCTION FOR TAB INDENTATION ---
function enableTabIndentation(textarea) {
    textarea.addEventListener('keydown', function(e) {
        // Check for Tab key
        if (e.key === 'Tab') {
            e.preventDefault(); // Stop the browser from changing focus

            // Get current cursor position
            var start = this.selectionStart;
            var end = this.selectionEnd;

            // --- Handle SHIFT + TAB (Un-indent) ---
            if (e.shiftKey) {
                // Find the start of the current line
                let lineStart = start;
                while (lineStart > 0 && this.value[lineStart - 1] !== '\n') {
                    lineStart--;
                }

                // If the line starts with a tab, remove it
                if (this.value.substring(lineStart, lineStart + 1) === '\t') {
                    this.value = this.value.substring(0, lineStart) + this.value.substring(lineStart + 1);
                    // Adjust cursor
                    this.selectionStart = start - 1;
                    this.selectionEnd = end - 1;
                }
            }

            // --- Handle TAB (Indent) ---
            else {
                // Insert a tab character
                this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);

                // Put cursor back in the right place
                this.selectionStart = this.selectionEnd = start + 1;
            }
        }
    });
}
