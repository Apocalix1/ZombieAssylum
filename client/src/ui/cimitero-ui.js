function renderCimitero() {
    const lista = document.getElementById('cimitero-lista');
    if (!lista) return;
    
    if (cimitero.length === 0) {
        lista.innerHTML = `<div style="color:#666; font-style:italic; padding:10px; text-align:center;">Il cimitero è vuoto. La fortuna assiste il party.</div>`;
        return;
    }

    // Mostra il nome, la causa, il giorno del decesso e i giorni totali di sopravvivenza
    lista.innerHTML = cimitero.map(m => `
        <div class="morto-entry" style="background:#1a1a1a; padding:8px; margin-bottom:6px; border-left:3px solid #ff4444; border-radius:3px; text-align:left;">
            <b style="color:#ff4444;">💀 ${m.nome.toUpperCase()}</b><br>
            <small style="color:#ccc;">Causa: ${m.causa}</small><br>
            <small style="color:#888;">Decesso: ${m.data} (Sopravvissuto per ${m.giorni} giorni)</small>
        </div>
    `).reverse().join("");
}

function toggleCimitero() {
    // Gestione unificata: se usi un pannello laterale (side-cimitero) o un modale (modal-cimitero)
    const cim = document.getElementById('side-cimitero') || document.getElementById('modal-cimitero');
    if (!cim) return;

    if (cim.id === 'side-cimitero') {
        cim.classList.toggle('open');
        if (cim.classList.contains('open')) renderCimitero();
    }
}

function chiudiCimitero() {
    const cim = document.getElementById('side-cimitero') || document.getElementById('modal-cimitero');
    if (!cim) return;

    if (cim.id === 'side-cimitero') {
        cim.classList.remove('open');
    } else {
        cim.style.display = 'none';
    }
}

window.toggleCimitero = toggleCimitero;