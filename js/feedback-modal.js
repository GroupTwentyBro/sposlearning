import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken } from "/js/auth.js";

const API_URL = CONFIG.API_URL;

let modalInitialized = false;
let attachedImages = [];

export function initFeedbackModal() {
    if (modalInitialized) return;

    injectModalStyles();
    injectModalHTML();
    setupFeedbackEventListeners();

    modalInitialized = true;
}

function injectModalStyles() {
    if (document.getElementById('feedback-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'feedback-modal-styles';
    style.textContent = `
        .fb-modal-backdrop {
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
        }

        .fb-modal-backdrop.active {
            opacity: 1;
            pointer-events: auto;
        }

        .fb-modal-card {
            background: #1E1E1E;
            border: 1px solid #2A2A2A;
            border-radius: 16px;
            width: 90%;
            max-width: 540px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
            overflow: hidden;
            transform: translateY(20px);
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            color: #FFFFFF;
            font-family: 'Inter', sans-serif;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
        }

        .fb-modal-backdrop.active .fb-modal-card {
            transform: translateY(0);
        }

        .fb-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: #282828;
            border-bottom: 1px solid #2A2A2A;
        }

        .fb-modal-header h3 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .fb-close-btn {
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            border-radius: 6px;
            padding: 4px;
            display: flex;
            align-items: center;
        }

        .fb-close-btn:hover {
            color: #FFF;
            background: rgba(255,255,255,0.1);
        }

        .fb-modal-body {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 14px;
            overflow-y: auto;
        }

        .fb-user-card {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 10px;
            padding: 10px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.85rem;
            color: #60a5fa;
        }

        .fb-user-badge {
            font-weight: 600;
            color: #FFFFFF;
        }

        .fb-form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .fb-form-group label {
            font-size: 0.8rem;
            font-weight: 600;
            color: rgba(255,255,255,0.7);
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }

        .fb-form-input, .fb-form-select, .fb-form-textarea {
            width: 100%;
            background: #121212;
            border: 1px solid #2A2A2A;
            border-radius: 10px;
            padding: 10px 12px;
            color: #FFFFFF;
            font-size: 0.9rem;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s;
            box-sizing: border-box;
        }

        .fb-form-input:focus, .fb-form-select:focus, .fb-form-textarea:focus {
            border-color: hsl(204, 100%, 50%);
        }

        .fb-form-textarea {
            resize: vertical;
            min-height: 90px;
        }

        /* IMAGE ATTACHMENTS */
        .fb-img-dropzone {
            border: 2px dashed #2A2A2A;
            border-radius: 10px;
            padding: 14px;
            text-align: center;
            background: #121212;
            cursor: pointer;
            transition: border-color 0.2s;
            font-size: 0.85rem;
            color: rgba(255,255,255,0.6);
        }

        .fb-img-dropzone:hover {
            border-color: #3b82f6;
            color: #FFF;
        }

        .fb-img-previews {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 8px;
        }

        .fb-img-thumb-container {
            position: relative;
            width: 70px;
            height: 70px;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #2A2A2A;
        }

        .fb-img-thumb {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .fb-img-remove {
            position: absolute;
            top: 3px; right: 3px;
            background: rgba(0,0,0,0.75);
            color: #FFF;
            border: none;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 12px;
        }

        .fb-img-remove:hover {
            background: #ef4444;
        }

        .fb-modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 16px 20px;
            border-top: 1px solid #2A2A2A;
            background: rgba(0,0,0,0.1);
        }

        .fb-btn {
            padding: 9px 16px;
            border-radius: 8px;
            font-size: 0.88rem;
            font-weight: 600;
            cursor: pointer;
            border: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }

        .fb-btn-cancel {
            background: #282828;
            color: #FFF;
            border: 1px solid #2A2A2A;
        }

        .fb-btn-cancel:hover { background: #333; }

        .fb-btn-submit {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: #FFF;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .fb-btn-submit:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
        }

        .fb-btn-submit:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* TOAST NOTIFICATION */
        .fb-toast {
            position: fixed;
            bottom: 24px; right: 24px;
            background: #10b981;
            color: #FFF;
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 0.9rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            z-index: 10000;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        }

        .fb-toast.active {
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto;
        }

        .fb-toast.error {
            background: #ef4444;
        }
    `;
    document.head.appendChild(style);
}

function injectModalHTML() {
    if (document.getElementById('send-feedback-modal')) return;

    const div = document.createElement('div');
    div.id = 'send-feedback-modal';
    div.className = 'fb-modal-backdrop';
    div.innerHTML = `
        <div class="fb-modal-card">
            <div class="fb-modal-header">
                <h3><span class="icon" style="color: #f59e0b;">rate_review</span> Send Feedback</h3>
                <button id="fb-close-modal-btn" class="fb-close-btn"><span class="icon">close</span></button>
            </div>
            <div class="fb-modal-body">
                <div class="fb-user-card">
                    <span>Sending as: <span id="fb-user-name" class="fb-user-badge">User</span></span>
                    <span id="fb-user-email" style="font-size: 0.8rem; opacity: 0.8;">email@example.com</span>
                </div>

                <div class="fb-form-group">
                    <label for="fb-category-input">Feedback Type</label>
                    <select id="fb-category-input" class="fb-form-select">
                        <option value="articles" selected>Articles / Content</option>
                        <option value="bug">Bug Report</option>
                        <option value="feature">Feature Request</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div class="fb-form-group">
                    <label for="fb-subject-input">Subject</label>
                    <input type="text" id="fb-subject-input" class="fb-form-input" placeholder="Short title / summary..." required />
                </div>

                <div class="fb-form-group" id="fb-page-group">
                    <label for="fb-page-input">Related Article / Page Path</label>
                    <input type="text" id="fb-page-input" class="fb-form-input" placeholder="e.g. 1st-grade/fyz/kinematika" />
                </div>

                <div class="fb-form-group">
                    <label for="fb-message-input">Feedback Message</label>
                    <textarea id="fb-message-input" class="fb-form-textarea" placeholder="Describe your feedback, suggestion, or issue in detail..." required></textarea>
                </div>

                <div class="fb-form-group">
                    <label>Attach Images (Optional, max 3)</label>
                    <div id="fb-img-dropzone" class="fb-img-dropzone">
                        <span class="icon" style="font-size: 1.4rem; display:block; margin-bottom: 4px;">add_photo_alternate</span>
                        Click or drag images here to attach
                        <input type="file" id="fb-file-input" accept="image/*" style="display:none;" multiple />
                    </div>
                    <div id="fb-img-previews" class="fb-img-previews"></div>
                </div>
            </div>
            <div class="fb-modal-footer">
                <button id="fb-cancel-btn" class="fb-btn fb-btn-cancel">Cancel</button>
                <button id="fb-submit-btn" class="fb-btn fb-btn-submit">
                    <span class="icon" style="font-size: 1.1rem;">send</span> Submit Feedback
                </button>
            </div>
        </div>
    `;

    const toast = document.createElement('div');
    toast.id = 'fb-toast-notification';
    toast.className = 'fb-toast';
    toast.innerHTML = `<span class="icon" id="fb-toast-icon">check_circle</span> <span id="fb-toast-text">Feedback submitted!</span>`;

    document.body.appendChild(div);
    document.body.appendChild(toast);
}

function setupFeedbackEventListeners() {
    const modal = document.getElementById('send-feedback-modal');
    const closeBtn = document.getElementById('fb-close-modal-btn');
    const cancelBtn = document.getElementById('fb-cancel-btn');
    const submitBtn = document.getElementById('fb-submit-btn');
    const dropzone = document.getElementById('fb-img-dropzone');
    const fileInput = document.getElementById('fb-file-input');

    if (closeBtn) closeBtn.addEventListener('click', closeFeedbackModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeFeedbackModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeFeedbackModal();
        });
    }

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                Array.from(e.target.files).forEach(file => handleImageUpload(file));
                fileInput.value = '';
            }
        });

        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = '#3b82f6'; });
        dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = '#2A2A2A'; });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = '#2A2A2A';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                Array.from(e.dataTransfer.files).forEach(file => handleImageUpload(file));
            }
        });
    }

    if (submitBtn) submitBtn.addEventListener('click', submitFeedback);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeFeedbackModal();
        }
    });
}

async function handleImageUpload(file) {
    if (attachedImages.length >= 3) {
        showToast('Maximum 3 image attachments allowed.', true);
        return;
    }

    const dropzone = document.getElementById('fb-img-dropzone');
    if (dropzone) dropzone.style.opacity = '0.5';

    try {
        const formData = new FormData();
        formData.append('image', file);

        const token = await getAccessToken();
        const response = await fetch(`${API_URL}/upload-feedback-image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Image upload failed');
        }

        const data = await response.json();
        if (data.url) {
            attachedImages.push(data.url);
            renderImagePreviews();
        }
    } catch (err) {
        console.error('Image Upload Error:', err);
        showToast(`Image upload error: ${err.message}`, true);
    } finally {
        if (dropzone) dropzone.style.opacity = '1';
    }
}

function renderImagePreviews() {
    const container = document.getElementById('fb-img-previews');
    if (!container) return;
    container.innerHTML = '';

    attachedImages.forEach((url, idx) => {
        const div = document.createElement('div');
        div.className = 'fb-img-thumb-container';
        div.innerHTML = `
            <img src="${escapeHtml(url)}" class="fb-img-thumb" alt="Attachment ${idx + 1}" />
            <button class="fb-img-remove" data-idx="${idx}" title="Remove image">✕</button>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll('.fb-img-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            if (!isNaN(idx)) {
                attachedImages.splice(idx, 1);
                renderImagePreviews();
            }
        });
    });
}

export async function openFeedbackModal() {
    initFeedbackModal();

    const loggedIn = await initAuth();
    if (!loggedIn) {
        window.location.href = '/login';
        return;
    }

    const user = getUser();
    if (!user) {
        window.location.href = '/login';
        return;
    }

    attachedImages = [];
    renderImagePreviews();

    const nameEl = document.getElementById('fb-user-name');
    const emailEl = document.getElementById('fb-user-email');
    if (nameEl) nameEl.textContent = user.name || 'User';
    if (emailEl) emailEl.textContent = user.email || '';

    const pageInput = document.getElementById('fb-page-input');
    if (pageInput) {
        let currentPath = window.location.pathname.replace(/^\/|\/$/g, '');
        const overridePages = ['', 'index', 'home', 'login', 'signup', 'admin/add-page', 'admin/edit-page', 'admin/feedback', 'admin/logs', 'admin/dashboard', 'admin'];
        
        if (!overridePages.includes(currentPath)) {
            pageInput.value = currentPath;
        } else {
            pageInput.value = '';
        }
    }

    const subjectInput = document.getElementById('fb-subject-input');
    const messageInput = document.getElementById('fb-message-input');
    if (subjectInput) subjectInput.value = '';
    if (messageInput) messageInput.value = '';

    const modal = document.getElementById('send-feedback-modal');
    if (modal) modal.classList.add('active');
}

export function closeFeedbackModal() {
    const modal = document.getElementById('send-feedback-modal');
    if (modal) modal.classList.remove('active');
}

async function submitFeedback() {
    const subject = document.getElementById('fb-subject-input')?.value.trim();
    const message = document.getElementById('fb-message-input')?.value.trim();
    const category = document.getElementById('fb-category-input')?.value || 'articles';
    const page = document.getElementById('fb-page-input')?.value.trim() || window.location.pathname;
    const submitBtn = document.getElementById('fb-submit-btn');

    if (!subject || !message) {
        showToast('Please enter a subject and message.', true);
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="icon spinner">sync</span> Submitting...`;
    }

    let clientIp = '';
    try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        clientIp = ipData.ip;
    } catch(e) {
        console.warn('Could not fetch IP', e);
    }

    try {
        const token = await getAccessToken();
        const user = getUser();
        const response = await fetch(`${API_URL}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: subject,
                subject: subject,
                message: message,
                category: category,
                page: page,
                images: attachedImages,
                ip: clientIp,
                uid: user?.id || '',
                name: user?.name || '',
                contact: user?.email || ''
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to send feedback');
        }

        showToast('Thank you! Your feedback has been submitted.');
        closeFeedbackModal();

    } catch (e) {
        console.error('Feedback Submission Error:', e);
        showToast(`Error: ${e.message}`, true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span class="icon" style="font-size: 1.1rem;">send</span> Submit Feedback`;
        }
    }
}

function showToast(msg, isError = false) {
    const toast = document.getElementById('fb-toast-notification');
    const text = document.getElementById('fb-toast-text');
    const icon = document.getElementById('fb-toast-icon');

    if (!toast) return;

    if (text) text.textContent = msg;
    if (icon) icon.textContent = isError ? 'error' : 'check_circle';

    if (isError) toast.classList.add('error');
    else toast.classList.remove('error');

    toast.classList.add('active');
    setTimeout(() => {
        toast.classList.remove('active');
    }, 4000);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}
