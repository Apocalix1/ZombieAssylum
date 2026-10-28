import { apiUrl, buildAuthHeaders } from '../logic/logic.js';
import { escapeHtml } from './common-ui.js';

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
          <input id="mappa-qy" type="number" min="0" max="99" value="0" style="width:80px; background:#1f1f1f; color:#fff; border:1px solid #333; padding:4px;" />
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
  const qx = clamp(Number.parseInt(qxInput.value, 10) || 0, 0, 999);
  const qy = clamp(Number.parseInt(qyInput.value, 10) || 0, 0, 99);
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
    MAPPA_STATO.quarterX = clamp(MAPPA_STATO.quarterX + delta, 0, 999);
  } else {
    MAPPA_STATO.quarterY = clamp(MAPPA_STATO.quarterY + delta, 0, 99);
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
    const espl = Number(e.esplorato_max || 0);
    ctx.fillStyle = espl === 0 ? '#1b1b1b' : (espl === 1 ? '#bfa226' : '#8fcf6a');
    ctx.fillRect(left, top, cell, cell);
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

function renderEdificioPanel(edificio, piani) {
  const pianiRows = piani.map((p, idx) => `
    <div data-row="${idx}" style="border:1px solid #2a2a2a; padding:6px; margin-bottom:6px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong>Piano ${p.piano}</strong>
        <button class="btn-hero piano-remove" data-row="${idx}" style="background:#7f1d1d;">-</button>
      </div>
      <label>Tipo
        <select class="piano-tipo" data-row="${idx}"><option value="abitazione" ${p.tipo === 'abitazione' ? 'selected' : ''}>abitazione</option></select>
      </label>
      <label>Esplorazione
        <select class="piano-espl" data-row="${idx}">
          <option value="0" ${Number(p.esplorato) === 0 ? 'selected' : ''}>0</option>
          <option value="1" ${Number(p.esplorato) === 1 ? 'selected' : ''}>1</option>
          <option value="2" ${Number(p.esplorato) === 2 ? 'selected' : ''}>2</option>
        </select>
      </label>
      <label>Loot
        <textarea class="piano-loot" data-row="${idx}" rows="2">${escapeHtml(p.loot_json || '')}</textarea>
      </label>
    </div>
  `).join('');

  sidePanel.innerHTML = `
    <h3>${escapeHtml(edificio.nome || `Edificio #${edificio.id}`)}</h3>
    <div style="display:grid; gap:8px;">
      <label>Nome <input id="ed-nome" value="${escapeHtml(edificio.nome || '')}" /></label>
      <label>Tipo
        <select id="ed-tipo"><option value="appartamenti" ${edificio.tipo === 'appartamenti' ? 'selected' : ''}>appartamenti</option></select>
      </label>
      <div id="piani-wrap">${pianiRows}</div>
      <button id="piano-add" class="btn-hero">+ Piano</button>
      <button id="ed-save" class="btn-hero">Salva</button>
      <button id="ed-delete" class="btn-hero" style="background:#c0392b;">Elimina</button>
    </div>
  `;

  const currentPiani = piani.map(p => ({ ...p }));

  function rerenderPiani() {
    renderEdificioPanel(edificio, currentPiani.map((p, i) => ({ ...p, piano: i + 1 })));
  }

  sidePanel.querySelector('#piano-add').addEventListener('click', () => {
    currentPiani.push({ piano: currentPiani.length + 1, tipo: 'abitazione', esplorato: 0, loot_json: '{}' });
    rerenderPiani();
  });

  sidePanel.querySelectorAll('.piano-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = Number(btn.dataset.row);
      currentPiani.splice(row, 1);
      rerenderPiani();
    });
  });

  sidePanel.querySelector('#ed-save').addEventListener('click', async () => {
    const nome = sidePanel.querySelector('#ed-nome').value.trim();
    const tipo = sidePanel.querySelector('#ed-tipo').value;

    const payloadPiani = [...sidePanel.querySelectorAll('#piani-wrap > div')].map((row, i) => ({
      tipo: row.querySelector('.piano-tipo').value,
      esplorato: Number(row.querySelector('.piano-espl').value),
      loot_json: row.querySelector('.piano-loot').value,
      piano: i + 1
    }));

    const r1 = await fetch(apiUrl(`/api/mappa/edifici/${edificio.id}`), {
      method: 'PUT',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ nome: nome || null, tipo })
    });
    const d1 = await r1.json();
    if (!r1.ok) return alert(d1.error || 'Errore aggiornamento edificio');

    const r2 = await fetch(apiUrl(`/api/mappa/edifici/${edificio.id}/piani`), {
      method: 'PUT',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ piani: payloadPiani })
    });
    const d2 = await r2.json();
    if (!r2.ok) return alert(d2.error || 'Errore aggiornamento piani');

    invalidateTilesForRect(edificio.x, edificio.y, edificio.x, edificio.y);
    requestVisibleTiles();
    render();
    renderEdificioPanel(d1.edificio, d2.piani || []);
  });

  sidePanel.querySelector('#ed-delete').addEventListener('click', async () => {
    if (!confirm('Eliminare questo edificio?')) return;
    const r = await fetch(apiUrl(`/api/mappa/edifici/${edificio.id}`), {
      method: 'DELETE',
      headers: buildAuthHeaders()
    });
    const d = await r.json();
    if (!r.ok) return alert(d.error || 'Errore eliminazione edificio');
    invalidateTilesForRect(edificio.x, edificio.y, edificio.x, edificio.y);
    requestVisibleTiles();
    MAPPA_STATO.selected = null;
    render();
    renderSidePanel();
  });
}

function renderEmptyCellPanel(selected) {
  sidePanel.innerHTML = `
    <h3>Casella vuota ${selected.x}:${selected.y}</h3>
    <p>Questa casella non contiene zone o edifici.</p>
    <button id="create-edificio-here" class="btn-hero">Crea edificio qui</button>
  `;

  sidePanel.querySelector('#create-edificio-here').addEventListener('click', () => {
    apriFormCreaEdificio(selected.x, selected.y);
  });
}

function apriFormCreaEdificio(x, y) {
  sidePanel.innerHTML = `
    <h3>Crea edificio ${x}:${y}</h3>
    <div style="display:grid; gap:8px;">
      <label>Nome <input id="new-ed-nome" /></label>
      <label>Tipo
        <select id="new-ed-tipo"><option value="appartamenti">appartamenti</option></select>
      </label>
      <label>Numero piani <input id="new-ed-piani-count" type="number" value="3" min="1" /></label>
      <button id="new-ed-create" class="btn-hero">Crea</button>
      <button id="new-ed-cancel" class="btn-hero">Annulla</button>
    </div>
  `;

  sidePanel.querySelector('#new-ed-create').addEventListener('click', async () => {
    const nome = sidePanel.querySelector('#new-ed-nome').value.trim();
    const tipo = sidePanel.querySelector('#new-ed-tipo').value;
    const count = Math.max(1, Number.parseInt(sidePanel.querySelector('#new-ed-piani-count').value, 10) || 1);
    const piani = Array.from({ length: count }).map(() => ({ tipo: 'abitazione', esplorato: 0, loot_json: '{}' }));
    const r = await fetch(apiUrl('/api/mappa/edifici'), {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ x, y, nome: nome || null, tipo, piani })
    });
    const data = await r.json();
    if (!r.ok) return alert(data.error || 'Errore creazione edificio');
    invalidateTilesForRect(x, y, x, y);
    requestVisibleTiles();
    MAPPA_STATO.selected = { x, y };
    render();
    await loadSelectionDetails(MAPPA_STATO.selected);
  });

  sidePanel.querySelector('#new-ed-cancel').addEventListener('click', renderSidePanel);
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
  MAPPA_STATO.quarterX = clamp(Math.floor(x / q), 0, 999);
  MAPPA_STATO.quarterY = clamp(Math.floor(y / q), 0, 99);
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

window.apriEditorMappa = apriEditorMappa;
window.chiudiEditorMappa = chiudiEditorMappa;
