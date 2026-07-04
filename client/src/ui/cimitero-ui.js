export function renderCimitero() {
    const lista = document.getElementById('cimitero-lista');
    if (!lista) return;
    
    // In assenza di cimitero importato, lo cerchiamo globalmente
    const cimiteroArray = window.cimitero || [];
    
    if (cimiteroArray.length === 0) {
        lista.innerHTML = `<div style="color:#666; font-style:italic; padding:10px; text-align:center;">Il cimitero è vuoto. La fortuna assiste il party.</div>`;
        return;
    }

    // Mostra il nome, la causa, il giorno del decesso e i giorni totali di sopravvivenza
    lista.innerHTML = cimiteroArray.map(m => {
        const nome = (m.nome || 'Sconosciuto').toUpperCase();
        const causa = m.causa || 'Ignota';
        const data = m.data || 'Data ignota';
        const giorni = m.giorni || 0;
        return `
            <div class="morto-entry" style="background:#1a1a1a; padding:8px; margin-bottom:6px; border-left:3px solid #ff4444; border-radius:3px; text-align:left;">
                <b style="color:#ff4444;">💀 ${nome}</b><br>
                <small style="color:#ccc;">Causa: ${causa}</small><br>
                <small style="color:#888;">Decesso: ${data} (Sopravvissuto per ${giorni} giorni)</small>
            </div>
        `;
    }).reverse().join("");
}

window.renderCimitero = renderCimitero;

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