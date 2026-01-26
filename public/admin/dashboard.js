import { auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

let logoutButton;

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('Welcome, admin user:', user.email);
        initializeDashboard();
    } else {
        console.log('No user logged in, redirecting...');
        window.location.href = '../admin';
    }
});

function initializeDashboard() {
    logoutButton = document.getElementById('logout-button');

    logoutButton.addEventListener('click', () => {
        signOut(auth)
            .then(() => {
                console.log("User signed out successfully");
            })
            .catch((error) => {
                console.error("Error signing out:", error);
            });
    });
}