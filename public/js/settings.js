import { auth, app } from './firebaseConfig.js';
import {
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ADD THESE FIRESTORE IMPORTS (These were missing)
import { 
    getFirestore, 
    doc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"; 

import { applyTheme, getGlobalItem, initThemeListeners } from './theming.js';
import { createServerLog } from './logging.js'; 

const db = getFirestore(app);

window.toggleNameEdit = function() {
    const textSpan = document.getElementById('display-name-text');
    const container = textSpan.parentElement;
    const currentName = textSpan.textContent === "Not set" ? "" : textSpan.textContent;

    container.innerHTML = `
        <div class="d-flex align-items-center justify-content-end">
            <input type="text" id="name-edit-input" class="form-control form-control-sm me-2" 
                   value="${currentName}" style="max-width: 200px;">
            <button class="btn btn-sm btn-success me-1" onclick="saveNameChange()">
                <span class="material-symbols-outlined fs-6">check</span>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="location.reload()">
                <span class="material-symbols-outlined fs-6">close</span>
            </button>
        </div>
    `;
};

window.saveNameChange = async function() {
    const newName = document.getElementById('name-edit-input').value;
    if (auth.currentUser) {
        try {
            // Update Firebase Auth Profile
            await updateProfile(auth.currentUser, { displayName: newName });
            
            // LOG THE CHANGE
            await createServerLog('auth', `Uživatel si změnil jméno na: ${newName}`, {
                isUser: true,
                userEmail: auth.currentUser.email,
                userName: newName
            });

            location.reload();
        } catch (error) {
            console.error("Name update error:", error);
            alert("Chyba při ukládání jména.");
        }
    }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('display-name-text').textContent = user.displayName || "Not set";
        document.getElementById('account-email').value = user.email;

        const statusDiv = document.getElementById('email-verification-status');
        const resendContainer = document.getElementById('resend-container');

        if (user.emailVerified) {
            statusDiv.innerHTML = `
                <span class="text-success d-flex align-items-center">
                    <span class="material-symbols-outlined me-1 fs-6">check_circle</span> Email je ověřený
                </span>`;
            resendContainer.innerHTML = '';
        } else {
            statusDiv.innerHTML = `
                <span class="text-warning d-flex align-items-center">
                    <span class="material-symbols-outlined me-1 fs-6">error</span> Email není ověřený
                </span>`;
            resendContainer.innerHTML = `<button class="btn btn-sm btn-link text-primary-hl p-0" id="btn-resend">Poslat ověřovací email</button>`;

            document.getElementById('btn-resend').onclick = async () => {
                try {
                    await sendEmailVerification(auth.currentUser);
                    
                    await createServerLog('auth', `Vyžádán nový ověřovací email`, {
                        userEmail: user.email
                    });

                    alert("Ověřovací email byl odeslán!");
                } catch (err) {
                    console.error(err);
                    alert("Chyba při odesílání.");
                }
            };
        }
    } else {
        window.location.href = '/login';
    }
});

// Theme listeners logic...
initThemeListeners();
