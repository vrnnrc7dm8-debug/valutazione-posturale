# Piano trasverso: rapporti scapolari, pelvici e podalici

La vista dall’alto / postero-superiore usa repere manuali realmente osservabili.
Non si riconoscono profondità o forze da una singola fotografia. Non si deducono
lombalgie, ernie o radicolopatie dagli indici.

## Catalogo e dropdown

I due menu degli editor raggruppano 18 repere funzionali in SCAPOLE, BACINO,
PIEDI e CAPO. Rispetto alla prima revisione si aggiungono:
- Scapulum DX/SX (`scapulum_trasv_dx/sx`);
- Ileo DX/SX (`ileo_trasv_dx/sx`);
- riferimento intermedio asse piede DX/SX (`asse_piede_trasv_dx/sx`).

Restano angoli inferiori scapolari, margini mediali scapolari, PSIS, calcagni,
secondi raggi e asse cranico anteriore/posteriore. Non si eliminano altri punti
della revisione precedente. Pupille, acromion, clavicole, sterno, SIAS, rotule,
riferimenti femoro-tibiali e punti generici Piede restano esclusi dal trasverso.
Gli ID sono specifici del piano; nessun punto storico viene convertito in un
repere anatomico diverso. I cataloghi degli altri piani sono invariati.

Scapulum e ileo richiedono una scelta clinica esplicita di repere omologhi visibili,
preferibilmente marcati, documentata e riproducibile. Non sono centri ossei
localizzati automaticamente né una stima del centro articolare.

## Indici proiettati

Tutti i valori usano coordinate normalizzate: gli angoli non sono rotazioni 3D e
le percentuali non sono distanze in mm. Prospettiva, inclinazione e rapporto
d’aspetto della foto influenzano il risultato. Non confrontare acquisizioni
non standardizzate. Le soglie sperimentali riusano quelle del motore esistente;
non sono nuove soglie clinicamente validate.

- Gli assi dei cingoli usano Scapulum DX/SX e Ileo DX/SX; non si sostituiscono
  automaticamente con angoli inferiori scapolari o PSIS, che hanno ruoli distinti.
- L’asse cranico posteriore → anteriore definisce il riferimento AP proiettato.
  Per ciascun lato si calcola `(repere - controlaterale) · asseAP × 100`.
  Positivo significa relativamente anteposto; negativo relativamente retroposto.
  Non si misura una posizione assoluta rispetto a una norma o al rachide.
  I due lati sono risultati reciproci della stessa misura, non prove indipendenti.
- Le asimmetrie AP dei cingoli usano lo stesso riferimento; l’orientamento
  Ileo–PSIS omolaterale resta un indice distinto, disponibile solo con entrambi
  i repere visibili e non coincidenti.
- Quattro rapporti Scapulum–Ileo (DX/DX, SX/SX, DX/SX, SX/DX) descrivono il
  vettore intersegmentale rispetto al riferimento AP.
- La dissociazione è la differenza angolare firmata tra gli assi dei cingoli.
  Il compenso crociato è suggerito soltanto quando i segni degli orientamenti
  rispetto alla foto sono opposti. È sensibile alla posa della camera e richiede
  interpretazione e direzione clinica esplicite.
- Il «taglio biomeccanico stimato» è la proiezione laterale della differenza tra
  i centri dei due cingoli, in percentuale normalizzata. È un disassamento
  geometrico, **non una forza, uno stress o una misura del carico discale**.
- Per i piedi si confrontano calcagno–secondo raggio, riferimento intermedio
  dell’asse piede e differenze tra lati. L’apertura proiettata confronta le
  componenti laterali degli assi podalici unitari lungo la linea dei calcagni:
  positiva indica divergenza, negativa convergenza. Non misura pressione/appoggio.
- Quattro indici confrontano ciascun asse podalico con il normale all’asse
  scapolare/pelvico. Sono relazioni proiettive, non diagnosi di compenso.

Solo punti clinicamente validati, finiti, entro l’immagine e non degeneri
contribuiscono. Ogni indice non disponibile indica quali repere mancano;
non viene sostituito con zero. L’assenza dell’asse cranico impedisce gli indici AP,
ma non impedisce le altre misure con riferimenti sufficienti.

## Operatori, conferma e Myers

I nuovi descriptor sono `anteposizione`, `retroposizione`, `convergenza`,
`divergenza`, `dissociazione`, `compenso_crociato`, `taglio_stimato`.
Non vengono convertiti in `rotation`. Ante/retro conservano lato e direzione
anteriore/posteriore; le relazioni conservano orientamento anatomico e riferimento in campi separati,
scelti o confermati dal clinico. Le direzioni degli altri piani sono invariate.

La UI distingue misura, osservazione suggerita e pattern confermato. Un cambio
operatore elimina una direzione incompatibile. Nessun suggerimento entra da solo
in Myers. Ante/retro non implicano da soli linee rotatorie e non diventano semanticamente
`rotation`. Dopo conferma contribuiscono alle Spirali e, dove appropriato, alle
Funzionali attraverso un contesto complessivo: è sufficiente una relazione
scapolo-pelvica confermata, con orientamento anatomico esplicito e supportata da misure correnti.
Lato e intensità del contesto derivano dalle relazioni scapolo-pelviche concordanti,
non dal lato o dal segno del singolo reperto ante/retro. La severità del reperto
pesa inoltre il contributo funzionale in modo monotono, senza cambiare il lato
o la confidenza del contesto (vedere [rete funzionale](functional-network.md)).
Direzioni scapolo-pelviche discordanti o misure primarie mancanti sospendono questo
contributo. Il riscontro calcaneare/podalico è opzionale: se confermato e sostenuto
da misure correnti modula la confidenza (45% senza riscontro, 50% concordante,
40% discordante; valori euristici, non probabilità validate). Non cambia lato o
intensità dell’ipotesi primaria. La concordanza può suggerire una propagazione
distale, la discordanza un possibile compenso, sempre da interpretare clinicamente.
Nessun tessuto remoto viene attribuito automaticamente senza evidenza locale. Il contesto
è temporaneo, conserva gli ID dei pattern sorgente ed è mostrato nell’evidenza;
le sue ripetizioni nei reperti ante/retro non moltiplicano lo score globale.
Convergenza/divergenza non implicano automaticamente linee rotatorie.
Dissociazione, compenso crociato e taglio possono sostenere ipotesi Spirali e
Funzionali solo con conferma, orientamento esplicito e indice corrente corrispondente
per fenomeno, operatore, lato e valore. Le ipotesi trasverse hanno peso dimezzato
e confidenza massima 55%; il filtro distrettuale evita tessuti distali arbitrari.

Le osservazioni registrate rimangono visibili quando mancano i landmark, ma la
relativa inferenza viene sospesa. Report e file storici non vengono riscritti.

## AI

SynthPose non è validato per questa vista e per questi repere. Il pannello mostra:
«Il rilevamento AI per il piano trasverso è attualmente limitato. Per questo piano
è consigliata la modalità manuale assistita.» Non offre rilevamento o proposte
trasverse e non chiama il backend. Backend, pesi e mapping degli altri piani
restano invariati.

## Relazione, orientamento anatomico e riferimento (semantica corrente)

Il campo opzionale `transverseRelation` è mantenuto in ClinicalObservation,
PosturalPattern, AlterationSelection e nella provenienza dell’inferenza Myers:

- `relationType`: dissociazione, parallelismo, compenso_crociato oppure shear;
- `reference`: coppia esplicita di segmenti/assi confrontati;
- `orientation`: dx_anteposto, sx_anteposto, dx_retroposto, sx_retroposto,
  oppure indeterminabile;
- `orientationSource`: suggerimento geometrico o correzione manuale;
- `referenceSide`: eventuale emibacino di riferimento nel confronto scapulum–ileo;
- `legacyDirection`: vecchio valore conservato, mai interpretato automaticamente
  come orientamento anatomico.

Per le relazioni non si usa più `direction = dx/sx`: menu, riepiloghi, report e
Myers ricevono riferimento e orientamento separati. Le rotazioni assiali e le
ante/retro autonome conservano i rispettivi operatori e direzioni originali.
Il menu di modifica propone Relazione, Orientamento anatomico e Riferimento.
Cambiare riferimento azzera l’orientamento precedente: un’interpretazione di un
asse non viene trasferita automaticamente a un riferimento diverso.

La linea bicalcaneare unisce Calcagno SX e Calcagno DX ed è il riferimento distale
primario. Gli indici pelvi–bicalcaneare e scapole–bicalcaneare richiedono solo i
due calcagni e i repere bilaterali del cingolo, senza secondo raggio. I confronti
con gli assi completi dei piedi restano distinti e non vengono rinominati.

L’orientamento geometrico confronta il segmento del cingolo con la normale al
riferimento, orientata verso l’asse cranico anteriore confermato. Se tale verso
non è determinabile, il sistema lascia l’orientamento indeterminabile: il clinico
può specificarlo. Il segno dell’angolo da solo non diventa un lato anatomico.
Il suggerimento geometrico rimane soggetto a conferma e correzione clinica.

Esempi:
- Dissociazione cingolo pelvico–linea bicalcaneare · Angolo relativo: 7,1° ·
  Ileo SX anteposto rispetto alla linea bicalcaneare;
- Dissociazione scapulum–ileo · Scapulum DX anteposto rispetto all’ileo DX;
- Asimmetria scapolare trasversa · Scapulum SX retroposto rispetto al DX.

DX anteposto e SX retroposto descrivono lo stesso verso relativo della coppia:
Myers li riconosce senza trasformare il descriptor in rotation. Per le relazioni
scapolo-pelviche il riscontro calcaneare resta opzionale e modula la confidenza.
Un orientamento indeterminabile o un riferimento non specificato non determina
un lato Myers. Il riferimento deve corrispondere a una misura corrente disponibile.

### Compatibilità legacy

La migrazione è differita alla lettura e opera su copie dei dati correnti: sposta
la direzione generica in `legacyDirection`, identifica il riferimento quando è
riconoscibile e lascia indeterminabile il verso anatomico ambiguo. Non converte
SX in SX anteposto e non sostituisce un asse del piede con la linea bicalcaneare.
Reperti legacy opposti restano distinguibili. I report già archiviati sono
conservati invariati; nessuna riscrittura di database, revisioni o file storici.

Un reperto con orientamento non determinabile può essere confermato e riportato
come tale; non viene costretto a una scelta DX/SX e non attribuisce un lato a
Myers. Il parallelismo può essere registrato senza suggerire coinvolgimento
rotatorio.
