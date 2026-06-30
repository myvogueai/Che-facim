# Lucania Tonight — Setup

Architettura: web app statica (HTML/CSS/JS puro, no framework) + Firebase
(Firestore per i dati, Auth solo per l'admin). Stesso pattern del progetto
calcetto — niente backend da mantenere.

## 1. Crea il progetto Firebase

1. Vai su https://console.firebase.google.com → "Aggiungi progetto"
2. Nome progetto: es. `lucania-tonight` (genera l'ID automaticamente)
3. Disattiva Google Analytics se non ti serve (non necessario ora)

## 2. Attiva Firestore

1. Nel menu laterale → Build → Firestore Database → "Crea database"
2. Modalità: **produzione** (le regole sono già pronte in `firestore.rules`)
3. Region: scegli `eur3 (europe-west)` per latenza migliore in Italia

## 3. Attiva Authentication (solo per l'admin)

1. Menu laterale → Build → Authentication → "Inizia"
2. Abilita il provider **Email/Password**
3. Tab "Users" → "Aggiungi utente" → inserisci la tua email e una password
   sicura. Questo è l'UNICO account che potrà accedere al pannello admin.

## 4. Recupera la configurazione

1. Impostazioni progetto (icona ingranaggio) → "Le tue app" → icona web `</>`
2. Registra l'app (nome libero, es. "Lucania Tonight Web")
3. Copia l'oggetto `firebaseConfig` che ti mostra
4. Incollalo in `public/assets/firebase-config.js`, sostituendo i placeholder

## 5. Pubblica le regole di sicurezza

Con Firebase CLI installata (`npm install -g firebase-tools`):

```bash
firebase login
firebase init firestore   # collega il progetto, usa firestore.rules esistente
firebase deploy --only firestore:rules
```

Oppure, più semplice senza CLI: apri Firestore → tab "Regole" nella
Console, incolla il contenuto di `firestore.rules` e pubblica.

## 6. Deploy dell'app (hosting)

Stesso pattern del calcetto — Firebase Hosting:

```bash
firebase init hosting     # cartella pubblica: "public"
firebase deploy --only hosting
```

L'app sarà live su `https://TUO-PROGETTO.web.app`
Il pannello admin sarà su `https://TUO-PROGETTO.web.app/admin/`

## 7. Primo test

1. Apri `/admin/`, accedi con l'account creato al punto 3
2. Inserisci un evento di prova (coordinate: cerca il locale su Google
   Maps, tasto destro sul punto → le coordinate si copiano)
3. Apri la home `/` e verifica che l'evento appaia nella data corretta

## Note operative

- **Le immagini delle locandine**: per ora vanno inserite come URL diretto
  (es. carichi l'immagine su Imgur/Firebase Storage e incolli il link).
  Se vuoi upload diretto da telefono nel pannello admin, è un'aggiunta
  successiva (Firebase Storage + 20 righe di codice).
- **Whatsapp/email nella pagina About**: sostituisci `39XXXXXXXXXX` e
  `info@lucaniatonight.it` con i tuoi contatti reali in `about.html`.
- **Sicurezza admin**: solo l'account email/password creato al punto 3
  può scrivere eventi. Non condividere quelle credenziali pubblicamente.
- **Dominio personalizzato**: se in futuro compri un dominio (es.
  lucaniatonight.it), si collega da Hosting → "Aggiungi dominio
  personalizzato" in pochi click.
