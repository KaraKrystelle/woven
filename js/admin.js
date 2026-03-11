/**
 * Admin UI: define the 4 participant categories (countries, ethnic backgrounds,
 * good/bad experiences). Saved to localStorage; tablet reads via loadConfig().
 */

import { loadConfig, saveConfig, DEFAULT_CONFIG } from './state.js';

const KEYS = ['countries', 'ethnicBackgrounds', 'goodExperiences', 'badExperiences'];

function renderList(container, items, key) {
  if (!container) return;
  container.innerHTML = '';
  (items || []).forEach((label, i) => {
    const tag = document.createElement('span');
    tag.className = 'admin-tag';
    tag.textContent = label;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-tag__remove';
    remove.setAttribute('aria-label', 'Remove');
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      const config = loadConfig();
      const list = [...(config[key] || [])];
      list.splice(i, 1);
      saveConfig({ [key]: list });
      renderList(container, list, key);
    });
    tag.appendChild(remove);
    container.appendChild(tag);
  });
}

function addItem(key, inputEl) {
  const val = (inputEl?.value || '').trim();
  if (!val) return;
  const config = loadConfig();
  const list = [...(config[key] || []), val];
  saveConfig({ [key]: list });
  const listEl = document.getElementById(`${key}-list`);
  renderList(listEl, list, key);
  if (inputEl) inputEl.value = '';
}

function init() {
  const config = loadConfig();

  KEYS.forEach((key) => {
    const listEl = document.getElementById(`${key}-list`);
    const inputEl = document.getElementById(`${key}-input`);
    const btn = document.querySelector(`.admin-btn-add[data-key="${key}"]`);
    renderList(listEl, config[key] || [], key);

    const doAdd = () => addItem(key, inputEl);
    btn?.addEventListener('click', doAdd);
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doAdd();
      }
    });
  });
}

init();
