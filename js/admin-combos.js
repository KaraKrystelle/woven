/**
 * Admin screen: override thread colour per country + ethnic background pair (3b).
 */

import { initState, loadConfig, saveConfig, subscribeConfig } from './state.js';

const rowsEl = document.getElementById('combo-rows');
const addBtn = document.getElementById('addComboRow');
const emptyNote = document.getElementById('combo-empty-note');

function optionEl(value, label) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

function readRowsFromDom() {
  const rows = rowsEl?.querySelectorAll('.combo-row') || [];
  const out = [];
  rows.forEach((row) => {
    const country = row.querySelector('[data-field="country"]')?.value?.trim() || '';
    const ethnicBackground = row.querySelector('[data-field="ethnicBackground"]')?.value?.trim() || '';
    const color = row.querySelector('[data-field="color"]')?.value || '#888888';
    if (!country || !ethnicBackground) return;
    out.push({ country, ethnicBackground, color });
  });
  const seen = new Set();
  const deduped = [];
  for (let i = out.length - 1; i >= 0; i--) {
    const k = `${out[i].country}\0${out[i].ethnicBackground}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.unshift(out[i]);
  }
  return deduped;
}

function persist() {
  const comboColors = readRowsFromDom();
  saveConfig({ comboColors }).catch(() => {});
}

function renderRow(entry, countries, ethnicBackgrounds) {
  const row = document.createElement('div');
  row.className = 'combo-row';

  const countrySel = document.createElement('select');
  countrySel.className = 'combo-row__select admin-input';
  countrySel.dataset.field = 'country';
  countrySel.appendChild(optionEl('', 'Country…'));
  countries.forEach((c) => countrySel.appendChild(optionEl(c, c)));
  if (entry.country) countrySel.value = entry.country;

  const ethnicSel = document.createElement('select');
  ethnicSel.className = 'combo-row__select admin-input';
  ethnicSel.dataset.field = 'ethnicBackground';
  ethnicSel.appendChild(optionEl('', 'Ethnic background…'));
  ethnicBackgrounds.forEach((e) => ethnicSel.appendChild(optionEl(e, e)));
  if (entry.ethnicBackground) ethnicSel.value = entry.ethnicBackground;

  const colorIn = document.createElement('input');
  colorIn.type = 'color';
  colorIn.className = 'combo-row__color';
  colorIn.dataset.field = 'color';
  colorIn.value = /^#[0-9a-fA-F]{6}$/.test(entry.color) ? entry.color : '#888888';

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'admin-tag__remove combo-row__remove';
  remove.setAttribute('aria-label', 'Remove row');
  remove.textContent = '×';

  const onChange = () => persist();
  countrySel.addEventListener('change', onChange);
  ethnicSel.addEventListener('change', onChange);
  colorIn.addEventListener('input', onChange);
  remove.addEventListener('click', () => {
    row.remove();
    persist();
  });

  row.appendChild(countrySel);
  row.appendChild(ethnicSel);
  row.appendChild(colorIn);
  row.appendChild(remove);
  return row;
}

function render() {
  if (!rowsEl) return;
  const config = loadConfig();
  const countries = config.countries || [];
  const ethnicBackgrounds = config.ethnicBackgrounds || [];
  const list = config.comboColors || [];

  const canPick = countries.length > 0 && ethnicBackgrounds.length > 0;
  if (emptyNote) {
    emptyNote.hidden = canPick;
  }
  if (!canPick) {
    rowsEl.innerHTML = '';
    return;
  }

  rowsEl.innerHTML = '';
  const entries = list.length ? list : [];
  entries.forEach((e) => {
    rowsEl.appendChild(
      renderRow(
        {
          country: e.country || '',
          ethnicBackground: e.ethnicBackground || '',
          color: e.color || '#888888',
        },
        countries,
        ethnicBackgrounds
      )
    );
  });
}

function addEmptyRow() {
  const config = loadConfig();
  const countries = config.countries || [];
  const ethnicBackgrounds = config.ethnicBackgrounds || [];
  if (!countries.length || !ethnicBackgrounds.length) return;
  rowsEl.appendChild(
    renderRow({ country: '', ethnicBackground: '', color: '#c49bff' }, countries, ethnicBackgrounds)
  );
}

addBtn?.addEventListener('click', addEmptyRow);

async function init() {
  await initState();
  render();
  subscribeConfig(() => render());
}

init();
