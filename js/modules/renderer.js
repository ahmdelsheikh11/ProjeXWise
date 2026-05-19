// js/modules/renderer.js
import { AppState } from '../state.js';
import { CONFIG, WORKFLOW_STEP_KEYS, STAGE_LABELS } from '../config.js';
import { DB } from '../db.js';
import { SpecsNotes } from './specsNotes.js';
import { calcStageTotal, formatNumber, escapeHtml, formatDate } from '../utils.js';

export const Renderer = {
    _allProjects: [],
    _virtualScroller: null,      // كائن الـ virtual scroller
    _currentSearchTerm: '',       // لتخزين مصطلح البحث الحالي

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

    // -------------------- Projects Modal with Virtual Scrolling --------------------
    async renderProjectsList(projects) {
        const list = document.getElementById('projectsModalList');
        if (!list) return;
        this._allProjects = projects || [];
        // بدء الـ virtual scroller
        if (this._virtualScroller) {
            this._virtualScroller.destroy();
        }
        this._virtualScroller = new VirtualScroller(list, {
            itemHeight: 85,           // ارتفاع كل بطاقة (px)
            bufferSize: 5,            // عدد العناصر الإضافية أعلى وأسفل
            renderItem: (project, index) => this._renderProjectCard(project, index),
            loadMore: () => this._loadMoreProjects(),
            hasMore: () => AppState.projectsCache.hasMore !== false,
            totalCount: () => this._allProjects.length,
        });
        await this._virtualScroller.init();
    },

    _renderProjectCard(project, index) {
        const isDone = !!project.workflow?.handover_signed;
        const stageLabel = STAGE_LABELS[project.currentStage] || project.currentStage || '-';
        const div = document.createElement('div');
        div.className = 'project-card';
        div.setAttribute('data-action', 'open-project');
        div.setAttribute('data-project-id', project.id);
        div.innerHTML = `
            <div class="project-card__info">
                <div class="project-card__id">${escapeHtml(project.id)}</div>
                <div class="project-card__client">${escapeHtml(project.client || '-')}${project.name ? ` <span style="color:var(--clr-ink-ghost);font-weight:400;">- ${escapeHtml(project.name)}</span>` : ''}</div>
                <div class="project-card__meta">
                    ${project.phone ? `<span class="project-card__meta-item">📞 ${escapeHtml(project.phone)}</span>` : ''}
                    ${project.emirate ? `<span class="project-card__meta-item">📍 ${escapeHtml(project.emirate)}</span>` : ''}
                    <span class="project-card__meta-item"> 📅 ${formatDate(project.date)}</span>
                    <span class="project-status-badge project-status-badge--${isDone ? 'done' : 'active'}">${isDone ? 'مسلّم' : stageLabel}</span>
                </div>
            </div>
            <div class="project-card__progress">
                <div class="project-card__progress-bar">
                    <div class="project-card__progress-fill" style="width:${project.progress || 0}%"></div>
                </div>
                <span class="project-card__pct">${project.progress || 0}%</span>
            </div>
            <div class="project-card__actions" onclick="event.stopPropagation()">
                <button class="btn btn--ghost btn--icon btn--sm" data-action="duplicate-project" data-project-id="${project.id}" title="نسخ المشروع">
                    <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                </button>
                <button class="btn btn--danger btn--icon btn--sm" data-action="delete-project" data-project-id="${project.id}" title="حذف المشروع">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
        `;
        return div;
    },

    async _loadMoreProjects() {
        // تحميل الدفعة التالية من Firestore إذا لم تكن محملة بالكامل بعد
        const cache = AppState.projectsCache;
        if (cache.isLoading) return false;
        if (cache.all && cache.all.length === this._allProjects.length && !cache.hasMore) return false;

        cache.isLoading = true;
        try {
            const lastDoc = cache.lastDoc;
            const { projects, lastDoc: newLastDoc, hasMore } = await DB.loadProjectsChunk(20, lastDoc);
            cache.lastDoc = newLastDoc;
            cache.hasMore = hasMore;
            if (!cache.all) cache.all = [];
            cache.all.push(...projects);
            cache.chunks.push(projects);
            this._allProjects = cache.all;
            if (this._virtualScroller) {
                this._virtualScroller.appendItems(projects);
            }
            return true;
        } catch (err) {
            console.error('Load more projects failed:', err);
            return false;
        } finally {
            cache.isLoading = false;
        }
    },

    // عند البحث، نقوم بتصفية _allProjects ونعيد تهيئة الـ virtual scroller
    filterProjects(searchTerm) {
        this._currentSearchTerm = searchTerm.toLowerCase();
        let filtered = this._allProjects;
        if (this._currentSearchTerm) {
            filtered = this._allProjects.filter(p =>
                (p.client || '').toLowerCase().includes(this._currentSearchTerm) ||
                (p.id || '').toLowerCase().includes(this._currentSearchTerm) ||
                (p.name || '').toLowerCase().includes(this._currentSearchTerm) ||
                (p.phone || '').toLowerCase().includes(this._currentSearchTerm) ||
                (p.emirate || '').toLowerCase().includes(this._currentSearchTerm)
            );
        }
        if (this._virtualScroller) {
            this._virtualScroller.setItems(filtered);
        }
    },

    // -------------------- Workflow --------------------
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

// -------------------- Virtual Scroller Class --------------------
class VirtualScroller {
    constructor(container, options) {
        this.container = container;
        this.itemHeight = options.itemHeight;
        this.bufferSize = options.bufferSize || 5;
        this.renderItem = options.renderItem;
        this.loadMore = options.loadMore;
        this.hasMore = options.hasMore;
        this.totalCount = options.totalCount || (() => this.items.length);
        this.items = [];
        this.renderedItems = new Map(); // index -> DOM element
        this.startIndex = 0;
        this.endIndex = 0;
        this.scrollHandler = this.onScroll.bind(this);
        this.resizeObserver = null;
        this.loadingMore = false;
        this.initPromise = null;
    }

    async init() {
        this.container.style.position = 'relative';
        this.container.style.overflowY = 'auto';
        this.container.style.height = '400px'; // يمكن تعديلها حسب التصميم
        // إنشاء عنصر الحشو (spacer)
        this.spacer = document.createElement('div');
        this.spacer.style.position = 'relative';
        this.spacer.style.height = '0px';
        this.container.innerHTML = '';
        this.container.appendChild(this.spacer);
        this.content = document.createElement('div');
        this.content.style.position = 'relative';
        this.spacer.appendChild(this.content);

        this.container.addEventListener('scroll', this.scrollHandler);
        // مراقبة تغيير حجم الحاوية
        this.resizeObserver = new ResizeObserver(() => this.updateVisibleRange());
        this.resizeObserver.observe(this.container);

        // تحميل أول دفعة إذا لزم الأمر
        if (this.items.length === 0 && this.loadMore && this.hasMore()) {
            await this.loadMore();
        }
        this.updateVisibleRange();
        return this;
    }

    setItems(newItems) {
        this.items = newItems;
        this.updateSpacerHeight();
        this.updateVisibleRange();
    }

    appendItems(newItems) {
        this.items.push(...newItems);
        this.updateSpacerHeight();
        this.updateVisibleRange();
    }

    updateSpacerHeight() {
        const totalHeight = this.items.length * this.itemHeight;
        this.spacer.style.height = `${totalHeight}px`;
    }

    updateVisibleRange() {
        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;
        const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
        const end = Math.min(this.items.length, Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.bufferSize);
        if (start === this.startIndex && end === this.endIndex) return;
        // إزالة العناصر خارج النطاق
        for (let [idx, el] of this.renderedItems.entries()) {
            if (idx < start || idx >= end) {
                el.remove();
                this.renderedItems.delete(idx);
            }
        }
        // إضافة العناصر الجديدة
        for (let i = start; i < end; i++) {
            if (!this.renderedItems.has(i)) {
                const itemEl = this.renderItem(this.items[i], i);
                itemEl.style.position = 'absolute';
                itemEl.style.top = `${i * this.itemHeight}px`;
                itemEl.style.left = '0';
                itemEl.style.right = '0';
                itemEl.style.height = `${this.itemHeight}px`;
                this.content.appendChild(itemEl);
                this.renderedItems.set(i, itemEl);
            }
        }
        this.startIndex = start;
        this.endIndex = end;

        // تحميل المزيد إذا كنا قريبين من النهاية
        if (this.endIndex >= this.items.length - 5 && this.hasMore && this.hasMore() && !this.loadingMore) {
            this.loadingMore = true;
            this.loadMore().finally(() => { this.loadingMore = false; });
        }
    }

    onScroll() {
        requestAnimationFrame(() => this.updateVisibleRange());
    }

    destroy() {
        this.container.removeEventListener('scroll', this.scrollHandler);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        this.container.innerHTML = '';
    }
}