import { AppState } from '../state.js';
import { DB } from '../db.js';
import { Toast } from './toast.js';
import { Confirm } from './confirm.js';
import { Modal } from './modal.js';
import { Renderer } from './renderer.js';
import { getDefaultPaintColor } from '../utils.js';

export const Items = {
    _editTarget: null,

    _readItemForm(prefix = '') {
        const nameInput  = document.getElementById(prefix + 'itemNameInput')  || document.getElementById('editItemName');
        const qtyInput   = document.getElementById(prefix + 'itemQtyInput')   || document.getElementById('editItemQty');
        const unitInput  = document.getElementById(prefix + 'itemUnitSelect') || document.getElementById('editItemUnit');
        const priceInput = document.getElementById(prefix + 'itemPriceInput') || document.getElementById('editItemPrice');
        const paintCheck = document.getElementById(prefix + 'itemNeedsPaintInput') || document.getElementById('editItemNeedsPaint');
        const paintCost  = document.getElementById(prefix + 'itemPaintCostInput')  || document.getElementById('editItemPaintCost');
        const paintColor = document.getElementById(prefix + 'itemPaintColorInput') || document.getElementById('editItemPaintColor');

        const name      = nameInput?.value.trim() || '';
        const unit      = unitInput?.value || '';
        const qty       = parseFloat(qtyInput?.value)   || 0;
        const price     = parseFloat(priceInput?.value) || 0;
        const needsPaint = paintCheck?.checked || false;
        const paintCostPerUnit = needsPaint ? (parseFloat(paintCost?.value) || 0) : 0;
        const paintColorValue  = needsPaint ? (paintColor?.value || getDefaultPaintColor(AppState.current)) : '';

        if (!name) { Toast.show('يجب إدخال اسم المادة', 'error'); return null; }
        if (!unit) { Toast.show('يجب اختيار الوحدة',   'error'); return null; }

        return { name, qty, unit, price, needsPaint, paintCostPerUnit, paintColor: paintColorValue };
    },

    async add() {
        const stage = document.getElementById('itemStageSelect')?.value;
        if (!stage) return;
        const item = this._readItemForm('item');
        if (!item) return;

        AppState.current.items[stage].push(item);
        await DB.saveMaterial(item.name, item.price);
        this._clearAddForm();
        Renderer.renderItemsLists(AppState.current);
        Renderer.renderKPIs(AppState.current);
        Toast.show('تمت إضافة المادة');
    },

    openEditModal(stage, index) {
        const item = AppState.current.items[stage]?.[index];
        if (!item) return;
        this._editTarget = { stage, index };

        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
        setVal('editItemStage', stage);
        setVal('editItemIndex', index);
        setVal('editItemName', item.name);
        setVal('editItemQty', item.qty);
        setVal('editItemUnit', item.unit || '');
        setVal('editItemPrice', item.price);
        const paintCheck = document.getElementById('editItemNeedsPaint');
        if (paintCheck) paintCheck.checked = item.needsPaint || false;
        setVal('editItemPaintCost', item.paintCostPerUnit || 0);
        setVal('editItemPaintColor', item.paintColor || '');
        const paintFields = document.getElementById('editPaintFields');
        if (paintFields) paintFields.style.display = item.needsPaint ? 'block' : 'none';

        Modal.open('editItemModal');
    },

    async update() {
        if (!this._editTarget) { Toast.show('لا توجد مادة للتعديل', 'error'); return; }

        const { stage, index } = this._editTarget;

        const nameInput  = document.getElementById('editItemName');
        const qtyInput   = document.getElementById('editItemQty');
        const unitInput  = document.getElementById('editItemUnit');
        const priceInput = document.getElementById('editItemPrice');
        const paintCheck = document.getElementById('editItemNeedsPaint');
        const paintCost  = document.getElementById('editItemPaintCost');
        const paintColor = document.getElementById('editItemPaintColor');

        const name       = nameInput?.value.trim() || '';
        const unit       = unitInput?.value || '';
        if (!name) { Toast.show('يجب إدخال اسم المادة', 'error'); return; }
        if (!unit) { Toast.show('يجب اختيار الوحدة',   'error'); return; }

        const needsPaint       = paintCheck?.checked || false;
        const paintCostPerUnit = needsPaint ? (parseFloat(paintCost?.value) || 0) : 0;
        const paintColorValue  = needsPaint ? (paintColor?.value || getDefaultPaintColor(AppState.current)) : '';

        AppState.current.items[stage][index] = {
            name,
            qty:  parseFloat(qtyInput?.value)   || 0,
            unit,
            price: parseFloat(priceInput?.value) || 0,
            needsPaint,
            paintCostPerUnit,
            paintColor: paintColorValue,
        };

        await DB.saveMaterial(name, parseFloat(priceInput?.value) || 0);
        this._editTarget = null;
        Modal.closeAll();
        Renderer.renderItemsLists(AppState.current);
        Renderer.renderKPIs(AppState.current);
        Toast.show('تم تحديث المادة بنجاح');
    },

    async delete(stage, index) {
        const itemName = AppState.current.items[stage]?.[index]?.name;
        if (!itemName) return;
        const confirmed = await Confirm.show(`هل تريد حذف المادة "${itemName}"؟`, 'حذف المادة');
        if (!confirmed) return;

        AppState.current.items[stage].splice(index, 1);
        Renderer.renderItemsLists(AppState.current);
        Renderer.renderKPIs(AppState.current);
        Toast.show('تم حذف المادة');
    },

    _clearAddForm() {
        ['itemNameInput', 'itemQtyInput', 'itemPriceInput'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const unitSelect = document.getElementById('itemUnitSelect');
        if (unitSelect) unitSelect.value = '';
        const paintCheck = document.getElementById('itemNeedsPaintInput');
        if (paintCheck) paintCheck.checked = false;
        const paintCost = document.getElementById('itemPaintCostInput');
        if (paintCost) paintCost.value = '';
        const paintColor = document.getElementById('itemPaintColorInput');
        if (paintColor) paintColor.value = getDefaultPaintColor(AppState.current);
        const paintFields = document.getElementById('paintFields');
        if (paintFields) paintFields.style.display = 'none';
    },
};