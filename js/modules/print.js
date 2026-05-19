import { Project } from './project.js';
import { ReportGenerator } from './reportGenerator.js';
import { Toast } from './toast.js';
import { DB } from '../db.js';

function openPrintWindow(html) {
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 500);
}

export async function printFullReport() {
    Project.collectFormData();
    try {
        const html = await ReportGenerator.generateFullReport(Project.getCurrentProject(), false);
        openPrintWindow(html);
        Toast.show('جارٍ تحضير التقرير...', 'info');
    } catch (err) {
        console.error(err);
        Toast.show('خطأ في إنشاء التقرير', 'error');
    }
}

export async function printSpecsOnly() {
    Project.collectFormData();
    try {
        const html = await ReportGenerator.generateSpecsOnlyReport(Project.getCurrentProject(), false);
        openPrintWindow(html);
        Toast.show('جارٍ تحضير المواصفات...', 'info');
    } catch (err) {
        console.error(err);
        Toast.show('خطأ في إنشاء التقرير', 'error');
    }
}

export async function printSpecsWithDesigns() {
    Project.collectFormData();
    try {
        const html = await ReportGenerator.generateSpecsOnlyReport(Project.getCurrentProject(), true);
        openPrintWindow(html);
        Toast.show('جارٍ تحضير المواصفات مع التصاميم...', 'info');
    } catch (err) {
        console.error(err);
        Toast.show('خطأ في إنشاء التقرير', 'error');
    }
}

export async function printDashboard() {
    const printDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const dashboardHtml = document.getElementById('dashboardContent')?.innerHTML || '';
    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير لوحة القيادة</title>
        <style>
            body { font-family:'IBM Plex Sans Arabic',sans-serif; padding:20px; }
            .dashboard-kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px; }
            .kpi-card { border:1px solid #ccc; padding:12px; border-radius:6px; text-align:center; }
            .kpi-card__label { font-size:11px; font-weight:600; color:#6e7d94; text-transform:uppercase; margin-bottom:5px; display:block; }
            .kpi-card__value { font-size:20px; font-weight:700; }
            .dashboard-table { width:100%; border-collapse:collapse; margin-top:10px; }
            .dashboard-table th, .dashboard-table td { border:1px solid #ccc; padding:7px; text-align:center; font-size:12px; }
            .dashboard-table th { background:#1a2535; color:#fff; }
            .print-date { text-align:left; margin-bottom:20px; font-size:13px; color:#666; }
        </style></head>
        <body>
            <div class="print-date">تاريخ التقرير: ${printDate}</div>
            ${dashboardHtml}
        </body></html>
    `);
    win.document.close();
    win.print();
}

export async function printProjectsTable() {
    const projects = await DB.loadProjects();
    if (!projects.length) {
        Toast.show('لا توجد مشاريع للطباعة', 'error');
        return;
    }
    const html = await ReportGenerator.generateProjectsReport(projects);
    openPrintWindow(html);
}