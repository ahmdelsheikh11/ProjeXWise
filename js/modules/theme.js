// Theme Manager
const THEME_KEY = 'kpm-theme';

export const Theme = {
    apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next    = current === 'dark' ? 'light' : 'dark';
        this.apply(next);
        // Toast will be imported later, but we'll use a placeholder
        console.info(next === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح');
    },

    init() {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') {
            this.apply(saved);
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.apply(prefersDark ? 'dark' : 'light');
        }
    },
};