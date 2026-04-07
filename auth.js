(function () {
    const OWNER_EMAIL = (window.KPM_OWNER_EMAIL || 'ahmd.elshiekh@gmail.com').toLowerCase();
    const firebaseConfig = window.KPM_FIREBASE_CONFIG || {};

    const hasRealConfig = ['apiKey', 'authDomain', 'projectId', 'appId'].every((key) => {
        const value = firebaseConfig[key];
        return value && !String(value).startsWith('REPLACE_WITH_');
    });

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const resetForm = document.getElementById('resetForm');
    const statusBox = document.getElementById('authStatus');
    const loginTabBtn = document.getElementById('loginTabBtn');
    const registerTabBtn = document.getElementById('registerTabBtn');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const registerSubmitBtn = document.getElementById('registerSubmitBtn');
    const resetSubmitBtn = document.getElementById('resetSubmitBtn');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    const pageLoaderText = document.getElementById('pageLoaderText');
    const authHeroTitle = document.getElementById('authHeroTitle');
    const authHeroText = document.getElementById('authHeroText');
    const authHeroHint1 = document.getElementById('authHeroHint1');
    const authHeroHint2 = document.getElementById('authHeroHint2');
    const authHeroHint3 = document.getElementById('authHeroHint3');

    const AUTH_TIPS = Object.freeze([
        {
            title: 'الشغل المتقن يكبر خطوة خطوة',
            text: 'خذ كل خطوة على مهلها، وخل شغلك واضح ونظيف، فالمداومة الهادية تصنع نتيجة محترمة.',
            hints: [
                'رتب يومك، وابدأ بالأهم، والباقي يتظبط.',
                'الدقة من أول مرة توفر تعب كثير بعدين.',
                'الاستمرار الهادئ أحسن من السرعة المشتتة.',
            ],
        },
        {
            title: 'النية الطيبة والشغل الصح يبانوا',
            text: 'إذا صلحت الأساس، التفاصيل تمشي معك أسهل، ويصير الإنجاز مريح وواضح لكل الفريق.',
            hints: [
                'خل كل معلومة في مكانها، والرجعة لها تصير أسهل.',
                'الوضوح بين الناس نصف إنجاز الشغل.',
                'كل تعديل مرتب اليوم يوفر عليك لخبطة بكرة.',
            ],
        },
        {
            title: 'القليل المستمر ينجز الكثير',
            text: 'مو لازم كل شيء يتم دفعة واحدة، المهم كل مرة تضيف خطوة صحيحة وتكمل عليها.',
            hints: [
                'ابدأ بما يلزم الآن، ثم حسّن الباقي بهدوء.',
                'الشغل النظيف يعيش أكثر.',
                'كل تقدم صغير محسوب وله أثر.',
            ],
        },
        {
            title: 'إذا اتضبطت البداية، ارتاح باقي الطريق',
            text: 'تنظيم الدخول والبيانات من أولها يساعدك تشتغل بثقة ويقلل الأخطاء والتأخير.',
            hints: [
                'راجع قبل الحفظ، فاللمسة البسيطة تفرق.',
                'كل شغل له وقته، فلا تستعجل على حساب الجودة.',
                'الترتيب الهادئ يبني شغل يعتمد عليه.',
            ],
        },
        {
            title: 'الشغل الصالح يترك أثر طيب',
            text: 'كل مشروع يخلص بإتقان هو رزق طيب وسمعة طيبة، فخل يدك دائمًا على الشيء الصح.',
            hints: [
                'الإتقان عادة، وليس مجهود مرة واحدة.',
                'التعاون المهذب يسهّل أصعب الأعمال.',
                'أحسن عملك اليوم، يفتح الله لك في الذي بعده.',
            ],
        },
    ]);

    const PageLoader = (() => {
        let finished = false;

        function show(message) {
            if (message && pageLoaderText) pageLoaderText.textContent = message;
            document.body.classList.add('app-loading');
            document.body.classList.remove('app-ready');
        }

        function finish() {
            if (finished) return;
            finished = true;
            requestAnimationFrame(() => {
                document.body.classList.remove('app-loading');
                document.body.classList.add('app-ready');
            });
        }

        return { show, finish };
    })();

    const DEFAULT_PERMISSIONS = Object.freeze({
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
        canManageAppSettings: false,
        canViewActivityLogs: false,
    });

    const ROLE_PRESETS = Object.freeze({
        viewer: { ...DEFAULT_PERMISSIONS },
        editor: {
            ...DEFAULT_PERMISSIONS,
            canViewBoard: true,
            canViewFinancials: true,
            canCreateProjects: true,
            canEditProjects: true,
            canExportProjects: true,
            canManageDesigns: true,
            canManageAppSettings: false,
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
            canManageAppSettings: false,
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
            canManageAppSettings: true,
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
            canManageAppSettings: true,
            canViewActivityLogs: true,
        },
    });

    if (!hasRealConfig) {
        showStatus('أكمل بيانات Firebase داخل ملف firebase-config.js أولاً ثم أعد تحميل الصفحة.', 'error');
        disableForms(true);
        PageLoader.finish();
        return;
    }

    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth(app);
    const db = firebase.firestore(app);

    async function writeActivityLog(action, entityType, entityId, details) {
        try {
            await db.collection('activityLogs').add({
                action,
                entityType,
                entityId: entityId || null,
                details: details || '',
                actor: {
                    uid: auth.currentUser?.uid || null,
                    email: auth.currentUser?.email || null,
                    displayName: auth.currentUser?.displayName || null,
                },
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } catch (error) {
            console.warn('Activity log write failed:', error);
        }
    }

    bindTabs();
    setupAuthHeroTip();
    guardSignedInUser();
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    resetForm.addEventListener('submit', handleResetPassword);
    forgotPasswordBtn.addEventListener('click', () => setActiveTab('reset'));
    backToLoginBtn.addEventListener('click', () => setActiveTab('login'));

    function bindTabs() {
        [loginTabBtn, registerTabBtn].forEach((btn) => {
            btn.addEventListener('click', () => setActiveTab(btn.dataset.authTab));
        });
    }

    function setupAuthHeroTip() {
        if (!authHeroTitle || !authHeroText) return;
        const previousIndex = Number(sessionStorage.getItem('kpm_auth_tip_index') || '-1');
        const available = AUTH_TIPS.map((_, index) => index).filter((index) => index !== previousIndex);
        const nextIndex = available[Math.floor(Math.random() * available.length)] ?? 0;
        const tip = AUTH_TIPS[nextIndex];
        sessionStorage.setItem('kpm_auth_tip_index', String(nextIndex));

        authHeroTitle.textContent = tip.title;
        authHeroText.textContent = tip.text;
        [authHeroHint1, authHeroHint2, authHeroHint3].forEach((el, index) => {
            if (el) el.textContent = tip.hints[index] || '';
        });
    }

    function setActiveTab(tab) {
        document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.authTab === tab);
        });
        loginForm.classList.toggle('is-active', tab === 'login');
        registerForm.classList.toggle('is-active', tab === 'register');
        resetForm.classList.toggle('is-active', tab === 'reset');
        showStatus('', 'success', true);
    }

    function disableForms(disabled) {
        [loginSubmitBtn, registerSubmitBtn, resetSubmitBtn].forEach((btn) => { btn.disabled = disabled; });
        document.querySelectorAll('.auth-form input, .auth-form button').forEach((el) => {
            if (el.dataset.authTab) return;
            if (el === loginTabBtn || el === registerTabBtn) return;
            el.disabled = disabled;
        });
    }

    function showStatus(message, type, hidden) {
        statusBox.hidden = hidden || !message;
        statusBox.textContent = message || '';
        statusBox.className = 'auth-status';
        if (!hidden && message) statusBox.classList.add(type === 'error' ? 'is-error' : 'is-success');
    }

    function normalizeUsername(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9._-]/g, '');
    }

    function permissionsForRole(role) {
        return { ...(ROLE_PRESETS[role] || ROLE_PRESETS.viewer) };
    }

    async function guardSignedInUser() {
        PageLoader.show('نراجع الجلسة الحالية ونجهز الدخول بهدوء.');
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                PageLoader.finish();
                return;
            }
            try {
                PageLoader.show('لقينا جلسة شغالة، ونجهز حسابك الآن.');
                await ensureUserProfile(user, null, true);
                window.location.replace('app.html');
            } catch (error) {
                console.error(error);
                showStatus('في شيء منع تجهيز الحساب الآن. راجع إعدادات Firebase وحاول مرة ثانية.', 'error');
                PageLoader.finish();
            }
        });
    }

    async function resolveEmail(identifier) {
        const clean = String(identifier || '').trim();
        if (!clean) throw new Error('أدخل اسم المستخدم أو البريد الإلكتروني.');
        if (clean.includes('@')) return clean;

        const username = normalizeUsername(clean);
        const usernameDoc = await db.collection('usernames').doc(username).get();
        if (!usernameDoc.exists) throw new Error('اسم المستخدم غير موجود.');
        const email = usernameDoc.data()?.email;
        if (!email) throw new Error('لا يوجد بريد مرتبط بهذا المستخدم.');
        return email;
    }

    async function handleLogin(event) {
        event.preventDefault();
        disableForms(true);
        showStatus('لحظة صغيرة، نراجع بيانات الدخول.', 'success');
        try {
            const identifier = document.getElementById('loginIdentifier').value;
            const password = document.getElementById('loginPassword').value;
            const email = await resolveEmail(identifier);
            const credential = await auth.signInWithEmailAndPassword(email, password);
            await ensureUserProfile(credential.user, null, true);
            await writeActivityLog('login', 'auth', credential.user.uid, `تسجيل دخول ناجح للحساب ${email}`);
            showStatus('تمام، دخلت بنجاح. نفتح لك التطبيق الآن.', 'success');
            PageLoader.show('دخلت تمام، ونجهز لك الصفحة كاملة.');
            window.location.replace('app.html');
        } catch (error) {
            console.error(error);
            showStatus(mapAuthError(error), 'error');
            disableForms(false);
        }
    }

    async function handleRegister(event) {
        event.preventDefault();
        disableForms(true);
        showStatus('نجهز حسابك الآن، لحظة بسيطة.', 'success');

        const displayName = document.getElementById('registerDisplayName').value.trim();
        const usernameRaw = document.getElementById('registerUsername').value;
        const username = normalizeUsername(usernameRaw);
        const email = document.getElementById('registerEmail').value.trim().toLowerCase();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        try {
            if (!displayName) throw new Error('أدخل الاسم الظاهر.');
            if (username.length < 3) throw new Error('اسم المستخدم يجب أن يكون 3 أحرف أو أكثر.');
            if (password !== confirmPassword) throw new Error('تأكيد كلمة المرور غير مطابق.');

            const usernameRef = db.collection('usernames').doc(username);
            const existingUsername = await usernameRef.get();
            if (existingUsername.exists) throw new Error('اسم المستخدم مستخدم بالفعل.');

            const credential = await auth.createUserWithEmailAndPassword(email, password);
            await credential.user.updateProfile({ displayName });
            await ensureUserProfile(credential.user, { displayName, username }, false);
            await writeActivityLog('register', 'user', credential.user.uid, `إنشاء مستخدم جديد باسم ${displayName} واسم مستخدم ${username}`);

            showStatus('تم إنشاء الحساب بنجاح، وأهلاً بك معنا.', 'success');
            PageLoader.show('حسابك صار جاهز، ونفتح لك التطبيق لأول مرة.');
            window.location.replace('app.html');
        } catch (error) {
            console.error(error);
            showStatus(mapAuthError(error), 'error');
            disableForms(false);
        }
    }

    async function handleResetPassword(event) {
        event.preventDefault();
        disableForms(true);
        showStatus('نجهز لك رابط استعادة كلمة المرور.', 'success');

        try {
            const identifier = document.getElementById('resetIdentifier').value;
            const email = await resolveEmail(identifier);
            await auth.sendPasswordResetEmail(email);
            await writeActivityLog('password_reset_requested', 'auth', null, `طلب إعادة تعيين كلمة المرور للحساب ${email}`);
            showStatus('أرسلنا رابط الاستعادة إلى بريدك، راجع الرسائل.', 'success');
            resetForm.reset();
            disableForms(false);
        } catch (error) {
            console.error(error);
            showStatus(mapAuthError(error), 'error');
            disableForms(false);
        }
    }

    async function ensureUserProfile(user, seedData, preserveUsername) {
        const email = (user.email || '').toLowerCase();
        const isOwner = email === OWNER_EMAIL;
        const profileRef = db.collection('userProfiles').doc(user.uid);
        const existingProfileSnap = await profileRef.get();
        const existingProfile = existingProfileSnap.exists ? existingProfileSnap.data() : null;
        const hasStoredRole = !!existingProfile && Object.prototype.hasOwnProperty.call(existingProfile, 'role');
        const hasStoredPermissions = !!existingProfile && Object.prototype.hasOwnProperty.call(existingProfile, 'permissions');
        const username = normalizeUsername(seedData?.username || existingProfile?.username || user.displayName || email.split('@')[0]);
        const role = isOwner ? 'super_admin' : (hasStoredRole ? existingProfile?.role : 'viewer');
        const effectivePermissions = isOwner
            ? permissionsForRole(role)
            : (existingProfile
                ? (hasStoredPermissions ? existingProfile.permissions : undefined)
                : permissionsForRole(role));
        const profile = {
            uid: user.uid,
            email: user.email,
            displayName: seedData?.displayName || user.displayName || existingProfile?.displayName || username,
            username,
            usernameLower: username,
            role,
            permissions: effectivePermissions,
            createdAt: existingProfile?.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        const profileForWrite = { ...profile };
        if (existingProfile && !isOwner) {
            if (!hasStoredRole) delete profileForWrite.role;
            if (!hasStoredPermissions) delete profileForWrite.permissions;
        }

        const batch = db.batch();
        batch.set(profileRef, profileForWrite, { merge: true });
        batch.set(db.collection('usernames').doc(username), {
            uid: user.uid,
            email: user.email,
            displayName: profile.displayName,
            username,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        if (existingProfile?.username && existingProfile.username !== username && !preserveUsername) {
            batch.delete(db.collection('usernames').doc(existingProfile.username));
        }

        await batch.commit();
    }

    function mapAuthError(error) {
        const message = error?.message || '';
        switch (error?.code) {
            case 'auth/email-already-in-use': return 'هذا البريد مستخدم بالفعل.';
            case 'auth/invalid-email': return 'صيغة البريد الإلكتروني غير صحيحة.';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-login-credentials': return 'بيانات الدخول غير صحيحة.';
            case 'auth/too-many-requests': return 'تم تنفيذ محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.';
            case 'auth/weak-password': return 'كلمة المرور ضعيفة. استخدم 8 أحرف أو أكثر.';
            case 'permission-denied': return 'تم تسجيل الدخول، لكن قواعد Firebase الحالية منعت الوصول للبيانات. انشر آخر نسخة من firestore.rules ثم أعد المحاولة.';
            default: return message || 'حدث خطأ غير متوقع أثناء المصادقة.';
        }
    }
})();
