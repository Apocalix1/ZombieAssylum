import { Personaggio, salvaPersonaggioLocalmente } from "../logic/logic.js";

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

function avviaCreazione(directAdd = false) {
    window.tempP = new Personaggio("Nuovo", Math.floor((window.oreTotali || 0) / 24));
    window.tempP.puntiCreazione = 48;
    window.tempP.livelloMagia = 0;
    window.tempP.spellsKnown = {0:0,1:0,2:0,3:0,4:0};
    window.tempP.updateManaFromMagiaLevel && window.tempP.updateManaFromMagiaLevel();

    const nomeInput = document.getElementById('crea-nome');
    if (nomeInput) nomeInput.value = "";
    const modal = document.getElementById('modal-creazione');
    if (modal) modal.style.display = 'block';
    categoriaCorrente = "competenze base";
    renderSetupStats();
    renderSetupPerks();

    if (nomeInput) setTimeout(() => nomeInput.focus(), 100);
    const robotCheckbox = document.getElementById('crea-robot');
    if (robotCheckbox) {
        robotCheckbox.checked = false;
        robotCheckbox.onchange = function () {
            const p = window.tempP;
            if (!p) return;

            if (this.checked) {
                p._savedHumanPerks = (p.perks || []).map(perk => typeof perk === 'string' ? perk : { ...perk });
                p._savedHumanPerkCost = getPerkSelectionCost(p._savedHumanPerks);
                refundAndClearNonRobotPerks();
                p.isRobot = true;
                categoriaCorrente = 'robotici';
            } else {
                // FIX: rimborsa il costo dei perk robotici prima di sostituirli
                const robotPerksCost = getPerkSelectionCost(p.perks);
                const restoredPerks = (p._savedHumanPerks || []).map(perk => typeof perk === 'string' ? perk : { ...perk });
                const restoredCost = getPerkSelectionCost(restoredPerks);
                const puntiDopoRimborso = (p.puntiCreazione || 0) + robotPerksCost;

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

    // Salva il flag directAdd per usarlo in confermaCreazione
    window._directAdd = directAdd;
}

function modificaMagicLevel(delta) {
    if (!window.tempP) return;
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

const SPELL_KNOWLEDGE_COST = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 };

function modificaIncantesimiConosciuti(livello, delta) {
    const p = window.tempP;
    if (!p || typeof p.spellsKnown !== 'object') return;
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

function annullaCreazione() { document.getElementById('modal-creazione').style.display = 'none'; }

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

    // --- 4. Calcoli finali ---
    window.tempP.puntiFeritaRealiMax = window.tempP.puntiFeritaRealiMaxBase || 5;
    window.tempP.puntiFeritaReali = window.tempP.puntiFeritaRealiMax;
    window.tempP.puntiFortunaMax = hasGlobalPerk(window.tempP, 'Guerriero') ? 20 : 15;

    if (!isRobot && hasGlobalPerk(window.tempP, 'Soldato')) {
        const categorie = ['Archi', 'Balestre', "Armi con l'asta", 'Lame leggere', 'Armi da fuoco', 'Rampini e fruste', 'Mazze e armi contundenti'];
        const elenco = categorie.map((c, i) => `${i + 1}) ${c}`).join('\n');
        let sceltaStr = prompt(`Perk "Soldato": scegli DUE armi (es. "1,3") in cui ottenere competenza livello 1:\n${elenco}`, '1,2');
        let indici = [...new Set((sceltaStr || '').split(',').map(s => parseInt(s.trim()) - 1).filter(i => !isNaN(i) && i >= 0 && i < categorie.length))].slice(0, 2);
        if (indici.length === 0) indici = [0, 1];
        window.tempP.armiLivello = window.tempP.armiLivello || {};
        indici.forEach(i => {
            const cat = categorie[i];
            window.tempP.armiLivello[cat] = Math.max(1, window.tempP.armiLivello[cat] || 0);
        });
    }
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

function renderSetupPerks() {
    const container = document.getElementById('perks-setup-container');
    if (!container) return;

    // --- 1. DETERMINA SE IL PERSONAGGIO È UN ROBOT ---
    const isRobot = window.tempP && window.tempP.isRobot === true;

    // --- 2. CATEGORIE E MAPPE (invariati) ---
    const perkDb = getPerkDatabase();
    const categoryOrder = [
        'background', 'competenze base', 'carisma e sociale', 'combattimento',
        'fisico e salute', 'Personalità e Fobie', 'magici', 'razziali',
        'sopravvivenza', 'studio', 'medicina'
    ];

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
        robotici: 'ROBOTICI'
    };

    // --- 3. LEGGI STATO GLOBALE ---
    const searchQuery = window.perkSearchQuery || '';
    const scrollPos = container.scrollTop;
    const filterAffordable = window.perkFilterAffordableOnly || false;

    // --- 4. COSTRUISCI I PULSANTI DI CATEGORIA ---
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

    // --- 5. DETERMINA LE CATEGORIE DA RENDERIZZARE ---
    let categoriesToRender = [];

    if (isRobot) {
        const combattenteSbloccato = hasGlobalPerk(window.tempP, 'Combattente');
        categoriesToRender = combattenteSbloccato ? ['robotici', 'combattimento'] : ['robotici'];
        categoriesToRender = categoriesToRender.filter(c => perkDb[c] && perkDb[c].length > 0);
        if (!searchQuery) {
            // FIX: rispetta il tab selezionato invece di mostrare sempre entrambe le categorie
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
    // --- 6. COSTRUISCI L'HTML ---
    let html = `
        <div style="display:grid; gap:10px; max-height:70vh; overflow-y:auto; text-align:left; padding-right:6px;">
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

    // --- 7. RENDERIZZA I PERK ---
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

            perks.forEach(p => {
                const selectedCount = getGlobalPerkCount(window.tempP, p.nome);
                const giaPreso = selectedCount > 0;
                const canAfford = p.costo <= 0 || window.tempP.puntiCreazione >= p.costo;
                const actionAddAllowed = canAfford;
                const actionRemoveAllowed = giaPreso && p.repeats;
                const costoHtml = `<span style="font-size:0.8rem; color:#aaa;">(${p.costo} PT)</span>`;
                const countBadge = p.repeats && selectedCount > 0 ?
                    `<span style="margin-left:8px; font-size:0.75rem; color:#9b59b6;">x${selectedCount}</span>` : '';

                html += `
                    <div class="stat-row" style="font-size:0.82rem; padding:12px; background:#161616; border:1px solid #222; border-radius:6px; display:flex; gap:12px; align-items:flex-start; justify-content:space-between;">
                        <div style="flex:1; text-align:left;">
                            <div style="font-weight:bold; color:#fff;">${p.nome} ${countBadge} ${costoHtml}</div>
                            <div style="color:#ccc; margin-top:4px; line-height:1.4;">${p.desc || ''}</div>
                            ${p.requires ? `<div style="color:#e67e22; font-size:0.75rem; margin-top:4px;">Richiede: ${p.requires}</div>` : ''}
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
                            ${(!giaPreso || p.repeats) ? `
                                <button onclick="togglePerk('${p.nome}')"
                                        style="padding:10px 14px !important; min-width:100px; background:#27ae60; color:#fff !important; border:none !important; border-radius:6px; opacity:${actionAddAllowed ? '1' : '0.45'}; cursor:${actionAddAllowed ? 'pointer' : 'not-allowed'};"
                                        ${actionAddAllowed ? '' : 'disabled'}>
                                    PRENDI
                                </button>
                            ` : ''}
                            ${p.repeats ? `
                                <button onclick="togglePerk('${p.nome}', true)"
                                        style="padding:10px 14px !important; min-width:100px; background:#c0392b; color:#fff !important; border:none !important; border-radius:6px; opacity:${actionRemoveAllowed ? '1' : '0.45'}; cursor:${actionRemoveAllowed ? 'pointer' : 'not-allowed'};"
                                        ${actionRemoveAllowed ? '' : 'disabled'}>
                                    RIMUOVI
                                </button>
                            ` : (giaPreso ? `
                                <button onclick="togglePerk('${p.nome}', true)"
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

        container.innerHTML = "";
        stats.forEach(s => {
            // Interroghiamo il getter dinamico per avere il valore influenzato dai perk
            const dettagli = p.getStatDettagliata ? p.getStatDettagliata(s) : {valore: p[s.toLowerCase()], mod: 0};
            const val = dettagli.valore;
            const modSign = dettagli.mod >= 0 ? `+${dettagli.mod}` : dettagli.mod;

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
        renderSetupMagic();
    }

    function renderSetupMagic() {
        const container = document.getElementById('magia-setup-container');
        if (!container) return;

        const p = window.tempP;
        if (!p) return;

        const livello = p.livelloMagia || 0;
        const manaMax = p.getManaMaxFromLevel ? p.getManaMaxFromLevel(livello) : 0;
        const attMagia = p.getCastingAttribute ? p.getCastingAttribute() : 'Intelligenza';
        const modMagia = p.getCastingModifier ? p.getCastingModifier() : 0;
        const arcanoBonus = p.hasArcanoMastery ? p.hasArcanoMastery() : false;

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
            const maxKnow = p.getMaxKnownSpells ? p.getMaxKnownSpells(lv) : 0;
            const current = p.spellsKnown && p.spellsKnown[lv] != null ? p.spellsKnown[lv] : 0;
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
        </div>
    `;
    }

    function getMagicLevelCost(livello) {
        const costi = [0, 1, 2, 3, 3, 4, 4, 5, 5, 6];
        return costi[Math.min(Math.max(0, livello), costi.length - 1)] || 0;
    }

    function modificaStat(stat, ammontare) {
        const p = window.tempP;
        if (!p) return;
        const chiave = stat.toLowerCase();
        const dettagliAttuali = p.getStatDettagliata ? p.getStatDettagliata(stat) : {valore: p[chiave], eccedenza: 0};

        if (ammontare === 1) {
            const costo = p.calcolaCostoStat(p[chiave]);
            if (p.puntiCreazione >= costo && dettagliAttuali.valore < 20 && p[chiave] < 20) {
                p.puntiCreazione -= costo;
                p[chiave]++;
            }
        } else {
            // Se la statistica reale è superiore a 5 e quella base è maggiore di 1
            if (dettagliAttuali.valore > 5 && p[chiave] > 1) {

                // CONTROLLO ECCEDENZA:
                // Se c'è eccedenza (es. il totale teorico era 22), abbassiamo la statistica base
                // MA NON restituiamo punti creazione al giocatore (perché lo schermo mostrava già 20)
                if (dettagliAttuali.eccedenza > 0) {
                    p[chiave]--;
                    // Nessun rimborso di punti creazione!
                } else {
                    // Se non c'è eccedenza, scaliamo normalmente e rimborsiamo i punti
                    p[chiave]--;
                    p.puntiCreazione += p.calcolaCostoStat(p[chiave]);
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
    window.tempP.puntiCreazione = 48;
    window.tempP.livelloMagia = 0;
    window.renderSetupStats = renderSetupStats;
    window.renderSetupPerks = renderSetupPerks;
    window.renderSetupMagic = renderSetupMagic;
    window.tempP.spellsKnown = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0};
    window.tempP.updateManaFromMagiaLevel && window.tempP.updateManaFromMagiaLevel();
    window.cambiaCategoriaPerk = cambiaCategoriaPerk;
    window.eseguiRicercaPerkSuInvio = eseguiRicercaPerkSuInvio;
    window.togglePerkAffordableOnly = togglePerkAffordableOnly;
    window.gestisciDigitazionePerk = gestisciDigitazionePerk;
    window.cliccaSuggerimentoPerk = cliccaSuggerimentoPerk;
    window.modificaStat = modificaStat;
    window.modificaMagicLevel = modificaMagicLevel;
    window.modificaIncantesimiConosciuti = modificaIncantesimiConosciuti;