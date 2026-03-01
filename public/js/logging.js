export async function createServerLog(type, actionDescription, details = {}) {
    try {
        const payload = {
            type: type,
            action: actionDescription,
            ...details
        };

        if (!payload.userEmail) {
            payload.userEmail = 'Anonym/Neznámý';
        }

        const response = await fetch('/api/write-log.php', {
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