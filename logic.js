class Personaggio {
       constructor(nome, giornoPartenza = 0) {
        this.nome = nome;
        this.forza = 8; this.destrezza = 8; this.costituzione = 8;
        this.intelligenza = 8; this.saggezza = 8; this.carisma = 8;
        
        this.fame = 14; this.sete = 4; this.sonno = 8;
        this.faticaBase = 0; 
        this.follia = 0;
        this.staminaBase = 4;
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
        this.staminaAttuale = 4; // Parte al massimo (staminaMax è calcolata)
        this.staminaRegenTimer = 0; 
        this.competenze = []; // Array di stringhe: ["Atletica", "Acrobazia"]
        this.perks = [];      // Array di oggetti perk scelti
        this.puntiCreazione = 30;
        this.lingue = ['Verbum'];

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
        // Debuff da bisogni primari
        if (this.stadioFame >= 3) f += 1;
        if (this.stadioSete >= 2) f += 1;
        if (this.stadioSonno >= 2) f += 1;

        // Debuff da Ferite (Cumulativi)
        // Rischio Funzionalità (2PF) E Rischio Morte (1PF) danno entrambi +2 fatica
        if (this.puntiFeritaReali <= 2 && this.puntiFeritaReali > 0) {
            f += 2; 
        }
        return Math.min(f, 6); // Cap massimo a 6 (Morte)
    }

    get staminaMax() {
        let s = this.staminaBase;
        s += this.getStatDettagliata('Forza').mod;
        // Debuff da bisogni
        if (this.stadioFame >= 2) s -= 1;
        if (this.stadioSete >= 3) s -= 2;
        if (this.faticaTotale >= 2) s -= 1;
        if (this.puntiFeritaReali <= 3 && this.puntiFeritaReali > 0) {
            s -= 1;
        }
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
        // returns -2, -1, 0, 1, 2
        const skillKey = (skill || '').toLowerCase().trim();
        if (this.masteries && this.masteries.map(m => m.toLowerCase()).includes(skillKey)) {
            return 2;
        }
        const counts = this.getPerkSkillCounts();
        const baseCount = counts[skillKey] || 0;
        let rating = 0;
        if (baseCount >= 1) rating = 1;

        // Detect negative perks that explicitly mention the skill in their description
        // only consider perks with negative cost as malus sources.
        let worstNeg = 0; // 0 none, 1 = svantaggio, 2 = disastro
        const escapeRegExp = str => str.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        const pattern = new RegExp('\\b' + escapeRegExp(skillKey) + '\\b', 'i');
        this.perks.forEach(perk => {
            if (!perk) return;
            const p = (typeof perk === 'string') ? null : perk;
            if (!p || !p.desc) return;
            if ((p.costo || 0) < 0 && pattern.test(p.desc.toLowerCase())) {
                if ((p.costo || 0) <= -6) worstNeg = Math.max(worstNeg, 2);
                else worstNeg = Math.max(worstNeg, 1);
            }
        });

        if (worstNeg > 0) return -worstNeg;
        return rating;
    }

    getSkillModifierForCheck(skill) {
        // returns { modifier: number, advantage: bool, disadvantage: bool }
        const rating = this.getSkillRating(skill);
        // map skill -> attribute
        const map = {
            'Atletica': 'Forza', 'Acrobazia': 'Destrezza', 'Acrobazie': 'Destrezza', 'Sopravvivenza': 'Saggezza',
            'Inganno': 'Carisma', 'Indagare': 'Intelligenza', 'Giochi di carte': 'Carisma', 'Rapidità di mano': 'Destrezza',
            'Percezione': 'Saggezza', 'Persuasione': 'Carisma', 'Furtività': 'Destrezza', 'Manodopera': 'Destrezza'
        };
        const attr = map[skill] || map[skill.charAt(0).toUpperCase() + skill.slice(1)] || 'Intelligenza';
        const attrMod = this.getStatDettagliata(attr).mod;
        const prof = this.getBonusCompetenza();

        let modifier = attrMod;
        if (rating === 2) modifier = attrMod + prof * 2;
        else if (rating === 1) modifier = attrMod + prof;
        else if (rating === -2) modifier = attrMod - prof;

        // detect advantage/disadvantage from perks/flags
        const skillKey = (skill || '').toLowerCase().trim();
        const attrKey = attr;
        const advantage = !!(this.vantaggi && (this.vantaggi[attrKey] || this.vantaggi[skillKey]));
        const disadvantageFromFlags = !!(this.svantaggi && (this.svantaggi[attrKey] || this.svantaggi[skillKey]));

        // negative rating of -1 implies disadvantage
        const disadvantageFromRating = (rating === -1);

        // overload produces a small disadvantage for mental stats
        const overloadDisadvantage = this.studyOverload && ['Intelligenza', 'Saggezza', 'Carisma'].includes(attr);

        // combine disadvantages; advantage/disadvantage cancel each other when both present
        let disadvantage = false;
        if (!advantage) {
            disadvantage = disadvantageFromFlags || disadvantageFromRating || overloadDisadvantage;
        }

        return { modifier: modifier, advantage: advantage, disadvantage: disadvantage };
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
        const pf = this.puntiFeritaReali;
        if (pf >= 5) return "Illeso";
        if (pf === 4) return "Ferita lieve";
        if (pf === 3) return "Ferita profonda";
        if (pf === 2) return "Funzionalità a rischio";
        if (pf === 1) return "Rischio di morte";
        return "Morto";
    }

    get puntiFeritaRealiMax() {
        return this.puntiFeritaRealiMaxBase + Math.floor(this.vittorieCombattimento / 2);
    }

    registraVittoriaCombattimento() {
        this.vittorieCombattimento += 1;
        // Ogni 2 vittorie, aumenta punti fortuna
        if (this.vittorieCombattimento % 2 === 0) {
            this.puntiFortuna = Math.min(this.puntiFortunaMax, this.puntiFortuna + 1);
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
        if (ore >= 8) {
            this.faticaBase = Math.max(0, this.faticaBase - 2);
            this.timers.sonnoSoddisfatto = 8;
            this.timers.buffSonno = 8;
            this.healByRest(ore);
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
        if (this.puntiFeritaReali <= 0) return "per emmorargia";
        if (this.fame <= 0) return "Inedia";
        if (this.sete <= 0) return "Disidratazione";
        if (this.sonno <= 0) return "Privazione Sonno";

        const staRiposando = !this.inSpedizione && (!this.azioneCorrente || this.azioneCorrente.tipo !== 'esplora');

    if (this.woundState !== "Illeso" && this.woundState !== "Morto" && staRiposando) {
        
        // 1. Calcolo del Bonus Rigenerazione (20% per ogni Buff)
        let moltiplicatoreRigenerazione = 1; // 1 ora reale = 1 ora di recupero
        if (this.timers.buffFame > 0) moltiplicatoreRigenerazione += 0.2;
        if (this.timers.buffSete > 0) moltiplicatoreRigenerazione += 0.2;
        if (this.timers.buffSonno > 0) moltiplicatoreRigenerazione += 0.2;

        // 2. Accumulo ore (es. se moltiplicatore è 1.6, aggiunge 1.6 ore ogni ora reale)
        this.oreRiposoAccumulate += moltiplicatoreRigenerazione;

        // 3. Controllo soglie di guarigione
        const sogliaNecessaria = this.getOreNecessarieGuarigione();
        
        if (this.oreRiposoAccumulate >= sogliaNecessaria) {
            this.puntiFeritaReali = Math.min(this.puntiFeritaRealiMax, this.puntiFeritaReali + 1);
            this.oreRiposoAccumulate = 0; // Reset dopo il miglioramento
            this.resetWoundTimer(); // Reset del timer di peggioramento
            mostraNotificaInAlto(`${this.nome}: La ferita sta guarendo grazie al riposo!`, "successo");
        }
    } else {
        // Se si muove o non è in condizioni di riposo, il progresso si ferma (ma non si perde)
        this.oreRiposoAccumulate = Math.max(0, this.oreRiposoAccumulate);
    }

    
        return null;
    }

    tickOre(ore) {
        // Avanza 'ore' ore chiamando tickOra() iterativamente.
        for (let i = 0; i < ore; i++) {
            const causa = this.tickOra();
            if (causa) return causa;
        }
        return null;
    }

    getOreNecessarieGuarigione() {
    switch (this.woundState) {
        case "Ferita lieve": return 8;
        case "Ferita profonda": return 16;
        case "Funzionalità a rischio": return 32;
        case "Rischio di morte": return 64;
        default: return Infinity;
        }
    }

    completaAzione() {
        const tipo = this.azioneCorrente.tipo;
        const ore = this.azioneCorrente.oreTotali;

        if (tipo === 'dormi' && ore >= 8) {
            this.faticaBase = Math.max(0, this.faticaBase - 2);
            if (this.sonno >= 7.9) { this.sonno = 10; this.timers.buffSonno = 8; }
            this.timers.sonnoSoddisfatto = 8;
        }

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