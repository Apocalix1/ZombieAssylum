const BOOK_SUBJECT_TITLES = {
    'Addestrare animali': [
        '1250 animali che puoi accarezzare',
        '1250 animali che non puoi accarezzare',
        'Come ho cresciuto il mio uccello- Absol',
        'Sono stato 1 settimana con un Druido e questo mi ha insegnato- Ferruccio'
    ],
    'Arcano': [
        'Palla di fuoco non è la soluzione a tutto (quasi)',
        'Incantesimi per essere un signore oscuro e misterioso- Vyndich',
        'Incantesimi utili per la vita quotidiana',
        'Incantesimi che non userai mai'
    ],
    'Cucina': [
        'Come usare ogni tipi di crema al proprio meglio-Orzo Scagliaguzza',
        'Sentimi: la carne delle razze umanoidi sai che...-Dr Milo',
        'Ricette da tutte le isole volanti',
        'Mestolo d\'oro'
    ],
    'Indagare': [
        'Come capire se è un cappello o per reale',
        'Top 10 stupidi modi in cui i serial killer sono stati catturati (WacthmojoTeverat)',
        'Come capire chi ha davanti (nel caso te ne fossi dimenticato)',
        'Mio figlio è gay o un artista?'
    ],
    'Incantesimi':[
        'Come imporre la propria essenza: corso allungato con basi',
        'Incantesimi e tecniche magiche meta',
        'Come aura farmarmare come Flagello (corso non indirizzato ad essere effetivamente bravi)',
        'Come svillupare la propria tecnica speciale',
    ],
    'Lingue':[
        'Lingue di Teverat e come averle in bocca',
        'Grammatica per bambini e Dragonidi',
        'Hia hia ah, ye ye ye (Come tradurre ogni stupidone)',
        'Perchè odiare queste lingue: Non hanno senso',
    ],
    'Giochi di carte': [
        'Corso allenamento per battere tua nonna a carte 2/5',
        'Non è azzardo, è strategia da vero Baro',
        'Tecniche vincenti dei giochi più comuni',
        'I giochi più bizzarri di Teverat'
    ],
    'Inganno': [
        'Come nascondere ai tuoi la tua sessualità',
        'Manipolazione, 10 trucchi da Alpha',
        'Psicologia Oscura, i trucchi da sapere fin da bambino',
        'Come convincere chiunque a farti venderti l\'anima di qualcuno a metà prezzo-Nudar Chylligun'
    ],
    'Storia': [
        'Top 10 guerre (esclusa quelle delle città) (WacthmojoTeverat)',
        'Cuore dacciaio, tutti i riferimenti storici',
        'Storia della casata famigliare Papoulus, una retrospezione di 400 anni',
        '100 razze e perchè odiarle'
    ],
    'Strumenti da scasso': [
        'Non solo balcani, adesso anche tu sei un pericolo',
        'Voglio entrare in casa di qualcuno',
        'Come sblocco il lucchetto se non ho la chiave?',
        'Scassinare non è da ladri'
    ],
    'Sopravvivenza': [
        'Come sopravvivere una notte con Mariapia e Valeria',
        'Come sopravvivere in un isola deserta con solo il gioco dell\'oca',
        'Guida per chi ancora non ha trovato un affitto',
        'Sopravvivo nella foresta con un coltellino e tante preghiere'
    ],
    'Religione': [
        'Dei e demoni cui non conviene fare patti (Sopratutto Kawanata)',
        'Le religioni più importanti di Teverat',
        'tierList degli dei e demoni con cui ho interagito-Atlas Eadalian',
        'Raccolta di storie e leggende'
    ],
    'Persuasione': [
        'Il manuale del sesso- Scagliaguzza',
        'Stai perdendo tantissimo non leggendo questo libro',
        'Come essere l\'Alpha della stanza',
        'Perchè EmmaxEmy è una delle migliori coppie di Identità 5'
    ],
    'Natura': [
        'Accoppiamento tra ragni e costrutti (Laccio x Corno)',
        'Cosa non dovresti mangiare',
        'Anatomia e funzione delle forme vegetali più comuni',
        'Fiori e frutti coltivabili in giardino'
    ],
    'Manodopera': [
        'Picchiare tutto non è mai la soluzione',
        'Tubature, Finestre e tutto quello che ti può servire',
        'Quale strumento usare per cosa',
        'Come aggiustare la relazione turbalenta con i propri genitori-Atlas Eadalain'
    ],
    'Intrattenere': [
        'Lore completa di 5 notti da Alfredo',
        'Libro analisi sulla Padella magica di Madoka',
        'Vestirsi per impressionare',
        '100000 Barzellette da Gregorio Formaggi',
        'Come diventare il protagonista (ad ogni costo)-Markim'
    ],
    'Intimidire': [
        'Come aumentare la tua aura',
        'Uomini forti, destini forti, uomini deboli, destini deboli',
        'Non serve picchiare la tua donna, 20 trucchi per dominare le persone senza alzare un dito',
        'Come mi sono fatto tua mamma'
    ],
    'Medicina': [
        'Ti smonto e non sto scherzando',
        'Non si dice ritardato',
        'E\' morto con o senza cappello?',
        'Pene e vagina, come scegliere',
        'Primo succhiotto',
        'Infermieristica',
        'Come capire se si ha perso la vista',
        'Cosa hanno di sbagliato i bambini',
    ]
};

const STUDY_SUBJECT_ABILITY = {
    'Addestrare animali': 'Saggezza',
    'Arcano': 'Intelligenza',
    'Atletica': 'Forza',
    'Furtività': 'Destrezza',
    'Persuasione': 'Carisma',
    'Medicina': 'Intelligenza',
    'Cucina': 'Intelligenza',
    'Indagare': 'Intelligenza',
    'Giochi di carte': 'Carisma',
    'Inganno': 'Carisma',
    'Storia': 'Intelligenza',
    'Strumenti da scasso': 'Destrezza',
    'Sopravvivenza': 'Saggezza',
    'Religione': 'Intelligenza',
    'Natura': 'Intelligenza',
    'Manodopera': 'Destrezza',
    'Intrattenere': 'Carisma',
    'Intimidire': 'Carisma'
};

const STUDY_DICE_BY_TOTAL_HOURS = [
    { max: 5, die: '1d4' },
    { max: 11, die: '1d6' },
    { max: 17, die: '1d8' },
    { max: 23, die: '1d10' },
    { max: 29, die: '1d12' },
    { max: 35, die: '2d8' },
    { max: Infinity, die: '2d10' }
];

const SKILL_SYSTEM = {
    semantics: {
        "Addestrare animali": "Competenza su animale e percezione comportamentale.",
        "Acrobazia": "Agilità, equilibrio e reattività in prova su Destrezza.",
        "Arcano": "Conoscenza arcana e controllo della magia.",
        "Atletica": "Forza e resistenza in prove fisiche e movimento.",
        "Cucina": "Preparare cibo nutriente e bonus legati ai pasti.",
        "Indagare": "Esaminare tracce e dedurre informazioni.",
        "Furtività": "Mimetizzazione, movimento silenzioso e occultamento.",
        "Giochi di carte": "Intuito sociale e psicologia durante il gioco.",
        "Inganno": "Manipolare, mentire e ingannare gli altri.",
        "Intimidire": "Coercizione e pressione sociale.",
        "Intrattenere": "Prestazioni e distrarre un pubblico.",
        "Intuizione": "Percezione sottile e giudizio sociale.",
        "Manodopera": "Lavoro manuale, riparazioni e uso di strumenti.",
        "Natura": "Conoscenza ambientale, piante e creature.",
        "Percezione": "Avvertire dettagli, movimenti e suoni.",
        "Persuasione": "Convincere gli altri con parole e fascino.",
        "Rapidità di mano": "Mani veloci, borseggio e manipolazione rapida.",
        "Religione": "Conoscenze e resistenza legate al culto e alla follia.",
        "Sopravvivenza": "Orientamento, raccoglimento e resistenza in natura.",
        "Storia": "Conoscenze storiche e culturali.",
        "Strumenti da scasso": "Apertura serrature e neutralizzazione trappole."
    },
    ratings: {
        note: "Valori: -2 competenza negativa, -1 svantaggio, 0 nullo, 1 competenza, 2 maestria."
    },
    savingThrows: {
        "Acrobazia": "Destrezza",
        "Inganno": "Carisma",
        "Intuizione": "Saggezza",
        "Indagare": "Intelligenza",
    },
    masteryDescriptions: {
        "Addestrare animali": "Gli infetti non intelligenti hanno bisogno di +4 per individuare con Percezione e Percezione passiva.",
        "Acrobazia": "Ottieni tiri salvezza su Destrezza.",
        "Arcano": "Ottieni +2 mana e rigeneri 1d4 in più di punti mana a riposo breve.",
        "Atletica": "La tua velocità aumenta di 3 metri.",
        "Cucina": "Gli alleati che mangiano il tuo cibo ottengono +4 punti ferita fortuna temporanei.",
        "Indagare": "Ottieni competenza nei tiri salvezza in Intelligenza.",
        "Furtività": "Quando fallisci un tiro su furtività puoi rilanciarlo due volte a sessione.",
        "Giochi di carte": "Ottieni +2 CA ai primi attacchi (mod Carisma) che subisci in un combattimento.",
        "Inganno": "Ottieni competenza nei tiri salvezza in Carisma.",
        "Intimidire": "Durante il combattimento puoi usare la tua azione bonus per obbligare un avversario (non infetto) a fare un tiro salvezza su Carisma (CD 14). Se fallisce, ottiene svantaggio nel colpire te e i tuoi alleati per il prossimo turno.",
        "Intrattenere": "Come azione puoi obbligare una creatura intelligente che ti vede o sente a fare un TS su Carisma (CD 14). Se fallisce, perde concentrazione.",
        "Intuizione": "Ottieni competenza nei tiri salvezza in Saggezza.",
        "Manodopera": "Puoi lanciare Riparare due volte al giorno e riduci il tempo di costruzione/riparazione di Artificeria del 25%.",
        "Natura": "Accesso all'alchimia di alto livello.",
        "Percezione": "Ottieni vista cieca di 3 metri.",
        "Persuasione": "Come azione puoi ispirare un alleato dandogli +1d4 a un TS/Tiro abilità/Tiro per colpire. Dura 1 minuto e un alleato può avere un solo d4 alla volta.",
        "Rapidità di mano": "Nel primo turno di combattimento puoi fare come azione bonus un attacco con armi improvvisate o piccole e hai un'azione gratuita per estrarre o cambiare oggetti.",
        "Religione": "Sei resistente alla follia del 50%.",
        "Sopravvivenza": "Recuperi la tacca della stamina nella metà dei tempi.",
        "Storia": "Il tempo di studio dai libri è ridotto della metà.",
        "Strumenti da scasso": "I CD per porte e serrature sono ridotti di 4 e gli strumenti non si rompono al fallimento."
    }
};

console.log("Database Abilità caricato correttamente.");

// ---------- VARIABILI GLOBALI DEL MODULO ----------
let studioPersonaggioSelezionato = null;

// ---------- FUNZIONI DI UTILITY ----------
function randomStudyHours() {
    const r = Math.random();
    if (r < 0.04) return 24;
    const distribution = [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
    const midpoint = 13.5;
    const weights = distribution.map(v => 1 / (1 + Math.abs(v - midpoint)));
    let total = weights.reduce((sum, w) => sum + w, 0);
    let pick = Math.random() * total;
    for (let i = 0; i < distribution.length; i++) {
        pick -= weights[i];
        if (pick <= 0) return distribution[i];
    }
    return 23;
}

function getStudyDieByTotalHours(hours, p) {
    const total = Math.max(1, hours);
    const level = STUDY_DICE_BY_TOTAL_HOURS.find(entry => total <= entry.max);
    let die = level ? level.die : '2d10';
    if (p && p.timers && p.timers.buffIntegratori > 0) {
        die += '+3';
    }
    return die;
}

function teacherCanTeach(teacher, subject, needsMastery) {
    if (!teacher) return false;
    const subjectKey = (subject || '').toLowerCase().trim();
    if (needsMastery) {
        return teacher.masteries && teacher.masteries.map(m => m.toLowerCase()).includes(subjectKey);
    }
    return teacher.hasCompetenza(subject);
}

function getStudyPMCap(p) {
    const livelli = [8, 24, 40, 56, 72];
    const next = livelli[p.livelloMedicina] || 72;
    return Math.floor(next * 0.4);
}

function hasTeacher(p) {
    return Array.isArray(p.perks) && p.perks.some(perk => typeof perk !== 'string' && perk.nome === 'Insegnante');
}

function awardStudyPM(p, ore) {
    const guadagno = Math.floor(ore / 2);
    if (guadagno <= 0) return 0;
    const cap = getStudyPMCap(p);
    const nuovoTotale = Math.min(cap, p.pmMedicina + guadagno);
    const effettivo = nuovoTotale - p.pmMedicina;
    p.pmMedicina = nuovoTotale;
    return effettivo;
}

// ---------- LOOT LIBRI ----------
function lootBooks(tiro) {
    let count = 0;
    if (tiro <= 3) count = 0;
    else if (tiro <= 8) count = 1;
    else if (tiro <= 12) count = 2;
    else if (tiro <= 15) count = 3;
    else if (tiro <= 18) count = 4;
    else count = 5;

    const topics = [
        ['Addestrare animali',0.07], ['Arcano',0.08], ['Cucina',0.08], ['Indagare',0.04], ['Giochi di carte',0.03],
        ['Inganno',0.03], ['Storia',0.09], ['Manodopera',0.04], ['Strumenti da scasso',0.04], ['Sopravvivenza',0.06],
        ['Religione',0.08], ['Persuasione',0.05], ['Natura',0.08], ['Intrattenere',0.05],
        ['Intimidire',0.02], ['Medicina',0.06],['Incantesimi',0.08],
    ];
    const total = topics.reduce((s,t)=>s+t[1],0);
    const normalized = topics.map(t=>[t[0], t[1]/total]);

    for (let i = 0; i < count; i++) {
        let r = Math.random();
        let cum = 0;
        let subject = 'Medicina';
        for (let j = 0; j < normalized.length; j++) {
            cum += normalized[j][1];
            if (r <= cum) {
                subject = normalized[j][0];
                break;
            }
        }
        const hours = randomStudyHours();
        const titleList = BOOK_SUBJECT_TITLES[subject] || [subject];
        const title = titleList[Math.floor(Math.random() * titleList.length)];
        magazzino.libri.push({
            id: `libro-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            subject,
            title,
            hours,
            maxStudyHours: hours * 2,
            usedHours: 0
        });
    }
    return count;
}
window.lootBooks = lootBooks;

// ---------- INTERFACCIA STUDIO ----------
function studio(idx) {
    const p = party[idx];
    if (window.hasPerk(p, 'Analfabeta')) {
        alert('Il tuo personaggio non sa leggere. Che stupidone!');
        return;
    }
    if (window.hasPerk(p, 'Cieco')) {
        alert('Il tuo personaggio vede solo la oscurità, che disdetta!');
        return; // manca anche il return qui: attualmente prosegue comunque dopo l'alert
    }
    studioPersonaggioSelezionato = idx;
    apriStudio();
}


function avviaStudioLingua(idx) {
    const p = party[idx];
    if (!p) return;
    if (window.hasPerk(p, 'Analfabeta')) { alert('Il tuo personaggio non sa leggere. Che stupidone!'); return; }
    const tutte = ['Yazyk', 'Engenity', 'Chrimil', 'Ridulphi', 'Antali', 'Puleun', 'Eklesti', 'Meer'];
    const giaConosciute = p.lingue || ['Verbum'];
    const disponibili = tutte.filter(l => !giaConosciute.includes(l));
    if (!disponibili.length) { alert('Conosci già tutte le lingue disponibili!'); return; }

    const scelta = prompt(`Quale lingua vuoi studiare?\n${disponibili.join(', ')}`, disponibili[0]);
    const lingua = disponibili.find(l => l.toLowerCase() === (scelta || '').toLowerCase());
    if (!lingua) { alert('Lingua non valida o annullata.'); return; }

    const subject = `Lingua:${lingua}`;
    if (p.getStudyPoints(subject) >= 70) { alert('Hai già imparato questa lingua.'); return; }

    let ore = parseInt(prompt('Quante ore vuoi dedicare allo studio della lingua?', '4'));
    if (isNaN(ore) || ore <= 0) return;
    ore = Math.ceil(ore * p.getModificatoreTempoAzione('studio-lingua', subject));

    pianificaAzione(idx, 'studio-lingua', null, subject, lingua, ore, null);
    document.getElementById('modal-studio').style.display = 'none';
}

function completaStudioLinguaAction(p, action) {
    const subject = action.subject;
    const lingua = action.linguaTarget;
    const hours = action.oreTotali;

    const isPessimoStudente = p.hasPerk && p.hasPerk('Pessimo studente');
    const progressMultiplier = isPessimoStudente ? 0.75 : 1;
    let effectiveAdjusted = hours;
    if (p.hasPerk && p.hasPerk('Deconcentrato') && hours > 3) {
        effectiveAdjusted = 3 + ((hours - 3) / 1.3);
    }

    p.oreStudioGiornaliere += hours;
    p.studyOverload = p.oreStudioGiornaliere > getSogliaStudioGiornaliera(p);

    let currentPoints = p.getStudyPoints(subject);
    const attrMod = p.getStatDettagliata('Intelligenza').mod;
    const summary = [];
    const progressHoursInt = Math.ceil(Math.max(0, effectiveAdjusted * progressMultiplier));

    for (let i = 0; i < progressHoursInt && currentPoints < 70; i++) {
        const nextHourTotal = (p.oreStudioPerMateria[subject] || 0) + 1;
        p.oreStudioPerMateria[subject] = nextHourTotal;
        const die = getStudyDieByTotalHours(nextHourTotal, p);
        let roll = rollDiceNotation(die) + attrMod;
        if (p.hasPerk && p.hasPerk('Apprendimento accellerato')) roll += 3;
        if (hasTeacher(p)) roll = Math.max(roll, rollDiceNotation(die) + attrMod);
        if (p.studyOverload) roll = Math.max(0, roll - 2);
        currentPoints += roll;
        summary.push(`${die}+${attrMod}=${roll}`);
    }
    currentPoints = Math.min(70, currentPoints);
    p.apprendimento[subject] = currentPoints;
    p.ultimoStudioOre = oreTotali;

    let message = `${p.nome} studia ${lingua} per ${hours}h (${summary.join(', ')}) e arriva a ${currentPoints}/70 punti.`;
    if (currentPoints >= 70 && !p.lingue.includes(lingua)) {
        p.lingue.push(lingua);
        message += ` 🎉 Ha imparato ${lingua}!`;
    }
    if (p.studyOverload) message += ' Sovraccarico attivo.';
    mostraNotificaInAlto(message, 'successo');
    salvaPersonaggioCloud(p);
}

window.avviaStudioLingua = avviaStudioLingua;
window.completaStudioLinguaAction = completaStudioLinguaAction;

function apriStudio() {
    const modal = document.getElementById('modal-studio');
    const content = document.getElementById('studio-content');
    if (!modal || !content) return;
    if (!party.length) {
        alert('Non ci sono personaggi per studiare.');
        return;
    }
    if (!magazzino.libri.length) {
        alert('La biblioteca è vuota. Trova dei libri prima di studiare.');
        return;
    }
    renderStudioModal();
    modal.style.display = 'block';
}

function renderStudioModal() {
    const content = document.getElementById('studio-content');
    if (!content) return;
    const selezionato = party[studioPersonaggioSelezionato] || party[0];
    let html = `<div style="margin-bottom:14px; font-size:0.9rem; color:#ddd;">
        <strong>Studente:</strong> ${selezionato.nome}<br>
        <strong>Medicina:</strong> Livello ${selezionato.livelloMedicina} - PM ${selezionato.pmMedicina}/${getStudyPMCap(selezionato)}<br>
      <strong>Ore studiosi oggi:</strong> ${selezionato.oreStudioGiornaliere}/${getSogliaStudioGiornaliera(selezionato)} ${selezionato.studyOverload ? '(<span style="color:#e74c3c">Sovraccarico</span>)' : ''}
    </div>`;
    html += '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">';
    party.forEach((p, idx) => {
        html += `<button class="btn-big" style="flex:1; min-width:140px; ${idx === studioPersonaggioSelezionato ? 'background:#2980b9;' : ''}" onclick="switchStudioPersonaggio(${idx})">${p.nome}</button>`;
    });
    html += '</div>';
    html += '<div style="margin-bottom:10px; font-size:0.9rem; color:#ddd;"><strong>Libri disponibili:</strong></div>';
    html += '<div style="display:grid; gap:8px; max-height:320px; overflow-y:auto;">';
    html += `<button class="btn-hero" style="margin-bottom:10px;" onclick="avviaStudioLingua(${studioPersonaggioSelezionato})">🗣️ Studia una lingua</button>`;
    magazzino.libri.forEach((book, idx) => {
        const remaining = Math.max(0, book.maxStudyHours - book.usedHours);
        html += `<div class="stat-row" style="background:#111; display:grid; grid-template-columns: 1fr 110px 120px 90px; gap:6px; align-items:center;">
            <div>
                <strong>${book.title}</strong><br>
                <small>${book.subject} • ${book.hours}h libro</small>
            </div>
            <div style="font-size:0.8rem; text-align:right;">Restanti: ${remaining}h</div>
            <div style="font-size:0.8rem; text-align:right;">Dado iniziale: ${getStudyDieByTotalHours((selezionato.oreStudioPerMateria[book.subject] || 0) + 1)}</div>
            <button onclick="selezionaLibroStudio(${idx})" ${remaining <= 0 ? 'disabled' : ''}>Studia</button>
        </div>`;
    });
    html += '</div>';
    content.innerHTML = html;
}

function switchStudioPersonaggio(idx) {
    studioPersonaggioSelezionato = idx;
    renderStudioModal();
}

function selezionaLibroStudio(bookIdx) {
    const p = party[studioPersonaggioSelezionato] || party[0];
    const book = magazzino.libri[bookIdx];
    if (!p || !book) return;
    const remaining = Math.max(0, book.maxStudyHours - book.usedHours);
    if (remaining <= 0) {
        alert('Questo libro è stato già studiato fino al limite.');
        return;
    }
    const currentPoints = p.getStudyPoints(book.subject);
    if (currentPoints >= 210) {
        alert('Non puoi studiare una materia in cui hai già maestria.');
        return;
    }
    const studyingForMastery = currentPoints >= 70;
    const maxAllowed = remaining;
    let suggested = Math.min(maxAllowed, 4);
    let input = prompt(`Quante ore vuoi dedicare a studiare "${book.title}"? (1-${maxAllowed})`, `${suggested}`);
    let ore = parseInt(input);
    if (isNaN(ore) || ore <= 0) return;
    ore = Math.ceil(ore * p.getModificatoreTempoAzione('studio-libro', book.subject));
    ore = Math.min(ore, maxAllowed);

    let teacherName = null;
    const haStudioInCompagnia = window.hasPerk && window.hasPerk(p, 'Studio in compagnia');

    if (haStudioInCompagnia) {
        // Nessun requisito di competenza: basta un compagno disponibile
        const compagni = party.filter((q, idx) => idx !== studioPersonaggioSelezionato && !q.inSpedizione);
        if (compagni.length > 0) {
            let lista = '0) Nessun compagno';
            compagni.forEach((c, i) => lista += `\n${i + 1}) ${c.nome}`);
            const scelta = parseInt(prompt(`Vuoi studiare in compagnia di qualcuno?\n${lista}`, '0'));
            if (!isNaN(scelta) && scelta > 0 && scelta <= compagni.length) teacherName = compagni[scelta - 1].nome;
        }
    } else {
        // Solo chi ha competenza/maestria nella materia può insegnare
        const candidates = party.filter((q, idx) => idx !== studioPersonaggioSelezionato && teacherCanTeach(q, book.subject, studyingForMastery));
        if (candidates.length > 0) {
            let list = '0) Nessun insegnante';
            candidates.forEach((c, i) => list += `\n${i + 1}) ${c.nome}`);
            const scelta = parseInt(prompt(`Vuoi un insegnante per ${book.subject}?\n${list}`, '0'));
            if (!isNaN(scelta) && scelta > 0 && scelta <= candidates.length) {
                const teacher = candidates[scelta - 1];
                const conferma = (prompt(`${teacher.nome} ti chiede se gli puoi insegnare ${book.subject} per ${ore} ore. si/no/meno`, 'si') || '').trim().toLowerCase();
                if (conferma === 'si') teacherName = teacher.nome;
                else if (conferma === 'meno') {
                    const nuoveOre = parseInt(prompt(`Quante ore vuoi che ${teacher.nome} ti insegni? (1-${ore})`, `${Math.max(1, Math.min(ore, 2))}`));
                    if (!isNaN(nuoveOre) && nuoveOre > 0 && nuoveOre <= ore) { ore = nuoveOre; teacherName = teacher.nome; }
                }
            }
        }
    }
    const candidates = party.filter((q, idx) => idx !== studioPersonaggioSelezionato && teacherCanTeach(q, book.subject, studyingForMastery));
    if (candidates.length > 0) {
        let list = '0) Nessun insegnante';
        candidates.forEach((c, index) => {
            list += `\n${index + 1}) ${c.nome}`;
        });
        let scelta = prompt(`Vuoi un insegnante per ${book.subject}? Scegli il numero:\n${list}`, '0');
        scelta = parseInt(scelta);
        if (!isNaN(scelta) && scelta > 0 && scelta <= candidates.length) {
            const teacher = candidates[scelta - 1];
            const conferma = prompt(`${teacher.nome} ti chiede se gli puoi insegnare ${book.subject} per ${ore} ore. Rispondi: si / no / meno`, 'si');
            const risposta = (conferma || '').trim().toLowerCase();
            if (risposta === 'si') {
                teacherName = teacher.nome;
            } else if (risposta === 'meno') {
                const fallback = prompt(`Quante ore vuoi che ${teacher.nome} ti insegni? (1-${ore})`, `${Math.max(1, Math.min(ore, 2))}`);
                const nuoveOre = parseInt(fallback);
                if (!isNaN(nuoveOre) && nuoveOre > 0 && nuoveOre <= ore) {
                    ore = nuoveOre;
                    teacherName = teacher.nome;
                } else {
                    teacherName = null;
                }
            }
        }
    }

    pianificaAzione(studioPersonaggioSelezionato, 'studio-libro', book.id, book.subject, book.title, ore, teacherName);
    document.getElementById('modal-studio').style.display = 'none';
}

function completaStudioBookAction(p, action) {
    const book = magazzino.libri.find(b => b.id === action.bookId);
    if (!book) return;
    const hours = action.oreTotali;
    const remaining = Math.max(0, book.maxStudyHours - book.usedHours);
    const effectiveHours = Math.min(hours, remaining);

    // --- PESSIMO STUDENTE: riduzione del progresso del 25% (0.75) ---
    const isPessimoStudente = p.hasPerk && p.hasPerk('Pessimo studente');
    const progressMultiplier = isPessimoStudente ? 0.75 : 1;

    // --- DECONCENTRATO: se studia più di 3 ore consecutive, le ore eccedenti valgono meno ---
    let effectiveAdjusted = effectiveHours;
    if (p.hasPerk && p.hasPerk('Deconcentrato') && effectiveHours > 3) {
        // Le ore oltre le 3 sono penalizzate del 30% (cioè valgono 1/1.3)
        const normalHours = 3;
        const extraHours = effectiveHours - 3;
        effectiveAdjusted = normalHours + (extraHours / 1.3);
    }

    // --- CONSUMO DEL LIBRO (con Narratore) ---
    let consumption = effectiveHours;
    const isNarratore = p.hasPerk && p.hasPerk('Artista') && p.artistaSpecializzazione === 'Scrittore/narratore';
    if (isNarratore) consumption = effectiveHours * 0.75;
    book.usedHours += consumption;
    book.usedHours = Math.round(book.usedHours * 100) / 100;

    // Ore di studio giornaliere (usiamo effectiveHours originali)
    p.oreStudioGiornaliere += effectiveHours;
    p.studyOverload = p.oreStudioGiornaliere > p.getSogliaStudioGiornaliero(); // FIX: soglia dinamica

    if (book.subject === 'Medicina') {
        const pmGained = awardStudyPM(p, effectiveHours);
        if (pmGained > 0) {
            mostraNotificaInAlto(`${p.nome} ha studiato Medicina per ${effectiveHours}h e guadagnato +${pmGained} PM.`, 'successo');
        } else {
            mostraNotificaInAlto(`${p.nome} ha studiato Medicina per ${effectiveHours}h ma ha già raggiunto il limite attuale di PM.`, 'warning');
        }
    }
    else if (book.subject === 'Incantesimi') {
            p.oreStudioIncantesimi = (p.oreStudioIncantesimi || 0) + effectiveHours;
            p.sogliaIncantesimiRisposte = p.sogliaIncantesimiRisposte || {};
            const soglie = [
                {liv: 0, soglia: 8},
                {liv: 1, soglia: 16},
                {liv: 2, soglia: 32},
                {liv: 3, soglia: 64},
                {liv: 4, soglia: 120}
            ];
            soglie.forEach(s => {
                if (p.oreStudioIncantesimi >= s.soglia && !p.sogliaIncantesimiRisposte[s.liv]) {
                    p.sogliaIncantesimiRisposte[s.liv] = true;
                    const nomeLivello = s.liv === 0 ? 'un Trucchetto' : `un Incantesimo di Livello ${s.liv}`;
                    const vuole = confirm(`${p.nome} ha accumulato abbastanza ore di studio per imparare ${nomeLivello}. Vuoi impararlo ora?`);
                    if (vuole) {
                        if (p.livelloMagia === 0 && s.liv > 0) {
                            alert(`${p.nome} deve prima imparare un Trucchetto per sbloccare la magia. Riprova quando raggiungerai un'altra soglia.`);
                            p.sogliaIncantesimiRisposte[s.liv] = false;
                            return;
                        }
                        p.spellsKnown[s.liv] = (p.spellsKnown[s.liv] || 0) + 1;
                        const costoBase = p.getSpellCost ? p.getSpellCost(s.liv) : [1, 2, 4, 7, 11][s.liv];
                        const puntiConoscenza = costoBase * 2;
                        p.puntiConoscenzaMagica = (p.puntiConoscenzaMagica || 0) + puntiConoscenza;
                        if (p.livelloMagia === 0) {
                            p.livelloMagia = 1;
                            p.updateManaFromMagiaLevel();
                            mostraNotificaInAlto(`${p.nome} sblocca il Livello di Magia 1!`, 'successo');
                        }
                        if (typeof window.applicaScalataLivelloMagia === 'function') {
                            window.applicaScalataLivelloMagia(p);
                        }
                        mostraNotificaInAlto(`✨ ${p.nome} ha imparato ${nomeLivello}! (+${puntiConoscenza} Punti Conoscenza Magica)`, 'successo');
                    }
                }
            });
        }     else {
        let currentPoints = p.getStudyPoints(book.subject);
        const stat = STUDY_SUBJECT_ABILITY[book.subject] || 'Intelligenza';
        const attrMod = p.getStatDettagliata(stat).mod;
        let summary = [];
        const helper = (typeof window.assistenzaSelezionata !== 'undefined' && window.assistenzaSelezionata && window.assistenzaSelezionata.tipo === 'studio') ? party[window.assistenzaSelezionata.idx] : null;
        const helperName = action.teacherName || (helper ? helper.nome : null);

        // Verifica se ha Studio in compagnia e c'è un compagno
        const haStudioInCompagnia = p.hasPerk && p.hasPerk('Studio in compagnia');
        const hasCompanion = helperName || (party.some(q => q !== p && !q.inSpedizione && q.id !== p.id));
        const studioBonus = (haStudioInCompagnia && hasCompanion) ? 2 : 0;

        const rancoreAttivo = helper && (p.rancoreTargetId === helper.id || helper.rancoreTargetId === p.id);
        const teacherObj = action.teacherName ? party.find(x => x.nome === action.teacherName) : (helper || null);

        // Calcolo delle ore effettive per il progresso (considerando Deconcentrato e Pessimo studente)
        const progressHours = Math.max(0, effectiveAdjusted * progressMultiplier);
        const progressHoursInt = Math.ceil(progressHours); // arrotondato per eccesso

        for (let i = 0; i < progressHoursInt; i++) {
            const nextHourTotal = (p.oreStudioPerMateria[book.subject] || 0) + 1;
            p.oreStudioPerMateria[book.subject] = nextHourTotal;
            const die = getStudyDieByTotalHours(nextHourTotal, p);
            let roll = rollDiceNotation(die) + attrMod;
            if (p.hasPerk && p.hasPerk('Apprendimento accellerato')) roll += 3;
            if (helperName || hasTeacher(p)) {
                const roll2 = rollDiceNotation(die) + attrMod;
                roll = Math.max(roll, roll2);
            }
            if (teacherObj && teacherObj.hasPerk && teacherObj.hasPerk('Insegnante')) {
                roll += rollDiceNotation('1d6');
            }
            // Applica bonus Studio in compagnia (se attivo)
            roll += studioBonus;
            if (p.studyOverload) roll = Math.max(0, roll - 2);
            if (rancoreAttivo) roll = Math.floor(roll * 0.6);
            currentPoints += roll;
            summary.push(`${die}+${attrMod}=${roll}`);
            if (currentPoints >= 70 && !p.competenze.map(c => c.toLowerCase()).includes(book.subject.toLowerCase())) {
                p.competenze.push(book.subject);
            }
            if (currentPoints >= 210 && !p.masteries.map(m => m.toLowerCase()).includes(book.subject.toLowerCase())) {
                p.masteries.push(book.subject);
            }
            }
            currentPoints = Math.min(210, currentPoints);
            p.apprendimento[book.subject] = currentPoints;
            p.ultimoStudioOre = oreTotali;
            if (helperName && !action.teacherName) {
                mostraNotificaInAlto(`${p.nome} studia con l'aiuto di ${helperName}.`, 'successo');
                window.assistenzaSelezionata = null;
            } else if (action.teacherName) {
                mostraNotificaInAlto(`${p.nome} studia con l'aiuto di ${action.teacherName}.`, 'successo');
            }
            let message = `${p.nome} studia ${book.subject} per ${effectiveHours}h (${summary.join(', ')}) e arriva a ${currentPoints}/210 punti.`;
            if (currentPoints >= 210) message += ' Hai ottenuto una MAESTRIA!';
            else if (currentPoints >= 70) message += ' Hai ottenuto una COMPETENZA!';
            if (p.studyOverload) message += ' Sovraccarico attivo.';
            mostraNotificaInAlto(message, 'successo');
        }

        if (book.usedHours >= book.maxStudyHours) {
            const index = magazzino.libri.indexOf(book);
            if (index !== -1) magazzino.libri.splice(index, 1);
        }
}

// ---------- BIBLIOTECA ----------
function apriBiblioteca() {
    const modal = document.getElementById('modal-biblioteca');
    const content = document.getElementById('biblioteca-content');
    if (!modal || !content) return;
    content.innerHTML = '<p>Caricamento...</p>';
    modal.style.display = 'block';
    caricaDocumentiArchiviati().finally(() => renderBibliotecaContent());
}

function renderBibliotecaContent() {
    const content = document.getElementById('biblioteca-content');
    if (!content) return;

    let html = '<h3>📚 Biblioteca</h3>';

    // 📖 Sezione Libri
    html += '<h4 style="margin-top:15px; color:#f1c40f;">📖 Libri</h4>';

    if (!window.magazzino || !magazzino.libri || magazzino.libri.length === 0) {
        html += '<p>Nessun libro disponibile.</p>';
    } else {
        // Intestazione tabella
        html += `
        <div style="display:grid; grid-template-columns: 1fr 140px 120px 120px; gap:6px; align-items:center; font-weight:bold; margin-bottom:8px;">
            <div>Titolo</div>
            <div>Materia</div>
            <div>Ore restanti</div>
            <div>Ore libro</div>
        </div>`;

        // Righe libri
        magazzino.libri.forEach(book => {
            const oreRestanti = Math.max(0, (book.maxStudyHours || 0) - (book.usedHours || 0));
            html += `
            <div style="display:grid; grid-template-columns: 1fr 140px 120px 120px; gap:6px; margin-bottom:4px;">
                <div style="padding:6px; background:#0f0f0f; border:1px solid #222;">${book.title}</div>
                <div style="padding:6px; background:#0f0f0f; border:1px solid #222;">${book.subject}</div>
                <div style="padding:6px; background:#0f0f0f; border:1px solid #222; text-align:right;">${oreRestanti}h</div>
                <div style="padding:6px; background:#0f0f0f; border:1px solid #222; text-align:right;">${book.hours || 0}h</div>
            </div>`;
        });
    }

    // 📜 Sezione Documenti Archiviati
    html += '<h4 style="margin-top:20px; color:#8e44ad;">📜 Documenti Archiviati</h4>';
    const archived = window.archivedDocuments || [];

    if (archived.length === 0) {
        html += '<p>Nessun documento archiviato.</p>';
    } else {
        html += '<div style="display:flex; flex-direction:column; gap:8px;">';
        archived.forEach(doc => {
            const utente = window.getCurrentUser ? window.getCurrentUser() : null;
            const isOspite = window.guestMode || (utente && utente.role === 'ospite');
            const linguaBase = (doc.lingua || '').toLowerCase();
            const conosciuta = isOspite
                ? (linguaBase === 'verbum' || linguaBase === 'comune')
                : (typeof partyConosceLingua === 'function' ? partyConosceLingua(doc.lingua, doc.traduzioni) : false);
            const testoMostrato = conosciuta ? doc.testo : (doc.testo_criptato || (doc.testo || '').replace(/[a-zA-Z0-9]/g, '?'));
            const lingueExtra = (doc.traduzioni && doc.traduzioni.length) ? ` + ${doc.traduzioni.join(', ')}` : '';
            const dataCreazione = doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/D';

            html += `
            <div style="background:#1a1a2e; padding:12px; border:1px solid #333; border-radius:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <div style="font-weight:bold; color:#f1c40f;">${doc.titolo}</div>
                    <button class="btn-hero" style="font-size:0.7rem; padding:4px 8px;" onclick="rinominaDocumentoArchiviato(${doc.id})">✏️ Rinomina</button>
                </div>
                <div style="font-size:0.85rem; color:#aaa; margin-top:4px;">
                    Lingua: ${doc.lingua}${lingueExtra} — ${conosciuta ? '<span style="color:#2ecc71;">✅ Leggibile</span>' : '<span style="color:#e74c3c;">🔒 Sconosciuta</span>'}
                </div>
                <div style="font-size:0.9rem; color:#eee; white-space:pre-wrap; margin-top:6px; background:#111; padding:8px; border:1px solid #333;">${testoMostrato}</div>
                <div style="font-size:0.7rem; color:#666; margin-top:4px;">Archiviato il ${dataCreazione}</div>
            </div>`;
        });
        html += '</div>';
    }

    // Inserimento dell'HTML generato nel DOM
    content.innerHTML = html;
}

// ---------- SISTEMA DOCUMENTI ----------
// ============================================================
// DOCUMENTI – Gestione documenti personaggio e biblioteca
// ============================================================

function syncDocumentiDalServer() {
    if (!Array.isArray(party)) return Promise.resolve();
    const promises = party.map(personaggio => {
        return fetch(apiUrl(`/api/documenti?personaggioId=${personaggio.id || ''}`), {
            headers: buildAuthHeaders()
        })
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data.documenti)) {
                    personaggio.documenti = data.documenti.map(doc => {
                        let parsed = {};
                        try {
                            parsed = JSON.parse(doc.contenuto || '{}');
                        } catch (e) {}
                        return {
                            id: doc.id,
                            titolo: doc.titolo || 'Senza titolo',
                            lingua: parsed.lingua_richiesta || 'Comune',
                            testo: parsed.testo_originale || '',
                            testo_criptato: parsed.testo_criptato || '',
                            stato: doc.stato || 'aperto',
                            personaggio_id: doc.personaggio_id,
                            created_at: doc.created_at
                        };
                    });
                } else {
                    personaggio.documenti = [];
                }
            })
            .catch(error => {
                console.warn('Impossibile sincronizzare documenti per', personaggio.nome, error?.message || error);
            });
    });
    return Promise.all(promises);
}

function caricaDocumentiArchiviati() {
    return fetch(apiUrl('/api/documenti?personaggioId=0'), {
        headers: buildAuthHeaders()
    })
        .then(r => {
            if (!r.ok) throw new Error('Errore nel caricamento documenti archiviati');
            return r.json();
        })
        .then(data => {
            if (data.documenti) {
                window.archivedDocuments = data.documenti.map(doc => {
                    let parsed = {};
                    try {
                        parsed = JSON.parse(doc.contenuto || '{}');
                    } catch (e) {}
                    return {
                        id: doc.id,
                        titolo: doc.titolo || 'Senza titolo',
                        lingua: parsed.lingua_richiesta || 'Comune',
                        testo: parsed.testo_originale || '',
                        testo_criptato: parsed.testo_criptato || '',
                        stato: doc.stato || 'aperto',
                        personaggio_id: doc.personaggio_id,
                        created_at: doc.created_at,
                        traduzioni: (() => { try { return JSON.parse(doc.traduzioni || '[]'); } catch { return []; } })()
                    };
                });
            }
        })
        .catch(err => {
            console.warn('Errore caricamento documenti archiviati:', err);
        });
}

function renderDocumentiPersonaggio(p) {
    let modal = document.getElementById('modal-documenti-personaggio');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-documenti-personaggio';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const docs = p.documenti || [];
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;

    let contentHtml = '';
    if (docs.length === 0) {
        contentHtml = '<p style="color:#aaa;">Nessun documento trovato per questo personaggio.</p>';
    } else {
        const opzioniParty = party
            .filter(membro => membro.id !== p.id)
            .map(membro => `<option value="${membro.id}">${membro.nome}</option>`)
            .join('');

        contentHtml = docs.map(d => {
            const linguaDoc = d.lingua || 'Comune';
            const conosceLingua = personaggioConosceLingua(p, linguaDoc) || (d.traduzioni || []).some(l => personaggioConosceLingua(p, l));
            const testoMostrato = conosceLingua
                ? d.testo
                : (d.testo_criptato || d.testo.replace(/[a-zA-Z0-9]/g, '?'));

            const notaLingua = conosceLingua
                ? `<span style="color:#2ecc71;">✅ Lingua conosciuta: ${linguaDoc}</span>`
                : `<span style="color:#e74c3c;">🔒 Lingua sconosciuta: ${linguaDoc}</span>`;

            return `
            <div style="background:#222; padding:15px; border:1px solid #444; margin-bottom:10px; border-radius:4px;">
                <div style="font-weight:bold; color:#f1c40f; margin-bottom:4px; font-size:1.1rem;">📜 ${d.titolo}</div>
                <div style="font-size:0.85rem; margin-bottom:10px; font-style:italic;">${notaLingua}</div>
                <div style="font-size:0.9rem; color:#eee; white-space:pre-wrap; background:#111; padding:10px; border:1px solid #333; margin-bottom:15px; max-height:150px; overflow-y:auto;">${testoMostrato}</div>
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <select id="destinatario-doc-${d.id}" style="background:#333; color:white; border:1px solid #555; padding:5px;">
                        <option value="">-- Seleziona Pg --</option>
                        ${opzioniParty}
                    </select>
                    <button class="btn-hero" style="font-size:0.8rem; padding:5px 10px;" onclick="window.passaDocumento(${p.id}, ${d.id})">➡️ PASSA</button>
                    <button class="btn-hero" style="font-size:0.8rem; padding:5px 10px; background:#8e44ad;" onclick="window.archiviaInBiblioteca(${p.id}, ${d.id})">📁 ARCHIVIA</button>
                    <button class="btn-hero" style="font-size:0.8rem; padding:5px 10px; background:#2980b9;" onclick="window.visualizzaDocumento(${p.id}, ${d.id})">🔍 DETTAGLIO</button>
                    ${currentUser?.role === 'master' ? `<button class="btn-hero" style="font-size:0.8rem; padding:5px 10px; background:#c0392b;" onclick="window.eliminaDocumento(${d.id})">🗑️ ELIMINA</button>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width:700px;">
            <h2 style="color:#8e44ad; letter-spacing:2px; margin-bottom:15px;">📜 DOCUMENTI DI ${p.nome.toUpperCase()}</h2>
            <div style="text-align:left; max-height:60vh; overflow-y:auto; padding-right:10px;">
                ${contentHtml}
            </div>
            <div class="modal-footer" style="margin-top:20px;">
                <button class="btn-big btn-cancel" onclick="chiudiModal('modal-documenti-personaggio')">CHIUDI</button>
            </div>
        </div>`;

    modal.style.display = 'block';
}

window.apriDocumentiPersonaggio = function(idx) {
    const p = party[idx];
    if (!p) return;
    syncDocumentiDalServer()
        .then(() => renderDocumentiPersonaggio(p))
        .catch(() => renderDocumentiPersonaggio(p));
};

window.visualizzaDocumento = function(personaggioId, docId) {
    const p = party.find(p => p.id === personaggioId);
    if (!p) return;
    const doc = (p.documenti || []).find(d => d.id === docId);
    if (!doc) return alert('Documento non trovato.');

    const linguaDoc = doc.lingua || 'Comune';
    const conosceLingua = linguaDoc.toLowerCase() === 'comune' || (p.lingue && p.lingue.includes(linguaDoc));
    const testoMostrato = conosceLingua
        ? doc.testo
        : (doc.testo_criptato || doc.testo.replace(/[a-zA-Z0-9]/g, '?'));

    alert(
        `📜 ${doc.titolo.toUpperCase()}\n` +
        `────────────────────\n` +
        `Lingua: ${linguaDoc}\n` +
        `Stato: ${conosceLingua ? '✅ Compresa' : '🔒 Incomprensibile'}\n` +
        `────────────────────\n\n` +
        testoMostrato +
        `\n\n────────────────────\n` +
        `Archiviato il: ${doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Data sconosciuta'}`
    );
};

window.passaDocumento = async function(mittenteId, docId) {
    const mittente = party.find(p => p.id === mittenteId);
    if (!mittente) return alert('Mittente non trovato.');

    const selectElem = document.getElementById(`destinatario-doc-${docId}`);
    if (!selectElem) return alert('Seleziona un destinatario.');
    const destinatarioId = parseInt(selectElem.value, 10);
    if (!destinatarioId || isNaN(destinatarioId)) {
        return alert('Seleziona un destinatario valido.');
    }
    const destinatario = party.find(p => p.id === destinatarioId);
    if (!destinatario) return alert('Destinatario non trovato.');

    if (mittente.inSpedizione !== destinatario.inSpedizione) {
        return alert('Impossibile passare il documento: i personaggi non si trovano nello stesso luogo.');
    }

    try {
        const response = await fetch(apiUrl(`/api/documenti/${docId}/passa`), {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ nuovoProprietarioId: destinatarioId })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => null);
            throw new Error(err?.error || 'Errore del server.');
        }

        alert(`✅ Documento passato a ${destinatario.nome}.`);
        await syncDocumentiDalServer();
        const idx = party.indexOf(mittente);
        if (idx !== -1) window.apriDocumentiPersonaggio(idx);
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();

    } catch (err) {
        alert(`❌ Errore nel passaggio: ${err.message}`);
        console.error(err);
    }
};

window.archiviaInBiblioteca = async function(mittenteId, docId) {
    const mittente = party.find(p => p.id === mittenteId);
    if (!mittente) return alert('Personaggio non trovato.');

    if (mittente.inSpedizione) {
        return alert('Non puoi archiviare in biblioteca mentre sei in spedizione!');
    }

    const conferma = confirm('Vuoi archiviare questo documento nella Biblioteca della Base? Tutti potranno leggerlo, ma non lo avrai più con te.');
    if (!conferma) return;

    try {
        const response = await fetch(apiUrl(`/api/documenti/${docId}/archivia`), {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => null);
            throw new Error(err?.error || 'Errore del server.');
        }

        alert('✅ Documento archiviato al sicuro nella Biblioteca della Base.');
        await syncDocumentiDalServer();
        await caricaDocumentiArchiviati();
        const idx = party.indexOf(mittente);
        if (idx !== -1) window.apriDocumentiPersonaggio(idx);
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();

    } catch (err) {
        alert(`❌ Errore nell'archiviazione: ${err.message}`);
        console.error(err);
    }
};

window.eliminaDocumento = async function(docId) {
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!currentUser || currentUser.role !== 'master') {
        return alert('Solo il master può eliminare documenti.');
    }

    const conferma = confirm('Eliminare definitivamente questo documento? L’operazione non può essere annullata.');
    if (!conferma) return;

    try {
        const response = await fetch(apiUrl(`/api/documenti/${docId}`), {
            method: 'DELETE',
            headers: buildAuthHeaders()
        });

        if (!response.ok) {
            const err = await response.json().catch(() => null);
            throw new Error(err?.error || 'Errore del server.');
        }

        alert('✅ Documento eliminato.');
        await syncDocumentiDalServer();
        await caricaDocumentiArchiviati();
        const mittente = party.find(p => (p.documenti || []).some(doc => doc.id === docId));
        const idx = mittente ? party.indexOf(mittente) : -1;
        if (idx !== -1) window.apriDocumentiPersonaggio(idx);
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
    } catch (err) {
        alert(`❌ Errore nell'eliminazione: ${err.message}`);
        console.error(err);
    }
};

// ---------- ASSISTENZA ----------
function apriAiutoModal() {
    renderAiutoModal();
    const modal = document.getElementById('modal-aiuto');
    if (modal) modal.style.display = 'block';
}

function annullaAssistente() {
    window.assistenzaSelezionata = null;
    if (typeof aggiornaInterfaccia === 'function') {
        aggiornaInterfaccia();
    } else if (typeof aggiornaInterfaccia_local === 'function') {
        aggiornaInterfaccia_local();
    }
    if (typeof mostraNotificaInAlto === 'function') {
        mostraNotificaInAlto('Assistenza annullata.', 'avviso');
    }
}

window.selezionaAssistente = function(idx, tipo) {
    const p = party[idx];
    if (!p) return;
    window.assistenzaSelezionata = { idx, tipo };
    if (typeof mostraNotificaInAlto === 'function') {
        mostraNotificaInAlto(`${p.nome} è pronto ad aiutare con ${tipo}.`, 'successo');
    }
    const modal = document.getElementById('modal-aiuto');
    if (modal) modal.style.display = 'none';
    renderAiutoModal();
    aggiornaInterfaccia();
};

function personaggioConosceLingua(p, lingua) {
    if (!lingua) return true;
    const l = lingua.toLowerCase();
    if (l === 'comune' || l === 'verbum') return true;
    if (p && p.hasPerk && p.hasPerk('Traduttore')) return true;
    return !!(p && p.lingue && p.lingue.map(x => x.toLowerCase()).includes(l));
}

function partyConosceLingua(lingua, extra = []) {
    const lingue = [lingua, ...(extra || [])];
    return lingue.some(l => party.some(p => personaggioConosceLingua(p, l)));
}

    function applicaScalataLivelloMagia(p) {
        const costi = [0, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // costo per salire al livello i
        while (p.livelloMagia < 9) {
            const prossimoCosto = costi[p.livelloMagia + 1];
            if ((p.puntiConoscenzaMagica || 0) >= prossimoCosto) {
                p.puntiConoscenzaMagica -= prossimoCosto;
                p.livelloMagia += 1;
                p.updateManaFromMagiaLevel();
                mostraNotificaInAlto(`🔮 ${p.nome} è salito al Livello di Magia ${p.livelloMagia}!`, 'successo');
            } else {
                break;
            }
        }
    }window.applicaScalataLivelloMagia = applicaScalataLivelloMagia;
window.personaggioConosceLingua = personaggioConosceLingua;
window.partyConosceLingua = partyConosceLingua;

// ---------- ESPOSIZIONI GLOBALI ----------
window.studio = studio;
window.apriStudio = apriStudio;
window.apriBiblioteca = apriBiblioteca;
window.apriAiutoModal = apriAiutoModal;
window.annullaAssistente = annullaAssistente;
window.selezionaAssistente = window.selezionaAssistente;
window.syncDocumentiDalServer = syncDocumentiDalServer;
window.caricaDocumentiArchiviati = caricaDocumentiArchiviati;
window.bibliotecaBase = window.bibliotecaBase || { documenti: [] };
window.SKILL_SYSTEM = SKILL_SYSTEM;

console.log('✅ studio.js caricato correttamente.');