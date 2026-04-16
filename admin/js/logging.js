import {CONFIG} from "/js/config.js";

export async function createServerLog(type, actionDescription, details = {}) {
    try {
        const payload = {
            type: type,
            action: actionDescription,
            ...details
        };

        if (!payload.userName) {
            payload.userName = 'Unknown';
        }

        const response = await fetch(`${CONFIG.BASE_URL}/api/write-log.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Nepodařilo se zapsat log.");
        }
    } catch (error) {
        console.error("Chyba sítě při logování:", error);
    }
}