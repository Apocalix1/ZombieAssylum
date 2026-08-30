export let magazzino = {
    materialiAlchemici: 0,
    erbe: 0,
    componentiElettronici: 0,
    rottami: 0,
    legname: 0,
    tessuto: 0,
    cibo: 10,
    acqua: 10,
    medicine: 0,
    conserve: 0,
    oreTotali: 0,
    ciboAvariato: 0,
    piattiDeliziosi: 0,
    piattiDeliziosiPotenziati: 0,
    ingranaggi: 0,
    materialiMedici: { base: 0, avanzati: 0, critici: 0 },
    postazioneAlchemica: false,
    compounds: [],
    composti: [],
    congegniFissi: [],
    congegniConteggio: {},
    oggettiMagici: { comuni: 0, nonComuni: 0, rari: 0, superRari: 0 },
    munizioni: { gomma: 0, reale: 0 },
    batterie: 0,
    cadaveriRobot: 0,
    cadaveriUmani: 0,
    stazioneRicarica: null, // { batterie: 0, robotIdOccupante: null }
    consumabili: [],
    libri: [],
    armiTrovate: [],
    armi: [],
    oggetti: [],
    logMovimenti: [],
    smembramentoAbilitato: false, // NEW
    updated_at: new Date().toISOString()
};

export let party = [];

window.magazzino = magazzino;
window.party = party;

export function setMagazzino(newData) {
    Object.assign(magazzino, newData);
}

export function setParty(newParty) {
    party.length = 0;
    newParty.forEach(p => party.push(p));
}
