import { apiUrl, buildAuthHeaders } from './logic.js';
import { getCurrentUser } from '../ui/auth-ui.js';
import {aggiornaInterfaccia, party} from '../ui/ui.js';

export async function masterInviaDocumento(titolo, lingua, testoOriginale, personaggioIdDestinatario) {
	const caratteriCriptati = ["⌧", "⌊", "⊗", "∇", "▮", "⌕", "⌰", "⌫", "⍑", "⍃", "⍓"];
	const testoCriptato = testoOriginale.split(' ').map(parola =>
		parola.split('').map(() => caratteriCriptati[Math.floor(Math.random() * caratteriCriptati.length)]).join('')
	).join(' ');

	const contenuto = JSON.stringify({
		lingua_richiesta: lingua,
		testo_originale: testoOriginale,
		testo_criptato: testoCriptato
	});

	const payload = {
		titolo,
		contenuto,
		personaggio_id: personaggioIdDestinatario || 0
	};

	try {
		const res = await fetch(apiUrl('/api/documenti'), {
			method: 'POST',
			headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
			body: JSON.stringify(payload)
		});
		if (res.ok) {
			alert(`📜 Documento "${titolo}" consegnato al giocatore!`);
		} else {
			console.warn("Errore nell'invio del documento");
		}
	} catch (error) {
		console.error("Errore di rete durante l'invio del documento:", error);
	}
}

export async function masterApplicaStato(personaggioId, nomeStato, tipo, descrizione, durataMinuti, modificatori = []) {
	const payload = { personaggio_id: personaggioId, nome: nomeStato, tipo, descrizione, durata_minuti: durataMinuti, modificatori };
	const res = await fetch(apiUrl('/api/master/apply-state'), {
		method: 'POST',
		headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
		body: JSON.stringify(payload)
	});
	if (res.ok) alert(`⚙️ Stato "${nomeStato}" applicato (${modificatori.map(m=>`${m.stat} ${m.valore>=0?'+':''}${m.valore}`).join(', ')}) per ${durataMinuti} minuti.`);
}

// client/src/ui/ui.js
window.masterActionStato = async function() {
	const target = document.getElementById('master-state-target').value;
	const nome = document.getElementById('master-state-nome').value;
	const tipo = document.getElementById('master-state-tipo').value;
	const durata = parseInt(document.getElementById('master-state-durata').value);
	const desc = document.getElementById('master-state-desc').value;

	if (!target) return alert("Seleziona un personaggio target");
	if (!nome) return alert("Nome stato obbligatorio");
	if (!window.modificatoriCorrenti || window.modificatoriCorrenti.length === 0) {
		if (!confirm("Nessun modificatore impostato: lo stato non avrà effetti sulle statistiche. Continuare comunque?")) return;
	}

	await masterApplicaStato(target, nome, tipo, desc, durata, window.modificatoriCorrenti || []);
	if (typeof caricaPartyMaster === 'function') await caricaPartyMaster();
};

function aggiornaDisplayGiorno() {
	const disp = document.getElementById('master-giorno-attuale');
	if (disp) disp.textContent = Math.floor(oreTotali / 24);
}

window.masterActionInvia = async function() {
	const target = document.getElementById('master-doc-target').value;
	const titolo = document.getElementById('master-doc-titolo').value;
	const lingua = document.getElementById('master-doc-lingua').value;
	const testo = document.getElementById('master-doc-testo').value;
	if (!target) return alert("Seleziona un destinatario specifico.");
	if (!titolo || !testo) return alert("Titolo e testo obbligatori");
	await masterInviaDocumento(titolo, lingua, testo, target);
};


window.masterImpostaGiorno = async function() {
	const input = document.getElementById('master-set-giorno');
	const nuovoGiorno = parseInt(input?.value);
	if (isNaN(nuovoGiorno) || nuovoGiorno < 0) return alert('Inserisci un numero di giorno valido (>=0).');
	const restoOre = oreTotali % 24;
	oreTotali = (nuovoGiorno * 24) + restoOre;
	window.oreTotali = oreTotali;
	if (typeof window.updateMagazzinoFields === 'function') await window.updateMagazzinoFields({ oreTotali });
	aggiornaDisplayGiorno();
	aggiornaInterfaccia();
	mostraNotificaInAlto(`⏱️ Tempo impostato al giorno ${nuovoGiorno}.`, 'successo');
};

window.masterRiduciGiorni = async function(giorni) {
	oreTotali = Math.max(0, oreTotali - (giorni * 24));
	window.oreTotali = oreTotali;
	if (typeof window.updateMagazzinoFields === 'function') await window.updateMagazzinoFields({ oreTotali });
	aggiornaDisplayGiorno();
	aggiornaInterfaccia();
	mostraNotificaInAlto(`⏱️ Tempo ridotto di ${giorni} giorni.`, 'successo');
};

window.bloccaPulizia = function(idx) {
	const p = party[idx];
	if (!p) return;
	p.pulizieBloccate = true;
	mostraNotificaInAlto(`${p.nome}: la prossima pulizia verrà bloccata (Follia aumenterà).`, 'avviso');
	salvaPersonaggioCloud(p);
	aggiornaInterfaccia();
};

window.gestisciPessimista = function(idx) {
	const p = party[idx];
	if (!p) return;
	const scelta = prompt(`Stack Pessimista di ${p.nome}: attuale ${p.pessimistaStack || 0}/5.\nScrivi "+" per aumentare o "-" per diminuire.`, "+");
	if (!scelta) return;
	if (scelta.trim() === '+') p.pessimistaStack = Math.min(5, (p.pessimistaStack || 0) + 1);
	else if (scelta.trim() === '-') p.pessimistaStack = Math.max(0, (p.pessimistaStack || 0) - 1);
	p.pessimistaUltimoTiro = window.oreTotali || 0;
	salvaPersonaggioCloud(p);
	aggiornaInterfaccia();
};

window.apriImpostaRancore = function(idx) {
	const p = party[idx];
	if (!p) return;
	const candidati = party.filter((q, i) => i !== idx);
	if (!candidati.length) { alert('Nessun altro personaggio disponibile.'); return; }
	const elenco = candidati.map((q, i) => `${i}) ${q.nome}`).join('\n');
	const scelta = prompt(`Su chi ${p.nome} nutre rancore? (invio per annullare)\n${elenco}`);
	if (scelta === null || scelta.trim() === '') return;
	const target = candidati[parseInt(scelta)];
	if (!target) { alert('Scelta non valida.'); return; }

	if (p.rancoreTargetId === target.id) {
		p.rancoreTargetId = null;
		p.rancoreScadenza = null;
		mostraNotificaInAlto(`${p.nome} non nutre più rancore verso ${target.nome}.`, 'successo');
	} else {
		const durataStr = prompt('Per quante ore di gioco deve durare il rancore? (vuoto = permanente)', '24');
		const durata = parseFloat(durataStr);
		p.rancoreTargetId = target.id;
		p.rancoreScadenza = (!isNaN(durata) && durata > 0) ? (window.oreTotali || 0) + durata : null;
		mostraNotificaInAlto(`${p.nome} nutre rancore verso ${target.nome}${p.rancoreScadenza ? ` per ${durata}h` : ' (permanente)'}.`, 'avviso');
	}
	salvaPersonaggioCloud(p);
	aggiornaInterfaccia();
};

window.masterAbilitaSmembramento = async function() {
	magazzino.smembramentoAbilitato = true;
	if (typeof window.updateMagazzinoFields === 'function') {
		await window.updateMagazzinoFields({ smembramentoAbilitato: true });
	}
	mostraNotificaInAlto('☠️ Smembramento abilitato per un uso.', 'avviso');
	aggiornaInterfaccia();
};

window.masterAggiungiOggetto = function(idx) {
    const user = getCurrentUser();
    if (!user || user.role !== 'master') return;
    const p = party[idx];
    if (!p) return;
    p.initInventarioBase();

    const opzioni = ['cibo', 'acqua', 'ingranaggi', 'alchemici', 'medBase', 'medAvanzati', 'medCritici', 'arma_libera'];
    const scelta = prompt(`Cosa vuoi aggiungere a ${p.nome}?\n${opzioni.join(', ')}`, 'cibo');
    if (!scelta) return;

    if (scelta === 'arma_libera') {
        const nomeArma = prompt('Nome dell\'oggetto/arma da aggiungere:');
        if (!nomeArma) return;
        p.inventario.armi.push(nomeArma);
        mostraNotificaInAlto(`${p.nome} ha ricevuto: ${nomeArma}.`, 'successo');
    } else if (opzioni.includes(scelta)) {
        const qta = parseFloat(prompt(`Quantità di ${scelta} da aggiungere?`, '1'));
        if (isNaN(qta) || qta <= 0) return;
        p.inventario[scelta] = (p.inventario[scelta] || 0) + qta;
        mostraNotificaInAlto(`${p.nome} ha ricevuto ${qta} ${scelta}.`, 'successo');
    } else {
        alert('Voce non riconosciuta.');
        return;
    }
    salvaPersonaggioCloud(p);
    aggiornaInterfaccia();
};

window.masterConsumaBatteria = function(idx) {
    const p = party[idx];
    if (!p || !p.isRobot) return;
    const ore = parseFloat(prompt(`Ore di batteria da consumare a ${p.nome}? (attuale: ${p.batteryHours.toFixed(1)}h)`, '1'));
    if (isNaN(ore) || ore <= 0) return;
    p.consumeBattery(ore);
    mostraNotificaInAlto(`${p.nome}: batteria consumata manualmente di ${ore}h dal Master.`, 'avviso');
    salvaPersonaggioCloud(p);
    aggiornaInterfaccia();
};

window.masterAggiungiCadavereRobot = function() {
    magazzino.cadaveriRobot = (magazzino.cadaveriRobot || 0) + 1;
    window.updateMagazzinoFields({ cadaveriRobot: magazzino.cadaveriRobot });
    mostraNotificaInAlto('Cadavere robot aggiunto alla base.', 'avviso');
    aggiornaInterfaccia();
};
window.masterAggiungiCadavereUmano = function() {
    magazzino.cadaveriUmani = (magazzino.cadaveriUmani || 0) + 1;
    window.updateMagazzinoFields({ cadaveriUmani: magazzino.cadaveriUmani });
    mostraNotificaInAlto('Cadavere aggiunto alla base.', 'avviso');
    aggiornaInterfaccia();
};

window.gestisciCroceRossina = function(idx) {
	const p = party[idx];
	if (!p) return;
	const scelta = prompt(`Sensi di colpa di ${p.nome}: attuale ${p.senseDiColpaStack || 0}/4.\nScrivi "+" per aumentare o "-" per diminuire.`, "+");
	if (!scelta) return;
	if (scelta.trim() === '+') {
		p.senseDiColpaStack = Math.min(4, (p.senseDiColpaStack || 0) + 1);
		p.follia = Math.min(20, p.follia + 2);
		mostraNotificaInAlto(`${p.nome}: sensi di colpa aumentati (${p.senseDiColpaStack}/4). Follia +2.`, 'pericolo');
	} else if (scelta.trim() === '-') {
		p.senseDiColpaStack = Math.max(0, (p.senseDiColpaStack || 0) - 1);
		mostraNotificaInAlto(`${p.nome}: sensi di colpa ridotti (${p.senseDiColpaStack}/4).`, 'successo');
	}
	salvaPersonaggioCloud(p);
	aggiornaInterfaccia();
};
