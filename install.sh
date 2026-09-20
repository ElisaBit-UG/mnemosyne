#!/usr/bin/env bash
# install.sh [--uninstall]
#   installiert MNEMOSYNE (ECC Memory-MCP) als globalen Claude-Code-MCP "ecc-memory" (macOS, Linux, Windows mit Git Bash).
# Kopiert die Laufzeit nach ~/.ecc/memory-mcp, installiert dort die eine Abhaengigkeit (ajv), traegt den Server in
# ~/.claude.json unter mcpServers ein und faehrt danach den Selbsttest.
# Ueberschreibt nichts ungesichert: die ~/.claude.json bekommt vor jeder Aenderung eine .bak-mnemosyne-<TS>-Kopie.
# Fasst in ~/.claude.json NUR mcpServers["ecc-memory"] an. Beruehrt NICHT ~/.claude/settings.json, keine Hooks,
# kein Git-Repo und keinen Server. Rueckbau: install.sh --uninstall (die Erinnerungen unter ~/.ecc/memory bleiben).
# Start: in einem Terminal (unter Windows: Git Bash) mit `bash install.sh` - nicht per Doppelklick.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
say() { echo "[mnemosyne-install] $*"; }
die() { echo "[mnemosyne-install] ABBRUCH: $*" >&2; exit 9; }
DO_UNINSTALL=0
for a in "$@"; do
  case "$a" in
    --uninstall) DO_UNINSTALL=1 ;;
    *) die "unbekanntes Argument: $a (erlaubt: --uninstall)" ;;
  esac
done

FILES="scripts/memory-mcp.mjs scripts/memory.js scripts/lib/memory-vault.js scripts/lib/memory-vault-format.js scripts/lib/path-safety.js scripts/lib/missing-dependency.js package.json package-lock.json LICENSE-ECC"
command -v node >/dev/null 2>&1 || die "node fehlt (mindestens v18): https://nodejs.org"
command -v npm  >/dev/null 2>&1 || die "npm fehlt (kommt mit node)"
NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
[ "$NODE_MAJOR" -ge 18 ] 2>/dev/null || die "node v$NODE_MAJOR ist zu alt (mindestens v18)"
for f in $FILES claude-json-merge.js selftest.sh selftest.mjs; do
  [ -f "$HERE/$f" ] || die "Paket unvollstaendig: $f fehlt"
done
for f in install.sh selftest.sh; do
  # Bash bricht an Windows-Zeilenenden. Das Repo erzwingt LF per /.gitattributes; hier stoppen, BEVOR etwas angefasst wird.
  if grep -q $'\r' "$HERE/$f"; then
    die "$f hat Windows-Zeilenenden (CRLF). Repo neu auschecken: git -c core.autocrlf=false clone <repo>"
  fi
done
# Zielorte so bestimmen, wie Claude Code und der Server sie selbst finden (os.homedir()). Unter Windows kann das
# $HOME der Git Bash davon abweichen. Fuer Tests ueberschreibbar: $MNEMOSYNE_HOME.
HD="${MNEMOSYNE_HOME:-$(node -p 'require("os").homedir().replace(/\\/g, "/")')}" || die "Home-Verzeichnis nicht bestimmbar"
DEST="$HD/.ecc/memory-mcp"
CJ="$HD/.claude.json"

if [ "$DO_UNINSTALL" = 1 ]; then
  if [ -f "$CJ" ]; then
    node "$HERE/claude-json-merge.js" "$CJ" --remove || die "MCP-Eintrag NICHT entfernt - $CJ zuerst reparieren"
  fi
  if [ -d "$DEST" ]; then mv "$DEST" "$DEST.entfernt-mnemosyne-$TS" && say "stillgelegt: $DEST"; fi
  say "Rueckbau fertig. Die Erinnerungen unter $HD/.ecc/memory bleiben liegen. Claude Code neu starten."
  exit 0
fi

# .claude.json VOR dem Kopieren pruefen: ist sie nicht verarbeitbar, wird gar nichts angefasst.
node "$HERE/claude-json-merge.js" "$CJ" --check >/dev/null || die ".claude.json nicht verarbeitbar (Meldung oben) - nichts installiert"
mkdir -p "$DEST/scripts/lib" || die "kann $DEST nicht anlegen"
for f in $FILES; do
  if [ -f "$DEST/$f" ] && cmp -s "$HERE/$f" "$DEST/$f"; then say "unveraendert: $f"; continue; fi
  cp "$HERE/$f" "$DEST/$f" || die "Kopieren von $f gescheitert"
  say "installiert: $f"
done
say "Abhaengigkeit ajv (npm ci) ..."
(cd "$DEST" && npm ci --omit=dev --no-audit --no-fund --silent) || die "npm ci gescheitert - MCP NICHT eingetragen"

node "$HERE/claude-json-merge.js" "$CJ" --server "$DEST/scripts/memory-mcp.mjs" || die ".claude.json nicht angepasst (siehe Meldung oben) - Laufzeit ist kopiert, MCP NICHT eingetragen"

say "Selbsttest ..."
if MNEMOSYNE_HOME="$HD" bash "$HERE/selftest.sh"; then
  say "FERTIG. Claude Code NEU STARTEN (MCP-Server werden beim Sitzungsstart geladen), danach \`claude mcp list\` oder /mcp zur Kontrolle."
else
  die "Selbsttest ROT - der MCP ist eingetragen, arbeitet aber nicht wie erwartet. Rueckbau: bash $0 --uninstall"
fi
