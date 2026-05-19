// js/state.js
import { CONFIG, WORKFLOW_STEP_KEYS } from './config.js';
import { generateProjectId, todayString } from './utils.js';
import { hasProjectIdentity } from './state.js';
window.hasProjectIdentity = hasProjectIdentity;

export function createEmptyProject() {
    const items    = {};
    const workflow = {};
    Object.keys(CONFIG.STAGES).forEach(k => { items[k] = []; });
    WORKFLOW_STEP_KEYS.forEach(k => { workflow[k] = false; });

    return {
        id:        generateProjectId(),
        name:      '',
        client:    '',
        phone:     '',
        emirate:   '',
        address:   '',
        location:  '',
        sales:     '',
        date:      todayString(),
        deliveryDate: '',
        specifications: {
            boxType: 'ألومينيوم', boxColor: '9010 حليبي',
            doorType: '', doorColor: '',
            drawerType: '', drawerCount: '',
            lightsNeeded: '', lightsDescription: '',
            handleType: '', handleColor: '',
            counterType: '', counterColor: '',
            skirtingNeeded: '', upperFillerNeeded: '',
            islandNeeded: '', islandDescription: '',
            notes: [],
        },
        designs:   [],
        items,
        financials: { discount: 0, paid: 0, totalAmount: 0 },
        workflow,
        progress:  0,
        currentStage: 'pre_sales',
        dates: {
            contractDate:   todayString(),
            measureDate:    null,
            productionStart:null,
            installDate:    null,
            deliveryDate:   null,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export const AppState = {
    current: createEmptyProject(),
    db:      null,
    firebase: null,
    authUser: null,
    currentUserProfile: null,
    usersCache: [],
    hasActiveProject: false,
    // cache للمشاريع مع دعم التحميل التدريجي
    projectsCache: {
        all: null,          // جميع المشاريع (بعد التحميل الكامل)
        chunks: [],         // مصفوفة من الدفعات (كل دفعة 20 مشروع)
        totalCount: 0,      // العدد الإجمالي للمشاريع (قد لا يكون معروفاً مسبقاً)
        isLoading: false,
        listeners: [],      // دوال استدعاء عند إضافة دفعة جديدة
        timestamp: null,
    },
};

export function hasProjectIdentity(project = AppState.current) {
    return !!String(project?.name || '').trim();
}
