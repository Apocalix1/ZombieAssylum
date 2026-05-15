class Personaggio {
       constructor(nome, giornoPartenza = 0) {
        this.nome = nome;
        this.forza = 8; this.destrezza = 8; this.costituzione = 8;
        this.intelligenza = 8; this.saggezza = 8; this.carisma = 8;
        
        this.fame = 14; this.sete = 4; this.sonno = 8;
        this.faticaBase = 0; 
        this.follia = 0;
        this.staminaBase = 4;
        this.giornoInizio = giornoPartenza;

        // --- SISTEMA THREAD ---
        this.azioneCorrente = null; // { tipo: 'dormi', oreRimanenti: 5, oreTotali: 5 }
        this.codaAzioni = [];
        this.inSpedizione = false;

        //competenze
        this.staminaAttuale = 4; // Parte al massimo (staminaMax è calcolata)
        this.staminaRegenTimer = 0; 
        this.competenze = []; // Array di stringhe: ["Atletica", "Acrobazia"]
        this.perks = [];      // Array di oggetti perk scelti
        this.puntiCreazione = 30;

        this.timers = { fameSoddisfatta: 0, seteSoddisfatta: 0, sonnoSoddisfatto: 0, buffFame: 0, buffSete: 0, buffSonno: 0 };
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

    // --- RISORSE DINAMICHE ---
    get faticaTotale() {
        let f = this.faticaBase;
        if (this.stadioFame >= 3) f += 1;
        if (this.stadioSete >= 2) f += 1;
        if (this.stadioSonno >= 2) f += 1;
        return Math.min(f, 6);
    }

    get staminaMax() {
        let s = this.staminaBase;
        if (this.stadioFame >= 2) s -= 1;
        if (this.stadioSete >= 3) s -= 2;
        if (this.faticaTotale >= 2) s -= 1;
        return Math.max(0, s);
    }

    // --- IL "CERVELLO" DELLE STATISTICHE ---
    getStatDettagliata(statNome) {
        const nomeLower = statNome.toLowerCase();
        let valoreBase = this[nomeLower];
        let modBase = Math.floor((valoreBase - 10) / 2);
        let modFinale = modBase;
        let motivi = [];

        // Applica Buff (Riempimento Totale)
        if (this.timers.buffFame > 0 && (statNome === "Forza" || statNome === "Costituzione")) {
            modFinale += 1; motivi.push("Sazio +1");
        }
        if (this.timers.buffSete > 0 && (statNome === "Destrezza" || statNome === "Intelligenza")) {
            modFinale += 1; motivi.push("Idratato +1");
        }
        if (this.timers.buffSonno > 0 && (statNome === "Saggezza" || statNome === "Carisma")) {
            modFinale += 1; motivi.push("Riposato +1");
        }

        // Applica Debuff (Basati sugli stadi)
        if (statNome === "Forza" && this.stadioFame >= 1) { modFinale -= 2; motivi.push("Fame -2"); }
        if (statNome === "Costituzione" && this.stadioFame >= 4) { modFinale -= 1; motivi.push("Inedia -2 Valore"); }
        
        if ((statNome === "Intelligenza" || statNome === "Saggezza") && this.stadioSete >= 1) {
            modFinale -= 2; motivi.push("Sete -2");
        }
        
        if ((statNome === "Carisma" || statNome === "Destrezza") && this.stadioSonno >= 1) {
            modFinale -= 2; motivi.push("Insonnia -2");
        }

        return {
            nome: statNome.toUpperCase(),
            mod: modFinale,
            modBase: modBase,
            info: motivi // Array di stringhe
        };
    }

    getBonusCompetenza() {
        const giorniAttivi = Math.floor(oreTotali / 24) - this.giornoInizio;
        if (giorniAttivi < 7) return 2;
        if (giorniAttivi < 14) return 3;
        if (giorniAttivi < 21) return 4;
        return 5;
    }

    get staminaMax() {
        // La stamina max dipende dalla fatica (logica precedente)
        return Math.max(1, 4 - Math.floor(this.faticaTotale / 2));
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
        // Regola: dormire 8 ore ripristina le tacche e toglie 2 fatica base
        this.sonno = Math.min(8, this.sonno + ore);
        if (ore >= 8) {
            this.faticaBase = Math.max(0, this.faticaBase - 2);
            this.timers.sonnoSoddisfatto = 8;
        }
    }

    calcolaCostoStat(valoreAttuale) {
        if (valoreAttuale >= 8 && valoreAttuale < 12) return 1;
        if (valoreAttuale >= 12 && valoreAttuale < 16) return 2;
        if (valoreAttuale >= 16 && valoreAttuale < 19) return 3;
        if (valoreAttuale >= 19) return 4;
        return 1;
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
            }

            // Azione completata?
            if (this.azioneCorrente.oreRimanenti <= 0) {
                this.completaAzione();
            }
        }
        this.staminaRegenTimer++;
        if (this.staminaRegenTimer >= 4) {
            if (this.staminaAttuale < this.staminaMax) {
                this.staminaAttuale++;
            }
            this.staminaRegenTimer = 0;
        }

        // 3. Update Timers
        for (let t in this.timers) if (this.timers[t] > 0) this.timers[t] -= 1;

        // 4. Controllo Morte
        if (this.fame <= 0) return "Inedia";
        if (this.sete <= 0) return "Disidratazione";
        if (this.sonno <= 0) return "Privazione Sonno";
        return null;
    }

    completaAzione() {
        const tipo = this.azioneCorrente.tipo;
        const ore = this.azioneCorrente.oreTotali;

        if (tipo === 'dormi' && ore >= 8) {
            this.faticaBase = Math.max(0, this.faticaBase - 2);
            if (this.sonno >= 7.9) { this.sonno = 10; this.timers.buffSonno = 8; }
            this.timers.sonnoSoddisfatto = 8;
        }

        this.azioneCorrente = null;
        // Se c'è qualcosa in coda, inizia subito
        if (this.codaAzioni.length > 0) {
            this.azioneCorrente = this.codaAzioni.shift();
        }
    }
    get malusFaticaDettagliati() {
    const lvl = this.faticaTotale;
    let effetti = [];
    if (lvl >= 1) effetti.push("Svantaggio prove abilità");
    if (lvl >= 2) effetti.push("Velocità dimezzata, Stamina -1");
    if (lvl >= 3) effetti.push("Svantaggio concentrazione, Rischio Follia");
    if (lvl >= 4) effetti.push("PF Fortuna dimezzati");
    if (lvl >= 5) effetti.push("Velocità 0, Stamina 0");
    if (lvl >= 6) effetti.push("MORTE");
    return effetti;
}
}