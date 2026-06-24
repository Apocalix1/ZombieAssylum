const BOOK_SUBJECT_TITLES = {
    'Addestrare animali': [
        '1250 animali che puoi accarezzare',
        '1250 animali che non puoi accarezzare',
        '1200 animali che puoi accarezzare ma poi devi scappare',
        'Allevamento e ibridazione di animali'
    ],
    'Arcano': [
        'Palla di fuoco non è la soluzione a tutto (quasi)',
        'La magia cos\'è?',
        'Incantesimi utili per la vita quotidiana',
        'Incantesimi che non userai mai'
    ],
    'Cucina': [
        'Dolci e Dessert da Gramon Taurs',
        'Il vegetariano è overated. 200 ricette su come sentirti un vero predatore',
        'Ricette da tutte le isole volanti',
        'Mestolo d\'oro'
    ],
    'Indagare': [
        'Come capire se è un cappello o per reale',
        'Top 10 stupidi modi in cui i serial killer sono stati catturati (WacthmojoTeverat)',
        'Come capire chi ha davanti (nel caso te ne fossi dimenticato)',
        'Mio figlio \u00e8 gay o un artista?'
    ],
    'Giochi di carte': [
        'Corso allenamento per battere tua nonna a carte 2/5',
        'Non è azzardo, è strategia da vero Baro',
        'Tecniche vincenti dei giochi pi\xf9 comuni',
        'I giochi pi\xf9 bizzarri di Teverat'
    ],
    'Inganno': [
        'Come nascondere ai tuoi la tua sessualit\xe0',
        'Manipolazione, 10 trucchi da Alpha',
        'Psicologia Oscura, i trucchi da sapere fin da bambino',
        'Non serve pagare tutte le tasse'
    ],
    'Storia': [
        'Top 10 guerre (esclusa quelle delle città) (WacthmojoTeverat)',
        'Cuore dacciaio, tutti i riferimenti storici',
        'Storia della casata famigliare Papoulus, una retrospersione di 400 anni',
        '100 razze e perchè odiarle'
    ],
    'Strumenti da scasso': [
        'Non solo balcani, adesso anche tu sei un pericolo',
        'Voglio entrare in casa di qualcuno',
        'Come sblocco il lucchetto se non ho la chiave?',
        'Scassinare non \xe8 da ladri'
    ],
    'Sopravvivenza': [
        'La natura che pu\xf2 salvare',
        'Come riconoscere le tracce',
        'Guida per chi ancora non ha trovato un affitto',
        'Sopravivo nella foresta con un coltellino e tante preghiere'
    ],
    'Religione': [
        'Dei e demoni cui non conviene fare patti (Sopratutto Kawanata)',
        'Le religioni pi\xf9 importanti di Teverat',
        'Dei e Astrali, enciclopedia completa',
        'Raccolta di storie e leggende'
    ],
    'Persuasione': [
        'Come ottenere ci\xf2 che si vuole dagli altri',
        'Stai perdendo tantissimo non leggendo questo libro',
        'Come essere l\'Alpha della stanza',
        'Perchè EmmaxEmy è una delle migliori coppie di Identità 5'
    ],
    'Natura': [
        '200 piante curative',
        'Cosa non dovresti mangiare',
        'Anatomia e funzione delle forme vegetali pi\xf9 comuni',
        'Fiori e frutti coltivabili in giardino'
    ],
    'Manodopera': [
        'Non chiamare un esperto! E\' una truffa',
        'Tubature, Finestre e tutto quello che ti pu\xf2 servire',
        'Quale strumento usare per cosa',
        'Diventa un uomo di mano'
    ],
    'Intrattenere': [
        'Lore completa di 5 notti da Alfredo',
        'Libro analisi sulla Padella magica di Madoka',
        'Vestirsi per impressionare',
        '100000 Barzellette da Gregorio Formaggi'
    ],
    'Intimidire': [
        'Come aumentare la tua aura',
        'Uomini forti, destini forti, uomini deboli, destini deboli',
        'Non serve picchiare la tua donna, 20 trucchi per dominare le persone senza alzare un dito',
        'Come far pesare ogni parola'
    ],
    'Medicina': [
        'Anatomia',
        'Non si dice ritardato',
        'Chirurgia',
        'Anatomopatologia',
        'Come ti batte il cuore (non emotivamente)',
        'Pene e vagina, come scegliere',
        'Primo Soccorso',
        'Infermieristica',
        'Ottica',
        'Odontoiatria',
        'Dermatologia',
        'Gastrontologia',
        'Ematologia',
        'Medicina interna',
        '1000 malattie che pu\xf2 avere tuo figlio',
        'Malattie infettive'
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
        ['Intimidire',0.02], ['Medicina',0.06]
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

function getStudyDieByTotalHours(hours) {
    const total = Math.max(1, hours);
    const level = STUDY_DICE_BY_TOTAL_HOURS.find(entry => total <= entry.max);
    return level ? level.die : '2d10';
}

function teacherCanTeach(teacher, subject, needsMastery) {
    if (!teacher) return false;
    const subjectKey = (subject || '').toLowerCase().trim();
    if (needsMastery) {
        return teacher.masteries && teacher.masteries.map(m => m.toLowerCase()).includes(subjectKey);
    }
    return teacher.hasCompetenza(subject);
}

function studio(idx) {
    studioPersonaggioSelezionato = idx;
    apriStudio();
}

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

let studioPersonaggioSelezionato = null;

function awardStudyPM(p, ore) {
    const guadagno = Math.floor(ore / 2);
    if (guadagno <= 0) return 0;
    const cap = getStudyPMCap(p);
    const nuovoTotale = Math.min(cap, p.pmMedicina + guadagno);
    const effettivo = nuovoTotale - p.pmMedicina;
    p.pmMedicina = nuovoTotale;
    return effettivo;
}

function hasTeacher(p) {
    return Array.isArray(p.perks) && p.perks.some(perk => typeof perk !== 'string' && perk.nome === 'Insegnante');
}

function renderStudioModal() {
    const content = document.getElementById('studio-content');
    if (!content) return;
    const selezionato = party[studioPersonaggioSelezionato] || party[0];
    let html = `<div style="margin-bottom:14px; font-size:0.9rem; color:#ddd;">
        <strong>Studente:</strong> ${selezionato.nome}<br>
        <strong>Medicina:</strong> Livello ${selezionato.livelloMedicina} - PM ${selezionato.pmMedicina}/${getStudyPMCap(selezionato)}<br>
        <strong>Ore studiosi oggi:</strong> ${selezionato.oreStudioGiornaliere}/8 ${selezionato.studyOverload ? '(<span style="color:#e74c3c">Sovraccarico</span>)' : ''}
    </div>`;
    html += '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">';
    party.forEach((p, idx) => {
        html += `<button class="btn-big" style="flex:1; min-width:140px; ${idx === studioPersonaggioSelezionato ? 'background:#2980b9;' : ''}" onclick="switchStudioPersonaggio(${idx})">${p.nome}</button>`;
    });
    html += '</div>';
    html += '<div style="margin-bottom:10px; font-size:0.9rem; color:#ddd;"><strong>Libri disponibili:</strong></div>';
    html += '<div style="display:grid; gap:8px; max-height:320px; overflow-y:auto;">';
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
    ore = Math.min(ore, maxAllowed);

    let teacherName = null;
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
    book.usedHours += effectiveHours;

    p.oreStudioGiornaliere += effectiveHours;
    p.studyOverload = p.oreStudioGiornaliere > 8;

    if (book.subject === 'Medicina') {
        const pmGained = awardStudyPM(p, effectiveHours);
        if (pmGained > 0) {
            mostraNotificaInAlto(`${p.nome} ha studiato Medicina per ${effectiveHours}h e guadagnato +${pmGained} PM.`, 'successo');
        } else {
            mostraNotificaInAlto(`${p.nome} ha studiato Medicina per ${effectiveHours}h ma ha già raggiunto il limite attuale di PM.`, 'warning');
        }
    } else {
        let currentPoints = p.getStudyPoints(book.subject);
        const stat = STUDY_SUBJECT_ABILITY[book.subject] || 'Intelligenza';
        const attrMod = p.getStatDettagliata(stat).mod;
        let summary = [];
        const helper = (typeof assistenzaSelezionata !== 'undefined' && assistenzaSelezionata && assistenzaSelezionata.tipo === 'studio') ? party[assistenzaSelezionata.idx] : null;
        const helperName = action.teacherName || (helper ? helper.nome : null);

        for (let i = 0; i < effectiveHours; i++) {
            const nextHourTotal = (p.oreStudioPerMateria[book.subject] || 0) + 1;
            p.oreStudioPerMateria[book.subject] = nextHourTotal;
            const die = getStudyDieByTotalHours(nextHourTotal);
            let roll = rollDiceNotation(die) + attrMod;
            if (helperName || hasTeacher(p)) {
                const roll2 = rollDiceNotation(die) + attrMod;
                roll = Math.max(roll, roll2);
            }
            if (p.studyOverload) {
                roll = Math.max(0, roll - 2);
            }
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
            assistenzaSelezionata = null;
        } else if (action.teacherName) {
            mostraNotificaInAlto(`${p.nome} studia con l'aiuto di ${action.teacherName}.`, 'successo');
        }
        let message = `${p.nome} studia ${book.subject} per ${effectiveHours}h (${summary.join(', ')}) e arriva a ${currentPoints}/210 punti.`;
        if (currentPoints >= 210) message += ' Hai ottenuto una MAESTRIA!';
        else if (currentPoints >= 70) message += ' Hai ottenuto una COMPETENZA!';
        if (p.studyOverload) message += ' Sovraccarico attivo.';
        mostraNotificaInAlto(message, 'successo');
    }

    // Elimina il libro se è stato studiato fino al limite
    if (book.usedHours >= book.maxStudyHours) {
        const index = magazzino.libri.indexOf(book);
        if (index !== -1) magazzino.libri.splice(index, 1);
    }
}

function getStudyPMCap(p) {
    const livelli = [8, 24, 40, 56, 72];
    const next = livelli[p.livelloMedicina] || 72;
    return Math.floor(next * 0.4);
}

function getStudyDie(ore) {
    return getStudyDieByTotalHours(ore);
}

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
        "Percezione": "Saggezza",
        "Persuasione": "Carisma",
        "Religione": "Saggezza",
        "Storia": "Intelligenza"
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

SKILL_SYSTEM.languages = [
    "Lingua di Diefrost",
    "Lingua di Engenia",
    "Lingua di Chrimata",
    "Lingua di Rodulphia",
    "Lingua di Talassio",
    "Lingua di Britannia/Greenhill",
    "Lingua della Terra dei cieli",
    "Lingua del Grande Blu"
];