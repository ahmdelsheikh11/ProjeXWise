import { CONFIG, FIREBASE_COLLECTIONS, OWNER_EMAIL, DEFAULT_PERMISSIONS, ROLE_PRESETS } from './config.js';
import { AppState } from './state.js';
import { migrateWorkflow, normaliseProject, todayString } from './utils.js';

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

function getRolePermissions(role) {
    return { ...(ROLE_PRESETS[role] || ROLE_PRESETS.viewer) };
}

export function getCurrentPermissions() {
    const profile = AppState.currentUserProfile || {};
    if ((profile.email || '').toLowerCase() === OWNER_EMAIL || profile.role === 'super_admin') {
        return getRolePermissions('super_admin');
    }
    return { ...DEFAULT_PERMISSIONS, ...getRolePermissions(profile.role), ...(profile.permissions || {}) };
}

export function isCurrentOwner() {
    const profile = AppState.currentUserProfile || {};
    return ((profile.email || '').toLowerCase() === OWNER_EMAIL) || profile.role === 'super_admin';
}

export function hasPermission(permission) {
    return Boolean(getCurrentPermissions()[permission]);
}

export function requirePermission(permission, message = 'ليست لديك صلاحية لهذا الإجراء') {
    if (hasPermission(permission)) return true;
    // Toast will be imported later, but we'll use a placeholder
    console.warn(message);
    return false;
}

function normaliseUsername(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '');
}

function materialDocId(name) {
    return encodeURIComponent(String(name || '').trim().toLowerCase());
}

function serialiseForFirestore(value) {
    return JSON.parse(JSON.stringify(value));
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
            extra: serialiseForFirestore(extra),
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        console.warn('Activity log write failed:', error);
    }
}

export const DB = {
    async init() {
        const services = getFirebaseServices();
        const user = services.auth.currentUser;
        if (!user) throw new Error('المستخدم غير مسجل الدخول.');
        AppState.authUser = user;
        // We'll import AuthSession later to avoid circular dependency
        // For now, we'll call a function that will be set by main
        if (window.__ensureProfile) {
            AppState.currentUserProfile = await window.__ensureProfile(user);
        }
        AppState.db = services.db;
        return AppState.db;
    },

    async saveProject(project) {
        const { db } = getFirebaseServices();
        const ref = db.collection(FIREBASE_COLLECTIONS.PROJECTS).doc(project.id);
        const existingSnap = await ref.get();
        const existing = existingSnap.exists ? existingSnap.data() : null;
        const actor = getActorSnapshot();
        const payload = serialiseForFirestore({
            ...project,
            createdAt: existing?.createdAt || project.createdAt || new Date().toISOString(),
            createdBy: existing?.createdBy || project.createdBy || actor,
            updatedAt: new Date().toISOString(),
            updatedBy: actor,
            ownerUid: AppState.authUser?.uid || null,
        });
        await ref.set(payload, { merge: true });
        await writeActivityLog(existing ? 'project_updated' : 'project_created', 'project', project.id, existing ? `تم تعديل المشروع ${project.id}` : `تم إنشاء المشروع ${project.id}`, {
            client: project.client || '',
            projectName: project.name || '',
        });
        return payload;
    },

    async loadProjects() {
        const { db } = getFirebaseServices();
        const snap = await db.collection(FIREBASE_COLLECTIONS.PROJECTS).get();
        return snap.docs
            .map((doc) => migrateWorkflow(doc.data()))
            .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    },

    async getProject(id) {
        const { db } = getFirebaseServices();
        const project = await db.collection(FIREBASE_COLLECTIONS.PROJECTS).doc(id).get();
        return project.exists ? normaliseProject(project.data()) : null;
    },

    async deleteProject(id) {
        const { db } = getFirebaseServices();
        await db.collection(FIREBASE_COLLECTIONS.PROJECTS).doc(id).delete();
        await writeActivityLog('project_deleted', 'project', id, `تم حذف المشروع ${id}`);
    },

    async deleteAllProjects() {
        const projects = await this.loadProjects();
        for (const project of projects) {
            await this.deleteAllDesignsForProject(project.id);
            await this.deleteProject(project.id);
        }
    },

    async saveMaterial(name, price) {
        const { db } = getFirebaseServices();
        const record = { name, price, lastUsed: new Date().toISOString() };
        await db.collection(FIREBASE_COLLECTIONS.MATERIALS).doc(materialDocId(name)).set(record, { merge: true });
        return record;
    },

    async searchMaterials(query) {
        const { db } = getFirebaseServices();
        const snap = await db.collection(FIREBASE_COLLECTIONS.MATERIALS).get();
        const materials = snap.docs.map((doc) => doc.data());
        if (!query) return materials.slice(0, 10);
        return materials
            .filter((material) => String(material.name || '').toLowerCase().includes(String(query || '').toLowerCase()))
            .slice(0, 10);
    },

    async saveDesign(imageData) {
        const { db, storage } = getFirebaseServices();
        const designId = db.collection(FIREBASE_COLLECTIONS.PROJECT_DESIGNS).doc().id;
        const storagePath = `designs/${AppState.current.id}/${designId}.png`;
        await storage.ref().child(storagePath).putString(imageData, 'data_url');
        const url = await storage.ref().child(storagePath).getDownloadURL();
        const design = {
            id: designId,
            projectId: AppState.current.id,
            data: url,
            storagePath,
            uploadedAt: new Date().toISOString(),
            uploadedBy: AppState.authUser?.uid || null,
        };
        await db.collection(FIREBASE_COLLECTIONS.PROJECT_DESIGNS).doc(designId).set(design);
        await writeActivityLog('design_uploaded', 'design', designId, `تم رفع تصميم جديد للمشروع ${AppState.current.id}`);
        return design;
    },

    async getDesignsForProject(projectId) {
        const { db } = getFirebaseServices();
        const snap = await db.collection(FIREBASE_COLLECTIONS.PROJECT_DESIGNS).where('projectId', '==', projectId).get();
        return snap.docs
            .map((doc) => doc.data())
            .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    },

    async deleteDesign(id) {
        const { db, storage } = getFirebaseServices();
        const designDoc = await db.collection(FIREBASE_COLLECTIONS.PROJECT_DESIGNS).doc(id).get();
        if (designDoc.exists) {
            const design = designDoc.data() || {};
            if (design.storagePath) {
                try {
                    await storage.ref().child(design.storagePath).delete();
                } catch (error) {
                    console.warn('Storage delete warning:', error);
                }
            }
        }
        await db.collection(FIREBASE_COLLECTIONS.PROJECT_DESIGNS).doc(id).delete();
        await writeActivityLog('design_deleted', 'design', id, `تم حذف تصميم من المشروع ${AppState.current.id}`);
    },

    async deleteAllDesignsForProject(projectId) {
        const designs = await this.getDesignsForProject(projectId);
        for (const design of designs) {
            await this.deleteDesign(design.id);
        }
    },
};