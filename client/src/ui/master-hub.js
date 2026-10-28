import { apiUrl, buildAuthHeaders } from '../logic/logic.js';
import { fetchCampiBase, impostaPosizioneCampoBase } from '../logic/campo.js';
import { DOCUMENTO_LINGUE, escapeHtml } from './common-ui.js';

let hubContainer = null;

function getHubContainer() {
  if (hubContainer) return hubContainer;
  const lobby = document.getElementById('lobby-screen');
  if (!lobby) return null;
  const main = lobby.querySelector('main');
  if (!main) return null;
  hubContainer = document.createElement('div');
  hubContainer.id = 'master-hub-container';
  main.innerHTML = '';
  main.appendChild(hubContainer);
  return hubContainer;
}

function lingueOptions(selected = 'Verbum') {
  return DOCUMENTO_LINGUE.map(l => `<option value="${escapeHtml(l)}" ${l === selected ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('');
}

async function caricaArchivioDocumenti() {
  const res = await fetch(apiUrl('/api/archivio-documenti'), { headers: buildAuthHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Errore caricamento archivio documenti');
  return data.documenti || [];
}

async function renderArchivioList() {
  const container = document.getElementById('master-archivio-list');
  if (!container) return;
  try {
    const docs = await caricaArchivioDocumenti();
    if (!docs.length) {
      container.innerHTML = '<p style="color:#888;">Archivio vuoto.</p>';
      return;
    }
    container.innerHTML = docs.map(doc => `
      <div style="border:1px solid #2a2a2a; padding:8px; margin-bottom:8px; background:#111;">
        <strong>${escapeHtml(doc.titolo)}</strong>
        <div style="font-size:0.85rem; color:#999;">Lingua: ${escapeHtml(doc.lingua)}</div>
        <div style="font-size:0.8rem; color:#777; margin-top:4px;">${escapeHtml((doc.testo_originale || '').slice(0, 120))}${(doc.testo_originale || '').length > 120 ? '...' : ''}</div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button class="btn-hero js-doc-edit" data-id="${doc.id}">Modifica</button>
          <button class="btn-hero js-doc-delete" data-id="${doc.id}" style="background:#a93226;">Elimina</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.js-doc-edit').forEach(btn => {
      btn.addEventListener('click', () => apriFormDocumentoArchivio(Number(btn.dataset.id)));
    });
    container.querySelectorAll('.js-doc-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Eliminare il documento dall\'archivio?')) return;
        const res = await fetch(apiUrl(`/api/archivio-documenti/${btn.dataset.id}`), {
          method: 'DELETE',
          headers: buildAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Errore eliminazione documento');
        renderArchivioList();
      });
    });
  } catch (error) {
    container.innerHTML = `<p style="color:#e74c3c;">${escapeHtml(error.message)}</p>`;
  }
}

async function apriFormDocumentoArchivio(docId = null) {
  let current = null;
  if (docId) {
    const docs = await caricaArchivioDocumenti();
    current = docs.find(d => d.id === docId) || null;
  }

  const modal = ensureModal('master-doc-modal');
  modal.innerHTML = `
    <div class="modal-content" style="max-width:680px;">
      <h2>${docId ? 'Modifica documento' : 'Nuovo documento archivio'}</h2>
      <label>Titolo <input id="hub-doc-titolo" value="${escapeHtml(current?.titolo || '')}" style="width:100%;" /></label>
      <label>Lingua
        <select id="hub-doc-lingua" style="width:100%; margin-top:4px;">${lingueOptions(current?.lingua || 'Verbum')}</select>
      </label>
      <label>Testo
        <textarea id="hub-doc-testo" rows="8" style="width:100%;">${escapeHtml(current?.testo_originale || '')}</textarea>
      </label>
      <div class="modal-footer">
        <button class="btn-big" id="hub-doc-save">Salva</button>
        <button class="btn-big btn-cancel" id="hub-doc-cancel">Annulla</button>
      </div>
    </div>
  `;
  modal.style.display = 'block';

  modal.querySelector('#hub-doc-cancel').addEventListener('click', () => { modal.style.display = 'none'; });
  modal.querySelector('#hub-doc-save').addEventListener('click', async () => {
    const titolo = modal.querySelector('#hub-doc-titolo').value.trim();
    const lingua = modal.querySelector('#hub-doc-lingua').value;
    const testo = modal.querySelector('#hub-doc-testo').value;
    if (!titolo || !lingua || !testo.trim()) return alert('Compila tutti i campi.');

    const endpoint = docId ? `/api/archivio-documenti/${docId}` : '/api/archivio-documenti';
    const method = docId ? 'PUT' : 'POST';
    const res = await fetch(apiUrl(endpoint), {
      method,
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ titolo, lingua, testo })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Errore salvataggio documento');
    modal.style.display = 'none';
    await renderArchivioList();
  });
}

function ensureModal(id) {
  let modal = document.getElementById(id);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';
    document.body.appendChild(modal);
  }
  return modal;
}

function renderLayout() {
  const container = getHubContainer();
  if (!container) return;
  container.innerHTML = `
    <div id="master-hub-warning"></div>
    <div style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-bottom:14px;">
      <button class="btn-hero" id="hub-enter-game">Entra in gioco</button>
      <button class="btn-hero" id="hub-create-doc">Crea documento</button>
      <button class="btn-hero" id="hub-open-map">Personalizza mappa</button>
    </div>
    <section id="master-hub-doc-section" style="display:none; border:1px solid #2a2a2a; background:#0f0f0f; padding:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="margin:0;">Archivio documenti</h3>
        <button class="btn-hero" id="hub-new-doc">Nuovo documento</button>
      </div>
      <div id="master-archivio-list"></div>
    </section>
  `;

  container.querySelector('#hub-enter-game').addEventListener('click', async () => {
    if (typeof window.showGameScreen === 'function') await window.showGameScreen('Master');
    if (typeof window.caricaPartyMaster === 'function') await window.caricaPartyMaster();
    if (typeof window.avviaPollingPartyMaster === 'function') window.avviaPollingPartyMaster();
  });

  container.querySelector('#hub-create-doc').addEventListener('click', async () => {
    container.querySelector('#master-hub-doc-section').style.display = 'block';
    await renderArchivioList();
  });

  container.querySelector('#hub-open-map').addEventListener('click', async () => {
    if (typeof window.apriEditorMappa === 'function') {
      await window.apriEditorMappa();
    }
  });

  container.querySelector('#hub-new-doc').addEventListener('click', () => apriFormDocumentoArchivio());
}

export async function refreshMasterHubWarnings() {
  const warning = document.getElementById('master-hub-warning');
  if (!warning) return;
  const campi = await fetchCampiBase();
  const senzaPos = campi.filter(c => c.pos_x === null || c.pos_y === null || c.pos_x === undefined || c.pos_y === undefined);
  if (!senzaPos.length) {
    warning.innerHTML = '';
    return;
  }

  warning.innerHTML = `
    <div style="background:#6e3b00; color:#ffd9a3; border:1px solid #b87333; padding:10px; margin-bottom:10px;">
      <strong>Questi campi non hanno una posizione:</strong>
      <div id="master-warning-list" style="margin-top:8px;"></div>
    </div>
  `;
  const list = warning.querySelector('#master-warning-list');
  list.innerHTML = senzaPos.map(c => `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <span>${escapeHtml(c.nome)}</span>
      <button class="btn-hero js-set-pos" data-id="${c.id}" data-nome="${escapeHtml(c.nome)}">Imposta</button>
    </div>
  `).join('');

  list.querySelectorAll('.js-set-pos').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const nome = btn.dataset.nome;
      const x = prompt(`Imposta coordinata X per ${nome}`, '0');
      if (x === null) return;
      const y = prompt(`Imposta coordinata Y per ${nome}`, '0');
      if (y === null) return;
      const r = prompt(`Imposta raggio per ${nome}`, '10');
      if (r === null) return;
      const pos_x = Number.parseInt(x, 10);
      const pos_y = Number.parseInt(y, 10);
      const raggio = Number.parseInt(r, 10);
      if (!Number.isInteger(pos_x) || !Number.isInteger(pos_y) || !Number.isInteger(raggio) || raggio < 0) {
        alert('Valori non validi.');
        return;
      }
      await impostaPosizioneCampoBase(id, { pos_x, pos_y, raggio });
      await refreshMasterHubWarnings();
    });
  });
}

async function consegnaDocumentoArchivio(archivioId, personaggioId) {
  const res = await fetch(apiUrl(`/api/archivio-documenti/${archivioId}/dai`), {
    method: 'POST',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ personaggioId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Errore consegna documento');
  return data.document;
}

export async function apriDaiDocumentoModal(personaggioId, nomePersonaggio) {
  const modal = ensureModal('master-dai-documento-modal');
  const docs = await caricaArchivioDocumenti();

  modal.innerHTML = `
    <div class="modal-content" style="max-width:720px;">
      <h2>Dai documento a ${escapeHtml(nomePersonaggio)}</h2>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div style="border:1px solid #2a2a2a; padding:8px; background:#111;">
          <h4>Scegli dall'archivio</h4>
          <select id="dai-doc-select" style="width:100%; margin-bottom:8px;">
            <option value="">Seleziona...</option>
            ${docs.map(d => `<option value="${d.id}">${escapeHtml(d.titolo)} (${escapeHtml(d.lingua)})</option>`).join('')}
          </select>
          <button id="dai-doc-confirm" class="btn-hero" style="width:100%;">Conferma</button>
        </div>
        <div style="border:1px solid #2a2a2a; padding:8px; background:#111;">
          <h4>Crea nuovo</h4>
          <input id="dai-new-titolo" placeholder="Titolo" style="width:100%; margin-bottom:6px;" />
          <select id="dai-new-lingua" style="width:100%; margin-bottom:6px;">${lingueOptions('Verbum')}</select>
          <textarea id="dai-new-testo" rows="5" style="width:100%;" placeholder="Testo"></textarea>
          <button id="dai-new-save" class="btn-hero" style="width:100%; margin-top:6px;">Crea e dai subito</button>
        </div>
      </div>
      <div class="modal-footer">
        <button id="dai-doc-close" class="btn-big btn-cancel">Chiudi</button>
      </div>
    </div>
  `;
  modal.style.display = 'block';

  modal.querySelector('#dai-doc-close').addEventListener('click', () => { modal.style.display = 'none'; });

  modal.querySelector('#dai-doc-confirm').addEventListener('click', async () => {
    const id = Number.parseInt(modal.querySelector('#dai-doc-select').value, 10);
    if (!id) return alert('Seleziona un documento.');
    try {
      await consegnaDocumentoArchivio(id, personaggioId);
      modal.style.display = 'none';
      alert('Documento consegnato.');
    } catch (error) {
      alert(error.message);
    }
  });

  modal.querySelector('#dai-new-save').addEventListener('click', async () => {
    const titolo = modal.querySelector('#dai-new-titolo').value.trim();
    const lingua = modal.querySelector('#dai-new-lingua').value;
    const testo = modal.querySelector('#dai-new-testo').value;
    if (!titolo || !lingua || !testo.trim()) return alert('Compila tutti i campi.');

    const createRes = await fetch(apiUrl('/api/archivio-documenti'), {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ titolo, lingua, testo })
    });
    const createData = await createRes.json();
    if (!createRes.ok) return alert(createData.error || 'Errore creazione documento');

    try {
      await consegnaDocumentoArchivio(createData.documento.id, personaggioId);
      modal.style.display = 'none';
      alert('Documento creato e consegnato.');
    } catch (error) {
      alert(error.message);
    }
  });
}

export async function showMasterHub() {
  const landing = document.getElementById('landing-screen');
  const game = document.getElementById('game-screen');
  const lobby = document.getElementById('lobby-screen');
  if (landing) landing.classList.add('hidden');
  if (game) game.classList.add('hidden');
  if (lobby) lobby.classList.remove('hidden');
  renderLayout();
  await refreshMasterHubWarnings();
}

window.showMasterHub = showMasterHub;
window.apriDaiDocumentoModal = apriDaiDocumentoModal;
window.refreshMasterHubWarnings = refreshMasterHubWarnings;
