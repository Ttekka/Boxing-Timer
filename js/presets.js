// Feuille « Programmes » : programmes types + programmes enregistrés par l'utilisateur.

import { PRESETS, buildSegments, describeProgram, formatTime, totalDuration } from './program.js';
import { loadUserPresets, saveUserPresets } from './storage.js';

export function initPresets({ onPick, toast }) {
  const dialog = document.getElementById('presets');
  const body = document.getElementById('presets-body');
  let userPresets = loadUserPresets();

  function item(program, onDelete) {
    const row = document.createElement('div');
    row.className = 'preset';

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'preset-pick';
    const name = document.createElement('strong');
    name.textContent = program.name;
    const info = document.createElement('span');
    info.textContent = describeProgram(program);
    const total = document.createElement('span');
    total.className = 'preset-total';
    total.textContent = formatTime(totalDuration(buildSegments(program)));
    pick.append(name, info, total);
    pick.addEventListener('click', () => {
      const { id, ...chosen } = program;
      onPick(chosen);
      dialog.close();
    });
    row.append(pick);

    if (onDelete) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-btn small';
      remove.setAttribute('aria-label', `Supprimer « ${program.name} »`);
      remove.innerHTML = '<svg><use href="#i-trash"/></svg>';
      remove.addEventListener('click', onDelete);
      row.append(remove);
    }
    return row;
  }

  function section(title, children, emptyText) {
    const wrap = document.createElement('section');
    wrap.className = 'preset-group';
    const heading = document.createElement('h3');
    heading.textContent = title;
    wrap.append(heading);
    if (children.length) wrap.append(...children);
    else {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = emptyText;
      wrap.append(empty);
    }
    return wrap;
  }

  function render() {
    const mine = userPresets.map((p) => item(p, () => {
      if (!confirm(`Supprimer le programme « ${p.name} » ?`)) return;
      userPresets = userPresets.filter((x) => x.id !== p.id);
      saveUserPresets(userPresets);
      render();
    }));
    body.replaceChildren(
      section('Mes programmes', mine, 'Réglez un programme puis touchez « Enregistrer » dans les réglages pour le retrouver ici.'),
      section('Programmes types', PRESETS.map((p) => item(p))),
    );
  }

  for (const button of dialog.querySelectorAll('[data-close]')) button.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  return {
    open() {
      render();
      dialog.showModal();
    },
    save(program) {
      const existing = userPresets.find((p) => p.name.toLowerCase() === program.name.toLowerCase());
      if (existing) {
        if (!confirm(`Un programme « ${program.name} » existe déjà. Le remplacer ?`)) return;
        Object.assign(existing, program);
      } else {
        userPresets.push({ ...program, id: Date.now().toString(36) });
      }
      saveUserPresets(userPresets);
      toast(`« ${program.name} » enregistré dans vos programmes`);
    },
  };
}
