import { app, auth } from '/js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, deleteDoc, query, where, getDocs, setDoc, getDoc, doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from '/js/theming.js';

// 1. Import your new logger function
import { createServerLog } from '/js/logging.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

let pageDocId = null;
let pageType = null;
let pageFullPath = null;
let isOldDocument = false;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadEditorUI();
        await loadPageForEditing();

        const loader = document.querySelector('.dot-container');
        if (loader) loader.classList.add('hidden');

        initThemeListeners();
    } else {
        window.location.href = '/login';
    }
});

async function loadEditorUI() {
    const docRef = doc(db, "admin-pages", "edit");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
        enableTabIndentation(document.getElementById('md-content'));
        enableTabIndentation(document.getElementById('html-content'));


        document.getElementById('edit-form').addEventListener('submit', handleSave);
    } else {
        container.innerHTML = "<h3>Error: Editor shell not found in DB.</h3>";
    }
}

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
        document.getElementById('page-is-admin').checked = data.accessLevel === 'admin';
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
            accessLevel: document.getElementById('page-is-admin').checked ? 'admin' : 'public',
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

        // 2. Call the logger with your specific parameters BEFORE redirecting
        await createServerLog('page', `Edited Page: ${updatedData.title}`, {
            isUser: !!auth.currentUser,
            userEmail: auth.currentUser.email,
            userEmailVerified: auth.currentUser.emailVerified,
            userName: auth.currentUser.displayName || 'none',
            pageAccessLevel: updatedData.accessLevel,
            pageContent: updatedData.content, // Logs the raw markdown/html
            pageFullPath: pageFullPath,
            pageEditedBy: auth.currentUser.email,
            pageTitle: updatedData.title
        });

        window.location.href = `https://www.sposlearning.cz/${pageFullPath}`;
    } catch (error) {
        status.textContent = `Error: ${error.message}`;
        saveButton.disabled = false;
    }
}

function enableTabIndentation(textarea) {
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();

            var start = this.selectionStart;
            var end = this.selectionEnd;

            if (e.shiftKey) {
                let lineStart = start;
                while (lineStart > 0 && this.value[lineStart - 1] !== '\n') {
                    lineStart--;
                }

                if (this.value.substring(lineStart, lineStart + 1) === '\t') {
                    this.value = this.value.substring(0, lineStart) + this.value.substring(lineStart + 1);
                    this.selectionStart = start - 1;
                    this.selectionEnd = end - 1;
                }
            } else {
                this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);

                this.selectionStart = this.selectionEnd = start + 1;
            }
        }
    });
}