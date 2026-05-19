// main.js - Entry point for the modularized app
import { Theme } from './modules/theme.js';
import { AppState, createEmptyProject } from './state.js';
import { DB, hasPermission, requirePermission, isCurrentOwner, getCurrentPermissions } from './db.js';
import { Toast } from './modules/toast.js';
import { Confirm } from './modules/confirm.js';
import { Modal } from './modules/modal.js';
import { Autocomplete } from './modules/autocomplete.js';
import { SpecsNotes } from './modules/specsNotes.js';
import { Items } from './modules/items.js';
import { Designs } from './modules/designs.js';
import { LPO } from './modules/lpo.js';
import { ReportGenerator } from './modules/reportGenerator.js';
import { Project } from './modules/project.js';
import { Renderer } from './modules/renderer.js';
import { ProductionBoard } from './modules/productionBoard.js';
import { Dashboard } from './modules/dashboard.js';
import { EntryModal } from './modules/entryModal.js';
import { DisplayRenderer } from './modules/displayRenderer.js';
import { AuthSession, UserAccess, ProfilePanel, AdminPanel, ActivityLogPanel } from './modules/auth.js';
import { MobileHeader } from './modules/mobileHeader.js';
import { printFullReport, printSpecsOnly, printSpecsWithDesigns, printDashboard, printProjectsTable } from './modules/print.js';
import { CONFIG, WORKFLOW_STEP_KEYS, STAGE_LABELS } from './config.js';
import { deepClone, calculateProjectProgress, detectProjectStage, stampProjectDates, escapeHtml } from './utils.js';

// Make some functions globally available for event handlers
window.Project = Project;
window.Toast = Toast;
window.Confirm = Confirm;
window.Modal = Modal;
window.Autocomplete = Autocomplete;
window.SpecsNotes = SpecsNotes;
window.Items = Items;
window.Designs = Designs;
window.LPO = LPO;
window.ReportGenerator = ReportGenerator;
window.Renderer = Renderer;
window.ProductionBoard = ProductionBoard;
window.Dashboard = Dashboard;
window.EntryModal = EntryModal;
window.DisplayRenderer = DisplayRenderer;
window.AuthSession = AuthSession;
window.UserAccess = UserAccess;
window.ProfilePanel = ProfilePanel;
window.AdminPanel = AdminPanel;
window.ActivityLogPanel = ActivityLogPanel;
window.MobileHeader = MobileHeader;
window.printFullReport = printFullReport;
window.printSpecsOnly = printSpecsOnly;
window.printSpecsWithDesigns = printSpecsWithDesigns;
window.printDashboard = printDashboard;
window.printProjectsTable = printProjectsTable;
window.hasPermission = hasPermission;
window.requirePermission = requirePermission;
window.isCurrentOwner = isCurrentOwner;
window.getCurrentPermissions = getCurrentPermissions;
window.AppState = AppState;
window.createEmptyProject = createEmptyProject;
window.CONFIG = CONFIG;
window.WORKFLOW_STEP_KEYS = WORKFLOW_STEP_KEYS;
window.STAGE_LABELS = STAGE_LABELS;
window.deepClone = deepClone;
window.calculateProjectProgress = calculateProjectProgress;
window.detectProjectStage = detectProjectStage;
window.stampProjectDates = stampProjectDates;
window.escapeHtml = escapeHtml;

// Helper for workspace visibility
window.updateProjectWorkspaceVisibility = function() {
    const emptyState = document.getElementById('projectEmptyState');
    const workspaceIds = [
        'projectOverview',
        'projectInfoDisplay',
        'specificationsDisplay',
        'workflowCard',
        'designsCard',
        'itemsCard',
        'financialsCard',
        'lpoCard',
        'actionsCard',
    ];
    const actionsBar = document.querySelector('.project-actions-bar');
    const isActive = AppState.hasActiveProject;
    if (emptyState) emptyState.style.display = isActive ? 'none' : 'grid';
    if (actionsBar) actionsBar.style.display = isActive ? 'flex' : 'none';
    workspaceIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = isActive ? '' : 'none';
    });
};

// Helper for AuthSession to set profile (circular dependency workaround)
window.__ensureProfile = AuthSession.ensureProfile.bind(AuthSession);

// Page loader
const PageLoader = {
    show(message) {
        const textEl = document.getElementById('pageLoaderText');
        if (message && textEl) textEl.textContent = message;
        document.body.classList.add('app-loading');
        document.body.classList.remove('app-ready');
    },
    finish() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    document.body.classList.remove('app-loading');
                    document.body.classList.add('app-ready');
                    resolve();
                });
            });
        });
    },
};

// Live listeners setup
function setupLiveListeners() {
    ['discountInput', 'paidInput', 'totalAmountInput'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            const snapshot = deepClone(AppState.current);
            snapshot.financials = {
                discount: parseFloat(document.getElementById('discountInput')?.value) || 0,
                paid: parseFloat(document.getElementById('paidInput')?.value) || 0,
                totalAmount: parseFloat(document.getElementById('totalAmountInput')?.value) || 0,
            };
            Renderer.renderKPIs(snapshot);
        });
    });

    function setupDropZone(zoneId, onDrop) {
        const zone = document.getElementById(zoneId);
        if (!zone) return;
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt =>
            zone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); })
        );
        zone.addEventListener('dragover', () => zone.classList.add('dragover'));
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) onDrop(e.dataTransfer.files);
        });
    }
    setupDropZone('designDropZone', (files) => {
        const input = document.getElementById('designFileInput');
        if (input) input.files = files;
        Designs.upload();
    });

    const itemNameInput = document.getElementById('itemNameInput');
    let autocompleteTimeout = null;
    if (itemNameInput) {
        itemNameInput.addEventListener('input', (e) => {
            clearTimeout(autocompleteTimeout);
            const q = e.target.value.trim();
            if (q.length < 1) { Autocomplete.hide(); return; }
            autocompleteTimeout = setTimeout(() => Autocomplete.show(q), 300);
        });
        itemNameInput.addEventListener('keydown', (e) => {
            if (Autocomplete.active) {
                if (e.key === 'ArrowDown') { e.preventDefault(); Autocomplete.navigate('down'); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); Autocomplete.navigate('up'); }
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
    }
    document.getElementById('autocompleteList')?.addEventListener('click', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (item) Autocomplete.select(item);
    });
    document.getElementById('specsNotesInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); SpecsNotes.add(); }
    });
    document.getElementById('itemNeedsPaintInput')?.addEventListener('change', (e) => {
        const show = e.target.checked;
        const paintFields = document.getElementById('paintFields');
        if (paintFields) paintFields.style.display = show ? 'grid' : 'none';
        if (show) {
            const colorInput = document.getElementById('itemPaintColorInput');
            if (colorInput) colorInput.value = AppState.current.specifications.doorColor || '';
        } else {
            const costInput = document.getElementById('itemPaintCostInput');
            const colorInput = document.getElementById('itemPaintColorInput');
            if (costInput) costInput.value = '';
            if (colorInput) colorInput.value = '';
        }
    });
    document.getElementById('doorColorInput')?.addEventListener('input', (e) => {
        if (document.getElementById('itemNeedsPaintInput')?.checked) {
            const paintColor = document.getElementById('itemPaintColorInput');
            if (paintColor) paintColor.value = e.target.value;
        }
    });
    document.getElementById('lpoTaxInput')?.addEventListener('change', (e) => {
        const taxRateField = document.getElementById('taxRateField');
        if (taxRateField) taxRateField.style.display = e.target.checked ? 'block' : 'none';
    });
    document.getElementById('editItemNeedsPaint')?.addEventListener('change', (e) => {
        const paintFields = document.getElementById('editPaintFields');
        if (paintFields) paintFields.style.display = e.target.checked ? 'block' : 'none';
    });
    document.getElementById('editItemForm')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); Items.update(); }
    });
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
                    (p.emirate || '').toLowerCase().includes(q))
                : Renderer._allProjects;
            Renderer._renderProjectCards(filtered);
        });
    }
    document.getElementById('importFileInput')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.name.endsWith('.json')) {
            Toast.show('الملف يجب أن يكون بصيغة JSON', 'error');
            return;
        }
        const success = await Project.importFromFile(file);
        e.target.value = '';
        if (success) { Toast.show('تم استيراد المشروع بنجاح'); Modal.closeAll(); }
        else Toast.show('خطأ في استيراد المشروع', 'error');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') Modal.closeAll();
    });
    document.getElementById('specsNotesList')?.addEventListener('keydown', (e) => {
        const input = e.target.closest('[id^="noteEditInput-"]');
        if (!input) return;
        const idx = parseInt(input.dataset.noteIndex, 10);
        if (e.key === 'Enter') { e.preventDefault(); SpecsNotes.confirmEdit(idx); }
        if (e.key === 'Escape') { e.preventDefault(); SpecsNotes.cancelEdit(); }
    });
    window.addEventListener('scroll', () => { if (Autocomplete.active) Autocomplete._reposition(); }, { passive: true });
    window.addEventListener('resize', () => { if (Autocomplete.active) Autocomplete._reposition(); }, { passive: true });
    document.querySelector('.main-content')?.addEventListener('scroll', () => { if (Autocomplete.active) Autocomplete._reposition(); }, { passive: true });
}

function setupFieldValidation() {
    ['projectNameInput'].forEach(id => {
        const field = document.getElementById(id);
        if (!field) return;
        field.addEventListener('blur', () => {
            field.style.borderColor = field.value.trim() ? '' : 'var(--clr-danger)';
            field.style.backgroundColor = field.value.trim() ? '' : 'var(--clr-danger-light)';
        });
        field.addEventListener('input', () => {
            if (field.value.trim()) {
                field.style.borderColor = 'var(--clr-success)';
                field.style.backgroundColor = 'var(--clr-success-light)';
            }
        });
    });
}

function setupViewSwitcher() {
    const views = {
        project: 'projectManagerView',
        board: 'productionBoardView',
        dashboard: 'dashboardView',
    };
    const buttons = document.querySelectorAll('[data-view]');
    async function activateView(viewKey) {
        if (viewKey === 'board' && !hasPermission('canViewBoard')) {
            Toast.show('لا تملك صلاحية الوصول إلى لوحة الإنتاج', 'error');
            return;
        }
        if (viewKey === 'dashboard' && !hasPermission('canViewDashboard')) {
            Toast.show('لا تملك صلاحية الوصول إلى لوحة القيادة', 'error');
            return;
        }
        Object.entries(views).forEach(([key, id]) => {
            const el = document.getElementById(id);
            if (el) el.style.display = (key === viewKey) ? 'block' : 'none';
        });
        buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewKey));
        try {
            if (viewKey === 'board') await ProductionBoard.render();
            if (viewKey === 'dashboard') await Dashboard.render();
        } catch (err) {
            console.error('View render error:', err);
            Toast.show('خطأ في تحميل البيانات', 'error');
        }
    }
    buttons.forEach(btn => btn.addEventListener('click', () => activateView(btn.dataset.view)));
    Object.entries(views).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (el) el.style.display = (key === 'board') ? 'block' : 'none';
    });
    buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === 'board'));
    activateView('board');
}

const AutosaveUI = {
    _el: null, _text: null,
    _init() {
        if (this._el) return;
        this._el = document.getElementById('autosaveIndicator');
        this._text = document.getElementById('autosaveText');
    },
    saving() {
        this._init();
        if (!this._el) return;
        this._el.className = 'autosave-indicator saving';
        if (this._text) this._text.textContent = 'جارٍ الحفظ...';
    },
    saved() {
        this._init();
        if (!this._el) return;
        this._el.className = 'autosave-indicator saved';
        if (this._text) this._text.textContent = 'تم الحفظ';
        setTimeout(() => {
            if (this._el) { this._el.className = 'autosave-indicator'; if (this._text) this._text.textContent = 'جاهز'; }
        }, 2500);
    },
    error() {
        this._init();
        if (!this._el) return;
        this._el.className = 'autosave-indicator';
        if (this._text) this._text.textContent = 'خطأ';
    },
};

function setupAutoSave() {
    let timer = null;
    const trigger = () => {
        if (!hasPermission('canEditProjects')) return;
        clearTimeout(timer);
        AutosaveUI.saving();
        timer = setTimeout(async () => {
            if (AppState.current.client.trim()) {
                Project.collectFormData();
                AppState.current.updatedAt = new Date().toISOString();
                AppState.current.progress = calculateProjectProgress(AppState.current);
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
    const selectors = ['#projectFormCard', '#itemsCard', '#specificationsCard', '#financialsCard'];
    selectors.forEach(selector => {
        document.querySelectorAll(`${selector} input, ${selector} select, ${selector} textarea`).forEach(el =>
            el.addEventListener('input', trigger)
        );
    });
}

async function handleAction(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'toggle-theme') { Theme.toggle(); return; }
    if (action === 'scroll-to-section') {
        const section = document.getElementById(target.dataset.target || '');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    if (action === 'toggle-header-menu') { MobileHeader.toggle(); return; }

    // Permission checks (simplified for brevity - in production, add more)
    const editActions = ['save-project', 'add-spec-note', 'edit-spec-note', 'confirm-edit-note', 'cancel-edit-note', 'delete-spec-note', 'add-item', 'edit-item-modal', 'delete-item', 'update-item', 'toggle-workflow', 'upload-designs', 'delete-design', 'clear-designs-upload'];
    const createActions = ['new-project', 'duplicate-project'];
    const deleteActions = ['delete-project'];
    const exportActions = ['export-project', 'print-full-report', 'print-specs-only', 'print-specs-with-designs', 'print-projects-table', 'print-lpo'];
    const importActions = ['import-project', 'import-project-file', 'do-import'];

    if (editActions.includes(action) && !hasPermission('canEditProjects')) { Toast.show('لا تملك صلاحية التعديل', 'error'); return; }
    if (createActions.includes(action) && !hasPermission('canCreateProjects')) { Toast.show('لا تملك صلاحية الإنشاء', 'error'); return; }
    if (deleteActions.includes(action) && !hasPermission('canDeleteProjects')) { Toast.show('لا تملك صلاحية الحذف', 'error'); return; }
    if (exportActions.includes(action) && !hasPermission('canExportProjects')) { Toast.show('لا تملك صلاحية التصدير', 'error'); return; }
    if (importActions.includes(action) && !hasPermission('canImportProjects')) { Toast.show('لا تملك صلاحية الاستيراد', 'error'); return; }
    if (action === 'delete-all' && !isCurrentOwner()) { Toast.show('هذا الإجراء متاح للمالك فقط', 'error'); return; }

    // Route to existing handlers (simplified mapping)
    if (action === 'new-project') Project.createNew();
    else if (action === 'save-project') Project.save();
    else if (action === 'export-project') Project.export();
    else if (action === 'copy-id') {
        const id = document.getElementById('projectId')?.value;
        if (id) navigator.clipboard.writeText(id).then(() => Toast.show(`تم نسخ: ${id}`));
    }
    else if (action === 'open-whatsapp') {
        const phone = document.getElementById('phoneInput')?.value.trim();
        if (!phone) Toast.show('يجب إدخال رقم التليفون أولاً', 'error');
        else window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
    }
    else if (action === 'open-maps') {
        const loc = document.getElementById('locationInput')?.value.trim();
        if (!loc) Toast.show('يجب إدخال الموقع أولاً', 'error');
        else window.open(loc.startsWith('http') ? loc : `https://maps.google.com/?q=${encodeURIComponent(loc)}`, '_blank');
    }
    else if (action === 'add-spec-note') SpecsNotes.add();
    else if (action === 'edit-spec-note') SpecsNotes.startEdit(parseInt(target.dataset.index, 10));
    else if (action === 'confirm-edit-note') SpecsNotes.confirmEdit(parseInt(target.dataset.index, 10));
    else if (action === 'cancel-edit-note') SpecsNotes.cancelEdit();
    else if (action === 'delete-spec-note') SpecsNotes.delete(parseInt(target.dataset.index, 10));
    else if (action === 'add-item') Items.add();
    else if (action === 'edit-item-modal') Items.openEditModal(target.dataset.stage, parseInt(target.dataset.index, 10));
    else if (action === 'delete-item') Items.delete(target.dataset.stage, parseInt(target.dataset.index, 10));
    else if (action === 'update-item') Items.update();
    else if (action === 'generate-lpo') LPO.generate();
    else if (action === 'generate-full-lpo') LPO.generateFull();
    else if (action === 'print-lpo') LPO.print();
    else if (action === 'print-full-report') printFullReport();
    else if (action === 'print-specs-only') printSpecsOnly();
    else if (action === 'print-specs-with-designs') printSpecsWithDesigns();
    else if (action === 'print-dashboard') printDashboard();
    else if (action === 'print-projects-table') printProjectsTable();
    else if (action === 'upload-designs') Designs.upload();
    else if (action === 'delete-design') Designs.delete(parseInt(target.dataset.designId, 10));
    else if (action === 'clear-designs-upload') Designs.clearUpload();
    else if (action === 'open-projects-modal') {
        const projects = await DB.loadProjects();
        await Renderer.renderProjectsList(projects);
        Modal.open('projectsModal');
        const searchEl = document.getElementById('projectsSearchInput');
        if (searchEl) { searchEl.value = ''; setTimeout(() => searchEl.focus(), 100); }
    }
    else if (action === 'open-project') {
        const pid = target.dataset.projectId;
        const ok = await Project.loadById(pid);
        if (ok) { Modal.closeAll(); document.getElementById('projectFormCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
    else if (action === 'duplicate-project') Project.duplicate(target.dataset.projectId || target.closest('[data-project-id]')?.dataset.projectId);
    else if (action === 'delete-project') Project.deleteById(target.dataset.projectId || target.closest('[data-project-id]')?.dataset.projectId);
    else if (action === 'delete-all') Project.deleteAll();
    else if (action === 'import-project') Modal.open('importModal');
    else if (action === 'import-project-file') document.getElementById('importFileInput')?.click();
    else if (action === 'do-import') {
        const textarea = document.getElementById('importDataInput');
        const success = Project.import(textarea?.value);
        if (success) {
            if (textarea) textarea.value = '';
            Modal.closeAll();
            Toast.show('تم استيراد المشروع بنجاح');
        } else Toast.show('خطأ في بيانات الاستيراد — تأكد من صحة JSON', 'error');
    }
    else if (action === 'logout') AuthSession.logout();
    else if (action === 'open-profile-panel') ProfilePanel.open();
    else if (action === 'save-profile') ProfilePanel.save();
    else if (action === 'open-admin-panel') AdminPanel.open();
    else if (action === 'refresh-admin-panel') AdminPanel.render();
    else if (action === 'save-user-access') AdminPanel.saveUser(target.dataset.uid);
    else if (action === 'open-activity-log') ActivityLogPanel.open();
    else if (action === 'refresh-activity-log') ActivityLogPanel.render();
    else if (action === 'close-modal') Modal.closeAll();
    else if (action === 'toggle-workflow') {
        const step = target.dataset.step;
        if (!step) return;
        AppState.current.workflow[step] = target.checked;
        AppState.current.progress = calculateProjectProgress(AppState.current);
        AppState.current.currentStage = detectProjectStage(AppState.current);
        stampProjectDates(AppState.current);
        AppState.current.updatedAt = new Date().toISOString();
        try {
            await DB.saveProject(AppState.current);
            Renderer.renderWorkflow(AppState.current);
            Toast.show('تم تحديث التقدم', 'success');
        } catch (err) { Toast.show('خطأ في الحفظ: ' + err.message, 'error'); }
    }
    else if (action === 'open-project-from-board') {
        const card = target.closest('[data-project-id]');
        if (!card) return;
        const projectBtn = document.querySelector('[data-view="project"]');
        if (projectBtn) projectBtn.click();
        await Project.loadById(card.dataset.projectId);
    }
    else if (action === 'sort-column') {
        const stage = target.dataset.stage;
        const sortBy = target.dataset.sort;
        const column = document.querySelector(`.board-column[data-stage="${stage}"]`);
        if (!column) return;
        const projects = await DB.loadProjects();
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
    }
}

async function init() {
    try {
        PageLoader.show('نرتب إعدادات التطبيق أولاً.');
        Theme.init();
        if (document.readyState !== 'complete') {
            await new Promise(resolve => {
                if (document.readyState === 'complete') resolve();
                else document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }
        PageLoader.show('نراجع الجلسة والصلاحيات.');
        await AuthSession.ensureAuthenticated();
        PageLoader.show('نسحب البيانات ونجهز المشاريع.');
        await DB.init();

        PageLoader.show('نرتب الواجهة لتظهر كاملة وجاهزة.');
        document.addEventListener('click', handleAction);
        setupLiveListeners();
        setupFieldValidation();
        MobileHeader.init();
        Renderer.renderLPOStages();
        Renderer.renderUnitsSelect();
        Renderer.renderAll(AppState.current);
        DisplayRenderer.renderAll(AppState.current);
        setupViewSwitcher();
        setupAutoSave();
        UserAccess.apply();
        window.updateProjectWorkspaceVisibility();
        await PageLoader.finish();

        if (!localStorage.getItem('welcomeShown')) {
            Toast.show('أهلاً بك، الشغل جاهز قدامك.', 'info');
            localStorage.setItem('welcomeShown', 'true');
        }
    } catch (err) {
        console.error('Initialisation error:', err);
        await PageLoader.finish();
        Toast.show('خطأ في تهيئة النظام: ' + err.message, 'error');
    }
}

// Apply theme immediately to avoid flash
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

// Sticky actions bar
(function setupStickyBar() {
    const setup = () => {
        const bar = document.querySelector('.project-actions-bar');
        if (!bar) return;
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
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
    else setup();
})();

// Boot EntryModal
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        EntryModal.init();
        const selM = document.getElementById('lpoStageSelectM');
        if (selM) selM.innerHTML = Object.entries(CONFIG.STAGES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
    }, 150);
}, { once: true });

// Patch Designs to support dual gallery
const _origDesignsRender = Designs.render.bind(Designs);
Designs.render = async function() {
    await _origDesignsRender();
    await this.renderIn('modalDesignsGallery');
};
Designs.renderIn('modalDesignsGallery');