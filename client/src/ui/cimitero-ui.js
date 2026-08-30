export async function renderCimitero() {
    const lista = document.getElementById('cimitero-lista');
    if (!lista) return;

    let cimiteroArray = [];

    try {
        const res = await fetch(window.apiUrl('/api/cimitero'), { headers: window.buildAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            const user = window.getCurrentUser ? window.getCurrentUser() : null;
            cimiteroArray = (data.cimitero || []).map(c => ({
                id: c.id,
                user_id: c.user_id,
                nome: c.nome,
                ownerUsername: c.owner_username || 'Sconosciuto',
                causa: c.data?.causaMorte || 'Ignota',
                giorni: c.data?.giorniSopravvissuto || 0,
                data: c.data?.giornoMorte ? `${c.data.giornoMorte}° Giorno` : 'Data ignota'
            }));

            // Filtro per giocatori: vedono solo i propri. Il Master vede tutti.
            if (user && user.role !== 'master') {
                cimiteroArray = cimiteroArray.filter(m => m.user_id === user.id);
            }

            window.cimitero = cimiteroArray;
        }
    } catch (e) { /* fallback su cache locale */ }

    if (cimiteroArray.length === 0) {
        lista.innerHTML = `<div style="color:#666; font-style:italic; padding:10px; text-align:center;">Il cimitero è vuoto. La fortuna assiste il party.</div>`;
        return;
    }

    lista.innerHTML = cimiteroArray.map(m => {
        const nome = (m.nome || 'Sconosciuto').toUpperCase();
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        const puoEliminare = user && (user.role === 'master' || user.id === m.user_id);
        return `
        <div class="morto-entry" style="background:#1a1a1a; padding:8px; margin-bottom:6px; border-left:3px solid #ff4444; border-radius:3px; text-align:left;">
            <b style="color:#ff4444;">💀 ${nome}</b><br>
            <small style="color:#aaa;">Di: ${m.ownerUsername}</small><br>
            <small style="color:#ccc;">Causa: ${m.causa}</small><br>
            <small style="color:#888;">Decesso: ${m.data} (Sopravvissuto ${m.giorni} giorni)</small>
            ${puoEliminare ? `<div style="margin-top:6px;"><button onclick="eliminaDefinitivamenteCaduto(${m.id}, '${nome.replace(/'/g, "\\'")}')" style="background:#c0392b !important; font-size:0.75rem; padding:4px 8px;">🗑️ ELIMINA</button></div>` : ''}
        </div>`;
    }).reverse().join("");
}

window.renderCimitero = renderCimitero;

function toggleCimitero() {
    const cim = document.getElementById('side-cimitero') || document.getElementById('modal-cimitero');
    const overlay = document.getElementById('overlay');
    if (!cim) return;
    if (cim.id === 'side-cimitero') {
        cim.classList.toggle('open');
        if (cim.classList.contains('open')) {
            overlay.style.display = 'block';
            renderCimitero();
        } else {
            overlay.style.display = 'none';
        }
    }
}

function chiudiCimitero() {
    const cim = document.getElementById('side-cimitero') || document.getElementById('modal-cimitero');
    const overlay = document.getElementById('overlay');
    if (!cim) return;
    if (cim.id === 'side-cimitero') {
        cim.classList.remove('open');
        overlay.style.display = 'none';
    } else {
        cim.style.display = 'none';
        overlay.style.display = 'none';
    }
}

async function eliminaDefinitivamenteCaduto(id, nome) {
    if (!confirm(`Eliminare definitivamente "${nome}"? Azione irreversibile.`)) return;
    try {
        const res = await fetch(window.apiUrl(`/api/personaggi/${id}`), {
            method: 'DELETE',
            headers: window.buildAuthHeaders()
        });
        if (!res.ok) throw new Error('Errore eliminazione');
        localStorage.removeItem(`personaggio_${encodeURIComponent(nome)}`);
        if (window.cimitero) {
            window.cimitero = window.cimitero.filter(m => m.id !== id);
        }
        window.mostraNotificaInAlto?.(`${nome} rimosso dal cimitero.`, 'successo');
        renderCimitero();
        // Aggiorna anche la lobby
        if (typeof window.renderCharacterList === 'function') window.renderCharacterList();
    } catch (e) {
        alert('Errore: ' + e.message);
    }
}

function applicaFolliaMortePersonaggio(morto) {
    party.forEach(p => {
        if (p === morto || p.isRobot) return;
        let tiro = rollDice(1, 8);
        if (p.hasPerk && p.hasPerk('Nichilista')) tiro = Math.floor(tiro / 2);
        if (tiro <= 0) return;
        p.follia = Math.min(20, p.follia + tiro);
        if (typeof p.aggiornaSintomiFollia === 'function') p.aggiornaSintomiFollia();
        salvaPersonaggioCloud(p);
    });
    mostraNotificaInAlto(`💀 La morte di ${morto.nome} scuote il gruppo: Follia +1d8 per tutti i non-robot.`, 'pericolo');
}
window.applicaFolliaMortePersonaggio = applicaFolliaMortePersonaggio;

function applicaFolliaSbarazzoCadavere(p) {
    if (!p || p.isRobot) return;
    if (p.hasPerk && p.hasPerk('Becchino')) {
        avviaCerimoniaBecchino(p);
        return;
    }
    let follia = rollDice(1, 4);
    if (p.hasPerk && p.hasPerk('Nichilista')) follia = Math.floor(follia / 2);
    if (follia > 0) {
        p.follia = Math.min(20, p.follia + follia);
        if (typeof p.aggiornaSintomiFollia === 'function') p.aggiornaSintomiFollia();
        mostraNotificaInAlto(`${p.nome} si sbarazza di un cadavere: Follia +${follia}.`, 'avviso');
    }
    salvaPersonaggioCloud(p);
}
window.applicaFolliaSbarazzoCadavere = applicaFolliaSbarazzoCadavere;

function avviaCerimoniaBecchino(becchino) {
    const altri = party.filter(p => p !== becchino);
    const idCerimonia = `cerimonia-${Date.now()}-${becchino.id}`;
    window._cerimonieBecchino = window._cerimonieBecchino || {};
    window._cerimonieBecchino[idCerimonia] = { becchinoId: becchino.id, partecipanti: new Set() };

    altri.forEach(dest => {
        window.inviaProposta(becchino.id, dest.id, 'cerimonia-becchino', { idCerimonia });
    });

    const azione = {
        tipo: 'cerimonia_becchino',
        oreTotali: 0.5,
        oreRimanenti: 0.5,
        onComplete: () => completaCerimoniaBecchino(idCerimonia)
    };
    if (becchino.azioneCorrente) becchino.codaAzioni.push(azione);
    else becchino.azioneCorrente = azione;
    salvaPersonaggioCloud(becchino);
    mostraNotificaInAlto(`${becchino.nome} indice una cerimonia funebre (30 min). Gli altri possono partecipare per ridurgli la Follia.`, 'info');
    aggiornaInterfaccia();
}

function completaCerimoniaBecchino(idCerimonia) {
    const cerimonia = window._cerimonieBecchino && window._cerimonieBecchino[idCerimonia];
    if (!cerimonia) return;
    const becchino = party.find(p => p.id === cerimonia.becchinoId);
    if (becchino && cerimonia.partecipanti.size > 0) {
        const modCar = becchino.getStatDettagliata('Carisma').mod;
        const riduzione = Math.max(0, rollDice(1, 4) + modCar);
        becchino.follia = Math.max(0, becchino.follia - riduzione);
        if (typeof becchino.aggiornaSintomiFollia === 'function') becchino.aggiornaSintomiFollia();
        mostraNotificaInAlto(`La cerimonia di ${becchino.nome} si conclude: Follia -${riduzione} (${cerimonia.partecipanti.size} partecipanti).`, 'successo');
        salvaPersonaggioCloud(becchino);
    } else if (becchino) {
        mostraNotificaInAlto(`La cerimonia di ${becchino.nome} si conclude senza partecipanti.`, 'info');
    }
    delete window._cerimonieBecchino[idCerimonia];
    aggiornaInterfaccia();
}

window.eliminaDefinitivamenteCaduto = eliminaDefinitivamenteCaduto;
window.toggleCimitero = toggleCimitero;
window.chiudiCimitero = chiudiCimitero;