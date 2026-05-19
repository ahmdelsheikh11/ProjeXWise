// js/modules/productionBoard.js
import { DB } from '../db.js';
import { STAGE_LABELS, STAGE_ORDER } from '../config.js';
import { escapeHtml, todayString } from '../utils.js';

export const ProductionBoard = {
    async render() {
        const boardEl = document.getElementById('productionBoard');
        if (!boardEl) return;

        // استخدام cache مع تحديث في الخلفية
        const projects = await DB.loadProjectsWithCache();

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
                const daysSince = Math.floor((Date.now() - new Date(contractDate)) / 86400000);
                let daysRemaining = '-';
                let deadlineClass = '';
                if (p.dates?.deliveryDate) {
                    const rem = Math.floor((new Date(p.dates.deliveryDate) - Date.now()) / 86400000);
                    daysRemaining = rem >= 0 ? `${rem} يوم` : 'تجاوز الموعد';
                    deadlineClass = rem < 0 ? 'overdue' : rem < 7 ? 'urgent' : '';
                }
                return `
                    <div class="board-card" data-project-id="${p.id}" data-action="open-project-from-board">
                        <strong>${escapeHtml(p.client || '-')}</strong>
                        ${p.name ? `<div style="font-size:var(--text-xs);color:var(--clr-ink-tertiary);margin-bottom:2px;">${escapeHtml(p.name)}</div>` : ''}
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