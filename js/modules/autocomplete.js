import { DB } from '../db.js';
import { formatNumber } from '../utils.js';

export const Autocomplete = {
    active:        false,
    selectedIndex: -1,

    _reposition() {
        const input = document.getElementById('itemNameInput');
        const list  = document.getElementById('autocompleteList');
        if (!input || !list) return;

        const rect = input.getBoundingClientRect();
        list.style.top   = (rect.bottom + 4) + 'px';
        list.style.left  = rect.left + 'px';
        list.style.width = rect.width + 'px';
        const spaceBelow = window.innerHeight - rect.bottom;
        const listH      = Math.min(220, list.scrollHeight || 220);
        if (spaceBelow < listH + 8 && rect.top > listH + 8) {
            list.style.top    = (rect.top - listH - 4) + 'px';
            list.style.bottom = 'auto';
        }
    },

    async show(query) {
        const materials = await DB.searchMaterials(query);
        const list = document.getElementById('autocompleteList');
        if (!list) return;

        if (materials.length === 0) { this.hide(); return; }

        list.innerHTML = materials.map((m, i) => `
            <div class="autocomplete-item" role="option" data-index="${i}" data-name="${escapeHtml(m.name)}" data-price="${m.price}">
                <span class="autocomplete-item__name">${escapeHtml(m.name)}</span>
                <span class="autocomplete-item__price">${formatNumber(m.price)}</span>
            </div>
        `).join('');

        list.style.display = 'block';
        this._reposition();
        this.active        = true;
        this.selectedIndex = -1;
    },

    hide() {
        const list = document.getElementById('autocompleteList');
        if (!list) return;
        list.innerHTML = '';
        list.style.display = 'none';
        this.active = false;
        this.selectedIndex = -1;
    },

    select(item) {
        document.getElementById('itemNameInput').value = item.dataset.name;
        document.getElementById('itemPriceInput').value = parseFloat(item.dataset.price);
        this.hide();
    },

    navigate(direction) {
        if (!this.active) return;
        const items = document.querySelectorAll('.autocomplete-item');
        if (!items.length) return;

        items[this.selectedIndex]?.classList.remove('selected');
        this.selectedIndex = direction === 'down'
            ? Math.min(this.selectedIndex + 1, items.length - 1)
            : Math.max(this.selectedIndex - 1, 0);

        items[this.selectedIndex].classList.add('selected');
        items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
    },

    selectCurrent() {
        if (!this.active || this.selectedIndex < 0) return false;
        const item = document.querySelectorAll('.autocomplete-item')[this.selectedIndex];
        if (item) { this.select(item); return true; }
        return false;
    },
};

// Helper for escapeHtml
function escapeHtml(str) {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode(String(str || '')));
    return el.innerHTML;
}