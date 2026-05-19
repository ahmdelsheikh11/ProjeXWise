// js/modules/project.js
import { AppState, createEmptyProject, hasProjectIdentity } from '../state.js';
import { DB, requirePermission } from '../db.js';
import { Toast } from './toast.js';
import { Confirm } from './confirm.js';
import { Renderer } from './renderer.js';
import { DisplayRenderer } from './displayRenderer.js';
import { Designs } from './designs.js';
import { EntryModal } from './entryModal.js';
import { CONFIG } from '../config.js';
import { deepClone, generateProjectId, normaliseProject, calculateProjectProgress, detectProjectStage, stampProjectDates } from '../utils.js';

function updateProjectWorkspaceVisibility() {
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
}

export const Project = {
    createNew() {
        if (!requirePermission('canCreateProjects')) return;
        AppState.current = createEmptyProject();
        AppState.hasActiveProject = false;
        Renderer.renderAll(AppState.current);
        DisplayRenderer.renderAll(AppState.current);
        updateProjectWorkspaceVisibility();
        Designs.render();
        EntryModal.open('project');
        Toast.show('أدخل اسم المشروع أولاً ثم احفظه');
    },

    async save() {
        if (!requirePermission('canEditProjects')) return;
        this.collectFormData();

        if (!hasProjectIdentity()) {
            document.getElementById('projectNameInput')?.focus();
            Toast.show('يجب إدخال اسم المشروع على الأقل', 'error');
            return;
        }

        AppState.current.updatedAt = new Date().toISOString();
        AppState.current.progress = calculateProjectProgress(AppState.current);
        AppState.current.currentStage = detectProjectStage(AppState.current);
        stampProjectDates(AppState.current);

        try {
            await DB.saveProject(AppState.current);
            AppState.hasActiveProject = true;
            Toast.show(`تم حفظ المشروع: ${AppState.current.id}`);
            Renderer.renderKPIs(AppState.current);
            Renderer.renderItemsLists(AppState.current);
            Renderer.renderWorkflow(AppState.current);
            DisplayRenderer.renderAll(AppState.current);
            updateProjectWorkspaceVisibility();
        } catch (err) {
            Toast.show('خطأ في الحفظ: ' + err.message, 'error');
        }
    },

    collectFormData() {
        const get = (id) => document.getElementById(id);
        AppState.current.client = get('clientInput')?.value.trim() || '';
        AppState.current.phone = get('phoneInput')?.value.trim() || '';
        AppState.current.emirate = get('emirateInput')?.value.trim() || '';
        AppState.current.address = get('addressInput')?.value.trim() || '';
        AppState.current.location = get('locationInput')?.value.trim() || '';
        AppState.current.sales = get('salesInput')?.value.trim() || '';
        AppState.current.date = get('dateInput')?.value || '';
        AppState.current.name = get('projectNameInput')?.value.trim() || '';
        AppState.current.dates.deliveryDate = get('deliveryDateInput')?.value || '';

        CONFIG.SPEC_FIELDS.forEach(field => {
            const input = get(field.key + 'Input');
            if (input) AppState.current.specifications[field.key] = input.value.trim();
        });

        AppState.current.financials = {
            discount: parseFloat(get('discountInput')?.value) || 0,
            paid: parseFloat(get('paidInput')?.value) || 0,
            totalAmount: parseFloat(get('totalAmountInput')?.value) || 0,
        };
    },

    async loadById(id) {
        try {
            const project = await DB.getProject(id);
            if (!project) {
                Toast.show('لم يتم العثور على المشروع', 'error');
                return false;
            }
            AppState.current = project;
            AppState.hasActiveProject = true;
            Renderer.renderAll(AppState.current);
            updateProjectWorkspaceVisibility();
            await Designs.render();
            Toast.show(`تم تحميل المشروع: ${project.id}`);
            return true;
        } catch (err) {
            Toast.show('خطأ في التحميل: ' + err.message, 'error');
            return false;
        }
    },

    async duplicate(id) {
        if (!requirePermission('canCreateProjects')) return;
        try {
            const original = await DB.getProject(id);
            if (!original) return;
            const copy = deepClone(original);
            copy.id = generateProjectId();
            copy.createdAt = new Date().toISOString();
            copy.updatedAt = new Date().toISOString();
            delete copy.createdBy;
            delete copy.updatedBy;
            copy.designs = [];
            await DB.saveProject(copy);
            const projects = await DB.loadProjects();
            await Renderer.renderProjectsList(projects);
            Toast.show(`تم نسخ المشروع: ${copy.id}`);
        } catch (err) {
            Toast.show('خطأ في النسخ: ' + err.message, 'error');
        }
    },

    async deleteById(id) {
        if (!id) {
            Toast.show('تعذر تحديد المشروع المطلوب حذفه', 'error');
            return;
        }
        if (!requirePermission('canDeleteProjects')) return;
        const confirmed = await Confirm.show('هل تريد حذف هذا المشروع؟', 'حذف المشروع');
        if (!confirmed) return;
        try {
            await DB.deleteAllDesignsForProject(id);
            await DB.deleteProject(id);
            const projects = await DB.loadProjects();
            await Renderer.renderProjectsList(projects);
            Toast.show('تم حذف المشروع');
            if (AppState.current.id === id) {
                AppState.current = createEmptyProject();
                AppState.hasActiveProject = false;
                Renderer.renderAll(AppState.current);
                DisplayRenderer.renderAll(AppState.current);
                updateProjectWorkspaceVisibility();
            }
        } catch (err) {
            Toast.show('خطأ في الحذف: ' + err.message, 'error');
        }
    },

    async deleteAll() {
        if (!requirePermission('canDeleteProjects')) return;
        if (!window.isCurrentOwner || !window.isCurrentOwner()) {
            Toast.show('حذف جميع المشاريع متاح للمالك فقط', 'error');
            return;
        }
        const confirmed = await Confirm.show('هل تريد حذف جميع المشاريع؟ لا يمكن التراجع عن هذا الإجراء.', 'حذف جميع المشاريع');
        if (!confirmed) return;
        try {
            await DB.deleteAllProjects();
            AppState.current = createEmptyProject();
            AppState.hasActiveProject = false;
            Renderer.renderAll(AppState.current);
            DisplayRenderer.renderAll(AppState.current);
            updateProjectWorkspaceVisibility();
            Toast.show('تم حذف جميع المشاريع');
        } catch (err) {
            Toast.show('خطأ في الحذف: ' + err.message, 'error');
        }
    },

    export() {
        if (!requirePermission('canExportProjects')) return;
        this.collectFormData();
        const blob = new Blob([JSON.stringify(AppState.current, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `project-${AppState.current.id}.json` });
        a.click();
        URL.revokeObjectURL(url);
        Toast.show('تم تصدير المشروع');
    },

    import(jsonString) {
        if (!requirePermission('canImportProjects')) return false;
        try {
            const project = JSON.parse(jsonString);
            if (!project.id || !(project.client || project.name)) return false;
            AppState.current = normaliseProject(project);
            AppState.hasActiveProject = true;
            Renderer.renderAll(AppState.current);
            DisplayRenderer.renderAll(AppState.current);
            updateProjectWorkspaceVisibility();
            Designs.render();
            return true;
        } catch {
            return false;
        }
    },

    async importFromFile(file) {
        if (!requirePermission('canImportProjects')) return false;
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(this.import(e.target.result));
            reader.onerror = () => resolve(false);
            reader.readAsText(file);
        });
    },
};