// navigazione-ui.js — tasto "Indietro" globale per modali, pannelli e schermate

const STATO = {
    parent: {},          // id modale -> id del modale da cui è stato aperto
    display: {},         // ultimo display usato da ogni modale (block/flex)
    visibili: new Set(),
    ultimoNascosto: null,
    ripristino: null,
    pianificato: false
};

const ESCLUSI = new Set(['modal-eccedenza']); // scelta obbligatoria: niente "indietro"

// Modali che mostrano dati che possono essere cambiati mentre erano nascosti
const REFRESH = {
    'modal-magazzino': () => window.renderMagazzinoModal && window.renderMagazzinoModal(),
    'modal-inventario': () => {
        if (window._ultimoInventarioIdx != null && window.apriInventario) {
            window.apriInventario(window._ultimoInventarioIdx);
        }
    }
};

function visibile(el) {
    return !!el && !!el.style.display && el.style.display !== 'none';
}

function chiudi(modal) {
    // Usa il pulsante ANNULLA/CHIUDI del footer diretto, così girano le funzioni di pulizia
    const cancel = modal.querySelector(':scope > .modal-content > .modal-footer .btn-cancel');
    if (cancel) cancel.click();
    if (visibile(modal)) modal.style.display = 'none';
}

function ripristina(modal) {
    const refresh = REFRESH[modal.id];
    if (refresh) { try { refresh(); } catch (e) { console.warn(e); } }
    if (!visibile(modal)) modal.style.display = STATO.display[modal.id] || 'block';
}

function indietroModale(modal) {
    const padreId = STATO.parent[modal.id];
    delete STATO.parent[modal.id];
    chiudi(modal);
    if (!padreId) return;
    const padre = document.getElementById(padreId);
    if (padre && !visibile(padre)) {
        STATO.ripristino = padreId; // evita che il ripristino venga letto come "nuova apertura"
        ripristina(padre);
    }
}

function creaBarra(onClick) {
    const bar = document.createElement('div');
    bar.className = 'back-bar';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-hero btn-indietro';
    btn.textContent = '← Indietro';
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    bar.appendChild(btn);
    return bar;
}

function assicuraBarraModale(modal) {
    if (ESCLUSI.has(modal.id)) return;
    const content = modal.querySelector(':scope > .modal-content');
    if (!content || content.querySelector(':scope > .back-bar')) return;
    content.insertBefore(creaBarra(() => indietroModale(modal)), content.firstChild);
}

function assicuraBarraPannelli() {
    const pannelli = [
        ['side-spedizione', () => window.chiudiSpedizione && window.chiudiSpedizione()],
        ['side-cimitero', () => window.chiudiCimitero && window.chiudiCimitero()]
    ];
    pannelli.forEach(([id, chiudiFn]) => {
        const el = document.getElementById(id);
        if (!el || el.querySelector(':scope > .back-bar')) return;
        el.insertBefore(creaBarra(chiudiFn), el.firstChild);
    });
}

function assegnaParent(id, ora) {
    if (STATO.ripristino === id) { STATO.ripristino = null; return; }
    let candidato = null;
    const u = STATO.ultimoNascosto;
    if (u && u.id !== id && Date.now() - u.t < 600 && document.getElementById(u.id)) {
        candidato = u.id; // transizione: il vecchio modale è stato chiuso per aprire questo
    } else {
        const sotto = [...STATO.visibili].filter(x => ora.has(x) && x !== id);
        if (sotto.length) candidato = sotto[sotto.length - 1]; // modale impilato
    }
    if (candidato) {
        STATO.parent[id] = candidato;
        if (STATO.parent[candidato] === id) delete STATO.parent[candidato]; // niente cicli
    } else {
        delete STATO.parent[id];
    }
}

function scansiona() {
    STATO.pianificato = false;
    const ora = new Set();
    document.querySelectorAll('.modal').forEach(m => {
        if (!m.id) return;
        if (visibile(m)) {
            ora.add(m.id);
            STATO.display[m.id] = m.style.display;
            assicuraBarraModale(m);
        }
    });
    STATO.visibili.forEach(id => {
        if (!ora.has(id)) STATO.ultimoNascosto = { id, t: Date.now() };
    });
    ora.forEach(id => {
        if (!STATO.visibili.has(id)) assegnaParent(id, ora);
    });
    STATO.visibili = ora;
    assicuraBarraPannelli();
}

function pianificaScansione() {
    if (STATO.pianificato) return;
    STATO.pianificato = true;
    requestAnimationFrame(scansiona);
}

// ---------- Schermate (pre-gioco / gioco) ----------
function indietroLogin() {
    document.querySelector('.landing-auth')?.classList.add('hidden');
}

function indietroLobby() {
    // Il reload azzera polling e stato (compreso l'hub Master che svuota il <main> della lobby)
    location.reload();
}

async function indietroGioco() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (typeof window.fermaPollingPartyMaster === 'function') window.fermaPollingPartyMaster();
    if (!user || user.role === 'ospite') { location.reload(); return; }
    if (user.role === 'master') {
        if (typeof window.showMasterHub === 'function') await window.showMasterHub();
        return;
    }
    if (typeof window.showLobbyScreen === 'function') await window.showLobbyScreen(user);
}

function init() {
    document.getElementById('btn-auth-back')?.addEventListener('click', indietroLogin);
    document.getElementById('btn-lobby-back')?.addEventListener('click', indietroLobby);
    document.getElementById('btn-game-back')?.addEventListener('click', indietroGioco);

    new MutationObserver(pianificaScansione).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
    });
    scansiona();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();