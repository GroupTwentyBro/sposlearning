(function() {
    if (!sessionStorage.getItem('migration_notice_seen')) {

        // Create backdrop to dim the background
        const backdrop = document.createElement('div');
        backdrop.id = 'migration-backdrop';
        Object.assign(backdrop.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '10000',
            fontFamily: '"Raleway", sans-serif'
        });

        // Create the MessageBox
        const modal = document.createElement('div');
        modal.id = 'migration-modal';
        Object.assign(modal.style, {
            backgroundColor: 'var(--root-box-bg-clr)',
            border: '2px solid var(--discl-warning-fg-clr)',
            borderRadius: 'var(--box-border-radius, 12px)',
            padding: '40px',
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            color: 'var(--root-fg-clr)'
        });

        modal.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
            <h2 style="color: var(--quaternary-hl-clr); margin-bottom: 20px; font-weight: 800;">
                Důležité upozornění
            </h2>
            <p style="color: var(--root-txt-clr); font-size: 1.1rem; line-height: 1.6; margin-bottom: 30px;">
                SPOŠLearning momentálně testuje <strong>nový autentikační systém</strong> a může být velice nestabilní. 
                Doporučujeme se momentálně <strong>neodhlašovat</strong>, dokud vám vše funguje správně.
            </p>
            <button id="close-migration-modal" style="
                background: var(--primary-bg-clr); 
                border: 1px solid var(--primary-fg-clr); 
                color: var(--root-fg-clr); 
                cursor: pointer; 
                padding: 12px 30px; 
                border-radius: 6px;
                font-weight: 700;
                font-size: 1rem;
                transition: all 0.2s ease;
                width: 100%;
            ">Rozumím, pokračovat</button>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const closeBtn = document.getElementById('close-migration-modal');

        // Button hover effect
        closeBtn.onmouseover = () => {
            closeBtn.style.background = 'var(--primary-fg-clr)';
            closeBtn.style.transform = 'translateY(-2px)';
        };
        closeBtn.onmouseout = () => {
            closeBtn.style.background = 'var(--primary-bg-clr)';
            closeBtn.style.transform = 'translateY(0)';
        };

        closeBtn.addEventListener('click', () => {
            backdrop.style.opacity = '0';
            backdrop.style.transition = 'opacity 0.4s ease';
            setTimeout(() => {
                backdrop.remove();
                sessionStorage.setItem('migration_notice_seen', 'true');
            }, 400);
        });
    }
})();