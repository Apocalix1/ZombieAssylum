export async function renderCimitero() {
    const lista = document.getElementById('cimitero-lista');
    if (!lista) return;

    let cimiteroArray = [];

    try {
        const res = await fetch(window.apiUrl('/api/cimitero'), { headers: window.buildAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            const user = window.getCurrentUser ? window.getCurrentUser() : null;
            cimiteroArray = (data.cimitero || []).map(c => ({
                id: c.id,
                user_id: c.user_id,
                nome: c.nome,
                ownerUsername: c.owner_username || 'Sconosciuto',
                causa: c.data?.causaMorte || 'Ignota',
                giorni: c.data?.giorniSopravvissuto || 0,
                data: c.data?.giornoMorte ? `${c.data.giornoMorte}° Giorno` : 'Data ignota'
            }));

            // Filtro per giocatori: vedono solo i propri. Il Master vede tutti.
            if (user && user.role !== 'master') {
                cimiteroArray = cimiteroArray.filter(m => m.user_id === user.id);
            }

            window.cimitero = cimiteroArray;
        }
    } catch (e) { /* fallback su cache locale */ }

    if (cimiteroArray.length === 0) {
        lista.innerHTML = `<div style="color:#666; font-style:italic; padding:10px; text-align:center;">Il cimitero è vuoto. La fortuna assiste il party.</div>`;
        return;
    }

    lista.innerHTML = cimiteroArray.map(m => {
        const nome = (m.nome || 'Sconosciuto').toUpperCase();
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        const puoEliminare = user && (user.role === 'master' || user.id === m.user_id);
        return `
        <div class="morto-entry" style="background:#1a1a1a; padding:8px; margin-bottom:6px; border-left:3px solid #ff4444; border-radius:3px; text-align:left;">
            <b style="color:#ff4444;">💀 ${nome}</b><br>
            <small style="color:#aaa;">Di: ${m.ownerUsername}</small><br>
            <small style="color:#ccc;">Causa: ${m.causa}</small><br>
            <small style="color:#888;">Decesso: ${m.data} (Sopravvissuto ${m.giorni} giorni)</small>
            ${puoEliminare ? `<div style="margin-top:6px;"><button onclick="eliminaDefinitivamenteCaduto(${m.id}, '${nome.replace(/'/g, "\\'")}')" style="background:#c0392b !important; font-size:0.75rem; padding:4px 8px;">🗑️ ELIMINA</button></div>` : ''}
        </div>`;
    }).reverse().join("");
}

window.renderCimitero = renderCimitero;

function toggleCimitero() {
    const cim = document.getElementById('side-cimitero') || document.getElementById('modal-cimitero');
    const overlay = document.getElementById('overlay');
    if (!cim) return;
    if (cim.id === 'side-cimitero') {
        cim.classList.toggle('open');
        if (cim.classList.contains('open')) {
            overlay.style.display = 'block';
            renderCimitero();
        } else {
            overlay.style.display = 'none';
        }
    }
}

function chiudiCimitero() {
    const cim = document.getElementById('side-cimitero') || document.getElementById('modal-cimitero');
    const overlay = document.getElementById('overlay');
    if (!cim) return;
    if (cim.id === 'side-cimitero') {
        cim.classList.remove('open');
        overlay.style.display = 'none';
    } else {
        cim.style.display = 'none';
        overlay.style.display = 'none';
    }
}

async function eliminaDefinitivamenteCaduto(id, nome) {
    if (!confirm(`Eliminare definitivamente "${nome}"? Azione irreversibile.`)) return;
    try {
        const res = await fetch(window.apiUrl(`/api/personaggi/${id}`), {
            method: 'DELETE',
            headers: window.buildAuthHeaders()
        });
        if (!res.ok) throw new Error('Errore eliminazione');
        localStorage.removeItem(`personaggio_${encodeURIComponent(nome)}`);
        if (window.cimitero) {
            window.cimitero = window.cimitero.filter(m => m.id !== id);
        }
        window.mostraNotificaInAlto?.(`${nome} rimosso dal cimitero.`, 'successo');
        renderCimitero();
        // Aggiorna anche la lobby
        if (typeof window.renderCharacterList === 'function') window.renderCharacterList();
    } catch (e) {
        alert('Errore: ' + e.message);
    }
}

window.eliminaDefinitivamenteCaduto = eliminaDefinitivamenteCaduto;
window.toggleCimitero = toggleCimitero;
window.chiudiCimitero = chiudiCimitero;