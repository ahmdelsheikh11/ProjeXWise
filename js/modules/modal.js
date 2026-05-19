export const Modal = {
    open(id) {
        document.getElementById(id)?.classList.add('open');
    },
    closeAll() {
        document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    },
};