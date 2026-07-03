let magazzino = {
    cibo: 20,
    acqua: 20,
    materialiAlchemici: 5,
    ingranaggi: 10,
    conserve: 0,
    piattiDeliziosi: 0,
    ciboaviarto:0,
    materialiMedici: {
        base: 2,
        avanzati: 1,
        critici: 0
    },
    oggettiMagici: {  
        comuni: 0,
        nonComuni: 0,
        rari: 0,
        superRari: 0
    },
    munizioni : {
        proiettili: 0,
        quadrelli: 0,
        frecce: 0,
        gomma_pistola: 0,  // Rappresenta le *ore* di usura disponibili
        gomma_balestra: 0,
        gomma_arco: 0
    },
    postazioneAlchemica: false,
    compounds: [],
    libri: [],
    congengnifissi: [],
    congegniConteggio : {
    'Orologio / Timer': 0,
    'Cassa Amplificata': 0,
    'Innesco': 0
}
};

const MAPPA_MUNIZIONI = {
    'Pistola':  { reale: 'proiettili', gomma: 'gomma_pistola' },
    'Balestra': { reale: 'quadrelli',  gomma: 'gomma_balestra' },
    'Arco':     { reale: 'frecce',     gomma: 'gomma_arco' }
};

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

function depositaInMagazzino(idxPersonaggio, tipo, quantita) {
    const p = party[idxPersonaggio];
    if (!p.inventario[tipo] || p.inventario[tipo] < quantita) {
        alert("Non hai abbastanza risorse nell'inventario!");
        return;
    }

    // Rimuove dal personaggio
    p.inventario[tipo] -= quantita;
    
    // Aggiunge al magazzino
    magazzino[tipo] += quantita;
    aggiornaInterfaccia();
}

// Ritira dal magazzino
function ritiraDaMagazzino(idxPersonaggio, tipo, quantita) {
    const p = party[idxPersonaggio];
    if (magazzino[tipo] < quantita) {
        alert("Non c'è abbastanza nel magazzino!");
        return;
    }

    // Calcolo preventivo del peso per vedere se riesce a trasportarlo
    // (Dobbiamo simulare il peso extra)
    let pesoOggetto = calcolaPesoSpeciale(tipo, quantita);
    if ((p.pesoAttuale + pesoOggetto) > p.capacitaMax) {
        alert(`${p.nome} è troppo carico per prendere questo oggetto!`);
        return;
    }

    magazzino[tipo] -= quantita;
    p.inventario[tipo] += quantita;
    aggiornaInterfaccia();
}

// Helper per i pesi dinamici del ritiro/deposito
function calcolaPesoSpeciale(tipo, qty) {
    if (tipo === 'cibo' || tipo === 'acqua') return qty * 1;
    if (tipo === 'ingranaggi') return qty / 10;
    if (tipo === 'alchemici') return qty / 6;
    if (tipo === 'medBase') return (qty * 1) / 10;
    if (tipo === 'medAvanzati') return (qty * 2) / 10;
    if (tipo === 'medCritici') return (qty * 3) / 10;
    if (tipo === 'munizioni') return qty * 0.05;
    return 0;
}

function applicaPerkArmato(p) {
    if (p.hasPerk && p.hasPerk('Armato')) {
        if (typeof p.initInventarioBase === 'function') p.initInventarioBase();
        
        const armiDisponibili = [
            "Ascia", "Spada", "Pistola", "Arco", 
            "Balestra", "Frusta", "Alabarda", "Lancia", "Picca"
        ];
        
        // Tramite un prompt chiediamo al giocatore cosa scegliere
        let scelta = prompt(
            `Hai il perk 'Armato'! Scegli un'arma con cui iniziare l'avventura:\n${armiDisponibili.join(", ")}`, 
            "Ascia"
        );
        
        // Se annulla o scrive a caso, diamo un'ascia di default
        if (!scelta || !armiDisponibili.some(a => a.toLowerCase() === scelta.toLowerCase())) {
            scelta = "Ascia";
        }
        const nomeArma = scelta.charAt(0).toUpperCase() + scelta.slice(1).toLowerCase();

        let tipoArma = "mischia";
        if (['Pistola', 'Arco', 'Balestra'].includes(nomeArma)) {
            tipoArma = "distanza";
        }
        p.inventario.armi.push({ nome: nomeArma, tipo: tipoArma, spazioOccupato: 1 });
        if (nomeArma === 'Arco' || nomeArma === 'Balestra') {
            p.inventario.munizioni += 10;
        } else if (nomeArma === 'Pistola') {
            p.inventario.munizioni += 3;
        }

        if (typeof mostraNotificaInAlto === 'function') {
            mostraNotificaInAlto(`⚔️ ${p.nome} ha equipaggiato la sua arma iniziale: ${nomeArma}`, "successo");
        }
    }
}

function consumaMunizioneAttacco(p, tipoArma) {
    const mappa = MAPPA_MUNIZIONI[tipoArma];
    
    // Se non è un'arma a distanza, nessun consumo necessario
    if (!mappa) return true; 

    if (magazzino.munizioni[mappa.reale] > 0) {
        magazzino.munizioni[mappa.reale]--;
        if (typeof mostraNotificaInAlto === 'function') {
            mostraNotificaInAlto(`${p.nome} spara! ${mappa.reale} rimanenti: ${magazzino.munizioni[mappa.reale]}`, 'info');
        }
        return true; // Colpo effettuato
    } else {
        alert(`❌ ${p.nome} non ha abbastanza ${mappa.reale} per usare: ${tipoArma}!`);
        return false; // Colpo fallito
    }
}

window.takeFromMagazzino = takeFromMagazzino;