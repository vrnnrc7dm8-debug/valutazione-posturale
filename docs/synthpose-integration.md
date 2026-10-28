# SynthPose locale sperimentale

## Scopo e limiti

Modello: **stanfordmimi/synthpose-vitpose-base-hf**.
Repository e scheda: https://huggingface.co/stanfordmimi/synthpose-vitpose-base-hf
API: https://huggingface.co/docs/transformers/model_doc/vitpose

La scelta segue la richiesta di un modello ViTPose con marker anatomici aggiuntivi:
52 punti anziché i soli 17 COCO. Produce coordinate e score; **non** produce diagnosi,
pattern clinici, inferenze Myers o stati muscolari. Gli score di heatmap sono indicatori
tecnici del modello, non probabilità di correttezza anatomica validate clinicamente.
Il backend limita gli score esposti come confidence all'intervallo 0–1.

Pipeline: foto → processor/ViTPose locali → 52 punti grezzi → adapter →
`autoProposals` → conferma/correzione manuale → landmark clinici → motori esistenti.
`clinicalPipeline.ts` e `myersEngine.ts` non sono modificati da questa integrazione.

Non è una verifica clinica di accuratezza, soprattutto in presenza di occlusioni,
abbigliamento, deformità, foto parziali o prospettive diverse dal training. Non
scambiare destra/sinistra in funzione della posizione sullo schermo: l'adapter usa
le etichette anatomiche del modello. Confrontare sempre con la fotografia.

## Installazione rapida

I comandi seguenti installano dipendenze e pesi soltanto quando eseguiti
esplicitamente. Il normale avvio non scarica alcun modello.
Python **3.12** è consigliato su Apple Silicon (il backend standard resta senza
nuove dipendenze obbligatorie). Se il comando `python3` identifica una versione
più recente incompatibile con i wheel, usare `python3.12`.

```sh
cd ~/valutazione-posturale
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip
backend/.venv/bin/python -m pip install -r backend/requirements-ai.txt
set -a
source .env
set +a
backend/.venv/bin/python backend/download_synthpose.py
```

La variabile backend richiesta è documentata in `.env.example`:

```sh
SYNTHPOSE_MODEL_DIR=/Volumes/Lexar/valutazione-posturale/models/synthpose-vitpose-base-hf
SYNTHPOSE_MIN_CONFIDENCE=0.50
SYNTHPOSE_HIGH_CONFIDENCE=0.75
SYNTHPOSE_BBOX_INSET=0
```

Non usare prefissi `VITE_`. `.env` è escluso da Git. Lo script legge la destinazione
dall'ambiente, richiede un percorso assoluto esterno al repository e, per percorsi
sotto `/Volumes`, verifica che il volume sia montato prima di creare directory.
Il download usa `snapshot_download(..., local_dir=...)` per tutti i file del
repository. La cache di download è nella destinazione esterna; rilanciare lo
stesso comando riutilizza i file invariati. Stampa destinazione e dimensione locale
totale, verifica configurazione/processor/pesi e registra la revisione in
`synthpose-install.json`. Non legge né spedisce fotografie.

Dipendenze AI separate: torch, transformers 4.x, accelerate, huggingface_hub,
pillow, numpy e **scipy** (necessario al preprocessing e postprocessing ViTPose).
Nessuna nuova dipendenza npm. Il file `requirements-ai.txt` mantiene limiti di
versione compatibili; registrare le versioni risolte durante gli aggiornamenti.

## Stato verificato durante l'integrazione

È stato creato `backend/.venv` con Python 3.12 e sono state installate le dipendenze:
torch 2.15.0, transformers 4.57.6, accelerate 1.15.0, huggingface_hub 0.36.2,
pillow 12.3.0, numpy 2.5.4, scipy 1.18.1. `pip check` passa.
MPS è disponibile sul Mac fuori dal sandbox: un tensore sintetico viene elaborato
correttamente su Metal. Nel sandbox MPS può risultare non disponibile.

È stato verificato anche il processor reale installato con un'immagine sintetica e
heatmap sintetiche: tensore `[1, 3, 256, 192]`, output di 52 marker.
**I pesi non sono stati scaricati**, né è stata eseguita un'inferenza reale SynthPose.
Lo status locale configurato restituisce `available: false`, `reason: model_not_found`.
Nessuna fotografia reale è stata utilizzata per le verifiche.

## Avvio e stato

```sh
cd ~/valutazione-posturale
set -a
source .env
set +a
npm run backend
```

`backend/run_backend.py` sceglie `.venv/bin/python` se presente; altrimenti usa
l'interprete corrente e l'archivio continua a funzionare senza dipendenze ML.
Il launcher desktop usa lo stesso comando. Riavviare il backend dopo l'installazione
o la modifica delle variabili. Vite continua a inoltrare `/api` al backend loopback.
Il server resta su **127.0.0.1**; non esporlo in rete.

Le nuove API richiedono la stessa sessione HttpOnly e l'header `X-Clinical-App: 1`
dell'archivio. Anche Host e Origin vengono verificati. Dall'editor, **Verifica AI**
richiama `GET /api/ai/synthpose/status`: non carica i pesi. Prima del primo
rilevamento `device` è `not_loaded`; dopo il caricamento indica `mps` o `cpu`.
La disponibilità dello status verifica i file e le dipendenze, non sostituisce
uno smoke test del modello reale.

Dopo una sessione locale aperta tramite l'app si può verificare lo status anche
con una richiesta locale munita del relativo cookie di sessione. Non copiare
cookie o credenziali nei report o nel repository.

`POST /api/ai/synthpose` accetta:

```json
{
  "image": "data:image/png;base64,...",
  "plane": "frontale_posteriore",
  "mode": "single_person_posture_photo",
  "boundingBox": [0, 0, 400, 800]
}
```

La bounding box opzionale è **COCO in pixel** `[x, y, larghezza, altezza]`.
Non sono coordinate x1/y1/x2/y2. Senza box si usa l'intera immagine, per mantenere
un margine prudenziale intorno al soggetto centrato. `SYNTHPOSE_BBOX_INSET`, da
0 a 0.2, permette un ritaglio centrato; il default 0 non ritaglia estremità.
Nessun secondo detector viene scaricato o eseguito. Una box manuale o prodotta
in futuro da un detector può usare la stessa interfaccia.

Le immagini devono essere PNG/JPEG/WebP incorporate, massimo 24 megapixel e circa
30 MiB di dati decodificati. Il backend non accetta URL remoti o percorsi arbitrari.
Si applica l'orientamento EXIF prima di calcolare dimensioni e coordinate.
L'output include modello/revisione, device, piano, dimensioni, box, soglie e i 52
marker con coordinate pixel, normalizzate e confidence. Punti esterni al fotogramma
rimangono nel debug grezzo ma non diventano proposte cliniche.

Il servizio mantiene processor e modello in memoria e serializza le inferenze.
Una seconda inferenza simultanea riceve un errore controllato. Il backend HTTP è
threaded per mantenere disponibili archivio e status mentre l'AI elabora.
MPS viene preferito quando disponibile; un errore di compatibilità o output non
valido su MPS fa riprovare su CPU. Non viene selezionata CUDA.

## I 52 keypoint

```text
 0 Nose          1 L_Eye        2 R_Eye        3 L_Ear        4 R_Ear
 5 L_Shoulder    6 R_Shoulder   7 L_Elbow      8 R_Elbow      9 L_Wrist
10 R_Wrist      11 L_Hip       12 R_Hip       13 L_Knee      14 R_Knee
15 L_Ankle      16 R_Ankle     17 sternum     18 rshoulder   19 lshoulder
20 r_lelbow     21 l_lelbow    22 r_melbow    23 l_melbow    24 r_lwrist
25 l_lwrist     26 r_mwrist    27 l_mwrist    28 r_ASIS      29 l_ASIS
30 r_PSIS       31 l_PSIS      32 r_knee      33 l_knee      34 r_mknee
35 l_mknee      36 r_ankle     37 l_ankle     38 r_mankle    39 l_mankle
40 r_5meta      41 l_5meta     42 r_toe       43 l_toe       44 r_big_toe
45 l_big_toe    46 l_calc      47 r_calc      48 C7          49 L2
50 T11          51 T6
```

## Mapping clinico

L'elenco operativo è esclusivamente in `src/data/synthposeLandmarkMapping.ts`.
Il catalogo `anatomicalLandmarks.ts` non è modificato.

- **DIRECT**: corrispondenza nominale del marker al riferimento clinico. Anche
  questa resta proposta da accettare, mai refertabile automaticamente.
- **DERIVED**: riservato a futuri riferimenti calcolati con regola esplicita;
  nessun punto derivato viene introdotto in questa fase.
- **APPROXIMATE**: punto da verificare o riposizionare, anche con score alto;
  richiede accettazione singola, non rientra in “Accetta tutti affidabili”.
- **MANUAL_ONLY**: nessuna proposta da quel marker al riferimento clinico.

Mapping diretto iniziale: r/l_ASIS → SIAS; r/l_PSIS → PSIS/SIPS;
r/l_calc → calcagno; r/l_big_toe → alluce; C7/L2/T11/T6 → corrispondenti
riferimenti posteriori. Nei sagittali si usa soltanto il lato osservato per
SIAS/SIPS/calcagno, più C7/L2/T11. Non viene inventato un riferimento sagittale T6
assente dal catalogo. In trasverso non è attivato un mapping automatico clinico;
i 52 punti grezzi restano consultabili in debug.

Mapping approssimato: sternum → linea sternale; r/lshoulder → acromion;
r/l_lwrist → stiloide radiale da verificare; r/l_knee → centro rotula;
r/l_ankle e r/l_mankle → riferimenti malleolari. Nei sagittali shoulder, knee e
ankle restano approssimati. **sternum → xifoide è manual_only**. Nessun
r_mwrist, medial-knee, COCO wrist/shoulder o altro marker viene forzato su un
riferimento clinico non equivalente. I marker senza mapping sono solo nel debug.

Soglie di visualizzazione: `< SYNTHPOSE_MIN_CONFIDENCE` soltanto debug; fascia
intermedia proposta da verificare; `>= SYNTHPOSE_HIGH_CONFIDENCE` candidato ad alta
confidenza. Ogni mapping definisce anche la sua soglia minima di affidabilità:
per i DIRECT è 0.75. L'accettazione in blocco richiede il massimo fra soglia alta
configurata e minima del mapping. Sono soglie tecniche sperimentali, non validate.

## Uso nell'editor

1. Aprire la fotografia e premere **Rileva landmark AI** nel pannello laterale.
2. Le proposte sono indicate come stimate, con colore ambra distinto dai punti
   confermati e confidence. Non vengono sostituiti landmark manuali o confermati.
3. **Accetta tutti affidabili** accetta soltanto DIRECT sopra la soglia effettiva.
   Anche il comando bulk del vecchio editor rispetta questa limitazione per l'AI.
4. **Accetta singolo** conferma una proposta; **Sposta** seleziona il punto e
   attiva il normale trascinamento dell'editor; **Rifiuta** rimuove la proposta.
   Spostare una proposta la mantiene nel bucket proposte fino all'accettazione.
5. **Nascondi proposte AI** modifica solo la visibilità, mantenendo i confermati.
6. Il checkbox debug opzionale, spento per default, mostra tutti i marker con
   indice, nome e confidence sia in elenco sia sovrapposti alla foto.

L'adapter riunisce i risultati con lo stato più recente dell'editor quando la
risposta arriva: punti confermati durante una richiesta restano protetti.
Le proposte non confermate non sono refertabili. Il punto accettato conserva
provenienza del modello, revisione, marker e score grezzo nei metadati opzionali;
usa poi la normale validazione clinica manuale.

Sono leggibili le assessment-v2 e gli envelope compatibili con header v3; l'header
v3 viene preservato, senza introdurre una migrazione clinica o un nuovo schema
predefinito. I report storici non vengono rigenerati automaticamente.

## Offline e privacy

Le sole chiamate fotografiche sono al backend locale tramite `/api`. Il servizio
non accede a foto per nome, non scrive immagini temporanee e non registra payload.
La directory dei pesi viene letta da ambiente. Processor e modello vengono caricati
con `local_files_only=True`, `trust_remote_code=False`, safetensors e modalità
HF offline/telemetria disabilitata. Il caricamento non esegue download.
Hugging Face è contattato soltanto dallo script esplicito di installazione; non
riceve foto, landmark, identificativi, report o dati paziente.

Controllo manuale dopo il download:

1. Disattivare Internet e riavviare backend/app.
2. Aprire una fotografia sintetica di prova e premere Rileva landmark AI.
3. Verificare proposte e debug, senza accettazione automatica.
4. Confermare un punto e rigenerare il report: soltanto i punti validati devono
   contribuire ai risultati. Confrontare con annotazioni manuali reali prima di
   qualsiasi impiego clinico sperimentale.

Smoke test reale opzionale, senza alcuna fotografia paziente:

```sh
cd ~/valutazione-posturale
set -a
source .env
set +a
SYNTHPOSE_INTEGRATION_TEST=1 backend/.venv/bin/python -m unittest discover -s backend -p test_synthpose_integration.py
```

Usa un'immagine sintetica e blocca le connessioni socket durante l'inferenza.
Non verifica accuratezza anatomica. Senza pesi questo test deve fallire; non viene
abilitato nella suite ordinaria, che usa fixture/mock senza rete.

## Aggiornamento e disinstallazione

Per aggiornare: annotare revisione corrente e versioni delle dipendenze, chiudere
il backend e scegliere esplicitamente `SYNTHPOSE_REVISION` (preferibilmente SHA).
Eseguire il download come operazione di manutenzione, quindi smoke test offline e
confronto con annotazioni manuali. Riavviare per evitare di riutilizzare pesi in
memoria. Per un confronto riproducibile conservare la vecchia installazione su
un'altra directory esterna e cambiare `SYNTHPOSE_MODEL_DIR`, senza sovrascriverla.

Per disinstallare: chiudere il backend, rimuovere la configurazione SynthPose da
`.env` e, soltanto dopo aver verificato il percorso, eliminare la directory esterna
dei pesi e l'eventuale `backend/.venv`. Non eliminare cartelle pazienti, database,
foto o report. Il backend archivio resta utilizzabile con Python standard.

## Verifiche e file coinvolti

`npm test`, `npm run test:backend`, `npm run build`, lint dei nuovi moduli e dei
moduli dati modificati. Il file editor preesistente mantiene 11 errori e 5 warning
ESLint già presenti nel commit di partenza, senza incrementi. Anche
`landmarkCollection.ts` mantiene il solo errore preesistente del parametro
`_collection` inutilizzato; gli altri file TypeScript modificati passano il lint. I test coprono
52 marker, normalizzazione, mapping, protezione dei confermati, soglie, API con
sessione, assenza modello, caricamento offline, MPS/CPU, download esplicito,
compatibilità v2/v3 e regressioni della pipeline clinica consolidata.

File nuovi:

- `backend/synthpose_service.py`, `backend/download_synthpose.py`,
  `backend/requirements-ai.txt`, `backend/run_backend.py`;
- `backend/test_synthpose.py`, `backend/test_synthpose_integration.py`;
- `src/data/synthposeLandmarkMapping.ts`, `src/utils/synthposeAdapter.ts`,
  `src/utils/synthposeClient.ts`, `src/components/SynthPosePanel.tsx`;
- `src/testFixtures/synthpose.ts`, `src/utils/__tests__/synthposeAdapter.test.ts`,
  `src/components/__tests__/synthposePanel.test.ts`;
- questo documento.

File aggiornati:

- `.env.example`, `.gitignore`, `package.json`, `avvia-app.sh`;
- `backend/server.py`, `backend/test_http.py`;
- `src/components/PhotoAnnotationEditor.tsx`;
- `src/types/index.ts`, `src/types/clinical.ts`;
- `src/utils/assessmentMigration.ts`, `src/utils/landmarkMigration.ts`,
  `src/utils/landmarkCollection.ts`, `src/utils/landmarkValidation.ts`.

`.env` locale è aggiornato ma non committato. Ambiente virtuale, cache e pesi sono
esclusi da Git. Nessun modello e nessun file clinico deve entrare nel commit.
