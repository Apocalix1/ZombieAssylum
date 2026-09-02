import { Personaggio, salvaPersonaggioLocalmente } from "../logic/logic.js";
import { party, aggiornaInterfaccia } from "./ui.js";

window.tempP = window.tempP || null;
let categoriaCorrente = "competenze base";
let perkSearchQuery = "";
let perkFilterAffordableOnly = false;

function getPerkDatabase() {
    return window.DATABASE_PERK || (typeof DATABASE_PERK !== 'undefined' ? DATABASE_PERK : {});
}

function getGlobalPerkData(nome) {
    return typeof window.findPerkData === 'function' ? window.findPerkData(nome) : null;
}

function getGlobalPerkCount(p, nome) {
    return typeof window.getPerkCount === 'function' ? window.getPerkCount(p, nome) : 0;
}

function hasGlobalPerk(p, nome) {
    return typeof window.hasPerk === 'function' ? window.hasPerk(p, nome) : false;
}

export function cambiaCategoriaPerk(categoria) {
    categoriaCorrente = categoria;
    window.perkSearchQuery = '';
    const input = document.getElementById('perk-search-input');
    if (input) input.value = '';
    renderSetupPerks();
}

function getPerkSelectionCost(perks) {
    return (perks || []).reduce((tot, perk) => {
        const nome = typeof perk === 'string' ? perk : perk?.nome;
        if (!nome) return tot;
        const costo = (typeof perk === 'object' && typeof perk.costo === 'number')
            ? perk.costo
            : (getGlobalPerkData(nome)?.costo || 0);
        return tot + (costo || 0);
    }, 0);
}

function bindRobotCheckboxHandler(robotCheckbox) {
    if (!robotCheckbox) return;
   robotCheckbox.onchange = function () {
            const p = window.tempP;
            if (!p) return;
            const COSTO_ROBOT = 6;

            if (this.checked) {
                if (p.puntiCreazione < COSTO_ROBOT) {
                    alert('Punti insufficienti per diventare Robot (costa 6 punti).');
                    this.checked = false;
                    return;
                }
                p._savedHumanPerks = (p.perks || []).map(perk => typeof perk === 'string' ? perk : { ...perk });
                p._savedHumanPerkCost = getPerkSelectionCost(p._savedHumanPerks);
                refundAndClearNonRobotPerks();
                p.puntiCreazione -= COSTO_ROBOT;
                p.isRobot = true;
                categoriaCorrente = 'robotici';
            } else {
                const robotPerksCost = getPerkSelectionCost(p.perks);
                const restoredPerks = (p._savedHumanPerks || []).map(perk => typeof perk === 'string' ? perk : { ...perk });
                const restoredCost = getPerkSelectionCost(restoredPerks);
                const puntiDopoRimborso = (p.puntiCreazione || 0) + robotPerksCost + COSTO_ROBOT;
                    if (restoredCost > 0 && puntiDopoRimborso < restoredCost) {
                alert('Non hai abbastanza punti per ripristinare i perk umani.');
                this.checked = true;
                p.isRobot = true;
                renderSetupStats();
                renderSetupPerks();
                renderSetupArtificeria();
                return;
            }

            p.perks = restoredPerks;
            p.puntiCreazione = Math.max(0, puntiDopoRimborso - restoredCost);
            p.isRobot = false;
            categoriaCorrente = 'competenze base';

            if (robotPerksCost > 0) {
                alert(`Tornando umano sono stati rimossi i perk robotici. Ti sono stati restituiti ${robotPerksCost} punti.`);
            }
        }
        renderSetupStats();
        renderSetupPerks();
        renderSetupArtificeria();
    };
}

function avviaCreazione(directAdd = false) {
    window._editMode = false;
    window._editingCharId = null;
    window._editingCharWasLocale = false;
    window._editingCharOriginalName = null;
    const titleEl = document.querySelector('#modal-creazione h2');
    if (titleEl) titleEl.textContent = 'NUOVO SOPRAVVISSUTO';
    
    // Creazione unica
    window.tempP = new Personaggio("Nuovo", Math.floor((window.oreTotali || 0) / 24));
    window.tempP.puntiCreazione = 63;
    window.tempP.livelloMagia = 0;
    window.tempP.spellsKnown = {0:0,1:0,2:0,3:0};

    // Inizializzazione forzata delle statistiche
    ["forza", "destrezza", "costituzione", "intelligenza", "saggezza", "carisma"].forEach(stat => {
        if (typeof window.tempP[stat] !== 'number') window.tempP[stat] = 5;
    });
    window.tempP.updateManaFromMagiaLevel && window.tempP.updateManaFromMagiaLevel();


        const nomeInput = document.getElementById('crea-nome');
    if (nomeInput) {
        nomeInput.value = "";
        nomeInput.oninput = function () {
            if (window.tempP) window.tempP.nome = this.value;
            renderSetupPerks();
        };
    }
    const modal = document.getElementById('modal-creazione');
    if (modal) modal.style.display = 'block';
    categoriaCorrente = "competenze base";
    renderSetupStats();
    renderSetupPerks();

    if (nomeInput) setTimeout(() => nomeInput.focus(), 100);
    const robotCheckbox = document.getElementById('crea-robot');
    if (robotCheckbox) {
        robotCheckbox.checked = false;
        bindRobotCheckboxHandler(robotCheckbox);
    }

    // Salva il flag directAdd per usarlo in confermaCreazione
    window._directAdd = directAdd;
}

async function avviaModificaPersonaggio(nome, id, isLocale) {
    let pDataRaw = null;

    if (isLocale || !id) {
        pDataRaw = window.caricaDatiDaLocalStorage ? window.caricaDatiDaLocalStorage(nome) : null;
    } else {
        try {
            const res = await fetch(apiUrl(`/api/personaggi/${id}`), { headers: buildAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const raw = data.personaggio;
                pDataRaw = (raw.data && typeof raw.data === 'object') ? raw.data : JSON.parse(raw.data || '{}');
                pDataRaw.id = raw.id;
            }
        } catch (e) { console.warn('Errore fetch personaggio per modifica:', e); }
        if (!pDataRaw) {
            pDataRaw = window.caricaDatiDaLocalStorage ? window.caricaDatiDaLocalStorage(nome) : null;
        }
    }

    if (!pDataRaw) {
        alert('Impossibile caricare i dati di questo personaggio.');
        return;
    }

    window.tempP = Object.assign(new Personaggio(pDataRaw.nome || nome, pDataRaw.giornoInizio || 0), pDataRaw);
    window.tempP.initInventarioBase();
    if (typeof window.tempP.updateManaFromMagiaLevel === 'function') window.tempP.updateManaFromMagiaLevel();

    window._editMode = true;
    window._editingCharId = id || pDataRaw.id || null;
    window._editingCharWasLocale = !!isLocale;
    window._editingCharOriginalName = nome;
    window._directAdd = false;

        const nomeInput = document.getElementById('crea-nome');
    if (nomeInput) {
        nomeInput.value = window.tempP.nome;
        nomeInput.oninput = function () {
            if (window.tempP) window.tempP.nome = this.value;
            renderSetupPerks();
        };
    }

    const robotCheckbox = document.getElementById('crea-robot');
    if (robotCheckbox) {
        robotCheckbox.checked = !!window.tempP.isRobot;
        bindRobotCheckboxHandler(robotCheckbox);
    }

    categoriaCorrente = window.tempP.isRobot ? 'robotici' : 'competenze base';

    const titleEl = document.querySelector('#modal-creazione h2');
    if (titleEl) titleEl.textContent = `✏️ MODIFICA: ${window.tempP.nome.toUpperCase()}`;

    const modal = document.getElementById('modal-creazione');
    if (modal) modal.style.display = 'block';

    renderSetupStats();
    renderSetupPerks();
}

// In ui.js, aggiungi questa funzione
window.modificaPersonaggioConControllo = function(nome, id, isLocale, isCaricatoOra) {
    if (isCaricatoOra) {
        const idx = party.findIndex(p => p.nome === nome);
        if (idx !== -1) {
            if (!confirm(`Il personaggio "${nome}" è attualmente in gioco. Modificarlo lo rimuoverà dal party. Continuare?`)) {
                return;
            }
            party.splice(idx, 1);
            if (typeof window.chiudiScheda === 'function') {
                window.chiudiScheda();
            }
            aggiornaInterfaccia();
        }
    }
    if (typeof avviaModificaPersonaggio === 'function') {
        avviaModificaPersonaggio(nome, id, isLocale);
    } else {
        alert('Funzione di modifica non disponibile.');
    }
};

function modificaMagicLevel(delta) {
    if (!window.tempP) return;
    if (window.tempP.isRobot && !hasGlobalPerk(window.tempP, 'Incantatore')) {
        alert('I robot possono lanciare incantesimi solo con il perk "Incantatore".');
        return;
    }
    const current = window.tempP.livelloMagia || 0;

    if (delta > 0) {
        const next = current + 1;
        if (next > 9) return;
        const cost = getMagicLevelCost(next);
        if (window.tempP.puntiCreazione < cost) {
            alert('Non hai abbastanza punti creazione per aumentare il livello di magia.');
            return;
        }
        window.tempP.puntiCreazione -= cost;
        window.tempP.livelloMagia = next;
    } else if (delta < 0 && current > 0) {
        const refund = getMagicLevelCost(current);
        window.tempP.livelloMagia = current - 1;
        window.tempP.puntiCreazione += refund;
        for (let lv = window.tempP.livelloMagia + 1; lv <= 4; lv++) {
            if (window.tempP.spellsKnown && window.tempP.spellsKnown[lv] > 0) {
                window.tempP.spellsKnown[lv] = 0;
            }
        }
    }
    window.tempP.updateManaFromMagiaLevel && window.tempP.updateManaFromMagiaLevel();
    renderSetupStats();
    renderSetupPerks();
}

const ARMI_COSTI = {
    "Archi": [0, 1, 1, 2, 2, 3],
    "Balestre": [0, 1, 1, 2, 2, 3],
    "Armi con l'asta": [0, 1, 1, 2, 3],
    "Armi da fuoco": [0, 1, 2, 2, 3, 4],
    "Rampini e fruste": [0, 1, 1, 2, 2, 3],
    "Lame leggere": [0, 1, 1, 2, 3],
    "Mazze e armi contundenti": [0, 1, 1, 2, 3]
};

function modificaArmaLivello(categoria, delta) {
    const p = window.tempP;
    if (!p) return;
    p.armiLivello = p.armiLivello || {};
    const costi = ARMI_COSTI[categoria];
    if (!costi) return;
    const attuale = p.armiLivello[categoria] || 0;
    const maxLivello = costi.length - 1;

    if (delta > 0) {
        const next = attuale + 1;
        if (next > maxLivello) return;
        const costo = costi[next];
        if (p.puntiCreazione < costo) { alert(`Punti insufficienti per salire a livello ${next} in ${categoria}.`); return; }
        p.puntiCreazione -= costo;
        p.armiLivello[categoria] = next;
    } else if (attuale > 0) {
        p.puntiCreazione += costi[attuale];
        p.armiLivello[categoria] = attuale - 1;
    }
    renderSetupStats();
    renderSetupArmi();
}

function renderSetupArmi() {
    const container = document.getElementById('armi-setup-container');
    if (!container) return;
    const p = window.tempP;
    if (!p) return;
    p.armiLivello = p.armiLivello || {};

    let html = `<div style="background:#111; padding:10px; border-radius:6px; margin-top:10px;">
        <div style="font-weight:bold; color:#f1c40f; margin-bottom:8px;">COMPETENZE ARMI (opzionale)</div>`;

    Object.keys(ARMI_COSTI).forEach(categoria => {
        const costi = ARMI_COSTI[categoria];
        const lvl = p.armiLivello[categoria] || 0;
        const maxLivello = costi.length - 1;
        const prossimoCosto = lvl < maxLivello ? costi[lvl + 1] : null;
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span>${categoria} (Lv ${lvl}/${maxLivello})</span>
                <div>
                    <button onclick="modificaArmaLivello('${categoria}', -1)" style="padding:4px 8px;">-</button>
                    <span style="display:inline-block; width:36px; text-align:center; font-size:0.8rem;">${prossimoCosto !== null ? prossimoCosto + 'pt' : 'MAX'}</span>
                    <button onclick="modificaArmaLivello('${categoria}', 1)" style="padding:4px 8px;" ${lvl >= maxLivello ? 'disabled' : ''}>+</button>
                </div>
            </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

window.modificaArmaLivello = modificaArmaLivello;
window.renderSetupArmi = renderSetupArmi;
window.ARMI_COSTI = ARMI_COSTI;

const SPELL_KNOWLEDGE_COST = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 };

function modificaIncantesimiConosciuti(livello, delta) {
    const p = window.tempP;
    if (!p || typeof p.spellsKnown !== 'object') return;
    if (p.isRobot && !hasGlobalPerk(p, 'Incantatore')) {
        alert('I robot possono conoscere incantesimi solo con il perk "Incantatore".');
        return;
    }
    const massimo = p.getMaxKnownSpells ? p.getMaxKnownSpells(livello) : 0;
    let attuale = p.spellsKnown[livello] || 0;
    const costo = SPELL_KNOWLEDGE_COST[livello] || 0;

       if (delta > 0) {
        if (livello > p.livelloMagia) {
            alert('Devi sbloccare un livello di magia più alto per poter scegliere questo incantesimo.');
            return;
        }
        if (attuale >= massimo) {
            alert('Hai già raggiunto il massimo numero di incantesimi conosciuti per questo livello.');
            return;
        }
        if (p.puntiCreazione < costo) {
            alert(`Punti insufficienti: conoscere questo incantesimo costa ${costo} punti.`);
            return;
        }
        p.puntiCreazione -= costo;
        p.spellsKnown[livello] = attuale + 1;
    } else if (delta < 0 && attuale > 0) {
        p.puntiCreazione += costo;
        p.spellsKnown[livello] = attuale - 1;
    }
    renderSetupStats(); // aggiorna anche punti residui + sezione magia
}

function annullaCreazione() {
    document.getElementById('modal-creazione').style.display = 'none';
    window._editMode = false;
    window._editingCharId = null;
    window._editingCharWasLocale = false;
    window._editingCharOriginalName = null;
    const titleEl = document.querySelector('#modal-creazione h2');
    if (titleEl) titleEl.textContent = 'NUOVO SOPRAVVISSUTO';
}

async function confermaCreazione(directAdd = window._directAdd || false) {
    if (!window.tempP) return;

    // --- 1. Gestione Robot (checkbox) ---
    const robotCheckbox = document.getElementById('crea-robot');
    const isRobot = robotCheckbox && robotCheckbox.checked;

    if (isRobot) {
        const perkDb = getPerkDatabase();
        const robotPerks = window.tempP.perks.filter(p => {
            for (let cat in perkDb) {
                if (cat === 'robotici' && perkDb[cat].some(dp => dp.nome === p.nome)) return true;
            }
            return false;
        });
        window.tempP.perks = robotPerks;
        window.tempP.becomeRobot();
    }

    // --- 2. Validazione ---
    const nomeInput = document.getElementById('crea-nome');
    const nome = nomeInput ? nomeInput.value.trim() : "";
    if (!nome) {
        alert("Inserisci un nome per il sopravvissuto!");
        return;
    }
    if (window.tempP.puntiCreazione < 0) {
        alert("Hai usato troppi punti!");
        return;
    }
    // --- FLUSSO MODIFICA (personaggio esistente, non in gioco) ---
    if (window._editMode) {
        window.tempP.nome = nome;
        if (typeof window.tempP.updateManaFromMagiaLevel === 'function') window.tempP.updateManaFromMagiaLevel();
        window.tempP.sincronizzaLivelloMedicina();

        window.tempP.puntiFeritaRealiMax = window.tempP.puntiFeritaRealiMaxBase || window.tempP.puntiFeritaRealiMax;
        if (window.tempP.puntiFeritaReali > window.tempP.puntiFeritaRealiMax) {
            window.tempP.puntiFeritaReali = window.tempP.puntiFeritaRealiMax;
        }
        window.tempP.puntiFortunaMax = hasGlobalPerk(window.tempP, 'Guerriero') ? 20 : 15;
        if (window.tempP.puntiFortuna > window.tempP.puntiFortunaMax) {
            window.tempP.puntiFortuna = window.tempP.puntiFortunaMax;
        }
        if (window.tempP.staminaAttuale > window.tempP.staminaMax) {
            window.tempP.staminaAttuale = window.tempP.staminaMax;
        }

        const idDaSalvare = window._editingCharId;
        if (idDaSalvare) window.tempP.id = idDaSalvare;

        try {
            if (idDaSalvare) {
                const response = await fetch(apiUrl(`/api/personaggi/${idDaSalvare}`), {
                    method: 'PUT',
                    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ data: JSON.stringify(window.tempP) })
                });
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || 'Errore durante il salvataggio delle modifiche');
                }
            }

            if (window._editingCharOriginalName && window._editingCharOriginalName !== nome) {
                localStorage.removeItem(`personaggio_${encodeURIComponent(window._editingCharOriginalName)}`);
                const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
                if (currentUser) {
                    const key = `user_chars_${currentUser.username}`;
                    const arr = JSON.parse(localStorage.getItem(key) || '[]').filter(n => n !== window._editingCharOriginalName);
                    if (!arr.includes(nome)) arr.push(nome);
                    localStorage.setItem(key, JSON.stringify(arr));
                }
            }

            salvaPersonaggioLocalmente(window.tempP);
            if (typeof window.saveCharacterForUser === 'function') {
                window.saveCharacterForUser(window.tempP.nome);
            }
            alert(`✅ Modifiche a "${window.tempP.nome}" salvate.`);
        } catch (err) {
            console.error('Errore salvataggio modifiche personaggio:', err);
            alert(`⚠️ Errore durante il salvataggio delle modifiche.\n${err.message}`);
            return;
        }

        window._editMode = false;
        window._editingCharId = null;
        window._editingCharWasLocale = false;
        window._editingCharOriginalName = null;
        const titleEl = document.querySelector('#modal-creazione h2');
        if (titleEl) titleEl.textContent = 'NUOVO SOPRAVVISSUTO';

        document.getElementById('modal-creazione').style.display = 'none';
        if (typeof window.renderCharacterList === 'function') window.renderCharacterList();
        return;
    }

    // --- FLUSSO CREAZIONE ORIGINALE (invariato da qui in poi) ---

    // --- 4. Calcoli finali ---
    window.tempP.puntiFeritaRealiMax = window.tempP.puntiFeritaRealiMaxBase || 5;
    window.tempP.puntiFeritaReali = window.tempP.puntiFeritaRealiMax;
    window.tempP.puntiFortunaMax = hasGlobalPerk(window.tempP, 'Guerriero') ? 20 : 15;

    if (!isRobot && hasGlobalPerk(window.tempP, 'Fuori dal mondo')) {
        const lingueDisponibili = ['Antali', 'Yakzi', 'Engenity', 'Chrimil', 'Ridulphi', 'Puleun', 'Meer', 'Eklesti'];
        let sceltaLingua = prompt(
            `Perk "Fuori dal mondo": NON conosci il Verbum. Scegli la tua lingua madre:\n${lingueDisponibili.join(", ")}`,
            "Antali"
        );
        if (!sceltaLingua || !lingueDisponibili.some(l => l.toLowerCase() === sceltaLingua.toLowerCase())) {
            alert("Scelta non valida o annullata. Assegnata lingua di default: Antali");
            sceltaLingua = "Antali";
        }
        window.tempP.lingue = [sceltaLingua.charAt(0).toUpperCase() + sceltaLingua.slice(1).toLowerCase()];
    }

    window.tempP.puntiFortuna = window.tempP.puntiFortunaMax;
    window.tempP.perkFlags = window.tempP.perkFlags || {};
    if (typeof window.tempP.updateManaFromMagiaLevel === 'function') window.tempP.updateManaFromMagiaLevel();
    window.tempP.sincronizzaLivelloMedicina();
    window.tempP.staminaAttuale = window.tempP.staminaMax;
    if (hasGlobalPerk(window.tempP, 'Schizofrenico')) {
        window.tempP.follia = 10;
        window.tempP.aggiornaSintomiFollia();
    }
    window.tempP.nome = nome;

    if (hasGlobalPerk(window.tempP, 'Guerriero')) {
        window.tempP.perkFlags.guerriero = true;
        window.tempP.guerrieroUses = 0;
    }
    if (hasGlobalPerk(window.tempP, 'Nato per combattere')) {
        window.tempP.perkFlags.natoPerCombattere = true;
    }


    if (typeof window.tempP.initInventarioBase === 'function') {
        window.tempP.initInventarioBase();
        if (typeof window.applicaPerkArmato === 'function') {
            window.applicaPerkArmato(window.tempP);
        }
        if (hasGlobalPerk(window.tempP, 'Avventuriero')) {
            window.tempP.zainoEquipaggiato = { nome: 'Zaino da Esploratore', bonus: 12, pesoUnEquipped: 0.6, grado: 6 };
            window.tempP.inventario.cibo += 1;
            window.tempP.inventario.acqua += 1;
            window.tempP.inventario.consumabili.push({ nome: 'Sacco a pelo', peso: 0.6 });
        }
    }

    // --- 5. Determinazione del tipo di utente ---
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const isMasterUser = currentUser && currentUser.role === 'master';

    // Se è Master, crea sempre direttamente (senza limiti)
        if (isMasterUser) {
        try {
            const response = await fetch(apiUrl('/api/characters'), {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    nome: window.tempP.nome,
                    classe: window.tempP.classe || 'Sopravvissuto',
                    data: JSON.stringify(window.tempP),
                    updated_at: new Date().toISOString()
                })
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Errore sconosciuto durante la creazione');
            }
            const responseData = await response.json().catch(() => ({}));
            if (responseData.character && responseData.character.id) {
                window.tempP.id = responseData.character.id;
                if (responseData.character.updated_at) window.tempP.updated_at = responseData.character.updated_at;
            }
            // Salva localmente e aggiungi al party
            salvaPersonaggioLocalmente(window.tempP);
            if (typeof window.saveCharacterForUser === 'function') {
                window.saveCharacterForUser(window.tempP.nome);
            }
            if (typeof window.aggiungiPersonaggioAlParty === 'function') {
                window.aggiungiPersonaggioAlParty(window.tempP);
            }
            alert(`✅ Personaggio "${window.tempP.nome}" creato e aggiunto al gioco!`);
        } catch (err) {
            console.error('Errore creazione personaggio master:', err);
            alert(`⚠️ Errore durante la creazione del personaggio.\n${err.message}`);
        }
        // Chiudi modal e aggiorna
        document.getElementById('modal-creazione').style.display = 'none';
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
        if (typeof window.renderCharacterList === 'function') window.renderCharacterList();
        return;
    }

    // --- 6. Caso giocatore (non master) ---
    if (directAdd) {
        // Tentativo di creazione diretta sul server
        try {
            const response = await fetch(apiUrl('/api/characters'), {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    nome: window.tempP.nome,
                    classe: window.tempP.classe || 'Sopravvissuto',
                    data: JSON.stringify(window.tempP),
                    updated_at: new Date().toISOString()
                })
            });

            if (response.status === 403) {
                const errData = await response.json().catch(() => ({}));
                alert(`❌ ${errData.error || 'Hai già 2 personaggi attivi. Eliminane uno prima di crearne un altro.'}`);
                // Non chiudiamo il modal così l'utente può decidere cosa fare
                return;
            }

                        if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Errore sconosciuto durante la creazione');
            }

            const responseData = await response.json().catch(() => ({}));
            if (responseData.character && responseData.character.id) {
                window.tempP.id = responseData.character.id;
                if (responseData.character.updated_at) window.tempP.updated_at = responseData.character.updated_at;
            }

            salvaPersonaggioLocalmente(window.tempP);
            if (typeof window.saveCharacterForUser === 'function') {
                window.saveCharacterForUser(window.tempP.nome);
            }
            if (typeof window.aggiungiPersonaggioAlParty === 'function') {
                window.aggiungiPersonaggioAlParty(window.tempP);
            }
            alert(`✅ Personaggio "${window.tempP.nome}" creato e aggiunto al gioco!`);
            if (typeof window.caricaPartyMaster === 'function') {
                await window.caricaPartyMaster();
            }

        } catch (err) {
            console.error('Errore creazione personaggio (directAdd):', err);
            alert(`⚠️ Errore durante la creazione del personaggio.\n${err.message}`);
            // In caso di errore di rete, potremmo decidere di salvare localmente come fallback?
            // Secondo le specifiche, se fallisce per limite non si salva. Per altri errori, potrebbe essere opportuno salvare localmente.
            // Quindi, se l'errore non è 403, salviamo localmente ma avvertiamo l'utente.
            if (err.message && !err.message.includes('403')) {
                salvaPersonaggioLocalmente(window.tempP);
                if (typeof window.saveCharacterForUser === 'function') {
                    window.saveCharacterForUser(window.tempP.nome);
                }
                alert(`⚠️ Personaggio salvato localmente, ma non è stato possibile attivarlo. Riprova più tardi.`);
            }
        }
    } else {
        // Creazione dalla lobby: salva solo in locale
        salvaPersonaggioLocalmente(window.tempP);
        if (typeof window.saveCharacterForUser === 'function') {
            window.saveCharacterForUser(window.tempP.nome);
        }
        alert(`✅ Personaggio "${window.tempP.nome}" salvato in locale.\nUsa il pulsante "Manda in gioco" nella lobby per renderlo attivo.`);
    }
    // --- 7. CHIUDI MODAL E AGGIORNA ---
    document.getElementById('modal-creazione').style.display = 'none';
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    if (typeof window.renderCharacterList === 'function') window.renderCharacterList();
}

function eseguiRicercaPerkSuInvio(evento, valore) {
        if (evento.key === "Enter") {
            window.perkSearchQuery = valore.toLowerCase().trim(); // Aggiunto window.
            const boxSuggerimenti = document.getElementById('perk-suggestions-list');
            if (boxSuggerimenti) boxSuggerimenti.innerHTML = "";
            renderSetupPerks();
        }
    }

    function togglePerkAffordableOnly() {
        window.perkFilterAffordableOnly = !window.perkFilterAffordableOnly; // Aggiunto window.
        renderSetupPerks();
    }

export function renderSetupPerks() {
    const container = document.getElementById('perks-setup-container');
    if (!container) return;

    const p = window.tempP;
    if (!p) return;

    // --- 1. DETERMINA SE IL PERSONAGGIO È UN ROBOT ---
    const isRobot = window.tempP && window.tempP.isRobot === true;

    // --- 2. CATEGORIE E MAPPE ---
    const perkDb = getPerkDatabase();
        const categoryOrder = [
        'background', 'competenze base', 'carisma e sociale', 'combattimento',
        'fisico e salute', 'Personalità e Fobie', 'magici', 'razziali',
        'sopravvivenza', 'studio', 'medicina'
    ];
    const isOktavia = !!(window.tempP && window.tempP.nome && window.tempP.nome.trim().toLowerCase() === 'oktavia');
    if (isOktavia) categoryOrder.push('oktavia');

    const labelMap = {
        background: 'BACKGROUND',
        'competenze base': 'COMPETENZE BASE',
        'carisma e sociale': 'CARISMA E SOCIALE',
        combattimento: 'COMBATTIMENTO',
        'fisico e salute': 'FISICO E SALUTE',
        'Personalità e Fobie': 'PERSONALITÀ E FOBIE',
        magici: 'MAGICI',
        razziali: 'RAZZIALI',
        sopravvivenza: 'SOPRAVVIVENZA',
        studio: 'STUDIO',
        medicina: 'MEDICINA',
        robotici: 'ROBOTICI',
        oktavia: 'PERK DI OKTAVIA'
    };

    // --- 3. STATO GLOBALE ---
    const searchQuery = window.perkSearchQuery || '';
    const scrollPos = container.scrollTop;
    const filterAffordable = window.perkFilterAffordableOnly || false;

    // --- 4. PULSANTI CATEGORIA ---
    let categoryButtonsHtml = '';

    if (isRobot) {
        const combattenteSbloccato = hasGlobalPerk(window.tempP, 'Combattente');
        const catsRobot = combattenteSbloccato ? ['robotici', 'combattimento'] : ['robotici'];
        if (!catsRobot.includes(categoriaCorrente)) categoriaCorrente = 'robotici';
        categoryButtonsHtml = catsRobot.map(cat => {
            const active = (cat === categoriaCorrente && !searchQuery) ? 'background:#27ae60; color:#111;' : 'background:#222; color:#fff;';
            const label = cat === 'robotici' ? 'ROBOTICI' : 'COMBATTIMENTO';
            return `<button class="btn-big" style="padding:8px 10px; font-size:0.8rem; ${active} border:1px solid #333;" onclick="cambiaCategoriaPerk('${cat}')">${label}</button>`;
        }).join('');
    } else {
        categoryOrder.forEach(cat => {
            if (!perkDb[cat] || perkDb[cat].length === 0) return;
            const active = (cat === categoriaCorrente && !searchQuery) ? 'background:#27ae60; color:#111;' : 'background:#222; color:#fff;';
            categoryButtonsHtml += `
                <button class="btn-big" style="padding:8px 10px; font-size:0.8rem; ${active} border:1px solid #333;"
                        onclick="cambiaCategoriaPerk('${cat}')">
                    ${labelMap[cat] || cat.toUpperCase()}
                </button>
            `;
        });
    }

    // --- 5. CATEGORIE DA RENDERIZZARE ---
    let categoriesToRender = [];

    if (isRobot) {
        const combattenteSbloccato = hasGlobalPerk(window.tempP, 'Combattente');
        categoriesToRender = combattenteSbloccato ? ['robotici', 'combattimento'] : ['robotici'];
        categoriesToRender = categoriesToRender.filter(c => perkDb[c] && perkDb[c].length > 0);
        if (!searchQuery) {
            categoriesToRender = categoriesToRender.filter(c => c === categoriaCorrente);
        }
    } else {
        categoriesToRender = categoryOrder.filter(cat => {
            if (!perkDb[cat] || perkDb[cat].length === 0) return false;
            if (!searchQuery) return cat === categoriaCorrente;
            return perkDb[cat].some(p =>
                p.nome.toLowerCase().includes(searchQuery) ||
                (p.desc && p.desc.toLowerCase().includes(searchQuery))
            );
        });
    }

    // --- 6. COSTRUISCI HTML ---
    let html = `
    <div class="perks-scroll-area" style="display:grid; gap:10px; overflow-y:auto; text-align:left; padding-right:6px; height:100%;">
        <!-- Barra di ricerca e filtro -->
        <div style="margin-bottom:8px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <input id="perk-search-input" type="text"
                       placeholder="Scrivi e premi INVIO per cercare..."
                       value="${searchQuery.replace(/"/g, '&quot;')}"
                       oninput="gestisciDigitazionePerk(this.value)"
                       onkeydown="eseguiRicercaPerkSuInvio(event, this.value)"
                       style="flex:1; min-width:220px; padding:10px; background:#111; color:#fff; border:1px solid #333; border-radius:8px;">
                <button class="btn-big" style="padding:10px 12px; background:${filterAffordable ? '#27ae60' : '#222'}; color:#fff; border:1px solid #333;"
                        onclick="togglePerkAffordableOnly()">
                    ${filterAffordable ? 'Mostra tutto' : 'Solo acquistabili'}
                </button>
            </div>
            <div id="perk-suggestions-list"></div>
        </div>

        <!-- Pulsanti di navigazione categoria -->
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
            ${categoryButtonsHtml}
        </div>

        <!-- Info su categoria, filtro e ricerca -->
        <div style="display:flex; gap:10px; flex-wrap:wrap; color:#aaa; font-size:0.9rem; margin-bottom:10px;">
            <div>Categoria: <strong>${isRobot ? 'ROBOTICI' : (labelMap[categoriaCorrente] || categoriaCorrente)}</strong></div>
            <div>Filtro: <strong>${filterAffordable ? 'Solo acquistabili' : 'Tutti'}</strong></div>
            ${searchQuery ? `<div>Ricerca: <strong>${searchQuery}</strong></div>` : ''}
            ${isRobot ? '<div style="color:#ff9800;">🤖 Modalità Robot attiva</div>' : ''}
        </div>
    `;

    // --- 7. RENDERIZZA PERK ---
    if (categoriesToRender.length === 0) {
        html += `
            <div style="padding:14px; background:#111; border:1px solid #333; border-radius:8px; color:#ddd;">
                ${isRobot ? 'Nessun perk robotico disponibile.' : 'Nessun perk trovato per questa ricerca o categoria.'}
            </div>
        `;
    } else {
        categoriesToRender.forEach(cat => {
            const categoryTitle = labelMap[cat] || cat.toUpperCase();
            let perks = perkDb[cat] || [];

            if (searchQuery) {
                perks = perks.filter(p =>
                    p.nome.toLowerCase().includes(searchQuery) ||
                    (p.desc && p.desc.toLowerCase().includes(searchQuery))
                );
            }

            if (filterAffordable) {
                perks = perks.filter(p => {
                    const costo = p.costo || 0;
                    return costo <= window.tempP.puntiCreazione || costo <= 0;
                });
            }

            if (perks.length === 0) return;

            perks.sort((a, b) => a.nome.localeCompare(b.nome));

            html += `
                <div style="background:#111; border:1px solid #333; border-radius:8px; padding:12px;">
                    <div style="font-size:0.95rem; margin-bottom:12px; color:#f1c40f; font-weight:bold;">${categoryTitle}</div>
                    <div style="display:grid; gap:10px;">
            `;

            perks.forEach(perk => {
                // 🔥 FIX: usa il nome del perk, non il nome del personaggio
                const nomePerkEscaped = perk.nome.replace(/'/g, "\\'");
                const selectedCount = getGlobalPerkCount(window.tempP, perk.nome);
                const giaPreso = selectedCount > 0;
                const canAfford = perk.costo <= 0 || window.tempP.puntiCreazione >= perk.costo;
                const actionAddAllowed = canAfford;
                const actionRemoveAllowed = giaPreso && perk.repeats;
                const costoHtml = `<span style="font-size:0.8rem; color:#aaa;">(${perk.costo} PT)</span>`;
                const countBadge = perk.repeats && selectedCount > 0 ?
                    `<span style="margin-left:8px; font-size:0.75rem; color:#9b59b6;">x${selectedCount}</span>` : '';

                html += `
                    <div class="stat-row" style="font-size:0.82rem; padding:12px; background:#161616; border:1px solid #222; border-radius:6px; display:flex; gap:12px; align-items:flex-start; justify-content:space-between;">
                        <div style="flex:1; text-align:left;">
                            <div style="font-weight:bold; color:#fff;">${perk.nome} ${countBadge} ${costoHtml}</div>
                            <div style="color:#ccc; margin-top:4px; line-height:1.4;">${perk.desc || ''}</div>
                            ${perk.requires ? `<div style="color:#e67e22; font-size:0.75rem; margin-top:4px;">Richiede: ${perk.requires}</div>` : ''}
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
                            ${(!giaPreso || perk.repeats) ? `
                               <button onclick="togglePerk('${nomePerkEscaped}')"
                                        style="padding:10px 14px !important; min-width:100px; background:#27ae60; color:#fff !important; border:none !important; border-radius:6px; opacity:${actionAddAllowed ? '1' : '0.45'}; cursor:${actionAddAllowed ? 'pointer' : 'not-allowed'};"
                                        ${actionAddAllowed ? '' : 'disabled'}>
                                    PRENDI
                                </button>
                            ` : ''}
                            ${perk.repeats ? `
                                <button onclick="togglePerk('${nomePerkEscaped}', true)"
                                        style="padding:10px 14px !important; min-width:100px; background:#c0392b; color:#fff !important; border:none !important; border-radius:6px; opacity:${actionRemoveAllowed ? '1' : '0.45'}; cursor:${actionRemoveAllowed ? 'pointer' : 'not-allowed'};"
                                        ${actionRemoveAllowed ? '' : 'disabled'}>
                                    RIMUOVI
                                </button>
                            ` : (giaPreso ? `
                               <button onclick="togglePerk('${nomePerkEscaped}', true)"
                                        style="padding:10px 14px !important; min-width:100px; background:#c0392b; color:#fff !important; border:none !important; border-radius:6px;">
                                    RIMUOVI
                                </button>
                            ` : '')}
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });
    }

    html += `
        </div>
    `;

    const perksPanel = container.closest('.perks-panel');
    if (perksPanel) {
        perksPanel.style.minHeight = '420px';
        perksPanel.style.height = '100%';
    }
    container.style.minHeight = '320px';
    container.style.height = '100%';
    container.innerHTML = html;
    container.scrollTop = scrollPos;
}

// Questa viene chiamata ad ogni carattere inserito, ma NON rinfresca tutti i perk. Rinfresca solo i suggerimenti.
function gestisciDigitazionePerk(valore) {
    const query = valore.toLowerCase().trim();
    const boxSuggerimenti = document.getElementById('perk-suggestions-list');
    if (!boxSuggerimenti) return;

    if (query.length < 1) {
        boxSuggerimenti.innerHTML = "";
        return;
    }

    let trovati = [];
    const db = getPerkDatabase(); // FIX: prima usava "perkDb" che non esiste in questo scope
    for (let cat in db) {
        (db[cat] || []).forEach(p => {
            if (p.nome.toLowerCase().includes(query) && !trovati.includes(p.nome)) {
                trovati.push(p.nome);
            }
        });
    }

    if (trovati.length > 0) {
        boxSuggerimenti.innerHTML = `<div style="margin-top:5px; font-size:0.8rem; color:#aaa;">Forse cercavi: ` +
            trovati.slice(0, 5).map(nome =>
                `<span onclick="cliccaSuggerimentoPerk('${nome}')" style="background:#333; color:#f1c40f; padding:2px 6px; margin-right:5px; border-radius:4px; cursor:pointer; display:inline-block; margin-bottom:4px;">${nome}</span>`
            ).join('') + `</div>`;
    } else {
        boxSuggerimenti.innerHTML = `<div style="margin-top:5px; font-size:0.8rem; color:#e74c3c;">Nessun perk corrispondente.</div>`;
    }
}

    function cliccaSuggerimentoPerk(nome) {
        window.perkSearchQuery = nome.toLowerCase().trim(); // Aggiunto window.
        const input = document.getElementById('perk-search-input');
        if (input) input.value = nome;
        document.getElementById('perk-suggestions-list').innerHTML = "";
        renderSetupPerks();
    }

    function renderSetupStats() {
    const stats = ["Forza", "Destrezza", "Costituzione", "Intelligenza", "Saggezza", "Carisma"];
    const container = document.getElementById('stats-setup-container');
    if (!container) return;

    const p = window.tempP;
    if (!p) return;

    // Assicura che puntiCreazione sia un numero
    if (typeof p.puntiCreazione !== 'number') p.puntiCreazione = 0;

    container.innerHTML = "";
    stats.forEach(s => {
        const chiave = s.toLowerCase();
        let dettagli = null;

        // 1) Prova a usare getStatDettagliata se esiste
        if (typeof p.getStatDettagliata === 'function') {
            dettagli = p.getStatDettagliata(s);
        }

        // 2) Se non c'è o non è valido, costruisci da p[chiave]
        let val, mod;
        if (dettagli && typeof dettagli.valore === 'number') {
            val = dettagli.valore;
            mod = (typeof dettagli.mod === 'number') ? dettagli.mod : Math.floor((val - 10) / 2);
        } else {
            val = (typeof p[chiave] === 'number') ? p[chiave] : 10;
            mod = Math.floor((val - 10) / 2);
        }

        // 3) Fallback estremo (non dovrebbe servire)
        if (isNaN(val)) val = 10;
        if (isNaN(mod)) mod = 0;

        const modSign = mod >= 0 ? `+${mod}` : mod;

        container.innerHTML += `
            <div class="stat-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; background:#222; padding:5px; border-radius:3px;">
                <span style="font-weight:bold; color:#f1c40f">${s.toUpperCase()} <small style="color:#aaa">(${modSign})</small></span>
                <div class="stat-controls">
                    <button onclick="modificaStat('${s}', -1)">-</button>
                    <span class="stat-value" style="display:inline-block; width:25px; text-align:center; font-weight:bold;">${val}</span>
                    <button onclick="modificaStat('${s}', 1)">+</button>
                </div>
            </div>`;
    });

    const displayPunti = document.getElementById('punti-residui');
    if (displayPunti) {
        displayPunti.innerHTML = `Punti Disponibili: <b style="color:${p.puntiCreazione < 0 ? '#e74c3c' : '#2ecc71'}">${p.puntiCreazione}</b>`;
    }
    renderSetupArtificeria();
    renderSetupArmi();
    renderSetupMagic();
}

    function renderSetupMagic() {
    const container = document.getElementById('magia-setup-container');
    if (!container) return;

    const p = window.tempP;
    if (!p) return;

    // Assicura che spellsKnown sia un oggetto
    if (!p.spellsKnown || typeof p.spellsKnown !== 'object') {
        p.spellsKnown = {0:0,1:0,2:0,3:0,4:0};
    }

    const livello = (typeof p.livelloMagia === 'number') ? p.livelloMagia : 0;
    const manaMax = (typeof p.getManaMaxFromLevel === 'function') ? p.getManaMaxFromLevel(livello) : 0;
    const attMagia = (typeof p.getCastingAttribute === 'function') ? p.getCastingAttribute() : 'Intelligenza';
    let modMagia = (typeof p.getCastingModifier === 'function') ? p.getCastingModifier() : 0;
    if (isNaN(modMagia)) modMagia = 0;
    const arcanoBonus = (typeof p.hasArcanoMastery === 'function') ? p.hasArcanoMastery() : false;

    container.innerHTML = `
    <div class="stat-row" style="display:grid; grid-template-columns: 1fr auto; gap:8px; background:#111; padding:10px; border-radius:6px; margin-top:10px;">
        <div>
            <div style="font-weight:bold; color:#f1c40f; margin-bottom:4px;">MAGIA E MANA</div>
            <div style="font-size:0.9rem; color:#ddd; margin-bottom:6px;">Usa la caratteristica più alta tra Intelligenza, Saggezza e Carisma per il lancio degli incantesimi.</div>
            <div style="font-size:0.85rem; color:#eee;">Caratteristica incantatore: <b>${attMagia}</b> (<span style="color:${modMagia >= 0 ? '#2ecc71' : '#e74c3c'}">${modMagia >= 0 ? '+' : ''}${modMagia}</span>)</div>
            <div style="font-size:0.85rem; color:#eee; margin-top:4px;">Mana massima: <b>${manaMax}</b></div>
            <div style="font-size:0.8rem; color:#aaa; margin-top:4px;">Riposo breve: +${livello} mana ogni 4 ore; riposo lungo: +${livello * 3} mana.</div>
            ${arcanoBonus ? `<div style="font-size:0.8rem; color:#7df9ff; margin-top:4px;">Arcano: +2 mana max e +1d4 rigenerati a riposo breve.</div>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; justify-content:center; align-items:flex-end;">
            <button onclick="modificaMagicLevel(-1)" style="padding:6px 10px;">-</button>
            <div style="font-weight:bold; font-size:1.25rem;">LM ${livello}</div>
            <button onclick="modificaMagicLevel(1)" style="padding:6px 10px;">+</button>
        </div>
    </div>
    <div style="margin-top:10px; display:grid; gap:8px;">
        ${[0, 1, 2, 3, 4].map(lv => {
            const maxKnow = (typeof p.getMaxKnownSpells === 'function') ? p.getMaxKnownSpells(lv) : 0;
            const current = (p.spellsKnown && typeof p.spellsKnown[lv] === 'number') ? p.spellsKnown[lv] : 0;
            const levelName = lv === 0 ? 'Trucchetti' : `Incantesimi Lv${lv}`;
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:8px 10px; border-radius:6px;">
                    <div>
                        <div style="font-weight:bold; color:#f1c40f;">${levelName}</div>
                        <div style="font-size:0.8rem; color:#aaa;">Massimo ${maxKnow} ${lv === 0 ? 'trucchetti' : 'incantesimi'}${maxKnow === 1 ? '' : ''}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button onclick="modificaIncantesimiConosciuti(${lv}, -1)" style="padding:4px 8px;">-</button>
                        <span style="width:26px; text-align:center; font-weight:bold;">${current}</span>
                        <button onclick="modificaIncantesimiConosciuti(${lv}, 1)" style="padding:4px 8px;">+</button>
                    </div>
                </div>`;
        }).join('')}
    </div>`;
}

    function getMagicLevelCost(livello) {
        const costi = [0, 1, 2, 3, 3, 4, 4, 5, 5, 6];
        return costi[Math.min(Math.max(0, livello), costi.length - 1)] || 0;
    }

    function modificaStat(stat, ammontare) {
    const p = window.tempP;
    if (!p) return;

    if (typeof p.puntiCreazione !== 'number') p.puntiCreazione = 0;
    const chiave = stat.toLowerCase();

    // Assicura che la statistica sia un numero
    if (typeof p[chiave] !== 'number') p[chiave] = 10;

    let dettagliAttuali = null;
    if (typeof p.getStatDettagliata === 'function') {
        dettagliAttuali = p.getStatDettagliata(stat);
    }
    if (!dettagliAttuali || typeof dettagliAttuali.valore !== 'number') {
        dettagliAttuali = { valore: p[chiave], mod: Math.floor((p[chiave] - 10) / 2), eccedenza: 0 };
    }

    if (ammontare === 1) {
        const costo = (typeof p.calcolaCostoStat === 'function') ? p.calcolaCostoStat(p[chiave]) : 1;
        if (p.puntiCreazione >= costo && dettagliAttuali.valore < 20 && p[chiave] < 20) {
            p.puntiCreazione -= costo;
            p[chiave]++;
        }
    } else {
        if (p[chiave] > 1) {
            if (dettagliAttuali.eccedenza > 0) {
                p[chiave]--;
            } else {
                p[chiave]--;
                const rimborso = (typeof p.calcolaCostoStat === 'function') ? p.calcolaCostoStat(p[chiave]) : 1;
                p.puntiCreazione += rimborso;
            }
        }
    }
    renderSetupStats();
}

function refundAndClearNonRobotPerks() {
    const p = window.tempP;
    if (!p) return;
    const perkDb = getPerkDatabase();
    const robotNames = (perkDb.robotici || []).map(pk => getPerkBaseName(pk.nome));
    let rimborso = 0;

    p.perks = (p.perks || []).filter(perk => {
        const nome = typeof perk === 'string' ? perk : perk.nome;
        const base = getPerkBaseName(nome);
        if (robotNames.includes(base)) return true; // tiene i perk robotici già presi
        const costo = (typeof perk === 'object' && typeof perk.costo === 'number') ? perk.costo : (getGlobalPerkData(nome)?.costo || 0);
        rimborso += costo;
        return false;
    });

    // Rimborsa livelli di Magia
    if (p.livelloMagia > 0) {
        for (let lv = 1; lv <= p.livelloMagia; lv++) rimborso += getMagicLevelCost(lv);
        p.livelloMagia = 0;
        p.spellsKnown = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
        if (typeof p.updateManaFromMagiaLevel === 'function') p.updateManaFromMagiaLevel();
    }

    // Rimborsa Artificeria creata nel builder (vedi punto 5)
    if (p.artificeria) {
        rimborso += (window.ARTIFICERIA_AG_COST || [0])[p.artificeria.generale.livello] || 0;
        (window.ARTIFICERIA_SPECS || []).forEach(spec => {
            rimborso += (window.ARTIFICERIA_SPEC_COST || [0])[p.artificeria.specializzazioni[spec].livello] || 0;
        });
        p.artificeria = {
            generale: { livello: 0, pag: 0 },
            specializzazioni: {
                Balistica: { livello: 0, ps: 0 },
                Meccanica: { livello: 0, ps: 0 },
                Elettronica: { livello: 0, ps: 0 }
            }
        };
    }

    p.puntiCreazione += rimborso;
    if (rimborso > 0) {
        alert(`Diventando Robot sono stati rimossi perk/incantesimi/artificeria non compatibili. Ti sono stati restituiti ${rimborso} punti.`);
    }
}

Personaggio.prototype.getArtistaSpecializzazione = function() {
    const perk = (this.perks || []).find(p => typeof p !== 'string' && p.nome === 'Artista');
    return perk ? perk.specializzazione : null;
};

window.refundAndClearNonRobotPerks = refundAndClearNonRobotPerks;




    window.confermaCreazione = confermaCreazione;
    window.annullaCreazione = annullaCreazione;
    window.avviaCreazione = avviaCreazione;
    window.tempP = new Personaggio("Nuovo", Math.floor((window.oreTotali || 0) / 24));
    window.tempP.puntiCreazione = 63;
    window.tempP.livelloMagia = 0;
    window.renderSetupStats = renderSetupStats;
    window.renderSetupPerks = renderSetupPerks;
    window.renderSetupMagic = renderSetupMagic;
    window.tempP.spellsKnown = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0};
    window.tempP.updateManaFromMagiaLevel && window.tempP.updateManaFromMagiaLevel();
    window.cambiaCategoriaPerk = cambiaCategoriaPerk;
window.avviaModificaPersonaggio = avviaModificaPersonaggio;
window.bindRobotCheckboxHandler = bindRobotCheckboxHandler;
    window.eseguiRicercaPerkSuInvio = eseguiRicercaPerkSuInvio;
    window.togglePerkAffordableOnly = togglePerkAffordableOnly;
    window.gestisciDigitazionePerk = gestisciDigitazionePerk;
    window.cliccaSuggerimentoPerk = cliccaSuggerimentoPerk;
    window.modificaStat = modificaStat;
    window.modificaMagicLevel = modificaMagicLevel;
    window.modificaIncantesimiConosciuti = modificaIncantesimiConosciuti;