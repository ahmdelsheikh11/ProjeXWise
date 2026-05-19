// js/modules/reportGenerator.js
import { DB } from '../db.js';
import { CONFIG } from '../config.js';
import { escapeHtml, formatDate, formatNumber, calcMaterialsTotal, calcStageTotal } from '../utils.js';

export const ReportGenerator = {
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
        const notes = (project.specifications.notes || []).map(n => `<li style="margin-bottom:4px;color:#2d3748;">${escapeHtml(n)}</li>`).join('');
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
        const autoTax = materialsTotal * CONFIG.AUTO_TAX_RATE / 100;
        const totalWithTax = materialsTotal + autoTax;
        const agreed = project.financials.totalAmount;
        const paid = project.financials.paid;
        const remaining = agreed - project.financials.discount - paid;
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
        const designs = includeDesigns ? await DB.getDesignsForProject(project.id) : [];
        const designSection = (designs.length > 0) ? `
            <h2 class="section-title">التصاميم والاعتمادات</h2>
            <div class="designs-gallery">${designs.map(d => `<div class="design-item"><img src="${d.data}" alt="تصميم"></div>`).join('')}</div>` : '';
        return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير - ${escapeHtml(project.id)}</title><style>${this._baseStyles()}</style></head>
        <body>
            <div class="report-header">
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
        const designs = includeDesigns ? await DB.getDesignsForProject(project.id) : [];
        const designSection = (designs.length > 0) ? `
            <div style="margin-top:20px;">
                <h2 class="section-title">التصاميم والاعتمادات</h2>
                <div class="designs-gallery">${designs.map(d => `<div class="design-item"><img src="${d.data}" alt="تصميم"></div>`).join('')}</div>
            </div>` : '';
        return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>مواصفات - ${escapeHtml(project.id)}</title><style>${this._baseStyles()}</style></head>
        <body>
            <div class="report-header">
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
        const sorted = [...projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        const rows = sorted.map((p, idx) => {
            const materialsTotal = calcMaterialsTotal(p);
            const agreed = p.financials.totalAmount || 0;
            const paid = p.financials.paid || 0;
            const remaining = agreed - (p.financials.discount || 0) - paid;
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