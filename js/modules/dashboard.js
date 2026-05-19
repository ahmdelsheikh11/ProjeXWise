// js/modules/dashboard.js
import { DB } from '../db.js';
import { STAGE_LABELS } from '../config.js';
import { escapeHtml, formatDate, formatNumber, todayString } from '../utils.js';

export const Dashboard = {
    async render() {
        const projects = await DB.loadProjectsWithCache();
        const dashboardEl = document.getElementById('dashboardContent');
        if (!dashboardEl) return;

        if (projects.length === 0) {
            dashboardEl.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg><p>لا توجد مشاريع محفوظة بعد.<br>قم بحفظ مشروع أولاً.</p></div>`;
            return;
        }

        const contractDate = (p) => p.dates?.contractDate || p.date || todayString();
        const total = projects.length;
        const active = projects.filter(p => !p.workflow.handover_signed).length;
        const delivered = projects.filter(p => p.workflow.handover_signed).length;
        const delayed = projects.filter(p => {
            const days = Math.floor((Date.now() - new Date(contractDate(p))) / 86400000);
            return days > 14 && p.progress < 70 && !p.workflow.handover_signed;
        }).length;
        const inProduction = projects.filter(p => ['frame_purchase','frame_fabrication','frame_delivery','frame_installation','panel_purchase','panel_fabrication','panel_installation','quality_control','finishing_purchase'].includes(p.currentStage)).length;
        const waitInstall = projects.filter(p => p.currentStage === 'finishing_installation').length;
        const averageProgress = Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / total);
        const closestDelivery = [...projects]
            .filter(p => p.dates?.deliveryDate && !p.workflow?.handover_signed)
            .sort((a, b) => new Date(a.dates.deliveryDate) - new Date(b.dates.deliveryDate))[0] || null;
        const topProject = [...projects].sort((a, b) => (b.progress || 0) - (a.progress || 0))[0] || null;

        const kpiCards = [
            { label: 'إجمالي المشاريع', value: total, cls: '' },
            { label: 'المشاريع النشطة', value: active, cls: 'kpi-card--accent' },
            { label: 'المشاريع المسلمة', value: delivered, cls: 'kpi-card--success' },
            { label: 'المتأخرة', value: delayed, cls: 'kpi-card--remaining' },
            { label: 'في الإنتاج', value: inProduction, cls: '' },
            { label: 'بانتظار التركيب', value: waitInstall, cls: '' },
        ].map(k => `<div class="kpi-card ${k.cls}"><span class="kpi-card__label">${k.label}</span><span class="kpi-card__value">${k.value}</span></div>`).join('');

        const tableRows = projects.map(p => {
            const days = Math.floor((Date.now() - new Date(contractDate(p))) / 86400000);
            const isDelayed = days > 14 && p.progress < 70 && !p.workflow.handover_signed;
            let rem = '-';
            let remClass = '';
            if (p.dates?.deliveryDate) {
                const r = Math.floor((new Date(p.dates.deliveryDate) - Date.now()) / 86400000);
                if (r < 0) { rem = 'متجاوز الموعد'; remClass = 'text-danger'; }
                else if (r < 7) { rem = `${r} يوم`; remClass = 'text-warning'; }
                else rem = `${r} يوم`;
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

        requestAnimationFrame(() => this._drawChart(stageCounts));
    },

    _drawChart(stageCounts) {
        const canvas = document.getElementById('stageChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const stages = Object.keys(stageCounts);
        const counts = Object.values(stageCounts);
        if (!stages.length) return;

        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth || 500;
        const H = 160;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.scale(dpr, dpr);

        const max = Math.max(...counts, 1);
        const pad = 36;
        const barW = Math.max(14, Math.min(38, Math.floor((W - pad * 2) / stages.length) - 8));
        const totalBarWidth = stages.length * barW;
        const totalGap = W - pad * 2 - totalBarWidth;
        const gap = totalGap / Math.max(stages.length, 1);

        ctx.clearRect(0, 0, W, H);
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
            const h = Math.max(4, (counts[i] / max) * (H - 48));
            const x = pad + i * (barW + gap) + gap / 2;
            const y = H - 28 - h;
            const grad = ctx.createLinearGradient(x, y, x, y + h);
            grad.addColorStop(0, '#5aa0f5');
            grad.addColorStop(1, '#7c3aed');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, h, [4, 4, 0, 0]);
            ctx.fill();

            ctx.fillStyle = '#93c5fd';
            ctx.font = `bold ${Math.max(9, Math.min(12, barW - 2))}px var(--font-mono, monospace)`;
            ctx.textAlign = 'center';
            ctx.fillText(String(counts[i]), x + barW / 2, y - 5);

            ctx.fillStyle = '#4d6480';
            ctx.font = `${Math.max(8, Math.min(10, barW - 2))}px sans-serif`;
            const label = (STAGE_LABELS[stage] || stage).substring(0, 4);
            ctx.fillText(label, x + barW / 2, H - 10);
        });
    },
};