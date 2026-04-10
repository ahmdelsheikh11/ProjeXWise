/**
 * ===============================================================
 * KITCHEN PROJECT MANAGER - app.js v2.0
 * Refactored: modular, clean, ES6+, no global pollution
 * Architecture: Config â†’ State â†’ Utils â†’ DB â†’ UI Modules â†’ Events â†’ Init
 * ===============================================================
 */

// ===============================================================
// 1. CONFIGURATION (frozen, single source of truth)
// ===============================================================
const CONFIG = Object.freeze({
    DB_NAME:    'KitchenProjectsDB',
    DB_VERSION: 3,

    STORES: Object.freeze({
        PROJECTS:  'projects',
        MATERIALS: 'materials',
        LOGO:      'logo',
        DESIGNS:   'designs',
    }),

    STAGES: Object.freeze({
        boxes:      'مرحلة البوكسات',
        doors:      'مرحلة الضلفات',
        counter:    'مرحلة الرخام',
        accessories:'الإكسسوارات',
        appliances: 'الأجهزة الكهربائية',
        support:    'مواد مساعدة',
    }),

    UNITS: ['بار', 'قطعة', 'شيت', 'متر', 'رول', 'طقم', 'كيس', 'علبة'],

    SPEC_FIELDS: [
        { key: 'boxType',           label: 'نوع البوكسات' },
        { key: 'boxColor',          label: 'لون البوكسات' },
        { key: 'doorType',          label: 'نوع الضلفات' },
        { key: 'doorColor',         label: 'لون الضلفات' },
        { key: 'drawerType',        label: 'نوع الأدراج' },
        { key: 'drawerCount',       label: 'عدد الأدراج' },
        { key: 'lightsNeeded',      label: 'الإضاءة' },
        { key: 'lightsDescription', label: 'وصف الإضاءة' },
        { key: 'handleType',        label: 'نوع المسكات' },
        { key: 'handleColor',       label: 'لون المسكات' },
        { key: 'counterType',       label: 'نوع الرخام / البورسلين' },
        { key: 'counterColor',      label: 'لون الرخام' },
        { key: 'skirtingNeeded',    label: 'النعلة السفلية' },
        { key: 'upperFillerNeeded', label: 'الفيلر العلوي' },
        { key: 'islandNeeded',      label: 'الجزيرة' },
        { key: 'islandDescription', label: 'مواصفات الجزيرة' },
    ],

    WORKFLOW_STEPS: [
        { key: 'initial_measure',     label: 'رفع المقاسات المبدئية',                        phase: 'pre_sales',      phaseLabel: 'ما قبل البيع والتصميم' },
        { key: 'contract_signed',     label: 'الاتفاق والتعاقد',                              phase: 'pre_sales' },
        { key: '3d_design',           label: 'التصميم ثلاثي الأبعاد',                         phase: 'pre_sales' },
        { key: 'handover_to_technical', label: 'تحويل التفاصيل من المبيعات للمكتب الفني',   phase: 'technical_prep', phaseLabel: 'الإعداد الفني' },
        { key: 'job_order_created',   label: 'إنشاء الجوب أوردر وLPO',                       phase: 'technical_prep' },
        { key: 'cutting_list_approved', label: 'اعتماد قائمة التقطيع',                       phase: 'technical_prep' },
        { key: 'material_qc',         label: 'فحص جودة الخامات قبل التصنيع',                 phase: 'quality_control', phaseLabel: 'ضبط الجودة', critical: true },
        { key: 'frame_purchase',      label: 'شراء مواد البوكسات',                            phase: 'frame_production', phaseLabel: 'تصنيع البوكسات' },
        { key: 'frame_fabrication',   label: 'تصنيع البوكسات',                                phase: 'frame_production' },
        { key: 'frame_delivery',      label: 'توريد البوكسات للموقع',                         phase: 'frame_production' },
        { key: 'frame_installation',  label: 'تثبيت البوكسات',                                phase: 'frame_production' },
        { key: 'panel_purchase',      label: 'شراء مواد الضلفات',                             phase: 'panel_production', phaseLabel: 'تصنيع الضلفات' },
        { key: 'panel_fabrication',   label: 'تصنيع الضلفات',                                 phase: 'panel_production' },
        { key: 'panel_installation',  label: 'تثبيت الضلفات',                                 phase: 'panel_production' },
        { key: 'accessories_purchase', label: 'شراء الإكسسوارات',                            phase: 'finishing', phaseLabel: 'الإكسسوارات والكهرباء' },
        { key: 'electrical_purchase', label: 'شراء الأجهزة الكهربائية',                       phase: 'finishing' },
        { key: 'final_installation',  label: 'التثبيت النهائي (إكسسوارات + كهرباء)',         phase: 'finishing' },
        { key: 'client_qc',           label: 'معاينة العميل الأولية',                         phase: 'delivery', phaseLabel: 'التسليم', critical: true },
        { key: 'final_adjustments',   label: 'التعديلات النهائية',                             phase: 'delivery' },
        { key: 'handover_signed',     label: 'التسليم النهائي وتوقيع الاستلام',               phase: 'delivery', critical: true },
    ],

    TOAST_DURATION:   3200,
    DEFAULT_TAX_RATE: 5,
    AUTO_TAX_RATE:    5,
    AUTO_SAVE_DELAY:  5000,
});

// Flat list of workflow step keys for iteration
const WORKFLOW_STEP_KEYS = CONFIG.WORKFLOW_STEPS.map(s => s.key);

// ===============================================================
// 2. APPLICATION STATE
// ===============================================================

/** Creates a fresh empty project object */
function createEmptyProject() {
    const items    = {};
    const workflow = {};
    Object.keys(CONFIG.STAGES).forEach(k => { items[k] = []; });
    WORKFLOW_STEP_KEYS.forEach(k => { workflow[k] = false; });

    return {
        id:        generateProjectId(),
        name:      '',
        client:    '',
        phone:     '',
        emirate:   '',
        address:   '',
        location:  '',
        sales:     '',
        date:      todayString(),
        deliveryDate: '',
        specifications: {
            boxType: 'ألومينيوم', boxColor: '9010 حليبي',
            doorType: '', doorColor: '',
            drawerType: '', drawerCount: '',
            lightsNeeded: '', lightsDescription: '',
            handleType: '', handleColor: '',
            counterType: '', counterColor: '',
            skirtingNeeded: '', upperFillerNeeded: '',
            islandNeeded: '', islandDescription: '',
            notes: [],
        },
        designs:   [],
        items,
        financials: { discount: 0, paid: 0, totalAmount: 0 },
        workflow,
        progress:  0,
        currentStage: 'pre_sales',
        dates: {
            contractDate:   todayString(),
            measureDate:    null,
            productionStart:null,
            installDate:    null,
            deliveryDate:   null,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

/** Mutable application state (single object to avoid scattered globals) */
const AppState = {
    current: createEmptyProject(),
    db:      null,
};

// ===============================================================
// 3. UTILITY HELPERS
// ===============================================================

/** Returns today as YYYY-MM-DD */
function todayString() {
    return new Date().toISOString().split('T')[0];
}

/** Generates a unique project ID */
function generateProjectId() {
    const d    = new Date();
    const yy   = d.getFullYear().toString().slice(-2);
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 50)).padStart(2, '0');
    return `AMK-JO-${yy}${mm}${dd}-${rand}`;
}

/** Formats a number to 2 decimal places with locale separators */
function formatNumber(n) {
    return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formats a date string to a human-readable form */
function formatDate(dateStr) {
    if (!dateStr) return 'غير محدد';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
}

/** Safely escapes HTML to prevent XSS */
function escapeHtml(str) {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode(String(str || '')));
    return el.innerHTML;
}

/** Deep-clones a JSON-serialisable value */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/** Returns the default paint colour (door colour) */
function getDefaultPaintColor() {
    return AppState.current.specifications.doorColor || '';
}

// --- Financial calculations ----------------------------------

/** Calculates the total cost of one stage's items (materials + paint) */
function calcStageTotal(items) {
    return items.reduce((sum, item) => {
        const itemCost  = (item.qty || 0) * (item.price || 0);
        const paintCost = item.needsPaint ? ((item.qty || 0) * (item.paintCostPerUnit || 0)) : 0;
        return sum + itemCost + paintCost;
    }, 0);
}

/** Calculates the grand total across all stages */
function calcMaterialsTotal(project) {
    return Object.values(project.items).reduce(
        (sum, stageItems) => sum + calcStageTotal(stageItems), 0
    );
}

// --- Workflow helpers ----------------------------------------

/** Returns progress (0â€“100) based on completed workflow steps */
function calculateProjectProgress(project) {
    const completed = WORKFLOW_STEP_KEYS.filter(k => project.workflow[k] === true).length;
    return Math.round((completed / WORKFLOW_STEP_KEYS.length) * 100);
}

/** Auto-detects the current workflow stage label */
function detectProjectStage(project) {
    const w = project.workflow;
    if (w.handover_signed)                                return 'delivery_complete';
    if (w.final_adjustments)                             return 'delivery_adjustments';
    if (w.client_qc)                                     return 'client_qc';
    if (w.final_installation)                            return 'finishing_installation';
    if (w.electrical_purchase || w.accessories_purchase) return 'finishing_purchase';
    if (w.panel_installation)                            return 'panel_installation';
    if (w.panel_fabrication)                             return 'panel_fabrication';
    if (w.panel_purchase)                                return 'panel_purchase';
    if (w.frame_installation)                            return 'frame_installation';
    if (w.frame_delivery)                                return 'frame_delivery';
    if (w.frame_fabrication)                             return 'frame_fabrication';
    if (w.frame_purchase)                                return 'frame_purchase';
    if (w.material_qc)                                   return 'quality_control';
    if (w.cutting_list_approved)                         return 'cutting_approved';
    if (w.job_order_created)                             return 'job_order';
    if (w.handover_to_technical)                         return 'technical_handover';
    if (w['3d_design'])                                  return 'design';
    if (w.contract_signed)                               return 'contract';
    if (w.initial_measure)                               return 'measurement';
    return 'pre_sales';
}

/** Stamps key milestone dates automatically */
function stampProjectDates(project) {
    const w     = project.workflow;
    const today = todayString();
    if (w.initial_measure   && !project.dates.measureDate)     project.dates.measureDate     = today;
    if (w.frame_fabrication && !project.dates.productionStart) project.dates.productionStart = today;
    if (w.final_installation && !project.dates.installDate)    project.dates.installDate     = today;
    if (w.handover_signed   && !project.dates.deliveryDate)    project.dates.deliveryDate    = today;
}

/** Returns the next pending workflow step object, or null if everything is done */
function getNextWorkflowStep(project) {
    return CONFIG.WORKFLOW_STEPS.find(step => !project.workflow?.[step.key]) || null;
}

/** Returns remaining days until delivery or null when unavailable */
function getRemainingDays(project) {
    if (!project?.dates?.deliveryDate) return null;
    return Math.floor((new Date(project.dates.deliveryDate) - Date.now()) / 86400000);
}

/** Migrates old workflow structure to the current one */
function migrateWorkflow(project) {
    if (!project.workflow) project.workflow = {};
    const old = project.workflow;
    const fresh = {};
    WORKFLOW_STEP_KEYS.forEach(k => { fresh[k] = false; });

    // Map legacy keys to new keys
    const legacyMap = {
        site_measure:       'initial_measure',
        contract:           'contract_signed',
        cutting_list_ready: 'cutting_list_approved',
        cutting_done:       'frame_fabrication',
        installed:          'panel_installation',
        delivered:          'handover_signed',
        qc_passed:          'material_qc',
        ready_for_install:  'final_installation',
    };

    Object.entries(legacyMap).forEach(([oldKey, newKey]) => {
        if (old[oldKey] !== undefined) fresh[newKey] = old[oldKey];
    });

    // Preserve existing new-format keys
    WORKFLOW_STEP_KEYS.forEach(k => {
        if (old[k] !== undefined) fresh[k] = old[k];
    });

    project.workflow = fresh;
    return project;
}

/** Ensures required fields exist when loading an older project */
function normaliseProject(project) {
    project = migrateWorkflow(project);
    if (!project.specifications.notes) project.specifications.notes = [];
    if (!project.designs)              project.designs = [];
    if (!project.dates) {
        project.dates = {
            contractDate:    project.date || todayString(),
            measureDate:     null,
            productionStart: null,
            installDate:     null,
            deliveryDate:    null,
        };
    }
    project.progress     = calculateProjectProgress(project);
    project.currentStage = detectProjectStage(project);
    stampProjectDates(project);
    return project;
}

// ===============================================================
// 4. INDEXEDDB STORAGE LAYER
// ===============================================================

const DB = {
    /** Opens (or creates) the database */
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
            request.onerror  = () => reject(request.error);
            request.onsuccess = () => { AppState.db = request.result; resolve(AppState.db); };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(CONFIG.STORES.PROJECTS)) {
                    const store = db.createObjectStore(CONFIG.STORES.PROJECTS, { keyPath: 'id' });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                if (!db.objectStoreNames.contains(CONFIG.STORES.MATERIALS)) {
                    const store = db.createObjectStore(CONFIG.STORES.MATERIALS, { keyPath: 'name' });
                    store.createIndex('price',    'price',    { unique: false });
                    store.createIndex('lastUsed', 'lastUsed', { unique: false });
                }
                if (!db.objectStoreNames.contains(CONFIG.STORES.LOGO)) {
                    db.createObjectStore(CONFIG.STORES.LOGO);
                }
                if (!db.objectStoreNames.contains(CONFIG.STORES.DESIGNS)) {
                    db.createObjectStore(CONFIG.STORES.DESIGNS, { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    },

    /** Generic wrapper for a single-request transaction */
    _request(storeName, mode, operation) {
        return new Promise((resolve, reject) => {
            const tx      = AppState.db.transaction([storeName], mode);
            const store   = tx.objectStore(storeName);
            const request = operation(store);
            request.onsuccess = () => resolve(request.result);
            request.onerror   = () => reject(request.error);
        });
    },

    // -- Projects --------------------------------------------

    saveProject(project) {
        return this._request(CONFIG.STORES.PROJECTS, 'readwrite', s => s.put(project));
    },

    async loadProjects() {
        const projects = await this._request(CONFIG.STORES.PROJECTS, 'readonly', s => s.getAll());
        return (projects || []).map(p => migrateWorkflow(p));
    },

    async getProject(id) {
        const project = await this._request(CONFIG.STORES.PROJECTS, 'readonly', s => s.get(id));
        return project ? normaliseProject(project) : null;
    },

    deleteProject(id) {
        return this._request(CONFIG.STORES.PROJECTS, 'readwrite', s => s.delete(id));
    },

    deleteAllProjects() {
        return this._request(CONFIG.STORES.PROJECTS, 'readwrite', s => s.clear());
    },

    // -- Materials (autocomplete cache) -----------------------

    saveMaterial(name, price) {
        const record = { name, price, lastUsed: new Date().toISOString() };
        return this._request(CONFIG.STORES.MATERIALS, 'readwrite', s => s.put(record));
    },

    async searchMaterials(query) {
        const all = await this._request(CONFIG.STORES.MATERIALS, 'readonly', s => s.getAll());
        const materials = all || [];
        if (!query) return materials.slice(0, 10);
        return materials
            .filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 10);
    },

    // -- Designs ---------------------------------------------

    saveDesign(imageData) {
        const design = { data: imageData, projectId: AppState.current.id, uploadedAt: new Date().toISOString() };
        return this._request(CONFIG.STORES.DESIGNS, 'readwrite', s => s.add(design));
    },

    async getDesignsForProject(projectId) {
        const all = await this._request(CONFIG.STORES.DESIGNS, 'readonly', s => s.getAll());
        return (all || []).filter(d => d.projectId === projectId);
    },

    deleteDesign(id) {
        return this._request(CONFIG.STORES.DESIGNS, 'readwrite', s => s.delete(id));
    },

    async deleteAllDesignsForProject(projectId) {
        const designs = await this.getDesignsForProject(projectId);
        return Promise.all(designs.map(d => this.deleteDesign(d.id)));
    },
};

// ===============================================================
// 5. TOAST NOTIFICATIONS
// ===============================================================

const Toast = {
    _container: null,

    _icons: {
        success: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
        error:   '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
        info:    '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
    },

    show(message, type = 'success') {
        if (!this._container) this._container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `<div class="toast__icon">${this._icons[type] || this._icons.info}</div><span class="toast__text">${escapeHtml(message)}</span>`;
        this._container.appendChild(toast);

        const dismiss = () => this._dismiss(toast, dismissTimer);
        const dismissTimer = setTimeout(dismiss, CONFIG.TOAST_DURATION);
        toast.addEventListener('click', dismiss, { once: true });
    },

    _dismiss(toast, timer) {
        clearTimeout(timer);
        if (!toast.isConnected) return;
        toast.classList.add('hiding');
        // Wait for CSS animation (320ms) then hard-remove
        setTimeout(() => { if (toast.isConnected) toast.remove(); }, 320);
    },
};

// ===============================================================
// 6. CONFIRM DIALOG
// ===============================================================

const Confirm = {
    show(message, title = 'تأكيد') {
        return new Promise(resolve => {
            const modal  = document.getElementById('confirmModal');
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

// ===============================================================
// 7. MODAL MANAGER
// ===============================================================

const Modal = {
    open(id) {
        document.getElementById(id)?.classList.add('open');
    },
    closeAll() {
        document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    },
};

// ===============================================================
// 9. AUTOCOMPLETE
// ===============================================================

const Autocomplete = {
    active:        false,
    selectedIndex: -1,

    /** Positions the portal list underneath the input using fixed coords */
    _reposition() {
        const input = document.getElementById('itemNameInput');
        const list  = document.getElementById('autocompleteList');
        if (!input || !list) return;

        const rect = input.getBoundingClientRect();
        list.style.top   = (rect.bottom + 4) + 'px';
        list.style.left  = rect.left + 'px';
        list.style.width = rect.width + 'px';
        // Flip upward if not enough space below
        const spaceBelow = window.innerHeight - rect.bottom;
        const listH      = Math.min(220, list.scrollHeight || 220);
        if (spaceBelow < listH + 8 && rect.top > listH + 8) {
            list.style.top    = (rect.top - listH - 4) + 'px';
            list.style.bottom = 'auto';
        }
    },

    async show(query) {
        const materials = await DB.searchMaterials(query);
        const list      = document.getElementById('autocompleteList');
        if (!list) return;

        if (materials.length === 0) { this.hide(); return; }

        list.innerHTML = materials.map((m, i) => `
            <div class="autocomplete-item" role="option" data-index="${i}" data-name="${escapeHtml(m.name)}" data-price="${m.price}">
                <span class="autocomplete-item__name">${escapeHtml(m.name)}</span>
                <span class="autocomplete-item__price">${formatNumber(m.price)}</span>
            </div>
        `).join('');

        list.style.display = 'block';
        this._reposition();
        this.active        = true;
        this.selectedIndex = -1;
    },

    hide() {
        const list         = document.getElementById('autocompleteList');
        if (!list) return;
        list.innerHTML     = '';
        list.style.display = 'none';
        this.active        = false;
        this.selectedIndex = -1;
    },

    select(item) {
        document.getElementById('itemNameInput').value  = item.dataset.name;
        document.getElementById('itemPriceInput').value = parseFloat(item.dataset.price);
        this.hide();
    },

    navigate(direction) {
        if (!this.active) return;
        const items = document.querySelectorAll('.autocomplete-item');
        if (!items.length) return;

        items[this.selectedIndex]?.classList.remove('selected');
        this.selectedIndex = direction === 'down'
            ? Math.min(this.selectedIndex + 1, items.length - 1)
            : Math.max(this.selectedIndex - 1, 0);

        items[this.selectedIndex].classList.add('selected');
        items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
    },

    selectCurrent() {
        if (!this.active || this.selectedIndex < 0) return false;
        const item = document.querySelectorAll('.autocomplete-item')[this.selectedIndex];
        if (item) { this.select(item); return true; }
        return false;
    },
};

// ===============================================================
// 10. SPECS NOTES
// ===============================================================

const SpecsNotes = {
    _editingIndex: -1,

    add() {
        const input = document.getElementById('specsNotesInput');
        const note  = input.value.trim();
        if (!note) { Toast.show('يجب كتابة ملاحظة', 'error'); return; }

        if (!AppState.current.specifications.notes) AppState.current.specifications.notes = [];
        AppState.current.specifications.notes.push(note);
        input.value = '';
        this._editingIndex = -1;
        this.render();
    },

    startEdit(index) {
        const notes = AppState.current.specifications.notes || [];
        if (index < 0 || index >= notes.length) return;
        this._editingIndex = index;
        this.render();
        // Focus the inline edit input after render
        const editInput = document.getElementById(`noteEditInput-${index}`);
        if (editInput) { editInput.focus(); editInput.select(); }
    },

    confirmEdit(index) {
        const editInput = document.getElementById(`noteEditInput-${index}`);
        if (!editInput) return;
        const val = editInput.value.trim();
        if (!val) { Toast.show('لا يمكن حفظ ملاحظة فارغة', 'error'); return; }
        AppState.current.specifications.notes[index] = val;
        this._editingIndex = -1;
        this.render();
        Toast.show('تم تحديث الملاحظة');
    },

    cancelEdit() {
        this._editingIndex = -1;
        this.render();
    },

    delete(index) {
        AppState.current.specifications.notes.splice(index, 1);
        if (this._editingIndex === index) this._editingIndex = -1;
        this.render();
    },

    render() {
        const list  = document.getElementById('specsNotesList');
        const notes = AppState.current.specifications.notes || [];

        // Also update the add-button label if in "add" mode
        const addBtn  = document.querySelector('[data-action="add-spec-note"]');
        const noteInp = document.getElementById('specsNotesInput');

        if (notes.length === 0) {
            list.innerHTML = '<p class="notes-empty">لا توجد ملاحظات بعد</p>';
            return;
        }

        list.innerHTML = notes.map((note, idx) => {
            if (idx === this._editingIndex) {
                // Inline edit mode
                return `
                    <div class="note-item note-item--editing">
                        <span class="note-item__bullet">âœڈï¸ڈ</span>
                        <input
                            type="text"
                            id="noteEditInput-${idx}"
                            class="form-input note-item__edit-input"
                            value="${escapeHtml(note)}"
                            data-note-index="${idx}" />
                        <button class="btn btn--success btn--icon btn--xs" data-action="confirm-edit-note" data-index="${idx}" title="حفظ" aria-label="حفظ الملاحظة">
                            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        </button>
                        <button class="btn btn--ghost btn--icon btn--xs" data-action="cancel-edit-note" title="إلغاء" aria-label="إلغاء التعديل">
                            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                    </div>`;
            }
            return `
                <div class="note-item">
                    <span class="note-item__bullet">📌</span>
                    <span class="note-item__text">${escapeHtml(note)}</span>
                    <button class="btn btn--ghost btn--icon btn--xs" data-action="edit-spec-note" data-index="${idx}" title="تعديل" aria-label="تعديل الملاحظة">
                        <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="btn btn--danger btn--icon btn--xs" data-action="delete-spec-note" data-index="${idx}" title="حذف" aria-label="حذف الملاحظة">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>`;
        }).join('');
    },
};

// ===============================================================
// 11. ITEMS (MATERIALS) MANAGEMENT
// ===============================================================

const Items = {
    _editTarget: null, // { stage, index } while editing

    /** Collects item form values. Returns null if validation fails. */
    _readItemForm(prefix = '') {
        const nameInput  = document.getElementById(prefix + 'itemNameInput')  || document.getElementById('editItemName');
        const qtyInput   = document.getElementById(prefix + 'itemQtyInput')   || document.getElementById('editItemQty');
        const unitInput  = document.getElementById(prefix + 'itemUnitSelect') || document.getElementById('editItemUnit');
        const priceInput = document.getElementById(prefix + 'itemPriceInput') || document.getElementById('editItemPrice');
        const paintCheck = document.getElementById(prefix + 'itemNeedsPaintInput') || document.getElementById('editItemNeedsPaint');
        const paintCost  = document.getElementById(prefix + 'itemPaintCostInput')  || document.getElementById('editItemPaintCost');
        const paintColor = document.getElementById(prefix + 'itemPaintColorInput') || document.getElementById('editItemPaintColor');

        const name      = nameInput.value.trim();
        const unit      = unitInput.value;
        const qty       = parseFloat(qtyInput.value)   || 0;
        const price     = parseFloat(priceInput.value) || 0;
        const needsPaint = paintCheck.checked;
        const paintCostPerUnit = needsPaint ? (parseFloat(paintCost?.value) || 0) : 0;
        const paintColorValue  = needsPaint ? (paintColor?.value || getDefaultPaintColor()) : '';

        if (!name) { Toast.show('يجب إدخال اسم المادة', 'error'); return null; }
        if (!unit) { Toast.show('يجب اختيار الوحدة',   'error'); return null; }

        return { name, qty, unit, price, needsPaint, paintCostPerUnit, paintColor: paintColorValue };
    },

    async add() {
        const stage = document.getElementById('itemStageSelect').value;
        const item  = this._readItemForm('item');
        if (!item) return;

        AppState.current.items[stage].push(item);
        await DB.saveMaterial(item.name, item.price);
        this._clearAddForm();
        Renderer.renderItemsLists(AppState.current);
        Renderer.renderKPIs(AppState.current);
        Toast.show('تمت إضافة المادة');
    },

    openEditModal(stage, index) {
        const item = AppState.current.items[stage][index];
        if (!item) return;
        this._editTarget = { stage, index };

        document.getElementById('editItemStage').value  = stage;
        document.getElementById('editItemIndex').value  = index;
        document.getElementById('editItemName').value   = item.name;
        document.getElementById('editItemQty').value    = item.qty;
        document.getElementById('editItemUnit').value   = item.unit || '';
        document.getElementById('editItemPrice').value  = item.price;
        document.getElementById('editItemNeedsPaint').checked = item.needsPaint || false;
        document.getElementById('editItemPaintCost').value  = item.paintCostPerUnit || 0;
        document.getElementById('editItemPaintColor').value = item.paintColor || '';
        document.getElementById('editPaintFields').style.display = item.needsPaint ? 'block' : 'none';

        Modal.open('editItemModal');
    },

    async update() {
        if (!this._editTarget) { Toast.show('لا توجد مادة للتعديل', 'error'); return; }

        const { stage, index } = this._editTarget;

        const nameInput  = document.getElementById('editItemName');
        const qtyInput   = document.getElementById('editItemQty');
        const unitInput  = document.getElementById('editItemUnit');
        const priceInput = document.getElementById('editItemPrice');
        const paintCheck = document.getElementById('editItemNeedsPaint');
        const paintCost  = document.getElementById('editItemPaintCost');
        const paintColor = document.getElementById('editItemPaintColor');

        const name       = nameInput.value.trim();
        const unit       = unitInput.value;
        if (!name) { Toast.show('يجب إدخال اسم المادة', 'error'); return; }
        if (!unit) { Toast.show('يجب اختيار الوحدة',   'error'); return; }

        const needsPaint       = paintCheck.checked;
        const paintCostPerUnit = needsPaint ? (parseFloat(paintCost.value) || 0) : 0;
        const paintColorValue  = needsPaint ? (paintColor.value || getDefaultPaintColor()) : '';

        AppState.current.items[stage][index] = {
            name,
            qty:  parseFloat(qtyInput.value)   || 0,
            unit,
            price:parseFloat(priceInput.value) || 0,
            needsPaint,
            paintCostPerUnit,
            paintColor: paintColorValue,
        };

        await DB.saveMaterial(name, parseFloat(priceInput.value) || 0);
        this._editTarget = null;
        Modal.closeAll();
        Renderer.renderItemsLists(AppState.current);
        Renderer.renderKPIs(AppState.current);
        Toast.show('تم تحديث المادة بنجاح');
    },

    async delete(stage, index) {
        const itemName  = AppState.current.items[stage][index]?.name;
        const confirmed = await Confirm.show(`هل تريد حذف المادة "${itemName}"؟`, 'حذف المادة');
        if (!confirmed) return;

        AppState.current.items[stage].splice(index, 1);
        Renderer.renderItemsLists(AppState.current);
        Renderer.renderKPIs(AppState.current);
        Toast.show('تم حذف المادة');
    },

    _clearAddForm() {
        ['itemNameInput', 'itemQtyInput', 'itemPriceInput'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const unitSelect = document.getElementById('itemUnitSelect');
        if (unitSelect) unitSelect.value = '';
        const paintCheck = document.getElementById('itemNeedsPaintInput');
        if (paintCheck) paintCheck.checked = false;
        const paintCost  = document.getElementById('itemPaintCostInput');
        if (paintCost)  paintCost.value = '';
        const paintColor = document.getElementById('itemPaintColorInput');
        if (paintColor) paintColor.value = getDefaultPaintColor();
        const paintFields = document.getElementById('paintFields');
        if (paintFields) paintFields.style.display = 'none';
    },
};

// ===============================================================
// 12. DESIGNS GALLERY
// ===============================================================

const Designs = {
    async upload() {
        const fileInput = document.getElementById('designFileInput');
        const files     = fileInput.files;
        if (!files || files.length === 0) { Toast.show('لم يتم اختيار أي ملفات', 'error'); return; }

        const MAX_SIZE = 5 * 1024 * 1024;
        let uploaded   = 0;

        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) { Toast.show(`الملف "${file.name}" ليس صورة`, 'error'); continue; }
            if (file.size > MAX_SIZE)            { Toast.show(`الملف "${file.name}" أكبر من 5MB`, 'error'); continue; }

            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        await DB.saveDesign(e.target.result);
                        uploaded++;
                    } catch (err) {
                        Toast.show(`خطأ في تحميل "${file.name}"`, 'error');
                    }
                    resolve();
                };
                reader.onerror = () => { Toast.show(`خطأ في قراءة "${file.name}"`, 'error'); resolve(); };
                reader.readAsDataURL(file);
            });
        }

        if (uploaded > 0) Toast.show(`تم تحميل ${uploaded} صورة`);
        fileInput.value = '';
        await this.render();
    },

    async delete(id) {
        const confirmed = await Confirm.show('هل تريد حذف هذه الصورة؟', 'حذف الصورة');
        if (!confirmed) return;
        try {
            await DB.deleteDesign(id);
            await this.render();
            Toast.show('تم حذف الصورة');
        } catch {
            Toast.show('خطأ في حذف الصورة', 'error');
        }
    },

    async render() {
        const gallery = document.getElementById('designsGallery');
        if (!gallery) return;
        try {
            const designs = await DB.getDesignsForProject(AppState.current.id);
            if (designs.length === 0) {
                gallery.innerHTML = '<p class="designs-empty">لا توجد صور تصميم مرفوعة بعد</p>';
                return;
            }
            gallery.innerHTML = designs.map(d => `
                <div class="design-item">
                    <img src="${d.data}" alt="تصميم المطبخ" class="design-item__image" loading="lazy">
                    <div class="design-item__overlay">
                        <button class="btn btn--danger btn--icon btn--sm" data-action="delete-design" data-design-id="${d.id}" title="حذف" aria-label="حذف الصورة">
                            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </div>
            `).join('');
        } catch {
            gallery.innerHTML = '<p class="designs-empty">خطأ في تحميل الصور</p>';
        }
    },

    clearUpload() {
        document.getElementById('designFileInput').value = '';
    },
};

// ===============================================================
// 13. LPO (LOCAL PURCHASE ORDER)
// ===============================================================

const LPO = {
    /** Builds an LPO HTML string from an items array */
    _buildTable(items, hasPaint) {
        const rows = items.map((item, idx) => {
            const line   = (item.qty * item.price);
            const paint  = item.needsPaint ? (item.qty * (item.paintCostPerUnit || 0)) : 0;
            const total  = line + paint;
            const stageCol = item.stageLabel ? `<td>${escapeHtml(item.stageLabel)}</td>` : '';
            const paintCols = hasPaint ? `
                <td>${item.needsPaint ? formatNumber(item.paintCostPerUnit || 0) : '-'}</td>
                <td>${item.needsPaint ? escapeHtml(item.paintColor || '') : '-'}</td>
            ` : '';
            return `
                <tr>
                    <td>${idx + 1}</td>
                    ${stageCol}
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.unit || '')}</td>
                    <td>${formatNumber(item.qty)}</td>
                    <td>${formatNumber(item.price)}</td>
                    ${paintCols}
                    <td class="text-bold">${formatNumber(total)}</td>
                </tr>`;
        }).join('');
        return rows;
    },

    _renderResult(title, items, supplier, stage, includeTax, taxRate, includeStageCol) {
        if (items.length === 0) { Toast.show('لا توجد مواد في هذه المرحلة', 'error'); return; }

        const hasPaint  = items.some(i => i.needsPaint);
        const subtotal  = items.reduce((s, i) => s + (i.qty * i.price) + (i.needsPaint ? i.qty * (i.paintCostPerUnit || 0) : 0), 0);
        const taxAmount = includeTax ? (subtotal * taxRate / 100) : 0;
        const total     = subtotal + taxAmount;
        const baseCols  = includeStageCol ? 6 : 5;
        const colCount  = baseCols + (hasPaint ? 2 : 0);

        const stageHeader   = includeStageCol ? '<th>المرحلة</th>' : '';
        const paintHeaders  = hasPaint        ? '<th>صبغ/وحدة</th><th>لون الصبغ</th>' : '';
        const taxRow        = includeTax      ? `<tr><td colspan="${colCount}" class="text-end">الضريبة (${taxRate}%):</td><td class="text-bold">${formatNumber(taxAmount)}</td></tr>` : '';

        document.getElementById('lpoResult').innerHTML = `
            <div class="lpo-header">
                <h3 class="lpo-title">${escapeHtml(title)}</h3>
                <div class="lpo-meta">
                    <div class="lpo-meta__item"><span class="lpo-meta__label">المشروع:</span><span class="lpo-meta__value">${escapeHtml(AppState.current.id)}</span></div>
                    <div class="lpo-meta__item"><span class="lpo-meta__label">العميل:</span><span class="lpo-meta__value">${escapeHtml(AppState.current.client || 'غير محدد')}</span></div>
                    <div class="lpo-meta__item"><span class="lpo-meta__label">المورد:</span><span class="lpo-meta__value">${escapeHtml(supplier)}</span></div>
                    ${stage ? `<div class="lpo-meta__item"><span class="lpo-meta__label">المرحلة:</span><span class="lpo-meta__value">${escapeHtml(stage)}</span></div>` : ''}
                </div>
            </div>
            <div class="table-wrapper">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            ${stageHeader}
                            <th>المادة</th><th>الوحدة</th><th>الكمية</th><th>السعر</th>
                            ${paintHeaders}
                            <th>الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>${this._buildTable(items, hasPaint)}</tbody>
                    <tfoot>
                        <tr><td colspan="${colCount}" class="text-end">المجموع الفرعي:</td><td class="text-bold">${formatNumber(subtotal)}</td></tr>
                        ${taxRow}
                        <tr class="total-row"><td colspan="${colCount}" class="text-end">الإجمالي:</td><td class="text-bold">${formatNumber(total)}</td></tr>
                    </tfoot>
                </table>
            </div>`;
        Toast.show('تم إنشاء LPO');
    },

    generate() {
        const stageKey   = document.getElementById('lpoStageSelect').value;
        const supplier   = document.getElementById('lpoSupplierInput').value.trim();
        const includeTax = document.getElementById('lpoTaxInput').checked;
        const taxRate    = parseFloat(document.getElementById('lpoTaxRateInput').value) || CONFIG.DEFAULT_TAX_RATE;

        if (!supplier) { Toast.show('يجب إدخال اسم المورد', 'error'); return; }

        const items = AppState.current.items[stageKey] || [];
        this._renderResult('طلب شراء LPO', items, supplier, CONFIG.STAGES[stageKey], includeTax, taxRate, false);
    },

    generateFull() {
        const supplier   = document.getElementById('lpoSupplierInput').value.trim() || '-';
        const includeTax = document.getElementById('lpoTaxInput').checked;
        const taxRate    = parseFloat(document.getElementById('lpoTaxRateInput').value) || CONFIG.DEFAULT_TAX_RATE;

        const allItems = Object.entries(AppState.current.items).flatMap(([stage, items]) =>
            items.map(item => ({ ...item, stageLabel: CONFIG.STAGES[stage] }))
        );

        if (allItems.length === 0) { Toast.show('لا توجد مواد في أي مرحلة', 'error'); return; }
        this._renderResult('طلب شراء LPO (كامل المواد)', allItems, supplier, null, includeTax, taxRate, true);
    },

    print() {
        const resultDiv = document.getElementById('lpoResult');
        if (!resultDiv.innerHTML.trim()) { Toast.show('يجب إنشاء LPO أولاً', 'error'); return; }

        const win = window.open('', '_blank');
        win.document.write(`
            <!DOCTYPE html><html lang="ar" dir="rtl">
            <head><meta charset="UTF-8"><title>LPO - ${AppState.current.id}</title>
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family:'IBM Plex Sans Arabic',Arial,sans-serif; padding:20mm; }
                .lpo-header { margin-bottom:20px; background:#1a2535; color:#fff; padding:16px; border-radius:8px; }
                .lpo-title  { font-size:24px; margin-bottom:12px; }
                .lpo-meta   { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
                .lpo-meta__item { display:flex; gap:8px; font-size:13px; }
                .lpo-meta__label { font-weight:600; color:#7a8fa8; }
                .lpo-meta__value { color:#e0e8f0; }
                table { width:100%; border-collapse:collapse; margin-top:20px; }
                th,td { padding:10px; text-align:right; border:1px solid #ddd; font-size:12px; }
                th { background:#f5f5f5; font-weight:600; }
                .text-bold { font-weight:700; }
                .text-end  { text-align:left; }
                .total-row { background:#e6effe; font-weight:700; }
                @media print { body { padding:10mm; } }
            </style></head>
            <body>${resultDiv.innerHTML}</body></html>
        `);
        win.document.close();
        win.print();
    },
};

// ===============================================================
// 14. REPORT GENERATOR
// ===============================================================

const ReportGenerator = {
    _baseStyles() {
        return `
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:'IBM Plex Sans Arabic',Arial,sans-serif; font-size:13px; line-height:1.5; color:#222; padding:10mm; background:#fff; }
            .report-header { text-align:center; margin-bottom:18px; padding-bottom:12px; border-bottom:3px solid #2d6be4; }
            .report-header img { max-height:60px; margin-bottom:8px; }
            .report-header h1 { font-size:18px; color:#2d3748; margin-bottom:4px; }
            .subtitle { color:#718096; font-size:12px; }
            .section-title { font-size:15px; font-weight:700; color:#1a365d; margin-bottom:10px; padding-bottom:5px; border-bottom:2px solid #4299e1; margin-top:16px; }
            .info-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px 16px; margin-bottom:14px; }
            .info-item { display:flex; align-items:center; padding:3px 0; }
            .info-label { font-weight:600; color:#4a5568; min-width:120px; margin-left:8px; flex-shrink:0; }
            .info-value { color:#2d3748; }
            .specs-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
            .spec-item { background:#f7fafc; padding:7px 10px; border-radius:5px; border:1px solid #e2e8f0; }
            .spec-label { font-size:11px; font-weight:600; color:#4a5568; margin-bottom:3px; }
            .spec-value { color:#2d3748; }
            .report-table { width:100%; border-collapse:collapse; margin:8px 0 14px; font-size:12px; }
            .report-table th { background:#edf2f7; color:#2d3748; font-weight:600; padding:6px 8px; border:1px solid #cbd5e0; text-align:center; }
            .report-table td { padding:5px 8px; border:1px solid #e2e8f0; text-align:center; }
            .text-bold { font-weight:700; }
            .financial-summary { background:#f0fff4; padding:14px; border-radius:6px; border:1px solid #c6f6d5; margin-top:14px; }
            .summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
            .summary-item { text-align:center; }
            .summary-label { font-size:11px; color:#2f855a; font-weight:600; margin-bottom:3px; }
            .summary-value { font-size:16px; font-weight:700; color:#276749; }
            .designs-gallery { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-top:12px; }
            .design-item { border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; }
            .design-item img { width:100%; max-height:20cm; object-fit:cover; }
            .report-footer { margin-top:20px; padding-top:10px; border-top:1px dashed #cbd5e0; text-align:center; color:#718096; font-size:11px; }
            .page-break { page-break-before:always; }
            @media print { body { padding:5mm; } .page-break { page-break-before:always; } }
        `;
    },

    _projectInfoSection(project) {
        return `
            <h2 class="section-title">معلومات المشروع</h2>
            <div class="info-grid">
                ${[
                    ['اسم العميل',   project.client],
                    ['رقم المشروع',  project.id],
                    ['رقم التليفون', project.phone || 'غير محدد'],
                    ['الإمارة',      project.emirate || 'غير محدد'],
                    ['البائع',       project.sales   || 'غير محدد'],
                    ['العنوان',      project.address || 'غير محدد'],
                    ['تاريخ المشروع',formatDate(project.date)],
                    ['تاريخ التسليم',formatDate(project.dates?.deliveryDate)],
                ].map(([label, value]) => `
                    <div class="info-item">
                        <span class="info-label">${label}:</span>
                        <span class="info-value">${escapeHtml(value)}</span>
                    </div>
                `).join('')}
            </div>`;
    },

    _specsSection(project) {
        const specItems = CONFIG.SPEC_FIELDS.map(f => {
            const val = project.specifications[f.key];
            return val ? `<div class="spec-item"><div class="spec-label">${f.label}:</div><div class="spec-value">${escapeHtml(val)}</div></div>` : '';
        }).join('');

        const notes = (project.specifications.notes || []).map(n =>
            `<li style="margin-bottom:4px;color:#2d3748;">${escapeHtml(n)}</li>`
        ).join('');

        return `
            <h2 class="section-title">مواصفات المطبخ</h2>
            <div class="specs-grid">${specItems}</div>
            ${notes ? `<div style="margin-top:12px;"><h3 style="font-size:13px;font-weight:600;margin-bottom:6px;color:#4a5568;">ملاحظات:</h3><ul style="padding-right:20px;">${notes}</ul></div>` : ''}`;
    },

    _materialsSection(project) {
        const stages = Object.keys(CONFIG.STAGES).map(stage => {
            const items = project.items[stage] || [];
            if (!items.length) return '';
            const stageTotal = calcStageTotal(items);
            const rows = items.map((item, idx) => {
                const t = (item.qty * item.price) + (item.needsPaint ? item.qty * (item.paintCostPerUnit || 0) : 0);
                return `<tr>
                    <td>${idx + 1}</td>
                    <td style="text-align:right;">${escapeHtml(item.name)}${item.needsPaint ? ' (مصبوغ)' : ''}</td>
                    <td>${escapeHtml(item.unit || '')}</td>
                    <td>${formatNumber(item.qty)}</td>
                    <td>${formatNumber(item.price)}</td>
                    <td class="text-bold">${formatNumber(t)}</td>
                </tr>`;
            }).join('');
            return `
                <div style="margin-bottom:14px;">
                    <h3 style="font-size:13px;font-weight:600;color:#2d6be4;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;">${CONFIG.STAGES[stage]}</h3>
                    <table class="report-table">
                        <thead><tr><th>#</th><th>اسم المادة</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
                        <tbody>${rows}</tbody>
                        <tfoot><tr style="background:#e6fffa;"><td colspan="5" style="text-align:left;font-weight:600;">إجمالي ${CONFIG.STAGES[stage]}:</td><td class="text-bold" style="color:#2d6be4;">${formatNumber(stageTotal)}</td></tr></tfoot>
                    </table>
                </div>`;
        }).join('');
        return `<h2 class="section-title">المواد المطلوبة</h2>${stages}`;
    },

    _financialSection(project) {
        const materialsTotal = calcMaterialsTotal(project);
        const autoTax        = materialsTotal * CONFIG.AUTO_TAX_RATE / 100;
        const totalWithTax   = materialsTotal + autoTax;
        const agreed         = project.financials.totalAmount;
        const paid           = project.financials.paid;
        const remaining      = agreed - project.financials.discount - paid;

        return `
            <h2 class="section-title">الملخص المالي</h2>
            <div class="financial-summary">
                <div class="summary-grid">
                    <div class="summary-item"><div class="summary-label">إجمالي المواد</div><div class="summary-value">${formatNumber(materialsTotal)}</div></div>
                    <div class="summary-item"><div class="summary-label">الضريبة (${CONFIG.AUTO_TAX_RATE}%)</div><div class="summary-value">${formatNumber(autoTax)}</div></div>
                    <div class="summary-item"><div class="summary-label">الإجمالي بعد الضريبة</div><div class="summary-value">${formatNumber(totalWithTax)}</div></div>
                    <div class="summary-item"><div class="summary-label">المبلغ المتفق عليه</div><div class="summary-value">${formatNumber(agreed)}</div></div>
                </div>
                <div style="border-top:1px solid #c6f6d5;padding-top:10px;margin-top:10px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>المدفوع:</span><span style="font-weight:700;">${formatNumber(paid)}</span></div>
                    <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid #2d6be4;font-size:16px;font-weight:700;color:${remaining > 0 ? '#c53030' : '#38a169'};">
                        <span>المتبقي:</span><span>${formatNumber(remaining)}</span>
                    </div>
                </div>
            </div>`;
    },

    async generateFullReport(project, includeDesigns = false) {
        const logoData = null; // Logo is hardcoded in HTML - no dynamic loading needed
        const designs  = includeDesigns ? await DB.getDesignsForProject(project.id) : [];

        const designSection = (designs.length > 0) ? `
            <h2 class="section-title">التصاميم والاعتمادات</h2>
            <div class="designs-gallery">${designs.map(d => `<div class="design-item"><img src="${d.data}" alt="تصميم"></div>`).join('')}</div>` : '';

        return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير - ${escapeHtml(project.id)}</title><style>${this._baseStyles()}</style></head>
        <body>
            <div class="report-header">
                ${logoData ? `<img src="${logoData}" alt="شعار الشركة">` : ''}
                <h1>تقرير مشروع: ${escapeHtml(project.client)} - ${escapeHtml(project.name || '')}</h1>
                <div class="subtitle">${escapeHtml(project.id)} - ${formatDate(project.date)}</div>
            </div>
            ${this._projectInfoSection(project)}
            ${this._specsSection(project)}
            ${designSection}
            ${this._materialsSection(project)}
            ${this._financialSection(project)}
            <div class="report-footer">تم إنشاء التقرير بتاريخ: ${new Date().toLocaleDateString('en-US')} — شركة المحيط الأخضر</div>
        </body></html>`;
    },

    async generateSpecsOnlyReport(project, includeDesigns = false) {
        const logoData = null; // Logo is hardcoded in HTML - no dynamic loading needed
        const designs  = includeDesigns ? await DB.getDesignsForProject(project.id) : [];

        const designSection = (designs.length > 0) ? `
            <div style="margin-top:20px;">
                <h2 class="section-title">التصاميم والاعتمادات</h2>
                <div class="designs-gallery">${designs.map(d => `<div class="design-item"><img src="${d.data}" alt="تصميم"></div>`).join('')}</div>
            </div>` : '';

        return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>مواصفات - ${escapeHtml(project.id)}</title><style>${this._baseStyles()}</style></head>
        <body>
            <div class="report-header">
                ${logoData ? `<img src="${logoData}" alt="شعار الشركة">` : ''}
                <h1>مواصفات مشروع: ${escapeHtml(project.client)} - ${escapeHtml(project.name || '')}</h1>
                <div class="subtitle">${escapeHtml(project.id)}</div>
            </div>
            ${this._projectInfoSection(project)}
            ${this._specsSection(project)}
            ${designSection}
            <div class="report-footer">تم الإنشاء: ${new Date().toLocaleDateString('en-US')}</div>
        </body></html>`;
    },

    async generateProjectsReport(projects) {
        const logoData = null; // Logo is hardcoded in HTML - no dynamic loading needed
        const sorted   = [...projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        const rows = sorted.map((p, idx) => {
            const materialsTotal = calcMaterialsTotal(p);
            const agreed         = p.financials.totalAmount || 0;
            const paid           = p.financials.paid || 0;
            const remaining      = agreed - (p.financials.discount || 0) - paid;
            return `<tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml(p.id)}</td>
                <td>${escapeHtml(p.client || '')}</td>
                <td>${escapeHtml(p.phone || '')}</td>
                <td>${escapeHtml(p.emirate || '')}</td>
                <td>${formatDate(p.date)}</td>
                <td>${formatNumber(materialsTotal)}</td>
                <td>${formatNumber(agreed)}</td>
                <td>${formatNumber(paid)}</td>
                <td>${formatNumber(remaining)}</td>
                <td>${escapeHtml(p.currentStage || '')}</td>
            </tr>`;
        }).join('');

        return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>كشف المشاريع</title>
        <style>
            * { margin:0;padding:0;box-sizing:border-box; }
            body { font-family:'IBM Plex Sans Arabic',Arial,sans-serif;font-size:12px;padding:15mm;background:#fff;color:#222; }
            .report-header { text-align:center;margin-bottom:20px;padding-bottom:10px;border-bottom:2px solid #2d6be4; }
            .report-header img { max-height:60px;margin-bottom:8px; }
            h1 { font-size:20px;color:#1a365d; }
            .date { color:#6e7d94;font-size:12px; }
            table { width:100%;border-collapse:collapse;margin-top:15px; }
            th { background:#1a2535;color:#fff;padding:8px 5px;font-weight:600;text-align:center;border:1px solid #2d3748; }
            td { padding:6px 4px;border:1px solid #e2e8f0;text-align:center; }
            tr:nth-child(even) { background:#f7fafc; }
            .print-footer { margin-top:30px;text-align:center;color:#718096;font-size:10px;border-top:1px dashed #cbd5e0;padding-top:10px; }
            @media print { body { padding:10mm; } }
        </style></head>
        <body>
            <div class="report-header">
                ${logoData ? `<img src="${logoData}" alt="شعار الشركة">` : ''}
                <h1>كشف بجميع المشاريع</h1>
                <div class="date">تم الإنشاء: ${new Date().toLocaleDateString('ar-EG')}</div>
            </div>
            <table>
                <thead><tr><th>#</th><th>رقم المشروع</th><th>العميل</th><th>الهاتف</th><th>الإمارة</th><th>التاريخ</th><th>إجمالي المواد</th><th>المبلغ المتفق</th><th>المدفوع</th><th>المتبقي</th><th>المرحلة</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="print-footer">شركة المحيط الأخضر — نظام إدارة المشاريع</div>
        </body></html>`;
    },
};

// ===============================================================
// 15. PROJECT MANAGEMENT
// ===============================================================

const Project = {
    createNew() {
        AppState.current = createEmptyProject();
        Renderer.renderAll(AppState.current);
        Designs.render();
        Toast.show('مشروع جديد جاهز');
    },

    async save() {
        this.collectFormData();

        if (!AppState.current.client.trim()) {
            Toast.show('يجب إدخال اسم العميل', 'error');
            return;
        }

        AppState.current.updatedAt    = new Date().toISOString();
        AppState.current.progress     = calculateProjectProgress(AppState.current);
        AppState.current.currentStage = detectProjectStage(AppState.current);
        stampProjectDates(AppState.current);

        try {
            await DB.saveProject(AppState.current);
            Toast.show(`تم حفظ المشروع: ${AppState.current.id}`);
            // Re-render KPIs and items (safe - no workflow checkboxes reset here)
            Renderer.renderKPIs(AppState.current);
            Renderer.renderItemsLists(AppState.current);
            Renderer.renderWorkflow(AppState.current);
        } catch (err) {
            Toast.show('خطأ في الحفظ: ' + err.message, 'error');
        }
    },

    /** Reads all form fields into AppState.current */
    collectFormData() {
        const get = (id) => document.getElementById(id);
        AppState.current.client       = get('clientInput').value.trim();
        AppState.current.phone        = get('phoneInput').value.trim();
        AppState.current.emirate      = get('emirateInput').value.trim();
        AppState.current.address      = get('addressInput').value.trim();
        AppState.current.location     = get('locationInput').value.trim();
        AppState.current.sales        = get('salesInput').value.trim();
        AppState.current.date         = get('dateInput').value;
        AppState.current.name         = get('projectNameInput').value.trim();
        AppState.current.dates.deliveryDate = get('deliveryDateInput').value;

        CONFIG.SPEC_FIELDS.forEach(field => {
            const input = get(field.key + 'Input');
            if (input) AppState.current.specifications[field.key] = input.value.trim();
        });

        AppState.current.financials = {
            discount:    parseFloat(get('discountInput').value)    || 0,
            paid:        parseFloat(get('paidInput').value)        || 0,
            totalAmount: parseFloat(get('totalAmountInput').value) || 0,
        };
    },

    async loadById(id) {
        try {
            const project = await DB.getProject(id);
            if (!project) { Toast.show('لم يتم العثور على المشروع', 'error'); return false; }

            AppState.current = project;
            Renderer.renderAll(AppState.current);
            await Designs.render();
            Toast.show(`تم تحميل المشروع: ${project.id}`);
            return true;
        } catch (err) {
            Toast.show('خطأ في التحميل: ' + err.message, 'error');
            return false;
        }
    },

    async duplicate(id) {
        try {
            const original = await DB.getProject(id);
            if (!original) return;
            const copy = deepClone(original);
            copy.id        = generateProjectId();
            copy.createdAt = new Date().toISOString();
            copy.updatedAt = new Date().toISOString();
            copy.designs   = [];
            await DB.saveProject(copy);
            const projects = await DB.loadProjects();
            await Renderer.renderProjectsList(projects);
            Toast.show(`تم نسخ المشروع: ${copy.id}`);
        } catch (err) {
            Toast.show('خطأ في النسخ: ' + err.message, 'error');
        }
    },

    async deleteById(id) {
        const confirmed = await Confirm.show('هل تريد حذف هذا المشروع؟', 'حذف المشروع');
        if (!confirmed) return;
        try {
            await DB.deleteAllDesignsForProject(id);
            await DB.deleteProject(id);
            const projects = await DB.loadProjects();
            await Renderer.renderProjectsList(projects);
            Toast.show('تم حذف المشروع');
            if (AppState.current.id === id) this.createNew();
        } catch (err) {
            Toast.show('خطأ في الحذف: ' + err.message, 'error');
        }
    },

    async deleteAll() {
        const confirmed = await Confirm.show('هل تريد حذف جميع المشاريع؟ لا يمكن التراجع عن هذا الإجراء.', 'حذف جميع المشاريع');
        if (!confirmed) return;
        try {
            // Clear designs store directly (no per-project loop needed)
            await new Promise((res, rej) => {
                const tx  = AppState.db.transaction([CONFIG.STORES.DESIGNS], 'readwrite');
                const req = tx.objectStore(CONFIG.STORES.DESIGNS).clear();
                req.onsuccess = res;
                req.onerror   = () => rej(req.error);
            });
            await DB.deleteAllProjects();
            this.createNew();
            Toast.show('تم حذف جميع المشاريع');
        } catch (err) {
            Toast.show('خطأ في الحذف: ' + err.message, 'error');
        }
    },

    export() {
        this.collectFormData();
        const blob = new Blob([JSON.stringify(AppState.current, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href: url, download: `project-${AppState.current.id}.json` });
        a.click();
        URL.revokeObjectURL(url);
        Toast.show('تم تصدير المشروع');
    },

    import(jsonString) {
        try {
            const project = JSON.parse(jsonString);
            if (!project.id || !project.client) return false;
            AppState.current = normaliseProject(project);
            Renderer.renderAll(AppState.current);
            Designs.render();
            return true;
        } catch {
            return false;
        }
    },

    async importFromFile(file) {
        return new Promise((resolve) => {
            const reader    = new FileReader();
            reader.onload   = (e) => resolve(this.import(e.target.result));
            reader.onerror  = () => resolve(false);
            reader.readAsText(file);
        });
    },
};

// ===============================================================
// 16. RENDERER - Updates DOM from state
// ===============================================================

const Renderer = {
    renderAll(project) {
        this.renderProjectForm(project);
        this.renderSpecifications(project);
        this.renderItemsLists(project);
        this.renderKPIs(project);
        this.renderLPOStages();
        this.renderUnitsSelect();
        this.renderWorkflow(project);
        SpecsNotes.render();
    },

    renderProjectForm(project) {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        set('projectId',       project.id);
        set('clientInput',     project.client);
        set('phoneInput',      project.phone);
        set('emirateInput',    project.emirate);
        set('addressInput',    project.address);
        set('locationInput',   project.location);
        set('salesInput',      project.sales);
        set('dateInput',       project.date);
        set('projectNameInput',project.name);
        set('deliveryDateInput', project.dates?.deliveryDate || '');

        // Sync financial inputs when loading a project
        set('discountInput',    project.financials?.discount    || 0);
        set('paidInput',        project.financials?.paid        || 0);
        set('totalAmountInput', project.financials?.totalAmount || 0);
    },

    renderSpecifications(project) {
        CONFIG.SPEC_FIELDS.forEach(field => {
            const input = document.getElementById(field.key + 'Input');
            if (input) input.value = project.specifications[field.key] || '';
        });
    },

    renderItemsLists(project) {
        const container = document.getElementById('itemsLists');
        const sections  = Object.keys(CONFIG.STAGES).map(stage => {
            const items = project.items[stage] || [];
            if (!items.length) return '';
            const stageTotal = calcStageTotal(items);
            const hasPaint   = items.some(i => i.needsPaint);

            const paintHeaders = hasPaint ? '<th>صبغ/وحدة</th><th>لون الصبغ</th>' : '';
            const rows = items.map((item, idx) => {
                const line  = item.qty * item.price;
                const paint = item.needsPaint ? item.qty * (item.paintCostPerUnit || 0) : 0;
                const total = line + paint;
                const paintCols = hasPaint ? `
                    <td>${item.needsPaint ? formatNumber(item.paintCostPerUnit || 0) : '-'}</td>
                    <td>${item.needsPaint ? escapeHtml(item.paintColor || '') : '-'}</td>` : '';
                return `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${escapeHtml(item.name)}</td>
                        <td>${escapeHtml(item.unit || '')}</td>
                        <td>${formatNumber(item.qty)}</td>
                        <td>${formatNumber(item.price)}</td>
                        ${paintCols}
                        <td class="text-bold">${formatNumber(total)}</td>
                        <td class="items-actions">
                            <button class="btn btn--primary btn--icon btn--xs" data-action="edit-item-modal" data-stage="${stage}" data-index="${idx}" title="تعديل" aria-label="تعديل المادة">
                                <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                            </button>
                            <button class="btn btn--danger btn--icon btn--xs" data-action="delete-item" data-stage="${stage}" data-index="${idx}" title="حذف" aria-label="حذف المادة">
                                <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            </button>
                        </td>
                    </tr>`;
            }).join('');

            return `
                <div class="items-stage">
                    <div class="items-stage__header">
                        <h3 class="items-stage__title">${CONFIG.STAGES[stage]}</h3>
                        <span class="items-stage__total">الإجمالي: ${formatNumber(stageTotal)}</span>
                    </div>
                    <div class="table-wrapper">
                        <table class="items-table">
                            <thead><tr>
                                <th>#</th><th>المادة</th><th>الوحدة</th><th>الكمية</th><th>السعر</th>
                                ${paintHeaders}<th>الإجمالي</th><th>إجراءات</th>
                            </tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>`;
        }).join('');

        container.innerHTML = sections || '<p class="items-empty">لم يتم إضافة مواد بعد</p>';
    },

    renderKPIs(project) {
        const materialsTotal = calcMaterialsTotal(project);
        const finalTotal     = project.financials.totalAmount - project.financials.discount;
        const remaining      = finalTotal - project.financials.paid;

        document.getElementById('kpiMaterialsTotal').textContent = formatNumber(materialsTotal);
        document.getElementById('kpiFinalTotal').textContent     = formatNumber(finalTotal);
        document.getElementById('kpiPaid').textContent           = formatNumber(project.financials.paid);
        document.getElementById('kpiRemaining').textContent      = formatNumber(remaining);

        const remainingCard = document.getElementById('kpiRemainingCard');
        remainingCard.classList.remove('kpi-card--warning', 'zero');
        if (remaining === 0) remainingCard.classList.add('zero');
    },

    renderLPOStages() {
        const select = document.getElementById('lpoStageSelect');
        if (!select) return;
        select.innerHTML = Object.entries(CONFIG.STAGES)
            .map(([key, label]) => `<option value="${key}">${label}</option>`)
            .join('');
    },

    renderUnitsSelect() {
        const options = '<option value="">اختر الوحدة</option>' +
            CONFIG.UNITS.map(u => `<option value="${u}">${u}</option>`).join('');
        ['itemUnitSelect', 'editItemUnit'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = options;
        });
    },

    _allProjects: [], // cached for search

    async renderProjectsList(projects) {
        const list = document.getElementById('projectsModalList');
        this._allProjects = [...projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        this._renderProjectCards(this._allProjects);
    },

    _renderProjectCards(projects) {
        const list = document.getElementById('projectsModalList');
        if (!projects.length) {
            list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg><p>لا توجد مشاريع تطابق البحث</p></div>`;
            return;
        }
        list.innerHTML = projects.map(p => {
            const isDone = !!p.workflow?.handover_signed;
            const stageLabel = STAGE_LABELS[p.currentStage] || p.currentStage || '-';
            return `
                <div class="project-card" data-action="open-project" data-project-id="${p.id}">
                    <div class="project-card__info">
                        <div class="project-card__id">${escapeHtml(p.id)}</div>
                        <div class="project-card__client">${escapeHtml(p.client || '-')}${p.name ? ` <span style="color:var(--clr-ink-ghost);font-weight:400;">- ${escapeHtml(p.name)}</span>` : ''}</div>
                        <div class="project-card__meta">
                            ${p.phone   ? `<span class="project-card__meta-item">📞 ${escapeHtml(p.phone)}</span>` : ''}
                            ${p.emirate ? `<span class="project-card__meta-item">📍 ${escapeHtml(p.emirate)}</span>` : ''}
                            <span class="project-card__meta-item">ًں“… ${formatDate(p.date)}</span>
                            <span class="project-status-badge project-status-badge--${isDone ? 'done' : 'active'}">${isDone ? 'مسلّم' : stageLabel}</span>
                        </div>
                    </div>
                    <div class="project-card__progress">
                        <div class="project-card__progress-bar">
                            <div class="project-card__progress-fill" style="width:${p.progress || 0}%"></div>
                        </div>
                        <span class="project-card__pct">${p.progress || 0}%</span>
                    </div>
                    <div class="project-card__actions" onclick="event.stopPropagation()">
                        <button class="btn btn--ghost btn--icon btn--sm" data-action="duplicate-project" data-project-id="${p.id}" title="نسخ المشروع">
                            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        </button>
                        <button class="btn btn--danger btn--icon btn--sm" data-action="delete-project" data-project-id="${p.id}" title="حذف المشروع">
                            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </div>`;
        }).join('');
    },

    renderWorkflow(project) {
        const container = document.getElementById('workflowSteps');
        if (!container) return;

        // Group steps by phase
        const phases = {};
        CONFIG.WORKFLOW_STEPS.forEach(step => {
            if (!phases[step.phase]) phases[step.phase] = { label: step.phaseLabel || step.phase, steps: [] };
            phases[step.phase].steps.push(step);
        });

        const phasesHtml = Object.values(phases).map(phase => {
            const stepsHtml = phase.steps.map(step => {
                const isDone   = project.workflow[step.key];
                const checked  = isDone ? 'checked' : '';
                const doneClass = isDone ? 'done' : '';
                const criticalClass = step.critical ? 'critical' : '';
                const critBadge = step.critical ? `<span class="critical-badge">هام</span>` : '';
                return `
                    <label class="workflow-step ${doneClass} ${criticalClass}">
                        <input type="checkbox" class="workflow-step__check" data-action="toggle-workflow" data-step="${step.key}" ${checked}>
                        <span class="workflow-step__label">${step.label}</span>
                        ${critBadge}
                    </label>`;
            }).join('');
            return `
                <div class="workflow-phase">
                    <div class="workflow-phase__title">${phase.label}</div>
                    <div class="workflow-steps-grid">${stepsHtml}</div>
                </div>`;
        }).join('');

        const progressPercent = project.progress || 0;
        container.innerHTML = `
            <div class="project-progress">
                <div class="project-progress__header">
                    <span>تقدم المشروع الكلي</span>
                    <span class="project-progress__percent">${progressPercent}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${progressPercent}%"></div>
                </div>
            </div>
            <div style="padding: var(--sp-4) var(--sp-5) var(--sp-5)">
                ${phasesHtml}
            </div>`;
    },
};

// ===============================================================
// 17. PRODUCTION BOARD
// ===============================================================

const STAGE_LABELS = {
    pre_sales:'ما قبل البيع', measurement:'المعاينة', contract:'التعاقد', design:'التصميم',
    technical_handover:'تحويل فني', job_order:'جوب أوردر', cutting_approved:'قائمة تقطيع',
    quality_control:'فحص جودة', frame_purchase:'شراء بوكسات', frame_fabrication:'تصنيع بوكسات',
    frame_delivery:'توريد بوكسات', frame_installation:'تثبيت بوكسات', panel_purchase:'شراء ضلفات',
    panel_fabrication:'تصنيع ضلفات', panel_installation:'تثبيت ضلفات', finishing_purchase:'شراء إكسسوارات',
    finishing_installation:'تثبيت نهائي', client_qc:'معاينة عميل', delivery_adjustments:'تعديلات',
    delivery_complete:'تسليم',
};

const STAGE_ORDER = Object.keys(STAGE_LABELS);

const ProductionBoard = {
    async render() {
        const boardEl  = document.getElementById('productionBoard');
        if (!boardEl) return;

        const projects = await DB.loadProjects();

        if (projects.length === 0) {
            boardEl.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg><p>لا توجد مشاريع محفوظة بعد.<br>قم بحفظ مشروع أولاً.</p></div>`;
            return;
        }

        const grouped = {};
        STAGE_ORDER.forEach(s => { grouped[s] = []; });
        projects.forEach(p => {
            const stage = p.currentStage || 'pre_sales';
            if (grouped[stage]) grouped[stage].push(p);
            else grouped['pre_sales'].push(p);
        });

        const columnsHtml = STAGE_ORDER.map(stage => {
            const cards = [...(grouped[stage] || [])].sort((a, b) => (b.progress || 0) - (a.progress || 0));
            const cardsHtml = cards.map(p => {
                const contractDate = p.dates?.contractDate || p.date || todayString();
                const daysSince    = Math.floor((Date.now() - new Date(contractDate)) / 86400000);
                let daysRemaining  = '-';
                let deadlineClass  = '';
                if (p.dates?.deliveryDate) {
                    const rem     = Math.floor((new Date(p.dates.deliveryDate) - Date.now()) / 86400000);
                    daysRemaining = rem >= 0 ? `${rem} يوم` : 'تجاوز الموعد';
                    deadlineClass = rem < 0 ? 'overdue' : rem < 7 ? 'urgent' : '';
                }
                return `
                    <div class="board-card" data-project-id="${p.id}" data-action="open-project-from-board">
                        <strong>${escapeHtml(p.client || '-')}</strong>
                        ${p.name    ? `<div style="font-size:var(--text-xs);color:var(--clr-ink-tertiary);margin-bottom:2px;">${escapeHtml(p.name)}</div>` : ''}
                        ${p.emirate ? `<div style="font-size:var(--text-xs);color:var(--clr-ink-ghost);">📍 ${escapeHtml(p.emirate)}</div>` : ''}
                        <div class="progress-bar" style="margin-top:8px;">
                            <div class="progress-fill" style="width:${p.progress || 0}%"></div>
                        </div>
                        <div style="text-align:left;margin-top:3px;font-size:10px;color:var(--clr-primary-text);font-family:var(--font-mono);">${p.progress || 0}%</div>
                        <div class="card-dates">
                            <span>منذ ${daysSince}ي</span>
                            <span class="${deadlineClass}">${daysRemaining}</span>
                        </div>
                    </div>`;
            }).join('');

            return `
                <div class="board-column" data-stage="${stage}">
                    <div class="column-header">
                        <h3>${STAGE_LABELS[stage] || stage}</h3>
                        <div class="sort-buttons">
                            <button class="btn btn--xs btn--ghost" data-action="sort-column" data-stage="${stage}" data-sort="progress" title="ترتيب حسب التقدم">%</button>
                            <button class="btn btn--xs btn--ghost" data-action="sort-column" data-stage="${stage}" data-sort="deadline" title="ترتيب حسب الموعد">⏳</button>
                        </div>
                    </div>
                    <div class="board-cards-container">${cardsHtml || '<p style="font-size:var(--text-xs);color:var(--clr-ink-ghost);text-align:center;padding:var(--sp-4);">لا توجد مشاريع</p>'}</div>
                </div>`;
        }).join('');

        boardEl.innerHTML = `<div class="board-columns">${columnsHtml}</div>`;
    },
};

// ===============================================================
// 18. DASHBOARD
// ===============================================================

const Dashboard = {
    async render() {
        const projects = await DB.loadProjects();

        const dashboardEl = document.getElementById('dashboardContent');
        if (!dashboardEl) return;

        if (projects.length === 0) {
            dashboardEl.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg><p>لا توجد مشاريع محفوظة بعد.<br>قم بحفظ مشروع أولاً.</p></div>`;
            return;
        }

        // Safe date helper
        const contractDate = (p) => p.dates?.contractDate || p.date || todayString();

        const total        = projects.length;
        const active       = projects.filter(p => !p.workflow.handover_signed).length;
        const delivered    = projects.filter(p => p.workflow.handover_signed).length;
        const delayed      = projects.filter(p => {
            const days = Math.floor((Date.now() - new Date(contractDate(p))) / 86400000);
            return days > 14 && p.progress < 70 && !p.workflow.handover_signed;
        }).length;
        const inProduction = projects.filter(p => ['frame_purchase','frame_fabrication','frame_delivery','frame_installation','panel_purchase','panel_fabrication','panel_installation','quality_control','finishing_purchase'].includes(p.currentStage)).length;
        const waitInstall  = projects.filter(p => p.currentStage === 'finishing_installation').length;
        const averageProgress = Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / total);
        const closestDelivery = [...projects]
            .filter(p => p.dates?.deliveryDate && !p.workflow?.handover_signed)
            .sort((a, b) => new Date(a.dates.deliveryDate) - new Date(b.dates.deliveryDate))[0] || null;
        const topProject = [...projects].sort((a, b) => (b.progress || 0) - (a.progress || 0))[0] || null;

        const kpiCards = [
            { label: 'إجمالي المشاريع',  value: total,        cls: '' },
            { label: 'المشاريع النشطة',  value: active,       cls: 'kpi-card--accent' },
            { label: 'المشاريع المسلمة', value: delivered,    cls: 'kpi-card--success' },
            { label: 'المتأخرة',         value: delayed,      cls: 'kpi-card--remaining' },
            { label: 'في الإنتاج',       value: inProduction, cls: '' },
            { label: 'بانتظار التركيب',  value: waitInstall,  cls: '' },
        ].map(k => `<div class="kpi-card ${k.cls}"><span class="kpi-card__label">${k.label}</span><span class="kpi-card__value">${k.value}</span></div>`).join('');

        const tableRows = projects.map(p => {
            const days      = Math.floor((Date.now() - new Date(contractDate(p))) / 86400000);
            const isDelayed = days > 14 && p.progress < 70 && !p.workflow.handover_signed;
            let rem = '-';
            let remClass = '';
            if (p.dates?.deliveryDate) {
                const r = Math.floor((new Date(p.dates.deliveryDate) - Date.now()) / 86400000);
                if (r < 0)      { rem = 'متجاوز الموعد'; remClass = 'text-danger'; }
                else if (r < 7) { rem = `${r} يوم`;      remClass = 'text-warning'; }
                else              rem = `${r} يوم`;
            }
            const statusHtml = p.workflow.handover_signed
                ? '<span class="project-status-badge project-status-badge--done">مسلّم</span>'
                : isDelayed
                    ? '<span class="project-status-badge" style="background:rgba(244,63,94,0.12);color:var(--clr-danger-text);border-color:rgba(244,63,94,0.2);">متأخر</span>'
                    : '<span class="project-status-badge project-status-badge--active">نشط</span>';
            return `
                <tr>
                    <td style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--clr-primary-text);">${escapeHtml(p.id)}</td>
                    <td style="font-weight:600;color:var(--clr-ink);">${escapeHtml(p.client || '-')}</td>
                    <td>${escapeHtml(STAGE_LABELS[p.currentStage] || p.currentStage || '-')}</td>
                    <td>
                        <div style="display:flex;align-items:center;gap:6px;justify-content:center;">
                            <div style="width:50px;height:4px;background:rgba(255,255,255,0.06);border-radius:9999px;overflow:hidden;">
                                <div style="width:${p.progress || 0}%;height:100%;background:linear-gradient(90deg,#3d8ef0,#7c3aed);border-radius:9999px;"></div>
                            </div>
                            <strong style="color:var(--clr-primary-text);font-family:var(--font-mono);">${p.progress || 0}%</strong>
                        </div>
                    </td>
                    <td class="${remClass}">${rem}</td>
                    <td>${statusHtml}</td>
                </tr>`;
        }).join('');

        // Stage distribution for bar chart
        const stageCounts = {};
        projects.forEach(p => {
            const s = p.currentStage || 'pre_sales';
            stageCounts[s] = (stageCounts[s] || 0) + 1;
        });

        dashboardEl.innerHTML = `
            <div class="dashboard-layout">
                <section class="dashboard-hero">
                    <div class="dashboard-hero__content">
                        <span class="dashboard-hero__eyebrow">Operations Overview</span>
                        <h3 class="dashboard-hero__title">لوحة متابعة تنفيذية تركّز على الأولويات والحركة القادمة</h3>
                        <p class="dashboard-hero__subtitle">عرض سريع للحالة التشغيلية، ضغط المواعيد، ونسبة التقدم عبر كل المشاريع بدون الحاجة لفتح كل مشروع على حدة.</p>
                        <div class="dashboard-hero__badges">
                            <span class="dashboard-badge">متوسط الإنجاز <strong>${averageProgress}%</strong></span>
                            <span class="dashboard-badge">داخل الإنتاج <strong>${inProduction}</strong></span>
                            <span class="dashboard-badge">بانتظار التركيب <strong>${waitInstall}</strong></span>
                        </div>
                    </div>
                    <div class="dashboard-insights">
                        <div class="dashboard-insight-card">
                            <span class="dashboard-insight-card__label">أقرب تسليم</span>
                            <div class="dashboard-insight-card__value">${escapeHtml(closestDelivery?.client || 'لا يوجد')}</div>
                            <div class="dashboard-insight-card__hint">${closestDelivery?.dates?.deliveryDate ? `موعد التسليم ${formatDate(closestDelivery.dates.deliveryDate)}` : 'لا توجد مواعيد تسليم نشطة'}</div>
                        </div>
                        <div class="dashboard-insight-card">
                            <span class="dashboard-insight-card__label">أعلى تقدم</span>
                            <div class="dashboard-insight-card__value">${escapeHtml(topProject?.client || 'لا يوجد')}</div>
                            <div class="dashboard-insight-card__hint">${topProject ? `${topProject.progress || 0}% - ${escapeHtml(STAGE_LABELS[topProject.currentStage] || topProject.currentStage || '-')}` : 'لا توجد بيانات كافية بعد'}</div>
                        </div>
                    </div>
                </section>
                <div class="dashboard-kpis">${kpiCards}</div>
                <div class="dashboard-main-grid">
                    <section class="dashboard-panel">
                        <div class="dashboard-panel__header">
                            <h3 class="dashboard-panel__title">توزيع المشاريع حسب المرحلة</h3>
                        </div>
                        <div class="dashboard-chart-wrap"><canvas id="stageChart"></canvas></div>
                    </section>
                    <section class="dashboard-panel">
                        <div class="dashboard-panel__header">
                            <h3 class="dashboard-panel__title">ملخص تنبيهات</h3>
                        </div>
                        <div class="dashboard-insights">
                            <div class="dashboard-insight-card">
                                <span class="dashboard-insight-card__label">المشاريع المتأخرة</span>
                                <div class="dashboard-insight-card__value">${delayed}</div>
                                <div class="dashboard-insight-card__hint">مشاريع تجاوزت 14 يومًا ولم تصل إلى 70%.</div>
                            </div>
                            <div class="dashboard-insight-card">
                                <span class="dashboard-insight-card__label">المشاريع المسلمة</span>
                                <div class="dashboard-insight-card__value">${delivered}</div>
                                <div class="dashboard-insight-card__hint">إجمالي المشاريع المنتهية والمغلقة.</div>
                            </div>
                        </div>
                    </section>
                </div>
                <section class="dashboard-panel">
                    <div class="dashboard-panel__header">
                        <h3 class="dashboard-panel__title">تفاصيل المشاريع</h3>
                    </div>
                    <div class="dashboard-table-wrap">
                        <table class="dashboard-table">
                            <thead><tr>
                                <th>رقم المشروع</th><th>العميل</th><th>المرحلة الحالية</th>
                                <th>التقدم</th><th>الأيام المتبقية</th><th>الحالة</th>
                            </tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </section>
            </div>`;

        // Draw chart after DOM is updated
        requestAnimationFrame(() => this._drawChart(stageCounts));
    },

    _drawChart(stageCounts) {
        const canvas = document.getElementById('stageChart');
        if (!canvas) return;
        const ctx    = canvas.getContext('2d');
        const stages = Object.keys(stageCounts);
        const counts = Object.values(stageCounts);
        if (!stages.length) return;

        const dpr = window.devicePixelRatio || 1;
        const W   = canvas.offsetWidth || 500;
        const H   = 160;
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width  = W + 'px';
        canvas.style.height = H + 'px';
        ctx.scale(dpr, dpr);

        const max  = Math.max(...counts, 1);
        const pad  = 36;
        const barW = Math.max(14, Math.min(38, Math.floor((W - pad * 2) / stages.length) - 8));
        const totalBarWidth = stages.length * barW;
        const totalGap = W - pad * 2 - totalBarWidth;
        const gap = totalGap / Math.max(stages.length, 1);

        ctx.clearRect(0, 0, W, H);

        // Grid lines
        for (let g = 1; g <= 4; g++) {
            const gy = H - 28 - ((g / 4) * (H - 48));
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.moveTo(pad, gy);
            ctx.lineTo(W - pad, gy);
            ctx.stroke();
        }

        stages.forEach((stage, i) => {
            const h   = Math.max(4, (counts[i] / max) * (H - 48));
            const x   = pad + i * (barW + gap) + gap / 2;
            const y   = H - 28 - h;

            // Bar gradient
            const grad = ctx.createLinearGradient(x, y, x, y + h);
            grad.addColorStop(0, '#5aa0f5');
            grad.addColorStop(1, '#7c3aed');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, h, [4, 4, 0, 0]);
            ctx.fill();

            // Count label
            ctx.fillStyle = '#93c5fd';
            ctx.font = `bold ${Math.max(9, Math.min(12, barW - 2))}px var(--font-mono, monospace)`;
            ctx.textAlign = 'center';
            ctx.fillText(String(counts[i]), x + barW / 2, y - 5);

            // Stage label
            ctx.fillStyle = '#4d6480';
            ctx.font = `${Math.max(8, Math.min(10, barW - 2))}px sans-serif`;
            const label = (STAGE_LABELS[stage] || stage).substring(0, 4);
            ctx.fillText(label, x + barW / 2, H - 10);
        });
    },
};

// ===============================================================
// 19. PRINT FUNCTIONS
// ===============================================================

/** Opens a print window with the given HTML content */
function openPrintWindow(html) {
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 500);
}

async function printFullReport() {
    Project.collectFormData();
    try {
        const html = await ReportGenerator.generateFullReport(AppState.current, false);
        openPrintWindow(html);
        Toast.show('جارٍ تحضير التقرير...', 'info');
    } catch (err) {
        console.error(err);
        Toast.show('خطأ في إنشاء التقرير', 'error');
    }
}

async function printSpecsOnly() {
    Project.collectFormData();
    try {
        const html = await ReportGenerator.generateSpecsOnlyReport(AppState.current, false);
        openPrintWindow(html);
        Toast.show('جارٍ تحضير المواصفات...', 'info');
    } catch (err) {
        console.error(err);
        Toast.show('خطأ في إنشاء التقرير', 'error');
    }
}

async function printSpecsWithDesigns() {
    Project.collectFormData();
    try {
        const html = await ReportGenerator.generateSpecsOnlyReport(AppState.current, true);
        openPrintWindow(html);
        Toast.show('جارٍ تحضير المواصفات مع التصاميم...', 'info');
    } catch (err) {
        console.error(err);
        Toast.show('خطأ في إنشاء التقرير', 'error');
    }
}

async function printDashboard() {
    const logoData      = null; // Logo hardcoded in HTML
    const printDate     = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });
    const dashboardHtml = document.getElementById('dashboardContent').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير لوحة القيادة</title>
        <style>
            body { font-family:'IBM Plex Sans Arabic',sans-serif; padding:20px; }
            .dashboard-kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px; }
            .kpi-card { border:1px solid #ccc; padding:12px; border-radius:6px; text-align:center; }
            .kpi-card__label { font-size:11px; font-weight:600; color:#6e7d94; text-transform:uppercase; margin-bottom:5px; display:block; }
            .kpi-card__value { font-size:20px; font-weight:700; }
            .dashboard-table { width:100%; border-collapse:collapse; margin-top:10px; }
            .dashboard-table th, .dashboard-table td { border:1px solid #ccc; padding:7px; text-align:center; font-size:12px; }
            .dashboard-table th { background:#1a2535; color:#fff; }
            .print-date { text-align:left; margin-bottom:20px; font-size:13px; color:#666; }
            ${logoData ? `.logo { text-align:center; margin-bottom:20px; } .logo img { max-height:60px; }` : ''}
        </style></head>
        <body>
            ${logoData ? `<div class="logo"><img src="${logoData}" alt="شعار"></div>` : ''}
            <div class="print-date">تاريخ التقرير: ${printDate}</div>
            ${dashboardHtml}
        </body></html>
    `);
    win.document.close();
    win.print();
}

// ===============================================================
// 20. CLIPBOARD
// ===============================================================

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for non-secure contexts
        const el = Object.assign(document.createElement('textarea'), {
            value: text, style: 'position:fixed;opacity:0;',
        });
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        return true;
    }
}

// ===============================================================
// 21. VIEW SWITCHER
// ===============================================================

function setupViewSwitcher() {
    const views = {
        project:   'projectManagerView',
        board:     'productionBoardView',
        dashboard: 'dashboardView',
    };

    const buttons = document.querySelectorAll('[data-view]');

    // Activate a view by key - always fetches fresh data from DB
    async function activateView(viewKey) {
        // Show/hide views
        Object.entries(views).forEach(([key, id]) => {
            const el = document.getElementById(id);
            if (el) el.style.display = (key === viewKey) ? 'block' : 'none';
        });

        // Mark active nav button
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewKey);
        });

        // Always reload data-driven views fresh from IndexedDB
        try {
            if (viewKey === 'board')     await ProductionBoard.render();
            if (viewKey === 'dashboard') await Dashboard.render();
        } catch (err) {
            console.error('View render error:', err);
            Toast.show('خطأ في تحميل البيانات', 'error');
        }
    }

    buttons.forEach(btn => {
        btn.addEventListener('click', () => activateView(btn.dataset.view));
    });

    // Start with project manager view (no DB call needed)
    Object.entries(views).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (el) el.style.display = (key === 'project') ? 'block' : 'none';
    });
    buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === 'project'));
}

// ===============================================================
// 22. EVENT DELEGATION (all click-based actions)
// ===============================================================

async function handleAction(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    switch (action) {

        // -- Theme toggle ---------------------------------------
        case 'toggle-theme': Theme.toggle(); break;
        case 'scroll-to-section': {
            const section = document.getElementById(target.dataset.target || '');
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
        }

        // -- Project CRUD ---------------------------------------
        case 'new-project':    Project.createNew(); break;
        case 'save-project':   Project.save(); break;
        case 'clear-project':  Project.createNew(); break;
        case 'export-project': Project.export(); break;

        case 'regenerate-id': {
            AppState.current.id = generateProjectId();
            document.getElementById('projectId').value = AppState.current.id;
            break;
        }

        case 'copy-id': {
            const id = document.getElementById('projectId').value;
            if (id) copyToClipboard(id).then(() => Toast.show(`تم نسخ: ${id}`));
            break;
        }

        // -- External links -------------------------------------
        case 'open-whatsapp': {
            const phone = document.getElementById('phoneInput').value.trim();
            if (!phone) { Toast.show('يجب إدخال رقم التليفون أولاً', 'error'); break; }
            window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
            break;
        }

        case 'open-maps': {
            const loc = document.getElementById('locationInput').value.trim();
            if (!loc) { Toast.show('يجب إدخال الموقع أولاً', 'error'); break; }
            window.open(loc.startsWith('http') ? loc : `https://maps.google.com/?q=${encodeURIComponent(loc)}`, '_blank');
            break;
        }

        // -- Specs notes ----------------------------------------
        case 'add-spec-note':     SpecsNotes.add(); break;
        case 'edit-spec-note':    SpecsNotes.startEdit(parseInt(target.dataset.index, 10)); break;
        case 'confirm-edit-note': SpecsNotes.confirmEdit(parseInt(target.dataset.index, 10)); break;
        case 'cancel-edit-note':  SpecsNotes.cancelEdit(); break;
        case 'delete-spec-note':  SpecsNotes.delete(parseInt(target.dataset.index, 10)); break;

        // -- Materials ------------------------------------------
        case 'add-item':        Items.add(); break;
        case 'edit-item-modal': Items.openEditModal(target.dataset.stage, parseInt(target.dataset.index, 10)); break;
        case 'delete-item':     Items.delete(target.dataset.stage, parseInt(target.dataset.index, 10)); break;
        case 'update-item':     Items.update(); break;

        // -- LPO ------------------------------------------------
        case 'generate-lpo':      LPO.generate(); break;
        case 'generate-full-lpo': LPO.generateFull(); break;
        case 'print-lpo':         LPO.print(); break;

        // -- Print ----------------------------------------------
        case 'print-full-report':        printFullReport(); break;
        case 'print-specs-only':         printSpecsOnly(); break;
        case 'print-specs-with-designs': printSpecsWithDesigns(); break;
        case 'print-dashboard':          printDashboard(); break;

        // -- Designs --------------------------------------------
        case 'upload-designs':       Designs.upload(); break;
        case 'delete-design':        Designs.delete(parseInt(target.dataset.designId, 10)); break;
        case 'clear-designs-upload': Designs.clearUpload(); break;

        // -- Projects modal -------------------------------------
        case 'open-projects-modal': {
            const projects = await DB.loadProjects();
            await Renderer.renderProjectsList(projects);
            Modal.open('projectsModal');
            // Clear search and focus it
            const searchEl = document.getElementById('projectsSearchInput');
            if (searchEl) { searchEl.value = ''; setTimeout(() => searchEl.focus(), 100); }
            break;
        }

        case 'open-project': {
            const pid = target.dataset.projectId;
            const ok  = await Project.loadById(pid);
            if (ok) {
                Modal.closeAll();
                document.getElementById('projectFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            break;
        }

        case 'duplicate-project': Project.duplicate(target.dataset.projectId); break;
        case 'delete-project':    Project.deleteById(target.dataset.projectId); break;

        case 'delete-all': {
            await Project.deleteAll();
            Modal.closeAll();
            break;
        }

        // -- Import ---------------------------------------------
        case 'import-project': Modal.open('importModal'); break;

        case 'import-project-file': {
            document.getElementById('importFileInput').click();
            break;
        }

        case 'do-import': {
            const textarea = document.getElementById('importDataInput');
            const success  = Project.import(textarea.value);
            if (success) {
                textarea.value = '';
                Modal.closeAll();
                Toast.show('تم استيراد المشروع بنجاح');
            } else {
                Toast.show('خطأ في بيانات الاستيراد — تأكد من صحة JSON', 'error');
            }
            break;
        }

        // -- Close modal ----------------------------------------
        case 'close-modal': Modal.closeAll(); break;

        // -- Workflow -------------------------------------------
        case 'toggle-workflow': {
            const step = target.dataset.step;
            if (!step) break;

            // Update workflow state directly (don't go through Project.save which re-renders everything)
            AppState.current.workflow[step] = target.checked;
            AppState.current.progress       = calculateProjectProgress(AppState.current);
            AppState.current.currentStage   = detectProjectStage(AppState.current);
            stampProjectDates(AppState.current);
            AppState.current.updatedAt      = new Date().toISOString();

            // Save to DB directly (skip collectFormData + renderAll to avoid resetting checkboxes)
            try {
                await DB.saveProject(AppState.current);
                // Only re-render the workflow section and progress bar, not the whole form
                Renderer.renderWorkflow(AppState.current);
                Toast.show('تم تحديث التقدم', 'success');
            } catch (err) {
                Toast.show('خطأ في الحفظ: ' + err.message, 'error');
            }
            break;
        }

        // -- Open project from production board -----------------
        case 'open-project-from-board': {
            const card = target.closest('[data-project-id]');
            if (!card) break;
            // Switch to project view by clicking the nav button
            const projectBtn = document.querySelector('[data-view="project"]');
            if (projectBtn) projectBtn.click();
            await Project.loadById(card.dataset.projectId);
            break;
        }

        // -- Sort board column ----------------------------------
        case 'sort-column': {
            const stage   = target.dataset.stage;
            const sortBy  = target.dataset.sort;
            const column  = document.querySelector(`.board-column[data-stage="${stage}"]`);
            if (!column) break;

            const projects     = await DB.loadProjects();
            const stageProjects = projects.filter(p => p.currentStage === stage);

            stageProjects.sort((a, b) => {
                if (sortBy === 'progress') return b.progress - a.progress;
                if (sortBy === 'deadline') {
                    const da = a.dates?.deliveryDate ? new Date(a.dates.deliveryDate) : Infinity;
                    const db = b.dates?.deliveryDate ? new Date(b.dates.deliveryDate) : Infinity;
                    return da - db;
                }
                return 0;
            });

            stageProjects.forEach(p => {
                const card = column.querySelector(`.board-card[data-project-id="${p.id}"]`);
                if (card) column.appendChild(card);
            });
            break;
        }

        // -- Print all projects table ---------------------------
        case 'print-projects-table': {
            const projects = await DB.loadProjects();
            if (!projects.length) { Toast.show('لا توجد مشاريع للطباعة', 'error'); break; }
            const html = await ReportGenerator.generateProjectsReport(projects);
            openPrintWindow(html);
            break;
        }
    }
}

// ===============================================================
// 23. LIVE INPUT LISTENERS
// ===============================================================

function setupLiveListeners() {
    // Financial inputs - update KPIs in real time
    ['discountInput', 'paidInput', 'totalAmountInput'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const snapshot = deepClone(AppState.current);
            snapshot.financials = {
                discount:    parseFloat(document.getElementById('discountInput').value)    || 0,
                paid:        parseFloat(document.getElementById('paidInput').value)        || 0,
                totalAmount: parseFloat(document.getElementById('totalAmountInput').value) || 0,
            };
            Renderer.renderKPIs(snapshot);
        });
    });

    // Design drag-and-drop
    _setupDropZone('designDropZone', (files) => {
        document.getElementById('designFileInput').files = files;
        Designs.upload();
    });

    // Autocomplete on item name input
    const itemNameInput     = document.getElementById('itemNameInput');
    let autocompleteTimeout = null;

    itemNameInput.addEventListener('input', (e) => {
        clearTimeout(autocompleteTimeout);
        const q = e.target.value.trim();
        if (q.length < 1) { Autocomplete.hide(); return; }
        autocompleteTimeout = setTimeout(() => Autocomplete.show(q), 300);
    });

    itemNameInput.addEventListener('keydown', (e) => {
        if (Autocomplete.active) {
            if (e.key === 'ArrowDown')  { e.preventDefault(); Autocomplete.navigate('down'); }
            else if (e.key === 'ArrowUp')  { e.preventDefault(); Autocomplete.navigate('up'); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (!Autocomplete.selectCurrent()) Items.add();
            }
            else if (e.key === 'Escape') { e.preventDefault(); Autocomplete.hide(); }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            Items.add();
        }
    });

    itemNameInput.addEventListener('blur', () => setTimeout(() => Autocomplete.hide(), 200));

    document.getElementById('autocompleteList').addEventListener('click', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (item) Autocomplete.select(item);
    });

    // Spec notes - add on Enter
    document.getElementById('specsNotesInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); SpecsNotes.add(); }
    });

    // Paint fields toggle on add form
    document.getElementById('itemNeedsPaintInput').addEventListener('change', (e) => {
        const show = e.target.checked;
        document.getElementById('paintFields').style.display = show ? 'grid' : 'none';
        if (show) document.getElementById('itemPaintColorInput').value = getDefaultPaintColor();
        else { document.getElementById('itemPaintCostInput').value = ''; document.getElementById('itemPaintColorInput').value = ''; }
    });

    // Auto-update paint colour when door colour changes
    document.getElementById('doorColorInput').addEventListener('input', (e) => {
        if (document.getElementById('itemNeedsPaintInput').checked) {
            document.getElementById('itemPaintColorInput').value = e.target.value;
        }
    });

    // Tax rate field toggle
    document.getElementById('lpoTaxInput').addEventListener('change', (e) => {
        document.getElementById('taxRateField').style.display = e.target.checked ? 'block' : 'none';
    });

    // Edit modal paint fields toggle
    document.getElementById('editItemNeedsPaint').addEventListener('change', (e) => {
        document.getElementById('editPaintFields').style.display = e.target.checked ? 'block' : 'none';
    });

    // Edit form - submit on Enter
    document.getElementById('editItemForm').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); Items.update(); }
    });

    // Projects modal search
    const projectsSearch = document.getElementById('projectsSearchInput');
    if (projectsSearch) {
        projectsSearch.addEventListener('input', (e) => {
            const q = e.target.value.trim().toLowerCase();
            const filtered = q
                ? Renderer._allProjects.filter(p =>
                    (p.client || '').toLowerCase().includes(q) ||
                    (p.id || '').toLowerCase().includes(q) ||
                    (p.name || '').toLowerCase().includes(q) ||
                    (p.phone || '').toLowerCase().includes(q) ||
                    (p.emirate || '').toLowerCase().includes(q)
                  )
                : Renderer._allProjects;
            Renderer._renderProjectCards(filtered);
        });
    }

    // Import file input
    document.getElementById('importFileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.name.endsWith('.json')) { Toast.show('الملف يجب أن يكون بصيغة JSON', 'error'); return; }
        const success = await Project.importFromFile(file);
        e.target.value = '';
        if (success) { Toast.show('تم استيراد المشروع بنجاح'); Modal.closeAll(); }
        else          Toast.show('خطأ في استيراد المشروع', 'error');
    });

    // Global Escape key closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') Modal.closeAll();
    });

    // Inline note edit - Enter to confirm, Escape to cancel
    document.getElementById('specsNotesList').addEventListener('keydown', (e) => {
        const input = e.target.closest('[id^="noteEditInput-"]');
        if (!input) return;
        const idx = parseInt(input.dataset.noteIndex, 10);
        if (e.key === 'Enter')  { e.preventDefault(); SpecsNotes.confirmEdit(idx); }
        if (e.key === 'Escape') { e.preventDefault(); SpecsNotes.cancelEdit(); }
    });

    // Reposition portal autocomplete on scroll/resize so it follows the input
    window.addEventListener('scroll', () => { if (Autocomplete.active) Autocomplete._reposition(); }, { passive: true });
    window.addEventListener('resize', () => { if (Autocomplete.active) Autocomplete._reposition(); }, { passive: true });
    document.querySelector('.main-content')?.addEventListener('scroll', () => { if (Autocomplete.active) Autocomplete._reposition(); }, { passive: true });
}

/** Sets up drag-and-drop for a drop zone */
function _setupDropZone(zoneId, onDrop) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt =>
        zone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); })
    );
    zone.addEventListener('dragover',  () => zone.classList.add('dragover'));
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) onDrop(e.dataTransfer.files);
    });
}

// ===============================================================
// 24. AUTO-SAVE
// ===============================================================

// -- Auto-save indicator helper ------------------------------
const AutosaveUI = {
    _el:   null,
    _dot:  null,
    _text: null,
    _init() {
        if (this._el) return;
        this._el   = document.getElementById('autosaveIndicator');
        this._text = document.getElementById('autosaveText');
    },
    saving() {
        this._init();
        if (!this._el) return;
        this._el.className = 'autosave-indicator saving';
        this._text.textContent = 'جارٍ الحفظ...';
    },
    saved() {
        this._init();
        if (!this._el) return;
        this._el.className = 'autosave-indicator saved';
        this._text.textContent = 'تم الحفظ';
        setTimeout(() => {
            if (this._el) { this._el.className = 'autosave-indicator'; this._text.textContent = 'جاهز'; }
        }, 2500);
    },
    error() {
        this._init();
        if (!this._el) return;
        this._el.className = 'autosave-indicator';
        this._text.textContent = 'خطأ';
    },
};

function setupAutoSave() {
    let timer = null;

    const trigger = () => {
        clearTimeout(timer);
        AutosaveUI.saving();
        timer = setTimeout(async () => {
            if (AppState.current.client.trim()) {
                Project.collectFormData();
                AppState.current.updatedAt    = new Date().toISOString();
                AppState.current.progress     = calculateProjectProgress(AppState.current);
                AppState.current.currentStage = detectProjectStage(AppState.current);
                stampProjectDates(AppState.current);
                try {
                    await DB.saveProject(AppState.current);
                    AutosaveUI.saved();
                } catch (err) {
                    console.warn('Auto-save failed:', err);
                    AutosaveUI.error();
                }
            } else {
                AutosaveUI.error();
            }
        }, CONFIG.AUTO_SAVE_DELAY);
    };

    // Watch project form + items card inputs
    ['#projectFormCard', '#itemsCard', '#specificationsCard', '#financialsCard'].forEach(selector => {
        document.querySelectorAll(`${selector} input, ${selector} select, ${selector} textarea`).forEach(el =>
            el.addEventListener('input', trigger)
        );
    });
}

// ===============================================================
// 25. REAL-TIME FIELD VALIDATION (visual feedback)
// ===============================================================

function setupFieldValidation() {
    ['clientInput', 'phoneInput'].forEach(id => {
        const field = document.getElementById(id);
        if (!field) return;

        field.addEventListener('blur', () => {
            field.style.borderColor       = field.value.trim() ? '' : 'var(--clr-danger)';
            field.style.backgroundColor   = field.value.trim() ? '' : 'var(--clr-danger-light)';
        });

        field.addEventListener('input', () => {
            if (field.value.trim()) {
                field.style.borderColor     = 'var(--clr-success)';
                field.style.backgroundColor = 'var(--clr-success-light)';
            }
        });
    });
}

// ===============================================================
// THEME MANAGER
// ===============================================================

const Theme = {
    _key: 'kpm-theme',

    /** Apply a theme ('dark' | 'light') to <html> and persist it */
    apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(this._key, theme);
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next    = current === 'dark' ? 'light' : 'dark';
        this.apply(next);
        Toast.show(next === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح', 'info');
    },

    /** Call once at startup - restores user's saved preference */
    init() {
        const saved = localStorage.getItem(this._key);
        if (saved === 'light' || saved === 'dark') {
            this.apply(saved);
        } else {
            // Default to dark, but respect OS preference if no saved choice
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.apply(prefersDark ? 'dark' : 'light');
        }
    },
};

// ===============================================================
// 26. INITIALISATION
// ===============================================================

async function init() {
    try {
        // Apply saved theme immediately (before DOM renders to avoid flash)
        Theme.init();

        // Wait for DOM if not yet ready
        if (document.readyState !== 'complete') {
            await new Promise(resolve => {
                if (document.readyState === 'complete') resolve();
                else document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }

        await DB.init();

        // Global click delegation
        document.addEventListener('click', handleAction);

        // Live input listeners
        setupLiveListeners();
        setupFieldValidation();

        // Populate selects before first render
        Renderer.renderLPOStages();
        Renderer.renderUnitsSelect();

        // Render empty project
        Renderer.renderAll(AppState.current);

        // View switcher (sets up nav buttons + shows project view)
        setupViewSwitcher();

        // Auto-save
        setupAutoSave();

        // Welcome toast
        if (!localStorage.getItem('welcomeShown')) {
            Toast.show('مرحباً بك في ProjeXWise Kitchen! 🎉', 'info');
            localStorage.setItem('welcomeShown', 'true');
        }

    } catch (err) {
        console.error('Initialisation error:', err);
        Toast.show('خطأ في تهيئة النظام: ' + err.message, 'error');
    }
}

// --- Boot -----------------------------------------------------
// Apply theme immediately to avoid flash of wrong theme on load
(function() {
    const saved = localStorage.getItem('kpm-theme');
    const theme = (saved === 'light' || saved === 'dark')
        ? saved
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 80));
} else {
    setTimeout(init, 80);
}

// --- Sticky actions bar shadow when scrolled ------------------
// Uses IntersectionObserver to add .is-stuck when the bar leaves its natural position
(function setupStickyBar() {
    const setup = () => {
        const bar = document.querySelector('.project-actions-bar');
        if (!bar) return;

        // Insert a 1px sentinel element above the bar
        const sentinel = document.createElement('div');
        sentinel.style.cssText = 'position:absolute;height:1px;top:0;left:0;right:0;pointer-events:none;';
        bar.parentElement.style.position = 'relative';
        bar.parentElement.insertBefore(sentinel, bar);

        const observer = new IntersectionObserver(
            ([entry]) => bar.classList.toggle('is-stuck', !entry.isIntersecting),
            { threshold: 1, rootMargin: `-${parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '64')}px 0px 0px 0px` }
        );
        observer.observe(sentinel);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup, { once: true });
    } else {
        setup();
    }
})();

// ===============================================================
// ENTRY MODAL — تبويبات رئيسية + فرعية لإدخال البيانات
// ===============================================================

const EntryModal = {
    _open: false,

    // -- Open --------------------------------------------------
    open(ptab, stab) {
        this._populate();
        document.getElementById('entryModal').classList.add('open');
        document.body.style.overflow = 'hidden';
        this._open = true;
        if (ptab) this.switchPrimary(ptab);
        if (stab) {
            // find which parent has this stab
            const btn = document.querySelector(`.entry-stab[data-stab="${stab}"]`);
            if (btn) this.switchSecondary(btn.dataset.parent, stab);
        }
        setTimeout(() => {
            const first = document.querySelector('#entryModal .entry-spane.active .form-input:not([readonly])');
            if (first) first.focus();
        }, 300);
    },

    close() {
        document.getElementById('entryModal').classList.remove('open');
        document.body.style.overflow = '';
        this._open = false;
    },

    // -- Populate modal fields from AppState -------------------
    _populate() {
        const p = AppState.current;
        const s = p.specifications || {};
        const f = p.financials     || {};

        // subtitle
        const sub = document.getElementById('entryModalSubtitle');
        if (sub) sub.textContent = p.client ? `مشروع: ${p.client} — ${p.id}` : 'مشروع جديد';

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

        // project / basics
        set('projectId',        p.id);
        set('clientInput',      p.client);
        set('phoneInput',       p.phone);
        set('salesInput',       p.sales);
        set('emirateInput',     p.emirate);
        set('addressInput',     p.address);
        set('locationInput',    p.location);
        set('projectNameInput', p.name);

        // project / dates
        set('dateInput',         p.date);
        set('deliveryDateInput', p.dates?.deliveryDate || '');

        // specs
        CONFIG.SPEC_FIELDS.forEach(field => {
            set(field.key + 'Input', s[field.key]);
        });

        // financials
        set('totalAmountInput', f.totalAmount || 0);
        set('discountInput',    f.discount    || 0);
        set('paidInput',        f.paid        || 0);

        // notes
        SpecsNotes.render();

        // modal LPO selects
        this._populateModalLPO();

        // live financial update
        this._updateLive();

        // designs gallery in modal
        Designs.renderIn('modalDesignsGallery');
    },

    _populateModalLPO() {
        const sel = document.getElementById('lpoStageSelectM');
        if (!sel) return;
        sel.innerHTML = Object.entries(CONFIG.STAGES)
            .map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
        // sync supplier / tax from main LPO
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

    // -- Collect & save ----------------------------------------
    async saveAndClose() {
        this._collectFields();

        if (!AppState.current.client.trim()) {
            document.getElementById('clientInput')?.focus();
            Toast.show('اسم العميل مطلوب', 'error');
            return;
        }

        AppState.current.updatedAt    = new Date().toISOString();
        AppState.current.progress     = calculateProjectProgress(AppState.current);
        AppState.current.currentStage = detectProjectStage(AppState.current);
        stampProjectDates(AppState.current);

        try {
            await DB.saveProject(AppState.current);
            Renderer.renderAll(AppState.current);
            DisplayRenderer.renderAll(AppState.current);
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

        AppState.current.client   = get('clientInput');
        AppState.current.phone    = get('phoneInput');
        AppState.current.sales    = get('salesInput');
        AppState.current.emirate  = get('emirateInput');
        AppState.current.address  = get('addressInput');
        AppState.current.location = get('locationInput');
        AppState.current.name     = get('projectNameInput');
        AppState.current.date     = get('dateInput');
        AppState.current.dates    = AppState.current.dates || {};
        AppState.current.dates.deliveryDate = get('deliveryDateInput') || null;

        CONFIG.SPEC_FIELDS.forEach(field => {
            const el = document.getElementById(field.key + 'Input');
            if (el) AppState.current.specifications[field.key] = el.value.trim();
        });

        AppState.current.financials = {
            totalAmount: getN('totalAmountInput'),
            discount:    getN('discountInput'),
            paid:        getN('paidInput'),
        };
    },

    // -- Live financial update ---------------------------------
    _updateLive() {
        const total    = parseFloat(document.getElementById('totalAmountInput')?.value) || 0;
        const discount = parseFloat(document.getElementById('discountInput')?.value)    || 0;
        const paid     = parseFloat(document.getElementById('paidInput')?.value)        || 0;
        const net      = total - discount;
        const remaining= net - paid;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatNumber(val) + ' درهم'; };
        set('flsNet',       net);
        set('flsPaid',      paid);
        set('flsRemaining', remaining);

        const rem = document.getElementById('flsRemaining');
        if (rem) rem.style.color = remaining > 0 ? 'var(--clr-danger-text)' : remaining < 0 ? 'var(--clr-warning-text)' : 'var(--clr-success-text)';
    },

    // -- Tab switching -----------------------------------------
    switchPrimary(ptab) {
        document.querySelectorAll('.entry-ptab').forEach(b => {
            b.classList.toggle('active', b.dataset.ptab === ptab);
        });
        document.querySelectorAll('.entry-ppane').forEach(p => {
            p.classList.toggle('active', p.id === `entryPane-${ptab}`);
        });
        // Sync modal items list when switching to materials
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
        // Sync modal items list
        if (stab === 'view-items') {
            const modal = document.getElementById('modalItemsLists');
            if (modal) modal.innerHTML = document.getElementById('itemsLists')?.innerHTML || '';
        }
    },

    // -- Init -------------------------------------------------
    init() {
        // Primary tab clicks
        document.querySelectorAll('.entry-ptab').forEach(btn => {
            btn.addEventListener('click', () => this.switchPrimary(btn.dataset.ptab));
        });
        // Secondary tab clicks
        document.querySelectorAll('.entry-stab').forEach(btn => {
            btn.addEventListener('click', () => this.switchSecondary(btn.dataset.parent, btn.dataset.stab));
        });
        // Close buttons
        document.querySelectorAll('[data-action="close-entry-modal"]').forEach(el => {
            el.addEventListener('click', () => this.close());
        });
        // Save button
        document.querySelector('[data-action="save-from-entry-modal"]')?.addEventListener('click', () => this.saveAndClose());
        // ESC
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && this._open) this.close(); });
        // Live financial listeners
        ['totalAmountInput', 'discountInput', 'paidInput'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this._updateLive());
        });
        // Open modal triggers
        document.addEventListener('click', e => {
            const btn = e.target.closest('[data-action="open-entry-modal"]');
            if (btn) {
                e.preventDefault();
                this.open(btn.dataset.tab || 'project', null);
            }
        });
        // Modal LPO
        document.getElementById('modalLpoBtn')?.addEventListener('click', () => {
            this._syncLPOFromModal();
            LPO.generate();
        });
        document.getElementById('modalFullLpoBtn')?.addEventListener('click', () => {
            this._syncLPOFromModal();
            LPO.generateFull();
        });
    },

    _syncLPOFromModal() {
        const sync = (fromId, toId) => {
            const from = document.getElementById(fromId);
            const to   = document.getElementById(toId);
            if (from && to) to.value = from.value;
        };
        const syncChk = (fromId, toId) => {
            const from = document.getElementById(fromId);
            const to   = document.getElementById(toId);
            if (from && to) to.checked = from.checked;
        };
        sync('lpoStageSelectM',    'lpoStageSelect');
        sync('lpoSupplierInputM',  'lpoSupplierInput');
        sync('lpoTaxRateInputM',   'lpoTaxRateInput');
        syncChk('lpoTaxInputM',    'lpoTaxInput');
    },
};

// ===============================================================
// DISPLAY RENDERER - renders read-only views on the main page
// ===============================================================

const DisplayRenderer = {
    renderAll(project) {
        this.renderProjectInfo(project);
        this.renderSpecifications(project);
        this.renderFinancials(project);
        this.renderProjectId(project);
        this.renderProjectOverview(project);
    },

    renderProjectId(project) {
        const el = document.getElementById('displayProjectId');
        if (el) el.textContent = project.id || '-';
    },

    renderProjectOverview(project) {
        const titleEl     = document.getElementById('overviewProjectTitle');
        const subtitleEl  = document.getElementById('overviewProjectSubtitle');
        const metaEl      = document.getElementById('overviewMeta');
        const statsEl     = document.getElementById('overviewStats');
        const spotlightEl = document.getElementById('overviewSpotlight');
        if (!titleEl || !subtitleEl || !metaEl || !statsEl || !spotlightEl) return;

        const progress       = project.progress || 0;
        const nextStep       = getNextWorkflowStep(project);
        const remainingDays  = getRemainingDays(project);
        const stageLabel     = STAGE_LABELS[project.currentStage] || project.currentStage || 'مرحلة التأسيس';
        const materialsCount = Object.values(project.items || {}).reduce((sum, items) => sum + (items?.length || 0), 0);
        const notesCount     = project.specifications?.notes?.length || 0;
        const clientLabel    = project.client || 'عميل جديد';
        const projectLabel   = project.name || clientLabel;
        const dueLabel       = remainingDays === null
            ? 'غير محدد'
            : remainingDays < 0
                ? 'متجاوز الموعد'
                : remainingDays === 0
                    ? 'اليوم'
                    : `${remainingDays} يوم`;

        let statusClass = 'is-active';
        let statusLabel = 'نشط';
        if (project.workflow?.handover_signed) {
            statusClass = 'is-done';
            statusLabel = 'مسلّم';
        } else if (remainingDays !== null && remainingDays < 7) {
            statusClass = 'is-warning';
            statusLabel = remainingDays < 0 ? 'متأخر' : 'قريب من التسليم';
        }

        titleEl.textContent = projectLabel;
        subtitleEl.textContent = nextStep
            ? `المرحلة الحالية ${stageLabel}. الخطوة التالية المقترحة: ${nextStep.label}.`
            : 'اكتملت جميع خطوات سير العمل لهذا المشروع.';

        metaEl.innerHTML = [
            `<span class="overview-meta-pill">العميل <strong>${escapeHtml(clientLabel)}</strong></span>`, 
            `<span class="overview-meta-pill">رقم المشروع <strong>${escapeHtml(project.id || '-')}</strong></span>`, 
            `<span class="overview-meta-pill">الموقع <strong>${escapeHtml(project.emirate || 'غير محدد')}</strong></span>`, 
            `<span class="overview-meta-pill">التسليم <strong>${escapeHtml(dueLabel)}</strong></span>`, 
        ].join('');

        spotlightEl.innerHTML = `
            <div class="overview-spotlight-card">
                <span class="overview-spotlight-card__label">Status Snapshot</span>
                <div class="overview-pill-row">
                    <span class="overview-status-badge ${statusClass}">${statusLabel}</span>
                    <span class="overview-meta-pill">التقدم <strong>${progress}%</strong></span>
                </div>
                <div class="overview-spotlight-card__value">${escapeHtml(stageLabel)}</div>
                <p class="overview-spotlight-card__subtext">${nextStep ? `التركيز الحالي: ${nextStep.label}.` : 'لا توجد خطوات معلقة حاليًا.'}</p>
                <div class="overview-spotlight-card__progress">
                    <span>نسبة الإنجاز</span>
                    <strong>${progress}%</strong>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${progress}%"></div>
                </div>
            </div>
            <div class="overview-spotlight-card">
                <span class="overview-spotlight-card__label">Commercial View</span>
                <div class="overview-spotlight-card__value">${formatNumber(project.financials?.totalAmount || 0)} درهم</div>
                <p class="overview-spotlight-card__subtext">المتبقي للتحصيل ${formatNumber((project.financials?.totalAmount || 0) - (project.financials?.discount || 0) - (project.financials?.paid || 0))} درهم</p>
            </div>`;

        const cards = [
            { label: 'المواد المسجلة', value: materialsCount, hint: 'عناصر مرتبطة بكل مراحل العمل' },
            { label: 'المبلغ المدفوع', value: `${formatNumber(project.financials?.paid || 0)} درهم`, hint: 'إجمالي ما تم تحصيله حتى الآن' },
            { label: 'ملاحظات المواصفات', value: notesCount, hint: 'نقاط تحتاج مراجعة ومتابعة' },
            { label: 'الخطوات المكتملة', value: `${Object.values(project.workflow || {}).filter(Boolean).length}/${WORKFLOW_STEP_KEYS.length}`, hint: 'ضمن رحلة التنفيذ الكاملة' },
        ];

        statsEl.innerHTML = cards.map(card => `
            <div class="overview-stat-card">
                <span class="overview-stat-card__label">${escapeHtml(card.label)}</span>
                <span class="overview-stat-card__value">${escapeHtml(String(card.value))}</span>
                <span class="overview-stat-card__hint">${escapeHtml(card.hint)}</span>
            </div>`).join('');
    },

    renderProjectInfo(project) {
        const grid = document.getElementById('projectInfoGrid');
        if (!grid) return;
        const items = [
            { label: 'اسم العميل',    value: project.client,   important: true },
            { label: 'البائع',         value: project.sales },
            { label: 'رقم الهاتف',    value: project.phone },
            { label: 'الإمارة',        value: project.emirate },
            { label: 'العنوان',        value: project.address },
            { label: 'اسم المشروع',   value: project.name },
            { label: 'تاريخ الاتفاق', value: project.date ? formatDate(project.date) : null },
            { label: 'تاريخ التسليم', value: project.dates?.deliveryDate ? formatDate(project.dates.deliveryDate) : null },
            { label: 'رابط الموقع',   value: project.location, isLink: true },
        ];
        grid.innerHTML = items.map(item => `
            <div class="view-info-item${item.isLink ? ' view-info-item--link' : ''}">
                <span class="view-info-item__label">${escapeHtml(item.label)}</span>
                <span class="view-info-item__value${!item.value ? ' is-empty' : ''}"
                    ${item.isLink && item.value ? `onclick="window.open('${escapeHtml(item.value)}','_blank')"` : ''}>
                    ${item.value ? escapeHtml(String(item.value)) : 'غير محدد'}
                </span>
            </div>`).join('');
    },

    renderSpecifications(project) {
        const grid = document.getElementById('specificationsDisplayGrid');
        if (!grid) return;
        const s = project.specifications || {};
        const pairs = [
            { label: 'البوكسات',               values: [s.boxType, s.boxColor] },
            { label: 'الضلفات',                values: [s.doorType, s.doorColor] },
            { label: 'الأدراج',                values: [s.drawerType, s.drawerCount ? `${s.drawerCount} درج` : null] },
            { label: 'المسكات',                values: [s.handleType, s.handleColor] },
            { label: 'الرخام / البورسلين',     values: [s.counterType, s.counterColor] },
            { label: 'النعلة السفلية',          values: [s.skirtingNeeded] },
            { label: 'الفيلر العلوي',           values: [s.upperFillerNeeded] },
            { label: 'الإضاءة',                values: [s.lightsNeeded, s.lightsDescription] },
            { label: 'الجزيرة',                values: [s.islandNeeded, s.islandDescription] },
        ];
        grid.innerHTML = pairs.map(pair => {
            const filled = (pair.values || []).filter(Boolean);
            return `
                <div class="view-spec-pair">
                    <span class="view-spec-pair__label">${escapeHtml(pair.label)}</span>
                    <div class="view-spec-pair__values">
                        ${filled.length
                            ? filled.map(v => `<span class="view-spec-val">${escapeHtml(v)}</span>`).join('<span class="view-spec-val__sub"> / </span>')
                            : '<span class="view-spec-val is-empty">غير محدد</span>'}
                    </div>
                </div>`;
        }).join('');

        // Notes
        const notesDisplay = document.getElementById('specsNotesDisplay');
        if (notesDisplay) {
            const notes = s.notes || [];
            if (notes.length) {
                notesDisplay.innerHTML = `
                    <div class="notes-list">
                        ${notes.map(n => `<div class="note-item"><span class="note-item__bullet">📌</span><span class="note-item__text">${escapeHtml(n)}</span></div>`).join('')}
                    </div>`;
            } else {
                notesDisplay.innerHTML = '';
            }
        }
    },

    renderFinancials(project) {
        const row = document.getElementById('financialsDisplayRow');
        if (!row) return;
        const f   = project.financials || {};
        const items = [
            { label: 'المبلغ المتفق عليه', value: formatNumber(f.totalAmount || 0) + ' درهم' },
            { label: 'الخصم',              value: formatNumber(f.discount    || 0) + ' درهم' },
            { label: 'المدفوع',            value: formatNumber(f.paid        || 0) + ' درهم' },
        ];
        row.innerHTML = items.map(i => `
            <div class="fin-display-item">
                <span class="fin-display-item__label">${escapeHtml(i.label)}</span>
                <span class="fin-display-item__value">${escapeHtml(i.value)}</span>
            </div>`).join('');
    },
};

// -- Patch Designs to support dual gallery (main + modal) ------
const _origDesignsRender = Designs.render.bind(Designs);
Designs.render = async function() {
    await _origDesignsRender();
    await this.renderIn('modalDesignsGallery');
};
Designs.renderIn = async function(galleryId) {
    const gallery = document.getElementById(galleryId);
    if (!gallery) return;
    try {
        const designs = await DB.getDesignsForProject(AppState.current.id);
        if (!designs.length) {
            gallery.innerHTML = '<p class="designs-empty">لا توجد صور تصميم مرفوعة بعد</p>';
            return;
        }
        gallery.innerHTML = designs.map(d => `
            <div class="design-item">
                <img src="${d.data}" alt="تصميم المطبخ" class="design-item__image" loading="lazy">
                <div class="design-item__overlay">
                    <button class="btn btn--danger btn--icon btn--sm" data-action="delete-design" data-design-id="${d.id}" title="حذف">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </div>`).join('');
    } catch {
        gallery.innerHTML = '<p class="designs-empty">خطأ في تحميل الصور</p>';
    }
};

// -- Patch Renderer.renderAll to also update display views -----
const _origRendererAll = Renderer.renderAll.bind(Renderer);
Renderer.renderAll = function(project) {
    _origRendererAll(project);
    DisplayRenderer.renderAll(project);
};

// -- Patch Project.loadById to open entry modal after load -----
const _origLoadById = Project.loadById.bind(Project);
Project.loadById = async function(id) {
    const result = await _origLoadById(id);
    if (result) {
        DisplayRenderer.renderAll(AppState.current);
        Modal.closeAll();
    }
    return result;
};

// -- Boot EntryModal ------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        EntryModal.init();
        // Render LPO stages in modal
        const selM = document.getElementById('lpoStageSelectM');
        if (selM) {
            selM.innerHTML = Object.entries(CONFIG.STAGES)
                .map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
        }
    }, 150);
}, { once: true });
