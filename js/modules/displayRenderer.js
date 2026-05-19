import { AppState } from '../state.js';
import { CONFIG, WORKFLOW_STEP_KEYS, STAGE_LABELS } from '../config.js';
import { hasPermission } from '../db.js';
import { escapeHtml, formatDate, formatDateTime, formatNumber, getNextWorkflowStep, getRemainingDays } from '../utils.js';

export const DisplayRenderer = {
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
        const titleEl = document.getElementById('overviewProjectTitle');
        const subtitleEl = document.getElementById('overviewProjectSubtitle');
        const metaEl = document.getElementById('overviewMeta');
        const statsEl = document.getElementById('overviewStats');
        const spotlightEl = document.getElementById('overviewSpotlight');
        if (!titleEl || !subtitleEl || !metaEl || !statsEl || !spotlightEl) return;

        const canViewFinancials = hasPermission('canViewFinancials');
        const progress = project.progress || 0;
        const nextStep = getNextWorkflowStep(project);
        const remainingDays = getRemainingDays(project);
        const stageLabel = STAGE_LABELS[project.currentStage] || project.currentStage || 'مرحلة التأسيس';
        const materialsCount = Object.values(project.items || {}).reduce((sum, items) => sum + (items?.length || 0), 0);
        const notesCount = project.specifications?.notes?.length || 0;
        const clientLabel = project.client || 'عميل جديد';
        const projectLabel = project.name || clientLabel;
        const dueLabel = remainingDays === null
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
            `<span class="overview-meta-pill">أنشئ <strong>${escapeHtml(formatDateTime(project.createdAt))}</strong></span>`,
            `<span class="overview-meta-pill">آخر تعديل <strong>${escapeHtml(formatDateTime(project.updatedAt))}</strong></span>`,
        ].join('');

        const spotlightCards = [`
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
            </div>`];

        if (canViewFinancials) {
            spotlightCards.push(`
            <div class="overview-spotlight-card">
                <span class="overview-spotlight-card__label">Commercial View</span>
                <div class="overview-spotlight-card__value">${formatNumber(project.financials?.totalAmount || 0)} درهم</div>
                <p class="overview-spotlight-card__subtext">المتبقي للتحصيل ${formatNumber((project.financials?.totalAmount || 0) - (project.financials?.discount || 0) - (project.financials?.paid || 0))} درهم</p>
            </div>`);
        }
        spotlightEl.innerHTML = spotlightCards.join('');

        const cards = [
            { label: 'المواد المسجلة', value: materialsCount, hint: 'عناصر مرتبطة بكل مراحل العمل' },
            { label: 'ملاحظات المواصفات', value: notesCount, hint: 'نقاط تحتاج مراجعة ومتابعة' },
            { label: 'الخطوات المكتملة', value: `${Object.values(project.workflow || {}).filter(Boolean).length}/${WORKFLOW_STEP_KEYS.length}`, hint: 'ضمن رحلة التنفيذ الكاملة' },
        ];
        if (canViewFinancials) {
            cards.splice(1, 0, { label: 'المبلغ المدفوع', value: `${formatNumber(project.financials?.paid || 0)} درهم`, hint: 'إجمالي ما تم تحصيله حتى الآن' });
        }

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
            { label: 'اسم العميل', value: project.client, important: true },
            { label: 'البائع', value: project.sales },
            { label: 'رقم الهاتف', value: project.phone },
            { label: 'الإمارة', value: project.emirate },
            { label: 'العنوان', value: project.address },
            { label: 'اسم المشروع', value: project.name },
            { label: 'تاريخ الاتفاق', value: project.date ? formatDate(project.date) : null },
            { label: 'تاريخ التسليم', value: project.dates?.deliveryDate ? formatDate(project.dates.deliveryDate) : null },
            { label: 'رابط الموقع', value: project.location, isLink: true },
            { label: 'أنشئ في', value: formatDateTime(project.createdAt) },
            { label: 'أنشأه', value: project.createdBy?.displayName || project.createdBy?.email || null },
            { label: 'آخر تعديل', value: formatDateTime(project.updatedAt) },
            { label: 'عدّله', value: project.updatedBy?.displayName || project.updatedBy?.email || null },
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
            { label: 'البوكسات', values: [s.boxType, s.boxColor] },
            { label: 'الضلفات', values: [s.doorType, s.doorColor] },
            { label: 'الأدراج', values: [s.drawerType, s.drawerCount ? `${s.drawerCount} درج` : null] },
            { label: 'المسكات', values: [s.handleType, s.handleColor] },
            { label: 'الرخام / البورسلين', values: [s.counterType, s.counterColor] },
            { label: 'النعلة السفلية', values: [s.skirtingNeeded] },
            { label: 'الفيلر العلوي', values: [s.upperFillerNeeded] },
            { label: 'الإضاءة', values: [s.lightsNeeded, s.lightsDescription] },
            { label: 'الجزيرة', values: [s.islandNeeded, s.islandDescription] },
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

        const notesDisplay = document.getElementById('specsNotesDisplay');
        if (notesDisplay) {
            const notes = s.notes || [];
            if (notes.length) {
                notesDisplay.innerHTML = `<div class="notes-list">${notes.map(n => `<div class="note-item"><span class="note-item__bullet">📌</span><span class="note-item__text">${escapeHtml(n)}</span></div>`).join('')}</div>`;
            } else {
                notesDisplay.innerHTML = '';
            }
        }
    },

    renderFinancials(project) {
        const row = document.getElementById('financialsDisplayRow');
        if (!row) return;
        if (!hasPermission('canViewFinancials')) {
            row.innerHTML = '';
            return;
        }
        const f = project.financials || {};
        const items = [
            { label: 'المبلغ المتفق عليه', value: formatNumber(f.totalAmount || 0) + ' درهم' },
            { label: 'الخصم', value: formatNumber(f.discount || 0) + ' درهم' },
            { label: 'المدفوع', value: formatNumber(f.paid || 0) + ' درهم' },
        ];
        row.innerHTML = items.map(i => `
            <div class="fin-display-item">
                <span class="fin-display-item__label">${escapeHtml(i.label)}</span>
                <span class="fin-display-item__value">${escapeHtml(i.value)}</span>
            </div>`).join('');
    },
};