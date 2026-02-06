import { auth } from './firebaseConfig.js';
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const regForm = document.getElementById('register-form');
const statusMsg = document.getElementById('status-message');
const regBtn = document.getElementById('reg-btn');

regForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;
    const confirmPass = document.getElementById('reg-password-confirm').value;

    if (pass !== confirmPass) {
        statusMsg.className = "text-danger";
        statusMsg.textContent = "Hesla se neshodují.";
        return;
    }

    regBtn.disabled = true;
    regBtn.textContent = "Vytváření...";

    try {
        // 1. Create the user
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // 2. Send verification email
        await sendEmailVerification(user);

        // 3. Sign them out immediately
        // We do this so they have to log in AFTER verifying
        await signOut(auth);

        statusMsg.className = "text-success";
        statusMsg.innerHTML = `Účet vytvořen! <br> Zkontrolujte <b>${email}</b> pro ověřovací odkaz.`;
        regForm.reset();

    } catch (error) {
        console.error(error);
        statusMsg.className = "text-danger";
        statusMsg.textContent = error.code === 'auth/email-already-in-use'
            ? "Tento e-mail se již používá."
            : "Nastala chyba při registraci.";
        regBtn.disabled = false;
        regBtn.textContent = "Vytvořit účet";
    }
});