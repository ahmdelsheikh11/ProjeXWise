import { CONFIG, WORKFLOW_STEP_KEYS } from './config.js';
import { generateProjectId, todayString } from './utils.js';

/** Creates a fresh empty project object */
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

/** Mutable application state (single object) */
export const AppState = {
    current: createEmptyProject(),
    db:      null,
    firebase: null,
    authUser: null,
    currentUserProfile: null,
    usersCache: [],
    hasActiveProject: false,
};

export function hasProjectIdentity(project = AppState.current) {
    return !!String(project?.name || '').trim();
}