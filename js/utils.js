import { CONFIG } from './config.js';

/** Returns today as YYYY-MM-DD */
export function todayString() {
    return new Date().toISOString().split('T')[0];
}

/** Generates a unique project ID */
export function generateProjectId() {
    const d    = new Date();
    const yy   = d.getFullYear().toString().slice(-2);
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 50)).padStart(2, '0');
    return `AMK-JO-${yy}${mm}${dd}-${rand}`;
}

/** Formats a number to 2 decimal places with locale separators */
export function formatNumber(n) {
    return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formats a date string to a human-readable form */
export function formatDate(dateStr) {
    if (!dateStr) return 'غير محدد';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
}

export function formatDateTime(dateStr) {
    if (!dateStr) return 'غير محدد';
    return new Date(dateStr).toLocaleString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Safely escapes HTML to prevent XSS */
export function escapeHtml(str) {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode(String(str || '')));
    return el.innerHTML;
}

/** Deep-clones a JSON-serialisable value */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/** Returns the default paint colour (door colour) */
export function getDefaultPaintColor(project) {
    return project?.specifications?.doorColor || '';
}

/** Calculates the total cost of one stage's items (materials + paint) */
export function calcStageTotal(items) {
    return items.reduce((sum, item) => {
        const itemCost  = (item.qty || 0) * (item.price || 0);
        const paintCost = item.needsPaint ? ((item.qty || 0) * (item.paintCostPerUnit || 0)) : 0;
        return sum + itemCost + paintCost;
    }, 0);
}

/** Calculates the grand total across all stages */
export function calcMaterialsTotal(project) {
    return Object.values(project.items).reduce(
        (sum, stageItems) => sum + calcStageTotal(stageItems), 0
    );
}

/** Returns progress (0–100) based on completed workflow steps */
export function calculateProjectProgress(project) {
    const completed = CONFIG.WORKFLOW_STEPS.filter(step => project.workflow[step.key] === true).length;
    return Math.round((completed / CONFIG.WORKFLOW_STEPS.length) * 100);
}

/** Auto-detects the current workflow stage label */
export function detectProjectStage(project) {
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
export function stampProjectDates(project) {
    const w     = project.workflow;
    const today = todayString();
    if (w.initial_measure   && !project.dates.measureDate)     project.dates.measureDate     = today;
    if (w.frame_fabrication && !project.dates.productionStart) project.dates.productionStart = today;
    if (w.final_installation && !project.dates.installDate)    project.dates.installDate     = today;
    if (w.handover_signed   && !project.dates.deliveryDate)    project.dates.deliveryDate    = today;
}

/** Returns the next pending workflow step object, or null if everything is done */
export function getNextWorkflowStep(project) {
    return CONFIG.WORKFLOW_STEPS.find(step => !project.workflow?.[step.key]) || null;
}

/** Returns remaining days until delivery or null when unavailable */
export function getRemainingDays(project) {
    if (!project?.dates?.deliveryDate) return null;
    return Math.floor((new Date(project.dates.deliveryDate) - Date.now()) / 86400000);
}

/** Migrates old workflow structure to the current one */
export function migrateWorkflow(project) {
    if (!project.workflow) project.workflow = {};
    const old = project.workflow;
    const fresh = {};
    CONFIG.WORKFLOW_STEPS.forEach(step => { fresh[step.key] = false; });

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

    CONFIG.WORKFLOW_STEPS.forEach(step => {
        if (old[step.key] !== undefined) fresh[step.key] = old[step.key];
    });

    project.workflow = fresh;
    return project;
}

/** Ensures required fields exist when loading an older project */
export function normaliseProject(project) {
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