import { AppState } from '../state.js';
import { CONFIG } from '../config.js';
import { DB } from '../db.js';
import { Toast } from './toast.js';
import { Renderer } from './renderer.js';
import { DisplayRenderer } from './displayRenderer.js';
import { Designs } from './designs.js';
import { SpecsNotes } from './specsNotes.js';
import { LPO } from './lpo.js';
import { formatNumber, hasProjectIdentity, calculateProjectProgress, detectProjectStage, stampProjectDates } from '../utils.js';

export const EntryModal = {
    _open: false,

    open(ptab, stab) {
        this._populate();
        const modal = document.getElementById('entryModal');
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
            this._open = true;
        }
        if (ptab) this.switchPrimary(ptab);
        if (stab) {
            const btn = document.querySelector(`.entry-stab[data-stab="${stab}"]`);
            if (btn) this.switchSecondary(btn.dataset.parent, stab);
        }
        setTimeout(() => {
            const first = document.querySelector('#entryModal .entry-spane.active .form-input:not([readonly])');
            if (first) first.focus();
        }, 300);
    },

    close() {
        const modal = document.getElementById('entryModal');
        if (modal) modal.classList.remove('open');
        document.body.style.overflow = '';
        this._open = false;
    },

    _populate() {
        const p = AppState.current;
        const s = p.specifications || {};
        const f = p.financials || {};

        const sub = document.getElementById('entryModalSubtitle');
        if (sub) {
            const projectLabel = p.name || p.client;
            sub.textContent = projectLabel ? `مشروع: ${projectLabel} — ${p.id}` : 'مشروع جديد';
        }

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
        set('projectId', p.id);
        set('clientInput', p.client);
        set('phoneInput', p.phone);
        set('salesInput', p.sales);
        set('emirateInput', p.emirate);
        set('addressInput', p.address);
        set('locationInput', p.location);
        set('projectNameInput', p.name);
        set('dateInput', p.date);
        set('deliveryDateInput', p.dates?.deliveryDate || '');
        CONFIG.SPEC_FIELDS.forEach(field => set(field.key + 'Input', s[field.key]));
        set('totalAmountInput', f.totalAmount || 0);
        set('discountInput', f.discount || 0);
        set('paidInput', f.paid || 0);

        SpecsNotes.render();
        this._populateModalLPO();
        this._updateLive();
        Designs.renderIn('modalDesignsGallery');
    },

    _populateModalLPO() {
        const sel = document.getElementById('lpoStageSelectM');
        if (!sel) return;
        sel.innerHTML = Object.entries(CONFIG.STAGES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
        const sup = document.getElementById('lpoSupplierInput');
        const supM = document.getElementById('lpoSupplierInputM');
        if (sup && supM) supM.value = sup.value;
        const tax = document.getElementById('lpoTaxInput');
        const taxM = document.getElementById('lpoTaxInputM');
        if (tax && taxM) taxM.checked = tax.checked;
        const rate = document.getElementById('lpoTaxRateInput');
        const rateM = document.getElementById('lpoTaxRateInputM');
        if (rate && rateM) rateM.value = rate.value;
    },

    async saveAndClose() {
        this._collectFields();

        if (!hasProjectIdentity()) {
            document.getElementById('projectNameInput')?.focus();
            Toast.show('اسم المشروع مطلوب', 'error');
            return;
        }

        AppState.current.updatedAt = new Date().toISOString();
        AppState.current.progress = calculateProjectProgress(AppState.current);
        AppState.current.currentStage = detectProjectStage(AppState.current);
        stampProjectDates(AppState.current);

        try {
            await DB.saveProject(AppState.current);
            AppState.hasActiveProject = true;
            Renderer.renderAll(AppState.current);
            DisplayRenderer.renderAll(AppState.current);
            if (window.updateProjectWorkspaceVisibility) window.updateProjectWorkspaceVisibility();
            Designs.render();
            Toast.show('تم حفظ بيانات المشروع ✓', 'success');
            this.close();
        } catch (err) {
            Toast.show('خطأ في الحفظ: ' + err.message, 'error');
        }
    },

    _collectFields() {
        const get = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
        const getN = (id) => parseFloat(document.getElementById(id)?.value) || 0;

        AppState.current.client = get('clientInput');
        AppState.current.phone = get('phoneInput');
        AppState.current.sales = get('salesInput');
        AppState.current.emirate = get('emirateInput');
        AppState.current.address = get('addressInput');
        AppState.current.location = get('locationInput');
        AppState.current.name = get('projectNameInput');
        AppState.current.date = get('dateInput');
        AppState.current.dates = AppState.current.dates || {};
        AppState.current.dates.deliveryDate = get('deliveryDateInput') || null;

        CONFIG.SPEC_FIELDS.forEach(field => {
            const el = document.getElementById(field.key + 'Input');
            if (el) AppState.current.specifications[field.key] = el.value.trim();
        });

        AppState.current.financials = {
            totalAmount: getN('totalAmountInput'),
            discount: getN('discountInput'),
            paid: getN('paidInput'),
        };
    },

    _updateLive() {
        const total = parseFloat(document.getElementById('totalAmountInput')?.value) || 0;
        const discount = parseFloat(document.getElementById('discountInput')?.value) || 0;
        const paid = parseFloat(document.getElementById('paidInput')?.value) || 0;
        const net = total - discount;
        const remaining = net - paid;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatNumber(val) + ' درهم'; };
        set('flsNet', net);
        set('flsPaid', paid);
        set('flsRemaining', remaining);
        const rem = document.getElementById('flsRemaining');
        if (rem) rem.style.color = remaining > 0 ? 'var(--clr-danger-text)' : remaining < 0 ? 'var(--clr-warning-text)' : 'var(--clr-success-text)';
    },

    switchPrimary(ptab) {
        document.querySelectorAll('.entry-ptab').forEach(b => {
            b.classList.toggle('active', b.dataset.ptab === ptab);
        });
        document.querySelectorAll('.entry-ppane').forEach(p => {
            p.classList.toggle('active', p.id === `entryPane-${ptab}`);
        });
        if (ptab === 'materials') {
            const modal = document.getElementById('modalItemsLists');
            if (modal) modal.innerHTML = document.getElementById('itemsLists')?.innerHTML || '';
        }
    },

    switchSecondary(parent, stab) {
        document.querySelectorAll(`.entry-stab[data-parent="${parent}"]`).forEach(b => {
            b.classList.toggle('active', b.dataset.stab === stab);
        });
        const paneId = `entrySpane-${parent}-${stab}`;
        document.querySelectorAll(`#entryPane-${parent} .entry-spane`).forEach(p => {
            p.classList.toggle('active', p.id === paneId);
        });
        if (stab === 'view-items') {
            const modal = document.getElementById('modalItemsLists');
            if (modal) modal.innerHTML = document.getElementById('itemsLists')?.innerHTML || '';
        }
    },

    _syncLPOFromModal() {
        const sync = (fromId, toId) => {
            const from = document.getElementById(fromId);
            const to = document.getElementById(toId);
            if (from && to) to.value = from.value;
        };
        const syncChk = (fromId, toId) => {
            const from = document.getElementById(fromId);
            const to = document.getElementById(toId);
            if (from && to) to.checked = from.checked;
        };
        sync('lpoStageSelectM', 'lpoStageSelect');
        sync('lpoSupplierInputM', 'lpoSupplierInput');
        sync('lpoTaxRateInputM', 'lpoTaxRateInput');
        syncChk('lpoTaxInputM', 'lpoTaxInput');
    },

    init() {
        document.querySelectorAll('.entry-ptab').forEach(btn => {
            btn.addEventListener('click', () => this.switchPrimary(btn.dataset.ptab));
        });
        document.querySelectorAll('.entry-stab').forEach(btn => {
            btn.addEventListener('click', () => this.switchSecondary(btn.dataset.parent, btn.dataset.stab));
        });
        document.querySelectorAll('[data-action="close-entry-modal"]').forEach(el => {
            el.addEventListener('click', () => this.close());
        });
        document.querySelector('[data-action="save-from-entry-modal"]')?.addEventListener('click', () => this.saveAndClose());
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && this._open) this.close(); });
        ['totalAmountInput', 'discountInput', 'paidInput'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this._updateLive());
        });
        document.addEventListener('click', e => {
            const btn = e.target.closest('[data-action="open-entry-modal"]');
            if (btn) {
                e.preventDefault();
                this.open(btn.dataset.tab || 'project', null);
            }
        });
        document.getElementById('modalLpoBtn')?.addEventListener('click', () => {
            this._syncLPOFromModal();
            LPO.generate();
        });
        document.getElementById('modalFullLpoBtn')?.addEventListener('click', () => {
            this._syncLPOFromModal();
            LPO.generateFull();
        });
    },
};