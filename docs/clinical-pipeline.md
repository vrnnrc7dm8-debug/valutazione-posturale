# Pipeline clinica consolidata

Le misure fotografiche e i suggerimenti restano osservazioni da validare. Le selezioni
cliniche esistenti vengono adattate in memoria a `ClinicalObservation[]`; solo le
osservazioni confermate o modificate sostengono `PosturalPattern[]`. Le osservazioni
escluse rimangono nella valutazione, ma non entrano in inferenze, priorità e report.

`observationsFromAssessments` → `consolidateObservations` →
`inferMyersFromPatterns` → `consolidateTissueEvidence`.

Il modulo `src/utils/clinicalPipeline.ts` contiene le funzioni pure della nuova
pipeline. Le regole in `myersEngine.ts` vengono riutilizzate una volta per pattern.
Il vecchio motore e `tissueAnalysis.ts` rimangono disponibili per compatibilità;
i report nuovi usano `clinicalPipeline.tissues`, senza lo stato tessutale unico
legacy. La lunghezza, mobilità e funzione vengono presentate separatamente.
Questi risultati restano ipotesi funzionali, non diagnosi.

## Consolidamento e revisione

Gli alias del capo vengono normalizzati a `anteriorizzazione_capo`. Si uniscono
solo fenomeni equivalenti nello stesso piano, distretto, lato, direzione e sede
anatomica. Le regioni o gli apici diversi rimangono distinti. La severità dei
reperti duplicati non viene sommata. Una correzione manuale ha priorità.

Reperti differenti possono sostenere lo stesso pattern usando il campo
**Gruppo clinico comune**. Il reperto modificato, o il primo reperto manuale,
definisce il fenomeno rappresentativo del gruppo. Questo collegamento deve
essere una scelta clinica esplicita: non si deduce una deviazione del rachide da
un solo dislivello delle spalle.

I comandi sul pattern applicano modifica, esclusione o eliminazione a tutte le
osservazioni che lo sostengono. I comandi sulle singole osservazioni agiscono
soltanto sull'istanza selezionata. Le escluse si possono ripristinare dall'editor
delle osservazioni. L'identità del suggerimento originale viene conservata
anche se il clinico corregge lato o direzione: una nuova conferma dello stesso
suggerimento non sovrascrive la correzione e non riattiva un'esclusione.

La regione rachidea e la convessità assenti restano indeterminate. Il dettaglio
anatomico è mantenuto nel report, insieme ad apice, livello ed estensione.

## Evidenze tessutali e report

Una voce globale per tessuto e lato aggrega pattern, identificativi delle
osservazioni, linee Myers e confidenza. La confidenza aggregata è il massimo delle
fonti, evitando di trattare evidenze correlate come indipendenti. Evidenze di
lunghezza discordanti producono `lengthState: unknown`, `conflict: true` e la
lista `conflictingEvidence`. Il report mostra **evidenza discordante**.

Report a schermo, HTML/PDF e testo distinguono misure oggettive, osservazioni,
pattern, ipotesi miofasciali e tessuti. L'export ZIP conserva anche le nuove
strutture nei JSON clinici e il report generato nel suo snapshot.

## Persistenza e compatibilità

Lo schema resta `assessment-v2`: i nuovi metadati di revisione sono campi opzionali
su `AlterationSelection`. Non è necessaria una migrazione distruttiva o una
riscrittura dell'archivio. Le strutture consolidate si derivano in memoria e
vengono incluse soltanto nei report rigenerati. Un report storico viene letto e
visualizzato tramite i suoi campi legacy, senza ricalcolarlo.

Nessuna modifica a fotografie, landmark, editor, archivio pazienti o backend.

## Verifica

I test coprono alias e duplicati, dimensioni tessutali, conflitti, esclusioni,
priorità manuale, dettagli rachidei, lettura v2 e report storici, correzione di un
suggerimento riproposto e modifica/esclusione di un intero pattern. La fixture di
regressione conserva 29 registrazioni originali e produce 27 pattern consolidati.


## Misure frontali e conferma clinica

`observationsFromAutoMeasurements()` converte le sole misure frontali interpretabili
classificate sopra la normalità in osservazioni `automatic_measurement/suggested`.
Le misure normali restano visibili; nessuna proposta entra in Myers o nel report
interpretativo prima della conferma. Il pannello consente conferma, modifica ed
esclusione. Le decisioni sono conservate nel campo opzionale `PlaneAssessment.observations`
dell'envelope esistente; nessun intervento sull'archivio o sul backend Lexar.
L'identità è stabile per piano e ID misura, indipendente da valore, lato e direzione,
così un ricalcolo non sovrascrive correzioni o esclusioni. Le selezioni legacy
equivalenti sono consolidate; i suggerimenti frontali precedenti non sono mostrati
una seconda volta nel pannello fotografico.

Le osservazioni confermate conservano la misura accettata dal clinico come snapshot:
un cambio successivo dei landmark non la riconferma né la riscrive automaticamente.
Gli stati suggerito ed escluso non contribuiscono ai pattern. La priorità frontale
usa i soli reperti confermati, evitando il doppio conteggio della stessa misura.

Sono visibili asse femoro-tibiale e rotazione di entrambi gli arti, usando l'alluce
come riferimento distale quando disponibile. L'inclinazione di una linea non
orientata è normalizzata modulo 180° nell'intervallo [-90°, 90°), anche nei confronti
relativi. Il verso dei landmark non trasforma quindi una linea quasi orizzontale
in un tilt di circa 180°. I test del caso a 21 landmark usano coordinate sintetiche,
non una fotografia né coordinate di pazienti reali.

## Operatori clinico-biomeccanici

`ClinicalObservation.descriptor` e `PosturalPattern.descriptor` conservano
l'operatore registrato dal clinico: shift (traslazione), tilt (inclinazione),
rotation (rotazione assiale), bend (flessione/lateroflessione/curvatura), compenso
(relazione funzionale). La chiave di consolidamento include l'operatore anche
quando è indicato un gruppo clinico comune. Componenti cinematiche diverse non
sono alias, anche se interessano lo stesso distretto. Le vecchie osservazioni
senza descriptor usano soltanto un default di compatibilità dal fenomeno/catalogo;
i descriptor espliciti non vengono riscritti.

La deviazione cervicale permette shift, bend e rotation, con più istanze della
stessa alterazione. Shift DX e Rotazione SX restano due pattern, raggiungono Myers
con i rispettivi operatori e sono mostrati separatamente nel report. Non viene
dedotta una relazione controlaterale né introdotto un tilt. I cataloghi frontali
includono separatamente tilt_capo, shift_capo e rotazione_capo.

Le nuove scelte di direzione per rotation sono rotazione_dx/rotazione_sx,
visualizzate come Rotazione DX/SX; per shift e tilt frontali sono dx/sx,
visualizzate con il rispettivo operatore. Queste direzioni sono anatomiche del
paziente. Cambiare operatore elimina una direzione incompatibile, senza sceglierne
un'altra automaticamente. Compenso non offre una direzione geometrica.

Le misure distali di intrarotazione/extrarotazione stimate dai landmark frontali
restano visibili come misure. Non vengono convertite automaticamente in una
rotazione assiale DX/SX: una nuova osservazione rotation richiede che l'operatore
specifichi esplicitamente la direzione prima della conferma. I valori storici
rimangono leggibili e non vengono riscritti nell'archivio.

## Inferenza Myers per operatore e regione

Il resolver seleziona una sola regola: alterazione, operatore, direzione, regione,
convessità e piano ne determinano la specificità. Una regola specifica non viene
sommata alla regola globale o al fallback. Le compatibilità piano/operatore/lato
riusano `MYOFASCIAL_CLINICAL_DATABASE`. Shift cervicale DX privilegia la Laterale
destra; rotazione cervicale SX la Spirale sinistra. Bend e convessità rimangono
campi distinti. In assenza di convessità esplicita, l'opposto del bend può essere
mostrato come proposta derivata, senza usarlo come conferma della curva.

Le sette regioni rachidee, inclusa la sacrale, determinano la distribuzione dei
tessuti. `tissueDistricts.ts` aggiunge metadati anatomici ai tessuti già presenti,
senza duplicare le appartenenze alle linee. Le ipotesi di linea sono separate dai
tessuti supportati: il singolo pattern genera soltanto tessuti locali. Un tessuto
adiacente o remoto richiede un pattern indipendente nel proprio distretto, sulla
stessa linea e con lato compatibile. Osservazioni condivise non costituiscono
corroborazione. Il supporto conserva origine, regione, prossimità e confidenza;
le ripetizioni non aumentano artificialmente la confidenza.

La confidenza esprime la qualità interna dell'evidenza (specificità, direzione,
regione, misura, conferma e riscontri indipendenti), non la severità posturale né
una probabilità clinica validata. Una componente cinematica da sola non dimostra
accorciamento o allungamento muscolare: nelle nuove evidenze queste dimensioni
restano sconosciute senza un operatore esplicito di fissazione. I campi legacy
restano leggibili per compatibilità. UI, report e testo esportato espongono le
origini delle linee e dei tessuti; i report storici privi delle nuove inferenze
usano la rappresentazione precedente. Tutti i nuovi campi persistiti sono opzionali.

La suite `myersRegionalEvidence.test.ts` copre il caso cervicale shift DX +
rotation SX + bend lombosacrale SX/convessità DX, priorità delle regole, regioni,
filtro locale/remoto, corroborazione indipendente, assenza di duplicati,
confidenza indipendente dalla severità e riapertura assessment-v2.

## Rete funzionale integrata

La pipeline aggiunge ora lo snapshot opzionale `functionalModel`: confronti
bilaterali, distribuzione segmentaria e pattern globali con provenienza.
Formule, limiti ed esempi: [rete funzionale](functional-network.md).
