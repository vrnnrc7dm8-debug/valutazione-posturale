# Curva composita, consolidamento bilaterale e corroborazione funzionale

Questa fase aggiorna le soglie e il passaggio funzionale descritti in
[riconoscimento globale](global-pattern-recognition.md). Non cambia fotografie,
archivio, modello SynthPose o valutazioni salvate.

## 1. Score rachideo composito

`computeSpinalCurveEvidence()` è una funzione pura. Conserva i valori originali;
lo score non è una misura geometrica, una probabilità diagnostica o una percentuale
anatomica. Gli angoli richiedono un rapporto immagine noto e sono riferiti alla
corda C7–L2, così l'inclinazione globale del tronco non viene scambiata per curva.

Definendo `n(x,s) = min(2, abs(x)/s)`:

- O = media degli offset T6/T11 normalizzati sulla scala di 0.6% larghezza immagine;
- A = media dei tre angoli segmentari, sottratto l'angolo della corda,
  normalizzati sulla scala di 2°;
- D = massimo dei cambi angolari, normalizzato sulla scala di 3°;
- C = 1 se entrambi gli offset superano 0.15% in valore assoluto, altrimenti 0.

`score = 0.35 × O + 0.25 × A + 0.30 × D + 0.10 × C`.

Le componenti mancanti non vengono rinormalizzate verso l'alto. La funzione è
monotona rispetto alle ampiezze normalizzate, a parità di segni, riferimento e
copertura. Invertire tutti i segni conserva lo score e inverte la convessità.
Il numero di segmenti contribuisce alla copertura e al numero di termini disponibili
nella media; è inoltre conservato esplicitamente come `segmentCount`.

Soglie:

- rilevamento: score ≥ 0.65;
- moderato: score ≥ 1.00;
- severo: score ≥ 1.60;
- ogni offset necessario alla forma C/S: almeno 0.15%;
- cambio angolare significativo: almeno 1.5°.

La curva richiede due componenti di offset, direzione coerente del tratto superiore
rispetto alla corda e rientro del tratto inferiore, con cambio significativo.
Con segni concordanti si descrive C; con segni opposti S. La sintesi C/S non conta
come terza evidenza indipendente oltre alle sue componenti.
Se gli angoli non sono disponibili, la compatibilità precedente rimane possibile
solo con entrambi gli offset forti (almeno 1.2%) e orientamento concordante con la
geometria dei punti. Non si usa un singolo offset come prova di una configurazione.

Una catena completa che non supera i criteri mantiene gli offset come geometria,
senza chiamarli automaticamente curva o proporre bend. La neutralità non viene
asserita quando mancano gli angoli necessari alla verifica composita.

## 2. Regressione numerica fornita

T6 −0.51%, T11 −0.73%; segmenti −1.23°, −0.38°, +3.60°;
cambi angolari +0.85° e +3.98°; corda di riferimento 0° nella ricostruzione sintetica.

O ≈ 1.033, A ≈ 0.868, D ≈ 1.327, C = 1 → score **1.077**, moderato.
L'output è:

- Curva toracica sinistro-convessa;
- curva toraco-lombare sinistro-convessa;
- configurazione fotografica a C;
- compenso inferiore destro rispetto alla corda;
- bend DX, distinto dalla convessità SX.

La regressione verifica sia i valori misurati riportati dall'utente sia una
polilinea sintetica ricostruita che riproduce quei valori, attraverso tutta la
pipeline fino al contributo Myers. Non è stata caricata o modificata una foto del
paziente, che non è allegata. Le soglie sono euristiche: “curva fotografica” non
significa scoliosi strutturale o diagnosi radiologica.

## 3. Pattern regionali leggibili

I pattern regionali espongono nome, componenti e interpretazione: ad esempio
“Curva toracica sinistro-convessa con compenso inferiore destro”. Il riepilogo
cranio-cervicale conserva separati tilt, shift, anteriorizzazione e rotazione.

La convessità resta separata da bend: SX → bend DX e viceversa. Le correzioni
cliniche di un operatore prevalgono sui tag geometrici precedenti: cambiare un
bend in rotazione non conserva automaticamente l'etichetta di curva.

La priorità conserva la centralità anatomica già introdotta (rachide moderato:
`2 × 2.5 × 1.3 = 6.5`) e aggiunge:

- bonus multisegmentario 1, +0.25 per il terzo segmento, massimo 1.5;
- compenso inferiore coerente +1, senza sommare copie della stessa misura;
- coinvolgimento cervicale significativo insieme al rachide +0.5;
- coinvolgimento significativo di un cingolo insieme al rachide +0.5;
- supporto multiplanare +1 e diversità regionale già esistenti.

Le soglie rimangono media 5, alta 10. Un bacino geometricamente neutro non riduce
il contributo della curva e non aggiunge una falsa alterazione.

## 4. Consolidamento bilaterale

`consolidateBilateralObservations()` segue il consolidamento per piano. Richiede:
stesso fenomeno canonico, regione/dettagli anatomici, operatore, direzione anatomica
e unità. Non fonde rotazione con shift, direzioni opposte o curve con apici diversi.
Il lato può essere esplicito o quello della vista sagittale.

Il risultato conserva valori DX/SX, severità massima, piani, tutte le osservazioni
e misure sorgenti. Un lato assente non viene inventato. Soglie di asimmetria:

- percentuali: 2 punti percentuali;
- gradi: 2°;
- normalizzato: 0.02;
- millimetri: 5 mm.

Sono soglie di confronto del software, non differenze cliniche minime validate.
9.5% DX e 14.8% SX producono un solo pattern:
“Anteriorizzazione cefalica bilaterale con prevalenza SX”. I due valori rimangono
visibili e le due fonti rimangono nel JSON. Le misure grezze per vista non vengono
cancellate. Anche il riepilogo geometrico bilaterale può riportare la prevalenza
senza imporre una nuova conferma per ogni passaggio deterministico.

## 5. GlobalPosturalPattern → ClinicalCorroboration → FunctionalGlobalPattern

`corroborateGlobalPosturalPattern()` e `buildFunctionalGlobalPatterns()` sostituiscono
la barriera che richiedeva sempre una seconda conferma delle misure.

Il trasferimento richiede:

1. tutte le fonti necessarie disponibili e refertabili, derivate da landmark
   validati oppure registrate come osservazioni cliniche confermate;
2. almeno due misure indipendenti, oppure due regioni, oppure due famiglie di piano;
3. direzione, regione e riferimento risolti;
4. nessuna neutralità rachidea contraddittoria, orientamento globale opposto o
   forte discordanza dello stesso operatore/lato/riferimento.

Le due viste sagittali non valgono come due famiglie geometriche indipendenti.
Geometrie derivate e duplicati non aggiungono voti. Riferimenti diversi non vengono
scambiati per contraddizioni dello stesso fenomeno. Le osservazioni escluse non
vengono rigenerate e continuano a impedire le sintesi derivate interessate.

Ogni globale mantiene `supportScore`, `supportTypes`, esito e motivi della
corroborazione. I tipi sono:

- geometricSupport;
- clinicalObservationSupport;
- multiplanarSupport;
- contralateralSupport.

Score di supporto (limitato a 1):
`0.45 + geometria×0.20 + osservazioni×0.15 + multiplanare×0.10 + controlaterale×0.10
+ min(0.10, 0.05×(evidenze indipendenti−1))`.

È un indice di supporto, non una probabilità clinica. Il gate si basa anche sui
criteri strutturali, non solo sullo score. La provenienza include gli angoli e i
cambi angolari che hanno contribuito allo score della curva, non solo gli offset.

## 6. Collegamento effettivo Myers

I globali corroborati entrano in `functionalModel.globalPatterns` e vengono
consumati da `inferMyersFromFunctionalGlobalPatterns()`. I contributi alimentano
sia il report globale sia le sezioni per piano e il bilancio dei binari.

- Curva coerente → valutazione Laterale corrispondente; nessuna Spirale isolata.
- Incrocio scapolo-pelvico orientato → Spirale corrispondente e Linee Funzionali.
- Cefalo-toracico anteriore → SFL/SBL/DFL pertinenti.
- Curva, rotazione cefalo-toracica e riscontri distali possono corroborare una
  firma torsionale; i calcagni non sono obbligatori per una firma dei cingoli.

Contributo lineare stimato: `3 × indiceFunzionale/100 × supportScore`.
Varianti di firma con fonti sovrapposte non si sommano: il riepilogo usa il
contributo massimo per linea. Le inferenze locali compatibili già esistenti
rimangono disponibili; non sono scambiate per prove di propagazione globale.

I tessuti vengono valutati soltanto dopo un contesto funzionale globale. Non si
assegna uno stato uniforme ai tessuti di una linea, non si creano tessuti remoti
per completare una catena. Uno stato non sufficientemente supportato rimane nei
dati tecnici e non appare nella sezione tessutale clinica principale.

## 7. Presentazione clinica e tecnica

Il testo normale usa nomi clinici, evidenze, valori e interpretazione. Provenienza,
raw keys e formule rimangono nel JSON, nelle funzioni di export con opzione tecnica
e nei pannelli con debug attivo. Le osservazioni bilaterali equivalenti compaiono
una sola volta nel riepilogo clinico, con entrambi i valori e la prevalenza.
Le fotografie e i report storici non vengono riscritti o migrati automaticamente.

## 8. Verifiche

`spinalFunctionalBridge.test.ts` verifica A–J, monotonìa, simmetria del segno,
esclusione di angoli preliminari, operatori distinti, corroborazione/contraddizione,
trasferimento effettivo a Myers, bilateralità, prevalenza, provenienza e separazione
tra testo clinico/debug. Le suite precedenti verificano persistenza e compatibilità.

## Esito finale dei controlli

- Frontend: 245 test superati, inclusi 16 nuovi test della regressione A–J e del ponte.
- Backend: 50 test conclusi senza errori, 1 integrazione modello opzionale saltata.
- Build TypeScript/Vite superata; restano gli avvisi preesistenti su deprecazione
  e dimensione del bundle.
- Lint di tutti i 24 file TypeScript/TSX nuovi o modificati superato senza messaggi.
- Nessuna nuova dipendenza. Nessuna modifica al backend, SynthPose o archivio.

Il test sui valori reali è una regressione numerica e della pipeline: non sostituisce
la verifica visiva della fotografia originale, non allegata a questa richiesta.
