function normalizeMagazzinoItems() {
    const items = [];
    items.push({ key: 'cibo', label: 'Cibo', count: magazzino.cibo, consumable: true });
    items.push({ key: 'acqua', label: 'Acqua', count: magazzino.acqua, consumable: true });
    items.push({ key: 'conserve', label: 'Conserve', count: magazzino.conserve, consumable: true });
    items.push({ key: 'piattiDeliziosi', label: 'Piatti Deliziosi', count: magazzino.piattiDeliziosi, consumable: true });
    items.push({ key: 'materialiAlchemici', label: 'Materiali Alchemici', count: magazzino.materialiAlchemici, consumable: false });
    items.push({ key: 'ingranaggi', label: 'Ingranaggi', count: magazzino.ingranaggi, consumable: false });
    // materiali medici subitems
    items.push({ key: 'medici_base', label: 'Materiali Medici (base)', count: magazzino.materialiMedici.base, consumable: false });
    items.push({ key: 'medici_avanzati', label: 'Materiali Medici (avanzati)', count: magazzino.materialiMedici.avanzati, consumable: false });
    return items;
}

function openMagazzino() {
    const modal = document.getElementById('modal-magazzino');
    if (!modal) return;
    renderMagazzinoModal();
    // populate targets (party or saved characters)
    const sel = document.getElementById('magazzino-target');
    sel.innerHTML = '';
    if (party.length) {
        party.forEach(p => {
            const opt = document.createElement('option'); opt.value = p.nome; opt.textContent = p.nome; sel.appendChild(opt);
        });
    } else {
        const localNames = loadCharactersForUser();
        localNames.forEach(n => { const opt = document.createElement('option'); opt.value = n; opt.textContent = n; sel.appendChild(opt); });
    }
    modal.style.display = 'flex';
}

function renderMagazzinoModal() {
    const list = document.getElementById('magazzino-list');
    if (!list) return;
    const items = normalizeMagazzinoItems();
    list.innerHTML = items.map(it => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #222;">
            <div><strong>${it.label}</strong><div style="font-size:0.85rem; color:#aaa">${it.consumable? 'Consumabile' : 'Non consumabile'}</div></div>
            <div style="display:flex; gap:8px; align-items:center;">
                <div style="min-width:40px; text-align:right;">${it.count}</div>
                <button class="btn-hero" onclick="takeFromMagazzino('${it.key}')">Prendi</button>
            </div>
        </div>
    `).join('');
}

function takeFromMagazzino(key) {
    const target = document.getElementById('magazzino-target')?.value;
    if (!target) return alert('Seleziona il destinatario');
    // find item and decrement
    let taken = false;
    if (key === 'cibo' && magazzino.cibo > 0) { magazzino.cibo--; taken = true; }
    else if (key === 'acqua' && magazzino.acqua > 0) { magazzino.acqua--; taken = true; }
    else if (key === 'conserve' && magazzino.conserve > 0) { magazzino.conserve--; taken = true; }
    else if (key === 'piattiDeliziosi' && magazzino.piattiDeliziosi > 0) { magazzino.piattiDeliziosi--; taken = true; }
    else if (key === 'materialiAlchemici' && magazzino.materialiAlchemici > 0) { magazzino.materialiAlchemici--; taken = true; }
    else if (key === 'ingranaggi' && magazzino.ingranaggi > 0) { magazzino.ingranaggi--; taken = true; }
    else if (key === 'medici_base' && magazzino.materialiMedici.base > 0) { magazzino.materialiMedici.base--; taken = true; }
    else if (key === 'medici_avanzati' && magazzino.materialiMedici.avanzati > 0) { magazzino.materialiMedici.avanzati--; taken = true; }
    if (!taken) return alert('Articolo non disponibile.');

    // load character data from localStorage (or party)
    let pObj = null;
    // check party first
    const pInParty = party.find(pp => pp.nome === target);
    if (pInParty) pObj = pInParty;
    else {
        const data = caricaDatiDaLocalStorage(target);
        if (data) pObj = Object.assign(new Personaggio(data.nome, data.giornoInizio || 0), data);
    }
    if (!pObj) return alert('Personaggio non trovato localmente.');
    // enforce carry limit 3
    if (!Array.isArray(pObj.inventory)) pObj.inventory = [];
    if (pObj.inventory.length >= 3) return alert('Il personaggio non può portare più di 3 oggetti.');
    pObj.inventory.push(key);
    // save back locally and sync
    salvaPersonaggioCloud(pObj);
    if (!pInParty) {
        // update localStorage
        localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${encodeURIComponent(pObj.nome)}`, JSON.stringify(pObj));
    }
    renderMagazzinoModal();
    aggiornaInterfaccia();
}
window.takeFromMagazzino = takeFromMagazzino;