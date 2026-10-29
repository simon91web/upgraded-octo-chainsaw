// Nachbau von createPageFab aus Yuvomis /utils/fab.js.
export function createPageFab({ id = 'page-fab', label = '', icon = 'plus', onClick, dockLabel = '' } = {}) {
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'page-fab';
  fab.id = id;
  if (label) fab.setAttribute('aria-label', label);
  if (dockLabel) fab.dataset.dockLabel = dockLabel;
  const glyph = document.createElement('i');
  glyph.dataset.lucide = icon;
  glyph.setAttribute('aria-hidden', 'true');
  fab.appendChild(glyph);
  if (onClick) fab.addEventListener('click', onClick);
  queueMicrotask(() => window.lucide?.createIcons({ icons: window.lucide.icons }));
  return fab;
}
