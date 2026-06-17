/**

* Genera un documento personalizzato inserito dal Master e lo invia a un giocatore specifico

*/

export async function masterInviaDocumento(titolo, lingua, testoOriginale, personaggioIdDestinatario) {

// Generatore rapido di testo criptato "illegibile" basato sul testo originale

const caratteriCriptati = ["⌧", "⌊", "⊗", "∇", "▮", "⌕", "⌰", "⌫", "⍑", "⍃", "⍓"];

const testoCriptato = testoOriginale.split(' ').map(parola =>

parola.split('').map(() => caratteriCriptati[Math.floor(Math.random() * caratteriCriptati.length)]).join('')

).join(' ');



const payload = {

titolo,

lingua_richiesta: lingua,

testo_originale: testoOriginale,

testo_criptato: testoCriptato,

personaggio_id: personaggioIdDestinatario // Passato direttamente all'inventario del PG scelto

};



const res = await fetch('/api/master/crea-documento', {

method: 'POST',

headers: { 'Content-Type': 'application/json' },

body: JSON.stringify(payload)

});



if (res.ok) alert(`📜 Documento "${titolo}" consegnato al giocatore!`);

}



/**

* Applica un Buff o Debuff temporaneo a un personaggio con un timer in minuti

*/

export async function masterApplicaStato(personaggioId, nomeStato, tipo, descrizione, durataMinuti) {

const payload = { personaggio_id: personaggioId, nome: nomeStato, tipo, descrizione, durata_minuti: durataMinuti };



const res = await fetch('/api/master/applica-stato', {

method: 'POST',

headers: { 'Content-Type': 'application/json' },

body: JSON.stringify(payload)

});



if (res.ok) alert(`⚙️ Stato [${tipo.toUpperCase()}] "${nomeStato}" applicato per ${durataMinuti} minuti di gioco.`);

}