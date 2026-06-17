const LOCAL_STORAGE_PREFIX = "personaggio_";

const apiBaseUrl = (() => {
    if (typeof window === 'undefined') return '';
    if (window.API_BASE) return window.API_BASE;
    if (location.port && location.port !== '4000') {
        return `${location.protocol}//${location.hostname}:4000`;
    }
    return '';
})();

function apiUrl(path) {
    return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

function nowTimestamp() {
    return new Date().toISOString();
}

function salvaPersonaggioLocalmente(personaggio) {
    const copia = { ...personaggio, updated_at: nowTimestamp() };
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${encodeURIComponent(personaggio.nome)}`, JSON.stringify(copia));
    return copia;
}

function caricaDatiDaLocalStorage(nome) {
    const datiSalvati = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${encodeURIComponent(nome)}`);
    if (!datiSalvati) return null;
    try {
        return JSON.parse(datiSalvati);
    } catch {
        return null;
    }
}

function getCurrentUser() {
    if (typeof localStorage === 'undefined') return null;
    try {
        return JSON.parse(localStorage.getItem('utente')) || null;
    } catch {
        return null;
    }
}

export async function fetchUserCharacters(userId) {
    if (!userId) return [];
    try {
        const response = await fetch(apiUrl(`/api/characters?userId=${encodeURIComponent(userId)}`));
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data.characters) ? data.characters : [];
    } catch (err) {
        console.warn('Impossibile caricare personaggi da server:', err.message || err);
        return [];
    }
}

async function inviaDatiAlServer(personaggio) {
    const user = getCurrentUser();
    const payload = {
        userId: user?.id || 1,
        nome: personaggio.nome,
        classe: personaggio.classe || 'Sopravvissuto',
        data: JSON.stringify(personaggio),
        updated_at: personaggio.updated_at || nowTimestamp()
    };

    const response = await fetch(apiUrl('/api/characters'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || `HTTP ${response.status}`);
    }

    return response.json();
}

async function sincronizzaPersonaggio(personaggioLocale) {
    const localCopy = salvaPersonaggioLocalmente(personaggioLocale);

    if (!navigator.onLine) {
        console.log('🔌 Offline: uso la copia locale.');
        return localCopy;
    }

    try {
        const user = getCurrentUser();
        const query = user?.id ? `?userId=${encodeURIComponent(user.id)}` : '';
        const response = await fetch(apiUrl(`/api/personaggi/${encodeURIComponent(localCopy.nome)}${query}`));
        if (!response.ok) {
            if (response.status === 404) {
                await inviaDatiAlServer(localCopy);
                return localCopy;
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const responseData = await response.json();
        const serverPersonaggio = responseData.personaggio;
        const serverUpdated = serverPersonaggio.updated_at ? new Date(serverPersonaggio.updated_at) : null;
        const localUpdated = localCopy.updated_at ? new Date(localCopy.updated_at) : null;

        if (!serverUpdated || (localUpdated && localUpdated >= serverUpdated)) {
            console.log('📤 Il server viene aggiornato con la copia locale.');
            await inviaDatiAlServer(localCopy);
            return localCopy;
        }

        console.log('🔄 Il server ha dati più aggiornati, aggiorno la copia locale.');
        const updatedCopy = { ...serverPersonaggio, updated_at: serverPersonaggio.updated_at };
        localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${encodeURIComponent(localCopy.nome)}`, JSON.stringify(updatedCopy));
        return updatedCopy;
    } catch (error) {
        console.log('🔌 Impossibile sincronizzare con il server:', error.message);
        return localCopy;
    }
}

export async function salvaPersonaggioCloud(personaggio) {
    personaggio.updated_at = nowTimestamp();
    salvaPersonaggioLocalmente(personaggio);
    try {
        await sincronizzaPersonaggio(personaggio);
    } catch (err) {
        console.warn('Salvataggio locale completato, sincronizzazione differita.', err?.message || err);
    }
}

export let party = [];
export class Personaggio {
    constructor(nome, giornoPartenza = 0) {
        this.nome = nome;
        this.forza = 5; this.destrezza = 5; this.costituzione = 5;
        this.intelligenza = 5; this.saggezza = 5; this.carisma = 5;

        this.fame = 14; this.sete = 4; this.sonno = 8;
        this.faticaBase = 0;
        this.follia = 0;
        this.contatoreCiboAvariato = 0;
        this.contatoreCiboDelizioso =
        this.staminaBase = 4;
        this.velcotiaBase=9;
        this.puntiFeritaRealiMaxBase = 5;
        this.puntiFeritaReali = 5;
        this.puntiFortunaMax = 15;
        this.puntiFortuna = 15;
        this.vittorieCombattimento = 0;
        this.pmMedicina = 0;
        this.livelloMedicina = 0;
        this.woundTimer = 0;
        this.woundTreated = false;
        this.medicalHealPending = false;
        this.oreRiposoAccumulate = 0;
        this.giornoInizio = giornoPartenza;

        // --- SISTEMA ARMI E PCA ---
        this.pca = {
            'Archi': 0,
            'Balestre': 0,
            'Armi con l\'asta': 0,
            'Lame leggere': 0,
            'Armi da fuoco': 0,
            'Rampini e fruste': 0,
            'Mazze e armi contundenti': 0
        };
        this.armiLivello = {
            'Archi': 0,
            'Balestre': 0,
            'Armi con l\'asta': 0,
            'Lame leggere': 0,
            'Armi da fuoco': 0,
            'Rampini e fruste': 0,
            'Mazze e armi contundenti': 0
        };
        this.allattributeMax = {}; // tracciare max per ogni attributo
        this.oreAllenamento = 0;
        this.ultimoGiornoAllenamento = 0;

        this.apprendimento = {}; // progresso di studio per materia
        this.oreStudioPerMateria = {}; // ore accumulate per materia
        this.oreStudioGiornaliere = 0;
        this.studyOverload = false;
        this.masteries = [];
        this.vantaggi = {}; // { 'Intelligenza': true, 'sopravvivenza': true }
        this.svantaggi = {}; // same shape for disadvantages
        this.ultimoGiornoStudio = 0;
        this.ultimoStudioOre = 0;

        // --- SISTEMA THREAD ---
        this.azioneCorrente = null; // { tipo: 'dormi', oreRimanenti: 5, oreTotali: 5 }
        this.codaAzioni = [];
        this.inSpedizione = false;

        //competenze
        this.timers = { fameSoddisfatta: 0, seteSoddisfatta: 0, sonnoSoddisfatto: 0, buffFame: 0, buffSete: 0, buffSonno: 0 };
        this.masteries = [];
        this.inventory = []; // array of item keys/names the character carries
        this.staminaRegenTimer = 0;
        this.competenze = []; // Array di stringhe: ["Atletica", "Acrobazia"]
        this.perks = [];      // Array di oggetti perk scelti
        this.puntiCreazione = 48;
        this.livelloMagia = 0;
        this.manaMax = 0;
        this.manaAttuale = 0;
        this.spellsKnown = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
        this.manaRiposoTimer = 0;
        this.lingue = ['Verbum'];
        this.piattiDeliziosi = 0;
        this.autoRisorse = { fame: null, sete: null, sonno: null };
        // Robot-specific defaults
        this.isRobot = false; // flag if this character is a robot
        this.robotPFMax = 40; // single HP pool for robots
        this.robotPF = 40; // current robot HP
        this.robotRepairTotalDone = 0; // total PF recovered by repairs across adventure (limit)
        this.robotRepairTotalLimit = 50; // max PF recoverable in entire adventure
        this.robotMicroRepairsUsed = 0; // count of micro-repairs since last full repair
        // Battery Arcana (hours)
        this.batteryHours = 4 * 24; // starts with 4 days = 96 hours
        this.batteryHoursMax = 7 * 24; // full battery = 7 days = 168 hours
        // Three Laws enforcement (behavioral rules)
        this.robotThreeLaws = true;
    }

    // ---- Robot-specific methods ----
    becomeRobot() {
        if (this.isRobot) return;
        this.isRobot = true;
        // Remove biological needs
        this.fame = 0; this.sete = 0; this.sonno = 0;
        this.perks = []; // robot perks should be assigned separately
        this.puntiCreazione = Math.max(0, this.puntiCreazione - 6);
        this.robotPF = this.robotPFMax;
        this.robotRepairTotalDone = 0;
        this.robotMicroRepairsUsed = 0;
    }

    revertToHuman() {
        if (!this.isRobot) return;
        this.isRobot = false;
        // restore some defaults
        this.fame = 14; this.sete = 4; this.sonno = 8;
    }

    absorbMagicItem(rarity) {
        // rarity: 'comune'|'non_comune'|'raro'|'super_raro'
        const map = { comune: 5, non_comune: 10, raro: 25, super_raro: 55 };
        const add = map[rarity] || 0;
        this.batteryHours = Math.min(this.batteryHoursMax, (this.batteryHours || 0) + add);
        return add;
    }

    consumeBattery(hours) {
        if (!this.isRobot) return;
        this.batteryHours = Math.max(0, (this.batteryHours || 0) - (hours || 0));
    }

    onAllyStaminaLost(barsLost) {
        if (!this.isRobot) return;
        const hours = (barsLost || 0) * 3; // rule: ogni barra stamina persa -> 3 ore batteria
        this.consumeBattery(hours);
    }

    applyDamage(amount) {
        if (this.isRobot) {
            this.robotPF = Math.max(0, this.robotPF - Math.floor(amount));
            return this.robotPF <= 0 ? 'distrutto' : 'danneggiato';
        }
        // fallback for biological characters: reduce puntiFeritaReali
        this.puntiFeritaReali = Math.max(0, this.puntiFeritaReali - Math.floor(amount));
        return this.puntiFeritaReali <= 0 ? 'morto' : 'ferito';
    }

    repairRobot(amount) {
        if (!this.isRobot) return false;
        // amount = PF to restore
        const canRecoverLeft = Math.max(0, this.robotRepairTotalLimit - this.robotRepairTotalDone);
        if (canRecoverLeft <= 0) return false;
        const toRecover = Math.min(amount, canRecoverLeft);
        // full repair cannot recover more than 50% of current max
        const maxRecoverPerFull = Math.floor(this.robotPFMax * 0.5);
        const actual = Math.min(toRecover, maxRecoverPerFull);
        this.robotPF = Math.min(this.robotPFMax, this.robotPF + actual);
        this.robotRepairTotalDone += actual;
        // after a full repair reset micro repairs counter
        this.robotMicroRepairsUsed = 0;
        // decrease robotPFMax to current robotPF as structural limit
        this.robotPFMax = Math.max(this.robotPF, this.robotPFMax);
        return true;
    }

    microRepair(amount) {
        if (!this.isRobot) return false;
        // micro repairs recover < 1/3 of max PF and up to 2 times before a full repair
        const limit = Math.floor(this.robotPFMax / 3);
        if (amount > limit) return false;
        if (this.robotMicroRepairsUsed >= 2) return false;
        const canRecoverLeft = Math.max(0, this.robotRepairTotalLimit - this.robotRepairTotalDone);
        if (canRecoverLeft <= 0) return false;
        const actual = Math.min(amount, canRecoverLeft);
        this.robotPF = Math.min(this.robotPFMax, this.robotPF + actual);
        this.robotRepairTotalDone += actual;
        this.robotMicroRepairsUsed += 1;
        return true;
    }


    get stadioFame() {
        let f = this.fame + (this.timers.fameSoddisfatta > 0 ? 3.5 : 0);
        if (f >= 12) return 0;
        if (f >= 9) return 1;
        if (f >= 7) return 2;
        if (f >= 4) return 3;
        if (f >= 1) return 4;
        return 5;
    }

    get stadioSete() {
        let s = this.sete + (this.timers.seteSoddisfatta > 0 ? 1 : 0);
        if (s >= 4) return 0;
        if (s >= 3) return 1;
        if (s >= 2) return 2;
        if (s >= 1) return 3;
        return 4;
    }

    get stadioSonno() {
        let sn = this.sonno + (this.timers.sonnoSoddisfatto > 0 ? 2 : 0);
        if (sn >= 7) return 0;
        if (sn >= 5) return 1;
        if (sn >= 3) return 2;
        if (sn >= 1) return 3;
        return 4;
    }

    get descrizioneFollia() {
    const f = this.follia;
    if (f <= 8) return "Stabile (Nessun sintomo)";
    if (f <= 15) return "Ossessioni, tic nervosi e comportamenti impulsivi";
    if (f <= 17) return "Tratti peggiori amplificati notevolmente";
    if (f <= 19) return "Allucinazioni visive e uditive persistenti";
    return "Totalmente Impazzito (Irrecuperabile - Sostituire personaggio)";
    }

    get faticaTotale() {
        if (this.isRobot) return 0;
        let f = this.faticaBase;
        if (this.stadioFame >= 3) f += 1;
        if (this.stadioSete >= 2) f += 1;
        if (this.stadioSonno >= 2) f += 1;
        if (this.puntiFeritaReali <= 2 && this.puntiFeritaReali > 0) {
            f += 2;
        }
        return Math.min(6, Math.max(0, f));
    }

    get staminaMax() {
    if (this.isRobot) return 99;
    let s = this.staminaBase;

    // --- 1. MODIFICATORI DEI PERK (Permanenti) ---
    if (this.perks && this.perks.length > 0) {
        // Controlliamo la presenza dei perk usando l'oggetto
        if (this.perks.some(p => p.nome === "Atleta")) {
            s += 1;
        }
        if (this.perks.some(p => p.nome === "Obeso")) {
            s -= 2;
        }
        if (this.perks.some(p => p.nome === "Sottopeso" || p.nome === "Sovrappeso")) { 
            // Gestisce sia il 'Sottopeso' del listino che il 'Sovrapeso' della tua richiesta
            s -= 1;
        }
        if (this.perks.some(p => p.nome && p.nome.startsWith("Anziana"))) {
            s -= 1;
        }
    }

    // --- 2. MODIFICATORE DI FORZA (Dinamico) ---
    s += this.getStatDettagliata('Forza').mod;
    if (this.stadioFame >= 2) s -= 1;
    if (this.stadioSete >= 3) s -= 2;
    if (this.faticaTotale >= 2) s -= 1;
    
    if (this.puntiFeritaReali <= 3 && this.puntiFeritaReali > 0) {
        s -= 1;
    }
    
    // Crollo totale da fatica estrema
    if (this.faticaTotale >= 5) {
        s = 1;
    }

    return Math.max(0, s);


    // --- IL "CERVELLO" DELLE STATISTICHE ---
getStatDettagliata(statNome) {
    const nomeLower = statNome.toLowerCase();
    let valoreBase = this[nomeLower];
    let motivi = [];

    // --- 1. APPLICAZIONE DEI PERK ---
    if (this.perks && this.perks.length > 0) {
        const haPerk = (nome) => this.perks.some(p => p.nome === nome);
        const haAnzianaVariante = (variante) => this.perks.some(p => p.nome === variante);
        const eAnziana = this.perks.some(p => p.nome && p.nome.startsWith("Anziana"));

        if (statNome === "Forza") {
            if (haPerk("Palestrato")) { valoreBase += 1; motivi.push("Palestrato (+1)"); }
            if (haPerk("Grande taglia")) { valoreBase += 2; motivi.push("Grande taglia (+2)"); }
            if (haPerk("Piccola taglia")) { valoreBase -= 2; motivi.push("Piccola taglia (-2)"); }
            if (haPerk("Anoressico")) { valoreBase -= 2; motivi.push("Anoressico (-2)"); }
            if (haPerk("Sottopeso")) { valoreBase -= 1; motivi.push("Sottopeso (-1)"); }
            if (eAnziana) { valoreBase -= 1; motivi.push("Anziana (-1)"); }
        }
        if (statNome === "Costituzione") {
            if (haPerk("Palestrato")) { valoreBase += 1; motivi.push("Palestrato (+1)"); }
            if (haPerk("Grande taglia")) { valoreBase += 1; motivi.push("Grande taglia (+1)"); }
            if (haPerk("Anoressico")) { valoreBase -= 1; motivi.push("Anoressico (-1)"); }
            if (haPerk("Obeso")) { valoreBase += 2; motivi.push("Obeso (+2)"); }
            if (eAnziana) { valoreBase -= 1; motivi.push("Anziana (-1)"); }
        }
        if (statNome === "Destrezza") {
            if (haPerk("Piccola taglia")) { valoreBase += 2; motivi.push("Piccola taglia (+2)"); }
        }
        if (statNome === "Carisma") {
            if (haPerk("Bel Viso")) { valoreBase += 1; motivi.push("Bel Viso (+1)"); }
            if (haAnzianaVariante("Anziana_Bilanciata")) { valoreBase += 1; motivi.push("Anziana Saggia (+1)"); }
            if (haAnzianaVariante("Anziana_Carisma")) { valoreBase += 2; motivi.push("Anziana Carismatica (+2)"); }
        }
        if (statNome === "Saggezza") {
            if (haAnzianaVariante("Anziana_Bilanciata")) { valoreBase += 1; motivi.push("Anziana Saggia (+1)"); }
            if (haAnzianaVariante("Anziana_Saggezza")) { valoreBase += 2; motivi.push("Anziana Venerabile (+2)"); }
        }
    }

    // Calcoliamo l'eccedenza prima di tagliare al cap di 20
    let eccedenza = 0;
    if (valoreBase > 20) {
        eccedenza = valoreBase - 20;
        valoreBase = 20;
        motivi.push(`Cap Massimo Raggiunto (Eccedenza: +${eccedenza})`);
    }

    // --- 2. CALCOLO DEI MODIFICATORI FONDAMENTALI ---
    let modBase = Math.floor((valoreBase - 10) / 2);
    let modFinale = modBase;

    // --- 3. BUFF TEMPORANEI ---
    if (this.timers.buffFame > 0 && (statNome === "Forza" || statNome === "Costituzione")) modFinale += 1;
    if (this.timers.buffSete > 0 && (statNome === "Destrezza" || statNome === "Intelligenza")) modFinale += 1;
    if (this.timers.buffSonno > 0 && (statNome === "Saggezza" || statNome === "Carisma")) modFinale += 1;

    // --- 4. DEBUFF TEMPORANEI ---
    if (statNome === "Forza" && this.stadioFame >= 1) modFinale -= 2;
    if (statNome === "Costituzione" && this.stadioFame >= 4) modFinale -= 2;
    if ((statNome === "Intelligenza" || statNome === "Destrezza") && this.stadioSete >= 1) modFinale -= 2;
    if ((statNome === "Carisma" || statNome === "Saggezza") && this.stadioSonno >= 1) modFinale -= 2;

    return {
        nome: statNome.toUpperCase(),
        valore: valoreBase, 
        eccedenza: eccedenza, // <--- IMPORTANTISSIMO PER IL TASTO MENO
        mod: modFinale,
        modBase: modBase,
        info: motivi 
    };
}

getCastingAttribute() {
    // Scegli la caratteristica da incantatore in base al modificatore FISSO base (modBase),
    // ignorando buff/debuff temporanei che influenzano il valore corrente.
    const candidates = ['Intelligenza', 'Saggezza', 'Carisma'];
    let best = candidates[0];
    let bestMod = -Infinity;
    for (const attr of candidates) {
        const det = this.getStatDettagliata ? this.getStatDettagliata(attr) : null;
        const modBase = det ? (typeof det.modBase === 'number' ? det.modBase : det.mod) : (this[attr.toLowerCase()] || 0);
        if (modBase > bestMod) {
            bestMod = modBase;
            best = attr;
        }
    }
    return best;
}

getCastingModifier() {
    return this.getStatDettagliata(this.getCastingAttribute()).mod;
}

hasArcanoMastery() {
    const normalized = (this.masteries || []).map(m => String(m || '').toLowerCase());
    return this.livelloMagia >= 5 || normalized.includes('arcano');
}

getManaMaxFromLevel(livello) {
    const manaPerLivello = [0, 4, 6, 9, 12, 16, 20, 24, 28, 32];
    const base = manaPerLivello[Math.min(Math.max(0, livello), manaPerLivello.length - 1)] || 0;
    const bonusPerk = this.perks && this.perks.some(p => p.nome === 'Apprendista mago') ? 4 : 0;
    return base + bonusPerk + (this.hasArcanoMastery() ? 2 : 0);
}

getManaSpellCost(livelloIncantesimo) {
    const costi = { 0: 1, 1: 2, 2: 4, 3: 7, 4: 11 };
    return costi[Math.min(Math.max(0, livelloIncantesimo), 4)] || 0;
}

getMaxKnownSpells(livelloIncantesimo) {
    if (this.livelloMagia < livelloIncantesimo) return 0;
    const maxSpells = { 0: 2, 1: 3, 2: 2, 3: 2, 4: 1 };
    return maxSpells[livelloIncantesimo] || 0;
}

getManaOverloadPenalty() {
    return Math.max(0, -Math.min(0, this.manaAttuale));
}

updateManaFromMagiaLevel() {
    const nuovaMax = this.getManaMaxFromLevel(this.livelloMagia);
    this.manaMax = nuovaMax;
    if (this.manaAttuale == null || this.manaAttuale <= 0) {
        this.manaAttuale = nuovaMax;
    } else {
        this.manaAttuale = Math.min(this.manaAttuale, nuovaMax);
    }
}

getManaRecoveryPerShortRest() {
    const base = Math.max(0, this.livelloMagia);
    if (!base) return 0;
    let recovery = base;
    if (this.hasArcanoMastery()) {
        recovery += rollDice(1, 4);
    }
    return recovery;
}

getManaRecoveryOnLongRest() {
    return this.livelloMagia;
}

isRestAction() {
    if (this.isRobot) return false;
    if (this.inSpedizione) return false;
    const nonRestTypes = ['esplora', 'allenamento', 'medicina', 'spedizione'];
    return !this.azioneCorrente || !nonRestTypes.includes(this.azioneCorrente.tipo);
}

getRestMultiplier() {
    if (!this.isRestAction()) return 0;

    let multiplier = 1;
    const halfRestActions = ['cucina', 'conserva', 'studio', 'studio-libro', 'alchimia', 'alchimia-assistenza', 'artificeria'];
    if (this.azioneCorrente && halfRestActions.includes(this.azioneCorrente.tipo)) {
        multiplier *= 0.5;
    }
    if (this.azioneCorrente && this.azioneCorrente.tipo === 'dormi') {
        multiplier *= 1.5;
    }
    if (this.timers.buffFame > 0) multiplier += 0.2;
    if (this.timers.buffSete > 0) multiplier += 0.2;
    if (this.timers.buffSonno > 0) multiplier += 0.2;
    multiplier -= 0.2 * this.faticaTotale;
    return Math.max(0, multiplier);
}

canSpendMana(costo) {
    if (typeof costo !== 'number' || costo <= 0) return true;
    const sogliaNegativa = Math.max(1, this.livelloMagia);
    return this.manaAttuale - costo >= -sogliaNegativa;
}

spendMana(costo) {
    if (!this.canSpendMana(costo)) return false;
    this.manaAttuale -= costo;
    return true;
}

getBonusCompetenza() {
    const giorniAttivi = Math.floor(oreTotali / 24) - this.giornoInizio;
    if (giorniAttivi < 10) return 2;
    if (giorniAttivi < 20
        
    ) return 3;
    if (giorniAttivi < 40) return 4;
    return 5;
}
    // --- SISTEMA COMPETENZE (calcolo rating per abilità basato su perk e malus) ---
getPerkSkillCounts() {
        const counts = {};
        this.perks.forEach(perk => {
            if (!perk) return;
            const p = (typeof perk === 'string') ? null : perk;
            if (p && Array.isArray(p.skills)) {
                p.skills.forEach(s => {
                    const key = (s || '').toLowerCase().trim();
                    counts[key] = (counts[key] || 0) + 1;
                });
            }
        });
        // Include competenze apprese manualmente
        if (Array.isArray(this.competenze)) {
            this.competenze.forEach(s => {
                const key = (s || '').toLowerCase().trim();
                if (key) counts[key] = (counts[key] || 0) + 1;
            });
        }
        return counts;
    }

getSkillRating(skill) {
    if (!skill) return 0;
    const skillKey = skill.toLowerCase().trim();
    let punteggioAbilita = 0;

    if (this.perks && Array.isArray(this.perks)) {
        this.perks.forEach(perk => {
            if (!perk) return;

            // 1. Controlla le competenze (+1)
            if (perk.skills && Array.isArray(perk.skills)) {
                if (perk.skills.map(s => s.toLowerCase().trim()).includes(skillKey)) {
                    punteggioAbilita += 1;
                }
            }

            // 2. Controlla gli svantaggi dal nuovo array JSON (-1)
            if (perk.disadvantages && Array.isArray(perk.disadvantages)) {
                if (perk.disadvantages.map(s => s.toLowerCase().trim()).includes(skillKey)) {
                    punteggioAbilita -= 1;
                }
            }
        });
    }
    if (this.competenze && Array.isArray(this.competenze)) {
        if (this.competenze.map(c => c.toLowerCase().trim()).includes(skillKey)) {
            punteggioAbilita += 1;
        }
    }
    return Math.max(-2, Math.min(2, punteggioAbilita));
}

getSkillModifierForCheck(skill) {
    const rating = this.getSkillRating(skill);
    const skillKey = (skill || '').toLowerCase().trim();
    
    // Mappatura Abilità -> Statistica Madre
    const map = {
        'atletica': 'Forza', 'acrobazia': 'Destrezza', 'acrobazie': 'Destrezza', 'sopravvivenza': 'Saggezza',
        'inganno': 'Carisma', 'indagare': 'Intelligenza', 'giochi di carte': 'Carisma', 'rapidità di mano': 'Destrezza',
        'percezione': 'Saggezza', 'persuasione': 'Carisma', 'furtività': 'Destrezza', 'manodopera': 'Destrezza'
    };
    const attr = map[skillKey] || map[skill.charAt(0).toUpperCase() + skill.slice(1)] || 'Intelligenza';
    
    const attrMod = this.getStatDettagliata(attr).mod;
    const prof = this.getBonusCompetenza();

    let modifier = attrMod;
    let sbloccaNuovaAbilita = false;
    let svantaggioMeccanico = false;

    // --- REGOLE DA 1 A 10 APPLICATE QUI ---
    if (rating === 2) {
        // "Se è a 2 aggiunge il bonus competenza 2 volte (e sblocca una nuova abilità)"
        modifier = attrMod + (prof * 2);
        sbloccaNuovaAbilita = true; 
    } 
    else if (rating === 1) {
        // "Se è a 1 aggiunge il bonus competenza"
        modifier = attrMod + prof;
    } 
    else if (rating === -1) {
        // "Se è a meno 1 il simulatore prende il risultato peggiore (Svantaggio)"
        modifier = attrMod; // Nessun bonus numerico
        svantaggioMeccanico = true; // Attiva il doppio lancio protetto
    } 
    else if (rating === -2) {
        // "Se è a meno 2 al lancio con svantaggio si sottrae -3"
        modifier = attrMod - 3; // Sottrae -3 fisso al modificatore
        svantaggioMeccanico = true; // Mantiene lo svantaggio di lancio
    }

    // --- GESTIONE DEL VANTAGGIO / SVANTAGGIO DA FLAGG ESTERNI ---
    const advantage = !!(this.vantaggi && (this.vantaggi[attr] || this.vantaggi[skillKey]));
    const disadvantageFromFlags = !!(this.svantaggi && (this.svantaggi[attr] || this.svantaggi[skillKey]));
    
    // Studio Overload: colpisce solo le statistiche mentali (Intelligenza, Saggezza, Carisma)
    const overloadDisadvantage = this.studyOverload && ['Intelligenza', 'Saggezza', 'Carisma'].includes(attr);
    // Fatica epica
    const fatigueDisadvantage = this.faticaTotale >= 1;

    // Uniamo i pezzi: hai svantaggio se lo dice il rating (-1 o -2) o gli effetti ambientali
    let disadvantage = false;
    if (!advantage) {
        disadvantage = svantaggioMeccanico || disadvantageFromFlags || overloadDisadvantage || fatigueDisadvantage;
    }

    return { 
        modifier: modifier, 
        advantage: advantage, 
        disadvantage: disadvantage,
        sbloccaMaestria: sbloccaNuovaAbilita // Passiamo l'informazione alla UI del gioco
    };
}

    resetDailyStudy(currentHour) {
        if (this.ultimoStudioOre && currentHour - this.ultimoStudioOre >= 8) {
            this.oreStudioGiornaliere = 0;
            this.studyOverload = false;
            this.ultimoStudioOre = 0;
        }
    }

    adjustStaminaForMaxChange() {
        // Se staminaMax si riduce, riduci anche staminaAttuale proporzionalmente
        const currentMax = this.staminaMax;
        if (this.staminaAttuale > currentMax) {
            this.staminaAttuale = Math.max(0, currentMax);
        }
    }

    rollExplorationCheck() {
        // Tiro per Sopravvivenza: 1d20 + mod Saggezza + bonus competenza
        // Se maestria: competenza x2
        const sagMod = this.getStatDettagliata('Saggezza').mod;
        let competenzaBonus = 0;
        const bonus = this.getBonusCompetenza();

        if (this.masteries && this.masteries.map(m => m.toLowerCase()).includes('sopravvivenza')) {
            competenzaBonus = bonus * 2;
        } else if (this.competenze.some(c => c.toLowerCase() === 'sopravvivenza')) {
            competenzaBonus = bonus;
        }

        const d20 = Math.floor(Math.random() * 20) + 1;
        const total = d20 + sagMod + competenzaBonus;
        return { d20, sagMod, competenzaBonus, total };
    }

    getStudyPoints(skill) {
        const key = (skill || '').toLowerCase().trim();
        let points = this.apprendimento[skill] || 0;
        if (this.hasCompetenza(skill) && points < 70) points = 70;
        if (this.masteries && this.masteries.map(m => m.toLowerCase()).includes(key) && points < 210) points = 210;
        return points;
    }

hasCompetenza(skill) {
        const key = (skill || '').toLowerCase().trim();
        if (this.competenze.some(s => (s || '').toLowerCase().trim() === key)) return true;
        if (this.masteries && this.masteries.map(m => m.toLowerCase()).includes(key)) return true;
        const counts = this.getPerkSkillCounts();
        return (counts[key] || 0) > 0;
    }

    get woundState() {
        if (this.isRobot) {
            const pf = this.robotPF;
            const max = this.robotPFMax;
            if (pf >= max * 0.8) return "Illeso (Robot)";
            if (pf >= max * 0.6) return "Danno lieve (Robot)";
            if (pf >= max * 0.4) return "Danno profondo (Robot)";
            if (pf >= max * 0.2) return "Funzionalità a rischio (Robot)";
            if (pf >= 1) return "Rischio di distruzione (Robot)";
            return "Distrutto";
        }
        const pf = this.puntiFeritaReali;
        const max = this.puntiFeritaRealiMax;
        if (pf >= max * 0.8) return "Illeso";
        if (pf >= max * 0.6) return "Ferita lieve";
        if (pf >= max * 0.4) return "Ferita profonda";
        if (pf >= max * 0.2) return "Funzionalità a rischio";
        if (pf >= 1) return "Rischio di morte";
        return "Morto";
    }

    registraVittoriaCombattimento() {
        this.vittorieCombattimento += 1;
        if (this.vittorieCombattimento % 2 === 0) {
            const effMax = this.puntiFortunaMaxEffettivo;
            this.puntiFortuna = Math.min(effMax, this.puntiFortuna + 1);
        }
    }

    get woundEffectText() {
        switch (this.woundState) {
            case "Ferita lieve": return "30% peggiora dopo 5h se non curata";
            case "Ferita profonda": return "Dopo 3h diventa Funzionalità a rischio";
            case "Funzionalità a rischio": return "Dopo 1h diventa Rischio di morte, +2 fatica";
            case "Rischio di morte": return "Dopo 10 min: morte. Il personaggio è privo di sensi";
            case "Morto": return "Personaggio deceduto";
            default: return "Nessun danno reale";
        }
    }

    get constitutionModifier() {
        return this.getStatDettagliata("Costituzione").mod;
    }

    get woundTimeBase() {
        switch (this.woundState) {
            case "Ferita lieve": return 6;
            case "Ferita profonda": return 3;
            case "Funzionalità a rischio": return 1;
            case "Rischio di morte": return 0.1667;
            default: return 0;
        }
    }

    get woundTimeToWorsen() {
        const base = this.woundTimeBase;
        // ogni +1 al modificatore di Costituzione riduce del 5% il tempo; ogni -1 lo aumenta del 5%
        const factor = 1 - (this.constitutionModifier * 0.05);
        return Math.max(0.5, base * factor);
    }
    aggiungiFolliaPerEvento(causa) {
    if (this.follia >= 20) return;

    let tiro = 0;
    let logCausa = "";

    switch (causa) {
        case 'avariato':
            tiro = Math.floor(Math.random() * 4) + 1; // 1d4
            logCausa = "Ingestione di 3 cibi avariati";
            break;
        case 'fobia':
            tiro = Math.floor(Math.random() * 6) + 1; // 1d6
            logCausa = "Innesco da Perk Fobia";
            break;
        case 'trauma':
            tiro = Math.floor(Math.random() * 8) + 1; // 1d8
            logCausa = "Morte di un compagno / Pericolo estremo";
            break;
        case 'rianimazione':
            tiro = Math.floor(Math.random() * 10) + 1; // 1d10
            logCausa = "Rischio di Morte / Rianimazione / Mutilazione";
            break;
        default:
            return;
    }

    // --- LOGICA PERK ANSIOSO ---
    let bonusAnsioso = 0;
    if (this.perks && this.perks.some(p => p.nome === "Ansioso")) {
        bonusAnsioso = 1;
        logCausa += " (+1 da Ansioso)";
    }
    // ---------------------------

    const totaleAumento = tiro + bonusAnsioso;
    this.follia = Math.min(20, this.follia + totaleAumento);
    
    mostraNotificaInAlto(`⚠️ La mente di ${this.nome} vacilla! Follia aumentata per: ${logCausa}. (Totale: ${this.follia})`, "pericolo");

    if (this.follia >= 20) {
        mostraNotificaInAlto(`💀 DISASTRO: ${this.nome} è impazzito del tutto ed è irrecuperabile!`, "pericolo");
    }
}

    nutriSpeciale(tipoCibo) {
    if (tipoCibo === 'avariato') {
        this.contatoreCiboAvariato++;
        if (this.contatoreCiboAvariato >= 3) {
            this.contatoreCiboAvariato = 0;
            this.aggiungiFolliaPerEvento('avariato');
        }
    } else if (tipoCibo === 'delizioso') {
        this.contatoreCiboDelizioso++;
        if (this.contatoreCiboDelizioso >= 3) {
            this.contatoreCiboDelizioso = 0;
            const cura = Math.floor(Math.random() * 4) + 1; // 1d4
            this.follia = Math.max(0, this.follia - cura);
            mostraNotificaInAlto(`✨ Il morale di ${this.nome} migliora grazie ai piatti prelibati! Follia ridotta di -${cura}.`, "successo");
        }
    }
}

    fallisciProvaPanico() {
    if (this.follia >= 20) return;

    let incrementoFollia = Math.floor(Math.random() * 6) + 1; // Tiro di 1d6
    let logAnsioso = "";
    if (this.perks && this.perks.some(p => p.nome === "Ansioso")) {
        incrementoFollia += 1;
        logAnsioso = " (+1 da Ansioso)";
    }

    this.follia = Math.min(20, this.follia + incrementoFollia);

    mostraNotificaInAlto(`🚨 PANICO: ${this.nome} ha fallito la CD di Carisma! Guadagnati dei punti Follia${logAnsioso}.`, "pericolo");

    if (this.follia >= 20) {
        mostraNotificaInAlto(`💀 DISASTRO: ${this.nome} è impazzito del tutto ed è irrecuperabile!`, "pericolo");
    }

    resetWoundTimer() {
        if (this.woundState === "Illeso") {
            this.woundTimer = 0;
            this.woundTreated = false;
            return;
        }
        this.woundTimer = this.woundTimeToWorsen;
        this.woundTreated = false;
    }

    applyRealDamage(danno) {
        const dannoReale = Math.max(1, Math.ceil(danno / 4));
        this.puntiFeritaReali = Math.max(0, this.puntiFeritaReali - dannoReale);
        if (dannoReale > 0) {
            const constitutionBonus = this.constitutionModifier || 0;
            const fortunaRitrovata = Math.max(1, Math.floor(Math.random() * 4) + 1 + constitutionBonus);
            this.puntiFortuna = Math.min(this.puntiFortunaMax, this.puntiFortuna + fortunaRitrovata);
        }
        if (this.puntiFeritaReali > 0) {
            this.resetWoundTimer();
        } else {
            this.woundTimer = 0;
        }
        return dannoReale;
    }

    subisciDanno(danno) {
        let residuo = danno;
        if (this.puntiFortuna > 0) {
            const assorbito = Math.min(this.puntiFortuna, residuo);
            this.puntiFortuna -= assorbito;
            residuo -= assorbito;
        }
        if (residuo > 0) {
            const perso = this.applyRealDamage(residuo);
            return { fortunaoom: this.puntiFortuna === 0, realDamage: perso };
        }
        return { fortunaoom: this.puntiFortuna === 0, realDamage: 0 };
    }

    worsenWoundDueToTime() {
        if (this.woundState === "Illeso" || this.woundState === "Morto") return;

        if (this.woundState === "Ferita lieve") {
            // probabilità base 30%, ridotta di 5% per ogni +1 di Costituzione
            const baseProb = 0.30;
            const mod = this.constitutionModifier || 0;
            let prob = baseProb - (0.05 * mod);
            prob = Math.max(0, Math.min(1, prob));
            if (Math.random() < prob) {
                this.puntiFeritaReali = 3; // Diventa profonda (valore indicativo)
                mostraNotificaInAlto(`${this.nome}: La ferita lieve si è infettata!`, "pericolo");
            } else {
                this.resetWoundTimer();
                return;
            }
        } else {
            this.puntiFeritaReali = Math.max(0, this.puntiFeritaReali - 1);
            mostraNotificaInAlto(`${this.nome}: Le condizioni peggiorano!`, "pericolo");
        }
        this.resetWoundTimer();
    }

    healByRest(ore) {
        if (ore < 8) return false;
        if (this.woundState !== "Ferita lieve") return false;
        let bonus = 0;
        if (this.timers.buffFame > 0) bonus += 0.15;
        if (this.timers.buffSete > 0) bonus += 0.15;
        if (this.timers.buffSonno > 0) bonus += 0.15;
        bonus += this.faticaTotale * 0.2;

        let healing = 1;
        if (Math.random() < bonus) healing += 1;
        this.puntiFeritaReali = Math.min(this.puntiFeritaRealiMax, this.puntiFeritaReali + healing);
        this.resetWoundTimer();
        return true;
    }

    receiveMedicalTreatment(success) {
        if (!success) return false;
        if (this.woundState === "Illeso") return false;
        this.woundTreated = true;
        this.medicalHealPending = true;
        this.woundTimer = this.woundTimeToWorsen * 1.5;
        return true;
    }

    get woundDetail() {
        return `${this.woundState}: ${this.woundEffectText}`;
    }

    // --- SISTEMA COMBATTIMENTO E ARMI ---
    registraColpoCombattimento(categoria, risultato) {
        // risultato: 'success' (+1), 'critical' (+2), 'fail' (+0.2)
        let guadagno = 0;
        if (risultato === 'critical') guadagno = 2;
        else if (risultato === 'success') guadagno = 1;
        else if (risultato === 'fail') guadagno = 0.2;

        this.pca[categoria] = (this.pca[categoria] || 0) + guadagno;
    }

    // --- SISTEMA ALLENAMENTO ---
    calcolaOreAllenamentoGratuite(giornoAttuale) {
        // Reset ogni nuovo giorno
        if (this.ultimoGiornoAllenamento !== giornoAttuale) {
            this.oreAllenamento = 0;
            this.ultimoGiornoAllenamento = giornoAttuale;
        }

        const forzaMod = this.getStatDettagliata('Forza').mod;
        const gratuite = Math.max(1, 1 + forzaMod);
        return gratuite;
    }

    addestraArma(categoria, ore, giornoAttuale) {
        // Allenamento: +2 PCA per ora
        // Fame aumenta del 15% per le prossime 2 ore
        const gratuite = this.calcolaOreAllenamentoGratuite(giornoAttuale);
        const oreGratuite = Math.min(ore, gratuite - this.oreAllenamento);
        const oreAGagoPagato = ore - oreGratuite;

        // Guadagno PCA
        this.pca[categoria] = (this.pca[categoria] || 0) + (ore * 2);

        // Fame aumenta 15% per 2 ore
        this.fame = Math.max(0, this.fame - (14 * 0.15)); // riduce la barra di fame

        // Se ore a carico pagato, consuma stamina (1 barra ogni 2 ore)
        const staminaDaConsumara = Math.ceil(oreAGagoPagato / 2);
        this.staminaAttuale = Math.max(0, this.staminaAttuale - staminaDaConsumara);

        // Traccia ore di allenamento
        this.oreAllenamento += oreGratuite;

        return { oreGratuite, oreAGagoPagato, staminaUsata: staminaDaConsumara, pcaGuadagnato: ore * 2 };
    }


    // --- CALCOLO STATISTICHE (Visualizzazione richiesta: Valore (Mod)) ---

    avanzaTempo(ore) {
        // Calcolo calo (1 tacca ogni 24 ore)
        let calo = ore / 24;

        this.fame = Math.max(0, this.fame - calo);
        this.sete = Math.max(0, this.sete - calo);
        this.sonno = Math.max(0, this.sonno - calo);

        // Update Timer
        for (let t in this.timers) {
            if (this.timers[t] > 0) this.timers[t] = Math.max(0, this.timers[t] - ore);
        }

        // Controllo Morti (Scatta solo se arrivano a 0 DOPO il calo)
        if (this.fame <= 0) return "Inedia (Fame)";
        if (this.sete <= 0) return "Disidratazione (Sete)";
        if (this.sonno <= 0) return "Collasso Cerebrale";
        if (this.faticaTotale >= 6) return "Sfinimento Totale";

        return null;
    }

    riposa(ore) {
        // Regola: dormire recupera sonno e può guarire ferite lievi
        this.sonno = Math.min(8, this.sonno + ore);
        if (ore >= 4) {
            const recuperoMana = Math.floor(ore / 4) * this.getManaRecoveryPerShortRest();
            this.manaAttuale = Math.min(this.manaMax, this.manaAttuale + recuperoMana);
        }
        if (ore >= 8) {
            this.faticaBase = Math.max(0, this.faticaBase - 2);
            this.timers.sonnoSoddisfatto = 6;
            this.timers.buffSonno = 8;
            this.healByRest(ore);
            this.manaAttuale = Math.min(this.manaMax, this.manaAttuale + this.getManaRecoveryOnLongRest());
        }
    }

    calcolaCostoStat(valoreAttuale) {
        if (valoreAttuale < 8) return 0;  // da 6 a 7: gratuito
        if (valoreAttuale < 12) return 1; // da 8 a 11: 1 punto
        if (valoreAttuale < 16) return 2; // da 12 a 15: 2 punti
        if (valoreAttuale < 19) return 3; // da 16 a 18: 3 punti
        return 4; // 19+: 4 punti
    }

    tickOra() {
        // 1. Calo risorse naturale (1 tacca / 24h)
        const calo = 1 / 24;
        this.fame = Math.max(0, this.fame - calo);
        this.sete = Math.max(0, this.sete - calo);
        this.sonno = Math.max(0, this.sonno - calo);

        // 2. Processa Azione se non è in spedizione
        if (this.azioneCorrente && !this.inSpedizione) {
            this.azioneCorrente.oreRimanenti -= 1;

            // Effetti specifici per ora
            if (this.azioneCorrente.tipo === 'dormi') {
                this.sonno = Math.min(8, this.sonno + 1);
                this.manaRiposoTimer += 1;
                if (this.manaRiposoTimer >= 4) {
                    this.manaAttuale = Math.min(this.manaMax, this.manaAttuale + this.getManaRecoveryPerShortRest());
                    this.manaRiposoTimer = 0;
                }
            }

            // Azione completata?
            if (this.azioneCorrente.oreRimanenti <= 0) {
                this.completaAzione();
            }
        }

        if (this.woundState !== "Illeso" && this.woundState !== "Morto") {
            if (this.woundTreated) {
                this.woundTimer -= 1;
                if (this.woundTimer <= 0) {
                    if (this.medicalHealPending) {
                        this.puntiFeritaReali = Math.min(this.puntiFeritaRealiMax, this.puntiFeritaReali + 1);
                        this.medicalHealPending = false;
                        this.woundTreated = false;
                        this.resetWoundTimer();
                    } else {
                        this.worsenWoundDueToTime();
                    }
                }
            } else {
                this.woundTimer -= 1;
                if (this.woundTimer <= 0) {
                    this.worsenWoundDueToTime();
                }
            }
        }

        const restMultiplier = this.getRestMultiplier();
        if (restMultiplier > 0) {
            this.staminaRegenTimer += restMultiplier;
            if (this.staminaRegenTimer >= 4) {
                if (this.staminaAttuale < this.staminaMax) {
                    this.staminaAttuale++;
                }
                this.staminaRegenTimer -= 4;
            }
        }

        // 3. Update Timers
        for (let t in this.timers) if (this.timers[t] > 0) this.timers[t] -= 1;

        // 3.5 Ensure fortune respects fatigue cap
        this.normalizePuntiFortuna();

        // 3.6 Auto sopravvivenza d'emergenza
        if (!this.inSpedizione && typeof magazzino !== 'undefined') {
            if (this.fame <= 0 && magazzino.cibo >= 0.5) {
                magazzino.cibo -= 0.5;
                this.fame = Math.min(16, this.fame + 0.5);
                this.timers.fameSoddisfatta = 3;
                if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto(`${this.nome} usa cibo d'emergenza per sopravvivere.`, 'avviso');
            }
            if (this.sete <= 0 && magazzino.acqua >= 0.5) {
                magazzino.acqua -= 0.5;
                this.sete = Math.min(5, this.sete + 0.5);
                this.timers.seteSoddisfatta = 2;
                if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto(`${this.nome} beve acqua d'emergenza per non disidratarsi.`, 'avviso');
            }
        }

        // 3.7 Auto sonno se collassa
        if (this.sonno <= 0 && !this.inSpedizione && (!this.azioneCorrente || this.azioneCorrente.tipo !== 'dormi')) {
            const oreDormire = 15;
            this.azioneCorrente = { tipo: 'dormi', oreTotali: oreDormire, oreRimanenti: oreDormire, onComplete: () => this.completaAzione() };
            this.sonno = Math.min(8, this.sonno + 0.5);
            if (typeof mostraNotificaInAlto === 'function') mostraNotificaInAlto(`${this.nome} si addormenta automaticamente per evitare il collasso.`, 'avviso');
        }

        // 4. Controllo Morte
        if (this.puntiFeritaReali <= 0) return "per emmorargia";
        if (this.fame <= 0) return "Inedia";
        if (this.sete <= 0) return "Disidratazione";
        if (this.sonno <= 0) return "Privazione Sonno";

        const healingRestMultiplier = this.getRestMultiplier();
        if (this.woundState !== "Illeso" && this.woundState !== "Morto" && healingRestMultiplier > 0) {
            this.oreRiposoAccumulate += healingRestMultiplier;

            const sogliaNecessaria = this.getOreNecessarieGuarigione();
            if (this.oreRiposoAccumulate >= sogliaNecessaria) {
                this.puntiFeritaReali = Math.min(this.puntiFeritaRealiMax, this.puntiFeritaReali + 1);
                this.oreRiposoAccumulate = 0; // Reset dopo il miglioramento
                this.resetWoundTimer(); // Reset del timer di peggioramento
                if (typeof mostraNotificaInAlto === 'function') {
                    mostraNotificaInAlto(`${this.nome}: La ferita sta guarendo grazie al riposo!`, "successo");
                }
            }
        } else {
            this.oreRiposoAccumulate = Math.max(0, this.oreRiposoAccumulate);
        }


        return null;
    }

    tickOre(ore) {
        // Avanza 'ore' ore chiamando tickOra() iterativamente.
        for (let i = 0; i < ore; i++) {
            const causa = this.tickOra();
            if (typeof processAutomaticActions === 'function') {
                processAutomaticActions(this);
            }
            if (causa) return causa;
        }
        return null;
    }

    getOreNecessarieGuarigione() {
        const mod = this.constitutionModifier || 0;
        // +1 CON: rigenerazione -5% (guarigione +5%), -1 CON: +5% (guarigione -5%)
        const factor = 1 - (mod * 0.05);
        const baseHours = {
            "Ferita lieve": 8,
            "Ferita profonda": 16,
            "Funzionalità a rischio": 32,
            "Rischio di morte": 64
        };
        const base = baseHours[this.woundState] || Infinity;
        return Math.max(0.5, base * factor);
    }

    completaAzione() {
        const tipo = this.azioneCorrente.tipo;
        const ore = this.azioneCorrente.oreTotali;

        if (tipo === 'dormi' && ore >= 8) {
            this.faticaBase = Math.max(0, this.faticaBase - 2);
            if (this.sonno >= 7.9) { this.sonno = 10; this.timers.buffSonno = 8; }
            this.timers.sonnoSoddisfatto = 6;
            this.manaAttuale = Math.min(this.manaMax, this.manaAttuale + this.getManaRecoveryOnLongRest());
        }

        this.manaRiposoTimer = 0;
        const onComplete = this.azioneCorrente?.onComplete;
        this.azioneCorrente = null;
        if (typeof onComplete === 'function') {
            onComplete();
        }
        // Se c'è qualcosa in coda, inizia subito
        if (this.codaAzioni.length > 0) {
            this.azioneCorrente = this.codaAzioni.shift();
        }
    }
    get maxOreRiposo() {
        let max = 24;
        if (this.stadioSete >= 2) max = Math.min(max, 4);
        if (this.stadioFame >= 3) max = Math.min(max, 8);
        return max;
    }

    get puntiFortunaMaxEffettivo() {
        return this.faticaTotale >= 4 ? Math.max(1, Math.ceil(this.puntiFortunaMax / 2)) : this.puntiFortunaMax;
    }

    normalizePuntiFortuna() {
        const effMax = this.puntiFortunaMaxEffettivo;
        if (this.puntiFortuna > effMax) this.puntiFortuna = effMax;
    }

    get malusFaticaDettagliati() {
        const lvl = this.faticaTotale;
        let effetti = [];
        if (lvl >= 1) effetti.push("Svantaggio a tutti i tiri d20");
        if (lvl >= 2) effetti.push("Velocità dimezzata, Stamina -1");
        if (lvl >= 3) effetti.push("Riposo limitato, maggior rischio di fallimento");
        if (lvl >= 4) effetti.push("PF Fortuna dimezzati");
        if (lvl >= 5) effetti.push("Velocità 0, Stamina 1");
        if (lvl >= 6) effetti.push("MORTE");
        return effetti;
    }
}
    }
}

export function avviaAscoltoDatiCloud() {
    console.log("📡 Sincronizzazione Cloud attiva.");
}

window.party = party;
window.Personaggio = Personaggio;
window.salvaPersonaggioCloud = salvaPersonaggioCloud;
window.sincronizzaPersonaggio = sincronizzaPersonaggio;
window.caricaDatiDaLocalStorage = caricaDatiDaLocalStorage;
window.salvaPersonaggioLocalmente = salvaPersonaggioLocalmente;
