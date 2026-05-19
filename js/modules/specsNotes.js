import { AppState } from '../state.js';
import { Toast } from './toast.js';
import { escapeHtml } from '../utils.js';

export const SpecsNotes = {
    _editingIndex: -1,

    add() {
        const input = document.getElementById('specsNotesInput');
        const note  = input.value.trim();
        if (!note) { Toast.show('يجب كتابة ملاحظة', 'error'); return; }

        if (!AppState.current.specifications.notes) AppState.current.specifications.notes = [];
        AppState.current.specifications.notes.push(note);
        input.value = '';
        this._editingIndex = -1;
        this.render();
    },

    startEdit(index) {
        const notes = AppState.current.specifications.notes || [];
        if (index < 0 || index >= notes.length) return;
        this._editingIndex = index;
        this.render();
        const editInput = document.getElementById(`noteEditInput-${index}`);
        if (editInput) { editInput.focus(); editInput.select(); }
    },

    confirmEdit(index) {
        const editInput = document.getElementById(`noteEditInput-${index}`);
        if (!editInput) return;
        const val = editInput.value.trim();
        if (!val) { Toast.show('لا يمكن حفظ ملاحظة فارغة', 'error'); return; }
        AppState.current.specifications.notes[index] = val;
        this._editingIndex = -1;
        this.render();
        Toast.show('تم تحديث الملاحظة');
    },

    cancelEdit() {
        this._editingIndex = -1;
        this.render();
    },

    delete(index) {
        AppState.current.specifications.notes.splice(index, 1);
        if (this._editingIndex === index) this._editingIndex = -1;
        this.render();
    },

    render() {
        const list  = document.getElementById('specsNotesList');
        const notes = AppState.current.specifications.notes || [];

        if (notes.length === 0) {
            if (list) list.innerHTML = '<p class="notes-empty">لا توجد ملاحظات بعد</p>';
            return;
        }

        if (!list) return;
        list.innerHTML = notes.map((note, idx) => {
            if (idx === this._editingIndex) {
                return `
                    <div class="note-item note-item--editing">
                        <span class="note-item__bullet">✏️</span>
                        <input type="text" id="noteEditInput-${idx}" class="form-input note-item__edit-input" value="${escapeHtml(note)}" data-note-index="${idx}" />
                        <button class="btn btn--success btn--icon btn--xs" data-action="confirm-edit-note" data-index="${idx}" title="حفظ"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>
                        <button class="btn btn--ghost btn--icon btn--xs" data-action="cancel-edit-note" title="إلغاء"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
                    </div>`;
            }
            return `
                <div class="note-item">
                    <span class="note-item__bullet">📌</span>
                    <span class="note-item__text">${escapeHtml(note)}</span>
                    <button class="btn btn--ghost btn--icon btn--xs" data-action="edit-spec-note" data-index="${idx}" title="تعديل"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                    <button class="btn btn--danger btn--icon btn--xs" data-action="delete-spec-note" data-index="${idx}" title="حذف"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                </div>`;
        }).join('');
    },
};