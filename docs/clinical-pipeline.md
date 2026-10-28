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
