// js/modules/lpo.js
import { AppState } from '../state.js';
import { CONFIG } from '../config.js';
import { Toast } from './toast.js';
import { escapeHtml, formatNumber } from '../utils.js';

export const LPO = {
    _buildTable(items, hasPaint) {
        const rows = items.map((item, idx) => {
            const line = (item.qty * item.price);
            const paint = item.needsPaint ? (item.qty * (item.paintCostPerUnit || 0)) : 0;
            const total = line + paint;
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
        if (items.length === 0) {
            Toast.show('لا توجد مواد في هذه المرحلة', 'error');
            return;
        }

        const hasPaint = items.some(i => i.needsPaint);
        const subtotal = items.reduce((s, i) => s + (i.qty * i.price) + (i.needsPaint ? i.qty * (i.paintCostPerUnit || 0) : 0), 0);
        const taxAmount = includeTax ? (subtotal * taxRate / 100) : 0;
        const total = subtotal + taxAmount;
        const baseCols = includeStageCol ? 6 : 5;
        const colCount = baseCols + (hasPaint ? 2 : 0);

        const stageHeader = includeStageCol ? '<th>المرحلة</th>' : '';
        const paintHeaders = hasPaint ? '<th>صبغ/وحدة</th><th>لون الصبغ</th>' : '';
        const taxRow = includeTax ? `<tr><td colspan="${colCount}" class="text-end">الضريبة (${taxRate}%):</td><td class="text-bold">${formatNumber(taxAmount)}</td></tr>` : '';

        const resultDiv = document.getElementById('lpoResult');
        if (!resultDiv) return;
        resultDiv.innerHTML = `
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
        const stageKey = document.getElementById('lpoStageSelect')?.value;
        const supplier = document.getElementById('lpoSupplierInput')?.value.trim();
        const includeTax = document.getElementById('lpoTaxInput')?.checked || false;
        const taxRate = parseFloat(document.getElementById('lpoTaxRateInput')?.value) || CONFIG.DEFAULT_TAX_RATE;

        if (!supplier) {
            Toast.show('يجب إدخال اسم المورد', 'error');
            return;
        }
        const items = AppState.current.items[stageKey] || [];
        this._renderResult('طلب شراء LPO', items, supplier, CONFIG.STAGES[stageKey], includeTax, taxRate, false);
    },

    generateFull() {
        const supplier = document.getElementById('lpoSupplierInput')?.value.trim() || '-';
        const includeTax = document.getElementById('lpoTaxInput')?.checked || false;
        const taxRate = parseFloat(document.getElementById('lpoTaxRateInput')?.value) || CONFIG.DEFAULT_TAX_RATE;

        const allItems = Object.entries(AppState.current.items).flatMap(([stage, items]) =>
            items.map(item => ({ ...item, stageLabel: CONFIG.STAGES[stage] }))
        );

        if (allItems.length === 0) {
            Toast.show('لا توجد مواد في أي مرحلة', 'error');
            return;
        }
        this._renderResult('طلب شراء LPO (كامل المواد)', allItems, supplier, null, includeTax, taxRate, true);
    },

    print() {
        const resultDiv = document.getElementById('lpoResult');
        if (!resultDiv || !resultDiv.innerHTML.trim()) {
            Toast.show('يجب إنشاء LPO أولاً', 'error');
            return;
        }
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