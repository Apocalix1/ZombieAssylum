# Zombie Asylum Gestionale

## Avviare il backend + frontend

1. Apri un terminale nella cartella `server`:
   ```bash
   cd /home/pangatto05/zombieassylum/server
   npm install
   npm start
   ```
2. Apri il browser su:
   ```text
   http://localhost:4000
   ```

Ora il server Node/Express serve sia le API che il frontend.

## Se vuoi usare il frontend e il backend in processi separati

Puoi comunque farlo, ma il modo più semplice è usare il backend come server unico.

- backend: `http://localhost:4000`
- frontend: `http://localhost:4000`

Questa configurazione evita problemi di porta e permette al client di chiamare le API sullo stesso host.

## Architettura dati e sincronizzazione

- Il progetto utilizza un database SQLite locale (`server/zombieasylum.db`) nel backend Express.
- Al momento non è necessario Firebase: l'app usa un backend Node/Express + SQLite per il database e la logica di sincronizzazione.
- Il client mantiene una copia locale del personaggio nel `localStorage` del browser quando è offline.
- Quando il client è online, prova a sincronizzare i personaggi con il backend REST su `http://localhost:4000/api/personaggi`.
- L'API REST supporta:
  - `GET /api/personaggi/:nome`
  - `POST /api/personaggi`
  - `GET /api/characters` e `POST /api/characters`

## Note

- Se non hai Python installato, puoi usare anche un server alternativo come `npx serve client`.
- Il database SQLite viene aggiornato automaticamente all'avvio se manca la colonna `data` o `updated_at`.

## Collegare il telefono senza essere sulla stessa rete

Se vuoi provare il sito dal telefono quando non è sulla stessa rete del computer di sviluppo, puoi esporre temporaneamente il server usando uno dei seguenti strumenti.

- ngrok (consigliato):

```bash
# installa (se non già presente)
# https://ngrok.com/ è necessario creare un account e configurare l'authtoken
ngrok http 4000   # esponi il server Node/Express che serve frontend e API
```

ngrok mostrerà un indirizzo pubblico del tipo `https://abcd1234.ngrok.io` che puoi aprire dal telefono.

- localtunnel (semplice, senza account):

```bash
# esponi la porta del backend
npx localtunnel --port 4000 --subdomain zombieasylum-backend
# esponi la porta del client
npx localtunnel --port 5500 --subdomain zombieasylum-client
```

Localtunnel restituisce un URL pubblico che puoi usare dal telefono. Nota: subdomain libero potrebbe non essere disponibile.

Sicurezza e consigli:
- Questi tunnel sono temporanei e non pensati per produzione. Non esporre dati sensibili.
- Se il telefono non riesce a raggiungere il backend, usa lo stesso host pubblico per client e backend o aggiorna la costante `SERVER_URL` nel file `client/src/logic/logic.js` con l'URL pubblico del backend.

