
import { magazzino, setMagazzino, party, setParty } from '../state.js';

// ---------- OUTBOX PER COMANDI OFFLINE ----------
let pendingCommands = [];
const PENDING_COMMANDS_KEY = 'pending_commands';

// logic.js - aggiungi dopo le altre funzioni di sync

let syncPartyInterval = null;
let isSyncing = false;

export async function syncPartyFromServer() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        const data = await requestJson(apiUrl('/api/party'));
        if (!data.party || !Array.isArray(data.party)) return;

        const serverChars = data.party;
        const serverIds = new Set(serverChars.map(c => c.id));

        // 1. Aggiorna o aggiungi personaggi
        for (const serverChar of serverChars) {
            const existing = party.find(p => p.id === serverChar.id);
            if (existing) {
                // Aggiorna solo se il server è più recente
                if (serverChar.updated_at > existing.updated_at) {
                    // Unisci i dati (serverChar.data è un oggetto)
                    const newData = serverChar.data || {};
                    Object.assign(existing, newData);
                    existing.id = serverChar.id;
                    existing.user_id = serverChar.user_id;
                    existing.ownerUsername = serverChar.owner_username;
                    existing.updated_at = serverChar.updated_at;
                    // Assicurati che l'inventario e altre proprietà siano inizializzate
                    if (typeof existing.initInventarioBase === 'function') {
                        existing.initInventarioBase();
                    }
                }
            } else {
                // Nuovo personaggio – crea istanza
                const stats = serverChar.data || {};
                const nome = stats.nome || serverChar.nome || 'Sconosciuto';
                const p = new Personaggio(nome, stats.giornoInizio || 0);
                Object.assign(p, stats);
                p.id = serverChar.id;
                p.user_id = serverChar.user_id;
                p.ownerUsername = serverChar.owner_username;
                p.updated_at = serverChar.updated_at;
                if (typeof p.initInventarioBase === 'function') {
                    p.initInventarioBase();
                }
                party.push(p);
            }
        }

        // 2. Rimuovi personaggi che non sono più nel server (es. morti)
        for (let i = party.length - 1; i >= 0; i--) {
            if (!serverIds.has(party[i].id)) {
                party.splice(i, 1);
            }
        }

        // 3. Aggiorna l'interfaccia
        if (typeof window.aggiornaInterfaccia === 'function') {
            window.aggiornaInterfaccia();
        }
    } catch (error) {
        console.warn('Errore sincronizzazione party:', error?.message || error);
    } finally {
        isSyncing = false;
    }
}

/**
 * Avvia il ciclo di sincronizzazione completo (polling)
 * - Sincronizza party, magazzino, stati, documenti
 * - Spinge le modifiche locali al server
 */
export function avviaSincronizzazioneCompleta() {
    if (syncPartyInterval) return;

    // Esegui subito una prima sincronizzazione
    syncPartyFromServer();

    // Poi ogni 6 secondi
    syncPartyInterval = setInterval(async () => {
        if (!navigator.onLine) return;
        const user = getCurrentUser();
        if (!user) return;

        // 1. Ricarica party
        await syncPartyFromServer();

        // 2. Sincronizza magazzino, stati, documenti (dal server al client)
        await syncMagazzinoDalServer();
        await syncStatiDalServer();
        await syncDocumentiDalServer();

        // 3. Spingi le modifiche locali al server (per ogni personaggio)
        for (const p of party) {
            if (p.id) {
                await sincronizzaPersonaggio(p);
            }
        }

        // 4. Aggiorna interfaccia (già fatto dentro syncPartyFromServer, ma per sicurezza)
        if (typeof window.aggiornaInterfaccia === 'function') {
            window.aggiornaInterfaccia();
        }
    }, 3000); // 3 secondi
}

function savePendingCommands() {
    try {
        localStorage.setItem(PENDING_COMMANDS_KEY, JSON.stringify(pendingCommands));
    } catch (e) {}
}

export function queueCommand(command) {
    pendingCommands.push(command);
    savePendingCommands();
    processPendingCommands(); // tenta subito se online
}

export function refreshPartyListeners() {
    if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
}


async function executeCommand(cmd) {
    switch (cmd.type) {
        case 'updateMagazzino':
            await requestJson(apiUrl('/api/magazzino'), {
                method: 'PUT',
                body: JSON.stringify({ data: cmd.fields })
            });
            break;
        case 'setOreTotali':
            await requestJson(apiUrl('/api/magazzino'), {
                method: 'PUT',
                body: JSON.stringify({ data: { oreTotali: cmd.ore } })
            });
            break;
        case 'markDead':
            await requestJson(apiUrl(`/api/personaggi/${cmd.personaggioId}`), {
                method: 'PUT',
                body: JSON.stringify({ data: JSON.stringify(cmd.data), status: 'morto' })
            });
            break;
        case 'sendDocument':
            await requestJson(apiUrl('/api/documenti'), {
                method: 'POST',
                body: JSON.stringify(cmd.payload)
            });
            break;
        default:
            throw new Error('Tipo comando sconosciuto: ' + cmd.type);
    }
}

export async function processPendingCommands() {
    if (!navigator.onLine || pendingCommands.length === 0) return;
    // Raggruppa i comandi updateMagazzino (merge dei campi)
    const grouped = {};
    const others = [];
    for (const cmd of pendingCommands) {
        if (cmd.type === 'updateMagazzino') {
            if (!grouped.updateMagazzino) grouped.updateMagazzino = { fields: {} };
            Object.assign(grouped.updateMagazzino.fields, cmd.fields);
        } else {
            others.push(cmd);
        }
    }
    const toProcess = [];
    if (grouped.updateMagazzino) toProcess.push({ type: 'updateMagazzino', fields: grouped.updateMagazzino.fields });
    toProcess.push(...others);

    const toRetry = [];
    for (const cmd of toProcess) {
        try {
            await executeCommand(cmd);
        } catch (e) {
            console.warn('Comando fallito, riproverò dopo:', cmd, e);
            toRetry.push(cmd);
        }
    }
    pendingCommands = toRetry;
    savePendingCommands();
}


export function getPendingDeadIds() {
    return pendingCommands
        .filter(cmd => cmd.type === 'markDead')
        .map(cmd => cmd.personaggioId);
}
// ---------- FINE OUTBOX ----------

export const LOCAL_STORAGE_PREFIX = "personaggio_";

// ---------- POLLING DINAMICO CON VISIBILITY ----------
let fastPollIntervalId = null;
let slowPollIntervalId = null;
let fastPollDelay = 500;
let slowPollDelay = 3000;

function startFastPoll() {
    if (fastPollIntervalId) clearInterval(fastPollIntervalId);
    fastPollIntervalId = setInterval(async () => {
        if (navigator.onLine) {
            await syncMagazzinoDalServer();
        }
    }, fastPollDelay);
}

let isSyncingMagazzino = false;
export async function syncMagazzinoDalServer() {
    if (isSyncingMagazzino) return;
    isSyncingMagazzino = true;
    try {
        const data = await requestJson(apiUrl('/api/magazzino'));
        if (data.magazzino && data.magazzino.data) {
            setMagazzino(data.magazzino.data);
            window.magazzino = magazzino;
            if (typeof magazzino.oreTotali === 'number' && magazzino.oreTotali > (window.oreTotali || 0)) {
                window.oreTotali = magazzino.oreTotali;}
            if (typeof window.renderCimitero === 'function') {
                window.renderCimitero();
            }
        }
    } catch (error) {
        console.warn('Impossibile aggiornare il magazzino dal server:', error?.message || error);
    } finally {
        isSyncingMagazzino = false;
    }
}

function startSlowPoll() {
    if (slowPollIntervalId) clearInterval(slowPollIntervalId);
    slowPollIntervalId = setInterval(async () => {
        if (navigator.onLine) {
            const user = getCurrentUser();
            if (!user) return;
            // Solo per i giocatori: sincronizza stati, documenti e personaggi propri
            if (user.role !== 'master') {
                await syncStatiDalServer();
                await syncDocumentiDalServer();
                for (const p of party) {
                    if (p.user_id === user.id) {
                        await sincronizzaPersonaggio(p);
                    }
                }
            }
            // Il master aggiorna il party tramite caricaPartyMaster in auth-ui.js
            if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
            if (typeof window.renderCharacterList === 'function') window.renderCharacterList();
        }
    }, slowPollDelay);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        fastPollDelay = 2000;
        slowPollDelay = 8000;
    } else {
        fastPollDelay = 500;
        slowPollDelay = 3000;
    }
    startFastPoll();
    startSlowPoll();
    // Anche il polling del party (in auth-ui.js) verrà gestito separatamente
});

// logic.js – modifica la sezione apiBaseUrl
const apiBaseUrl = (() => {
    if (typeof window === 'undefined') return '';
    if (window.API_BASE) return window.API_BASE;
    // In sviluppo, forziamo sempre la porta 4000 se non è la stessa
    if (location.port && location.port !== '4000') {
        return `${location.protocol}//${location.hostname}:4000`;
    }
    // Se siamo già sulla 4000 o su una porta non standard, usa l'origin
    return '';
})();

export function apiUrl(path) {
    // Se il path inizia già con http, restituiscilo così com'è
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    // Se apiBaseUrl è vuoto, usa l'origin corrente
    const base = apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return base ? `${base}${path}` : path;
}

function nowTimestamp() {
    return new Date().toISOString();
}

export function buildAuthHeaders(additional = {}) {
    const headers = {
        'ngrok-skip-browser-warning': 'true'
    };
    const user = getCurrentUser();
    if (user?.token) {
        headers.Authorization = `Bearer ${user.token}`;
    }
    return { ...headers, ...additional };
}

export function getCurrentUser() {
    if (typeof localStorage === 'undefined') return null;
    try {
        return JSON.parse(localStorage.getItem('utente')) || null;
    } catch {
        return null;
    }
}

export function salvaPersonaggioLocalmente(personaggio) {
    const copia = { ...personaggio, updated_at: nowTimestamp() };
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${encodeURIComponent(personaggio.nome)}`, JSON.stringify(copia));
    return copia;
}

export function caricaDatiDaLocalStorage(nome) {
    const datiSalvati = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${encodeURIComponent(nome)}`);
    if (!datiSalvati) return null;
    try {
        return JSON.parse(datiSalvati);
    } catch {
        return null;
    }
}

function parseCharacterData(value) {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return {};
        }
    }
    return value || {};
}

function normalizeCharacterRecord(character) {
    const payload = parseCharacterData(character?.data);
    return { ...character, data: payload };
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        ...options,
    });
    const text = await response.text();
    let data = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = {};
        }
    }
    if (!response.ok) {
        throw new Error(data.error || 'Errore richiesta server');
    }
    return data;
}

export async function updateMagazzinoFields(fields) {
    if (!fields || Object.keys(fields).length === 0) return;
    // Aggiorna localmente
    Object.assign(magazzino, fields);
    window.magazzino = magazzino;
    if (fields.oreTotali !== undefined) {
        window.oreTotali = fields.oreTotali;
    }
    // Accoda il comando
    queueCommand({ type: 'updateMagazzino', fields });
    await processPendingCommands();
}

export async function addPushCommand(command) {
    try {
        await requestJson(apiUrl('/api/master/push-commands'), {
            method: 'POST',
            body: JSON.stringify(command),
        });
    } catch (error) {
        console.warn('Errore invio comando push:', error?.message || error);
    }
}

export async function fetchPersonaggioFromCloud(nome) {
    if (!nome) return null;
    try {
        const data = await requestJson(apiUrl(`/api/personaggi/${encodeURIComponent(nome)}`));
        return {
            data: normalizeCharacterRecord(data.personaggio),
            updated_at: data.personaggio?.updated_at || nowTimestamp(),
        };
    } catch (error) {
        console.warn('Impossibile caricare il personaggio dal server:', error?.message || error);
        return null;
    }
}

function salvaPersonaggio(p) {
    if (p && typeof salvaPersonaggioCloud === 'function') {
        salvaPersonaggioCloud(p);
    }
}

export async function fetchUserCharacters() {
    try {
        const data = await requestJson(apiUrl('/api/characters'));
        return Array.isArray(data.characters) ? data.characters.map(normalizeCharacterRecord) : [];
    } catch (error) {
        console.warn('Impossibile caricare personaggi dal server:', error?.message || error);
        return [];
    }
}

export async function salvaPersonaggioCloud(personaggio) {
    personaggio.updated_at = nowTimestamp();
    salvaPersonaggioLocalmente(personaggio);

    const user = getCurrentUser();
    if (!user) return;
    const isMaster = user.role === 'master';

    // Se il personaggio ha un ID, usa PUT per aggiornare la riga esistente (sia per Master che per Giocatore)
    if (personaggio.id) {
        try {
            const risposta = await requestJson(apiUrl(`/api/personaggi/${personaggio.id}`), {
                method: 'PUT',
                body: JSON.stringify({
                    data: JSON.stringify(personaggio)
                }),
            });
            if (risposta && risposta.personaggio && risposta.personaggio.id) {
                personaggio.id = risposta.personaggio.id;
                // Aggiorna eventuali campi tornati dal server (es. updated_at)
                if (risposta.personaggio.updated_at) {
                    personaggio.updated_at = risposta.personaggio.updated_at;
                }
                salvaPersonaggioLocalmente(personaggio);
            }
        } catch (error) {
            console.warn('Salvataggio cloud (PUT) differito:', error?.message || error);
        }
        return;
    }

    // Altrimenti usa POST /api/characters (per creazione iniziale)
    try {
        const risposta = await requestJson(apiUrl('/api/characters'), {
            method: 'POST',
            body: JSON.stringify({
                nome: personaggio.nome,
                classe: personaggio.classe || 'Sopravvissuto',
                data: JSON.stringify(personaggio),
                updated_at: personaggio.updated_at,
            }),
        });
        if (risposta && risposta.character && risposta.character.id) {
            personaggio.id = risposta.character.id;
            salvaPersonaggioLocalmente(personaggio);
        }
    } catch (error) {
        console.warn('Salvataggio cloud (POST) differito:', error?.message || error);
    }
}

export async function sincronizzaPersonaggio(personaggioLocale) {
    const localCopy = salvaPersonaggioLocalmente(personaggioLocale);
    if (!navigator.onLine) {
        return localCopy;
    }
    try {
        const cloudData = await fetchPersonaggioFromCloud(personaggioLocale.nome);
        if (!cloudData) {
            await salvaPersonaggioCloud(localCopy);
            return localCopy;
        }
        const localUpdated = new Date(localCopy.updated_at || nowTimestamp());
        const cloudUpdated = new Date(cloudData.updated_at || nowTimestamp());
        if (localUpdated >= cloudUpdated) {
            await salvaPersonaggioCloud(localCopy);
            return localCopy;
        } else {
            // Il cloud è più aggiornato, ma preserviamo l'azione corrente se presente con onComplete
            const merged = { ...cloudData.data, updated_at: cloudData.updated_at };
            const idx = party.findIndex(p => p.nome === merged.nome);
            if (idx !== -1) {
                const localPersonaggio = party[idx];
                // Se il personaggio locale ha un'azione corrente con onComplete (funzione) o ha una coda non vuota,
                // preserviamo azioneCorrente e codaAzioni per non perdere il callback.
                const hasLocalAction = localPersonaggio && localPersonaggio.azioneCorrente && typeof localPersonaggio.azioneCorrente.onComplete === 'function';
                const hasLocalQueue = localPersonaggio && localPersonaggio.codaAzioni && localPersonaggio.codaAzioni.length > 0;
                if (hasLocalAction || hasLocalQueue) {
                    // Salva localmente le azioni in corso
                    const azioneCorrenteLocale = localPersonaggio.azioneCorrente || null;
                    const codaAzioniLocale = localPersonaggio.codaAzioni ? [...localPersonaggio.codaAzioni] : [];
                    // Unisci i dati dal cloud
                    Object.assign(localPersonaggio, merged);
                    // Ripristina le azioni locali (che contengono onComplete)
                    localPersonaggio.azioneCorrente = azioneCorrenteLocale;
                    localPersonaggio.codaAzioni = codaAzioniLocale;
                    // Aggiorna il timestamp locale per evitare che al prossimo polling il cloud sovrascriva di nuovo
                    localPersonaggio.updated_at = nowTimestamp();
                    salvaPersonaggioLocalmente(localPersonaggio);
                    // Non salviamo subito sul cloud per non creare un conflitto; il prossimo ciclo di sync farà il merge
                    return localPersonaggio;
                }
            }
            // Nessuna azione critica da preservare: sovrascrivi normalmente
            Object.assign(personaggioLocale, merged);
            salvaPersonaggioLocalmente(personaggioLocale);
            // Nota: se idx era -1, non facciamo nulla; se idx esisteva ma non è entrato nell'if, riusiamo lo stesso idx
            if (idx !== -1) {
                Object.assign(party[idx], merged);
            }
            return merged;
        }
    } catch (error) {
        console.warn('Impossibile sincronizzare con il server:', error?.message || error);
        return localCopy;
    }
}

export async function syncStatiDalServer(personaggioId = null) {
    if (!Array.isArray(party)) return;
    const user = getCurrentUser();
    if (!user) return;
    const targets = personaggioId ? party.filter(p => p.id === personaggioId) : party;
    for (const personaggio of targets) {
        if (!personaggio.id) continue;
        if (user.role !== 'master' && personaggio.user_id !== user.id) continue;
        try {
            const data = await requestJson(apiUrl(`/api/personaggi/${encodeURIComponent(personaggio.id)}/stati`));
            if (Array.isArray(data.stati)) {
                personaggio.statiAlterati = data.stati;
                if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
            }
        } catch (error) {
            console.warn('Impossibile sincronizzare stati per', personaggio.nome, error?.message || error);
        }
    }
}
export async function syncDocumentiDalServer(personaggioId = null) {
    if (!Array.isArray(party)) return;
    const user = getCurrentUser();
    if (!user) return;
    const targets = personaggioId ? party.filter(p => p.id === personaggioId) : party;
    for (const personaggio of targets) {
        if (!personaggio.id) continue;
        if (user.role !== 'master' && personaggio.user_id !== user.id) continue;
        try {
            const data = await requestJson(apiUrl(`/api/documenti?personaggioId=${personaggio.id}`));
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
                        created_at: doc.created_at,
                        traduzioni: (() => { try { return JSON.parse(doc.traduzioni || '[]'); } catch { return []; } })()
                    };
                });
            } else {
                personaggio.documenti = [];
            }
        } catch (error) {
            console.warn('Impossibile sincronizzare documenti per', personaggio.nome, error?.message || error);
        }
    }
}

async function syncInvitiPendenti() {
    if (!Array.isArray(party)) return;
    for (const personaggio of party) {
        if (!personaggio.id) continue;
        try {
            const data = await requestJson(apiUrl(`/api/inviti?personaggioId=${personaggio.id}`));
            const inviti = (data.inviti || []).filter(i => i.stato === 'in_attesa');
            window._invitiMostrati = window._invitiMostrati || new Set();
            inviti.forEach(inv => {
                if (window._invitiMostrati.has(inv.id)) return;
                window._invitiMostrati.add(inv.id);
                if (typeof window.mostraInvitoEsplorazione === 'function') {
                    window.mostraInvitoEsplorazione(inv, personaggio);
                }
            });
        } catch (error) {
            console.warn('Errore sync inviti:', error?.message || error);
        }
    }
}

// ---------- CLASSE PERSONAGGIO ----------
export class Personaggio {
    constructor(nome, giornoPartenza = 0) {
        this.nome = nome;
        this.diabeteTipoI = false;
        this.diabeteTipoII = false;
        this.diabeteUltimoPastoTimestamp = null;      // ora di gioco (oreTotali) ultimo pasto
        this.diabeteTimerMax = 72;                    // 3 giorni
        this.diabeteStaminaSpesaLog = [];             // [{ora, qty}] finestra 4h iperglicemia
        this._diabeteInstabile = false;               // blocco guarigione PF (Diabete II)
        this.pesoCorporeo = { usiCuscinetto: null, benNutritoOreAccumulate: 0 };

        this.fame = 14;
        this.sete = 4;
        this.sonno = 8;
        this.faticaBase = 0;
        this.follia = 0;
        this.folliaSintomi = "1-8 nessun sintomo";
        this.contatoreCiboAvariato = 0;
        this.contatoreCiboDelizioso = 0;
        this.staminaBase = 5;
        this.velcotiaBase = 9;
        this.puntiFeritaRealiMaxBase = 5;
        this.puntiFeritaReali = 5;
        this.puntiFortunaMax = 15;
        this.rancoreDurataOre = null;
        this.puntiFortuna = 15;
        this.vittorieCombattimento = 0;
        this.pmMedicina = 0;
        this.livelloMedicina = 0;
        this.woundTimer = 0;
        this.woundTreated = false;
        this.medicalHealPending = false;
        this.oreRiposoAccumulate = 0;
        this.giornoInizio = giornoPartenza;

        this.malattia = {
            attiva: false,
            grado: 0,               // 1-3 lieve, 4-6 severa, 7-8 pesante, 9+ critica
            timerPeggioramento: 0,   // ore prima del peggioramento
            diagnosiCorretta: false,
            diagnosiEffettuata: false,
            inCura: false,
            oreCuraAccumulate: 0,
            oreCuraNecessarie: 0,
            materialiConsumati: {base: 0, avanzati: 0, critici: 0},
            gradoInizio: 0
        };

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
        this.oreAllenamento = 0;
        this.ultimoGiornoAllenamento = 0;

        this.apprendimento = {};
        this._asmaShortRestBoost = false;
        this.oreStudioPerMateria = {};
        this.oreStudioGiornaliere = 0;
        this.studyOverload = false;
        this.masteries = [];
        this.vantaggi = {};
        this.svantaggi = {};
        this.ultimoStudioOre = 0;
        this.puntiFeritaRealiMax = this.puntiFeritaRealiMaxBase;
        this.azioneCorrente = null;
        this.codaAzioni = [];
        this.inSpedizione = false;

        this.timers = {
            fameSoddisfatta: 0,
            seteSoddisfatta: 0,
            sonnoSoddisfatto: 0,
            buffFame: 0,
            buffSete: 0,
            buffSonno: 0,
            buffArtigianoAlimentare: 0,
            overdose: 0
        };
        this.consumiConsumabiliLog = [];
        this.pessimistaStack = 0;
        this.pessimistaUltimoTiro = 0;
        this.rancoreTargetId = null;
        this.senseDiColpaStack = 0;
        this.pulizieBloccate = false;
        this.autoRisorse = {};
        this._ultimoGiornoPulizia = -1;
        this.masteries = [];
        this.staminaRegenTimer = 0;
        this.competenze = [];
        this.perks = [];
        this.lingue = ['Verbum'];
        this.corazzaAPiastreMax = 20;
        this.corazzaAPiastre = 20;
        this.puntiCreazione = 63;
        this.livelloMagia = 0;
        this.manaMax = 0;
        this.manaAttuale = 0;
        this.spellsKnown = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0};
        this.piattiDeliziosi = 0;
        this.isRobot = false;
        this.robotPFMax = 50;
        this.robotPF = 50;
        this.robotPFTemp = 0;
        this.robotRepairTotalDone = 0;
        this.robotMicroRepairsUsed = 0;
        this.batteryHours = 4 * 24;
        this.batteryHoursMax = 7 * 24;
        this.statiAlterati = [];
        this.biocarburanteTimer = 0;
        this.biocarburanteDeficit = false;
        this.zainoEquipaggiato = null;
        this.taserCaricato = false;
        this.stivaliCariche = 0; // presente solo se possiede il perk/oggetto stivali a molla
        this.inRicaricaFinoA = null;
        this.inventario = null; // sarà inizializzato da initInventarioBase
        this.initInventarioBase();
    }



    initInventarioBase() {
        if (!this.inventario) {
            this.inventario = {
                armi: [],
                zaini: [],
                consumabili: [],
                composti: [],
                oggettiMagiciPersonali: [],
                cibo: 0,
                acqua: 0,
                ingranaggi: 0,
                medBase: 0,
                medAvanzati: 0,
                medCritici: 0,
                alchemici: 0,
                munizioni: { frecce: 0, quadrelli: 0, proiettili: 0 },
                proiettiliFrammentazione: 0,
                batterie:0,
                oggettiMagici: {comuni: 0, nonComuni: 0, rari: 0, superRari: 0},
                documenti: []
            };
        }
        if (!this.inventario.documenti) this.inventario.documenti = [];
        if (!this.inventario.composti) this.inventario.composti = [];
        if (!this.inventario.batterie) this.inventario.batterie = 0;
        if (!this.inventario.oggettiMagici) this.inventario.oggettiMagici = { comuni: 0, nonComuni: 0, rari: 0, superRari: 0 };
        if (!this.inventario.oggettiMagiciPersonali) this.inventario.oggettiMagiciPersonali = [];
        if (this.zainoEquipaggiato === undefined) this.zainoEquipaggiato = null;
    }

    aggiornaStatoDiabete() {
        const haTipoI = this.hasPerk('Diabete di Tipo I');
        const haTipoII = this.hasPerk('Diabete di Tipo II');
        const haObeso = this.hasPerk('Obeso');
        this.diabeteTipoI = haTipoI || haTipoII || haObeso;
        this.diabeteTipoII = haTipoII;
    }

    // ---- Robot methods ----
    becomeRobot() {
    if (this._robotInitialized) return;
    this._robotInitialized = true;
    this.isRobot = true;
    this.fame = 0;
    this.sete = 0;
    this.sonno = 0;
    this.robotPF = this.robotPFMax;
    this.robotRepairTotalDone = 0;
    this.robotMicroRepairsUsed = 0;
}

        absorbMagicItem(rarity) {
        const map = {comune: 8, non_comune: 16, raro: 32, super_raro: 64};
        const add = map[rarity] || 0;
        this.batteryHours = Math.min(this.batteryHoursMax, (this.batteryHours || 0) + add);
        return add;
    }

    get capacitaMax() {
        const modForza = this.getStatDettagliata('Forza').mod;
        let cap = 5 + modForza;
        if (this.zainoEquipaggiato) {
            let bonusZaino = this.zainoEquipaggiato.bonus;
            if (this.hasPerk && this.hasPerk('Organizzato')) bonusZaino *= 1.15;
            if (this.hasPerk && this.hasPerk('Disorganizzato')) bonusZaino *= 0.85;
            cap += bonusZaino;
        }
        if (this.hasPerk && this.hasPerk('Facchino esperto')) {
            cap *= 2;
        }
        return Math.max(2, cap);
    }
// Ricalcola pesoAttuale includendo batterie e oggetti magici
    get pesoAttuale() {
        this.initInventarioBase();
        let peso = 0;
        peso += this.inventario.armi.length * 1;
        peso += this.inventario.cibo;
        peso += this.inventario.acqua;
        peso += this.inventario.ingranaggi / 10;
        peso += this.inventario.alchemici / 6;
        peso += (this.inventario.medBase * 1 + this.inventario.medAvanzati * 2 + this.inventario.medCritici * 3) / 10;
        peso += this.inventario.consumabili.length * 0.2;
        peso += this.inventario.batterie * 0.05;            // ✔ aggiunto
        const om = this.inventario.oggettiMagici;
        peso += (om.comuni + om.nonComuni + om.rari + om.superRari) * 0.7; // ✔
        peso += this.inventario.munizioni * 0.05;
        this.inventario.zaini.forEach(z => peso += z.pesoUnEquipped);
        return parseFloat((peso || 0).toFixed(2));
    }

    consumeBattery(hours) {
        if (!this.isRobot) return;
        this.batteryHours = Math.max(0, (this.batteryHours || 0) - (hours || 0));
    }

    onAllyStaminaLost(barsLost) {
        if (!this.isRobot) return;
        const hours = (barsLost || 0) * 2;
        this.consumeBattery(hours);
    }

        applyDamage(amount) {
        if (this.isRobot) {
            let danno = Math.floor(amount);
            if (this.hasPerk && this.hasPerk('Corazza a piastre') && this.corazzaAPiastre > 0) {
                const assorbito = Math.min(this.corazzaAPiastre, danno);
                this.corazzaAPiastre -= assorbito;
                danno -= assorbito;
            }
            if (this.robotPFTemp > 0 && danno > 0) {
                const assorbitoTemp = Math.min(this.robotPFTemp, danno);
                this.robotPFTemp -= assorbitoTemp;
                danno -= assorbitoTemp;
            }
            this.robotPF = Math.max(0, this.robotPF - danno);
            return this.robotPF <= 0 ? 'distrutto' : 'danneggiato';
        }
    }

        repairRobot(amount, repairer = null) {
        if (!this.isRobot) return false;
        const canRecoverLeft = Math.max(0, this.robotRepairTotalLimit - this.robotRepairTotalDone);
        if (canRecoverLeft <= 0) return false;
        const maxRecoverPerFull = Math.floor(this.robotPFMax * 0.85);
        const actual = Math.min(amount, canRecoverLeft, maxRecoverPerFull);
        this.robotPF = Math.min(this.robotPFMax, this.robotPF + actual);
        this.robotRepairTotalDone += actual;
        this.robotMicroRepairsUsed = 0;

        // La riparazione affatica la struttura: riduce i PF massimi
        const intMod = (repairer && repairer.getStatDettagliata) ? repairer.getStatDettagliata('Intelligenza').mod : 0;
        const d6 = Math.floor(Math.random() * 6) + 1;
        const riduzione = Math.max(1, d6 - intMod);
        this.robotPFMax = Math.max(1, this.robotPFMax - riduzione);
        this.robotPF = Math.min(this.robotPF, this.robotPFMax);

        if (this.hasPerk && this.hasPerk('Corazza a piastre')) {
            this.corazzaAPiastre = this.corazzaAPiastreMax;
        }

        // PF temporanei dopo la riparazione
        const conMod = this.getStatDettagliata('Costituzione').mod;
        this.robotPFTemp = Math.max(this.robotPFTemp || 0, Math.max(3, conMod * 3));

        return true;
    }

        microRepair(amount) {
        if (!this.isRobot) return false;
        const limit = Math.floor(this.robotPFMax / 3);
        if (amount >= limit) return false; // deve recuperare MENO di 1/3 dei PF massimi
        if (this.robotMicroRepairsUsed >= 2) return false;
        const canRecoverLeft = Math.max(0, this.robotRepairTotalLimit - this.robotRepairTotalDone);
        if (canRecoverLeft <= 0) return false;
        const actual = Math.min(amount, canRecoverLeft);
        this.robotPF = Math.min(this.robotPFMax, this.robotPF + actual);
        this.robotRepairTotalDone += actual;
        this.robotMicroRepairsUsed += 1;

        const conMod = this.getStatDettagliata('Costituzione').mod;
        this.robotPFTemp = Math.max(this.robotPFTemp || 0, Math.max(3, conMod * 3));

        return true;
    }

    initStazioneMobile() {
        if (!this.stazioneMobile) {
            this.stazioneMobile = { cibo: 0, ciboAvariato: 0, ciboDelizioso: 0, acqua: 0, ingranaggi: 0, alchemici: 0, medBase: 0, medAvanzati: 0, medCritici: 0 };
        }
    }

    get stazioneMobileTotale() {
        if (!this.stazioneMobile) return 0;
        return Object.values(this.stazioneMobile).reduce((s, v) => s + (v || 0), 0);
    }

    get stazioneMobileCapacita() {
        return 12;
    }
    
    get robotRepairTotalLimit() {
    if (this._robotRepairTotalLimit !== undefined) {
        return this._robotRepairTotalLimit;
    }
    if (!this.isRobot) return 0;
    const conMod = this.getStatDettagliata ? this.getStatDettagliata('Costituzione').mod : 0;
    let limit = 50 + conMod * 10;
    if (this.hasPerk && this.hasPerk('Vecchio modello')) limit -= 10;
    const corazzatoCount = (this.perks || []).filter(p => (typeof p === 'string' ? p : p.nome) === 'Corazzato').length;
    limit += corazzatoCount * 10;
    return Math.max(10, limit);
}
    
    getPessimistaCDBonus() {
        if (!this.hasPerk || !this.hasPerk('Pessimista')) return 0;
        const oreTotali = window.oreTotali || 0;
        if (this.pessimistaStack > 0 && (oreTotali - (this.pessimistaUltimoTiro || 0)) >= 1) {
            this.pessimistaStack = 0;
        }
        return this.pessimistaStack || 0;
    }

    registraPessimista(successo) {
        if (!this.hasPerk || !this.hasPerk('Pessimista')) return;
        this.pessimistaUltimoTiro = window.oreTotali || 0;
        if (successo) this.pessimistaStack = 0;
        else this.pessimistaStack = Math.min(5, (this.pessimistaStack || 0) + 1);
    }

    registraConsumoConsumabile(nomeItem) {
        const ora = window.oreTotali || 0;
        this.consumiConsumabiliLog = (this.consumiConsumabiliLog || []).filter(t => (ora - t) < 4);
        this.consumiConsumabiliLog.push(ora);
        if (this.consumiConsumabiliLog.length >= 3) {
            this.timers.overdose = 4; // ore di durata del debuff
            this.faticaBase = Math.min(6, this.faticaBase + 1);
            this.consumiConsumabiliLog = []; // reset finestra dopo il trigger
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`⚠️ ${this.nome} è in OVERDOSE: 3+ consumabili in 4 ore! +1 Fatica, -2 a tutte le caratteristiche per 4 ore.`, 'pericolo');
            }
        }
    }

    checkOssessionePulizia(giornoAttuale) {
        if (!this.hasPerk || !this.hasPerk('Ossessione del Pulito')) return;
        if (this._ultimoGiornoPulizia === giornoAttuale) return;
        if (this.inSpedizione) return;
        if (this.azioneCorrente && this.azioneCorrente.tipo === 'dormi') return;
        if (this.azioneCorrente && this.azioneCorrente.tipo === 'ossessione_pulito') return;

        this._ultimoGiornoPulizia = giornoAttuale;
        const mag = window.magazzino;

        if (this.pulizieBloccate) {
            this.pulizieBloccate = false;
            this.follia = Math.min(20, this.follia + 2);
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome} è stato bloccato dal pulire: Follia +2.`, 'pericolo');
            }
            return;
        }

        const bastano = mag && (mag.materialiMedici?.base || 0) >= 2 && (mag.materialiAlchemici || 0) >= 4;
        if (!bastano) {
            this.follia = Math.min(20, this.follia + 2);
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome} non ha materiali per pulire la base: Follia +2.`, 'pericolo');
            }
            return;
        }

        mag.materialiMedici.base -= 2;
        mag.materialiAlchemici -= 4;
        if (typeof window.updateMagazzinoFields === 'function') {
            window.updateMagazzinoFields({ materialiMedici: mag.materialiMedici, materialiAlchemici: mag.materialiAlchemici });
        }

        const azione = {
            tipo: 'ossessione_pulito',
            oreTotali: 2,
            oreRimanenti: 2,
            onComplete: () => {
                const magNow = window.magazzino;
                magNow.baseIgienizzataGiorno = Math.floor((window.oreTotali || 0) / 24);
                if (typeof window.updateMagazzinoFields === 'function') {
                    window.updateMagazzinoFields({ baseIgienizzataGiorno: magNow.baseIgienizzataGiorno });
                }
                if (typeof window.mostraNotificaInAlto === 'function') {
                    window.mostraNotificaInAlto(`${this.nome} ha igienizzato la base. CD medicazioni -1 per oggi.`, 'successo');
                }
            }
        };
        if (typeof window.inserisciAzioneConPriorita === 'function') {
            window.inserisciAzioneConPriorita(this, azione, true);
        } else if (!this.azioneCorrente) {
            this.azioneCorrente = azione;
        } else {
            this.codaAzioni.unshift(azione);
        }
    }

    hasSpellLevel(level) {
        return this.spellsKnown && (this.spellsKnown[level] || 0) > 0;
    }

    getSpellCost(level) {
        const costs = {0: 1, 1: 2, 2: 5, 3: 10, 4: 16};
        return costs[level] || 0;
    }

    getArcaneFatigueThreshold() {
        return Math.floor(this.manaMax * 0.5);
    }

    resetManaSpentCounter() {
        this._manaSpentLastMinute = 0;
        this._lastManaSpentReset = Date.now();
    }

    checkArcaneFatigue(manaSpent) {
        const now = Date.now();
        const elapsed = now - (this._lastManaSpentReset || 0);
        if (elapsed > 60000) { // 1 minuto
            this._manaSpentLastMinute = 0;
            this._lastManaSpentReset = now;
        }
        this._manaSpentLastMinute = (this._manaSpentLastMinute || 0) + manaSpent;

        const threshold = this.getArcaneFatigueThreshold();
        if (this._manaSpentLastMinute > threshold && !this._arcaneFatigueApplied) {
            this._arcaneFatigueApplied = true;
            this._arcaneFatigueUntil = null; // fino al prossimo riposo lungo
            // Applica -2 a tutte le prove e danni
            // Questo sarà gestito in getStatDettagliata e getDamageModifier
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome} è affaticato arcano! -2 a tutte le prove e danni fino al prossimo riposo lungo.`, 'pericolo');
            }
            return true;
        }
        return false;
    }

    resetArcaneFatigue() {
        this._arcaneFatigueApplied = false;
        this._arcaneFatigueUntil = null;
        this._manaSpentLastMinute = 0;
        this._lastManaSpentReset = null;
    }

    consumaBiocarburante(magazzinoRif) {
    if (!this.hasPerk || !this.hasPerk('Biocarburante')) return false;
    const mag = magazzinoRif || window.magazzino;
    if (mag.cibo >= 0.25) mag.cibo -= 0.25;
    else if ((mag.piattiDeliziosi || 0) > 0) mag.piattiDeliziosi -= 1;
    else if (mag.ciboAvariato >= 0.25) mag.ciboAvariato -= 0.25;
    else return false;
    this.biocarburanteTimer = 0;
    this.biocarburanteDeficit = false;
    return true;
}

    canCastSpell(level) {
        if (!this.hasSpellLevel(level)) return {allowed: false, reason: 'Incantesimo non conosciuto.'};
        const cost = this.getSpellCost(level);
        if (cost === undefined) return {allowed: false, reason: 'Livello incantesimo non valido.'};

        // Controlla esaurimento magico (se ha raggiunto il limite negativo e non ha recuperato mana)
        if (this._magicExhausted) {
            return {allowed: false, reason: 'Esaurimento magico! Recupera almeno 1 mana con un riposo lungo.'};
        }

        // Calcola il minimo consentito (soglia negativa = -livelloMagia)
        const minAllowed = -this.livelloMagia;
        if (this.manaAttuale - cost < minAllowed) {
            return {allowed: false, reason: `Mana insufficiente (anche sotto zero). Limite: ${minAllowed}`};
        }

        return {allowed: true, cost};
    }

    castSpell(level, target = null) {
        const check = this.canCastSpell(level);
        if (!check.allowed) {
            return {success: false, message: check.reason};
        }

        const cost = check.cost;
        let manaSpent = cost;
        let overloadDamage = 0;
        let message = '';

        // 1. Controlla se spendere mana sotto zero
        const minAllowed = -this.livelloMagia;
        let manaAfter = this.manaAttuale - cost;

        // 2. Se manaAfter < 0, calcola danno da sovraccarico per la parte negativa
        let negativeManaSpent = 0;
        if (manaAfter < 0) {
            negativeManaSpent = Math.min(-manaAfter, this.livelloMagia); // max negativo = -livelloMagia
            const actualNegative = Math.min(negativeManaSpent, this.livelloMagia);
            if (actualNegative > 0) {
                // Danno 2d6 per punto mana sotto zero
                for (let i = 0; i < actualNegative; i++) {
                    overloadDamage += this.rollDice(2, 6);
                }
                // Applica danno (prima ai PF fortuna, poi reali)
                this.applyOverloadDamage(overloadDamage);
                // Riduci il mana negativo effettivo
                manaAfter = this.manaAttuale - cost; // già calcolato, ma se supera il limite, tronchiamo
                if (manaAfter < -this.livelloMagia) {
                    manaAfter = -this.livelloMagia;
                }
            }
        }

        // 3. Applica il consumo mana (anche negativo)
        this.manaAttuale = manaAfter;

        // 4. Controlla se ha raggiunto il limite negativo (esaurimento magico)
        if (this.manaAttuale <= -this.livelloMagia) {
            this._magicExhausted = true;
            // Aggiunge 2 livelli di fatica
            this.faticaBase = Math.min(6, this.faticaBase + 2);
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome} è esausto magicamente! +2 fatica, incantesimi bloccati.`, 'pericolo');
            }
        }

        // 5. Controlla affaticamento arcano (speso >50% mana max in 1 minuto)
        this.checkArcaneFatigue(cost);

        // 6. Se l'incantesimo ha un target e fa danno, applica effetti (da implementare)
        if (target && typeof target.applyDamage === 'function') {
            // Esempio: danno magico = (cost * 2) + modifier
            const damage = cost * 2 + this.getCastingModifier();
            target.applyDamage(damage);
            message += `Inflitto ${damage} danni a ${target.nome}. `;
        }

        // 7. Messaggio finale
        message += `Consumati ${cost} mana.${overloadDamage > 0 ? ` Subiti ${overloadDamage} danni da sovraccarico.` : ''}`;
        if (this._arcaneFatigueApplied) {
            message += ' (Affaticato arcano)';
        }
        if (this._magicExhausted) {
            message += ' (Esaurito magicamente)';
        }

        // Aggiorna interfaccia
        if (typeof window.aggiornaInterfaccia === 'function') {
            window.aggiornaInterfaccia();
        }

        return {success: true, manaSpent: cost, overloadDamage, message};
    }

    /**
     * Applica il danno da sovraccarico (PF fortuna prima, poi reali)
     */
    applyOverloadDamage(damage) {
        if (damage <= 0) return;
        let remaining = damage;
        // Usa PF fortuna
        if (this.puntiFortuna > 0) {
            const absorbed = Math.min(this.puntiFortuna, remaining);
            this.puntiFortuna -= absorbed;
            remaining -= absorbed;
        }
        // Danno residuo su PF reali (1 danno = 1 PF reale? In realtà 1 punto mana sotto zero = 2d6 danni, già calcolati)
        if (remaining > 0) {
            // Ogni 3 danni = 1 stadio di ferita? Per semplicità convertiamo in PF reali: 1 danno = 1 PF
            // Ma il testo dice: "Se si finiscono i punti ferita fortuna si subisce uno stadio di ferita per ogni 3 punti mana spesi."
            // Quindi i danni da sovraccarico sono già in punti ferita, non in stadi. Quindi applichiamo direttamente.
            this.puntiFeritaReali = Math.max(0, this.puntiFeritaReali - remaining);
            if (this.puntiFeritaReali <= 0) {
                if (typeof window.mostraNotificaInAlto === 'function') {
                    window.mostraNotificaInAlto(`${this.nome} è morto a causa del sovraccarico magico!`, 'pericolo');
                }
            }
        }
    }

    _ensurePesoCorporeoInit() {
        if (!this.pesoCorporeo) this.pesoCorporeo = { usiCuscinetto: null, benNutritoOreAccumulate: 0 };
        if (this.pesoCorporeo.usiCuscinetto == null) {
            if (this.hasPerk && this.hasPerk('Obeso')) this.pesoCorporeo.usiCuscinetto = 40;
            else if (this.hasPerk && this.hasPerk('Sovrappeso')) this.pesoCorporeo.usiCuscinetto = 20;
        }
    }

    consumaStamina(quantita) {
        if (!quantita || quantita <= 0) return;
        this._ensurePesoCorporeoInit();
        this.staminaAttuale = Math.max(0, (this.staminaAttuale || 0) - quantita);

        if (this.diabeteTipoI || this.diabeteTipoII) {
            const oraAttuale = window.oreTotali || 0;
            this.diabeteStaminaSpesaLog = this.diabeteStaminaSpesaLog || [];
            this.diabeteStaminaSpesaLog.push({ ora: oraAttuale, qty: quantita });
        }

        this._consumaCuscinettoPeso(Math.floor(quantita));
    }

    _consumaCuscinettoPeso(tacche) {
        if (!this.pesoCorporeo || this.pesoCorporeo.usiCuscinetto == null) return;
        if (this.pesoCorporeo.usiCuscinetto <= 0) return;
        const haObeso = this.hasPerk && this.hasPerk('Obeso');
        const haSovrappeso = this.hasPerk && this.hasPerk('Sovrappeso');
        if (!haObeso && !haSovrappeso) return;

        for (let i = 0; i < tacche; i++) {
            const consumo = (Math.floor(Math.random() * 4) + 1) + this.stadioFame;
            this.pesoCorporeo.usiCuscinetto -= consumo;
            if (this.pesoCorporeo.usiCuscinetto <= 0) {
                this.pesoCorporeo.usiCuscinetto = 0;
                this._esauriscePerkPeso(haObeso ? 'Obeso' : 'Sovrappeso');
                break;
            }
        }
    }

    usaRecuperoAsmatico() {
        if (!this.hasPerk('Asmatico')) {
            alert(`${this.nome} non ha il perk Asmatico.`);
            return false;
        }
        if (this._asmaShortRestBoost) {
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome} ha già sbloccato il recupero rapido in questo riposo.`, 'avviso');
            }
            return false;
        }
        const base = window.magazzino?.materialiMedici?.base || 0;
        if (base < 10) {
            alert('Non ci sono abbastanza risorse mediche di base nel magazzino (servono 10).');
            return false;
        }
        window.magazzino.materialiMedici.base -= 10;
        this._asmaShortRestBoost = true;
        this._asmaCapNotified = false;
        if (typeof window.updateMagazzinoFields === 'function') {
            window.updateMagazzinoFields({ materialiMedici: window.magazzino.materialiMedici });
        }
        if (typeof window.mostraNotificaInAlto === 'function') {
            window.mostraNotificaInAlto(`${this.nome} usa 10 risorse mediche di base: limite di Recupero Lento superato per questo riposo.`, 'successo');
        }
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
        return true;
    }

    _esauriscePerkPeso(nomePerk) {
        const idx = this.perks.findIndex(p => (typeof p === 'string' ? p : p.nome) === nomePerk);
        if (idx !== -1) this.perks.splice(idx, 1);

        if (nomePerk === 'Obeso') {
            const datiSovrappeso = window.findPerkData ? window.findPerkData('Sovrappeso') : null;
            this.perks.push(datiSovrappeso ? { ...datiSovrappeso } : { nome: 'Sovrappeso', desc: '', costo: -4 });
            this.pesoCorporeo.usiCuscinetto = 20;
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome}: il cuscinetto di Obeso si è esaurito. Ora è Sovrappeso.`, 'avviso');
            }
        } else {
            this.pesoCorporeo.usiCuscinetto = null;
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome}: il cuscinetto di Sovrappeso si è esaurito. Il perk è stato rimosso.`, 'avviso');
            }
        }
    }

    _rimuoviPerkSemplice(nomePerk) {
        const idx = this.perks.findIndex(p => (typeof p === 'string' ? p : p.nome) === nomePerk);
        if (idx !== -1) this.perks.splice(idx, 1);
    }

    /**
     * Recupera mana dopo un riposo breve (4 ore)
     */
    recoverManaShortRest() {
        if (this.livelloMagia === 0) return 0;
        const base = this.livelloMagia;
        const bonus = Math.floor(this.livelloMagia / 3);
        const recovery = base + bonus;
        const oldMana = this.manaAttuale;
        this.manaAttuale = Math.min(this.manaMax, this.manaAttuale + recovery);
        return this.manaAttuale - oldMana;
    }

    /**
     * Recupera mana dopo un riposo lungo (8 ore)
     */
    recoverManaLongRest() {
        if (this.livelloMagia === 0) return 0;
        const recovery = this.livelloMagia * 3;
        const oldMana = this.manaAttuale;
        this.manaAttuale = Math.min(this.manaMax, this.manaAttuale + recovery);
        // Resetta anche affaticamento arcano ed esaurimento magico
        this.resetArcaneFatigue();
        this._magicExhausted = false;
        return this.manaAttuale - oldMana;
    }

    // --- Condizioni ---
    get stadioFame() {
        const base = this.fame >= 12 ? 0 : this.fame >= 9 ? 1 : this.fame >= 7 ? 2 : this.fame >= 4 ? 3 : this.fame >= 1 ? 4 : 5;
        return this.timers.fameSoddisfatta > 0 ? Math.max(0, base - 1) : base;
    }

    get stadioSete() {
        const base = this.sete >= 4 ? 0 : this.sete >= 3 ? 1 : this.sete >= 2 ? 2 : this.sete >= 1 ? 3 : 4;
        return this.timers.seteSoddisfatta > 0 ? Math.max(0, base - 1) : base;
    }

    get stadioSonno() {
        const base = this.sonno >= 7 ? 0 : this.sonno >= 5 ? 1 : this.sonno >= 3 ? 2 : this.sonno >= 1 ? 3 : 4;
        return this.timers.sonnoSoddisfatto > 0 ? Math.max(0, base - 1) : base;
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
        let maxFatica = 6;
        if (window.hasPerk(this, 'Carroarmato')) {
            maxFatica = 7;
            if (f > 0 && f < 1) f = 0.5;
        }
        return Math.min(maxFatica, Math.max(0, f));
    }

    get woundState() {
        if (this.isRobot) {
            const pf = this.robotPF;
            const max = this.robotPFMax;
            if (pf >= max * 0.8) return "Illeso";
            if (pf >= max * 0.6) return "Danno lieve";
            if (pf >= max * 0.4) return "Danno profondo";
            if (pf >= max * 0.2) return "Funzionalità a rischio (Robot)";
            if (pf >= 1) return "Rischio di distruzione";
            return "Distrutto";
        } else {
            switch (this.puntiFeritaReali) {
                case 5:
                    return "Illeso";
                case 4:
                    return "Ferita lieve";
                case 3:
                    return "Ferita profonda";
                case 2:
                    return "Funzionalità a rischio";
                case 1:
                    return "Rischio di morte";
                default:
                    return "Morto";
            }
        }
    }

    get woundEffectText() {
        switch (this.woundState) {
            case "Ferita lieve":
                return "30% peggiora dopo 5h se non curata";
            case "Ferita profonda":
                return "Dopo 3h diventa Funzionalità a rischio";
            case "Funzionalità a rischio":
                return "Dopo 1h diventa Rischio di morte, +2 fatica";
            case "Rischio di morte":
                return "Dopo 10 min: morte. Il personaggio è privo di sensi";
            case "Morto":
                return "Personaggio deceduto";
            default:
                return "Nessun danno reale";
        }
    }

    get constitutionModifier() {
        return this.getStatDettagliata("Costituzione").mod;
    }

    get woundTimeBase() {
        switch (this.woundState) {
            case "Ferita lieve":
                return 6;
            case "Ferita profonda":
                return 3;
            case "Funzionalità a rischio":
                return 1;
            case "Rischio di morte":
                return 0.1667;
            default:
                return 0;
        }
    }

    get maxOreRiposo() {
        let max = 24;
        if (this.stadioSete >= 2) max = Math.min(max, 4);
        if (this.stadioFame >= 3) max = Math.min(max, 8);
        return max;
    }

    get puntiFortunaMaxEffettivo() {
        // Malattia: -10 PF fortuna max per grado 7-8
        const malFortunaMax = this.applicaEffettiMalattia('fortunaMax');
        if (malFortunaMax !== 0) {
            return Math.max(1, this.puntiFortunaMax + malFortunaMax);
        }

        return this.faticaTotale >= 4 ? Math.max(1, Math.ceil(this.puntiFortunaMax / 2)) : this.puntiFortunaMax;
    }

    get woundTimeToWorsen() {
        const base = this.woundTimeBase;
        const factor = 1 + (this.constitutionModifier * 0.15);
        return Math.max(0.5, base * factor);
    }

    // client/src/logic/logic.js — subisciFollia
    subisciFollia(causa) {
        let dCount = 1;
        let dFaces = 4;
        let descCausa = "";

        switch (causa) {
            case 'cibo_avariato':
                if (this.hasPerk('Schizzinoso')) {
                    dCount = 2;
                }
                dFaces = 4;
                descCausa = "3 porzioni di cibo avariato";
                break;
            case 'perk_fobia':
                dFaces = 6;
                descCausa = "Perk di Fobia";
                break;
            case 'compagno_morto':
                dFaces = 10;
                descCausa = "Compagno morto / alto rischio";
                break;
            case 'rischio_morte':
                dFaces = 12;
                descCausa = "Rischio di Morte / rianimazione / perdita funzione";
                break;
            default:
                dFaces = 4;
                descCausa = "Causa ignota";
        }

        const tiro = typeof rollDice === 'function' ? rollDice(dCount, dFaces) : Math.floor(Math.random() * dFaces) + 1;
        const modCar = this.getStatDettagliata('Carisma').mod;
        let puntiPresi;
        if (modCar >= 0) {
            // Il Carisma positivo non può ridurre la follia ricevuta di più del 50%
            const riduzioneMax = tiro * 0.5;
            const riduzioneEffettiva = Math.min(riduzioneMax, modCar);
            puntiPresi = Math.max(1, tiro - riduzioneEffettiva);
        } else {
            // Il Carisma negativo continua a peggiorare normalmente (floor -2 come prima)
            const effectiveModCar = Math.max(-2, modCar);
            puntiPresi = Math.max(1, tiro - effectiveModCar);
        }

        // Rilassato: -15% alla follia ricevuta (arrotondato per difetto, minimo 1)
        if (this.hasPerk('Rilassato')) {
            puntiPresi = Math.max(1, Math.floor(puntiPresi * 0.85));
        }

        this.follia += puntiPresi;
        this.aggiornaSintomiFollia();

        return {
            punti: puntiPresi,
            tiro: tiro,
            modificatore: effectiveModCar,
            modificatoreReale: modCar,
            causa: descCausa,
            totale: this.follia,
            sintomi: this.folliaSintomi
        };
    }


    aggiornaSintomiFollia() {
        if (this.follia >= 20) {
            this.folliaSintomi = "20+ Impazzito, irrecuperabile. Cambia personaggio.";
        } else if (this.follia >= 18) {
            this.folliaSintomi = "18-19 Illusioni visive e uditive personali";
        } else if (this.follia >= 15) {
            this.folliaSintomi = "15-17 Peggiori tratti aumentano notevolmente";
        } else if (this.follia >= 9) {
            this.folliaSintomi = "9-15 Ossessioni, tick e comportamenti impulsivi";
        } else {
            this.folliaSintomi = "1-8 nessun sintomo";
        }
    }

    get staminaMax() {
        if (this.isRobot) return 99;
        let s = this.staminaBase;
        if (this.perks && this.perks.length > 0) {
            if (this.perks.some(p => p.nome === "Atleta")) s += 1;
            if (this.perks.some(p => p.nome === "Obeso")) s -= 2;
            if (this.perks.some(p => p.nome === "Sovrappeso")) s -= 1;
            if (this.perks.some(p => p.nome && p.nome.startsWith("Anziana"))) s -= 1;
        }
        const malStamina = this.applicaEffettiMalattia('stamina');
        if (malStamina !== 0) s += malStamina;

        s += this.getStatDettagliata('Forza').mod;
        if (this.isMalato() && this.malattia.grado >= 7 && this.malattia.grado <= 8) s -= 1;
        if (this.stadioFame >= 2) s -= 1;
        if (this.stadioSete >= 3) s -= 2;
        if (this.faticaTotale >= 2) s -= 1;
        if (this.puntiFeritaReali <= 3 && this.puntiFeritaReali > 0) s -= 1;
        if (this.faticaTotale >= 5) s = 1;
        return Math.max(0, s);
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

    hasSaveCompetenza(stat) {
        const key = stat.toLowerCase();
        const fromPerks = (this.perks || []).some(p => {
            const data = typeof p === 'string' ? (window.findPerkData ? window.findPerkData(p) : null) : p;
            return data && Array.isArray(data.ts) && data.ts.map(s => s.toLowerCase()).includes(key);
        });
        if (fromPerks) return true;
        const savingMap = window.SKILL_SYSTEM?.savingThrows || {};
        const viaMastery = Object.entries(savingMap).find(([, savedStat]) => savedStat.toLowerCase() === key);
        return !!(viaMastery && this.masteries && this.masteries.map(m => m.toLowerCase()).includes(viaMastery[0].toLowerCase()));
    }
    getSaveModifier(stat) {
        const base = this.getStatDettagliata(stat).mod;
        return this.hasSaveCompetenza(stat) ? base + this.getBonusCompetenza() : base;
    }

    getStatDettagliata(statNome) {
        const nomeLower = statNome.toLowerCase();
        let valoreBase = this[nomeLower];
        let motivi = [];

        if (this.perks && this.perks.length > 0) {
            const haPerk = (nome) => this.perks.some(p => p.nome === nome);
            const haAnzianaVariante = (variante) => this.perks.some(p => p.nome === variante);
            const eAnziana = this.perks.some(p => p.nome && p.nome.startsWith("Anziana"));

            if (statNome === "Forza") {
                if (haPerk("Palestrato")) {
                    valoreBase += 1;
                    motivi.push("Palestrato (+1)");
                }
                if (haPerk("Grande taglia")) {
                    valoreBase += 2;
                    motivi.push("Grande taglia (+2)");
                }
                if (haPerk("Piccola taglia")) {
                    valoreBase -= 1;
                    motivi.push("Piccola taglia (-1)");
                }
                if (haPerk("Anoressico")) {
                    valoreBase -= 2;
                    motivi.push("Anoressico (-2)");
                }
                if (haPerk("Sottopeso")) {
                    valoreBase -= 1;
                    motivi.push("Sottopeso (-1)");
                }
                if (eAnziana) {
                    valoreBase -= 1;
                    motivi.push("Anziana (-1)");
                }
            }
            if (statNome === "Costituzione") {
                if (haPerk("Palestrato")) {
                    valoreBase += 1;
                    motivi.push("Palestrato (+1)");
                }
                if (haPerk("Grande taglia")) {
                    valoreBase += 1;
                    motivi.push("Grande taglia (+1)");
                }
                if (haPerk("Anoressico")) {
                    valoreBase -= 1;
                    motivi.push("Anoressico (-1)");
                }
                if (haPerk("Obeso")) {
                    valoreBase += 2;
                    motivi.push("Obeso (+2)");
                }
                if (eAnziana) {
                    valoreBase -= 1;
                    motivi.push("Anziana (-1)");
                }
            }
            if (statNome === "Carisma") {
                if (haPerk("Bel viso")) {
                    valoreBase += 1;
                    motivi.push("Bel viso (+1)");
                }
                if (haAnzianaVariante("Anziana_Bilanciata")) {
                    valoreBase += 1;
                    motivi.push("Anziana Saggia (+1)");
                }
                if (haAnzianaVariante("Anziana_Carisma")) {
                    valoreBase += 2;
                    motivi.push("Anziana Carismatica (+2)");
                }
            }
            if (statNome === "Saggezza") {
                if (haAnzianaVariante("Anziana_Bilanciata")) {
                    valoreBase += 1;
                    motivi.push("Anziana Saggia (+1)");
                }
                if (haAnzianaVariante("Anziana_Saggezza")) {
                    valoreBase += 2;
                    motivi.push("Anziana Venerabile (+2)");
                }
            }if (statNome === "Destrezza") {
                if (haPerk("Piccola taglia")) {
                    valoreBase += 2;
                    motivi.push("Piccola taglia (+2)");
                }
            }
            if (statNome === "Carisma") {
                if (haPerk("Bel viso")) {
                    valoreBase += 1;
                    motivi.push("Bel viso (+1)");
                }
                if (haAnzianaVariante("Anziana_Bilanciata")) {
                    valoreBase += 1;
                    motivi.push("Anziana Saggia (+1)");
                }
                if (haAnzianaVariante("Anziana_Carisma")) {
                    valoreBase += 2;
                    motivi.push("Anziana Carismatica (+2)");
                }
            }
            if (statNome === "Saggezza") {
                if (haAnzianaVariante("Anziana_Bilanciata")) {
                    valoreBase += 1;
                    motivi.push("Anziana Saggia (+1)");
                }
                if (haAnzianaVariante("Anziana_Saggezza")) {
                    valoreBase += 2;
                    motivi.push("Anziana Venerabile (+2)");
                }
            }
        }
        let eccedenza = 0;
        if (valoreBase > 20) {
            eccedenza = valoreBase - 20;
            valoreBase = 20;
            motivi.push(`Cap Massimo Raggiunto (Eccedenza: +${eccedenza})`);
        }

        let modBase = Math.floor((valoreBase - 10) / 2);
        let modFinale = modBase;
        const malTuttiMod = this.applicaEffettiMalattia('tuttiMod');
        if (malTuttiMod !== 0) {
            modFinale += malTuttiMod;
            motivi.push(`Malattia (${malTuttiMod >= 0 ? '+' : ''}${malTuttiMod})`);
        }
         if (this.isRobot && this.biocarburanteDeficit) {
            modFinale -= 1;
            motivi.push("Carenza di Biocarburante (-1)");
        }
        if (this.timers && this.timers.overdose > 0) {
            modFinale -= 2;
            motivi.push("Overdose (-2)");
        }

        if (this.timers) {
            if (this.timers.buffFame > 0 && (statNome === "Forza" || statNome === "Costituzione")) modFinale += 1;
            if (this.timers.buffSete > 0 && (statNome === "Destrezza" || statNome === "Intelligenza")) modFinale += 1;
            if (this.timers.buffSonno > 0 && (statNome === "Saggezza" || statNome === "Carisma")) modFinale += 1;
            if (this.diabeteIperglicemiaAttiva && (statNome === "Saggezza" || statNome === "Carisma")) {
                modFinale -= 2;
                motivi.push("Iperglicemia (-2)");
            }
        }

        const fameEffettiva = this.getCondizioneEffettiva('fame');
        const seteEffettiva = this.getCondizioneEffettiva('sete');
        const sonnoEffettivo = this.getCondizioneEffettiva('sonno');

        if (statNome === "Forza" && fameEffettiva >= 1) modFinale -= 2;
        if (statNome === "Costituzione" && fameEffettiva >= 4) modFinale -= 2;
        if ((statNome === "Intelligenza" || statNome === "Destrezza") && seteEffettiva >= 1) modFinale -= 2;
        if ((statNome === "Carisma" || statNome === "Saggezza") && sonnoEffettivo >= 1) modFinale -= 2;

        if (this.statiAlterati) {
            this.statiAlterati.forEach(s => {
                const mods = Array.isArray(s.modificatori) && s.modificatori.length ? s.modificatori : (s.nome ? [{ stat: s.nome, valore: s.valore }] : []);
                mods.forEach(m => {
                    if (m.stat && m.stat.toLowerCase() === nomeLower) {
                        modFinale += (m.valore || 0);
                        motivi.push(`${s.nome} (${m.valore >= 0 ? '+' : ''}${m.valore})`);
                    }
                });
            });
        }

        return {
            nome: statNome.toUpperCase(),
            valore: valoreBase,
            eccedenza: eccedenza,
            mod: modFinale,
            modBase: modBase,
            info: motivi
        };
    }

    getCondizioneEffettiva(nomeCondizione) {
        const nomeLower = nomeCondizione.toLowerCase();
        let base = 0;
        switch (nomeLower) {
            case 'fame':
                base = this.stadioFame || 0;
                break;
            case 'sete':
                base = this.stadioSete || 0;
                break;
            case 'sonno':
                base = this.stadioSonno || 0;
                break;
            case 'fatica':
                base = this.faticaBase || 0;
                break;
            default:
                return 0;
        }
        let modMaster = 0;
        if (this.statiAlterati) {
            this.statiAlterati.forEach(s => {
                if (s.nome && s.nome.toLowerCase() === nomeLower) {
                    modMaster -= (s.valore || 0);
                }
            });
        }
        return Math.max(0, base + modMaster);
    }

    getCastingAttribute() {
        const candidates = ['Intelligenza', 'Saggezza', 'Carisma'];
        let best = candidates[0];
        let bestMod = -Infinity;
        for (const attr of candidates) {
            const det = this.getStatDettagliata(attr);
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
        const costi = {0: 1, 1: 2, 2: 4, 3: 7, 4: 11};
        return costi[Math.min(Math.max(0, livelloIncantesimo), 4)] || 0;
    }

    getMaxKnownSpells(livelloIncantesimo) {
        if (this.livelloMagia < livelloIncantesimo) return 0;
        const maxSpells = {0: 2, 1: 3, 2: 2, 3: 2, 4: 1};
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

    get isEsploraSolo() {
        return !!(this.azioneCorrente && this.azioneCorrente.tipo === 'esplora' && (this.azioneCorrente.numCompagni || 0) === 0);
    }

    getIrascibileCDBonus() {
        if (!this.hasPerk || !this.hasPerk('Irascibile')) return 0;
        return (this._irascibileStack || 0) * 1;
    }

    registraIrascibile(successo, scartoGrave = false) {
        if (!this.hasPerk || !this.hasPerk('Irascibile')) return;
        if (successo) {
            this._irascibileStack = 0;
            return;
        }
        this._irascibileStack = (this._irascibileStack || 0) + (scartoGrave ? 2 : 1);
        if (this._irascibileStack >= 4) {
            this._irascibileStack = 0;
            const azioneInterrotta = this.azioneCorrente;
            this.azioneCorrente = { tipo: 'sfogo_irascibile', oreTotali: 1, oreRimanenti: 1, onComplete: () => {} };
            if (azioneInterrotta && typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome} si arrabbia e interrompe "${azioneInterrotta.tipo}" per un'ora!`, 'pericolo');
            }
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
        const oreTotali = typeof window.oreTotali !== 'undefined' ? window.oreTotali : 0;
        const giorniAttivi = Math.floor(oreTotali / 24) - this.giornoInizio;
        if (giorniAttivi < 10) return 2;
        if (giorniAttivi < 20) return 3;
        if (giorniAttivi < 40) return 4;
        return 5;
    }

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
                const pData = (typeof perk === 'string') ? (window.findPerkData ? window.findPerkData(perk) : null) : perk;
                if (!pData) return;

                if (pData.skills && Array.isArray(pData.skills)) {
                    if (pData.skills.map(s => s.toLowerCase().trim()).includes(skillKey)) {
                        punteggioAbilita += 1;
                    }
                }
                const malus = pData.disadvantage || pData.disadvantages;
                if (malus && Array.isArray(malus)) {
                    if (malus.map(s => s.toLowerCase().trim()).includes(skillKey)) {
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

        const map = {
            'atletica': 'Forza',
            'acrobazia': 'Destrezza',
            'acrobazie': 'Destrezza',
            'sopravvivenza': 'Saggezza',
            'inganno': 'Carisma',
            'indagare': 'Intelligenza',
            'investigare': 'Intelligenza',
            'giochi di carte': 'Carisma',
            'giochi di Carte': 'Carisma',
            'rapidità di mano': 'Destrezza',
            'percezione': 'Saggezza',
            'persuasione': 'Carisma',
            'furtività': 'Destrezza',
            'manodopera': 'Destrezza',
            'cucina': 'Intelligenza',
            'medicina': 'Intelligenza',
            'storia': 'Intelligenza',
            'natura': 'Intelligenza',
            'religione': 'Intelligenza',
            'arcano': 'Intelligenza',
            'intuizione': 'Saggezza',
            'intimidire': 'Carisma',
            'intrattenere': 'Carisma',
            'addestrare animali': 'Saggezza',
            'addestrare gli animali': 'Saggezza',
            'strumenti da scasso': 'Destrezza',
            'strumenti da Scasso': 'Destrezza'
        };
        const attr = map[skillKey] || map[skill.charAt(0).toUpperCase() + skill.slice(1)] || 'Intelligenza';

        const attrMod = this.getStatDettagliata(attr).mod;
        const prof = this.getBonusCompetenza();

        let modifier = attrMod;

        let sbloccaNuovaAbilita = false;
        let svantaggioMeccanico = false;
        let svantaggioDoppio = false;

        if (rating === 2) {
            modifier = attrMod + (prof * 2);
            sbloccaNuovaAbilita = true;
        } else if (rating === 1) {
            modifier = attrMod + prof;
        } else if (rating === 0) {
            modifier = attrMod;
        } else if (rating === -1) {
            modifier = attrMod;
            svantaggioMeccanico = true;
        } else if (rating === -2) {
            modifier = attrMod - prof;
            svantaggioMeccanico = true;
            svantaggioDoppio = true;
        }

        const advantage = !!(this.vantaggi && (this.vantaggi[attr] || this.vantaggi[skillKey]));
        const disadvantageFromFlags = !!(this.svantaggi && (this.svantaggi[attr] || this.svantaggi[skillKey]));
        const overloadDisadvantage = this.studyOverload && ['Intelligenza', 'Saggezza', 'Carisma'].includes(attr);
        const fatigueDisadvantage = this.faticaTotale >= 1;
        const ipoglicemiaDisadvantage = !!this.diabeteIpoglicemiaAttiva;

        let disadvantage = false;
        if ((this.hasPerk('Asmatico') || this.hasPerk('Obeso')) && this.staminaAttuale <= 2 &&
            ['Atletica', 'Acrobazia'].includes(skill)) {
            disadvantage = true;
        }
        if (skillKey === 'atletica') {
            if (this.hasPerk && this.hasPerk('Obeso')) modifier -= 4;
            else if (this.hasPerk && this.hasPerk('Sovrappeso')) modifier -= 2;
        }
        if (skillKey === 'acrobazia' && this.hasPerk('Artista') && this.getArtistaSpecializzazione() === 'Danzatore') {
            modifier += 2;
        }
        if (this.hasPerk && this.hasPerk('Solitario') && this.isEsploraSolo) {
            modifier += 2;
        }
        if (!advantage) {
            disadvantage = svantaggioMeccanico || disadvantageFromFlags || overloadDisadvantage || fatigueDisadvantage || ipoglicemiaDisadvantage;
        }

        return {
            modifier: modifier,
            advantage: advantage,
            disadvantage: disadvantage,
            rating: rating,
            attribute: attr,
            sbloccaMaestria: sbloccaNuovaAbilita,
            svantaggioDoppio: svantaggioDoppio
        };
    }

    sincronizzaLivelloMedicina() {
        let livello = 0;
        (this.perks || []).forEach(perk => {
            const nome = typeof perk === 'string' ? perk : perk?.nome;
            const match = /^Medicina Livello (\d)$/.exec(nome || '');
            if (match) livello = Math.max(livello, parseInt(match[1], 10));
        });
        if (this.hasPerk('Medico')) livello = Math.max(livello, 3);           // perk robotico
        if (this.hasPerk('Scansione biomedica')) livello = Math.max(livello, 1);
        if (livello > this.livelloMedicina) this.livelloMedicina = livello;
    }

    resetDailyStudy(currentHour) {
        if (this.ultimoStudioOre && currentHour - this.ultimoStudioOre >= 8) {
            this.oreStudioGiornaliere = 0;
            this.studyOverload = false;
            this.ultimoStudioOre = 0;
        }
    }

    adjustStaminaForMaxChange() {
        const currentMax = this.staminaMax;
        if (this.staminaAttuale > currentMax) {
            this.staminaAttuale = Math.max(0, currentMax);
        }
    }

    rollExplorationCheck() {
        const sagMod = this.getStatDettagliata('Saggezza').mod;
        let competenzaBonus = 0;
        const bonus = this.getBonusCompetenza();

        if (this.masteries && this.masteries.map(m => m.toLowerCase()).includes('sopravvivenza')) {
            competenzaBonus = bonus * 2;
        } else if (this.competenze && this.competenze.some(c => c.toLowerCase() === 'sopravvivenza')) {
            competenzaBonus = bonus;
        }

        const d20 = Math.floor(Math.random() * 20) + 1;
        let raccattatoreBonus = 0;
        if (window.hasPerk && typeof window.hasPerk === 'function' && window.hasPerk(this, 'Raccattatore')) {
            raccattatoreBonus = 2;
        }

        const total = d20 + sagMod + competenzaBonus + raccattatoreBonus;
        return {d20, sagMod, competenzaBonus, raccattatoreBonus, total};
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

    registraVittoriaCombattimento() {
        this.vittorieCombattimento += 1;
        if (this.vittorieCombattimento % 3 === 0) {
            this.puntiFortunaMax += 1;
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome}: +1 Punti Fortuna Massimi (ora ${this.puntiFortunaMax}) per 3 vittorie in combattimento.`, 'successo');
            }
        }
    }

    aggiungiFolliaPerEvento(causa) {
        if (this.follia >= 20) return;
        let tiro = 0;
        let logCausa = "";
        switch (causa) {
            case 'avariato':
                tiro = Math.floor(Math.random() * 4) + 1;
                logCausa = "Ingestione di 3 cibi avariati";
                break;
            case 'fobia':
                tiro = Math.floor(Math.random() * 6) + 1;
                logCausa = "Innesco da Perk Fobia";
                break;
            case 'trauma':
                tiro = Math.floor(Math.random() * 8) + 1;
                logCausa = "Morte di un compagno / Pericolo estremo";
                break;
            case 'rianimazione':
                tiro = Math.floor(Math.random() * 10) + 1;
                logCausa = "Rischio di Morte / Rianimazione / Mutilazione";
                break;
            default:
                return;
        }
        let bonusAnsioso = 0;
        if (this.perks && this.perks.some(p => p.nome === "Ansioso")) {
            bonusAnsioso = 1;
            logCausa += " (+1 da Ansioso)";
        }
        const totaleAumento = tiro + bonusAnsioso;
        this.follia = Math.min(20, this.follia + totaleAumento);
        if (typeof window.mostraNotificaInAlto === 'function') {
            window.mostraNotificaInAlto(`⚠️ La mente di ${this.nome} vacilla! Follia aumentata per: ${logCausa}. (Totale: ${this.follia})`, "pericolo");
        }
        if (this.follia >= 20) {
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`💀 DISASTRO: ${this.nome} è impazzito del tutto ed è irrecuperabile!`, "pericolo");
            }
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
                const cura = Math.floor(Math.random() * 4) + 1;
                this.follia = Math.max(0, this.follia - cura);
                if (typeof window.mostraNotificaInAlto === 'function') {
                    window.mostraNotificaInAlto(`✨ Il morale di ${this.nome} migliora grazie ai piatti prelibati! Follia ridotta di -${cura}.`, "successo");
                }
            }
        }
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
            return {fortunaoom: this.puntiFortuna === 0, realDamage: perso};
        }
        return {fortunaoom: this.puntiFortuna === 0, realDamage: 0};
    }

    worsenWoundDueToTime() {
        if (this.woundState === "Illeso" || this.woundState === "Morto") return;
        if (this.woundState === "Ferita lieve") {
            const baseProb = 0.30;
            const mod = this.constitutionModifier || 0;
            let prob = baseProb - (0.05 * mod);
            prob = Math.max(0, Math.min(1, prob));
            if (Math.random() < prob) {
                this.puntiFeritaReali = 3;
                if (typeof window.mostraNotificaInAlto === 'function') {
                    window.mostraNotificaInAlto(`${this.nome}: La ferita lieve si è infettata!`, "pericolo");
                }
            } else {
                this.resetWoundTimer();
                return;
            }
        } else {
            this.puntiFeritaReali = Math.max(0, this.puntiFeritaReali - 1);
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome}: Le condizioni peggiorano!`, "pericolo");
            }
        }
        this.resetWoundTimer();
    }

    receiveMedicalTreatment(success) {
        if (!success) return false;
        if (this.woundState === "Illeso") return false;
        if (this._diabeteInstabile) {
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome} non guarisce: diabete instabile, serve insulina!`, 'pericolo');
            }
            return false;
        }
        this.woundTreated = true;
        this.medicalHealPending = true;
        this.woundTimer = this.woundTimeToWorsen * 1.5;
        return true;
    }

    usaInsulina() {
        if (!this.diabeteTipoII) {
            alert(`${this.nome} non ha il Diabete di Tipo II.`);
            return false;
        }
        const materialiBase = window.magazzino?.materialiMedici?.base || 0;
        if (materialiBase < 5) {
            alert('Non hai abbastanza risorse mediche (base) per usare l\'insulina. Servono 5.');
            return false;
        }
        window.magazzino.materialiMedici.base -= 5;
        this.diabeteTimer = Math.min(120, (this.diabeteTimer || 0) + this.diabeteTimerMax); // era: = this.diabeteTimerMax
        this.diabeteGiorniSenzaInsulina = 0;
        this._diabeteInstabile = false;
        if (typeof window.mostraNotificaInAlto === 'function') {
            window.mostraNotificaInAlto(`${this.nome} ha usato l'insulina. Stabilizzato per altri 3 giorni.`, 'successo');
        }
        if (typeof window.updateMagazzinoFields === 'function') {
            window.updateMagazzinoFields({ materialiMedici: window.magazzino.materialiMedici });
        }
        if (typeof window.salvaPersonaggioCloud === 'function') window.salvaPersonaggioCloud(this);
        if (typeof window.aggiornaInterfaccia === 'function') window.aggiornaInterfaccia();
        return true;
    }

    registraColpoCombattimento(categoria, risultato) {
        let guadagno = 0;
        if (risultato === 'critical') guadagno = 2;
        else if (risultato === 'success') guadagno = 1;
        else if (risultato === 'fail') guadagno = 0.2;
        this.pca[categoria] = (this.pca[categoria] || 0) + guadagno;

        this.aggiornaLivelloArma(categoria);
    }

    calcolaOreAllenamentoGratuite(giornoAttuale) {
        if (this.ultimoGiornoAllenamento !== giornoAttuale) {
            this.oreAllenamento = 0;
            this.ultimoGiornoAllenamento = giornoAttuale;
        }
        const forzaMod = this.getStatDettagliata('Forza').mod;
        let gratuite = Math.max(1, 1 + forzaMod);
        if (this.hasPerk && this.hasPerk('Anemico')) {
            gratuite = Math.max(0, gratuite - 2);
        }
        return gratuite;
    }

    addestraArma(categoria, ore, giornoAttuale) {
        // Assumiamo che MAPPA_MUNIZIONI sia definita globalmente (da magazzino-ui.js)
        const mappaMunizioni = (typeof window !== 'undefined' && window.MAPPA_MUNIZIONI) ? window.MAPPA_MUNIZIONI[categoria] : null;
        if (mappaMunizioni) {
            let oreCoperte = 0;
            let oreDaCoprire = ore;
            let oreGommaUsate = Math.min(oreDaCoprire, magazzino.munizioni?.[mappaMunizioni.gomma] || 0);
            if (oreGommaUsate > 0) {
                magazzino.munizioni[mappaMunizioni.gomma] -= oreGommaUsate;
                oreCoperte += oreGommaUsate;
                oreDaCoprire -= oreGommaUsate;
            }
            if (oreDaCoprire > 0) {
                let munizioniVereUsate = Math.min(oreDaCoprire, magazzino.munizioni?.[mappaMunizioni.reale] || 0);
                if (munizioniVereUsate > 0) {
                    magazzino.munizioni[mappaMunizioni.reale] -= munizioniVereUsate;
                    oreCoperte += munizioniVereUsate;
                    oreDaCoprire -= munizioniVereUsate;
                }
            }
            if (oreCoperte === 0) {
                alert(`Impossibile allenarsi con ${categoria}: nessuna munizione (vera o di gomma) disponibile nel magazzino.`);
                return null;
            }
            if (oreCoperte < ore) {
                alert(`Munizioni insufficienti per ${ore} ore. L'allenamento di ${this.nome} con ${categoria} durerà solo ${oreCoperte} ore.`);
                ore = oreCoperte;
            }
        }

        const gratuite = this.calcolaOreAllenamentoGratuite(giornoAttuale);
        const oreGratuite = Math.min(ore, gratuite - this.oreAllenamento);
        const oreAGagoPagato = ore - oreGratuite;

        let pcaGuadagnato = ore * 2;
        const armiDaMischia = ['Armi in asta', 'Lame leggere', 'Mazze', 'Frusta'];
        if (this.timers && this.timers.buffProteico > 0 && armiDaMischia.includes(categoria)) {
            pcaGuadagnato *= 2;
        }

        // Aggiunta PCA
        this.pca[categoria] = (this.pca[categoria] || 0) + pcaGuadagnato;

        // 🔴 AGGIORNAMENTO LIVELLO ARMA
        this.aggiornaLivelloArma(categoria);

        this.fame = Math.max(0, this.fame - (14 * 0.15));
        const staminaDaConsumare = Math.ceil(oreAGagoPagato / 2);
        this.consumaStamina(staminaDaConsumare);
        if (staminaDaConsumare > 0) {
            const barsLost = staminaDaConsumare;
            party.forEach(member => {
                if (member.isRobot && member !== this) {
                    member.onAllyStaminaLost(barsLost);
                }
            });
        }
        this.oreAllenamento += oreGratuite;


        return {
            oreGratuite,
            oreAGagoPagato,
            staminaUsata: staminaDaConsumare,
            pcaGuadagnato
        };
    }

    registraPasto() {
        this.diabeteUltimoPastoTimestamp = window.oreTotali || 0;
    }

    tickOra() {
        // ==================== 1. DECADIMENTO RISORSE ====================
        if (!this.isRobot) {
            this._ensurePesoCorporeoInit();
            const calo = 1 / 24;
            const fameStadioPrima = this.stadioFame;
            const salta = this.timers.buffFame > 0 && this.hasPerk && this.hasPerk('Adattamento alimentare');
            this.fame = salta ? this.fame : Math.max(0, this.fame - calo);
            const fameStadioDopo = this.stadioFame;

            if (fameStadioDopo >= 3 && fameStadioPrima < 3) {
                const haPerkPeso = this.hasPerk('Obeso') || this.hasPerk('Sovrappeso');
                if (haPerkPeso && this.pesoCorporeo.usiCuscinetto > 0) {
                    this.fame = Math.min(14, this.fame + 0.15);
                }
            }

            this.sete = Math.max(0, this.sete - calo);
            this.sonno = Math.max(0, this.sonno - calo);
           } else {
            const inRicarica = this.azioneCorrente && this.azioneCorrente.tipo === 'ricarica_robot';
            const inRiposo = this.azioneCorrente && this.azioneCorrente.tipo === 'modalita_riposo';
            const consumoOra = inRicarica ? 0 : (inRiposo ? 0.1 : 1);
            this.batteryHours = Math.max(0, (this.batteryHours || 0) - consumoOra);
            if (this.hasPerk && this.hasPerk('Biocarburante')) {
                this.biocarburanteTimer = (this.biocarburanteTimer || 0) + 1;
                if (this.biocarburanteTimer >= 12 && !this.biocarburanteDeficit) {
                    this.biocarburanteDeficit = true;
                    if (typeof window.mostraNotificaInAlto === 'function') {
                        window.mostraNotificaInAlto(`${this.nome} necessita di biocarburante! -25% velocità azioni, -1 a tutte le statistiche.`, 'pericolo');
                    }
                }
            }
            if (this.batteryHours <= 0) {
                return "batteria esaurita";
            }
        }

        // ==================== 2. PRCCESSO AZIONE CORRENTE ====================
        const isExplorationAction = !!(this.azioneCorrente && this.azioneCorrente.tipo === 'esplora');
        if (this.azioneCorrente && (!this.inSpedizione || isExplorationAction)) {
            this.azioneCorrente.oreRimanenti -= 1;

            // Effetti specifici del sonno
            if (this.azioneCorrente.tipo === 'dormi') {
                const guadagnoSonno = (window.hasPerk && window.hasPerk(this, 'Trance')) ? 2 : 1;
                this.sonno = Math.min(8, this.sonno + guadagnoSonno);
            }

            if (this.azioneCorrente.oreRimanenti <= 0) {
                this.completaAzione();
            }
        }

        // ==================== 3. MALATTIA ====================
        if (this.isMalato()) {
            if (this.malattia.inCura && this.malattia.diagnosiCorretta && this.isRestAction()) {
                this.avanzaCuraMalattia(1);
            }
            if (this.isMalato() && this.hasPerk('Ipocondriaco')) {
                const giornoAttuale = Math.floor((window.oreTotali || 0) / 24);
                if (this._ultimoGiornoIpocondriaco !== giornoAttuale) {
                    this._ultimoGiornoIpocondriaco = giornoAttuale;
                    this.follia = Math.min(20, this.follia + 1);
                    this.aggiornaSintomiFollia();
                    if (typeof window.mostraNotificaInAlto === 'function') {
                        window.mostraNotificaInAlto(`${this.nome} (Ipocondriaco) si preoccupa per la sua malattia: Follia aumentata`, 'avviso');
                    }
                }
            }
            if (!this.malattia.inCura || !this.malattia.diagnosiCorretta) {
                this.checkMalattiaPeggioramento(1);
            }
            if (this.malattia.grado >= 9) {
                if (!this._malattiaPerditaPFContatore) this._malattiaPerditaPFContatore = 0;
                this._malattiaPerditaPFContatore++;
                if (this._malattiaPerditaPFContatore >= 24) {
                    this._malattiaPerditaPFContatore = 0;
                    this.puntiFeritaReali = Math.max(0, this.puntiFeritaReali - 1);
                    if (typeof window.mostraNotificaInAlto === 'function') {
                        window.mostraNotificaInAlto(`${this.nome} perde 1 PF reale a causa della malattia critica!`, 'pericolo');
                    }
                }
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

// ==================== 4b. CONTROLLO INFEZIONE (ferita lieve non curata) ====================
        if (this.woundState === "Ferita lieve" && !this.woundTreated) {
            if (!this._infectionCheckTimer) this._infectionCheckTimer = 0;
            this._infectionCheckTimer++;
            if (this._infectionCheckTimer >= 24) {
                this._infectionCheckTimer = 0;
                this.checkInfectionRisk();  // metodo già esistente
            }
        }

// ==================== 5. RECUPERO STAMINA ====================
        this.staminaRegenTimer++;
        let sogliaStamina = 4; 

// Perk Trance: dimezza il tempo di recupero
        if (this.hasPerk && this.hasPerk('Trance')) {
            sogliaStamina = 2;
        }

// Perk Anemico: raddoppia il tempo di recupero
        if (this.hasPerk && this.hasPerk('Anemico')) {
            sogliaStamina = sogliaStamina * 2;
        }

        if (this.staminaRegenTimer >= sogliaStamina) {
            const maxS = this.staminaMax;
            if (this.staminaAttuale < maxS) {
                this.staminaAttuale++;
            }
            this.staminaRegenTimer = 0;
        }
        if (this.hasPerk && (this.hasPerk('Asmatico') || this.hasPerk('Obeso'))) {
            if (this.staminaAttuale <= 0 && !this._asmaCrisi) {
                this._asmaCrisi = true;
                if (typeof mostraNotificaInAlto === 'function') {
                    mostraNotificaInAlto(`${this.nome} è in crisi respiratoria! Incapacitato finché non recupera stamina.`, 'pericolo');
                }
            } else if (this.staminaAttuale > 0 && this._asmaCrisi) {
                this._asmaCrisi = false;
                if (typeof mostraNotificaInAlto === 'function') {
                    mostraNotificaInAlto(`${this.nome} respira di nuovo normalmente.`, 'successo');
                }
            }
        }
// ==================== 6. DECREMENTO TIMER ====================
        for (let t in this.timers) {
            if (this.timers[t] > 0) this.timers[t] -= 1;
        }

        if (this.timers.buffFame > 0 && !this.isRobot) {
            this._ensurePesoCorporeoInit();
            if (this.hasPerk('Sottopeso')) {
                this.pesoCorporeo.benNutritoOreAccumulate += 1;
                if (this.pesoCorporeo.benNutritoOreAccumulate >= 12) {
                    this._rimuoviPerkSemplice('Sottopeso');
                    this.pesoCorporeo.benNutritoOreAccumulate = 0;
                    if (typeof window.mostraNotificaInAlto === 'function') {
                        window.mostraNotificaInAlto(`${this.nome} ha recuperato peso: il perk Sottopeso è scomparso!`, 'successo');
                    }
                }
            } else if (this.hasPerk('Anoressico')) {
                this.pesoCorporeo.benNutritoOreAccumulate += 1;
                if (this.pesoCorporeo.benNutritoOreAccumulate >= 24) {
                    this._rimuoviPerkSemplice('Anoressico');
                    const datiSottopeso = window.findPerkData ? window.findPerkData('Sottopeso') : null;
                    this.perks.push(datiSottopeso ? { ...datiSottopeso } : { nome: 'Sottopeso', desc: '', costo: -4 });
                    this.pesoCorporeo.benNutritoOreAccumulate = 0;
                    if (typeof window.mostraNotificaInAlto === 'function') {
                        window.mostraNotificaInAlto(`${this.nome} è passato da Anoressico a Sottopeso!`, 'successo');
                    }
                }
            } else if (this.rancoreTargetId && this.rancoreDurataOre !== null) {
                this.rancoreDurataOre -= 1;
                if (this.rancoreDurataOre <= 0) {
                    const bersaglio = window.party?.find(x => x.id === this.rancoreTargetId);
                    this.rancoreTargetId = null;
                    this.rancoreDurataOre = null;
                    if (typeof window.mostraNotificaInAlto === 'function') {
                        window.mostraNotificaInAlto(`${this.nome} non nutre più rancore verso ${bersaglio?.nome || 'qualcuno'}: il tempo ha placato l'astio.`, 'successo');
                    }
                }
            }
        }
        // ==================== 7. NORMALIZZA PF FORTUNA ====================
        this.normalizePuntiFortuna();

        // ==================== 8. RECUPERO MANA ====================
        if (this.isRestAction() && this.livelloMagia > 0) {
            this._restHoursAccumulated = (this._restHoursAccumulated || 0) + 1;
            if (this._restHoursAccumulated >= 4) {
                this.recoverManaShortRest();
                this._restHoursAccumulated = 0;
            }
            if (this._restHoursAccumulated >= 8) {
                this.recoverManaLongRest();
                this._restHoursAccumulated = 0;
            }
        } else {
            this._restHoursAccumulated = 0;
        }

        // ==================== 9. AUTO‑SOPRAVVIVENZA (emergenza) ====================
        if (!this.isRobot && !this.inSpedizione && typeof magazzino !== 'undefined'){
            if (this.fame <= 0 && magazzino.cibo >= 0.5) {
                magazzino.cibo -= 0.5;
                this.fame = Math.min(16, this.fame + 0.5);
                this.timers.fameSoddisfatta = 3;
                if (typeof mostraNotificaInAlto === 'function') {
                    mostraNotificaInAlto(`${this.nome} usa cibo d'emergenza per sopravvivere.`, 'avviso');
                }
            }
            if (this.sete <= 0 && magazzino.acqua >= 0.5) {
                magazzino.acqua -= 0.5;
                this.sete = Math.min(5, this.sete + 0.5);
                this.timers.seteSoddisfatta = 2;
                if (typeof mostraNotificaInAlto === 'function') {
                    mostraNotificaInAlto(`${this.nome} beve acqua d'emergenza per non disidratarsi.`, 'avviso');
                }
            }
        }
        if (this.diabeteTipoI || this.diabeteTipoII) {
            const oraAttuale = window.oreTotali || 0;

            // ---- Ipoglicemia ----
            const oreDaUltimoPasto = this.diabeteUltimoPastoTimestamp !== null ? (oraAttuale - this.diabeteUltimoPastoTimestamp) : 999;
            const staminaZero = this.staminaAttuale === 0;
            const ipoglicemia = (oreDaUltimoPasto >= 24) || staminaZero;

            if (ipoglicemia && !this.diabeteIpoglicemiaAttiva) {
                this.diabeteIpoglicemiaAttiva = true;
                if (typeof window.mostraNotificaInAlto === 'function') {
                    window.mostraNotificaInAlto(`${this.nome} è in IPOGLICEMIA! Svantaggio a tutti i tiri e Accecato oltre 3m.`, 'pericolo');
                }
            } else if (!ipoglicemia && this.diabeteIpoglicemiaAttiva) {
                this.diabeteIpoglicemiaAttiva = false;
                if (typeof window.mostraNotificaInAlto === 'function') {
                    window.mostraNotificaInAlto(`${this.nome} è uscito dall'ipoglicemia.`, 'successo');
                }
            }

            // ---- Iperglicemia ----
            const haMangiatoRecentemente = this.diabeteUltimoPastoTimestamp !== null && (oraAttuale - this.diabeteUltimoPastoTimestamp) < 4;
            this.diabeteStaminaSpesaLog = (this.diabeteStaminaSpesaLog || []).filter(e => (oraAttuale - e.ora) < 4);
            const staminaSpesaUltime4h = this.diabeteStaminaSpesaLog.reduce((s, e) => s + e.qty, 0);
            const iperglicemia = haMangiatoRecentemente && staminaSpesaUltime4h < 2;

            if (iperglicemia && !this.diabeteIperglicemiaAttiva) {
                this.diabeteIperglicemiaAttiva = true;
                if (typeof window.mostraNotificaInAlto === 'function') {
                    window.mostraNotificaInAlto(`${this.nome} è in IPERGLICEMIA! -2 a Saggezza/Carisma e CD Concentrazione 12.`, 'pericolo');
                }
            } else if (!iperglicemia && this.diabeteIperglicemiaAttiva) {
                this.diabeteIperglicemiaAttiva = false;
                if (typeof window.mostraNotificaInAlto === 'function') {
                    window.mostraNotificaInAlto(`${this.nome} è uscito dall'iperglicemia.`, 'successo');
                }
            }

            // ---- Tipo II: dipendenza da insulina ----
            if (this.diabeteTipoII) {
                if (this.diabeteTimer > 0) {
                    this.diabeteTimer = Math.max(0, this.diabeteTimer - 1);
                    if (this.diabeteTimer === 0) {
                        this._diabeteInstabile = true;
                        if (typeof window.mostraNotificaInAlto === 'function') {
                            window.mostraNotificaInAlto(`⚠️ ${this.nome}: insulina esaurita! Perderà 1 PF Reale al giorno finché non si stabilizza.`, 'pericolo');
                        }
                    }
                } else {
                    this.diabeteGiorniSenzaInsulina += 1 / 24;
                    if (this.diabeteGiorniSenzaInsulina >= 1) {
                        this.diabeteGiorniSenzaInsulina -= 1;
                        this.puntiFeritaReali = Math.max(0, this.puntiFeritaReali - 1);
                        if (typeof window.mostraNotificaInAlto === 'function') {
                            window.mostraNotificaInAlto(`${this.nome} perde 1 PF Reale per mancanza di insulina!`, 'pericolo');
                        }
                        if (this.puntiFeritaReali <= 0) {
                            this.puntiFeritaReali = 0;
                            return "mancanza di insulina";
                        }
                    }
                }
            }
        }
        // ==================== 10. AUTO‑SONNO (collasso) ====================
        if (this.sonno <= 0 && !this.inSpedizione && (!this.azioneCorrente || this.azioneCorrente.tipo !== 'dormi')) {
            const oreDormire = 15;
            this.azioneCorrente = {
                tipo: 'dormi',
                oreTotali: oreDormire,
                oreRimanenti: oreDormire,
                onComplete: () => { this.applicaRisveglio(oreDormire); this.completaAzione(); }
            };
            this.sonno = Math.min(8, this.sonno + 0.5);
            if (typeof mostraNotificaInAlto === 'function') {
                mostraNotificaInAlto(`${this.nome} si addormenta automaticamente per evitare il collasso.`, 'avviso');
            }
        }

        // ==================== 11. CONTROLLO MORTE (dopo le emergenze) ====================
        if (this.puntiFeritaReali <= 0) return "per emorragia";
        if (this.isRobot && this.robotPF <= 0) return "distrutto";
        if (this.faticaTotale >= 6) return "sfinimento";
        if (!this.isRobot) {
            if (this.fame <= 0) return "inedia";
            if (this.sete <= 0) return "disidratazione";
            if (this.sonno <= 0) return "privazione sonno";
        }
        if (this.hasPerk && this.hasPerk('Tumore magico')) {
            const giorniPassati = Math.floor((window.oreTotali || 0) / 24) - (this.giornoInizio || 0);
            if (giorniPassati >= 6 && !this._tumoreFaticaApplicata) {
                this._tumoreFaticaApplicata = true;
                this.faticaBase = Math.min(6, this.faticaBase + 2);
                if (typeof mostraNotificaInAlto === 'function') {
                    mostraNotificaInAlto(`${this.nome}: il Tumore Magico avanza. +2 fatica permanente.`, 'pericolo');
                }
            }
            if (giorniPassati >= 7) return "tumore magico";
        }

        // ==================== 12. GUARIGIONE PASSIVA FERITE ====================
        const staRiposando = !this.inSpedizione && (!this.azioneCorrente || !['esplora', 'allenamento'].includes(this.azioneCorrente.tipo));

        if (this.woundState !== "Illeso" && this.woundState !== "Morto" && staRiposando) {
            // Usa l'unica funzione centralizzata definita nel prototype
            const moltiplicatoreRigenerazione = this.getRestMultiplier();

            this.oreRiposoAccumulate += moltiplicatoreRigenerazione;

            const sogliaNecessaria = this.getOreNecessarieGuarigione();
            if (this.oreRiposoAccumulate >= sogliaNecessaria) {
                this.puntiFeritaReali = Math.min(this.puntiFeritaRealiMax, this.puntiFeritaReali + 1);
                this.oreRiposoAccumulate = 0;
                this.resetWoundTimer();
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
        for (let i = 0; i < ore; i++) {
            const causa = this.tickOra();
            const giornoAttuale = Math.floor((window.oreTotali || 0) / 24);
            this.checkOssessionePulizia(giornoAttuale);
            if (typeof processAutomaticActions === 'function') {
                processAutomaticActions(this);
            }
            if (causa) return causa;
        }
        return null;
    }

    get velocitaAttuale() {
        let v = this.velcotiaBase || 9;
        if (this.hasPerk('Grande taglia')) v -= 1;
        if (this.hasPerk('Piccola taglia')) v += 2;
        if (this.hasPerk('Corridore')) v += 1;
        if (this.hasPerk('Obeso')) v -= 3;
        if (this.hasPerk('Sovrappeso')) v -= 1;
        if(this.hasPerk('Pesante')) v-=3;
        if (this.hasPerk('Carapace/Esoscheletro duro')) v -= 3;
        v = Math.max(0, v);
        if (this.hasPerk('Zoppo')) v = v / 2;
        return v;
    }

    contraiMalattia(gradoIniziale = 1) {
        if (this.isRobot) return;
        if (this.isMalato()) {
            this.malattia.grado = Math.min(12, this.malattia.grado + 3);
            this.malattia.timerPeggioramento = this.calcolaTimerPeggioramento(this.malattia.grado);
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome} si è ammalato di più! Grado ${this.malattia.grado}`, 'pericolo');
            }
            return;
        }
        this.malattia.attiva = true;
        this.malattia.grado = Math.min(12, Math.max(1, gradoIniziale));
        this.malattia.timerPeggioramento = this.calcolaTimerPeggioramento(this.malattia.grado);
        this.malattia.diagnosiCorretta = false;
        this.malattia.diagnosiEffettuata = false;
        this.malattia.inCura = false;
        this.malattia.oreCuraAccumulate = 0;
        this.malattia.oreCureNecessarie = 0;
        this.malattia.gradoInizio = this.malattia.grado;
        if (typeof window.mostraNotificaInAlto === 'function') {
            window.mostraNotificaInAlto(`${this.nome} si è ammalato! (Grado ${this.malattia.grado})`, 'pericolo');
        }
    }

    // --- SISTEMA MALATTIE ---

    isMalato() {
        return this.malattia && this.malattia.attiva === true;
    }

    getGradoMalattia() {
        if (!this.malattia || !this.malattia.attiva) return 0;
        return this.malattia.grado || 0;
    }

    getMalattiaDebuff() {
        if (!this.isMalato()) return {desc: 'Nessuna malattia', malus: {}};
        const grado = this.malattia.grado;
        if (grado <= 3) {
            return {desc: 'Malattia lieve: +15% tempo in ogni azione', malus: {tempoAzione: 0.15}};
        } else if (grado <= 6) {
            return {desc: 'Malattia severa: -1 a tutti i modificatori', malus: {tuttiMod: -1}};
        } else if (grado <= 8) {
            return {desc: 'Malattia pesante: -1 Stamina, -10 PF fortuna max', malus: {stamina: -1, fortunaMax: -10}};
        } else {
            return {desc: 'Malattia critica: -1 PF reale al giorno', malus: {pfRealiGiorno: -1}};
        }
    }

    checkMalattiaPeggioramento(ore) {
        if (!this.isMalato()) return false;
        if (this.malattia.inCura && this.malattia.diagnosiCorretta) return false; // in cura corretta → non peggiora

        // Se ha diagnosi sbagliata, il timer è rallentato del 50%
        const fattore = (this.malattia.diagnosiEffettuata && !this.malattia.diagnosiCorretta) ? 0.5 : 1;

        // Sottrai le ore passate dal timer
        this.malattia.timerPeggioramento -= (ore * fattore);

        if (this.malattia.timerPeggioramento <= 0) {
            // Peggiora di un grado (aumenta di 3)
            this.malattia.grado = Math.min(12, this.malattia.grado + 3);
            this.malattia.timerPeggioramento = this.calcolaTimerPeggioramento(this.malattia.grado);
            // Resetta la diagnosi (va rifatta per il nuovo grado)
            this.malattia.diagnosiCorretta = false;
            this.malattia.diagnosiEffettuata = false;
            this.malattia.inCura = false;
            this.malattia.oreCuraAccumulate = 0;

            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome}: la malattia è peggiorata al grado ${this.malattia.grado}!`, 'pericolo', this.user_id);
            }
            return true;
        }
        return false;
    }

    /**
     * Calcola il timer di peggioramento in base al grado
     */
    calcolaTimerPeggioramento(grado) {
        // 4 giorni per il primo peggioramento, dimezza ad ogni livello
        const oreBase = 4 * 24; // 96 ore
        const livello = Math.floor((grado - 1) / 3); // 0, 1, 2, 3...
        let ore = oreBase / Math.pow(2, livello);
        // Minimo 6 ore
        return Math.max(6, ore);
    }

    /**
     * Calcola le ore di cura necessarie per il grado attuale
     */
    calcolaOreCuraNecessarie(grado) {
        const base = {1: 8, 2: 8, 3: 8, 4: 6, 5: 6, 6: 6, 7: 9, 8: 9, 9: 12, 10: 12, 11: 12, 12: 12};
        const oreBase = base[Math.min(Math.max(1, grado), 12)] || 8;
        // Modifica della Costituzione: -10% per +1, +10% per -1 (max ±50%)
        const modCos = this.getStatDettagliata('Costituzione').mod || 0;
        const fattore = 1 - (modCos * 0.1);
        const limitato = Math.max(0.5, Math.min(1.5, fattore));
        return Math.round(oreBase * limitato);

    }

    /**
     * Calcola i materiali necessari per la cura
     */
    calcolaMaterialiCura(grado, isDiagnosiCorretta = true) {
        const req = {
            1: {base: 2, avanzati: 0, critici: 0},
            2: {base: 2, avanzati: 0, critici: 0},
            3: {base: 2, avanzati: 0, critici: 0},
            4: {base: 2, avanzati: 1, critici: 0},
            5: {base: 2, avanzati: 1, critici: 0},
            6: {base: 2, avanzati: 1, critici: 0},
            7: {base: 4, avanzati: 1, critici: 0},
            8: {base: 4, avanzati: 1, critici: 0},
            9: {base: 4, avanzati: 2, critici: 1},
            10: {base: 4, avanzati: 2, critici: 1},
            11: {base: 4, avanzati: 2, critici: 1},
            12: {base: 4, avanzati: 2, critici: 1}
        };
        let requisiti = req[Math.min(Math.max(1, grado), 12)] || req[1];
        if (isDiagnosiCorretta && this.malattia.oreCuraAccumulate > 0) {
            requisiti = {
                base: Math.max(1, Math.ceil(requisiti.base / 4)),
                avanzati: Math.max(0, Math.ceil(requisiti.avanzati / 4)),
                critici: Math.max(0, Math.ceil(requisiti.critici / 4))
            };
        }
        return requisiti;
    }

    completaAzione() {
        if (this.azioneCorrente) {
            const bugFail = window.hasPerk && window.hasPerk(this, 'Bug') && Math.random() < 0.10;
            if (bugFail) {
                if (typeof window.mostraNotificaInAlto === 'function') {
                    window.mostraNotificaInAlto(`⚠️ Bug: l'azione di ${this.nome} si interrompe a metà e fallisce!`, 'pericolo');
                }
                this.azioneCorrente = this.codaAzioni.shift() || null;
                if (typeof window.salvaPersonaggioCloud === 'function') {
                    window.salvaPersonaggioCloud(this);
                }
                return;
            }
            // Se esiste onComplete, eseguilo
            if (typeof this.azioneCorrente.onComplete === 'function') {
                try {
                    this.azioneCorrente.onComplete();
                } catch (e) {
                    console.warn('Errore in onComplete:', e);
                }
            } else {
                // FALLBACK: se manca onComplete, gestiamo i tipi di azione noti
                const tipo = this.azioneCorrente.tipo;
                if (tipo === 'esplora') {
                    if (typeof window.terminaEsplorazione === 'function') {
                        window.terminaEsplorazione(this);
                    } else {
                        console.warn('terminaEsplorazione non disponibile');
                    }
                } else if (tipo === 'dormi') {
                    if (typeof this.applicaRisveglio === 'function') {
                        this.applicaRisveglio(this.azioneCorrente.oreTotali);
                    }
                } else if (tipo === 'allenamento') {
                    // per allenamento, se non c'è onComplete, non possiamo recuperare la categoria, ma possiamo loggare
                    console.warn(`Allenamento completato senza onComplete per ${this.nome}`);
                } else {
                    console.warn(`Azione ${tipo} completata ma senza onComplete e nessuna gestione predefinita.`);
                }
            }
        }
        // Passa alla prossima azione in coda
        this.azioneCorrente = this.codaAzioni.shift() || null;
        if (typeof window.salvaPersonaggioCloud === 'function') {
            window.salvaPersonaggioCloud(this);
        }
    }

    normalizePuntiFortuna() {
        const max = this.puntiFortunaMaxEffettivo;
        if (this.puntiFortuna > max) {
            this.puntiFortuna = max;
        }
    }

    avanzaCuraMalattia(ore) {
        if (!this.isMalato() || !this.malattia.inCura || !this.malattia.diagnosiCorretta) {
            return false;
        }

        // Solo se sta riposando (isRestAction)
        if (!this.isRestAction()) {
            return false;
        }

        this.malattia.oreCuraAccumulate += ore;

        if (this.malattia.oreCuraAccumulate >= this.malattia.oreCureNecessarie) {
            // Cura completata: rimuovi la malattia
            const gradoCorrente = this.malattia.grado;
            this.malattia.attiva = false;
            this.malattia.grado = 0;
            this.malattia.inCura = false;
            this.malattia.diagnosiCorretta = false;
            this.malattia.diagnosiEffettuata = false;
            this.malattia.oreCuraAccumulate = 0;
            this.malattia.timerPeggioramento = 0;

            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(`${this.nome} è guarito dalla malattia (grado ${gradoCorrente})!`, 'successo', this.user_id);
            }
            return true;
        }

        return false;
    }

    aggiornaLivelloArma(categoria) {
        if (!this.pca || !this.armiLivello) return 0;

        const pcaAttuali = this.pca[categoria] || 0;
        let nuovoLivello = 0;

        // Calcolo del livello in base alla tabella PCA
        if (pcaAttuali >= 50) nuovoLivello = 5;
        else if (pcaAttuali >= 34) nuovoLivello = 4;
        else if (pcaAttuali >= 22) nuovoLivello = 3;
        else if (pcaAttuali >= 15) nuovoLivello = 2;
        else if (pcaAttuali >= 6) nuovoLivello = 1;

        const vecchioLivello = this.armiLivello[categoria] || 0;

        // Se il livello aumenta, aggiorna e notifica
        if (nuovoLivello > vecchioLivello) {
            this.armiLivello[categoria] = nuovoLivello;
            if (typeof window.mostraNotificaInAlto === 'function') {
                window.mostraNotificaInAlto(
                    `🎉 ${this.nome} ha raggiunto il Livello ${nuovoLivello} in ${categoria}!`,
                    'successo'
                );
            }
        }

        return nuovoLivello;
    }

    calcolaCostoStat(valoreAttuale) {
        if (valoreAttuale < 12) return 1;
        if (valoreAttuale < 16) return 2;
        if (valoreAttuale < 19) return 3;
        return 4; // da 19 a 20
    }

    /**
     * Applica gli effetti della malattia alle statistiche (da chiamare in getStatDettagliata, staminaMax, ecc.)
     */
    applicaEffettiMalattia(stat = null) {
        if (!this.isMalato()) return 0;
        const grado = this.malattia.grado;
        const debuff = this.getMalattiaDebuff();

        if (stat === 'stamina' && grado >= 7) {
            return -1;
        }
        if (stat === 'fortunaMax' && grado >= 7) {
            return -10;
        }
        if (stat === 'tuttiMod' && grado >= 4 && grado <= 6) {
            return -1;
        }
        if (stat === 'pfRealiGiorno' && grado >= 9) {
            return -1; // da applicare una volta al giorno
        }
        if (stat === 'tempoAzione' && grado <= 3) {
            return 0.15; // +15% tempo
        }
        return 0;
    }
}

Personaggio.prototype.hasPerk = function (nome) {
    if (!this.perks) return false;
    return this.perks.some(p => (typeof p === 'string' ? p : p?.nome) === nome);
};

Personaggio.prototype.getModificatoreTempoAzione = function (tipoAzione, materia = null) {
    let mult = 1;

    // Rilassato: +10% tempo su ogni azione TRANNE guarire
    if (this.hasPerk('Rilassato') && tipoAzione !== 'guarigione') {
        mult *= 1.10;
    }

    // Ipocondriaco: +20% tempo su ogni azione se ha uno stadio di malattia attivo
    if (this.hasPerk('Ipocondriaco') && this.isMalato && this.isMalato()) {
        mult *= 1.20;
    }

    // Maldestro: +30% tempo per imparare/lavorare Manodopera, Rapidità di mano, Artificeria
    if (materia && this.hasPerk('Maldestro') &&
        ['Manodopera', 'Rapidità di mano', 'Artificeria'].includes(materia)) {
        mult *= 1.30;
    }

    return mult;
};

Personaggio.prototype.getSogliaStudioGiornaliero = function () {
    return this.hasPerk('Studente devoto') ? 10 : 8; // +25%
};

Personaggio.prototype.applicaRisveglio = function (oreDormite) {
    const oreEffettive = this.hasPerk('Insonne') ? oreDormite * 0.7 : oreDormite;
    const fattoreTrance = this.hasPerk('Trance') ? 2 : 1;
    const oreSogliaBreve = this.hasPerk('Trance') ? 2 : 4;
    const oreSogliaLunga = this.hasPerk('Trance') ? 4 : 8;

    if (oreDormite >= oreSogliaBreve && this.livelloMagia > 0) {
        const cicli = Math.floor(oreEffettive / oreSogliaBreve);
        for (let i = 0; i < cicli; i++) this.recoverManaShortRest();
    }

    // ASMATICO: cap recupero stamina su riposo breve, salvo boost pagato
    if (this.hasPerk('Asmatico') && oreDormite < oreSogliaLunga) {
        if (!this._asmaShortRestBoost) {
            const maxRecuperoConsentito = 2;
            const staminaPrimaCap = Math.min(this.staminaMax, this.staminaAttuale + maxRecuperoConsentito);
            if (this.staminaAttuale > staminaPrimaCap) {
                this.staminaAttuale = staminaPrimaCap;
            }
            // Nota: il cap effettivo va applicato anche al termine dell'azione dormi via tickOra,
            // quindi qui limitiamo lo stato finale accumulato durante il riposo.
        }
        this._asmaShortRestBoost = false; // consumato/azzerato a fine riposo
    }

    if (oreDormite >= oreSogliaLunga) {
        if (this.livelloMagia > 0) this.recoverManaLongRest();
        let recFatica = this.hasPerk('Insonne') ? 1.4 : 2;
        const minFatica = (this.hasPerk('Tumore magico') && this._tumoreFaticaApplicata) ? 2 : 0;
        this.faticaBase = Math.max(minFatica, this.faticaBase - recFatica);
        this.timers.sonnoSoddisfatto = 6;
        this.timers.buffSonno = 8;
    }
};

Personaggio.prototype.hasDisadvantageCostituzioneTS = function () {
    return !!(this.hasPerk && this.hasPerk('Asmatico') && this.staminaAttuale <= 2);
};

Personaggio.prototype.getPerfezionistaTimeModifier = function (rollTotale) {
    if (!this.hasPerk || !this.hasPerk('Perfezionista')) return 1;
    return rollTotale >= 20 ? 0.9 : 1.2;
};

Personaggio.prototype.getModificatoreTempoAzione = function (tipoAzione, materia = null) {
    let mult = 1;

    if (this.hasPerk('Rilassato') && tipoAzione !== 'guarigione') {
        mult *= 1.10;
    }

    if (this.hasPerk('Ipocondriaco') && this.isMalato && this.isMalato()) {
        mult *= 1.20;
    }

    if (materia && this.hasPerk('Maldestro') &&
        ['Manodopera', 'Rapidità di mano', 'Artificeria'].includes(materia)) {
        mult *= 1.30;
    }

    // ARTIGIANO ALIMENTARE: -20% tempo su ogni azione in corso (incluse guarigione e riposo) per 2h dopo cucina
    if (this.timers && this.timers.buffArtigianoAlimentare > 0) {
        mult *= 0.8;
    }

    if (this.isRobot && this.biocarburanteDeficit) {
        mult *= 1.25;
    }

    return mult;
};
window.Personaggio = Personaggio;
window.buildAuthHeaders = buildAuthHeaders;
window.caricaDatiDaLocalStorage = caricaDatiDaLocalStorage;
window.salvaPersonaggioLocalmente = salvaPersonaggioLocalmente;
window.salvaPersonaggioCloud = salvaPersonaggioCloud;
window.salvaPersonaggio=salvaPersonaggio;
