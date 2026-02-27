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

    // 1. Basic Password Match Check
    if (pass !== confirmPass) {
        statusMsg.className = "text-danger";
        statusMsg.textContent = "Hesla se neshodují.";
        return;
    }

    regBtn.disabled = true;
    regBtn.textContent = "Ověřování e-mailu...";

    try {
        const debounceResponse = await fetch(`https://disposable.debounce.io/?email=${encodeURIComponent(email)}`);
        const debounceData = await debounceResponse.json();

        if (debounceData.disposable === "true") {
            statusMsg.className = "text-danger";
            statusMsg.textContent = "Dočasné e-mailové adresy nejsou povoleny.";
            regBtn.disabled = false;
            regBtn.textContent = "Vytvořit účet";
            return;
        }

        regBtn.textContent = "Vytváření...";

        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        await sendEmailVerification(user);
        await signOut(auth);

        statusMsg.className = "text-success";
        statusMsg.innerHTML = `Účet vytvořen! <br> Zkontrolujte <b>${email}</b> pro ověřovací odkaz (často padá do spamu).`;
        regForm.reset();

    } catch (error) {
        console.error(error);
        statusMsg.className = "text-danger";

        if (error.code === 'auth/email-already-in-use') {
            statusMsg.textContent = "Tento e-mail se již používá.";
        } else if (error.message === "Failed to fetch") {
            // Fallback in case the DeBounce API is down
            statusMsg.textContent = "Chyba při ověřování e-mailu. Zkuste to prosím později.";
        } else {
            statusMsg.textContent = "Nastala chyba při registraci.";
        }

        regBtn.disabled = false;
        regBtn.textContent = "Vytvořit účet";
    }
});