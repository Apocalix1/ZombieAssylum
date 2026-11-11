// mappa-campo-ui.js
// Mappa vista dal campo: mostra solo ciò che il campo conosce (nebbia sul resto).
// Funziona con mouse e touch (pan col dito, bottoni +/-).
//
// Uso:
//   apriMappaCampo()                              -> sola consultazione
//   apriMappaCampo({ selezione: true,             -> selezione fino a 3 edifici (per l'esplorazione)
//                    onSelezione: (lista) => {},  -> chiamata a ogni cambio selezione
//                    onConferma: (lista) => {} }) -> chiamata dal bottone "Conferma"

import { apiUrl, buildAuthHeaders } from '../logic/logic.js';
import { fetchCampiBase, getCampoBaseId } from '../logic/campo.js';
import { escapeHtml } from './common-ui.js';

const MAX_SELEZIONE = 3;
const TTL_TILE = 20000;

const CAT = {
  abitazione:     ['Abitazione', '#5d6b7a'],
  alimentari:     ['Alimentari / ristoranti', '#b5832f'],
  taverna:        ['Taverna', '#9a5a2c'],
  vestiti:        ['Vestiti / sartoria', '#a0537a'],
  parrucchiere:   ['Parrucchiere', '#b86f8e'],
  hotel:          ['Hotel', '#7a5aa0'],
  biblioteca:     ['Biblioteca / libreria', '#3f7a8a'],
  farmacia:       ['Farmacia', '#4f9a6a'],
  comp_alchemici: ['Componenti alchemici', '#6aa04f'],
  pozioni:        ['Pozioni', '#8a4fb0'],
  ospedale:       ['Ospedale / clinica', '#c0504d'],
  conservazione:  ['Conservazione', '#8a8f99'],
  armi:           ['Armi', '#8a3a3a'],
  artefatti:      ['Artefatti magici', '#4f6fd0'],
  forgia:         ['Forgia / officina', '#c06a2a'],
  palestra:       ['Palestra / dojo', '#a0a04a'],
  cimeli:         ['Cimeli / antiquariato', '#a08a5a'],
  animali:        ['Animali', '#7a9a4a']
};
const COL = { fog: '#050403', terreno: '#1d1913', strada: '#4a4743', parco: '#2f4a2b', ignoto: '#6b6358' };

const S = {
  config: null, campoId: null, campo: null,
  cell: 12, cx: 780, cy: 500,
  tiles: new Map(), inflight: new Map(), edIdx: new Map(),
  selezionato: null, selezione: new Map(),
  opts: {}, drag: null, timer: null, poll: null
};
let root, canvas, ctx, pannello;
const qs = () => S.personaggioId ? `personaggioId=${S.personaggioId}` : `campoBaseId=${S.campoId}`;
function nota(msg, tipo = 'info') {
  if (typeof window.mostraNotificaInAlto === 'function') window.mostraNotificaInAlto(msg, tipo);
}

// ---------- DOM ----------
function ensureRoot() {
  if (root) return;
  const stile = document.createElement('style');
  stile.textContent = `
    #mappa-campo-root { position:fixed; inset:0; z-index:5500; display:none; flex-direction:column; background:#0a0908; color:#d9cfc0; }
    #mappa-campo-root .mc-corpo { flex:1; min-height:0; display:flex; flex-direction:row; }
    #mappa-campo-root .mc-canvas-wrap { flex:1; min-width:0; position:relative; }
    #mappa-campo-root canvas { width:100%; height:100%; display:block; touch-action:none; }
    #mappa-campo-root .mc-pannello { width:300px; overflow-y:auto; padding:10px; border-left:1px solid #2e2116; background:#100d0a; font-size:0.85rem; }
    @media (max-width: 768px) {
      #mappa-campo-root .mc-corpo { flex-direction:column; }
      #mappa-campo-root .mc-pannello { width:auto; height:38%; border-left:none; border-top:1px solid #2e2116; }
    }`;
  document.head.appendChild(stile);

  root = document.createElement('div');
  root.id = 'mappa-campo-root';
  root.innerHTML = `
    <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; padding:8px; border-bottom:1px solid #2e2116; background:#15120e;">
      <button class="btn-hero" id="mc-chiudi">Chiudi</button>
      <button class="btn-hero" id="mc-meno">−</button>
      <button class="btn-hero" id="mc-piu">+</button>
      <button class="btn-hero" id="mc-centra">Centra sul campo</button>
      <span id="mc-info" style="color:#a39c8f; font-size:0.8rem;"></span>
    </div>
    <div class="mc-corpo">
      <div class="mc-canvas-wrap"><canvas id="mc-canvas"></canvas></div>
      <aside class="mc-pannello" id="mc-pannello"></aside>
    </div>`;
  document.body.appendChild(root);
  canvas = root.querySelector('#mc-canvas');
  ctx = canvas.getContext('2d');
  pannello = root.querySelector('#mc-pannello');

  root.querySelector('#mc-chiudi').addEventListener('click', chiudiMappaCampo);
  root.querySelector('#mc-piu').addEventListener('click', () => zoom(2));
  root.querySelector('#mc-meno').addEventListener('click', () => zoom(-2));
  root.querySelector('#mc-centra').addEventListener('click', centraSulCampo);

  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 2 : -2); }, { passive: false });
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    S.drag = { x: e.clientX, y: e.clientY, cx: S.cx, cy: S.cy, mosso: false };
  });
  canvas.addEventListener('pointermove', e => {
    if (!S.drag) return;
    const dx = e.clientX - S.drag.x, dy = e.clientY - S.drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) S.drag.mosso = true;
    if (!S.drag.mosso) return;
    S.cx = S.drag.cx - dx / S.cell;
    S.cy = S.drag.cy - dy / S.cell;
    limitaCentro();
    render();
    richiediTile();
  });
  canvas.addEventListener('pointerup', e => {
    const d = S.drag;
    S.drag = null;
    if (d && !d.mosso) clicca(e.offsetX, e.offsetY);
  });
  window.addEventListener('resize', () => { if (visibile()) ridimensiona(); });
}

const visibile = () => root && root.style.display !== 'none';

function ridimensiona() {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(r.width));
  canvas.height = Math.max(1, Math.floor(r.height));
  render();
  richiediTile();
}

// ---------- Viewport ----------
function limitaCentro() {
  S.cx = Math.max(0, Math.min(S.config.GRID_W, S.cx));
  S.cy = Math.max(0, Math.min(S.config.GRID_H, S.cy));
}

function viewport() {
  const cols = Math.max(1, Math.ceil(canvas.width / S.cell));
  const rows = Math.max(1, Math.ceil(canvas.height / S.cell));
  const startX = Math.floor(S.cx - cols / 2);
  const startY = Math.floor(S.cy - rows / 2);
  return { cols, rows, startX, startY, endX: startX + cols - 1, endY: startY + rows - 1 };
}

function schermoACasella(px, py) {
  const vp = viewport();
  return { x: Math.floor(vp.startX + px / S.cell), y: Math.floor(vp.startY + py / S.cell) };
}

function zoom(delta) {
  S.cell = Math.max(4, Math.min(40, S.cell + delta));
  render();
  richiediTile();
}

function centraSulCampo() {
  if (S.campo && Number.isInteger(S.campo.pos_x) && Number.isInteger(S.campo.pos_y)) {
    S.cx = S.campo.pos_x + 0.5;
    S.cy = S.campo.pos_y + 0.5;
  }
  limitaCentro();
  render();
  richiediTile();
}

// ---------- Rete ----------
function richiediTile() {
  clearTimeout(S.timer);
  S.timer = setTimeout(caricaTile, 120);
}

async function caricaTile() {
  if (!visibile() || !S.config) return;
  const T = S.config.TILE;
  const vp = viewport();
  const tx1 = Math.max(0, Math.floor(vp.startX / T)), ty1 = Math.max(0, Math.floor(vp.startY / T));
  const tx2 = Math.min(Math.floor((S.config.GRID_W - 1) / T), Math.floor(vp.endX / T));
  const ty2 = Math.min(Math.floor((S.config.GRID_H - 1) / T), Math.floor(vp.endY / T));
  const lavori = [];
  for (let ty = ty1; ty <= ty2; ty++) {
    for (let tx = tx1; tx <= tx2; tx++) {
      const k = `${tx}:${ty}`;
      const c = S.tiles.get(k);
      if (c && Date.now() - c.t < TTL_TILE) continue;
      if (S.inflight.has(k)) continue;
      lavori.push(scaricaTile(tx, ty, k));
    }
  }
  if (lavori.length) {
    await Promise.all(lavori);
    ricostruisciIndice();
    render();
  }
}

async function scaricaTile(tx, ty, k) {
  const T = S.config.TILE;
  const x = tx * T, y = ty * T;
  const w = Math.min(T, S.config.GRID_W - x), h = Math.min(T, S.config.GRID_H - y);
  const p = fetch(apiUrl(`/api/mappa/campo/tile?x=${x}&y=${y}&w=${w}&h=${h}&${qs()}`), { headers: buildAuthHeaders() })
    .then(async r => {
      const dati = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dati.error || `HTTP ${r.status}`);
      S.tiles.set(k, { t: Date.now(), dati: { zone: dati.zone || [], edifici: dati.edifici || [], known: dati.known || [] } });
      if (dati.campo) S.campo = dati.campo;
    })
    .catch(e => {
      S.tiles.set(k, { t: Date.now(), dati: { zone: [], edifici: [], known: [] } });
      root.querySelector('#mc-info').textContent = `Errore mappa: ${e.message}`;
    })
    .finally(() => S.inflight.delete(k));
  S.inflight.set(k, p);
  return p;
}

function ricostruisciIndice() {
  S.edIdx.clear();
  S.tiles.forEach(t => t.dati.edifici.forEach(e => S.edIdx.set(`${e.x}:${e.y}`, e)));
}

// ---------- Disegno ----------
function coloreEdificio(e) {
  const prima = (e.insegne && e.insegne[0]) || null;
  if (prima && CAT[prima]) return CAT[prima][1];
  return COL.ignoto;
}

function render() {
  if (!ctx || !S.config) return;
  const vp = viewport(), c = S.cell;
  const px = x => (x - vp.startX) * c, py = y => (y - vp.startY) * c;
  ctx.fillStyle = COL.fog;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tiles = [...S.tiles.values()].map(t => t.dati);

  ctx.fillStyle = COL.terreno;
  tiles.forEach(d => d.known.forEach(k => ctx.fillRect(px(k.x1), py(k.y1), (k.x2 - k.x1 + 1) * c, (k.y2 - k.y1 + 1) * c)));

  tiles.forEach(d => d.zone.forEach(z => {
    ctx.fillStyle = z.tipo === 'strada' ? COL.strada : COL.parco;
    ctx.fillRect(px(z.x1), py(z.y1), (z.x2 - z.x1 + 1) * c, (z.y2 - z.y1 + 1) * c);
  }));

  const gap = c >= 10 ? 1 : 0;
  tiles.forEach(d => d.edifici.forEach(e => {
    ctx.globalAlpha = e.esplorato_max >= 1 ? 1 : 0.7;
    ctx.fillStyle = coloreEdificio(e);
    ctx.fillRect(px(e.x) + gap / 2, py(e.y) + gap / 2, c - gap, c - gap);
    ctx.globalAlpha = 1;
    if (e.esplorato_max >= 1 && c >= 10) {
      ctx.fillStyle = '#7c9154';
      ctx.fillRect(px(e.x) + c - 4, py(e.y) + 1, 3, 3);
    }
  }));

  // Selezione multipla (esplorazione)
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#c98d2c';
  S.selezione.forEach(e => ctx.strokeRect(px(e.x) + 1, py(e.y) + 1, c - 2, c - 2));
  if (S.selezionato) {
    ctx.strokeStyle = '#ff4d4d';
    ctx.strokeRect(px(S.selezionato.x), py(S.selezionato.y), c, c);
  }

  // Marker del campo
  if (S.campo && Number.isInteger(S.campo.pos_x) && Number.isInteger(S.campo.pos_y)) {
    const mx = px(S.campo.pos_x + 0.5), my = py(S.campo.pos_y + 0.5);
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.moveTo(mx, my - 6); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 6); ctx.lineTo(mx - 6, my);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------- Interazione ----------
async function clicca(offX, offY) {
  const cella = schermoACasella(offX, offY);
  S.selezionato = cella;
  const e = S.edIdx.get(`${cella.x}:${cella.y}`);
  if (e && S.opts.selezione) alternaSelezione(e);
  render();
  if (e) await mostraDettaglio(e);
  else mostraPannelloBase(cella);
}

function alternaSelezione(e) {
  if (S.selezione.has(e.id)) S.selezione.delete(e.id);
  else if (S.selezione.size >= MAX_SELEZIONE) { nota(`Puoi selezionare al massimo ${MAX_SELEZIONE} edifici.`, 'avviso'); return; }
  else S.selezione.set(e.id, e);
  const lista = [...S.selezione.values()];
  if (typeof S.opts.onSelezione === 'function') S.opts.onSelezione(lista);
  document.dispatchEvent(new CustomEvent('mappa-campo-selezione', { detail: { edifici: lista } }));
}

function bloccoSelezione() {
  if (!S.opts.selezione) return '';
  const lista = [...S.selezione.values()];
  return `
    <div style="margin-top:12px; border-top:1px dashed #2e2116; padding-top:8px;">
      <strong style="color:#c98d2c;">Edifici selezionati (${lista.length}/${MAX_SELEZIONE})</strong>
      ${lista.map(e => `<div>• ${escapeHtml(e.nome)} <small style="color:#888;">(${e.x}:${e.y})</small></div>`).join('') || '<div style="color:#888;">Tocca un edificio per aggiungerlo.</div>'}
      <button class="btn-hero" id="mc-conferma" style="margin-top:8px; width:100%;" ${lista.length ? '' : 'disabled'}>Conferma</button>
    </div>`;
}

function agganciaConferma() {
  const b = pannello.querySelector('#mc-conferma');
  if (b) b.addEventListener('click', () => {
    if (typeof S.opts.onConferma === 'function') S.opts.onConferma([...S.selezione.values()]);
  });
}

function mostraPannelloBase(cella = null) {
  const legenda = Object.values(CAT).map(([nome, col]) =>
    `<div style="display:flex; align-items:center; gap:6px;"><span style="display:inline-block; width:10px; height:10px; background:${col};"></span>${escapeHtml(nome)}</div>`).join('');
  pannello.innerHTML = `
<h3 style="margin-bottom:6px;">${S.personaggioId
  ? `Mappa di ${escapeHtml(S.titolo)}`
  : `Mappa del campo${S.campo ? `: ${escapeHtml(S.campo.nome || '')}` : ''}`}</h3>
<p style="color:#a39c8f;">${S.personaggioId ? 'Vedi solo ciò che questo personaggio conosce.' : 'Vedi solo ciò che il tuo campo conosce.'} Trascina per muoverti.</p>
    <p style="color:#a39c8f;">Vedi solo ciò che il tuo campo conosce. Trascina per muoverti.</p>
    ${cella ? `<p style="margin-top:6px;">Casella ${cella.x}:${cella.y} — nessun edificio noto.</p>` : ''}
    <div style="margin-top:8px; display:grid; gap:2px; font-size:0.78rem;">
      <div style="display:flex; align-items:center; gap:6px;"><span style="display:inline-block; width:10px; height:10px; background:${COL.strada};"></span>Strada</div>
      <div style="display:flex; align-items:center; gap:6px;"><span style="display:inline-block; width:10px; height:10px; background:${COL.parco};"></span>Parco</div>
      ${legenda}
      <div style="color:#888; margin-top:4px;">Edificio più scuro = mai esplorato dentro.</div>
    </div>
    ${bloccoSelezione()}`;
  agganciaConferma();
}

async function mostraDettaglio(e) {
  pannello.innerHTML = '<p>Caricamento...</p>';
  try {
    const r = await fetch(apiUrl('/api/mappa/campo/edificio/${e.id}?${qs()}'),{ headers: buildAuthHeaders() });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Errore');
    const righe = d.piani.map(p => {
      const att = p.attivita === null
        ? '<span style="color:#888;">non visibile da fuori</span>'
        : (p.attivita.map(a => {
            const nome = (CAT[a.categoria] || [a.categoria])[0];
            return escapeHtml(nome + (a.qualita ? ` (${a.qualita})` : ''));
          }).join(', ') || '—');
      const grado = p.grado !== null ? ` — grado ${p.grado}%` : '';
      return `<div style="padding:4px 0; border-bottom:1px solid #1c1712;"><strong>Piano ${p.piano}</strong>${grado}<br>${att}</div>`;
    }).join('');
    pannello.innerHTML = `
      <h3>${escapeHtml(d.edificio.nome)}</h3>
      <div style="color:#a39c8f;">${escapeHtml(d.edificio.tipo)} • ${d.edificio.x}:${d.edificio.y} • ${d.piani.length} piani</div>
      <div style="margin-top:8px;">${righe}</div>
      ${bloccoSelezione()}`;
    agganciaConferma();
  } catch (err) {
    pannello.innerHTML = `<p style="color:#e74c3c;">${escapeHtml(err.message)}</p>`;
  }
}

// ---------- API pubblica ----------
export async function apriMappaCampo(opts = {}) {
  ensureRoot();
  S.opts = opts;
  S.personaggioId = opts.personaggioId || null;
  S.titolo = opts.titolo || '';
  S.selezione.clear();
  S.selezionato = null;
  S.campoId = opts.campoBaseId || getCampoBaseId();
  S.tiles.clear();
  S.edIdx.clear();

  if (!S.config) {
    const r = await fetch(apiUrl('/api/mappa/config'), { headers: buildAuthHeaders() });
    const d = await r.json();
    if (!r.ok) { nota(d.error || 'Impossibile caricare la mappa.', 'pericolo'); if (typeof opts.onChiudi === 'function') opts.onChiudi(); return; }
    S.config = d;
  }

  root.style.display = 'flex';
  root.querySelector('#mc-info').textContent = '';
  mostraPannelloBase();
  ridimensiona();

  try {
    const campi = await fetchCampiBase();
    const c = campi.find(x => x.id === S.campoId);
    if (c) { S.campo = c; centraSulCampo(); }
  } catch { /* resta il centro di default */ }

  clearInterval(S.poll);
  S.poll = setInterval(() => { if (visibile()) richiediTile(); }, TTL_TILE);
}

export function chiudiMappaCampo() {
  if (root) root.style.display = 'none';
  clearInterval(S.poll);
  S.poll = null;
  if (typeof S.opts.onChiudi === 'function') S.opts.onChiudi();
}

window.apriMappaPersonaggio = function(idx) {
  const p = window.party[idx];
  if (!p || !p.id) return nota('Personaggio non valido.', 'avviso');
  return apriMappaCampo({ personaggioId: p.id, titolo: p.nome });
};

window.apriMappaCampo = apriMappaCampo;
window.chiudiMappaCampo = chiudiMappaCampo;