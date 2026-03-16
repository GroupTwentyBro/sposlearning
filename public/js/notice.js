(function() {
    // Check if seen in this session
    if (!sessionStorage.getItem('migration_notice_seen')) {

        const notice = document.createElement('div');
        notice.id = 'migration-alert';

        // Using your CSS variables for styling
        notice.style.backgroundColor = 'var(--discl-warning-bg-clr)';
        notice.style.border = '1px solid var(--discl-warning-fg-clr)';
        notice.style.color = 'var(--root-fg-clr)';
        notice.style.position = 'fixed';
        notice.style.bottom = '20px';
        notice.style.left = '50%';
        notice.style.transform = 'translateX(-50%)';
        notice.style.width = '90%';
        notice.style.maxWidth = '800px';
        notice.style.padding = '15px 20px';
        notice.style.borderRadius = 'var(--box-border-radius, 8px)';
        notice.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
        notice.style.zIndex = '10000';
        notice.style.fontFamily = '"Raleway", sans-serif';
        notice.style.fontSize = 'var(--fs-unimportant, 0.9rem)';

        notice.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px;">
                <span style="line-height: 1.5;">
                    <strong style="color: var(--quaternary-hl-clr);">⚠️ Upozornění:</strong> 
                    SPOŠLearning momentálně testuje nový autentikační systém a může být velice nestabilní. 
                    Doporučujeme neodhlašovat se, dokud vám vše bude fungovat.
                </span>
                <button id="close-migration-alert" style="
                    background: var(--root-box-fg-clr); 
                    border: 1px solid var(--box-border-clr); 
                    color: var(--root-fg-clr); 
                    cursor: pointer; 
                    padding: 5px 12px; 
                    border-radius: 4px;
                    white-space: nowrap;
                    transition: filter 0.2s;
                ">Rozumím</button>
            </div>
        `;

        document.body.appendChild(notice);

        const closeBtn = document.getElementById('close-migration-alert');

        // Hover effect using your variable colors
        closeBtn.onmouseover = () => closeBtn.style.filter = 'brightness(1.2)';
        closeBtn.onmouseout = () => closeBtn.style.filter = 'brightness(1)';

        closeBtn.addEventListener('click', () => {
            notice.style.opacity = '0';
            notice.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                notice.remove();
                sessionStorage.setItem('migration_notice_seen', 'true');
            }, 300);
        });
    }
})();