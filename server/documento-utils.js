const CARATTERI_CRIPTATI = ['⌧', '⌊', '⊗', '∇', '▮', '⌕', '⌰', '⌫', '⍑', '⍃', '⍓'];

export function generaTestoCriptato(testoOriginale = '') {
  return String(testoOriginale)
    .split(' ')
    .map((parola) => parola
      .split('')
      .map(() => CARATTERI_CRIPTATI[Math.floor(Math.random() * CARATTERI_CRIPTATI.length)])
      .join(''))
    .join(' ');
}

export function creaContenutoDocumento({ lingua, testo }) {
  return JSON.stringify({
    lingua_richiesta: lingua,
    testo_originale: testo,
    testo_criptato: generaTestoCriptato(testo)
  });
}
