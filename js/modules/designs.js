// js/modules/designs.js
import { DB } from '../db.js';
import { Toast } from './toast.js';
import { Confirm } from './confirm.js';
import { AppState } from '../state.js';

export const Designs = {
    async upload() {
        const fileInput = document.getElementById('designFileInput');
        const files = fileInput?.files;
        if (!files || files.length === 0) {
            Toast.show('لم يتم اختيار أي ملفات', 'error');
            return;
        }

        const MAX_SIZE = 5 * 1024 * 1024;
        let uploaded = 0;

        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) {
                Toast.show(`الملف "${file.name}" ليس صورة`, 'error');
                continue;
            }
            if (file.size > MAX_SIZE) {
                Toast.show(`الملف "${file.name}" أكبر من 5MB`, 'error');
                continue;
            }

            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        await DB.saveDesign(e.target.result);
                        uploaded++;
                    } catch (err) {
                        Toast.show(`خطأ في تحميل "${file.name}"`, 'error');
                    }
                    resolve();
                };
                reader.onerror = () => {
                    Toast.show(`خطأ في قراءة "${file.name}"`, 'error');
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }

        if (uploaded > 0) Toast.show(`تم تحميل ${uploaded} صورة`);
        if (fileInput) fileInput.value = '';
        await this.render();
    },

    async delete(id) {
        const confirmed = await Confirm.show('هل تريد حذف هذه الصورة؟', 'حذف الصورة');
        if (!confirmed) return;
        try {
            await DB.deleteDesign(id);
            await this.render();
            Toast.show('تم حذف الصورة');
        } catch {
            Toast.show('خطأ في حذف الصورة', 'error');
        }
    },

    async render() {
        const gallery = document.getElementById('designsGallery');
        if (!gallery) return;
        try {
            const designs = await DB.getDesignsForProject(AppState.current.id);
            if (designs.length === 0) {
                gallery.innerHTML = '<p class="designs-empty">لا توجد صور تصميم مرفوعة بعد</p>';
                return;
            }
            gallery.innerHTML = designs.map(d => `
                <div class="design-item">
                    <img src="${d.data}" alt="تصميم المطبخ" class="design-item__image" loading="lazy">
                    <div class="design-item__overlay">
                        <button class="btn btn--danger btn--icon btn--sm" data-action="delete-design" data-design-id="${d.id}" title="حذف">
                            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </div>
            `).join('');
        } catch {
            gallery.innerHTML = '<p class="designs-empty">خطأ في تحميل الصور</p>';
        }
    },

    clearUpload() {
        const input = document.getElementById('designFileInput');
        if (input) input.value = '';
    },

    // For modal gallery
    async renderIn(galleryId) {
        const gallery = document.getElementById(galleryId);
        if (!gallery) return;
        try {
            const designs = await DB.getDesignsForProject(AppState.current.id);
            if (!designs.length) {
                gallery.innerHTML = '<p class="designs-empty">لا توجد صور تصميم مرفوعة بعد</p>';
                return;
            }
            gallery.innerHTML = designs.map(d => `
                <div class="design-item">
                    <img src="${d.data}" alt="تصميم المطبخ" class="design-item__image" loading="lazy">
                    <div class="design-item__overlay">
                        <button class="btn btn--danger btn--icon btn--sm" data-action="delete-design" data-design-id="${d.id}" title="حذف">
                            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </div>
            `).join('');
        } catch {
            gallery.innerHTML = '<p class="designs-empty">خطأ في تحميل الصور</p>';
        }
    },
};