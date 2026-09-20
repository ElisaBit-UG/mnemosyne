#!/usr/bin/env bash
# selftest.sh - prueft die INSTALLIERTE Mnemosyne Ende-zu-Ende in einem Wegwerf-Ordner.
# Teil 1: der Server ueber echtes stdio-JSON-RPC gegen einen Wegwerf-Vault (selftest.mjs).
# Teil 2: claude-json-merge.js gegen eine Wegwerf-.claude.json (fremde Eintraege bleiben, idempotent, Rueckbau).
# Beruehrt weder ~/.ecc/memory noch die echte ~/.claude.json. rc 0 = alles gruen.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HD="$(node -p 'require("os").homedir().split(String.fromCharCode(92)).join(String.fromCharCode(47))')"
[ -n "${MNEMOSYNE_HOME:-}" ] && HD="$MNEMOSYNE_HOME"
SERVER="$HD/.ecc/memory-mcp/scripts/memory-mcp.mjs"
T="$(mktemp -d 2>/dev/null || mktemp -d -t mnemosyne)"; trap 'rm -rf "$T"' EXIT
# Den Test-Ordner in node's KANONISCHE Form bringen (realpath, Vorwaertsschraegstriche) - sonst rechnen bash und
# node-auf-Windows mit verschiedenen Pfaden, und die Vault-Grenzpruefung des Servers schlaegt fehl.
T="$(node -e 'process.stdout.write(require("fs").realpathSync(process.argv[1]).split(String.fromCharCode(92)).join(String.fromCharCode(47)))' "$T" 2>/dev/null || printf '%s' "$T")"
PASS=0; FAIL=0
ok()  { PASS=$((PASS + 1)); echo "  GRUEN $1"; }
bad() { FAIL=$((FAIL + 1)); echo "  ROT   $1"; }
eq()  { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (ist=$2 soll=$3)"; fi; }
jget() { node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=eval("c"+process.argv[2]);process.stdout.write(v===undefined?"undefined":typeof v==="string"?v:JSON.stringify(v))' "$1" "$2"; }

[ -f "$SERVER" ] || { echo "  ROT   Server nicht installiert: $SERVER"; exit 1; }

echo " Server (stdio-JSON-RPC, Wegwerf-Vault)"
if node "$HERE/selftest.mjs" "$SERVER" "$T/vault"; then ok "Server-Suite"; else bad "Server-Suite"; fi

echo " claude-json-merge (Wegwerf-.claude.json)"
M="$HERE/claude-json-merge.js"; J="$T/claude.json"
printf '{\n  "numStartups": 7,\n  "mcpServers": {\n    "fremd": { "command": "x" }\n  },\n  "projects": { "/a": { "k": 1 } }\n}\n' > "$J"
node "$M" "$J" --server "$SERVER" >/dev/null 2>&1; eq "Eintrag: rc 0" "$?" "0"
eq "Eintrag: command" "$(jget "$J" '.mcpServers["ecc-memory"].command')" "node"
eq "Eintrag: Harness-Slug gesetzt" "$(jget "$J" '.mcpServers["ecc-memory"].env.ECC_MEMORY_HARNESS')" "claude-code"
eq "Eintrag: user-Scope freigeschaltet" "$(jget "$J" '.mcpServers["ecc-memory"].env.ECC_MEMORY_ALLOW_USER_SCOPE')" "1"
eq "fremder MCP bleibt" "$(jget "$J" '.mcpServers.fremd.command')" "x"
eq "fremde Schluessel bleiben" "$(jget "$J" '.numStartups')$(jget "$J" '.projects["/a"].k')" "71"
eq "eine Sicherung angelegt" "$(ls "$T" | grep -c 'claude.json.bak-mnemosyne-')" "1"
BEFORE="$(cat "$J")"; node "$M" "$J" --server "$SERVER" >/dev/null 2>&1
eq "zweiter Lauf aendert nichts" "$(cat "$J")" "$BEFORE"
eq "zweiter Lauf: keine weitere Sicherung" "$(ls "$T" | grep -c 'claude.json.bak-mnemosyne-')" "1"
node "$M" "$J" --remove >/dev/null 2>&1
eq "Rueckbau entfernt den Eintrag" "$(jget "$J" '.mcpServers["ecc-memory"]')" "undefined"
eq "Rueckbau laesst fremden MCP stehen" "$(jget "$J" '.mcpServers.fremd.command')" "x"
printf '{ kaputt' > "$T/kaputt.json"; node "$M" "$T/kaputt.json" --server "$SERVER" >/dev/null 2>&1
eq "kaputtes JSON: rc 2" "$?" "2"
eq "kaputtes JSON: Datei unangetastet" "$(cat "$T/kaputt.json")" "{ kaputt"
node "$M" "$T/neu.json" --server "$SERVER" >/dev/null 2>&1
eq "fehlende Datei wird angelegt" "$(jget "$T/neu.json" '.mcpServers["ecc-memory"].command')" "node"

echo "[mnemosyne-selftest] $PASS gruen, $FAIL rot"
[ "$FAIL" = 0 ]
