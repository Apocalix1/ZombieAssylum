export const DOCUMENTO_LINGUE = [
  'Verbum',
  'Yazyk',
  'Engenity',
  'Chrimil',
  'Ridulphi',
  'Antali',
  'Puleun',
  'Eklesti',
  'Meer'
];

export function escapeHtml(valore) {
  return String(valore ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}
