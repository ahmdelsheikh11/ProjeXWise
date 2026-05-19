export const Confirm = {
    show(message, title = 'تأكيد') {
        return new Promise(resolve => {
            const modal  = document.getElementById('confirmModal');
            if (!modal) {
                resolve(false);
                return;
            }
            document.getElementById('confirmTitle').textContent   = title;
            document.getElementById('confirmMessage').textContent = message;

            const okBtn     = document.getElementById('confirmOkBtn');
            const cancelBtn = document.getElementById('confirmCancelBtn');

            const cleanup = (value) => {
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                modal.classList.remove('open');
                resolve(value);
            };

            const onOk     = () => cleanup(true);
            const onCancel = () => cleanup(false);

            okBtn.addEventListener('click',     onOk,     { once: true });
            cancelBtn.addEventListener('click', onCancel, { once: true });
            modal.classList.add('open');
        });
    },
};