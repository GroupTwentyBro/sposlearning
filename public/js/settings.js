window.saveNameChange = async function() {
    const newName = document.getElementById('name-edit-input').value;
    const btn = document.querySelector('button.btn-success');
    btn.disabled = true;

    try {
        const flowRes = await fetch(`${KRATOS_URL}/self-service/settings/browser`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        const flow = await flowRes.json();

        const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token').attributes.value;

        const submitRes = await fetch(`${KRATOS_URL}/self-service/settings?flow=${flow.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                method: 'profile',
                csrf_token: csrfToken,
                traits: {
                    ...currentUser.traits,
                    name: newName
                }
            }),
            credentials: 'include'
        });

        if (!submitRes.ok) {
            const errData = await submitRes.json();
            throw new Error(errData.ui?.messages?.[0]?.text || "Update failed");
        }

        await createServerLog('auth', `Změna jména na: ${newName}`, { userEmail: currentUser.traits.email });

        location.reload();
    } catch (err) {
        alert("Chyba: " + err.message);
        btn.disabled = false;
    }
};