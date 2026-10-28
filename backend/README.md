# Archivio clinico locale

## Avvio

Richiede Python 3.9+ e Node con le dipendenze già previste dal progetto.
Dalla cartella del progetto, in un primo terminale:

```sh
cp .env.example .env
chmod 600 .env
set -a
source .env
set +a
npm run backend
```

In un secondo terminale: `npm run dev`. Aprire http://127.0.0.1:5173.
`.env` è letto dalla shell del backend; non viene inviato al client. Non aggiungere prefissi `VITE_` alle configurazioni cliniche. Riavviare il backend dopo modifiche alla configurazione.

Il backend ascolta esclusivamente su 127.0.0.1:8765; Vite esclusivamente su 127.0.0.1:5173. Non usare `--host` per esporli sulla rete. La preview statica non offre le API: usare l'avvio sopra anche per la verifica locale.

## Persistenza

Nessun CREATE/ALTER/DROP sul database operativo. Connessione `mode=rw`, foreign keys abilitate, query parametrizzate, transazioni IMMEDIATE per le scritture. Lo schema viene verificato a ogni connessione. Il volume deve essere un mount attivo e database e archivio devono risiedervi. Non esiste un fallback sul Mac.

Codice clinico immutabile in interfaccia, generato come `PC-<UUID>` per nuovi pazienti. Un paziente può avere più valutazioni, individuate da una chiave UUID distinta. Nome, cognome, sesso e note vengono collegati alle colonne esistenti di Pazienti; età, operatore, calibrazioni e tutti gli altri campi dell'app rimangono nel documento completo della valutazione, senza inventare date di nascita. Gli altri campi anagrafici del database sono preservati.

In `pazienti/<Codice_Clinico>/`: `foto/`, `valutazioni/`, `report/`, `allegati/` (predisposta). Ogni salvataggio crea documenti immutabili con nomi generati dal server. Le fotografie identiche vengono riutilizzate per hash SHA-256, evitando copie a ogni modifica delle note. In Valutazioni_Posturali sono salvati il collegamento al paziente, landmark/annotazioni, analisi, percorsi delle quattro foto principali e report. Il quinto piano e le fotografie baseline sono conservati nel documento completo. Note contiene un riferimento con prefisso `POSTURAL_APP_V1:` alla revisione completa; i record preesistenti di altro formato restano intatti e vengono segnalati come non riapribili nell'editor attuale.

Un rollback conserva la revisione precedente. Un errore durante le scritture può lasciare file non referenziati sul Lexar; non vengono eliminati automaticamente. Nessuna API DELETE né cancellazione a cascata. Le versioni precedenti rimangono sul volume; dimensionare backup e spazio disponibile di conseguenza. Non modificare lo stesso archivio con altre applicazioni mentre questa è in uso.

L'app riapre una valutazione tramite Cerca / Elenca → paziente → valutazione. All'avvio non riapre automaticamente un paziente. Nessun nuovo dato clinico viene scritto in IndexedDB o localStorage. I vecchi archivi browser sono lasciati intatti: usare la precedente versione per esportarli esplicitamente in ZIP, quindi importarli nell'app collegata al Lexar. Conservare una copia del precedente archivio prima di ogni migrazione.

## Accesso e cifratura

Host e Origin sono verificati; le API richiedono un header non semplice, senza CORS, e una sessione HttpOnly SameSite=Strict di 8 ore. Le risposte sono no-store. Le richieste, gli identificativi e i contenuti clinici non sono registrati nei log. Per attivare la password locale, eseguire `python3 backend/password.py`, aggiungere la riga generata a `.env`, ricaricare l'ambiente e riavviare il backend. L'hash usa scrypt con salt casuale; la password viene chiesta nell'interfaccia e rimane solo in memoria. La modalità senza password è limitata al computer locale e non distingue gli utenti del Mac.

Questa base non implementa ruoli multiutente, audit clinico o SQLCipher. SQLite e i file attuali rimangono in chiaro sul volume: la password dell'app non li cifra. Per cifratura a riposo completa, usare un volume cifrato con chiavi custodite separatamente, oppure pianificare una migrazione esplicita a SQLCipher e cifratura dei file. Non convertire o formattare il Lexar senza un backup verificato. I permessi 0600/0700 sono applicati ove supportati dal filesystem del volume; su exFAT non costituiscono isolamento per utente. Gli export JSON/ZIP/testo esistenti restano espliciti e in chiaro: scegliere una destinazione protetta.

## Backup cifrato

È predisposto `backend/backup.py`, che richiede il programma `age` e una chiave pubblica del destinatario. Non esegue backup automatici e non usa servizi cloud. La chiave privata va custodita separatamente e verificata con una prova di ripristino.

1. Arrestare il backend e qualsiasi altro programma che scrive nell'archivio.
2. Caricare le variabili d'ambiente come sopra.
3. Eseguire `python3 backend/backup.py /percorso/protetto/backup.tar.age --recipient age1... --backend-stopped` su un supporto distinto.
4. Su un ambiente di prova protetto, decifrare con `age --decrypt -i /percorso/chiave backup.tar.age`, estrarre il tar e verificare SQLite (`PRAGMA integrity_check` e `PRAGMA foreign_key_check`) e la presenza dei file referenziati. Non ripristinare sul database operativo per provare il backup.

Lo script usa SQLite backup API e un archivio temporaneo sul volume esterno, poi cifra il flusso tar con age. Non sovrascrive backup esistenti. L'opzione `--backend-stopped` dichiara l'arresto effettuato dall'operatore; non è un lock verso altri programmi. Non è stato eseguito un backup dell'archivio reale durante lo sviluppo.

## Verifica

`npm run test:backend`: database e fotografie esclusivamente sintetici in cartelle temporanee. `npm test`: regressioni dei motori esistenti. `npm run build`: TypeScript e bundle. Non usare dati di pazienti reali per prove.

## Antropometria: migrazione esplicita con backup verificato

La funzione aggiunge **due tabelle**, senza ALTER delle tabelle cliniche esistenti e senza migrazioni automatiche all'avvio:

- `Profilo_Antropometrico`: una riga per paziente, peso/altezza correnti, data della misura, valutazione di origine e data di aggiornamento.
- `Antropometria_Valutazioni`: una riga per valutazione con peso, altezza, data, età e sesso registrati in quella visita. Il BMI è derivato dalle misure, senza arrotondare prima della classificazione.

Le chiavi esterne usano `ON DELETE RESTRICT`. Non vengono aggiunte API di eliminazione. Profilo, valutazione e snapshot sono salvati nella stessa transazione SQLite. Le misure sono incluse anche nei documenti e nei report sul Lexar. Lo snapshot relazionale è l'autorità alla riapertura: non viene ricostruito dalle misure attuali e, se manca nei record precedenti, rimane non disponibile. Non si attribuiscono retroattivamente misure alle vecchie valutazioni.

Le correzioni intenzionali alle misure di una valutazione modificano lo snapshot di quella valutazione, conservando le revisioni dei documenti sul Lexar. La sola riapertura non scrive dati. Il salvataggio di una valutazione più vecchia non sostituisce il profilo corrente: si confrontano data della misura e, a parità di giorno, identificativo della valutazione. Un aggiornamento esplicito di profilo via API non modifica alcuno snapshot. Nuove valutazioni dello stesso paziente partono dalle misure correnti, che vanno confermate o aggiornate per la nuova visita. L'età non viene inventata o ricavata dall'età di una visita passata.

### Attivazione sull'archivio operativo

**La migrazione non è stata eseguita sul database reale durante lo sviluppo.** Finché non viene attivata, le funzionalità precedenti restano disponibili; il salvataggio di nuovi dati antropometrici è bloccato con un errore esplicito. Non esiste un fallback di sola persistenza browser.

Arrestare il backend e gli altri programmi che usano l'archivio, caricare `.env` e poi eseguire, dalla cartella del progetto:

```sh
set -a
source .env
set +a
python3 backend/migrate_anthropometry.py \
  --backup-dir '/Volumes/Lexar/app valutazione posturale/backup/migrazioni' \
  --backend-stopped
```

Il comando acquisisce un lock contro gli altri scrittori, crea una copia con SQLite backup API, riapre la copia, esegue `integrity_check` e `foreign_key_check`, confronta hash dei contenuti logici tra sorgente e copia, scrive una ricevuta con hash del file e soltanto dopo aggiunge le due tabelle in una transazione. Un errore di verifica blocca ogni DDL; un errore DDL annulla le aggiunte. Una seconda esecuzione su uno schema già migrato non duplica dati o tabelle. Non vengono migrati i file fotografici, i report o i record clinici esistenti.

Il backup di migrazione è una copia SQLite **in chiaro**, sul volume clinico configurato, con permessi restrittivi ove supportati dal filesystem; non viene copiato sul Mac. La ricevuta certifica le verifiche del backup, non la disponibilità futura del supporto. Per protezione dalla perdita del Lexar e cifratura, usare anche il backup `age` su un secondo supporto protetto descritto sopra. Non cancellare il backup prima della verifica della nuova versione. Per ripristinare, arrestare l'app e provare prima il recupero su un archivio di prova; non sovrascrivere automaticamente il database operativo con il backup.

Riavviare il backend dopo l'attivazione. La scheda paziente indica se il backend segnala l'archivio antropometrico non attivo.

### Regole di inserimento e interpretazione

Peso 0,3–500 kg e altezza 20–260 cm sono limiti tecnici di plausibilità, non soglie diagnostiche. Virgola e punto decimale sono accettati; unità nel campo, separatori delle migliaia, notazione esponenziale, zero e numeri non finiti sono rifiutati. Dati mancanti o invalidi producono un trattino per il BMI. I valori invalidi non vengono inviati al backend. L'altezza antropometrica resta separata dai parametri di calibrazione fotografica e non cambia automaticamente landmark o misure già annotate.

La classificazione usa il BMI non arrotondato; il valore mostrato ha una cifra decimale italiana. Per adulti (età dichiarata ≥18 anni, secondo il requisito dell'app): sottopeso <18,5; normopeso ≥18,5 e <25; sovrappeso ≥25 e <30; obesità ≥30. Nei minori si richiedono riferimenti per età e sesso; con età ignota non si applicano soglie per adulti. Fonti: [OMS, soglie BMI negli adulti](https://apps.who.int/nutrition/landscape/help.aspx?helpid=420&menu=0) e [OMS, riferimenti pediatrici per età](https://www.who.int/en/news-room/fact-sheets/detail/obesity-and-overweight).

`npm test` copre calcolo, interfaccia con virgola, report, ZIP e contratto API. `npm run test:backend` include backup/migrazione, rollback, profilo, snapshot, riapertura storica e casi nello stesso giorno: tutti su database temporanei e pazienti sintetici.
