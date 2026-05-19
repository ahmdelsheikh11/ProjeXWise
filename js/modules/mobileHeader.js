export const MobileHeader = {
    init() {
        const media = window.matchMedia('(max-width: 640px)');
        const sync = () => {
            if (!media.matches) this.close();
        };
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', sync);
        } else if (typeof media.addListener === 'function') {
            media.addListener(sync);
        }
        document.addEventListener('click', (event) => {
            if (!media.matches) return;
            const header = document.querySelector('.app-header');
            if (!header?.classList.contains('is-mobile-menu-open')) return;
            if (event.target.closest('.header__mobile-toggle, .header__extras')) return;
            header.classList.remove('is-mobile-menu-open');
        });
    },
    toggle() {
        const header = document.querySelector('.app-header');
        if (!header || window.innerWidth > 640) return;
        header.classList.toggle('is-mobile-menu-open');
    },
    close() {
        document.querySelector('.app-header')?.classList.remove('is-mobile-menu-open');
    },
};