# Riconoscimento regionale e globale multiplanare

## Problema e architettura

Il frontale posteriore usava dislivelli PSIS, scapole solo con quattro landmark
specifici e massimi scostamenti da una verticale. Gli scostamenti non descrivevano
la curva rispetto a una corda. Inoltre `observationsFromAutoMeasurements` accettava
solo frontale anteriore e trasverso: le misure degli altri piani non potevano
alimentare lo stesso percorso di conferma e consolidamento.

Ora:

`landmark validati → geometria → proposte elementari → evidenze regionali → firme globali → corroborazione Myers → ipotesi tessutali e conseguenze`.

- `posteriorAnalysis.ts`: geometria posteriore pura, riferimenti anatomici,
  metadati di curva e limiti dei dati disponibili.
- `biomechanicsEngine.ts`: conserva le precedenti misure, integra il nuovo
  analizzatore e disegna polilinea e corda. Tutti gli shift segmentari sagittali
  vengono mantenuti, senza il precedente limite di quattro.
- `automaticObservations.ts`: adattatore comune per tutti i piani; conserva
  operatore, direzione, regione e convessità. Le proposte richiedono conferma.
- `globalPatternCatalog.ts`: sedici firme dichiarative. Ogni firma dichiara
  evidenze richieste, supporti, contraddizioni, incompatibilità, regioni/piani,
  copertura, indipendenza, risoluzione della direzione/severità, compatibilità
  Myers e criteri di refertabilità.
- `patternRecognition.ts`: estrazione, deduplicazione, confronti interlaterali,
  aggregazione regionale e `buildMultiplanarGlobalPatterns`. Non dipende da Myers.
- `regionalPatternGraph.ts`: collegamenti tra regioni realmente documentate,
  continuità adiacenti concordanti, relazioni misurate, opposizioni e incroci.
  I collegamenti anatomici sono possibilità organizzative, non prove causali.
- `planePriority.ts`: `computePlanePriority`, indipendente dal conteggio casuale
  delle osservazioni generate dal software.
- `GlobalPatternPanel.tsx` e `globalPatternFormat.ts`: stesso snapshot in UI,
  report HTML e testo/PDF, con “Perché questo pattern?” e provenienza.

L'analisi funzionale precedente resta distinta: integra esclusivamente fonti
cliniche corroborate. Le sue sezioni precisano questa distinzione rispetto alle
ipotesi geometriche del nuovo riconoscimento.

## Geometria posteriore

Si usano gli ID già presenti nel catalogo: `occipite`, `cervicale_c7`,
`toracico_t6`, `toracico_t11`, `lombare_l2`, acromion posteriori, PSIS e calcagni.
Nessun valore o lato del paziente è codificato nelle regole.

Nuove misure, quando i riferimenti necessari sono disponibili:

- offset signed T6 e T11 dalla corda C7–L2 alla stessa quota verticale;
- inclinazioni C7–T6, T6–T11, T11–L2 e cambi angolari ai due vertici;
- configurazione fotografica C/S e controllo di neutralità della polilinea;
- shift tra centri scapolare/pelvico, C7/bacino, L2/bacino, C7/L2;
- rapporto C7/centro scapolare, bacino/centro bicalcaneare;
- shift occipite/C7, asse occipite–C7 e rapporto angolare con C7–T6;
- inclinazioni bisacromiale, pelvica, bicalcaneare e loro rapporti;
- dislivello acromiale posteriore;
- tilt da linea bimastoidea opzionale.

Per un punto P l'offset orizzontale è:

`xP − [xC7 + (xL2 − xC7) × (yP − yC7)/(yL2 − yC7)]`.

Lo si esprime in percentuale della larghezza immagine. È una deviazione laterale
rispetto alla corda, non la sola distanza da una verticale. I riferimenti devono
essere finiti, nell'immagine e ordinati; una corda degenerata non genera curve.
Gli angoli usano le dimensioni effettive della foto (`x × larghezza/altezza`).
`imageAspectRatio.ts` legge header PNG/JPEG ed EXIF, senza richieste esterne né
modifiche alla fotografia. Nell'editor si usano le dimensioni dell'immagine caricata.
Se il rapporto non è disponibile, gli angoli normalizzati restano preliminari,
`reportEligible=false`, e non vengono refertati come angoli fotografici.

Il segno anatomico viene ricavato dall'ordine dei riferimenti bilaterali nominati
DX/SX: riflettere la fotografia conserva la stessa convessità anatomica. Se le
coppie danno indicazioni contraddittorie, la refertabilità viene sospesa. Senza
coppie disponibili si usa la convenzione posteriore non specchiata; l'API consente
`mirrored` esplicito quando noto. Non si può indovinare il mirroring senza riferimenti.

Offset concordanti sopra soglia → C; discordanti → S. La convessità corrisponde al
lato della deviazione dalla corda, mentre bend/concavità hanno verso opposto.
`bendDirection` e `convexityDirection` restano distinti nei metadati; nell'osservazione
clinica si salvano direzione bend e `anatomicalDetails.convexity` separatamente.
T6 rappresenta il componente toracico; T11 quello toraco-lombare. La dominanza
viene verificata confrontando l'entità con l'altra regione misurata.

Quattro punti non ricostruiscono una curva vertebrale continua: “C/S” e “pattern
scoliotico funzionale/fotografico” sono descrizioni della polilinea, non diagnosi
radiologiche né misure di Cobb. Una curva cervicale o lombare oltre il tratto
visibile richiede ulteriori riferimenti o una specifica osservazione clinica.

## Catalogo implementato

1. Cefalo-toracico anteriore: capo anteriore più componente sagittale toracica,
   scapolare o lombare; direzione coerente.
2. Cefalo-toracico laterale: shift/tilt cefalico più curva/shift toracico frontale.
3. Cervico-toracico torsionale: rotazioni assiali esplicite cefalica e toracica;
   conserva anche direzioni opposte, senza inventare una Spirale globale.
4. Scoliotico funzionale/fotografico a C.
5. Scoliotico funzionale/fotografico a S.
6. Toracico dominante.
7. Lombare/toraco-lombare dominante.
8. Scapolo-pelvico: relazione documentata e componenti di entrambi i cingoli.
9. Torsionale globale: componenti trasverse dei cingoli più relazione orientata.
10. Crociato: relazione crociata esplicita più componenti pertinenti.
11. Spiraliforme: incrocio, componente interlaterale/distale e cingolo documentato.
12. Sagittale globale: almeno tre regioni coerenti.
13. Laterale globale: almeno tre regioni documentate nel frontale.
14. Interlaterale degli arti inferiori: confronto tra fonti DX/SX effettive.
15. Distale-prossimale coerente: riscontro distale, relazione misurata e cingolo.
16. Misto multiplanare: componenti regionali in almeno due famiglie di piano.

Le famiglie regionali conservano anche osservazioni elementari di capo
anteriore/posteriore, tilt, shift, rotazione, varo/valgo, flexum/recurvatum,
rotazioni degli arti inferiori e calcagno. Mancanza del lato opposto significa
non confrontabile, non simmetrico. Le due viste sagittali sono una sola famiglia
geometrica ai fini della coerenza multiplanare.

Il pattern misto documenta la coesistenza di componenti; non prova da solo che
esse siano una catena causale. Non si usano direzioni “ascendente/discendente”.
Per la Spirale sono necessari incrocio e orientamento espliciti; il singolo lato
muscolare o un contrasto bilaterale isolato non bastano. I calcagni sono opzionali
per le firme dei cingoli, necessari solo per le firme specificamente distali.

## Indipendenza, correzioni e conferma

Le firme richiedono due regioni, due famiglie di piano o una configurazione
rachidea multisegmentaria; il confronto bilaterale ha due sorgenti laterali
esplicite. I derivati C/S e le sintesi interlaterali non aggiungono voti indipendenti.
“Indipendente” indica una distinta sorgente geometrica/osservativa deduplicata,
non indipendenza statistica o validazione diagnostica.

I componenti della curva derivata sono autoritativi: conferme, esclusioni e
correzioni cliniche modificano anche la sintesi C/S. La geometria rigenerata non
sovrascrive una decisione. ID ripetuti non aumentano intensità o copertura.
Le firme C/S sono incompatibili tra loro; evidenze di rachide nei limiti delle
soglie contraddicono la firma di curva e ne sospendono la sintesi.

Un pattern da landmark validati può comparire nel report come **ipotesi fotografica
da verificare**; non è una conferma clinica automatica. Solo componenti confermate
entrano nei pattern clinici consolidati e in Myers. Le compatibilità del catalogo
sono famiglie da valutare, non attivazioni automatiche di tutti i tessuti della linea.
I globali confermati possono corroborare le linee già sostenute dalle regole
cliniche; non aggiungono copie dell'inferenza né propagazione tessutale remota.
Gli stati concentrici/eccentrici restano ipotesi specifiche per tessuto.

Ogni livello mantiene `sourceObservationIds`, `sourceMeasurementIds`, `sourcePatternIds`.
I globali espongono inoltre `supportedPlanes`, `independentEvidenceCount`,
`regionsInvolved`, `direction`, `functionalIntensity` ed evidenze testuali.

## Intensità e priorità

L'intensità funzionale usa i pesi lieve/moderato/severo 0.25/0.55/0.85, deduplicati
per sorgente. Formula:

`100 × media(pesi) × [0.65 + 0.10 × (famiglie piani − 1) + 0.05 × (regioni − 1)]`.

Si arrotonda e si limita a 100. Una percentuale geometrica non diventa mai una
percentuale anatomica di accorciamento. Restano distinti misura, indice locale,
incidenza segmentaria e incidenza globale della [rete funzionale](functional-network.md).

La priorità usa il massimo contributo per regione, poi il massimo anatomico:

- severità: 1/2/4;
- centralità: distale 0.7, arto inferiore 1, capo 1.4, scapola 1.5,
  bacino 1.7, cervicale 2, torace/lombare 2.5;
- moltiplicatore rachideo 1.3;
- diversità: +0.5 per regione aggiuntiva, massimo +2;
- supporto multisegmentario +1, compensatorio +1, multiplanare +1;
- priorità media da 5, alta da 10.

La curva rachidea moderata vale già `2 × 2.5 × 1.3 = 6.5`, indipendentemente da
PSIS neutre. Duplicare le misure non altera il punteggio. La priorità globale usa
le stesse soglie. Sono pesi organizzativi euristici, non un triage medico validato.

## Cosa resta non determinabile

Occipite–C7 non misura rotazione assiale né tilt cefalico da linea cranica.
Sono stati aggiunti due **mastoidi manuali opzionali**, utilizzabili solo quando
visibili. La linea bimastoidea permette il tilt; la vera rotazione assiale necessita
anche di un riferimento orientativo indipendente o di una conferma clinica.
Non sono stati modificati modello, download, inferenza o mapping SynthPose.

`unresolvedPotentialPatterns` conserva internamente le ipotesi incomplete e le
richieste di riferimenti aggiuntivi. È visibile solo nel debug dell'editor, mai
nel referto clinico. I nuovi report filtrano riferimenti non specificati,
rotazioni senza verso anatomico e reperti rachidei senza regione. I report salvati
precedentemente non vengono rigenerati o modificati automaticamente.

## Regressioni e validazione

I test A–I riproducono geometricamente i criteri dell'allegato: rettilineo,
convessità SX/DX, S, occipite senza linea cranica, PSIS quasi neutre con curva,
supporto sagittale/trasverso e esclusione dei dati non risolti. Sono coperti anche
mirroring, missing landmark, proposte AI non confermate, rapporto immagine PNG/JPEG
ed EXIF, deduplicazione, conferme/correzioni della curva, provenienza, rendering,
export, non mutazione e JSON.

L'allegato non include coordinate o foto del paziente corrente: la regressione
usa gli undici landmark indicati con coordinate **sintetiche**. La direzione sul
caso reale va verificata caricando la valutazione e aprendo “Perché questo pattern?”.
Nessun dato del paziente è stato cercato nell'archivio privato.

Esempio sintetico: T6 −5%, T11 −4% dalla corda → convessità SX, bend DX,
configurazione C e priorità almeno media. T11 +5% con T6 −5% → configurazione S.
Un'osservazione sagittale indipendente può aggiungere il pattern misto; non determina
automaticamente una Spirale o una rotazione del capo.

## Esito dei controlli

- Frontend: 229 test superati (20 nuovi), inclusa regressione sintetica A–I.
- Backend: 50 test conclusi senza errori, 1 integrazione reale opzionale saltata.
- Build TypeScript/Vite superata; rimangono avvisi di deprecazione e chunk grandi.
- Lint di tutti i nuovi moduli e degli altri file modificati pulito.
- Lint dell'editor fotografico: 11 errori e 5 warning già presenti in HEAD;
  confronto delle diagnostiche esatto, nessun nuovo messaggio introdotto.
- Lint completo repository: 23 errori e 6 warning preesistenti; non è dichiarato
  superato. Gli altri file segnalati non sono stati modificati da questa integrazione.
- Nessuna nuova dipendenza, nessun download modello, nessuna migrazione archivio.

## Elenco dei file dell'intervento

- `docs/clinical-pipeline.md`
- `docs/global-pattern-recognition.md`
- `src/components/AnnotationClinicalPanel.tsx`
- `src/components/ClinicalReport.tsx`
- `src/components/FunctionalNetworkPanel.tsx`
- `src/components/GlobalPatternPanel.tsx`
- `src/components/PhotoAnnotationEditor.tsx`
- `src/components/PlaneClinicalPanel.tsx`
- `src/components/PosturalPlaneAssessment.tsx`
- `src/components/__tests__/generateReport.test.ts`
- `src/data/anatomicalLandmarks.ts`
- `src/data/globalPatternCatalog.ts`
- `src/types/index.ts`
- `src/types/patternRecognition.ts`
- `src/utils/__tests__/imageAspectRatio.test.ts`
- `src/utils/__tests__/patternRecognition.test.ts`
- `src/utils/__tests__/reportGeneration.test.ts`
- `src/utils/analysisEngine.ts`
- `src/utils/automaticObservations.ts`
- `src/utils/biomechanicsEngine.ts`
- `src/utils/clinicalPipeline.ts`
- `src/utils/export.ts`
- `src/utils/functionalEvidence.ts`
- `src/utils/globalPatternFormat.ts`
- `src/utils/imageAspectRatio.ts`
- `src/utils/patternRecognition.ts`
- `src/utils/planePriority.ts`
- `src/utils/posteriorAnalysis.ts`
- `src/utils/postureScoring.ts`
- `src/utils/regionalPatternGraph.ts`
- `src/utils/spineSegmentInference.ts`
