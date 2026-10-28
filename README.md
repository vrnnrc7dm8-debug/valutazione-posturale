# Valutazione Posturale

Mini web app clinica per la **valutazione posturale statica fotografica**, con interpretazione miofasciale rule-based basata sui meridiani di Thomas Myers.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- Componenti UI in stile shadcn (Radix UI)
- Persistenza SQLite e file sul Lexar tramite backend Python locale
- Istruzioni operative e sicurezza: [backend/README.md](backend/README.md)

## Avvio

Seguire [backend/README.md](backend/README.md) per configurare `.env` e avviare entrambi i processi locali (`npm run backend` e `npm run dev`). Nessun database viene creato automaticamente.

Build produzione: `npm run build`

## Funzionalità

1. **Dashboard paziente** — anagrafica, data valutazione, operatore, note
2. **Upload fotografie** — 5 piani anatomici con preview, note e **annotazione landmark** (linee e angoli)
3. **Analisi biomeccanica** — alterazioni per piano con descrittori (Tilt, Bend, Shift, ecc.)
4. **Motore miofasciale** — scoring rule-based → meridiani Myers con severità e tessuti
5. **Report clinico** — scheda ipotesi funzionale (non diagnosi medica)
6. **Export** — JSON completo e report testuale

## Architettura

```
src/
├── data/
│   ├── myofascialLines.ts      # Definizione linee e tessuti
│   └── posturalAlterations.ts  # Alterazioni per piano
├── types/index.ts
├── utils/
│   ├── analysisEngine.ts       # Motore rule-based
│   ├── geometry.ts             # Coordinate immagine, angoli
│   ├── storage.ts              # idratazione e creazione valutazioni
│   └── export.ts
└── components/
    ├── PhotoAnnotationEditor.tsx  # Landmark, linee, angoli
    └── ...
```

### Annotazione fotografica

Dopo il caricamento, clicca **Annota** su ogni foto:

| Strumento | Uso |
|-----------|-----|
| **Landmark** | Acromion, ASIS, PSIS, trocantere, ginocchio, malleolo, processo mastoideo (con lato DX/SX) |
| **Linea** | Collega due landmark |
| **Angolo** | Tre landmark: braccio → vertice → braccio (valore in gradi) |
| **Sposta** | Trascina i landmark e le linee di riferimento (rossa/cyan) |
| **Pan** | Sposta la vista · rotella del mouse per zoom |
| **Elimina** | Rimuove landmark e misure collegate |

**Overlay biomeccanico:** griglia, linea verticale gravitazionale (rossa), linea orizzontale di riferimento (cyan), snapping opzionale su griglia/riferimenti/landmark.

**Prima/dopo:** pulsante *Salva prima* crea uno snapshot; *Confronta* mostra le due foto affiancate con tabella degli spostamenti landmark.

Le annotazioni si salvano automaticamente (debounce ~350 ms) sul Lexar tramite backend locale.

## Estensioni future

Struttura pronta per integrazione con:

- GitHub / backend API
- Estensioni dello schema SQLite previa migrazione esplicita
- Baropodometria, stabilometria, gait analysis
- Profilo di personalità e correlazioni psicocorporee

## Disclaimer

L'output è presentato come **ipotesi funzionale posturale e miofasciale**. Non costituisce diagnosi medica.

## Copia e incolla delle fotografie

Nella scheda **Fotografie**, selezionare un piano cliccando il titolo o la sua scheda: il bordo evidenziato e l'indicazione “Piano selezionato” mostrano la destinazione. **Incolla foto** seleziona esplicitamente il piano del pulsante. Command+V e Ctrl+V usano il normale evento di incolla del browser; senza piano selezionato non viene assegnata alcuna immagine.

Sono accettati **JPEG/JPG**, PNG, WebP e GIF. BMP/TIFF vengono convertiti in PNG se il browser riesce a decodificarli; HEIC/HEIF devono essere convertiti in JPEG o PNG tramite Anteprima. La validazione verifica firma, decodifica e dimensioni reali: massimo 20 MB, 40 megapixel e 16384 pixel per lato. Una foto incollata in JPEG mantiene il contenuto JPEG. La foto appare nell'anteprima e segue lo stesso percorso di salvataggio e annotazione di **Carica**. La sostituzione richiede conferma e azzera landmark, calibrazione e snapshot della foto sostituita; le note del piano e le revisioni già archiviate restano conservate.

**Copia foto**, Command+C e Ctrl+C scrivono l'immagine reale in PNG negli Appunti del sistema, senza nomi o percorsi. La conversione in PNG serve solo alla copia; la fotografia archiviata resta nel proprio formato. Il messaggio di successo appare soltanto dopo la conferma della Clipboard API. Campi di testo, note, selezione testuale da copiare, menu, modali e l'editor dei landmark conservano i propri comandi nativi. Le scorciatoie dell'app operano nella scheda Fotografie, senza intercettare i comandi di altre sezioni.

L'incolla usa prima i file immagine del normale evento `paste`: `clipboardData.items` (primo `image/*` leggibile) e poi `clipboardData.files`. Se non trova un'immagine prova `navigator.clipboard.read()` e tutte le rappresentazioni immagine disponibili, preferendo PNG e JPEG e passando al MIME successivo quando `getType()` fallisce o restituisce un Blob vuoto. Non usa `readText()`, non legge percorsi Finder e non scarica URL presenti negli Appunti.

In Safari, pulsante e scorciatoie avviano la lettura API nello stesso gesto dell'utente. Le scorciatoie non annullano il comando nativo: una breve finestra dà precedenza al file del successivo evento `paste`, e una sola richiesta coordina i due percorsi per evitare doppi caricamenti. Se Safari mostra il menu di autorizzazione **Incolla**, confermare quel comando. Se la lettura programmatica non restituisce una foto, compare una piccola area **Incolla qui**, focalizzata per ricevere l'incolla nativo con Command+V o Modifica → Incolla. Questa area gestisce esclusivamente gli eventi di incolla fotografico; input, note, altri contenteditable ed editor mantengono i comandi propri.

Questi percorsi supportano le immagini trasferite da iPhone con Appunti universali e quelle copiate da Foto, Anteprima e altre applicazioni, quando Safari ne espone i dati immagine. L'app non attribuisce un errore di lettura al sistema Apple: segnala il contenuto effettivamente non rilevato, il permesso negato oppure l'eventuale formato/dimensione non valido. Riferimento per i vincoli di gesto e autorizzazione Safari: [WebKit, Async Clipboard API](https://webkit.org/blog/10855/async-clipboard-api/).

La verifica automatica simula eventi Safari, API e decodifica: non legge gli Appunti personali né usa dati clinici. Non sostituisce una prova dal vivo del trasferimento da uno specifico iPhone a Safari.

Test specifici: `npx vitest run src/components/__tests__/photoClipboard.test.ts`. `jsdom` è una dipendenza esclusivamente di sviluppo per eseguire i test del componente.

## Generazione del report e aggiornamento delle misure

Il comando **Genera report** lavora sulla valutazione corrente e pubblica il risultato sia nello stato React sia nel riferimento usato da salvataggio ed export, prima di attendere il Lexar. Il difetto corretto lasciava `assessment.report` nullo nella vista e nel riferimento corrente, pur passando il risultato del motore alla persistenza: per questo compariva ancora “Genera il report…” e un successivo flush poteva salvare nuovamente un report nullo.

Durante l'elaborazione è mostrato uno stato di caricamento. Un errore del motore compare nella scheda Report, conserva i dati e l'eventuale report precedente, e permette di riprovare. Un errore di archiviazione mantiene il report calcolato visibile in memoria e offre il normale **Riprova salvataggio**. Il motore e i test non richiedono accesso a un archivio clinico reale.

Il report comprende sempre i cinque piani. Per ogni piano distingue fotografia presente/assente, landmark validati disponibili, misure registrate, misure e indici geometrici derivati e ipotesi interpretative Myers/tessuti. Proposte landmark non confermate, punti non finiti o fuori immagine e riferimenti di annotazioni mancanti non diventano misure definitive. Fotografie o misure assenti sono dichiarate tali; non si deduce normalità dalla mancanza di dati. Linee e angoli annotati sono riportati usando la stessa geometria dell'editor, identificandoli come indici su coordinate normalizzate. I valori registrati, il BMI e gli eventuali parametri calibrati conservano le proprie unità e limitazioni.

Ogni modifica degli input incrementa `inputRevision`; il report memorizza `sourceRevision` e `generatedAt`. **Rigenera report** ricalcola dalle misure aggiornate. Fino alla rigenerazione, il report precedente rimane visibile e riconoscibile; l'export testuale e ZIP sono bloccati per evitare di mescolare un report precedente con annotazioni recenti. L'export JSON completo resta disponibile per conservare i dati e le revisioni. I report precedenti privi di questi metadati restano leggibili.

Vista, testo, ZIP e documento JSON archiviato usano lo stesso report. Il salvataggio conserva lo snapshot antropometrico del report già generato: modificare le misure correnti non lo riscrive silenziosamente. Le versioni dei file sul Lexar continuano a usare il sistema di revisioni esistente; non sono state aggiunte migrazioni o eliminazioni.

Regressioni: `src/components/__tests__/generateReport.test.ts` riproduce il problema del pulsante con 5 foto/67 landmark/29 alterazioni sintetiche e verifica visualizzazione, errori, caricamento, rigenerazione e salvataggi concorrenti. `src/utils/__tests__/reportGeneration.test.ts` copre completezza, dati mancanti, validazione e coerenza con API/testo/ZIP. Il backend verifica l'archiviazione e la riapertura del report usando solo un database temporaneo. Non è stata eseguita una prova reale in Safari né sono stati letti o modificati dati del paziente sul Lexar durante questa correzione.

File interessati dalla correzione del report:

- Interfaccia: `src/App.tsx`, `src/components/ClinicalReport.tsx`, `src/components/SummarySidebar.tsx`.
- Calcolo e modello: `src/utils/reportGeneration.ts`, `src/utils/analysisEngine.ts`, `src/utils/anthropometry.ts`, `src/types/index.ts`.
- Persistenza ed export: `src/storage/clinicalStorage.ts`, `src/utils/storage.ts`, `src/utils/export.ts`, `src/utils/patientExport.ts`, `src/utils/patientImport.ts`, `backend/server.py`.
- Regressioni sintetiche: `src/testFixtures/reportAssessment.ts`, `src/components/__tests__/generateReport.test.ts`, `src/utils/__tests__/reportGeneration.test.ts`, `backend/test_anthropometry.py`.
- Documentazione: `README.md`.

## Verifica integrata del 26 ottobre 2026 e uso dell’archivio

Il progetto usa React 19/TypeScript, Vite e un backend Python standard library con SQLite. Il frontend comunica soltanto con `/api`; Python ascolta su `127.0.0.1`. Il percorso clinico resta nelle variabili d’ambiente del backend. Non sono stati aggiunti archivi clinici nel browser né migrazioni automatiche.

Cause riscontrate e interventi:

- L’archivio precedente era una ricerca essenziale e l’API era limitata a 200 risultati. Ora **Archivio pazienti**, sempre visibile, carica l’elenco paginato, consente ricerca, scheda, storico e apertura esplicita della valutazione. Aprire una scheda senza modifiche non scrive nuove revisioni.
- L’importatore accettava un file ZIP, mentre il materiale da recuperare è una cartella. Il formato è `patient_export_v1`: manifest e 20 file dichiarati presenti, cinque JPEG, cinque documenti di annotazione, 67 landmark e 29 alterazioni. Il pacchetto non contiene report né calibrazioni: non vengono inventati. Sono presenti dati antropometrici. L’originale è stato esaminato in sola lettura e non importato nel database operativo.
- L’importatore non ripristinava la calibrazione e alcuni metadati dell’assessment, e poteva costruire un report non presente. Ora cartella e ZIP condividono lo stesso parser, conservano i documenti originali come allegati, recuperano i campi disponibili e mantengono nullo un report assente. Il pacchetto con report generato supera il confronto esportazione/importazione.
- L’importazione precedente non aveva conferma transazionale dei duplicati. L’anteprima non scrive dati; confermando un codice esistente si aggiunge una valutazione distinta. Non si sostituisce l’anagrafica centrale. Una modifica concorrente dell’archivio invalida l’anteprima e richiede di ripeterla.
- Lo snapshot riaperto veniva integrato con dati anagrafici correnti, comprese le note: ora conserva i dati clinici storici. Le fotografie non sono duplicate nel JSON attraverso alias base64. Allegati originali e revisioni sono salvati sotto il codice clinico. File mancanti producono errori espliciti; report su file e snapshot devono essere coerenti.
- La precedente correzione del report pubblica il risultato nello stato e nel riferimento corrente prima della persistenza; ora è stata esercitata anche con frontend/backend reali e WebKit, oltre alle regressioni complete con cinque foto, 67 landmark e 29 alterazioni sintetiche.
- Il backend operativo ancora attivo rispondeva con il comportamento precedente, senza il nuovo health check. Il launcher ora confronta l’impronta del codice Python con quella del processo, avvisa di salvare le modifiche prima del riavvio e interrompe soltanto un backend riconosciuto come appartenente al progetto. Rifiuta porte occupate da altri progetti. Non è stato riavviato il processo operativo durante le prove.

### Prova dalla Scrivania

1. Collega il Lexar. Se hai una scheda aperta con modifiche non salvate, risolvi il salvataggio oppure esporta il JSON prima di riavviare.
2. Fai doppio clic su **Valutazione Posturale** sulla Scrivania. Se compare l’avviso della versione aggiornata, premi **Riavvia** dopo aver salvato. Il collegamento esistente richiama già `avvia-app.sh`; non occorre ricrearlo.
3. Safari apre `http://127.0.0.1:5173`. Se una pagina era già aperta, ricaricala; cerca il codice nell’**Archivio pazienti**, seleziona la persona e poi **Apri valutazione …** nello storico.
4. Per recuperare l’esportazione usa **Importa cartella paziente** e scegli la cartella completa in Downloads. Controlla l’anteprima e conferma soltanto quando desideri scrivere sul Lexar. Se il browser non consente la selezione della cartella, comprimi la cartella nel Finder e usa **Importa paziente (ZIP)**. In caso di codice presente verrà aggiunta una valutazione; il precedente contenuto resta conservato.
5. Nelle schede Fotografie e Analisi controlla i dati, poi premi **Genera report**. Se compare un errore di salvataggio, i dati restano in memoria: collega il disco e usa **Riprova salvataggio** prima di chiudere. Una chiusura con modifiche ancora non salvate attiva l’avviso del browser.

### Prove riproducibili e limiti

- `npm test`: 122 test superati, incluse regressioni di report, importazione, antropometria, annotazioni e clipboard.
- `npm run test:backend`: 21 test superati con database temporanei e server localhost, inclusi paginazione oltre 200 pazienti, duplicati, conflitti di anteprima, documenti mancanti, riapertura storica e integrità del report.
- `npm run build`: superata; rimane l’avviso non bloccante sul bundle oltre 500 kB.
- `npm run lint`: eseguito sull’intero progetto; restano 23 errori e 6 avvisi preesistenti in editor, hook e utility. ESLint mirato ai file TypeScript modificati in questa integrazione passa senza errori o avvisi. Non sono state disattivate regole per nascondere problemi.
- `POSTURAL_E2E_ROOT=/Volumes/Lexar/.postural-e2e-20261026 npm run test:e2e`: quattro prove in WebKit con frontend Vite su 5174 e backend su 8766, entrambi realmente avviati. Il database `synthetic.db`, le fotografie sintetiche e i report sono fisicamente nella cartella isolata indicata sul Lexar, separata dall’archivio clinico. La cartella porta il marcatore `.synthetic-tests-only`. Senza variabile si usa soltanto una fixture sintetica sotto `/private/tmp/.postural-e2e-local`; questo percorso è esclusivamente del test server, mai un fallback dell’applicazione.
- Il flusso principale crea un paziente dall’interfaccia, carica cinque immagini, inserisce un landmark nell’editor, genera il report, scarica il testo e lo ZIP, ricarica la pagina, ricerca e riapre la valutazione, importa ZIP e cartella con anteprima/annullamento/conferma e confronta immagini, landmark, misure, note e report. Le valutazioni originali restano presenti e il paziente non si duplica. Le altre prove controllano errore API/riprova, volume indisponibile/salvataggio successivo e fotografia mancante senza sostituzione della valutazione.
- La disconnessione viene simulata **solo nel server di test**, cambiando il volume atteso: non è stato smontato il Lexar reale. Non è una prova di distacco fisico durante una scrittura.
- WebKit automatico non equivale all’app Safari fisica. Restano manuali la prova del collegamento sulla Scrivania e dei suoi dialoghi macOS, il trasferimento reale iPhone → Safari e la conferma dell’importazione clinica. Nessun paziente reale è stato usato nei test. Hash del database operativo e dell’intera cartella originale invariati al termine della verifica.

File modificati o aggiunti in questa integrazione:

- Interfaccia: `src/App.tsx`, `src/components/PatientArchive.tsx`, `src/components/PatientImport.tsx` (nuovo).
- Modello e persistenza: `src/types/index.ts`, `src/storage/clinicalStorage.ts`, `src/utils/storage.ts`, `backend/server.py`.
- Import/export: `src/utils/patientImport.ts`, `src/utils/patientExport.ts`, `src/utils/zipContents.ts`.
- Test: `src/components/__tests__/generateReport.test.ts`, `src/utils/__tests__/patientImport.test.ts` (nuovo), `backend/test_archive.py`, `backend/test_http.py`, `e2e/serve_backend.py` e `e2e/clinical-flow.spec.ts` (nuovi).
- Avvio, strumenti e documentazione: `avvia-app.sh`, `vite.config.ts`, `playwright.config.ts` (nuovo), `package.json`, `package-lock.json`, `.gitignore`, `README.md`.

## Report con fotografie annotate

**Genera report / Rigenera report** include ora, per ogni piano con fotografia, la versione annotata con landmark clinicamente utilizzabili numerati, legenda, griglia e riferimenti grafici attivi, linee e angoli dell’editor. Il nome del piano precede la fotografia e il testo clinico segue la figura, conservando le distinzioni tra misure, alterazioni e ipotesi. La foto intera mantiene le proporzioni originali; pan/zoom dell’editor non ritagliano il documento. I dati antropometrici e gli elementi anagrafici essenziali restano nella parte iniziale.

Il rendering riutilizza `FrameOverlaySvg`, `ImageAnnotationsSvg`, i colori del catalogo e il filtro `getClinicalLandmarks`: proposte non confermate o coordinate non valide non diventano punti definitivi nel report. La numerazione e la legenda identificano i punti senza sovrapporre nomi lunghi sulla fotografia.

Il JSON del report contiene `photographs`, una copia isolata di foto/annotazioni/calibrazione alla generazione. Una successiva modifica di foto o landmark conserva il report precedente finché non viene rigenerato. Sul Lexar, il backend salva questo snapshot nel consueto documento `pazienti/<Codice_Clinico>/report/<chiave>-<revisione>.json` e nel documento della valutazione. Le immagini vengono referenziate attraverso `archivePhoto` verso i file immutabili già presenti in `pazienti/<Codice_Clinico>/foto/`. Le sovrapposizioni SVG vengono ricostruite alla visualizzazione/esportazione: non viene scritto un nuovo JPEG/PNG annotato e non si modifica l’originale. Se la foto coincide con quella corrente, anche la richiesta API ne trasferisce i byte una sola volta, risolvendo il riferimento prima dell’archiviazione.

I report precedenti privi di `photographs` sono compatibili: se aggiornati rispetto alla valutazione, le figure sono ricostruite dalle foto archiviate. Per congelare esplicitamente le figure nel report basta rigenerarlo. Quando un vecchio report è segnalato come non aggiornato, non si aggiungono fotografie correnti a un testo precedente.

Il nuovo pulsante **Esporta report con foto (HTML)** produce un documento autonomo con fotografie incorporate come data URI e sovrapposizioni SVG, senza script, librerie, font remoti o percorsi locali. Le fotografie vengono decodificate prima dell’export; un errore blocca lo scaricamento con un messaggio visibile. Report mancanti o non aggiornati richiedono generazione/rigenerazione. Il testo semplice resta disponibile tramite il pulsante esistente; JSON e ZIP conservano i dati fotografici del report.

Apri l’HTML in Safari per leggerlo anche offline. Per ottenere un PDF usa **File → Stampa → PDF → Salva come PDF**: il layout include margini A4, separazione dei piani e regole per evitare la divisione delle figure. Non è stato introdotto un generatore PDF diretto; il salvataggio PDF del dialogo macOS resta da provare manualmente.

Verifiche per questa modifica:

- 126 test frontend, con nuove regressioni su snapshot isolati, figure dei cinque piani, 67 landmark sintetici, immagini incorporate, report precedenti, dati mancanti ed errori di decodifica/export.
- 23 test backend, compresi conservazione della fotografia storica del report quando cambia quella corrente, riapertura e risoluzione sicura dei riferimenti delle richieste. Nessuna migrazione SQLite.
- Quattro prove WebKit con frontend/backend reali e archivio sintetico separato sul Lexar. Il flusso completo riapre una valutazione salvata, verifica le figure, scarica l’HTML e lo visualizza con le richieste HTTP/HTTPS bloccate; le cinque immagini JPEG/PNG decodificano e i landmark sono presenti. È stata ispezionata visivamente la figura esportata. Il confronto ZIP/importazione conserva anche le fotografie del report.
- Build superata, con il consueto avviso sul peso del bundle; lint mirato ai file modificati superato. Safari fisico, stampa PDF macOS e dati clinici operativi non sono stati usati per i test.

File modificati/aggiunti: `src/App.tsx`, `src/components/ClinicalReport.tsx`, `src/components/ReportPhotograph.tsx` (nuovo), `src/types/index.ts`, `src/utils/reportGeneration.ts`, `src/utils/reportHtml.tsx` (nuovo), `src/storage/clinicalStorage.ts`, `backend/server.py`, `src/utils/__tests__/reportPhotographs.test.ts` (nuovo), `src/utils/__tests__/reportGeneration.test.ts`, `backend/test_archive.py`, `e2e/clinical-flow.spec.ts`, `README.md`.

## Navigazione compatta, revisioni e gestione pazienti

La schermata iniziale è **Archivio**. Le cinque schede superiori (Archivio, Paziente, Fotografie, Analisi, Report) mostrano una sola area principale alla volta. L’archivio non resta sopra la valutazione. Una barra persistente indica codice clinico, paziente, ID e data della valutazione aperta, caricamento, modifiche da salvare, salvataggio in corso oppure errore. **Chiudi valutazione** torna all’archivio senza cancellare dati. I pannelli clinici non sono accessibili senza un’apertura esplicita o il comando di nuova valutazione.

L’elenco riporta numero di valutazioni, data più recente e contenuti aggregati. Selezionare il paziente mostra lo storico; ogni valutazione riporta foto, landmark, alterazioni e presenza del report. L’apertura avviene scegliendo un ID preciso. Non si sceglie automaticamente una valutazione solo perché è l’ultima inserita. Gli omonimi restano distinti per codice e vengono segnalati anche quando occupano pagine diverse dell’elenco.

Diagnosi del caricamento: l’interfaccia precedente apriva inizialmente una scheda nuova e vuota, mentre selezionare un paziente caricava soltanto lo storico. Mancavano ID della valutazione e riepilogo dei contenuti. Inoltre l’API non consentiva di aprire le revisioni precedenti conservate nei file: una revisione effettivamente vuota e una completa erano difficili da distinguere. Per il record richiesto è stata eseguita una diagnosi con connessione SQLite forzata in sola lettura: i tre documenti correnti risultano associati correttamente e contengono tutti cinque foto, 67 landmark e 29 alterazioni; due contengono anche il report. Non è stata rilevata perdita dei file correnti né è stata effettuata una riparazione del database reale. Questi numeri non sostituiscono una prova interattiva sul paziente reale in Safari.

Il caricamento verifica codice paziente, chiave della valutazione, ID selezionato, snapshot, fotografie e documento del report. Una risposta API incompleta non viene più trasformata tramite idratazione in una scheda vuota con un nuovo codice. Errori di associazione o file mancanti rimangono visibili senza sostituire la valutazione aperta. Una singola associazione non verificabile non deve nascondere l’intero elenco pazienti.

**Revisioni conservate della valutazione …** mostra le revisioni JSON presenti sul Lexar con relativi contenuti, data e indicazione della versione attualmente indicizzata. Le precedenti si aprono in sola lettura con i propri dati antropometrici; non vengono mescolati dati di revisioni diverse né sostituiti automaticamente gli indici SQLite. **Crea copia modificabile della revisione** richiede conferma, mantiene lo stesso paziente e crea una nuova chiave di valutazione. Foto, landmark, alterazioni, note e report originali rimangono conservati.

### Gestione paziente

Dal paziente selezionato usa **Gestisci paziente**. Se è aperta una sua valutazione, chiudila prima di gestirlo.

- **Archivia** nasconde dall’elenco attivo senza modificare tabelle o cancellare dati. **Pazienti archiviati → Gestisci paziente → Ripristina** lo rende di nuovo visibile. Lo stato è memorizzato in eventi locali append-only sotto `pazienti/.patient-status/<codice>/`, sul volume configurato. Le valutazioni di un paziente archiviato si possono consultare in sola lettura.
- **Prepara backup e verifica eliminazione** crea una copia SQLite e una copia della cartella del paziente in `pazienti/.verified-backups/<identificativo>/`. Prima di dichiararla verificata confronta il contenuto logico SQLite, esegue `integrity_check` e confronta SHA-256 di ogni file clinico. L’operazione può richiedere tempo e spazio sul Lexar, perché il backup SQLite comprende l’intero database.
- **Elimina definitivamente** compare solo dopo la verifica e richiede di digitare `ELIMINA <codice completo>`. Ricontrolla backup, stato dei dati, associazioni e dipendenze in una transazione. Rimuove dall’indice SQLite il paziente e le valutazioni/righe antropometriche espressamente verificate, senza affidarsi a cascata implicita. Dipendenze cliniche ulteriori o non gestite bloccano l’eliminazione e consentono invece Archivia. **I file originali non vengono fisicamente rimossi** e il backup resta sul Lexar: il comando non è una cancellazione sicura del supporto né una procedura di anonimizzazione.
- Nessun paziente reale è stato archiviato, fuso o eliminato durante lo sviluppo. Non sono state aggiunte tabelle o colonne. L’hash del database operativo è stato confrontato prima/dopo ed è invariato.

La creazione automatica non salva il nuovo profilo mentre nome/cognome sono ancora incompleti, evitando record intermedi. Un omonimo con altro codice blocca la prima creazione fino al confronto e alla conferma esplicita. L’anteprima di importazione mostra codice, numero di valutazioni, foto, landmark e presenza di report dei candidati; per un codice nuovo omonimo richiede una conferma specifica. Non si fondono automaticamente profili. Il ripristino dell’archiviazione non cambia il codice clinico.

I file AppleDouble `._…` e `.DS_Store`, prodotti da macOS sul Lexar, non vengono interpretati come eventi JSON o documenti clinici. Gli eventi hanno una sequenza temporale esplicita, indipendente dalla risoluzione delle date del filesystem.

### PDF scaricabile

**Scarica report PDF** genera direttamente un PDF A4 nel browser, con fotografie annotate realmente incorporate, numerazione dei landmark, legende, misure, testo clinico, dati essenziali, antropometria e numeri di pagina. Riutilizza lo stesso SVG del report, lo renderizza localmente e lo incorpora con [jsPDF](https://parallax.github.io/jsPDF/docs/module-addImage.html). Non invia dati clinici a servizi esterni. La libreria viene caricata solo su richiesta. Il nome proposto comprende la versione del report; la generazione/export non sovrascrive i documenti clinici sul Lexar. L’HTML autonomo e l’export testuale rimangono disponibili.

Il PDF è stato scaricato in WebKit tramite il pulsante dell’app: le cinque immagini vengono disegnate nel documento, con possibilità di condividere una risorsa interna quando due immagini sintetiche sono identiche. Non basta contare i soli oggetti immagine del PDF. È stato verificato anche un PDF sintetico completo di 20 pagine, renderizzato per controllo visivo, con tutti i cinque piani e 67 landmark. Non è stata eseguita una prova nell’app Safari fisica del Mac, né sul paziente reale.

### Verifiche e aggiornamento

- `npm test`: 128 test frontend superati.
- `npm run test:backend`: 31 test superati, compresi recupero completo dopo revisione vuota, codici incoerenti, dipendenze, backup modificato, omonimi, metadati macOS e avvio Python come script.
- `POSTURAL_E2E_ROOT=/Volumes/Lexar/.postural-e2e-20261026 npm run test:e2e`: sette prove WebKit superate con frontend/backend reali e soli dati sintetici. Coprono archivio → paziente → valutazione → fotografie → analisi → report → PDF; errori API e file mancanti; indisponibilità simulata del volume; archiviazione/ripristino; eliminazione dopo backup/conferma; recupero da una revisione con cinque piani, 67 landmark, 29 alterazioni e report, lasciando intatta la revisione indicizzata vuota.
- Build superata; rimane l’avviso sulla dimensione del bundle. Lint mirato ai file modificati superato. Il lint generale rimane con 23 errori e 6 avvisi preesistenti negli altri editor/hook/utility.
- Per aggiornare l’app: salva eventuali modifiche aperte, fai doppio clic sull’icona **Valutazione Posturale** della Scrivania e accetta **Riavvia**. Il launcher ora confronta anche l’impronta dei moduli backend aggiuntivi. Ricarica Safari e scegli il paziente e l’ID della valutazione dall’Archivio. Per provare il report già presente non è necessario rigenerarlo.

File modificati/aggiunti in questa integrazione:

- Interfaccia: `src/App.tsx`, `src/components/PatientArchive.tsx`, `src/components/PatientImport.tsx`, `src/components/ClinicalReport.tsx`, `src/components/TissueAnalysisPreview.tsx` (chiavi React distinte, nessuna modifica dei risultati clinici).
- Modello/persistenza: `src/types/index.ts`, `src/utils/storage.ts`, `src/storage/clinicalStorage.ts`, `backend/server.py`, `backend/patient_management.py` (nuovo).
- PDF: `src/utils/reportPdf.ts` (nuovo), `package.json`, `package-lock.json`.
- Test: `src/storage/__tests__/clinicalStorage.test.ts`, `src/utils/__tests__/reportPdf.test.ts` (nuovo), `backend/test_patient_management.py` (nuovo), `e2e/clinical-flow.spec.ts`.
- Avvio/documentazione: `avvia-app.sh`, `README.md`.
