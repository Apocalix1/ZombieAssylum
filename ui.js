let oreTotali = 0;
let party = [];
let cimitero = [];
let magazzino = { cibo: 20, acqua: 20 };
let tempP = null;

// --- UTILITY: COLORI BARRE ---
function getColoreBarra(percentuale) {
    if (percentuale > 80) return "#2ecc71"; // Verde
    if (percentuale > 50) return "#f1c40f"; // Giallo
    if (percentuale > 25) return "#e67e22"; // Arancione
    if (percentuale > 5)  return "#e74c3c"; // Rosso
    return "#000000";                       // Nero
}

// --- NUOVA LOGICA: PASSA TEMPO GLOBALE (L'unico modo per far scorrere il tempo) ---
function passaTempoGlobale() {
    let oreInput = prompt("Quante ore vuoi far passare nel mondo?", "1");
    let ore = parseInt(oreInput);
    if (isNaN(ore) || ore <= 0) return;

    for (let h = 0; h < ore; h++) {
        oreTotali += 1;
        // Eseguiamo il tick orario per ogni personaggio nel party
        for (let i = party.length - 1; i >= 0; i--) {
            const p = party[i];
            const causaMorte = p.tickOra(); // Questa funzione deve esistere in logic.js
            
            if (causaMorte) {
                alert(`CONDOGLIANZE: ${p.nome} è morto per ${causaMorte}.`);
                cimitero.push({
                    nome: p.nome,
                    causa: causaMorte,
                    giorni: Math.floor(oreTotali/24) - p.giornoInizio,
                    data: `${Math.floor(oreTotali/24)}° Giorno`
                });
                party.splice(i, 1);
            }
        }
    }
    aggiornaInterfaccia();
}

// --- AGGIORNAMENTO INTERFACCIA PRINCIPALE ---
function aggiornaInterfaccia() {
    document.getElementById('display-giorno').innerText = Math.floor(oreTotali / 24);
    let ora = oreTotali % 24;
    document.getElementById('display-ora').innerText = `${ora < 10 ? '0' : ''}${ora}:00`;
    document.getElementById('display-cibo').innerText = magazzino.cibo.toFixed(1);
    document.getElementById('display-acqua').innerText = magazzino.acqua.toFixed(1);

    const container = document.getElementById('party-container');
    container.innerHTML = "";

    party.forEach((p, idx) => {
        // Calcolo Barre con Decimali
        const risorse = [
            { label: "Fame", attuale: p.fame, max: 14 },
            { label: "Sete", attuale: p.sete, max: 4 },
            { label: "Sonno", attuale: p.sonno, max: 8 }
        ];

        let barsHtml = "";
        risorse.forEach(r => {
            let taccheHtml = "";
            const colore = getColoreBarra((r.attuale / r.max) * 100);
            for (let i = 0; i < r.max; i++) {
                let opacita = 0.2;
                if (i < Math.floor(r.attuale)) opacita = 1;
                else if (i === Math.floor(r.attuale)) opacita = 0.2 + (r.attuale % 1) * 0.8;
                taccheHtml += `<div class="tacca" style="background-color: ${colore}; opacity: ${opacita}; flex: 1; height: 8px; margin: 1px; border-radius: 1px;"></div>`;
            }
            barsHtml += `
                <div style="display: flex; justify-content: space-between; font-size: 0.65em; margin-top: 4px;">
                    <span>${r.label.toUpperCase()}</span>
                    <span>${r.attuale.toFixed(2)} / ${r.max}</span>
                </div>
                <div style="display: flex; background: #111; padding: 1px; border: 1px solid #333;">${taccheHtml}</div>
            `;
        });

        // Stato del Thread
        let statoAzione = "In attesa";
        if (p.inSpedizione) statoAzione = "<span style='color:#3498db'>🚚 IN SPEDIZIONE</span>";
        else if (p.azioneCorrente) statoAzione = `<span style='color:#f1c40f'>🔨 ${p.azioneCorrente.tipo.toUpperCase()} (${p.azioneCorrente.oreRimanenti}h)</span>`;

        let card = document.createElement('div');
        card.className = `card-personaggio ${p.inSpedizione ? 'spedizione-active' : ''}`;
        card.innerHTML = `
            <div class="card-header">
                <h3 style="margin:0">${p.nome}</h3>
                <span class="fatica-badge">Fatic. ${p.faticaTotale}</span>
            </div>
            <div style="font-size:0.7em; margin-bottom:10px;">Stato: <b>${statoAzione}</b></div>
            
            <div class="mini-bars-container">${barsHtml}</div>

            <div class="azioni-card" style="margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;">
                <button onclick="apriScheda(${idx})" title="Scheda">📋</button>
                <button onclick="pianificaAzione(${idx}, 'dormi')" title="Dormi">😴</button>
                <button onclick="toggleSpedizione(${idx})" title="Spedizione">${p.inSpedizione ? '🔙' : '🚚'}</button>
                <button onclick="nutri(${idx})" title="Nutri">🍞</button>
                <button onclick="disseta(${idx})" title="Disseta">💧</button>
                <button style="color:gray" title="Coda">${p.codaAzioni.length}</button>
            </div>
        `;
        container.appendChild(card);
    });
    renderCimitero();
}

// --- LOGICA DELLE AZIONI (Thread e Code) ---
function pianificaAzione(idx, tipo) {
    const p = party[idx];
    let ore = prompt(`Quante ore vuoi dedicare a: ${tipo.toUpperCase()}?`, tipo === 'dormi' ? "8" : "1");
    ore = parseFloat(ore);
    if (isNaN(ore) || ore <= 0) return;

    const nuovaAzione = { tipo: tipo, oreTotali: ore, oreRimanenti: ore };

    if (p.azioneCorrente) {
        if (confirm(`${p.nome} sta già facendo altro. Vuoi metterlo in coda?`)) {
            p.codaAzioni.push(nuovaAzione);
        }
    } else {
        p.azioneCorrente = nuovaAzione;
    }
    aggiornaInterfaccia();
}

function toggleSpedizione(idx) {
    party[idx].inSpedizione = !party[idx].inSpedizione;
    aggiornaInterfaccia();
}

// --- RISORSE (Istantanee, 1 Unità = 1 Tacca) ---
function nutri(idx) {
    const p = party[idx];
    let qty = prompt(`Quanto cibo dare a ${p.nome}? (Disponibile: ${magazzino.cibo})`, "1");
    qty = parseFloat(qty);
    if (isNaN(qty) || qty <= 0 || qty > magazzino.cibo) return;

    magazzino.cibo -= qty;
    if (p.fame >= 14) p.timers.buffFame = 6;
    p.fame = Math.min(16, p.fame + qty); // 1 Unità = 1 Tacca
    p.timers.fameSoddisfatta = 6;
    aggiornaInterfaccia();
}

function disseta(idx) {
    const p = party[idx];
    let qty = prompt(`Quanta acqua dare a ${p.nome}? (Disponibile: ${magazzino.acqua})`, "1");
    qty = parseFloat(qty);
    if (isNaN(qty) || qty <= 0 || qty > magazzino.acqua) return;

    magazzino.acqua -= qty;
    if (p.sete >= 4) p.timers.buffSete = 6;
    p.sete = Math.min(5, p.sete + qty); // 1 Unità = 1 Tacca
    p.timers.seteSoddisfatta = 3;
    aggiornaInterfaccia();
}

// --- CREAZIONE E SCHEDA (Invariate ma integrate) ---
function avviaCreazione() {
    const nomeInput = document.getElementById('crea-nome');
    if (nomeInput) nomeInput.value = ""; 

    // Inizializziamo il personaggio con i tuoi 30 punti
    tempP = new Personaggio("Nuovo", Math.floor(oreTotali / 24));
    tempP.puntiCreazione = 30; 

    // Visualizziamo il modal
    const modal = document.getElementById('modal-creazione');
    if(modal) modal.style.display = 'block';
    
    // Reset della categoria per sicurezza
    categoriaCorrente = "competenze base";

    // RENDERING
    renderSetupStats();
    renderSetupPerks(); // Se questa funzione non viene chiamata qui, i perk non appariranno mai

    if (nomeInput) setTimeout(() => nomeInput.focus(), 100); 
}

function renderSetupStats() {
    const stats = ["Forza", "Destrezza", "Costituzione", "Intelligenza", "Saggezza", "Carisma"];
    const container = document.getElementById('stats-setup-container');
    if (!container) return; // Sicurezza
    
    container.innerHTML = ""; // Pulisce SOLO il box delle statistiche
    stats.forEach(s => {
        const val = tempP[s.toLowerCase()];
        container.innerHTML += `
            <div class="stat-row" style="display:flex; justify-content:space-between; margin-bottom:5px; background:#222; padding:5px; border-radius:3px;">
                <span style="font-weight:bold; color:#f1c40f">${s.toUpperCase()}</span>
                <div class="stat-controls">
                    <button onclick="modificaStat('${s}', -1)">-</button>
                    <span class="stat-value" style="display:inline-block; width:25px; text-align:center">${val}</span>
                    <button onclick="modificaStat('${s}', 1)">+</button>
                </div>
            </div>`;
    });
    
    // Aggiorna il display dei punti residui
    const displayPunti = document.getElementById('punti-residui');
    if (displayPunti) {
        displayPunti.innerHTML = `Punti Disponibili: <b style="color:${tempP.puntiCreazione < 0 ? '#e74c3c' : '#2ecc71'}">${tempP.puntiCreazione}</b>`;
    }
}

function modificaStat(stat, ammontare) {
    const chiave = stat.toLowerCase();
    if (ammontare === 1) {
        const costo = tempP.calcolaCostoStat(tempP[chiave]);
        if (tempP.puntiCreazione >= costo && tempP[chiave] < 20) {
            tempP.puntiCreazione -= costo;
            tempP[chiave]++;
        }
    } else if (tempP[chiave] > 8) {
        tempP[chiave]--;
        tempP.puntiCreazione += tempP.calcolaCostoStat(tempP[chiave]);
    }
    renderSetupStats();
}

function generaHtmlStamina(p, idx) {
    let tacche = "";
    for(let i=0; i<p.staminaMax; i++) {
        const color = i < p.staminaAttuale ? "#3498db" : "#222";
        tacche += `<div style="flex:1; height:8px; background:${color}; border:1px solid #444; margin:1px;"></div>`;
    }
    return `
        <div style="margin-top:5px;">
            <div style="display:flex; justify-content:space-between; font-size:0.6em;">
                <span>STAMINA</span>
                <button onclick="riduciStaminaManual(${idx})" style="padding:0 4px; font-size:10px; background:none; color:red; border:1px solid red; cursor:pointer;">-1</button>
            </div>
            <div style="display:flex;">${tacche}</div>
        </div>
    `;
}

function riduciStaminaManual(idx) {
    if (party[idx].staminaAttuale > 0) {
        party[idx].staminaAttuale--;
        aggiornaInterfaccia();
    }
}

function confermaCreazione() {
    const nomeInput = document.getElementById('crea-nome');
    const nome = nomeInput ? nomeInput.value.trim() : "";

    if (!nome) {
        alert("Inserisci un nome per il sopravvissuto!");
        return;
    }
    if (tempP.puntiCreazione < 0) {
        alert("Hai usato troppi punti!");
        return;
    }

    // Trasferisce le competenze dai perk scelti all'array definitivo
    tempP.competenze = [];
    tempP.perks.forEach(p => {
        if (p.skills) {
            p.skills.forEach(s => {
                if (!tempP.competenze.includes(s)) tempP.competenze.push(s);
            });
        }
    });

    tempP.nome = nome;
    party.push(tempP);
    
    document.getElementById('modal-creazione').style.display = 'none';
    aggiornaInterfaccia();
}

let categoriaCorrente = "competenze base";

function renderSetupPerks() {
    const container = document.getElementById('perks-setup-container');
    if (!container) return;

    // 1. Generiamo i tasti delle categorie (Uniformi allo stile Hero)
    let html = `<div class="categoria-tabs" style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-bottom:10px;">`;
    Object.keys(DATABASE_PERK).forEach(cat => {
        const attiva = (cat === categoriaCorrente);
        html += `<button onclick="cambiaCategoriaPerk('${cat}')" 
                 style="background:${attiva ? '#e74c3c !important' : '#111 !important'}; 
                        color:${attiva ? '#111 !important' : '#e74c3c !important'};">
                 ${cat.toUpperCase()}</button>`;
    });
    html += `</div>`;

    // 2. Generiamo la lista dei perk per la categoria selezionata
    html += `<div class="perks-list" style="max-height:200px; overflow-y:auto; text-align:left;">`;
    DATABASE_PERK[categoriaCorrente].forEach(p => {
        // Controlliamo se il personaggio ha già questo perk nella lista temporanea
        const giaPreso = tempP.perks.some(perk => perk.nome === p.nome);
        
        html += `
            <div class="stat-row" style="font-size:0.8rem; padding:10px;">
                <div style="flex-grow:1;">
                    <b style="color:#f1c40f;">${p.nome}</b> <small>(${p.costo} PT)</small><br>
                    <span style="color:#888; font-size:0.7rem;">${p.desc}</span>
                </div>
                <button onclick="togglePerk('${p.nome}')" 
                        style="padding:5px 10px !important; min-width:80px; 
                        background:${giaPreso ? '#c0392b !important' : '#27ae60 !important'};
                        color:white !important; border:none !important;">
                    ${giaPreso ? 'RIMUOVI' : 'PRENDI'}
                </button>
            </div>`;
    });
    html += `</div>`;

    container.innerHTML = html;
}

function cambiaCategoriaPerk(nuovaCat) {
    categoriaCorrente = nuovaCat;
    renderSetupPerks();
}

function toggleSezionePerk() {
    const cont = document.getElementById('perks-setup-container');
    cont.style.display = (cont.style.display === 'none') ? 'block' : 'none';
    if(cont.style.display === 'block') renderSetupPerks();
}

function togglePerk(nomePerk) {
    // Troviamo i dati del perk nel database
    let perkDati = null;
    for (let cat in DATABASE_PERK) {
        let trovato = DATABASE_PERK[cat].find(p => p.nome === nomePerk);
        if (trovato) { perkDati = trovato; break; }
    }

    const index = tempP.perks.findIndex(p => p.nome === nomePerk);

    if (index > -1) {
        // Se lo ha già, lo rimuoviamo e ridiamo i punti
        tempP.perks.splice(index, 1);
        puntiCreazione += perkDati.costo;
    } else {
        // Se non lo ha, controlliamo se ha abbastanza punti
        if (puntiCreazione >= perkDati.costo) {
            tempP.perks.push(perkDati);
            puntiCreazione -= perkDati.costo;
        } else {
            alert("Punti insufficienti!");
        }
    }

    // Aggiorniamo l'interfaccia
    document.querySelector('#punti-residui b').innerText = puntiCreazione;
    renderSetupPerks();
}

function apriScheda(idx) {
    const p = party[idx];
    const modal = document.getElementById('modal-scheda');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.classList.add('scheda-dettagliata');

    // 1. Generazione 6 Quadratini Stats
    let statsHtml = `<div class="stats-grid-scheda">`;
    ["Forza", "Destrezza", "Costituzione", "Intelligenza", "Saggezza", "Carisma"].forEach(s => {
        const d = p.getStatDettagliata(s);
        const statusClass = d.mod >= 0 ? 'pos' : 'neg';
        
        statsHtml += `
            <div class="stat-card-mini">
                <div class="label">${d.nome}</div>
                <div class="mod-grande ${statusClass}">${d.mod >= 0 ? '+' : ''}${d.mod}</div>
                <div class="spiegazione-mod">
                    Base ${d.modBase >= 0 ? '+' : ''}${d.modBase}${d.info.length > 0 ? '<br>' + d.info.join('<br>') : ''}
                </div>
            </div>`;
    });
    statsHtml += `</div>`;

    // 2. Generazione Colonna Effetti Attivi
    let effettiHtml = `
        <div class="timer-column" style="text-align:left; font-size:0.85rem; background:#111; padding:12px; border-left:2px solid #ff0000;">
            <h4 style="color:#ff0000; margin-top:0; border-bottom:1px solid #333; padding-bottom:5px;">EFFETTI ATTIVI</h4>`;
    
    const displayTimer = (icon, label, time, color) => {
        if (time > 0) effettiHtml += `<p style="margin:8px 0; color:${color};">${icon} <b>${label}</b><br><small style="color:#888;">Residuo: ${time.toFixed(1)}h</small></p>`;
    };

    displayTimer("🍖", "Ben Nutrito", p.timers.buffFame, "#2ecc71");
    displayTimer("💧", "Ben Idratato", p.timers.buffSete, "#2ecc71");
    displayTimer("🧠", "Ben Riposato", p.timers.buffSonno, "#2ecc71");
    displayTimer("🍞", "Appena Mangiato", p.timers.fameSoddisfatta, "#f1c40f");
    displayTimer("🥤", "Appena Idratato", p.timers.seteSoddisfatta, "#f1c40f");
    displayTimer("🛌", "Appena Svegliato", p.timers.sonnoSoddisfatto, "#f1c40f");

    if (Object.values(p.timers).every(v => v <= 0)) effettiHtml += `<p style="color:#555;">Nessun effetto</p>`;
    effettiHtml += `</div>`;

    // 3. Render Finale Layout a 3 Colonne
    modalContent.innerHTML = `
        <h2 style="color:#ff0000; border-bottom:2px solid #ff0000; padding-bottom:10px;">${p.nome.toUpperCase()}</h2>
        <div class="scheda-grid" style="display: grid; grid-template-columns: 320px 1fr 220px; gap: 20px;">
            ${statsHtml}
            <div class="bio-column" style="text-align:left;">
                <p>🏅 <b>COMPETENZA:</b> <span style="color:#f1c40f">+${p.getBonusCompetenza()}</span></p>
                <p>⚡ <b>STAMINA:</b> <span style="color:#3498db">${p.staminaAttuale} / ${p.staminaMax}</span></p>
                <p>🏃 <b>FATICA TOTALE:</b> <span style="color:#e74c3c">${p.faticaTotale}</span></p>
                <p style="font-size:0.75em; color:#888;">${p.malusFaticaDettagliati.join(" • ")}</p>
                <hr style="border:0; border-top:1px solid #444; margin:15px 0;">
                <p style="font-size:0.85em; color:#aaa;"><b>PERK ACQUISITI:</b></p>
                <div style="font-size:0.85em; color:#eee; background:#111; padding:8px;">
                    ${p.perks.map(perk => typeof perk === 'string' ? perk : perk.nome).join(" • ") || "Nessuno"}
                </div>
            </div>
            ${effettiHtml}
        </div>
        <div class="modal-footer" style="margin-top:20px;">
            <button class="btn-hero" onclick="chiudiScheda()">CHIUDI</button>
        </div>
    `;

    modal.style.display = 'block';
}

function calcolaFaticaTotale(p) {
    let malus = 0;
    if (p.fame <= 6) malus++; // Stadio 3
    if (p.sete <= 2) malus++; // Stadio 2
    if (p.sonno <= 4) malus++; // Stadio 2
    return p.faticaBase + malus;
}

function toggleCimitero() {
    const cim = document.getElementById('side-cimitero');
    cim.classList.toggle('open');
    if(cim.classList.contains('open')) renderCimitero();
}

function renderCimitero() {
    const lista = document.getElementById('cimitero-lista');
    if (!lista) return;
    lista.innerHTML = cimitero.map(m => `<div class="morto-entry"><b>${m.nome}</b><br><small>${m.causa} - ${m.data}</small></div>`).reverse().join("");
}
function chiudiScheda() { document.getElementById('modal-scheda').style.display = 'none'; }
function annullaCreazione() { document.getElementById('modal-creazione').style.display = 'none'; }
function chiudiCimitero() {
    document.getElementById('modal-cimitero').style.display = 'none';
}

function renderParty() {
    const container = document.getElementById('party-container');
    container.innerHTML = party.map((p, idx) => `
        <div class="card-personaggio">
            <h3>${p.nome}</h3>
            <p>Fatic. ${p.faticaBase}</p>
            <div class="stat-bar"><div class="bar-fill" style="width: ${p.fame}%"></div></div>
            <div class="stat-bar"><div class="bar-fill" style="width: ${p.sete}%"></div></div>
            <div class="stat-bar"><div class="bar-fill" style="width: ${p.sonno}%"></div></div>
            <button onclick="apriScheda(${idx})">DETTAGLI</button>
        </div>
    `).join('');
}

window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = "none";
    }
}