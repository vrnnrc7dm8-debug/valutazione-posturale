#!/bin/bash
set -e

# Percorsi Node.js per applicazioni macOS
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$HOME/.volta/bin:$HOME/.local/bin:$PATH"

# Supporto nvm
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    source "$NVM_DIR/nvm.sh"
fi

# Supporto Homebrew
if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi


PROJECT="/Users/alessandroarrigo/valutazione-posturale"
DB="/Volumes/Lexar/app valutazione posturale/database/valutazione_posturale.db"

if ! mount | grep -Fq " on /Volumes/Lexar ("; then
    echo "Il disco Lexar non è collegato."
    exit 1
fi

if [ ! -f "$DB" ]; then
    echo "Database pazienti non trovato sul Lexar."
    exit 1
fi

cd "$PROJECT"

if [ ! -f ".env" ]; then
    echo "Configurazione .env mancante. Configurarla prima dell'avvio."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "Node/npm non trovato."
    exit 1
fi

set -a
source .env
set +a

# Health includes the backend build fingerprint: do not silently reuse old Python code.
EXPECTED_BUILD=$(cat backend/server.py backend/anthropometry.py backend/patient_management.py | shasum -a 256 | awk '{print $1}')
HEALTH=$(curl -fsS --max-time 2 -H 'X-Clinical-App: 1' http://127.0.0.1:8765/api/health 2>/dev/null || true)
if lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1 &&
   [[ "$HEALTH" != *"$EXPECTED_BUILD"* ]]; then
    PIDS=$(lsof -t -nP -iTCP:8765 -sTCP:LISTEN)
    for PID in $PIDS; do
        PROCESS_DIR=$(lsof -a -p "$PID" -d cwd -Fn | sed -n 's/^n//p')
        PROCESS_COMMAND=$(ps -p "$PID" -o command=)
        if [ "$PROCESS_DIR" != "$PROJECT" ] || [[ "$PROCESS_COMMAND" != *"backend/server.py"* ]]; then
            echo "Porta 8765 occupata da un altro processo. Nessun processo arrestato."
            exit 1
        fi
    done
    # The Desktop launcher may be clicked with an unsaved browser session open.
    /usr/bin/osascript -e 'display dialog "È disponibile una versione aggiornata. Prima di continuare salva o esporta eventuali modifiche aperte in Safari. Il riavvio richiederà di riaprire la valutazione dall’archivio." buttons {"Annulla", "Riavvia"} default button "Annulla" with title "Valutazione Posturale"' >/dev/null
    for PID in $PIDS; do kill -TERM "$PID"; done
    for i in $(seq 1 20); do
        if ! lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then break; fi
        sleep 1
    done
fi

if ! lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
    nohup npm run backend >/dev/null 2>&1 </dev/null &
fi
if lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
    for PID in $(lsof -t -nP -iTCP:5173 -sTCP:LISTEN); do
        PROCESS_DIR=$(lsof -a -p "$PID" -d cwd -Fn | sed -n 's/^n//p')
        PROCESS_COMMAND=$(ps -p "$PID" -o command=)
        if [ "$PROCESS_DIR" != "$PROJECT" ] || [[ "$PROCESS_COMMAND" != *"vite"* ]]; then
            echo "Porta 5173 occupata da un altro processo. Nessun processo arrestato."
            exit 1
        fi
    done
else
    nohup npm run dev -- --host 127.0.0.1 --strictPort >/dev/null 2>&1 </dev/null &
fi

READY=0
for i in $(seq 1 30); do
    HEALTH=$(curl -fsS --max-time 2 -H 'X-Clinical-App: 1' http://127.0.0.1:8765/api/health 2>/dev/null || true)
    if [[ "$HEALTH" == *"$EXPECTED_BUILD"* ]] &&
       curl -fsS --max-time 2 http://127.0.0.1:5173/ >/dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 1
done
if [ "$READY" -ne 1 ]; then
    echo "Avvio non riuscito: verificare porte 8765/5173, configurazione e Lexar. Nessun archivio alternativo creato."
    exit 1
fi
open -a Safari "http://127.0.0.1:5173"
