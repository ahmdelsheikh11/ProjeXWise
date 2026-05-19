import { AppState } from '../state.js';
import { CONFIG, WORKFLOW_STEP_KEYS, STAGE_LABELS } from '../config.js';
import { DB } from '../db.js';
import { SpecsNotes } from './specsNotes.js';
import { calcStageTotal, formatNumber, escapeHtml, formatDate } from '../utils.js';

export const Renderer = {
    _allProjects: [],

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
        set('projectId', project.id);
        set('clientInput', project.client);
        set('phoneInput', project.phone);
        set('emirateInput', project.emirate);
        set('addressInput', project.address);
        set('locationInput', project.location);
        set('salesInput', project.sales);
        set('dateInput', project.date);
        set('projectNameInput', project.name);
        set('deliveryDateInput', project.dates?.deliveryDate || '');
        set('discountInput', project.financials?.discount || 0);
        set('paidInput', project.financials?.paid || 0);
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
        if (!container) return;
        const sections = Object.keys(CONFIG.STAGES).map(stage => {
            const items = project.items[stage] || [];
            if (!items.length) return '';
            const stageTotal = calcStageTotal(items);
            const hasPaint = items.some(i => i.needsPaint);
            const paintHeaders = hasPaint ? '<th>صبغ/وحدة</th><th>لون الصبغ</th>' : '';
            const rows = items.map((item, idx) => {
                const line = item.qty * item.price;
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
                            <button class="btn btn--primary btn--icon btn--xs" data-action="edit-item-modal" data-stage="${stage}" data-index="${idx}" title="تعديل">
                                <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                            </button>
                            <button class="btn btn--danger btn--icon btn--xs" data-action="delete-item" data-stage="${stage}" data-index="${idx}" title="حذف">
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
        const materialsTotal = Object.values(project.items).reduce(
            (sum, stageItems) => sum + calcStageTotal(stageItems), 0
        );
        const finalTotal = project.financials.totalAmount - project.financials.discount;
        const remaining = finalTotal - project.financials.paid;

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setText('kpiMaterialsTotal', formatNumber(materialsTotal));
        setText('kpiFinalTotal', formatNumber(finalTotal));
        setText('kpiPaid', formatNumber(project.financials.paid));
        setText('kpiRemaining', formatNumber(remaining));

        const remainingCard = document.getElementById('kpiRemainingCard');
        if (remainingCard) {
            remainingCard.classList.remove('kpi-card--warning', 'zero');
            if (remaining === 0) remainingCard.classList.add('zero');
        }
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

    async renderProjectsList(projects) {
        const list = document.getElementById('projectsModalList');
        if (!list) return;
        this._allProjects = [...projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        this._renderProjectCards(this._allProjects);
    },

    _renderProjectCards(projects) {
        const list = document.getElementById('projectsModalList');
        if (!list) return;
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
                            ${p.phone ? `<span class="project-card__meta-item">📞 ${escapeHtml(p.phone)}</span>` : ''}
                            ${p.emirate ? `<span class="project-card__meta-item">📍 ${escapeHtml(p.emirate)}</span>` : ''}
                            <span class="project-card__meta-item"> 📅 ${formatDate(p.date)}</span>
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

        const phases = {};
        CONFIG.WORKFLOW_STEPS.forEach(step => {
            if (!phases[step.phase]) phases[step.phase] = { label: step.phaseLabel || step.phase, steps: [] };
            phases[step.phase].steps.push(step);
        });

        const phasesHtml = Object.values(phases).map(phase => {
            const stepsHtml = phase.steps.map(step => {
                const isDone = project.workflow[step.key];
                const checked = isDone ? 'checked' : '';
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