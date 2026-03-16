import { app, auth } from '/js/firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, deleteDoc, query, where, getDocs, setDoc, getDoc, doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from '/js/theming.js';

import { createServerLog } from '/js/logging.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

let pageDocId = null;
let pageType = null;
let pageFullPath = null;
let isOldDocument = false;
let originalPath = "";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadEditorUI();
        await loadPageForEditing();

        const loader = document.querySelector('.dot-container');
        if (loader) loader.classList.add('hidden');

        initThemeListeners();
    } else {
        window.location.href = 'https://www.sposlearning.cz/login';
    }
});

async function loadEditorUI() {
    const docRef = doc(db, "admin-pages", "edit");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;
        const md = document.getElementById('md-content');
        const html = document.getElementById('html-content');
        if(md) enableTabIndentation(md);
        if(html) enableTabIndentation(html);


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
        originalPath = pageFullPath;

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
        const adminCheckbox = document.getElementById('page-is-admin');

        if (adminCheckbox) {
            adminCheckbox.checked = (data.accessLevel === 'admin');
            console.log("Checkbox set to:", adminCheckbox.checked);
        } else {
            console.error("Checkbox 'page-is-admin' not found in DOM!");
        }

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

    let newPath = document.getElementById('page-url-display').value.trim().replace(/^\/|\/$/g, '');
    const newDocId = newPath.replace(/\//g, '|');
    const oldDocId = pageDocId;

    saveButton.disabled = true;
    saveButton.textContent = 'Validating...';

    try {
        if (newPath !== originalPath) {
            const checkDoc = await getDoc(doc(db, 'pages', newDocId));
            if (checkDoc.exists()) {
                throw new Error(`A page already exists at /${newPath}. Please choose a different URL.`);
            }
        }

        saveButton.textContent = 'Saving...';

        let newContent = (pageType === 'markdown')
            ? document.getElementById('md-content').value
            : document.getElementById('html-content').value;

        const updatedData = {
            title: document.getElementById('page-title').value,
            content: newContent,
            fullPath: newPath,
            accessLevel: document.getElementById('page-is-admin').checked ? 'admin' : 'public',
            lastEditedBy: auth.currentUser.email,
            lastEditedAt: serverTimestamp(),
            type: pageType
        };

        if (newPath !== originalPath || isOldDocument) {
            await setDoc(doc(db, 'pages', newDocId), updatedData);

            if (newDocId !== oldDocId) {
                await deleteDoc(doc(db, 'pages', oldDocId));
            }
        } else {
            await updateDoc(doc(db, 'pages', oldDocId), updatedData);
        }

        await createServerLog('page', `Path Updated: ${originalPath} -> ${newPath}`, {
            userEmail: auth.currentUser.email,
            oldPath: originalPath,
            newPath: newPath,
            title: updatedData.title
        });

        window.location.href = `https://www.sposlearning.cz/${newPath}`;

    } catch (error) {
        console.error("Save Error:", error);
        status.innerHTML = `<span class="text-danger">⚠️ ${error.message}</span>`;
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
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