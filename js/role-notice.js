import { CONFIG } from '/js/config.js';
import { getAccessToken } from '/js/auth.js';

let isNoticeShowing = false;

export async function checkAndShowRoleNotice(user) {
    if (!user || !user.roles || isNoticeShowing) return;

    const isContentManager = user.roles.includes('content_manager');
    const isAdmin = user.roles.includes('admin');

    // If user is currently an admin, inform backend so future demotions are detected
    if (isAdmin) {
        try {
            const token = await getAccessToken();
            fetch(`${CONFIG.API_URL}/user/check-role-notice`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => {});
        } catch (e) {}
        return;
    }

    // Only content managers who are not admins need the demotion / restructure notice
    if (!isContentManager) return;

    const storageKey = `spos_role_notice_ack_${user.id}`;
    if (localStorage.getItem(storageKey) === 'true') {
        return;
    }

    try {
        const token = await getAccessToken();
        const res = await fetch(`${CONFIG.API_URL}/user/check-role-notice`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            if (data.showNotice) {
                showRoleNoticeModal(user);
            } else {
                localStorage.setItem(storageKey, 'true');
            }
        } else {
            // In case of error, show modal if not locally acknowledged
            showRoleNoticeModal(user);
        }
    } catch (e) {
        // Fallback to local check
        if (!localStorage.getItem(storageKey)) {
            showRoleNoticeModal(user);
        }
    }
}

function injectStyles() {
    if (document.getElementById('role-notice-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'role-notice-modal-styles';
    style.textContent = `
        .rn-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
            padding: 20px;
            box-sizing: border-box;
        }

        .rn-backdrop.active {
            opacity: 1;
            pointer-events: auto;
        }

        .rn-card {
            background: var(--surface-1, #1e1e1e);
            border: 1px solid var(--border-color, #2e2e2e);
            border-radius: 18px;
            width: 100%;
            max-width: 540px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
            overflow: hidden;
            transform: scale(0.95) translateY(10px);
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            color: var(--text-primary, #ffffff);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            flex-direction: column;
        }

        .rn-backdrop.active .rn-card {
            transform: scale(1) translateY(0);
        }

        .rn-header {
            padding: 24px 24px 16px;
            display: flex;
            align-items: flex-start;
            gap: 16px;
            border-bottom: 1px solid var(--border-color, #2e2e2e);
        }

        .rn-icon-badge {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: rgba(99, 102, 241, 0.15);
            color: #818cf8;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .rn-icon-badge .icon {
            font-size: 28px;
        }

        .rn-kicker {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #818cf8;
            font-weight: 700;
            display: block;
            margin-bottom: 4px;
        }

        .rn-title {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 700;
            line-height: 1.3;
            color: var(--text-primary, #ffffff);
        }

        .rn-body {
            padding: 20px 24px;
            font-size: 0.92rem;
            line-height: 1.55;
            color: var(--text-secondary, #d4d4d8);
            display: flex;
            flex-direction: column;
            gap: 16px;
            max-height: 70vh;
            overflow-y: auto;
        }

        .rn-lead {
            margin: 0;
            color: var(--text-primary, #f4f4f5);
        }

        .rn-box {
            border-radius: 12px;
            padding: 14px 16px;
            font-size: 0.88rem;
        }

        .rn-box-red {
            background: rgba(239, 68, 68, 0.08);
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .rn-box-green {
            background: rgba(34, 197, 94, 0.08);
            border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .rn-box-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .rn-box-red .rn-box-title {
            color: #f87171;
        }

        .rn-box-green .rn-box-title {
            color: #4ade80;
        }

        .rn-box ul {
            margin: 0;
            padding-left: 20px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .rn-box li {
            color: var(--text-primary, #e4e4e7);
        }

        .rn-help {
            margin: 0;
            font-size: 0.84rem;
            color: var(--text-secondary, #a1a1aa);
        }

        .rn-help a {
            color: #818cf8;
            text-decoration: none;
            font-weight: 500;
        }

        .rn-help a:hover {
            text-decoration: underline;
        }

        .rn-footer {
            padding: 16px 24px 24px;
            display: flex;
            justify-content: flex-end;
            border-top: 1px solid var(--border-color, #2e2e2e);
        }

        .rn-btn {
            background: #6366f1;
            color: #ffffff;
            border: none;
            border-radius: 10px;
            padding: 11px 24px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .rn-btn:hover {
            background: #4f46e5;
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
        }

        .rn-btn:active {
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);
}

function showRoleNoticeModal(user) {
    if (document.getElementById('role-notice-backdrop')) return;
    isNoticeShowing = true;

    injectStyles();

    const backdrop = document.createElement('div');
    backdrop.id = 'role-notice-backdrop';
    backdrop.className = 'rn-backdrop';

    backdrop.innerHTML = `
        <div class="rn-card" role="dialog" aria-modal="true" aria-labelledby="rn-modal-title">
            <div class="rn-header">
                <div class="rn-icon-badge">
                    <span class="icon">shield_person</span>
                </div>
                <div>
                    <span class="rn-kicker">OpenBlue Team Restructuring</span>
                    <h2 class="rn-title" id="rn-modal-title">Your role has been updated to Content Manager</h2>
                </div>
            </div>
            <div class="rn-body">
                <p class="rn-lead">
                    As part of SPOŠLearning moving under <a href="https://github.com/OpenBluee" target="_blank" rel="noopener noreferrer" style="color: #818cf8; text-decoration: underline;">OpenBlue</a>, we’re restructuring team permissions. Administrative access is now reserved exclusively for platform owners and core management.
                </p>

                <div class="rn-box rn-box-red">
                    <div class="rn-box-title">
                        <span class="icon" style="font-size: 1.1rem;">remove_moderator</span>
                        <span>What changes for you:</span>
                    </div>
                    <ul>
                        <li>You will no longer manage user accounts, platform logs, or general site feedback.</li>
                    </ul>
                </div>

                <div class="rn-box rn-box-green">
                    <div class="rn-box-title">
                        <span class="icon" style="font-size: 1.1rem;">verified_user</span>
                        <span>What you can still do:</span>
                    </div>
                    <ul>
                        <li>Create, edit, and delete articles</li>
                        <li>Review and manage user submissions</li>
                        <li>View feedback related to articles</li>
                    </ul>
                </div>

                <p class="rn-help">
                    If you think this was done by mistake or have any questions, reach out to us at <a href="mailto:complaints@sposlearning.cz">complaints@sposlearning.cz</a>.
                </p>
            </div>
            <div class="rn-footer">
                <button id="rn-ack-btn" class="rn-btn">I understand</button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);

    // Trigger animation
    requestAnimationFrame(() => {
        backdrop.classList.add('active');
    });

    const ackBtn = document.getElementById('rn-ack-btn');
    if (ackBtn) {
        ackBtn.addEventListener('click', async () => {
            ackBtn.disabled = true;
            ackBtn.textContent = 'Saving...';

            const storageKey = `spos_role_notice_ack_${user.id}`;
            localStorage.setItem(storageKey, 'true');

            try {
                const token = await getAccessToken();
                await fetch(`${CONFIG.API_URL}/user/acknowledge-role-notice`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.warn('Failed to acknowledge role notice on backend:', e);
            }

            backdrop.classList.remove('active');
            setTimeout(() => {
                backdrop.remove();
                isNoticeShowing = false;
            }, 250);
        });
    }
}
