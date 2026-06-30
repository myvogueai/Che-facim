# Che facim'? — Setup

Architettura: web app statica (HTML/CSS/JS puro, no framework) + Firebase
(Firestore per i dati, Auth **solo per l'admin**). L'app pubblica è anonima.

Riferimento completo: [ARCHITECTURE.md](ARCHITECTURE.md)

## 1. Crea il progetto Firebase

1. Vai su https://console.firebase.google.com → "Aggiungi progetto"
2. Nome progetto: es. `che-facim`
3. Disattiva Google Analytics se non ti serve (non necessario ora)

## 2. Attiva Firestore

1. Nel menu laterale → Build → Firestore Database → "Crea database"
2. Modalità: **produzione** (le regole sono in `firestore.rules`)
3. Region: scegli `eur3 (europe-west)` per latenza migliore in Italia

## 3. Attiva Authentication (solo per l'admin)

1. Menu laterale → Build → Authentication → "Inizia"
2. Abilita il provider **Email/Password**
3. Impostazioni → **Disabilita la registrazione pubblica** (solo account creati da Console)
4. Tab "Users" → "Aggiungi utente" → email e password sicure per l'admin
5. Copia l'**UID** dell'account appena creato (colonna User UID)

## 4. Autorizza l'admin su Firestore

Scegli **una** delle due opzioni (o entrambe):

### Opzione A — Whitelist UID (consigliata per il lancio)

1. Apri `firestore.rules`
2. Incolla l'UID admin nella funzione `adminUids()`:

   ```javascript
   function adminUids() {
     return [
       'abc123xyzUIDcopiatoDaConsole',
     ];
   }
   ```

3. Deploy rules (passo 5)

### Opzione B — Custom claim `admin: true`

Richiede Firebase Admin SDK (script locale una tantum):

```javascript
// set-admin-claim.js — eseguire una volta con service account
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert('./serviceAccount.json') });
await admin.auth().setCustomUserClaims('UID_ADMIN', { admin: true });
```

Dopo il claim, l'admin deve fare logout e login su `/admin/` per refreshare il token.

## 5. Recupera la configurazione client

1. Impostazioni progetto (icona ingranaggio) → "Le tue app" → icona web `</>`
2. Registra l'app (nome libero, es. "Che facim Web")
3. Copia l'oggetto `firebaseConfig`
4. Incollalo in `public/assets/firebase-config.js`

## 6. Pubblica regole e indici

```bash
firebase login
firebase deploy --only firestore:rules,firestore:indexes --project che-facim
```

Oppure dalla Console Firebase → Firestore → tab "Regole", incolla `firestore.rules`.

## 7. Deploy dell'app (hosting)

```bash
firebase deploy --only hosting --project che-facim
```

- App pubblica: `https://che-facim.web.app`
- Admin: `https://che-facim.web.app/admin/`

## 8. Primo test

1. Apri `/admin/`, accedi con l'account admin
2. Inserisci un evento di prova (coordinate: Google Maps → tasto destro → copia coordinate)
3. Apri la home `/` e verifica che l'evento appaia nella data corretta
4. Apri un evento, salva nei preferiti (cuore), controlla `/preferiti.html`

Se il CRUD admin fallisce con "permission denied", l'UID non è in whitelist e il custom claim non è impostato.

## Note operative

- **Locandine**: URL diretto nel campo immagine (Imgur, Firebase Storage, ecc.)
- **Contatti in About**: sostituisci `39XXXXXXXXXX` e `info@chefacim.it` in `about.html`
- **Credenziali admin**: non condividere pubblicamente; protezione aggiuntiva = rules Firestore (non solo URL `/admin/`)
- **Preferiti utente**: restano in `localStorage` (chiave `lucania_tonight_preferiti`), nessun dato su Firestore
- **Dominio personalizzato**: Hosting → "Aggiungi dominio personalizzato"
