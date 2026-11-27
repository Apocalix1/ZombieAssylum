import { apiUrl, buildAuthHeaders } from '../logic/logic.js';
import { escapeHtml } from './common-ui.js';
import { CAT } from './mappa-campo-ui.js';

const MAPPA_STATO = {
  config: null,
  quarterX: 0,
  quarterY: 0,
  centerX: 500,
  centerY: 500,
  cellSize: 16,
  selected: null,
  dragging: false,
  dragStart: null,
  shiftDragging: false,
  shiftDragStart: null,
  shiftDragEnd: null,
  tileCache: new Map(),
  inFlight: new Map(),
  visibleTiles: new Set(),
  fetchTimer: null,
  searchResults: []
};

function getQuarterMaxX() {
  const q = MAPPA_STATO.config?.QUARTIERE || 1000;
  const w = MAPPA_STATO.config?.GRID_W || 1000;
  return Math.max(0, Math.ceil(w / q) - 1);
}

function getQuarterMaxY() {
  const q = MAPPA_STATO.config?.QUARTIERE || 1000;
  const h = MAPPA_STATO.config?.GRID_H || 1000;
  return Math.max(0, Math.ceil(h / q) - 1);
}

const TILE_CACHE_MAX = 64;
const FETCH_DEBOUNCE_MS = 150;

let rootEl = null;
let canvas = null;
let ctx = null;
let sidePanel = null;

function tileKey(tx, ty) {
  return `${tx}:${ty}`;
}

function now() {
  return Date.now();
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getQuarterBounds() {
  const q = MAPPA_STATO.config.QUARTIERE;
  const xMin = MAPPA_STATO.quarterX * q;
  const yMin = MAPPA_STATO.quarterY * q;
  return {
    xMin,
    yMin,
    xMax: xMin + q - 1,
    yMax: yMin + q - 1
  };
}

function canUseCellSize(nextSize) {
  if (!canvas) return false;
  const cols = Math.floor(canvas.width / nextSize);
  const rows = Math.floor(canvas.height / nextSize);
  return cols <= 120 && rows <= 80;
}

function ensureRoot() {
  if (rootEl) return;
  rootEl = document.createElement('div');
  rootEl.id = 'mappa-editor-root';
  rootEl.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:6000',
    'display:none',
    'background:#0a0a0a',
    'color:#ddd'
  ].join(';');

  rootEl.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 340px; height:100%;">
      <div style="display:flex; flex-direction:column; min-width:0;">
        <div style="display:flex; gap:8px; align-items:center; padding:8px; border-bottom:1px solid #222; background:#121212;">
          <button id="mappa-close-btn" class="btn-hero">Chiudi</button>
          <button id="mappa-zoom-out" class="btn-hero">-</button>
          <button id="mappa-zoom-in" class="btn-hero">+</button>
          <span style="font-size:0.85rem; color:#999;">Zoom: <b id="mappa-zoom-value">16</b> px</span>
          <span style="margin-left:8px; font-size:0.85rem; color:#999;">Quartiere</span>
          <input id="mappa-qx" type="number" min="0" max="999" value="0" style="width:80px; background:#1f1f1f; color:#fff; border:1px solid #333; padding:4px;" />
          <input id="mappa-qy" type="number" min="0" max="999" value="0" style="width:80px; background:#1f1f1f; color:#fff; border:1px solid #333; padding:4px;" />
          <button id="mappa-go-quarter" class="btn-hero">Vai</button>
          <button id="mappa-prev-quarter" class="btn-hero">◀</button>
          <button id="mappa-next-quarter" class="btn-hero">▶</button>
          <button id="mappa-up-quarter" class="btn-hero">▲</button>
          <button id="mappa-down-quarter" class="btn-hero">▼</button>
          <input id="mappa-search" placeholder="Cerca casella: x:y:z o nome" style="margin-left:auto; min-width:260px; background:#1f1f1f; color:#fff; border:1px solid #333; padding:4px;" />
          <button id="mappa-search-btn" class="btn-hero">Cerca</button>
        </div>
        <div id="mappa-search-results" style="display:none; padding:8px; border-bottom:1px solid #222; max-height:120px; overflow:auto; background:#0f0f0f;"></div>
        <div style="position:relative; flex:1; min-height:0;">
          <canvas id="mappa-canvas" style="width:100%; height:100%; display:block;"></canvas>
        </div>
      </div>
      <aside id="mappa-side-panel" style="border-left:1px solid #222; background:#101010; padding:10px; overflow:auto;"></aside>
    </div>
  `;

  document.body.appendChild(rootEl);
  canvas = rootEl.querySelector('#mappa-canvas');
  ctx = canvas.getContext('2d');
  sidePanel = rootEl.querySelector('#mappa-side-panel');

  rootEl.querySelector('#mappa-close-btn').addEventListener('click', chiudiEditorMappa);
  rootEl.querySelector('#mappa-zoom-in').addEventListener('click', () => cambiaZoom(MAPPA_STATO.cellSize + 2));
  rootEl.querySelector('#mappa-zoom-out').addEventListener('click', () => cambiaZoom(MAPPA_STATO.cellSize - 2));
  rootEl.querySelector('#mappa-go-quarter').addEventListener('click', onGoQuarter);
  rootEl.querySelector('#mappa-prev-quarter').addEventListener('click', () => shiftQuarter('x', -1));
  rootEl.querySelector('#mappa-next-quarter').addEventListener('click', () => shiftQuarter('x', 1));
  rootEl.querySelector('#mappa-up-quarter').addEventListener('click', () => shiftQuarter('y', -1));
  rootEl.querySelector('#mappa-down-quarter').addEventListener('click', () => shiftQuarter('y', 1));
  rootEl.querySelector('#mappa-search-btn').addEventListener('click', onSearch);
  rootEl.querySelector('#mappa-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') onSearch();
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const next = event.deltaY < 0 ? MAPPA_STATO.cellSize + 2 : MAPPA_STATO.cellSize - 2;
    cambiaZoom(next);
  }, { passive: false });

  canvas.addEventListener('mousedown', onCanvasMouseDown);
  window.addEventListener('mousemove', onCanvasMouseMove);
  window.addEventListener('mouseup', onCanvasMouseUp);
  canvas.addEventListener('click', onCanvasClick);

  window.addEventListener('keydown', onKeyPan);
  window.addEventListener('resize', resizeCanvas);
}

function onKeyPan(event) {
  if (!rootEl || rootEl.style.display === 'none') return;
  const step = Math.max(1, Math.round(20 / MAPPA_STATO.cellSize));
  if (event.key === 'ArrowLeft') MAPPA_STATO.centerX -= step;
  if (event.key === 'ArrowRight') MAPPA_STATO.centerX += step;
  if (event.key === 'ArrowUp') MAPPA_STATO.centerY -= step;
  if (event.key === 'ArrowDown') MAPPA_STATO.centerY += step;
  clampCenterToQuarter();
  requestVisibleTiles();
  render();
}

function onCanvasMouseDown(event) {
  if (!canvas) return;
  if (event.shiftKey) {
    MAPPA_STATO.shiftDragging = true;
    MAPPA_STATO.shiftDragStart = screenToCell(event.offsetX, event.offsetY);
    MAPPA_STATO.shiftDragEnd = MAPPA_STATO.shiftDragStart;
    render();
    return;
  }
  MAPPA_STATO.dragging = true;
  MAPPA_STATO.dragStart = { x: event.clientX, y: event.clientY, cx: MAPPA_STATO.centerX, cy: MAPPA_STATO.centerY };
}

function onCanvasMouseMove(event) {
  if (MAPPA_STATO.dragging && MAPPA_STATO.dragStart) {
    const dxPx = event.clientX - MAPPA_STATO.dragStart.x;
    const dyPx = event.clientY - MAPPA_STATO.dragStart.y;
    const dxCell = dxPx / MAPPA_STATO.cellSize;
    const dyCell = dyPx / MAPPA_STATO.cellSize;
    MAPPA_STATO.centerX = MAPPA_STATO.dragStart.cx - dxCell;
    MAPPA_STATO.centerY = MAPPA_STATO.dragStart.cy - dyCell;
    clampCenterToQuarter();
    requestVisibleTiles();
    render();
  }
  if (MAPPA_STATO.shiftDragging) {
    const rect = canvas.getBoundingClientRect();
    MAPPA_STATO.shiftDragEnd = screenToCell(event.clientX - rect.left, event.clientY - rect.top);
    render();
  }
}

function onCanvasMouseUp() {
  if (MAPPA_STATO.shiftDragging && MAPPA_STATO.shiftDragStart && MAPPA_STATO.shiftDragEnd) {
    const a = MAPPA_STATO.shiftDragStart;
    const b = MAPPA_STATO.shiftDragEnd;
    MAPPA_STATO.shiftDragging = false;
    apriFormCreaZona({
      x1: Math.min(a.x, b.x),
      y1: Math.min(a.y, b.y),
      x2: Math.max(a.x, b.x),
      y2: Math.max(a.y, b.y)
    });
  }
  MAPPA_STATO.dragging = false;
  MAPPA_STATO.dragStart = null;
}

async function onCanvasClick(event) {
  if (MAPPA_STATO.shiftDragStart) {
    MAPPA_STATO.shiftDragStart = null;
    MAPPA_STATO.shiftDragEnd = null;
    return;
  }
  const selected = screenToCell(event.offsetX, event.offsetY);
  MAPPA_STATO.selected = selected;
  render();
  await loadSelectionDetails(selected);
}

function onGoQuarter() {
  const qxInput = rootEl.querySelector('#mappa-qx');
  const qyInput = rootEl.querySelector('#mappa-qy');
  const qx = clamp(Number.parseInt(qxInput.value, 10) || 0, 0, getQuarterMaxX());
  const qy = clamp(Number.parseInt(qyInput.value, 10) || 0, 0, getQuarterMaxY());
  MAPPA_STATO.quarterX = qx;
  MAPPA_STATO.quarterY = qy;
  const q = MAPPA_STATO.config.QUARTIERE;
  MAPPA_STATO.centerX = qx * q + Math.floor(q / 2);
  MAPPA_STATO.centerY = qy * q + Math.floor(q / 2);
  MAPPA_STATO.selected = null;
  clampCenterToQuarter();
  requestVisibleTiles();
  render();
  renderSidePanel();
}

function shiftQuarter(axis, delta) {
  if (axis === 'x') {
    MAPPA_STATO.quarterX = clamp(MAPPA_STATO.quarterX + delta, 0, getQuarterMaxX());
  } else {
    MAPPA_STATO.quarterY = clamp(MAPPA_STATO.quarterY + delta, 0, getQuarterMaxY());
  }
  rootEl.querySelector('#mappa-qx').value = String(MAPPA_STATO.quarterX);
  rootEl.querySelector('#mappa-qy').value = String(MAPPA_STATO.quarterY);
  onGoQuarter();
}

function cambiaZoom(next) {
  const min = 8;
  const max = 48;
  const size = clamp(next, min, max);
  if (!canUseCellSize(size)) return;
  MAPPA_STATO.cellSize = size;
  rootEl.querySelector('#mappa-zoom-value').textContent = String(size);
  clampCenterToQuarter();
  requestVisibleTiles();
  render();
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);
  if (!canUseCellSize(MAPPA_STATO.cellSize)) {
    MAPPA_STATO.cellSize = Math.max(8, MAPPA_STATO.cellSize + 2);
  }
  requestVisibleTiles();
  render();
}

function clampCenterToQuarter() {
  const bounds = getQuarterBounds();
  const halfCols = Math.max(1, Math.floor((canvas.width / MAPPA_STATO.cellSize) / 2));
  const halfRows = Math.max(1, Math.floor((canvas.height / MAPPA_STATO.cellSize) / 2));
  MAPPA_STATO.centerX = clamp(MAPPA_STATO.centerX, bounds.xMin + halfCols, bounds.xMax - halfCols);
  MAPPA_STATO.centerY = clamp(MAPPA_STATO.centerY, bounds.yMin + halfRows, bounds.yMax - halfRows);
}

function getViewport() {
  const cols = Math.max(1, Math.floor(canvas.width / MAPPA_STATO.cellSize));
  const rows = Math.max(1, Math.floor(canvas.height / MAPPA_STATO.cellSize));
  const startX = Math.floor(MAPPA_STATO.centerX - cols / 2);
  const startY = Math.floor(MAPPA_STATO.centerY - rows / 2);
  return {
    cols,
    rows,
    startX,
    startY,
    endX: startX + cols - 1,
    endY: startY + rows - 1
  };
}

function screenToCell(px, py) {
  const viewport = getViewport();
  return {
    x: Math.floor(viewport.startX + (px / MAPPA_STATO.cellSize)),
    y: Math.floor(viewport.startY + (py / MAPPA_STATO.cellSize))
  };
}

function requestVisibleTiles() {
  if (MAPPA_STATO.fetchTimer) {
    clearTimeout(MAPPA_STATO.fetchTimer);
  }
  MAPPA_STATO.fetchTimer = setTimeout(async () => {
    const viewport = getViewport();
    const tileSize = MAPPA_STATO.config.TILE;
    const tx1 = Math.floor(viewport.startX / tileSize);
    const ty1 = Math.floor(viewport.startY / tileSize);
    const tx2 = Math.floor(viewport.endX / tileSize);
    const ty2 = Math.floor(viewport.endY / tileSize);

    const wanted = [];
    for (let ty = ty1; ty <= ty2; ty += 1) {
      for (let tx = tx1; tx <= tx2; tx += 1) {
        const key = tileKey(tx, ty);
        wanted.push({ tx, ty, key });
      }
    }

    await Promise.all(wanted.map(item => ensureTile(item.tx, item.ty, item.key)));
    MAPPA_STATO.visibleTiles = new Set(wanted.map(w => w.key));
    render();
  }, FETCH_DEBOUNCE_MS);
}

async function ensureTile(tx, ty, key) {
  if (MAPPA_STATO.tileCache.has(key)) {
    const val = MAPPA_STATO.tileCache.get(key);
    val.lastUsed = now();
    return val;
  }
  if (MAPPA_STATO.inFlight.has(key)) {
    return MAPPA_STATO.inFlight.get(key);
  }

  const tileSize = MAPPA_STATO.config.TILE;
  const x = tx * tileSize;
  const y = ty * tileSize;
  const w = Math.min(tileSize, MAPPA_STATO.config.GRID_W - x);
  const h = Math.min(tileSize, MAPPA_STATO.config.GRID_H - y);

  const promise = fetch(apiUrl(`/api/mappa/tile?x=${x}&y=${y}&w=${w}&h=${h}`), {
    headers: buildAuthHeaders()
  })
    .then(r => r.json())
    .then(data => {
      const wrapped = { ...data, tx, ty, lastUsed: now() };
      MAPPA_STATO.tileCache.set(key, wrapped);
      pruneCache();
      return wrapped;
    })
    .finally(() => {
      MAPPA_STATO.inFlight.delete(key);
    });

  MAPPA_STATO.inFlight.set(key, promise);
  return promise;
}

function pruneCache() {
  if (MAPPA_STATO.tileCache.size <= TILE_CACHE_MAX) return;
  const entries = [...MAPPA_STATO.tileCache.entries()];
  entries.sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));
  while (entries.length && MAPPA_STATO.tileCache.size > TILE_CACHE_MAX) {
    const [key] = entries.shift();
    MAPPA_STATO.tileCache.delete(key);
  }
}

function invalidateTilesForRect(x1, y1, x2, y2) {
  const tile = MAPPA_STATO.config.TILE;
  const tx1 = Math.floor(x1 / tile);
  const ty1 = Math.floor(y1 / tile);
  const tx2 = Math.floor(x2 / tile);
  const ty2 = Math.floor(y2 / tile);
  for (let ty = ty1; ty <= ty2; ty += 1) {
    for (let tx = tx1; tx <= tx2; tx += 1) {
      MAPPA_STATO.tileCache.delete(tileKey(tx, ty));
    }
  }
}

function render() {
  if (!ctx || !canvas || !MAPPA_STATO.config) return;
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const viewport = getViewport();
  const cell = MAPPA_STATO.cellSize;
  const tiles = [...MAPPA_STATO.tileCache.values()];

  for (const data of tiles) {
    drawTile(data, viewport, cell);
  }

  if (cell >= 16) {
    drawGrid(viewport, cell);
  }
  drawSelection(viewport, cell);
  drawShiftRect(viewport, cell);
}

function drawTile(data, viewport, cell) {
  const { zone = [], edifici = [], campi = [] } = data;

  for (const z of zone) {
    const left = (z.x1 - viewport.startX) * cell;
    const top = (z.y1 - viewport.startY) * cell;
    const width = (z.x2 - z.x1 + 1) * cell;
    const height = (z.y2 - z.y1 + 1) * cell;
    ctx.fillStyle = z.tipo === 'strada' ? '#5f5f5f' : '#2d6d38';
    ctx.fillRect(left, top, width, height);
  }

    for (const e of edifici) {
    const left = (e.x - viewport.startX) * cell;
    const top = (e.y - viewport.startY) * cell;
    const w = (e.w || 1) * cell, h = (e.h || 1) * cell;
    const espl = Number(e.esplorato_max || 0);
    ctx.globalAlpha = espl === 0 ? 0.75 : 1;
    ctx.fillStyle = (CAT[e.insegna] && CAT[e.insegna][1]) || '#6b6358';
    ctx.fillRect(left + 1, top + 1, w - 2, h - 2);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = espl >= 2 ? '#8fcf6a' : (espl === 1 ? '#bfa226' : 'rgba(0,0,0,0.6)');
    ctx.strokeRect(left + 1.5, top + 1.5, w - 3, h - 3);
    if (cell >= 14) {
      ctx.save();
      ctx.beginPath(); ctx.rect(left + 1, top + 1, w - 2, h - 2); ctx.clip();
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(`${e.num_piani || 1}p`, left + 3, top + 3);
      if (cell >= 28) ctx.fillText(e.nome || '', left + 3, top + 15);
      ctx.restore();
    }
  }

  for (const c of campi) {
    if (!Number.isInteger(c.pos_x) || !Number.isInteger(c.pos_y)) continue;
    const cx = (c.pos_x - viewport.startX + 0.5) * cell;
    const cy = (c.pos_y - viewport.startY + 0.5) * cell;
    const radius = (Number(c.raggio || 0)) * cell;
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f39c12';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
  }
}

function drawGrid(viewport, cell) {
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= viewport.cols; i += 1) {
    const x = i * cell;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let j = 0; j <= viewport.rows; j += 1) {
    const y = j * cell;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawSelection(viewport, cell) {
  if (!MAPPA_STATO.selected) return;
  const x = (MAPPA_STATO.selected.x - viewport.startX) * cell;
  const y = (MAPPA_STATO.selected.y - viewport.startY) * cell;
  ctx.strokeStyle = '#ff4d4d';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, cell, cell);
}

function drawShiftRect(viewport, cell) {
  if (!MAPPA_STATO.shiftDragStart || !MAPPA_STATO.shiftDragEnd) return;
  const x1 = Math.min(MAPPA_STATO.shiftDragStart.x, MAPPA_STATO.shiftDragEnd.x);
  const y1 = Math.min(MAPPA_STATO.shiftDragStart.y, MAPPA_STATO.shiftDragEnd.y);
  const x2 = Math.max(MAPPA_STATO.shiftDragStart.x, MAPPA_STATO.shiftDragEnd.x);
  const y2 = Math.max(MAPPA_STATO.shiftDragStart.y, MAPPA_STATO.shiftDragEnd.y);
  const px = (x1 - viewport.startX) * cell;
  const py = (y1 - viewport.startY) * cell;
  const w = (x2 - x1 + 1) * cell;
  const h = (y2 - y1 + 1) * cell;
  ctx.fillStyle = 'rgba(255, 200, 0, 0.15)';
  ctx.fillRect(px, py, w, h);
  ctx.strokeStyle = '#f1c40f';
  ctx.strokeRect(px, py, w, h);
}

async function loadSelectionDetails(selected) {
  sidePanel.innerHTML = '<p>Caricamento...</p>';
  try {
    const result = await fetch(apiUrl(`/api/mappa/cerca?q=${selected.x}:${selected.y}`), { headers: buildAuthHeaders() }).then(r => r.json());
    const edificio = (result.risultati || []).find(r => r.tipo === 'edificio');
    const zona = (result.risultati || []).find(r => r.tipo === 'zona');

    if (edificio) {
      const details = await fetch(apiUrl(`/api/mappa/edificio/${edificio.id}`), { headers: buildAuthHeaders() }).then(r => r.json());
      renderEdificioPanel(details.edificio, details.piani || []);
      return;
    }
    if (zona) {
      renderZonaPanel(zona);
      return;
    }
    renderEmptyCellPanel(selected);
  } catch (error) {
    sidePanel.innerHTML = `<p style="color:#e74c3c;">Errore: ${escapeHtml(error.message)}</p>`;
  }
}

function renderSidePanel() {
  if (!MAPPA_STATO.selected) {
    sidePanel.innerHTML = '<h3>Editor mappa</h3><p>Clicca una casella oppure usa Shift+drag per creare una zona.</p>';
    return;
  }
  loadSelectionDetails(MAPPA_STATO.selected);
}

function renderZonaPanel(zona) {
  sidePanel.innerHTML = `
    <h3>Zona #${zona.id}</h3>
    <div style="display:grid; gap:8px;">
      <label>Nome <input id="zona-nome" value="${escapeHtml(zona.nome || '')}" style="width:100%;" /></label>
      <label>Tipo
        <select id="zona-tipo"><option value="parco" ${zona.tipo === 'parco' ? 'selected' : ''}>parco</option><option value="strada" ${zona.tipo === 'strada' ? 'selected' : ''}>strada</option></select>
      </label>
      <label>Esplorazione
        <select id="zona-esplorato">
          <option value="0" ${Number(zona.esplorato) === 0 ? 'selected' : ''}>0</option>
          <option value="1" ${Number(zona.esplorato) === 1 ? 'selected' : ''}>1</option>
          <option value="2" ${Number(zona.esplorato) === 2 ? 'selected' : ''}>2</option>
        </select>
      </label>
      <label>x1 <input id="zona-x1" type="number" value="${zona.x1}" /></label>
      <label>y1 <input id="zona-y1" type="number" value="${zona.y1}" /></label>
      <label>x2 <input id="zona-x2" type="number" value="${zona.x2}" /></label>
      <label>y2 <input id="zona-y2" type="number" value="${zona.y2}" /></label>
      <button id="zona-save" class="btn-hero">Salva</button>
      <button id="zona-delete" class="btn-hero" style="background:#c0392b;">Elimina</button>
    </div>
  `;

  sidePanel.querySelector('#zona-save').addEventListener('click', async () => {
    const payload = {
      nome: sidePanel.querySelector('#zona-nome').value.trim() || null,
      tipo: sidePanel.querySelector('#zona-tipo').value,
      esplorato: Number(sidePanel.querySelector('#zona-esplorato').value),
      x1: Number(sidePanel.querySelector('#zona-x1').value),
      y1: Number(sidePanel.querySelector('#zona-y1').value),
      x2: Number(sidePanel.querySelector('#zona-x2').value),
      y2: Number(sidePanel.querySelector('#zona-y2').value)
    };
    const r = await fetch(apiUrl(`/api/mappa/zone/${zona.id}`), {
      method: 'PUT',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) return alert(data.error || 'Errore salvataggio zona');
    invalidateTilesForRect(payload.x1, payload.y1, payload.x2, payload.y2);
    requestVisibleTiles();
    render();
    renderZonaPanel(data.zona);
  });

  sidePanel.querySelector('#zona-delete').addEventListener('click', async () => {
    if (!confirm('Eliminare questa zona?')) return;
    const r = await fetch(apiUrl(`/api/mappa/zone/${zona.id}`), {
      method: 'DELETE',
      headers: buildAuthHeaders()
    });
    const data = await r.json();
    if (!r.ok) return alert(data.error || 'Errore eliminazione zona');
    invalidateTilesForRect(zona.x1, zona.y1, zona.x2, zona.y2);
    requestVisibleTiles();
    MAPPA_STATO.selected = null;
    render();
    renderSidePanel();
  });
}

function apriFormCreaZona(rect) {
  sidePanel.innerHTML = `
    <h3>Crea zona</h3>
    <p>Rettangolo: ${rect.x1}:${rect.y1} -> ${rect.x2}:${rect.y2}</p>
    <div style="display:grid; gap:8px;">
      <label>Nome <input id="new-zona-nome" /></label>
      <label>Tipo
        <select id="new-zona-tipo"><option value="parco">parco</option><option value="strada">strada</option></select>
      </label>
      <label>Esplorazione
        <select id="new-zona-espl"><option value="0">0</option><option value="1">1</option><option value="2">2</option></select>
      </label>
      <button id="new-zona-create" class="btn-hero">Crea zona</button>
      <button id="new-zona-cancel" class="btn-hero">Annulla</button>
    </div>
  `;

  sidePanel.querySelector('#new-zona-create').addEventListener('click', async () => {
    const nome = sidePanel.querySelector('#new-zona-nome').value.trim();
    const tipo = sidePanel.querySelector('#new-zona-tipo').value;
    const esplorato = Number(sidePanel.querySelector('#new-zona-espl').value);
    const r = await fetch(apiUrl('/api/mappa/zone'), {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...rect, nome: nome || null, tipo, esplorato })
    });
    const data = await r.json();
    if (!r.ok) return alert(data.error || 'Errore creazione zona');
    invalidateTilesForRect(rect.x1, rect.y1, rect.x2, rect.y2);
    requestVisibleTiles();
    render();
    renderZonaPanel(data.zona);
  });

  sidePanel.querySelector('#new-zona-cancel').addEventListener('click', renderSidePanel);
}

async function onSearch() {
  const input = rootEl.querySelector('#mappa-search');
  const value = input.value.trim();
  if (!value) return;

  const output = rootEl.querySelector('#mappa-search-results');
  output.style.display = 'block';
  output.innerHTML = '<p>Ricerca...</p>';

  const coordMatch = /^\d+:\d+(?::\d+)?$/.test(value);
  if (coordMatch) {
    const [xRaw, yRaw] = value.split(':');
    const x = Number.parseInt(xRaw, 10);
    const y = Number.parseInt(yRaw, 10);
    centerTo(x, y);
    MAPPA_STATO.selected = { x, y };
    render();
    await loadSelectionDetails(MAPPA_STATO.selected);
    output.innerHTML = `<button class="btn-hero" id="goto-selected">Selezionato ${x}:${y}</button>`;
    return;
  }

  const r = await fetch(apiUrl(`/api/mappa/cerca?q=${encodeURIComponent(value)}`), { headers: buildAuthHeaders() });
  const data = await r.json();
  if (!r.ok) {
    output.innerHTML = `<p style="color:#e74c3c;">${escapeHtml(data.error || 'Errore ricerca')}</p>`;
    return;
  }
  const list = data.risultati || [];
  if (!list.length) {
    output.innerHTML = '<p>Nessun risultato.</p>';
    return;
  }

  output.innerHTML = list.map((item, idx) => {
    const label = item.tipo === 'edificio'
      ? `${escapeHtml(item.nome || `Edificio #${item.id}`)} (${item.x}:${item.y})`
      : `${escapeHtml(item.nome || `${item.tipo} #${item.id}`)} (${item.x1}:${item.y1} -> ${item.x2}:${item.y2})`;
    return `<button class="btn-hero mappa-result" data-idx="${idx}" style="display:block; width:100%; margin-bottom:6px; text-align:left;">${label}</button>`;
  }).join('');

  output.querySelectorAll('.mappa-result').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = list[Number(btn.dataset.idx)];
      if (item.tipo === 'edificio') {
        centerTo(item.x, item.y);
        MAPPA_STATO.selected = { x: item.x, y: item.y };
        render();
        loadSelectionDetails(MAPPA_STATO.selected);
      } else {
        const cx = Math.floor((item.x1 + item.x2) / 2);
        const cy = Math.floor((item.y1 + item.y2) / 2);
        centerTo(cx, cy);
        MAPPA_STATO.selected = { x: cx, y: cy };
        render();
        loadSelectionDetails(MAPPA_STATO.selected);
      }
    });
  });
}

function centerTo(x, y) {
  const q = MAPPA_STATO.config.QUARTIERE;
  MAPPA_STATO.quarterX = clamp(Math.floor(x / q), 0, getQuarterMaxX());
  MAPPA_STATO.quarterY = clamp(Math.floor(y / q), 0, getQuarterMaxY());
  rootEl.querySelector('#mappa-qx').value = String(MAPPA_STATO.quarterX);
  rootEl.querySelector('#mappa-qy').value = String(MAPPA_STATO.quarterY);
  MAPPA_STATO.centerX = x;
  MAPPA_STATO.centerY = y;
  clampCenterToQuarter();
  requestVisibleTiles();
}

export async function apriEditorMappa() {
  ensureRoot();
  if (!MAPPA_STATO.config) {
    const r = await fetch(apiUrl('/api/mappa/config'), { headers: buildAuthHeaders() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Impossibile caricare configurazione mappa');
    MAPPA_STATO.config = data;
  }

  rootEl.style.display = 'block';
  const qxInput = rootEl.querySelector('#mappa-qx');
  const qyInput = rootEl.querySelector('#mappa-qy');
  if (qxInput) qxInput.max = String(getQuarterMaxX());
  if (qyInput) qyInput.max = String(getQuarterMaxY());
  rootEl.querySelector('#mappa-qx').value = String(MAPPA_STATO.quarterX);
  rootEl.querySelector('#mappa-qy').value = String(MAPPA_STATO.quarterY);
  rootEl.querySelector('#mappa-zoom-value').textContent = String(MAPPA_STATO.cellSize);
  resizeCanvas();
  requestVisibleTiles();
  renderSidePanel();
}

export function chiudiEditorMappa() {
  if (!rootEl) return;
  rootEl.style.display = 'none';
}

// ---------- Utilità ----------
function aggiornaTutto() {
  MAPPA_STATO.tileCache.clear();
  requestVisibleTiles();
  render();
}

function trovaCampoIn(x, y) {
  for (const t of MAPPA_STATO.tileCache.values()) {
    const c = (t.campi || []).find(k => k.pos_x === x && k.pos_y === y);
    if (c) return c;
  }
  return null;
}

async function inviaJson(url, metodo, corpo) {
  const r = await fetch(apiUrl(url), { method: metodo, headers: buildAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(corpo) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Errore (HTTP ${r.status})`);
  return d;
}

// ---------- Editor edificio (creazione e modifica) ----------
const TIPI_EDIFICIO_UI = [
  ['appartamenti', 'Appartamenti (solo abitazioni)'],
  ['commerciale', "Commerciale (ogni piano un'attività)"],
  ['misto', 'Misto (attività e abitazioni)']
];
const ESPLORAZIONE_UI = ['0 - Ignoto', '1 - Parziale', '2 - Esplorato'];
const QUALITA_UI = ['bassa', 'media', 'alta'];

const categorie = () => MAPPA_STATO.config.CATEGORIE || [];
const categoriaDef = k => categorie().find(c => c.chiave === k);

function pianoVuoto(tipo) {
  return {
    categoria: tipo === 'appartamenti' ? '' : (categorie()[0]?.chiave || ''),
    qualita: '', abitazioni: tipo === 'appartamenti' ? 1 : 0, esplorato: 0, grado: '', loot_json: '{}'
  };
}

function normalizzaForm(f) {
  f.piani.forEach(p => {
    if (f.tipo === 'appartamenti') { p.categoria = ''; p.qualita = ''; if (!(p.abitazioni > 0)) p.abitazioni = 1; }
    if (f.tipo === 'commerciale') { p.abitazioni = 0; if (!p.categoria) p.categoria = categorie()[0]?.chiave || ''; }
    if (p.categoria && !categoriaDef(p.categoria)?.qualita) p.qualita = '';
  });
}

function formDaServer(ed, piani) {
  return {
    nome: ed.nome || '', tipo: ed.tipo, x: ed.x, y: ed.y, w: ed.w || 1, h: ed.h || 1,
    piani: piani.map(p => {
      const att = (p.attivita || []).find(a => a.categoria !== 'abitazione');
      return {
        categoria: att ? att.categoria : '', qualita: att?.qualita || '',
        abitazioni: (p.attivita || []).filter(a => a.categoria === 'abitazione').length,
        esplorato: Number(p.esplorato) || 0, grado: p.grado ?? '', loot_json: p.loot_json || '{}'
      };
    })
  };
}

function payloadEdificio(f) {
  return {
    nome: f.nome || null, tipo: f.tipo, x: f.x, y: f.y, w: f.w, h: f.h,
    piani: f.piani.map(p => {
      const attivita = [];
      if (p.categoria) attivita.push({ categoria: p.categoria, qualita: p.qualita || null });
      for (let k = 0; k < (p.abitazioni || 0); k += 1) attivita.push({ categoria: 'abitazione', qualita: null });
      return { esplorato: p.esplorato, grado: p.grado === '' ? null : p.grado, loot_json: p.loot_json || '{}', attivita };
    })
  };
}

function renderFormEdificio(f, opz) {
  normalizzaForm(f);
  const pianiHtml = f.piani.map((p, i) => {
    const haQ = !!categoriaDef(p.categoria)?.qualita;
    return `
      <div style="border:1px solid #2a2a2a; padding:6px; margin-bottom:6px; display:grid; gap:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>Piano ${i + 1}</strong>
          <button class="btn-hero js-piano-del" data-i="${i}" style="background:#7f1d1d;">-</button>
        </div>
        <label>Attività
          <select class="js-p" data-i="${i}" data-k="categoria" ${f.tipo === 'appartamenti' ? 'disabled' : ''}>
            ${f.tipo === 'commerciale' ? '' : '<option value="">— nessuna —</option>'}
            ${categorie().map(c => `<option value="${c.chiave}" ${c.chiave === p.categoria ? 'selected' : ''}>${escapeHtml(c.nome)}</option>`).join('')}
          </select>
        </label>
        ${haQ ? `<label>Qualità <select class="js-p" data-i="${i}" data-k="qualita">${QUALITA_UI.map(q => `<option value="${q}" ${q === p.qualita ? 'selected' : ''}>${q}</option>`).join('')}</select></label>` : ''}
        <label>Abitazioni <input class="js-p" type="number" min="0" data-i="${i}" data-k="abitazioni" value="${p.abitazioni}" ${f.tipo === 'commerciale' ? 'disabled' : ''}></label>
        <label>Esplorazione <select class="js-p" data-i="${i}" data-k="esplorato">${ESPLORAZIONE_UI.map((t, n) => `<option value="${n}" ${n === Number(p.esplorato) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Grado % <input class="js-p" type="number" min="0" max="100" data-i="${i}" data-k="grado" value="${p.grado}" placeholder="auto"></label>
      </div>`;
  }).join('');

  sidePanel.innerHTML = `
    <h3>${escapeHtml(opz.titolo)}</h3>
    <div style="display:grid; gap:8px;">
      <label>Nome <input class="js-f" data-k="nome" value="${escapeHtml(f.nome)}" style="width:100%;"></label>
      <label>Tipo
        <select class="js-f" data-k="tipo">${TIPI_EDIFICIO_UI.map(([v, t]) => `<option value="${v}" ${v === f.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </label>
      ${opz.creazione
        ? `<div style="color:#bbb;">Centro: ${opz.cx}:${opz.cy}</div>`
        : `<div style="display:flex; gap:6px;">
             <label>Angolo x <input class="js-f" type="number" data-k="x" value="${f.x}" style="width:70px;"></label>
             <label>Angolo y <input class="js-f" type="number" data-k="y" value="${f.y}" style="width:70px;"></label>
           </div>`}
      <div style="display:flex; gap:6px;">
        <label>Larghezza <input class="js-f" type="number" min="1" max="10" data-k="w" value="${f.w}" style="width:70px;"></label>
        <label>Altezza <input class="js-f" type="number" min="1" max="10" data-k="h" value="${f.h}" style="width:70px;"></label>
      </div>
      <small style="color:#999;">Occupa ${(f.w || 1) * (f.h || 1)} caselle.${opz.creazione ? ' La casella selezionata è il centro (con lato pari, una casella in più a destra/sotto).' : ''}</small>
      <div>${pianiHtml}</div>
      <button id="fe-add" class="btn-hero">+ Piano</button>
      <button id="fe-salva" class="btn-hero">${opz.creazione ? 'Crea edificio' : 'Salva'}</button>
      ${opz.creazione ? '' : '<button id="fe-elimina" class="btn-hero" style="background:#c0392b;">Elimina</button>'}
      ${opz.creazione ? '<button id="fe-annulla" class="btn-hero">Annulla</button>' : ''}
    </div>`;

  const rerender = () => renderFormEdificio(f, opz);
  sidePanel.querySelectorAll('.js-f').forEach(el => el.addEventListener('change', () => {
    const k = el.dataset.k;
    f[k] = ['x', 'y', 'w', 'h'].includes(k) ? (Number.parseInt(el.value, 10) || 0) : el.value;
    if (k === 'tipo' || k === 'w' || k === 'h') rerender();
  }));
  sidePanel.querySelectorAll('.js-p').forEach(el => el.addEventListener('change', () => {
    const p = f.piani[Number(el.dataset.i)], k = el.dataset.k;
    p[k] = (k === 'abitazioni' || k === 'esplorato') ? (Number.parseInt(el.value, 10) || 0) : el.value;
    if (k === 'categoria') { p.qualita = categoriaDef(p.categoria)?.qualita ? (p.qualita || 'bassa') : ''; rerender(); }
  }));
  sidePanel.querySelector('#fe-add').addEventListener('click', () => { f.piani.push(pianoVuoto(f.tipo)); rerender(); });
  sidePanel.querySelectorAll('.js-piano-del').forEach(b => b.addEventListener('click', () => { f.piani.splice(Number(b.dataset.i), 1); rerender(); }));
  sidePanel.querySelector('#fe-salva').addEventListener('click', () => opz.onSalva(f));
  sidePanel.querySelector('#fe-elimina')?.addEventListener('click', () => opz.onElimina());
  sidePanel.querySelector('#fe-annulla')?.addEventListener('click', () => renderSidePanel());
}

function renderEdificioPanel(edificio, piani) {
  const f = formDaServer(edificio, piani);
  renderFormEdificio(f, {
    titolo: `${edificio.nome || `Edificio #${edificio.id}`} (#${edificio.id})`,
    creazione: false,
    onSalva: async form => {
      try {
        const d = await inviaJson(`/api/mappa/edifici/${edificio.id}`, 'PUT', payloadEdificio(form));
        aggiornaTutto();
        MAPPA_STATO.selected = { x: d.edificio.x, y: d.edificio.y };
        await loadSelectionDetails(MAPPA_STATO.selected);
      } catch (e) { alert(e.message); }
    },
    onElimina: async () => {
      if (!confirm('Eliminare questo edificio?')) return;
      try {
        await inviaJson(`/api/mappa/edifici/${edificio.id}`, 'DELETE', {});
        MAPPA_STATO.selected = null;
        aggiornaTutto();
        renderSidePanel();
      } catch (e) { alert(e.message); }
    }
  });
}

function apriFormCreaEdificio(cx, cy) {
  const f = {
    nome: '', tipo: 'misto', x: cx, y: cy, w: 1, h: 1,
    piani: [pianoVuoto('misto'), { ...pianoVuoto('misto'), categoria: '', abitazioni: 1 }]
  };
  renderFormEdificio(f, {
    titolo: `Crea edificio ${cx}:${cy}`,
    creazione: true, cx, cy,
    onSalva: async form => {
      try {
        await inviaJson('/api/mappa/edifici', 'POST', { ...payloadEdificio(form), x: cx, y: cy });
        MAPPA_STATO.selected = { x: cx, y: cy };
        aggiornaTutto();
        await loadSelectionDetails(MAPPA_STATO.selected);
      } catch (e) { alert(e.message); }
    }
  });
}

// ---------- Campi base ----------
function renderCampoPanel(campo) {
  sidePanel.innerHTML = `
    <h3>🏕️ Campo: ${escapeHtml(campo.nome)}</h3>
    <div style="display:grid; gap:8px;">
      <label>Nome <input id="campo-nome" value="${escapeHtml(campo.nome)}" style="width:100%;"></label>
      <label>x <input id="campo-x" type="number" value="${campo.pos_x}"></label>
      <label>y <input id="campo-y" type="number" value="${campo.pos_y}"></label>
      <label>Raggio <input id="campo-raggio" type="number" min="0" value="${campo.raggio}"></label>
      <button id="campo-save" class="btn-hero">Salva</button>
      <button id="campo-rimuovi" class="btn-hero" style="background:#c0392b;">Rimuovi dalla mappa</button>
      <small style="color:#999;">Rimuovere il campo dalla mappa non lo cancella: restano i personaggi, il magazzino e la mappa già generata. Potrai rimetterlo con "Metti campo qui".</small>
    </div>`;
  sidePanel.querySelector('#campo-save').addEventListener('click', async () => {
    try {
      const d = await inviaJson(`/api/campi/${campo.id}`, 'PUT', {
        nome: sidePanel.querySelector('#campo-nome').value.trim(),
        pos_x: Number(sidePanel.querySelector('#campo-x').value),
        pos_y: Number(sidePanel.querySelector('#campo-y').value),
        raggio: Number(sidePanel.querySelector('#campo-raggio').value)
      });
      MAPPA_STATO.selected = { x: d.campo.pos_x, y: d.campo.pos_y };
      aggiornaTutto();
      renderCampoPanel(d.campo);
    } catch (e) { alert(e.message); }
  });
  sidePanel.querySelector('#campo-rimuovi').addEventListener('click', async () => {
    if (!confirm(`Togliere "${campo.nome}" dalla mappa? La mappa già generata resta.`)) return;
    try {
      await inviaJson(`/api/campi/${campo.id}`, 'PUT', { rimuovi_posizione: true });
      MAPPA_STATO.selected = null;
      aggiornaTutto();
      renderSidePanel();
    } catch (e) { alert(e.message); }
  });
}

function apriFormCreaCampo(x, y) {
  sidePanel.innerHTML = `
    <h3>Nuovo campo base ${x}:${y}</h3>
    <div style="display:grid; gap:8px;">
      <label>Nome <input id="nc-nome" style="width:100%;"></label>
      <label>Raggio <input id="nc-raggio" type="number" min="0" value="${MAPPA_STATO.config.RAGGIO_CAMPO_DEFAULT ?? 10}"></label>
      <button id="nc-crea" class="btn-hero">Crea campo</button>
      <button id="nc-annulla" class="btn-hero">Annulla</button>
    </div>`;
  sidePanel.querySelector('#nc-annulla').addEventListener('click', () => loadSelectionDetails({ x, y }));
  sidePanel.querySelector('#nc-crea').addEventListener('click', async () => {
    const nome = sidePanel.querySelector('#nc-nome').value.trim();
    if (!nome) return alert('Inserisci un nome.');
    try {
      const d = await inviaJson('/api/campi', 'POST', { nome, pos_x: x, pos_y: y, raggio: Number(sidePanel.querySelector('#nc-raggio').value) });
      MAPPA_STATO.selected = { x, y };
      aggiornaTutto();
      renderCampoPanel(d.campo);
    } catch (e) { alert(e.message); }
  });
}

async function apriMettiCampoQui(x, y) {
  sidePanel.innerHTML = '<p>Caricamento...</p>';
  try {
    const r = await fetch(apiUrl('/api/campi'), { headers: buildAuthHeaders() });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Errore caricamento campi');
    const senza = (d.campi || []).filter(c => c.pos_x === null || c.pos_x === undefined || c.pos_y === null || c.pos_y === undefined);
    sidePanel.innerHTML = senza.length
      ? `<h3>Metti campo qui (${x}:${y})</h3>
         <p>Campi senza posizione:</p>
         ${senza.map(c => `<button class="btn-hero js-metti" data-id="${c.id}" style="display:block; width:100%; margin-bottom:6px; text-align:left;">${escapeHtml(c.nome)}</button>`).join('')}
         <button id="mc-indietro" class="btn-hero">Annulla</button>`
      : `<h3>Metti campo qui</h3>
         <p>Tutti i campi hanno già una posizione. Per spostarne uno, selezionalo sulla mappa e cambia le coordinate.</p>
         <button id="mc-indietro" class="btn-hero">Indietro</button>`;
    sidePanel.querySelector('#mc-indietro').addEventListener('click', () => loadSelectionDetails({ x, y }));
    sidePanel.querySelectorAll('.js-metti').forEach(b => b.addEventListener('click', async () => {
      try {
        const res = await inviaJson(`/api/campi/${b.dataset.id}/posizione`, 'PUT', { pos_x: x, pos_y: y });
        MAPPA_STATO.selected = { x, y };
        aggiornaTutto();
        renderCampoPanel(res.campo);
      } catch (e) { alert(e.message); }
    }));
  } catch (e) {
    sidePanel.innerHTML = `<p style="color:#e74c3c;">${escapeHtml(e.message)}</p>`;
  }
}

function renderEmptyCellPanel(selected) {
  sidePanel.innerHTML = `
    <h3>Casella vuota ${selected.x}:${selected.y}</h3>
    <p>Questa casella non contiene zone, edifici o campi.</p>
    <div style="display:grid; gap:8px;">
      <button id="create-edificio-here" class="btn-hero">Crea edificio qui</button>
      <button id="create-campo-here" class="btn-hero">Crea nuovo campo qui</button>
      <button id="metti-campo-here" class="btn-hero">Metti campo qui</button>
    </div>`;
  sidePanel.querySelector('#create-edificio-here').addEventListener('click', () => apriFormCreaEdificio(selected.x, selected.y));
  sidePanel.querySelector('#create-campo-here').addEventListener('click', () => apriFormCreaCampo(selected.x, selected.y));
  sidePanel.querySelector('#metti-campo-here').addEventListener('click', () => apriMettiCampoQui(selected.x, selected.y));
}

window.apriEditorMappa = apriEditorMappa;
window.chiudiEditorMappa = chiudiEditorMappa;
