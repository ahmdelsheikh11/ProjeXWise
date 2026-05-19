// ===============================================================
// CONFIGURATION (single source of truth)
// ===============================================================
export const CONFIG = Object.freeze({
    DB_NAME:    'KitchenProjectsDB',
    DB_VERSION: 3,

    STORES: Object.freeze({
        PROJECTS:  'projects',
        MATERIALS: 'materials',
        LOGO:      'logo',
        DESIGNS:   'designs',
    }),

    STAGES: Object.freeze({
        boxes:      'مرحلة البوكسات',
        doors:      'مرحلة الضلفات',
        counter:    'مرحلة الرخام',
        accessories:'الإكسسوارات',
        appliances: 'الأجهزة الكهربائية',
        support:    'مواد مساعدة',
    }),

    UNITS: ['بار', 'قطعة', 'شيت', 'متر', 'رول', 'طقم', 'كيس', 'علبة'],

    SPEC_FIELDS: [
        { key: 'boxType',           label: 'نوع البوكسات' },
        { key: 'boxColor',          label: 'لون البوكسات' },
        { key: 'doorType',          label: 'نوع الضلفات' },
        { key: 'doorColor',         label: 'لون الضلفات' },
        { key: 'drawerType',        label: 'نوع الأدراج' },
        { key: 'drawerCount',       label: 'عدد الأدراج' },
        { key: 'lightsNeeded',      label: 'الإضاءة' },
        { key: 'lightsDescription', label: 'وصف الإضاءة' },
        { key: 'handleType',        label: 'نوع المسكات' },
        { key: 'handleColor',       label: 'لون المسكات' },
        { key: 'counterType',       label: 'نوع الرخام / البورسلين' },
        { key: 'counterColor',      label: 'لون الرخام' },
        { key: 'skirtingNeeded',    label: 'النعلة السفلية' },
        { key: 'upperFillerNeeded', label: 'الفيلر العلوي' },
        { key: 'islandNeeded',      label: 'الجزيرة' },
        { key: 'islandDescription', label: 'مواصفات الجزيرة' },
    ],

    WORKFLOW_STEPS: [
        { key: 'initial_measure',     label: 'رفع المقاسات المبدئية',                        phase: 'pre_sales',      phaseLabel: 'ما قبل البيع والتصميم' },
        { key: 'contract_signed',     label: 'الاتفاق والتعاقد',                              phase: 'pre_sales' },
        { key: '3d_design',           label: 'التصميم ثلاثي الأبعاد',                         phase: 'pre_sales' },
        { key: 'handover_to_technical', label: 'تحويل التفاصيل من المبيعات للمكتب الفني',   phase: 'technical_prep', phaseLabel: 'الإعداد الفني' },
        { key: 'job_order_created',   label: 'إنشاء الجوب أوردر وLPO',                       phase: 'technical_prep' },
        { key: 'cutting_list_approved', label: 'اعتماد قائمة التقطيع',                       phase: 'technical_prep' },
        { key: 'material_qc',         label: 'فحص جودة الخامات قبل التصنيع',                 phase: 'quality_control', phaseLabel: 'ضبط الجودة', critical: true },
        { key: 'frame_purchase',      label: 'شراء مواد البوكسات',                            phase: 'frame_production', phaseLabel: 'تصنيع البوكسات' },
        { key: 'frame_fabrication',   label: 'تصنيع البوكسات',                                phase: 'frame_production' },
        { key: 'frame_delivery',      label: 'توريد البوكسات للموقع',                         phase: 'frame_production' },
        { key: 'frame_installation',  label: 'تثبيت البوكسات',                                phase: 'frame_production' },
        { key: 'panel_purchase',      label: 'شراء مواد الضلفات',                             phase: 'panel_production', phaseLabel: 'تصنيع الضلفات' },
        { key: 'panel_fabrication',   label: 'تصنيع الضلفات',                                 phase: 'panel_production' },
        { key: 'panel_installation',  label: 'تثبيت الضلفات',                                 phase: 'panel_production' },
        { key: 'accessories_purchase', label: 'شراء الإكسسوارات',                            phase: 'finishing', phaseLabel: 'الإكسسوارات والكهرباء' },
        { key: 'electrical_purchase', label: 'شراء الأجهزة الكهربائية',                       phase: 'finishing' },
        { key: 'final_installation',  label: 'التثبيت النهائي (إكسسوارات + كهرباء)',         phase: 'finishing' },
        { key: 'client_qc',           label: 'معاينة العميل الأولية',                         phase: 'delivery', phaseLabel: 'التسليم', critical: true },
        { key: 'final_adjustments',   label: 'التعديلات النهائية',                             phase: 'delivery' },
        { key: 'handover_signed',     label: 'التسليم النهائي وتوقيع الاستلام',               phase: 'delivery', critical: true },
    ],

    TOAST_DURATION:   3200,
    DEFAULT_TAX_RATE: 5,
    AUTO_TAX_RATE:    5,
    AUTO_SAVE_DELAY:  5000,
});

export const WORKFLOW_STEP_KEYS = CONFIG.WORKFLOW_STEPS.map(s => s.key);
export const OWNER_EMAIL = (window.KPM_OWNER_EMAIL || 'ahmd.elshiekh@gmail.com').toLowerCase();
export const FIREBASE_COLLECTIONS = Object.freeze({
    PROJECTS: 'projects',
    MATERIALS: 'materials',
    USER_PROFILES: 'userProfiles',
    USERNAMES: 'usernames',
    PROJECT_DESIGNS: 'projectDesigns',
    ACTIVITY_LOGS: 'activityLogs',
});
export const DEFAULT_PERMISSIONS = Object.freeze({
    canViewProjects: true,
    canViewBoard: false,
    canViewDashboard: false,
    canViewFinancials: false,
    canCreateProjects: false,
    canEditProjects: false,
    canDeleteProjects: false,
    canImportProjects: false,
    canExportProjects: false,
    canManageDesigns: false,
    canManageUsers: false,
    canViewActivityLogs: false,
});
export const ROLE_PRESETS = Object.freeze({
    viewer: { ...DEFAULT_PERMISSIONS },
    editor: {
        ...DEFAULT_PERMISSIONS,
        canViewBoard: true,
        canViewFinancials: true,
        canCreateProjects: true,
        canEditProjects: true,
        canExportProjects: true,
        canManageDesigns: true,
        canViewActivityLogs: false,
    },
    manager: {
        ...DEFAULT_PERMISSIONS,
        canViewBoard: true,
        canViewDashboard: true,
        canViewFinancials: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canImportProjects: true,
        canExportProjects: true,
        canManageDesigns: true,
        canViewActivityLogs: false,
    },
    admin: {
        ...DEFAULT_PERMISSIONS,
        canViewBoard: true,
        canViewDashboard: true,
        canViewFinancials: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canImportProjects: true,
        canExportProjects: true,
        canManageDesigns: true,
        canManageUsers: true,
        canViewActivityLogs: true,
    },
    super_admin: {
        canViewProjects: true,
        canViewBoard: true,
        canViewDashboard: true,
        canViewFinancials: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canImportProjects: true,
        canExportProjects: true,
        canManageDesigns: true,
        canManageUsers: true,
        canViewActivityLogs: true,
    },
});
export const ROLE_LABELS = Object.freeze({
    viewer: 'مشاهد',
    editor: 'محرر',
    manager: 'مدير تشغيل',
    admin: 'مدير نظام',
    super_admin: 'المالك',
});
export const STAGE_LABELS = {
    pre_sales:'ما قبل البيع', measurement:'المعاينة', contract:'التعاقد', design:'التصميم',
    technical_handover:'تحويل فني', job_order:'جوب أوردر', cutting_approved:'قائمة تقطيع',
    quality_control:'فحص جودة', frame_purchase:'شراء بوكسات', frame_fabrication:'تصنيع بوكسات',
    frame_delivery:'توريد بوكسات', frame_installation:'تثبيت بوكسات', panel_purchase:'شراء ضلفات',
    panel_fabrication:'تصنيع ضلفات', panel_installation:'تثبيت ضلفات', finishing_purchase:'شراء إكسسوارات',
    finishing_installation:'تثبيت نهائي', client_qc:'معاينة عميل', delivery_adjustments:'تعديلات',
    delivery_complete:'تسليم',
};
export const STAGE_ORDER = Object.keys(STAGE_LABELS);