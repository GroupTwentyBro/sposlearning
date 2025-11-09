// public/admin/dashboard.js

// --- Imports ---
import { auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- !! IMPORTANT: CONFIGURE CLOUDINARY !! ---
const CLOUDINARY_CLOUD_NAME = "dmrefvudz"; // <-- PASTE YOUR CLOUD NAME
const CLOUDINARY_UPLOAD_PRESET = "sposlearning-upload-v1"; // <-- PASTE YOUR UPLOAD PRESET NAME
// ------------------------------------------------

// --- Initialize ---
const db = getFirestore();

// --- Get Elements ---
let logoutButton, pageForm, pageTypeSelect, saveButton;
let editorMarkdown, editorHTML, editorFiles;
let pageTitle, pagePath, pageName;
let statusSuccess, statusError;

// --- Auth Check (The Page "Guard") ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('Welcome, admin user:', user.email);
        initializeDashboard();
    } else {
        console.log('No user logged in, redirecting...');
        window.location.href = '../admin';
    }
});

// --- Main Function ---
function initializeDashboard() {
    // Get all HTML elements
    logoutButton = document.getElementById('logout-button');
    pageForm = document.getElementById('page-form');
    pageTypeSelect = document.getElementById('page-type');
    saveButton = document.getElementById('save-button');

    editorMarkdown = document.getElementById('editor-markdown');
    editorHTML = document.getElementById('editor-html');
    editorFiles = document.getElementById('editor-files');

    pageTitle = document.getElementById('page-title');
    pagePath = document.getElementById('page-path');
    pageName = document.getElementById('page-name');

    statusSuccess = document.getElementById('page-success-status');
    statusError = document.getElementById('page-error-status');

    enableTabIndentation(document.getElementById('md-content'));
    enableTabIndentation(document.getElementById('html-content'));

    // --- 1. Logout ---
    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            console.log('User logged out.');
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    // --- 2. Show/Hide Editors based on Dropdown ---
    pageTypeSelect.addEventListener('change', (e) => {
        const type = e.target.value;

        editorMarkdown.style.display = (type === 'markdown') ? 'block' : 'none';
        editorHTML.style.display = (type === 'html') ? 'block' : 'none';
        editorFiles.style.display = (type === 'files') ? 'block' : 'none';
    });

    // --- 3. Main Save Logic ---
    pageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
        statusSuccess.textContent = '';
        statusError.textContent = '';

        try {
            const pageData = {
                title: pageTitle.value,
                name: pageName.value.trim(),
                path: pagePath.value.trim(),
                type: pageTypeSelect.value,
                content: null,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser.email
            };

            // --- 3a. Clean the fullPath ---
            let fullPath = (pageData.path) ? `${pageData.path}/${pageData.name}` : pageData.name;
            // Remove leading/trailing slashes
            fullPath = fullPath.replace(/^\/+|\/+$/g, '');
            pageData.fullPath = fullPath;

            // --- 3b. Check if page already exists ---
            const q = query(collection(db, "pages"), where("fullPath", "==", fullPath));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                throw new Error(`A page already exists at this path: /${fullPath}`);
            }

            // --- 3c. Get content based on type ---
            if (pageData.type === 'markdown') {
                pageData.content = document.getElementById('md-content').value;
            } else if (pageData.type === 'html') {
                pageData.content = document.getElementById('html-content').value;
            } else if (pageData.type === 'files') {
                const files = document.getElementById('file-upload-input').files;
                if (files.length === 0) {
                    throw new Error('Please select files for the File Explorer page.');
                }
                statusSuccess.textContent = 'Uploading files to Cloudinary...';
                pageData.content = await uploadFilesToCloudinary(files);
            }

            // --- 3d. Save to Firestore ---
            statusSuccess.textContent = 'Saving page to database...';
            const docRef = await addDoc(collection(db, 'pages'), pageData);

            console.log('Page saved with ID:', docRef.id);
            statusSuccess.textContent = `Success! Page created at /${fullPath}`;
            pageForm.reset();
            // Reset editor view
            pageTypeSelect.dispatchEvent(new Event('change'));

        } catch (error) {
            console.error('Save failed:', error);
            statusError.textContent = `Error: ${error.message}`;
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Page';
        }
    });
}

/**
 * Uploads multiple files to Cloudinary and returns an array of file objects
 */
async function uploadFilesToCloudinary(files) {
    const fileList = [];
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;

    // Loop through each file and upload it
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();
        if (result.error) {
            throw new Error(`Cloudinary upload failed: ${result.error.message}`);
        }

        fileList.push({
            name: result.original_filename,
            url: result.secure_url,
            bytes: result.bytes,
            format: result.format
        });
    }

    return fileList; // Returns the array to be saved in Firestore
}

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