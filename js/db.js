// js/db.js
import { CONFIG, FIREBASE_COLLECTIONS, OWNER_EMAIL, DEFAULT_PERMISSIONS, ROLE_PRESETS } from './config.js';
import { AppState } from './state.js';
import { migrateWorkflow, normaliseProject } from './utils.js';

// -------------------- Firebase helpers --------------------
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

// -------------------- Chunk loading & caching --------------------
let backgroundRefreshPromise = null;

export async function loadProjectsChunk(limit = 20, lastDoc = null) {
    const { db } = getFirebaseServices();
    let query = db.collection(FIREBASE_COLLECTIONS.PROJECTS)
        .orderBy('updatedAt', 'desc')
        .limit(limit);
    if (lastDoc) {
        query = query.startAfter(lastDoc);
    }
    const snapshot = await query.get();
    const projects = snapshot.docs.map(doc => migrateWorkflow(doc.data()));
    const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    const hasMore = snapshot.docs.length === limit;
    return { projects, lastDoc: newLastDoc, hasMore };
}

export async function loadAllProjectsInChunks(onChunk, chunkSize = 20) {
    let allProjects = [];
    let lastDoc = null;
    let hasMore = true;
    while (hasMore) {
        const { projects, lastDoc: newLastDoc, hasMore: more } = await loadProjectsChunk(chunkSize, lastDoc);
        allProjects = allProjects.concat(projects);
        lastDoc = newLastDoc;
        hasMore = more;
        if (onChunk) onChunk(projects, allProjects.length);
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    return allProjects;
}

export async function loadProjectsWithCache() {
    const cache = AppState.projectsCache;
    if (cache.all && cache.timestamp && (Date.now() - cache.timestamp < 5 * 60 * 1000)) {
        // stale-while-revalidate
        refreshProjectsCacheInBackground();
        return cache.all;
    }
    if (cache.isLoading) {
        // انتظار التحميل الجاري
        return new Promise(resolve => {
            const check = setInterval(() => {
                if (!cache.isLoading && cache.all) {
                    clearInterval(check);
                    resolve(cache.all);
                }
            }, 100);
        });
    }
    cache.isLoading = true;
    try {
        const allProjects = await loadAllProjectsInChunks((chunk, total) => {
            // إضافة الدفعة إلى cache.chunks
            cache.chunks.push(chunk);
            notifyProjectsCacheListeners({ type: 'chunk', chunk, total });
        });
        cache.all = allProjects;
        cache.timestamp = Date.now();
        cache.isLoading = false;
        notifyProjectsCacheListeners({ type: 'complete', all: allProjects });
        return allProjects;
    } catch (err) {
        cache.isLoading = false;
        throw err;
    }
}

function refreshProjectsCacheInBackground() {
    if (backgroundRefreshPromise) return;
    backgroundRefreshPromise = (async () => {
        try {
            const fresh = await loadAllProjectsInChunks();
            AppState.projectsCache.all = fresh;
            AppState.projectsCache.timestamp = Date.now();
            notifyProjectsCacheListeners({ type: 'refresh', all: fresh });
        } catch (err) {
            console.warn('Background refresh failed:', err);
        } finally {
            backgroundRefreshPromise = null;
        }
    })();
}

function notifyProjectsCacheListeners(data) {
    AppState.projectsCache.listeners.forEach(listener => {
        try { listener(data); } catch (e) { console.warn(e); }
    });
}

export function onProjectsCacheUpdate(listener) {
    AppState.projectsCache.listeners.push(listener);
    if (AppState.projectsCache.all) {
        listener({ type: 'complete', all: AppState.projectsCache.all });
    }
}

// -------------------- CRUD operations (مع تحديث cache) --------------------
export async function saveProject(project) {
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
    refreshProjectsCacheInBackground();
    return payload;
}

export async function getProject(id) {
    const { db } = getFirebaseServices();
    const project = await db.collection(FIREBASE_COLLECTIONS.PROJECTS).doc(id).get();
    return project.exists ? normaliseProject(project.data()) : null;
}

export async function deleteProject(id) {
    const { db } = getFirebaseServices();
    await db.collection(FIREBASE_COLLECTIONS.PROJECTS).doc(id).delete();
    await writeActivityLog('project_deleted', 'project', id, `تم حذف المشروع ${id}`);
    if (AppState.projectsCache.all) {
        AppState.projectsCache.all = AppState.projectsCache.all.filter(p => p.id !== id);
        notifyProjectsCacheListeners({ type: 'refresh', all: AppState.projectsCache.all });
    }
    refreshProjectsCacheInBackground();
}

export async function deleteAllProjects() {
    const projects = await loadAllProjectsInChunks();
    for (const project of projects) {
        await deleteAllDesignsForProject(project.id);
        await deleteProject(project.id);
    }
    AppState.projectsCache.all = [];
    AppState.projectsCache.chunks = [];
    notifyProjectsCacheListeners({ type: 'refresh', all: [] });
}

// -------------------- Materials & Designs (بدون تغيير كبير) --------------------
export async function saveMaterial(name, price) {
    const { db } = getFirebaseServices();
    const record = { name, price, lastUsed: new Date().toISOString() };
    await db.collection(FIREBASE_COLLECTIONS.MATERIALS).doc(materialDocId(name)).set(record, { merge: true });
    return record;
}

export async function searchMaterials(query) {
    const { db } = getFirebaseServices();
    const snap = await db.collection(FIREBASE_COLLECTIONS.MATERIALS).get();
    const materials = snap.docs.map((doc) => doc.data());
    if (!query) return materials.slice(0, 10);
    return materials
        .filter((material) => String(material.name || '').toLowerCase().includes(String(query || '').toLowerCase()))
        .slice(0, 10);
}

export async function saveDesign(imageData) {
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
}

export async function getDesignsForProject(projectId) {
    const { db } = getFirebaseServices();
    const snap = await db.collection(FIREBASE_COLLECTIONS.PROJECT_DESIGNS).where('projectId', '==', projectId).get();
    return snap.docs.map((doc) => doc.data()).sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
}

export async function deleteDesign(id) {
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
}

export async function deleteAllDesignsForProject(projectId) {
    const designs = await getDesignsForProject(projectId);
    for (const design of designs) {
        await deleteDesign(design.id);
    }
}

// -------------------- نقطة الدخول الرئيسية (تهيئة DB) --------------------
export async function initDB() {
    const services = getFirebaseServices();
    const user = services.auth.currentUser;
    if (!user) throw new Error('المستخدم غير مسجل الدخول.');
    AppState.authUser = user;
    if (window.__ensureProfile) {
        AppState.currentUserProfile = await window.__ensureProfile(user);
    }
    AppState.db = services.db;
    return AppState.db;
}

// تصدير واجهة DB الموحدة
export const DB = {
    init: initDB,
    saveProject,
    getProject,
    deleteProject,
    deleteAllProjects,
    loadProjectsChunk,
    loadAllProjectsInChunks,
    loadProjectsWithCache,
    onProjectsCacheUpdate,
    saveMaterial,
    searchMaterials,
    saveDesign,
    getDesignsForProject,
    deleteDesign,
    deleteAllDesignsForProject,
};