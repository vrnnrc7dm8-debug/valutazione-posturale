# Rete funzionale bilaterale e tensegrità

## Architettura

Prima: geometria (`biomechanicsEngine`) → osservazioni confermate → consolidamento
(`clinicalPipeline`) → regole locali Myers (`myersEngine`) → supporti tessutali
(`tissueEvidence`). La severità era già usata dalle regole ordinarie, ma non pesava
il contributo ante/retro nel contesto trasverso.

Ora la geometria e le sue soglie restano invariate. La pipeline esistente continua
ad alimentare i dati compatibili e aggiunge uno snapshot opzionale `functionalModel`:

1. `functionalEvidence`: misure correnti e snapshot registrati, provenienza,
   segmenti anatomici, polarità descrittiva e peso di severità.
2. `functionalTissueInference`: reperti locali con operatore/direzione conservati,
   supporto multiplanare indipendente e ipotesi specifiche per tessuto.
3. `bilateralPatternEngine`: confronto dei due lati, includendo misure normali
   esplicite disponibili; assenza di dati non significa normalità.
4. `globalTensegrityEngine`: rete omolaterale, contrasti interlaterali, relazioni
   tra cingoli, incroci espliciti, pattern regionali o globali supportati.
5. `myofascialBalanceEngine`: distribuzione segmentaria, bilancio locale/globale,
   relazioni tra linee e antagonisti già valutati.
6. `functionalNetworkEngine`: orchestrazione pura; `FunctionalNetworkPanel` e
   `functionalFormat` mostrano ed esportano lo stesso snapshot.

Non è una simulazione fisica della tensegrità. Gli indici e le ipotesi sono
**euristiche non validate**, non misure di attività contrattile, probabilità
diagnostiche, percentuali di lunghezza muscolare o forze reali.

## Misure e gerarchia

Gradi, shift %, angoli, dislivelli, ante/retro e rapporti originali non sono
ricalcolati né convertiti in accorciamento muscolare. `measurements` conserva
valore/unità e distingue `computed_geometry` da `recorded_measurement`.
Lo zero negativo viene normalizzato a zero solo nello snapshot analitico per
la compatibilità JSON; il dato geometrico originale resta intatto.

La UI conserva le osservazioni confermate esistenti e aggiunge dettagli richiudibili
per misure, pattern locali/confronti, globali, Myers, tessuti e conseguenze.
Le vecchie liste Myers sono indicate come ipotesi locali di compatibilità.
Il vecchio output lunghezza/mobilità resta disponibile per report storici privi
del nuovo modello. Nessuna migrazione di pazienti, foto, landmark o schema archivio.

Ogni tessuto, segmento, confronto, linea, arco e pattern mantiene
`sourceObservationIds`, `sourceMeasurementIds`, `sourcePatternIds`.
Gli ID delle misure registrate sono `recorded_measurement:<observationId>`;
le fonti automatiche originali rimangono associate e risolvibili nello snapshot.

## Regole locali e tessutali

Si raggruppano regione, lato, fenomeno, operatore e polarità. Shift, tilt,
rotazione assiale, ante/retro e bend restano componenti indipendenti.
Recurvatum e flessione del ginocchio condividono esclusivamente una categoria
comparativa sagittale con polarità opposte: **non definiscono uno stato muscolare**.

Le ipotesi tessutali usano solo supporti anatomicamente locali, mai tutta la linea.
Ogni tessuto usa gli hint specifici del catalogo esistente e necessita di un altro
riscontro indipendente, direzionale, locale e concordante, con almeno una geometria.
Un hint isolato non determina uno stato. Hint opposti rimangono indeterminati.
È supportato il campo opzionale clinico `functionalTissueFindings` con nome esatto
del tessuto, lato, stato e metodo di esame: senza metodo o fuori distretto viene
ignorato. Non si deduce neutralità dall'assenza di alterazioni.

Il bilancio collega antagonisti soltanto se entrambi sono già valutati nel medesimo
segmento/lato con stati differenti; non inventa uno stato antagonista.
Il confronto tra indici controlaterali non equivale alla stessa fisiologia:
“opposto” tessutale richiede stati concentrico/eccentrico entrambi supportati.

## Formule riproducibili

Tutti gli indici sono limitati a 0–100; dato insufficiente → `null`, non zero.

- Severità normalizzata: lieve 0.25, moderato 0.55, severo 0.85.
- Qualità locale Q: 0.65 con dato quantitativo finito, altrimenti 0.45;
  +0.12 per ogni famiglia di piano aggiuntiva indipendente, massimo 0.90.
  Le due viste sagittali appartengono alla stessa famiglia; fonti condivise non
  producono conferme indipendenti.
- Indice locale: arrotondamento di `100 × max(pesi severità) × Q`.
  La grandezza geometrica resta disponibile; la severità deriva dalle soglie
  esistenti o dalla conferma clinica. Un angolo di 14.8° non diventa 14.8% muscolare.
- Tolleranza del confronto bilaterale degli indici: 5 punti. Polarità opposte
  producono un contrasto locale esplicito. Una misura normale del lato opposto
  viene riconosciuta solo per le famiglie attualmente misurate (asse femoro-tibiale
  e rotazione arto inferiore), mai per famiglie diverse o misure mancanti.
- Indice di pattern integrato: media degli indici locali ×
  `[1 + 0.10 × (segmenti distinti − 1) + 0.10 × (famiglie piani − 1)]`,
  arrotondata e limitata a 100.
- Ogni linea riusa l'anatomia del catalogo. Peso uniforme normalizzato sui suoi
  segmenti e lati; indice globale = somma di `peso × indice del segmento`.
  I segmenti non osservati rimangono `null` e non vengono rinormalizzati via:
  non aggiungono evidenza, ma non sono dichiarati normali. La copertura distingue
  un dato locale isolato da un bilancio esteso.
- Indice segmentario = massimo degli indici locali pertinenti, non somma di
  duplicati. Incidenza tessutale segmentaria = indice locale × 0.80 per stato
  determinato o × 0.45 per stato indeterminato. Neutralità esplicita → indice zero.
  Incidenza globale = incidenza segmentaria × massimo peso anatomico pertinente
  tra le linee attive. È un riassunto prudente, non una ripartizione di forze.
- Myers storico: peso severità 1/2/3, anche per il contesto ante/retro, moltiplicato
  per `(0.5 + intensitàContesto/2)`. Le inferenze trasverse mantengono il fattore
  0.5 già esistente. Il contesto ripetuto usa la massima severità, non la somma.
  La severità modifica il contributo, non la confidenza o il lato del contesto.

## Condizioni di propagazione

La continuità omolaterale richiede segmenti adiacenti, stessa famiglia/operatore,
lato, polarità e almeno una linea condivisa. Gli incroci tra scapola/ileo e tra
arto inferiore/emibacino richiedono una relazione trasversa quantitativa confermata,
orientata e già ammessa da Myers. I reperti degli estremi devono esistere davvero.
Il contrasto degli arti inferiori da solo non abilita l'incrocio con il bacino.
I calcagni sono riscontri opzionali: se mancanti non si inventa propagazione distale.

Un pattern integrato necessita almeno due segmenti, due indici disponibili,
due osservazioni indipendenti e due estremi misurati (o valutati specificamente
per tessuto), con un arco diverso dalla sola opposizione bilaterale.
Tre livelli inferiori/bacino/scapola producono un pattern globale di tensegrità;
un incrocio orientato produce un pattern torsionale; altrimenti continuità regionale.

La Spirale locale non determina una Spirale globale. Quest'ultima richiede un
incrocio e una direzione unica esplicita DX→SX o SX→DX; si conserva solo la linea
corrispondente già supportata. Non si ricava il verso dal lato del singolo tessuto.
Reperti opposti sullo stesso segmento/lato o relazioni globali con orientamenti
incompatibili sospendono la sintesi delle fonti coinvolte e segnalano discordanza.

Le conseguenze sono formulate come “possibile” o “compatibile con”. Il taglio
biomeccanico è una componente organizzativa stimata, non una forza calcolata,
una lesione discale o una diagnosi neurologica.

## Esempi sintetici e verifiche

- A: asse alterato SX e misura DX normale → indice maggiore SX; DX non riceve
  tessuti/indici patologici, nessun pattern globale. DX assente → non confrontabile.
- B: recurvatum SX e flessione DX → organizzazione sagittale opposta, arco di
  opposizione; nessuna Spirale globale automatica.
- C: B + bacino e relazione crociata DX→SX confermata → pattern torsionale possibile.
- D: C + scapola coerente → pattern globale di tensegrità DX→SX; contributo maggiore
  del singolo reperto, evidenze locali tutte consultabili.
- E: osservazioni discordanti nello stesso lato o orientamenti globali opposti →
  nessuna sintesi forzata, messaggio di discordanza.
- F: un reperto quantitativo su un piano produce 16/36/55 con severità lieve/moderata/
  severa; queste percentuali non rappresentano accorciamento.
- G: lo stesso reperto moderato indipendente su 1/2/3 famiglie di piani produce
  36/42/49; duplicare la fonte non aggiunge coerenza.

`functionalNetwork.test.ts` copre questi casi, specificità/discordanza tessutale,
assenza di propagazione cervicale, provenienza risolvibile, pesi normalizzati,
limiti degli indici, non mutazione, JSON, rendering e testo. Le suite esistenti
coprono salvataggio/ripristino, report storici e operatori indipendenti.

## File dell'integrazione

Nuovi moduli:

- `src/types/functional.ts`
- `src/utils/functionalEvidence.ts`
- `src/utils/functionalTissueInference.ts`
- `src/utils/bilateralPatternEngine.ts`
- `src/utils/globalTensegrityEngine.ts`
- `src/utils/myofascialBalanceEngine.ts`
- `src/utils/functionalNetworkEngine.ts`
- `src/utils/functionalFormat.ts`
- `src/components/FunctionalNetworkPanel.tsx`
- `src/utils/__tests__/functionalNetwork.test.ts`
- `docs/functional-network.md`

Adattamenti e compatibilità:

- `src/types/clinical.ts`, `src/types/index.ts`
- `src/data/tissueDistricts.ts`
- `src/utils/clinicalPipeline.ts`, `src/utils/analysisEngine.ts`
- `src/utils/myersEngine.ts`, `src/utils/export.ts`
- `src/components/ClinicalReport.tsx`, `src/components/PlaneClinicalPanel.tsx`
- `src/utils/__tests__/clinicalPipeline.test.ts`
- `src/utils/__tests__/myersRegionalEvidence.test.ts`
- `src/utils/__tests__/transverseAnalysis.test.ts`
- `docs/clinical-pipeline.md`, `docs/transverse-plane.md`

Nessuna nuova dipendenza. Nessuna modifica al backend, SynthPose, archivio o geometria.

Validazione: 209 test frontend superati; backend 50 test senza errori, 1 test
integrazione modello opzionale saltato; build TypeScript/Vite e lint dei file
TypeScript modificati superati. La suite HTTP backend necessita del permesso di
aprire un socket locale. Restano gli avvisi Vite sui chunk grandi e ResourceWarning
SQLite nella suite backend.
