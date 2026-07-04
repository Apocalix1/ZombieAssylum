function avviaCreazione() {
    const nomeInput = document.getElementById('crea-nome');
    if (nomeInput) nomeInput.value = ""; 

    tempP = new Personaggio("Nuovo", Math.floor(oreTotali / 24));
    tempP.puntiCreazione = 48;
    tempP.livelloMagia = 0;
    tempP.spellsKnown = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    tempP.updateManaFromMagiaLevel && tempP.updateManaFromMagiaLevel();
    tempP.staminaAttuale = tempP.staminaMax;

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

function modificaMagicLevel(delta) {
    if (!tempP) return;
    const current = tempP.livelloMagia || 0;
    if (delta > 0) {
        const next = current + 1;
        if (next > 9) return;
        const cost = getMagicLevelCost(next);
        if (tempP.puntiCreazione < cost) {
            alert('Non hai abbastanza punti creazione per aumentare il livello di magia.');
            return;
        }
        tempP.puntiCreazione -= cost;
        tempP.livelloMagia = next;
    } else if (delta < 0 && current > 0) {
        const refund = getMagicLevelCost(current);
        tempP.livelloMagia = current - 1;
        tempP.puntiCreazione += refund;
        for (let lv = tempP.livelloMagia + 1; lv <= 4; lv++) {
            if (tempP.spellsKnown && tempP.spellsKnown[lv] > 0) {
                tempP.spellsKnown[lv] = 0;
            }
        }
    }
    tempP.updateManaFromMagiaLevel && tempP.updateManaFromMagiaLevel();
    renderSetupStats();
    renderSetupPerks();
}

function modificaIncantesimiConosciuti(livello, delta) {
    if (!tempP || typeof tempP.spellsKnown !== 'object') return;
    const massimo = tempP.getMaxKnownSpells ? tempP.getMaxKnownSpells(livello) : 0;
    let attuale = tempP.spellsKnown[livello] || 0;
    if (delta > 0) {
        if (livello > tempP.livelloMagia) {
            alert('Devi sbloccare un livello di magia più alto per poter scegliere questo incantesimo.');
            return;
        }
        if (attuale >= massimo) {
            alert('Hai già raggiunto il massimo numero di incantesimi conosciuti per questo livello.');
            return;
        }
        tempP.spellsKnown[livello] = attuale + 1;
    } else if (delta < 0 && attuale > 0) {
        tempP.spellsKnown[livello] = attuale - 1;
    }
    renderSetupMagic();
}

function annullaCreazione() { document.getElementById('modal-creazione').style.display = 'none'; }

function confermaCreazione() {
    tempP.lingue = ['Vedum'];
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
    tempP.competenze = [];
    tempP.perks.forEach(p => {
        if (p.skills) {
            p.skills.forEach(s => {
                if (!tempP.competenze.includes(s)) tempP.competenze.push(s);
            });
        }
    });
    const costDettagliata = tempP.getStatDettagliata ? tempP.getStatDettagliata('Costituzione') : { valore: tempP.costituzione };
    tempP.pfMax = Math.floor(costDettagliata.valore / 2) + 5; 
    tempP.pfAttuali = tempP.pfMax;
    tempP.puntiFortunaMax = 15;
    if (hasPerk(tempP, 'Guerriero')) {
        tempP.puntiFortunaMax = 20;
    }

    if (hasPerk(tempP, 'Fuori dal mondo')) {
        const lingueDisponibili = ['Antali', 'Yakzi', 'Engenity', 'Chrimil', 'Ridulphi', 'Puleun', 'Meer', 'Eklesti'];
        
        let sceltaLingua = prompt(
            `Perk "Fuori dal mondo": NON conosci il Vedum. Scegli la tua lingua madre:\n${lingueDisponibili.join(", ")}`, 
            "Antali"
        );
        if (!sceltaLingua || !lingueDisponibili.some(l => l.toLowerCase() === sceltaLingua.toLowerCase())) {
            alert("Scelta non valida o annullata. Assegnata lingua di default: Antali");
            sceltaLingua = "Antali";
        }
        
        const linguaFormattata = sceltaLingua.charAt(0).toUpperCase() + sceltaLingua.slice(1).toLowerCase();
        
        // Riscrive l'array cancellando il Vedum e inserendo la nuova lingua
        tempP.lingue = [linguaFormattata];
    }
    tempP.puntiFortuna = tempP.puntiFortunaMax;

    // Applichiamo effetti immediati di alcuni perk
    tempP.perkFlags = tempP.perkFlags || {};
    if (typeof tempP.updateManaFromMagiaLevel === 'function') tempP.updateManaFromMagiaLevel();
    tempP.staminaAttuale = tempP.staminaMax;
    
    if (hasPerk(tempP, 'Guerriero')) {
        tempP.perkFlags.guerriero = true;
        tempP.guerrieroUses = 0;
    }
    if (hasPerk(tempP, 'Nato per combattere')) {
        tempP.perkFlags.natoPerCombattere = true;
    }

    tempP.nome = nome;
    if (typeof tempP.initInventarioBase === 'function') {
        tempP.initInventarioBase();
        if (typeof applicaPerkArmato === 'function') {
            applicaPerkArmato(tempP);
        }

        if (hasPerk(tempP, 'Avventuriero')) {
            tempP.zainoEquipaggiato = { nome: 'Zaino da Esploratore', bonus: 12, pesoUnEquipped: 0.6, grado: 6 };
            tempP.inventario.cibo += 1;
            tempP.inventario.acqua += 1;
            tempP.inventario.consumabili.push({ nome: 'Sacco a pelo', peso: 0.6 });
        }
    }

    party.push(tempP);
    if (typeof window.salvaPersonaggioCloud === 'function') {
        try {
            await window.salvaPersonaggioCloud(tempP);
        } catch (err) {
            console.warn('Errore salvataggio personaggio:', err?.message || err);
        }
    }
    if (typeof window.saveCharacterForUser === 'function') {
        window.saveCharacterForUser(tempP.nome);
    }
    document.getElementById('modal-creazione').style.display = 'none';
    aggiornaInterfaccia();
}
window.avviaCreazione = avviaCreazione;
window.annullaCreazione = annullaCreazione;
window.confermaCreazione = confermaCreazione;