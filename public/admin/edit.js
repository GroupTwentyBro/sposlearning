import { app, auth } from '/js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, deleteDoc, query, where, getDocs, setDoc, getDoc, doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners, applyTheme } from '/js/theming.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

// Global variables
let pageDocId = null;
let pageType = null;
let pageFullPath = null;
let isOldDocument = false;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadEditorUI(); // First, get the HTML shell from DB
        await loadPageForEditing(); // Then, get the specific page content

        const loader = document.querySelector('.dot-container');
        if (loader) loader.classList.add('hidden');

        initThemeListeners();
    } else {
        window.location.href = '/admin';
    }
});

/**
 * NEW: Fetches the Editor UI from Firestore (admin/editor)
 */
async function loadEditorUI() {
    const docRef = doc(db, "admin", "edit"); // Assuming you store the HTML here
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
        // Re-enable Tab Indentation for the new elements
        enableTabIndentation(document.getElementById('md-content'));
        enableTabIndentation(document.getElementById('html-content'));

        // Re-attach the form submit listener
        document.getElementById('edit-form').addEventListener('submit', handleSave);
    } else {
        container.innerHTML = "<h3>Error: Editor shell not found in DB.</h3>";
    }
}

/**
 * Loads the actual page content into the injected fields
 */
async function loadPageForEditing() {
    const pageUrlDisplay = document.getElementById('page-url-display');
    const pageTitle = document.getElementById('page-title');
    const status = document.getElementById('page-status');
    const saveButton = document.getElementById('save-button');

    try {
        const params = new URLSearchParams(window.location.search);
        pageFullPath = params.get('path');

        const newDocId = pageFullPath.replace(/\//g, '|');
        const docRef = doc(db, 'pages', newDocId);
        let docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            isOldDocument = false;
            pageDocId = docSnap.id;
        } else {
            const q = query(collection(db, "pages"), where("fullPath", "==", pageFullPath));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) throw new Error(`Page not found: /${pageFullPath}`);
            isOldDocument = true;
            pageDocId = querySnapshot.docs[0].id;
            docSnap = querySnapshot.docs[0];
        }

        const data = docSnap.data();
        pageType = data.type;
        pageUrlDisplay.value = `/${data.fullPath}`;
        pageTitle.value = data.title;

        if (data.type === 'markdown') {
            document.getElementById('md-content').value = data.content;
            document.getElementById('editor-markdown').style.display = 'block';
        } else if (data.type === 'html') {
            document.getElementById('html-content').value = data.content;
            document.getElementById('editor-html').style.display = 'block';
        }

    } catch (error) {
        if(status) status.textContent = `Error: ${error.message}`;
        if(saveButton) saveButton.disabled = true;
    }
}

/**
 * Consolidated Save Handler
 */
async function handleSave(e) {
    e.preventDefault();
    const saveButton = document.getElementById('save-button');
    const status = document.getElementById('page-status');

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
        let newContent = (pageType === 'markdown')
            ? document.getElementById('md-content').value
            : document.getElementById('html-content').value;

        const updatedData = {
            title: document.getElementById('page-title').value,
            content: newContent,
            lastEditedBy: auth.currentUser.email,
            lastEditedAt: serverTimestamp()
        };

        if (isOldDocument) {
            const newDocId = pageFullPath.replace(/\//g, '|');
            await setDoc(doc(db, 'pages', newDocId), { ...updatedData, fullPath: pageFullPath, type: pageType });
            await deleteDoc(doc(db, 'pages', pageDocId));
        } else {
            await updateDoc(doc(db, 'pages', pageDocId), updatedData);
        }

        window.location.href = `/${pageFullPath}`;
    } catch (error) {
        status.textContent = `Error: ${error.message}`;
        saveButton.disabled = false;
    }
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
