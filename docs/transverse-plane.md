# Piano trasverso: flusso manuale assistito

La vista dall’alto / postero-superiore richiede repere realmente visibili.
Il catalogo standard non include più pupille, acromion, clavicole, sterno, SIAS,
rotule, riferimenti femoro-tibiali e punti generici «Piede».

Il set corrente comprende 12 punti:
- asse cranico anteriore e posteriore (nuovi);
- angolo inferiore scapola DX/SX (ID scapola_trasv conservati);
- margine mediale scapola DX/SX (nuovi);
- PSIS DX/SX (conservati);
- calcagno DX/SX (nuovi);
- secondo raggio DX/SX (conservati).

I landmark precedenti non sono convertiti in nuovi repere: documenti e report
storici restano intatti. I cataloghi frontali e sagittali sono invariati.

## Misure e limiti

Solo punti clinicamente validati, finiti, entro l’immagine e non coincidenti
contribuiscono agli assi. Ogni misura assente riporta i riferimenti mancanti;
non viene sostituita con zero. Sono disponibili orientamento cranico, scapolare,
pelvico, capo rispetto al torace, torace rispetto al bacino, assi scapolari
individuali e loro asimmetria, assi calcagno–secondo raggio e differenza podalica.

Gli angoli sono **indici proiettati 2D su coordinate normalizzate**, non rotazioni
anatomiche 3D: dipendono da prospettiva, inclinazione e rapporto d’aspetto della
foto. Non sono confrontabili fra acquisizioni diverse senza standardizzazione.
Il segno positivo indica il verso orario nell’immagine. Non viene convertito
automaticamente in DX/SX anatomico. Le soglie riusano quelle sperimentali del
motore e richiedono interpretazione clinica; non sono nuove soglie validate.
Convergenza/divergenza e compensi crociati non sono dedotti dal solo segno.

## AI e conferma

SynthPose non è validato per questa vista: il pannello mostra la modalità manuale
assistita, senza chiamare il backend, offrire rilevamento o mostrare marker grezzi.
L’adapter non produce proposte trasverse e le vecchie proposte AI non sono esposte
nell’overlay corrente. Backend, pesi e mapping degli altri piani restano invariati.

Le misure utili generano osservazioni suggerite. Il clinico deve scegliere
esplicitamente Rotazione DX/SX e confermare. La pipeline Myers richiede anche una
misura corrente corrispondente: rimuovere landmark necessari sospende l’inferenza,
senza cancellare la decisione clinica conservata. Le ipotesi trasverse hanno peso
ridotto e confidenza massima 55%; il filtro distrettuale esistente resta attivo.
Le asimmetrie scapolari e i compensi restano disponibili all’interpretazione
manuale, senza conversioni automatiche in una diagnosi o in tessuti distali alterati.
