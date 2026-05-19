import { escapeHtml } from '../utils.js';
import { CONFIG } from '../config.js';

const icons = {
    success: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    error:   '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    info:    '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
};

let container = null;

function dismiss(toast, timer) {
    clearTimeout(timer);
    if (!toast.isConnected) return;
    toast.classList.add('hiding');
    setTimeout(() => { if (toast.isConnected) toast.remove(); }, 320);
}

export const Toast = {
    show(message, type = 'success') {
        if (!container) container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `<div class="toast__icon">${icons[type] || icons.info}</div><span class="toast__text">${escapeHtml(message)}</span>`;
        container.appendChild(toast);

        const dismissTimer = setTimeout(() => dismiss(toast, dismissTimer), CONFIG.TOAST_DURATION);
        toast.addEventListener('click', () => dismiss(toast, dismissTimer), { once: true });
    },
};