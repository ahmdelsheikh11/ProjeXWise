import { AppState } from '../state.js';
import { DB, isCurrentOwner, hasPermission, requirePermission, getCurrentPermissions } from '../db.js';
import { Toast } from './toast.js';
import { Modal } from './modal.js';
import { FIREBASE_COLLECTIONS, OWNER_EMAIL, ROLE_LABELS, ROLE_PRESETS } from '../config.js';
import { formatDateTime } from '../utils.js';

function getFirebaseServices() {
    if (AppState.firebase) return AppState.firebase;
    const config = window.KPM_FIREBASE_CONFIG || {};
    const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const isReady = required.every((key) => config[key] && !String(config[key]).startsWith('REPLACE_WITH_'));
    if (!isReady) throw new Error('ملف firebase-config.js غير مكتمل.');
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
    AppState.firebase = {
        app,
        auth: firebase.auth(app),
        db: firebase.firestore(app),
        storage: firebase.storage(app),
    };
    return AppState.firebase;
}

function normaliseUsername(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '');
}

function getActorSnapshot() {
    return {
        uid: AppState.authUser?.uid || null,
        email: AppState.authUser?.email || null,
        displayName: AppState.currentUserProfile?.displayName || AppState.authUser?.displayName || null,
        role: AppState.currentUserProfile?.role || null,
    };
}

async function writeActivityLog(action, entityType, entityId, details = '', extra = {}) {
    try {
        const { db } = getFirebaseServices();
        await db.collection(FIREBASE_COLLECTIONS.ACTIVITY_LOGS).add({
            action,
            entityType,
            entityId: entityId || null,
            details,
            actor: getActorSnapshot(),
            extra,
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        console.warn('Activity log write failed:', error);
    }
}

export const AuthSession = {
    async ensureAuthenticated() {
        const { auth } = getFirebaseServices();
        const user = await new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((currentUser) => {
                unsubscribe();
                resolve(currentUser || null);
            });
        });
        if (!user) {
            window.location.replace('index.html');
            throw new Error('يجب تسجيل الدخول أولاً.');
        }
        AppState.authUser = user;
        AppState.currentUserProfile = await this.ensureProfile(user);
        return user;
    },

    async ensureProfile(user) {
        const { db } = getFirebaseServices();
        const ref = db.collection(FIREBASE_COLLECTIONS.USER_PROFILES).doc(user.uid);
        const snap = await ref.get();
        const existing = snap.exists ? snap.data() : {};
        const isOwner = (user.email || '').toLowerCase() === OWNER_EMAIL;
        const hasStoredRole = snap.exists && Object.prototype.hasOwnProperty.call(existing, 'role');
        const hasStoredPermissions = snap.exists && Object.prototype.hasOwnProperty.call(existing, 'permissions');
        const usernameSeed = existing.username || user.displayName || user.email?.split('@')[0] || 'user';
        const role = isOwner ? 'super_admin' : (hasStoredRole ? existing.role : 'viewer');
        const effectivePermissions = isOwner
            ? ROLE_PRESETS[role]
            : (snap.exists
                ? (hasStoredPermissions ? existing.permissions : undefined)
                : ROLE_PRESETS[role]);
        const profile = {
            uid: user.uid,
            email: user.email,
            displayName: existing.displayName || user.displayName || user.email,
            username: existing.username || normaliseUsername(usernameSeed),
            usernameLower: existing.usernameLower || normaliseUsername(usernameSeed),
            role,
            permissions: effectivePermissions,
            createdAt: existing.createdAt || new Date().toISOString(),
            createdBy: existing.createdBy || {
                uid: user.uid,
                email: user.email,
                displayName: existing.displayName || user.displayName || user.email,
            },
            updatedAt: new Date().toISOString(),
            updatedBy: {
                uid: user.uid,
                email: user.email,
                displayName: existing.displayName || user.displayName || user.email,
            },
        };
        const profileForWrite = { ...profile };
        if (snap.exists && !isOwner) {
            if (!hasStoredRole) delete profileForWrite.role;
            if (!hasStoredPermissions) delete profileForWrite.permissions;
        }
        await ref.set(profileForWrite, { merge: true });
        await db.collection(FIREBASE_COLLECTIONS.USERNAMES).doc(profile.usernameLower).set({
            uid: user.uid,
            email: user.email,
            displayName: profile.displayName,
            username: profile.username,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
        return profile;
    },

    async logout() {
        const { auth } = getFirebaseServices();
        await writeActivityLog('logout', 'auth', AppState.authUser?.uid || null, `تسجيل خروج للحساب ${AppState.authUser?.email || ''}`);
        await auth.signOut();
        window.location.replace('index.html');
    },
};

export const UserAccess = {
    apply() {
        const profile = AppState.currentUserProfile || {};
        const permissions = getCurrentPermissions();
        const owner = isCurrentOwner();
        const userName = document.getElementById('currentUserName');
        const userRole = document.getElementById('currentUserRole');
        const adminBtn = document.getElementById('adminPanelBtn');
        const activityBtn = document.getElementById('activityLogBtn');

        document.body.classList.toggle('app-readonly', !permissions.canEditProjects);
        if (userName) userName.textContent = profile.displayName || profile.email || 'مستخدم';
        if (userRole) userRole.textContent = ROLE_LABELS[profile.role] || 'مستخدم';
        if (adminBtn) adminBtn.hidden = !permissions.canManageUsers;
        if (activityBtn) activityBtn.hidden = !permissions.canViewActivityLogs;

        document.querySelectorAll('[data-financial]').forEach((el) => {
            el.style.display = permissions.canViewFinancials ? '' : 'none';
        });
        document.querySelectorAll('[data-view="board"]').forEach((el) => {
            el.style.display = permissions.canViewBoard ? '' : 'none';
        });
        document.querySelectorAll('[data-view="dashboard"]').forEach((el) => {
            el.style.display = permissions.canViewDashboard ? '' : 'none';
        });
        document.querySelectorAll('[data-owner-only]').forEach((el) => {
            el.style.display = owner ? '' : 'none';
        });
        [document.getElementById('financialsCard'), document.getElementById('financialsDisplayRow')].forEach((el) => {
            if (el) {
                const container = el.closest('.card') || el;
                container.style.display = permissions.canViewFinancials ? '' : 'none';
            }
        });
        if (!permissions.canEditProjects) {
            document.querySelectorAll('input, textarea, select').forEach((input) => {
                if (input.id === 'projectsSearchInput') return;
                input.disabled = true;
                if (['text', 'number', 'date', 'url'].includes(input.type)) input.readOnly = true;
            });
        }
    },
};

export const ProfilePanel = {
    open() {
        const profile = AppState.currentUserProfile || {};
        const nameInput = document.getElementById('profileDisplayName');
        const emailInput = document.getElementById('profileEmail');
        if (nameInput) nameInput.value = profile.displayName || '';
        if (emailInput) emailInput.value = profile.email || '';
        Modal.open('profilePanelModal');
    },
    async save() {
        const displayName = document.getElementById('profileDisplayName')?.value.trim();
        const email = document.getElementById('profileEmail')?.value.trim().toLowerCase();
        if (!displayName || !email) {
            Toast.show('أدخل الاسم والبريد الإلكتروني', 'error');
            return;
        }
        const { auth, db } = getFirebaseServices();
        const user = auth.currentUser;
        if (!user) {
            Toast.show('انتهت الجلسة، سجل الدخول من جديد', 'error');
            return;
        }
        const previousEmail = user.email || '';
        const previousUsername = AppState.currentUserProfile?.usernameLower || normaliseUsername(AppState.currentUserProfile?.username || displayName);
        try {
            if (user.displayName !== displayName) await user.updateProfile({ displayName });
            if (previousEmail.toLowerCase() !== email) await user.updateEmail(email);
            AppState.authUser = auth.currentUser;
            AppState.currentUserProfile = await AuthSession.ensureProfile(auth.currentUser);
            if (previousEmail.toLowerCase() !== email) {
                await db.collection(FIREBASE_COLLECTIONS.USERNAMES).doc(previousUsername).set({
                    uid: user.uid,
                    email,
                    displayName,
                    username: AppState.currentUserProfile.username,
                    updatedAt: new Date().toISOString(),
                }, { merge: true });
            }
            UserAccess.apply();
            await writeActivityLog('profile_updated', 'user', user.uid, `تم تحديث بيانات الحساب ${email}`);
            Toast.show('تم تحديث بيانات الحساب');
            Modal.closeAll();
        } catch (error) {
            console.error(error);
            const message = error?.code === 'auth/requires-recent-login'
                ? 'لتغيير البريد الإلكتروني يجب تسجيل الدخول من جديد ثم إعادة المحاولة.'
                : (error?.message || 'تعذر تحديث بيانات الحساب');
            Toast.show(message, 'error');
        }
    },
};

export const ActivityLogPanel = {
    async open() {
        await this.render();
        Modal.open('activityLogModal');
    },
    async load() {
        const { db } = getFirebaseServices();
        const snap = await db.collection(FIREBASE_COLLECTIONS.ACTIVITY_LOGS).get();
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 200);
    },
    async render() {
        const list = document.getElementById('activityLogList');
        if (!list) return;
        const logs = await this.load();
        if (!logs.length) {
            list.innerHTML = '<div class="activity-log-item"><div class="activity-log-item__title">لا توجد نشاطات مسجلة بعد</div></div>';
            return;
        }
        const labels = {
            login: 'تسجيل دخول',
            register: 'إنشاء مستخدم',
            password_reset_requested: 'طلب استعادة كلمة المرور',
            profile_updated: 'تحديث الحساب الشخصي',
            project_created: 'إنشاء مشروع',
            project_updated: 'تعديل مشروع',
            project_deleted: 'حذف مشروع',
            design_uploaded: 'رفع تصميم',
            design_deleted: 'حذف تصميم',
            user_access_updated: 'تحديث صلاحيات مستخدم',
            user_profile_updated: 'تحديث بيانات مستخدم',
            workflow_updated: 'تحديث سير العمل',
        };
        list.innerHTML = logs.map((log) => `
            <article class="activity-log-item">
                <div class="activity-log-item__top">
                    <div class="activity-log-item__title">${escapeHtml(labels[log.action] || log.action || 'نشاط')}</div>
                    <div class="activity-log-item__time">${escapeHtml(formatDateTime(log.createdAt))}</div>
                </div>
                <div class="activity-log-item__meta">
                    <span>المستخدم: ${escapeHtml(log.actor?.displayName || log.actor?.email || '-')}</span>
                    <span>النوع: ${escapeHtml(log.entityType || '-')}</span>
                    <span>المعرف: ${escapeHtml(log.entityId || '-')}</span>
                </div>
                <div class="activity-log-item__details">${escapeHtml(log.details || 'بدون تفاصيل إضافية')}</div>
            </article>
        `).join('');
    },
};

export const AdminPanel = {
    async open() {
        await this.render();
        Modal.open('adminPanelModal');
    },
    async loadUsers() {
        const { db } = getFirebaseServices();
        const snap = await db.collection(FIREBASE_COLLECTIONS.USER_PROFILES).get();
        AppState.usersCache = snap.docs.map((doc) => doc.data()).sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || ''), 'ar'));
        return AppState.usersCache;
    },
    async render() {
        const users = await this.loadUsers();
        const summary = document.getElementById('adminSummary');
        const list = document.getElementById('adminUsersList');
        if (summary) {
            const cards = [
                { label: 'إجمالي المستخدمين', value: users.length },
                { label: 'المشاهدون', value: users.filter((user) => user.role === 'viewer').length },
                { label: 'الإداريون', value: users.filter((user) => ['admin', 'super_admin'].includes(user.role)).length },
            ];
            summary.innerHTML = cards.map((item) => `<div class="admin-summary__card"><span class="admin-summary__label">${item.label}</span><strong class="admin-summary__value">${item.value}</strong></div>`).join('');
        }
        if (!list) return;
        list.innerHTML = users.map((user) => this.renderUserCard(user)).join('');
    },
    renderUserCard(user) {
        const isOwner = (user.email || '').toLowerCase() === OWNER_EMAIL;
        const permissions = { ...ROLE_PRESETS[user.role], ...(user.permissions || {}) };
        const permissionFields = [
            ['canViewBoard', 'إظهار الإنتاج'],
            ['canViewDashboard', 'إظهار القيادة'],
            ['canViewFinancials', 'عرض المالية'],
            ['canCreateProjects', 'إنشاء مشاريع'],
            ['canEditProjects', 'تعديل المشاريع'],
            ['canDeleteProjects', 'حذف المشاريع'],
            ['canImportProjects', 'استيراد المشاريع'],
            ['canExportProjects', 'تصدير وطباعة'],
            ['canManageDesigns', 'إدارة الصور'],
            ['canManageUsers', 'إدارة المستخدمين'],
            ['canViewActivityLogs', 'عرض سجل النشاطات'],
        ];
        return `
            <article class="admin-user-card" data-uid="${user.uid}">
                <div class="admin-user-card__top">
                    <div>
                        <div class="admin-user-card__name">${escapeHtml(user.displayName || user.email || 'مستخدم')}</div>
                        <div class="admin-user-card__meta">
                            <span>${escapeHtml(user.email || '-')}</span>
                            <span>@${escapeHtml(user.username || '-')}</span>
                            <span>${escapeHtml(ROLE_LABELS[user.role] || user.role || 'viewer')}</span>
                        </div>
                    </div>
                    ${isOwner ? '<span class="overview-meta-pill">الحساب المالك</span>' : ''}
                </div>
                <div class="admin-user-grid">
                    <div class="form-field">
                        <label class="form-label">الدور</label>
                        <select class="form-input form-input--select" data-admin-role ${isOwner ? 'disabled' : ''}>
                            ${['viewer', 'editor', 'manager', 'admin'].map((role) => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${ROLE_LABELS[role]}</option>`).join('')}
                            ${user.role === 'super_admin' ? '<option value="super_admin" selected>المالك</option>' : ''}
                        </select>
                    </div>
                </div>
                <div class="admin-user-permissions">
                    ${permissionFields.map(([key, label]) => `<label class="permission-chip"><input type="checkbox" data-admin-permission="${key}" ${permissions[key] ? 'checked' : ''} ${isOwner ? 'disabled' : ''} /><span>${label}</span></label>`).join('')}
                </div>
                <div class="admin-user-actions">
                    ${isOwner ? '' : `<button class="btn btn--primary btn--sm" data-action="save-user-access" data-uid="${user.uid}">حفظ الصلاحيات</button>`}
                </div>
                <div class="admin-user-timestamps">
                    <span>أنشئ: ${escapeHtml(formatDateTime(user.createdAt))}</span>
                    <span>بواسطة: ${escapeHtml(user.createdBy?.displayName || user.createdBy?.email || '-')}</span>
                    <span>آخر تعديل: ${escapeHtml(formatDateTime(user.updatedAt))}</span>
                    <span>بواسطة: ${escapeHtml(user.updatedBy?.displayName || user.updatedBy?.email || '-')}</span>
                </div>
            </article>`;
    },
    async saveUser(uid) {
        const card = document.querySelector(`.admin-user-card[data-uid="${uid}"]`);
        if (!card) return;
        const role = card.querySelector('[data-admin-role]')?.value || 'viewer';
        const permissions = {};
        card.querySelectorAll('[data-admin-permission]').forEach((input) => {
            permissions[input.dataset.adminPermission] = input.checked;
        });
        const { db } = getFirebaseServices();
        await db.collection(FIREBASE_COLLECTIONS.USER_PROFILES).doc(uid).set({
            role,
            permissions: { ...ROLE_PRESETS[role], ...permissions },
            updatedAt: new Date().toISOString(),
            updatedBy: getActorSnapshot(),
        }, { merge: true });
        await writeActivityLog('user_access_updated', 'user', uid, `تم تحديث صلاحيات المستخدم ${uid}`, { role, permissions });
        Toast.show('تم تحديث صلاحيات المستخدم');
        await this.render();
    },
};

function escapeHtml(str) {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode(String(str || '')));
    return el.innerHTML;
}