#!/usr/bin/env node
// claude-json-merge.js <pfad/zur/.claude.json> [--server <pfad/memory-mcp.mjs>] [--remove] [--check]
// Traegt den MCP-Server "ecc-memory" idempotent in die Claude-Code-Konfiguration (~/.claude.json, Schluessel
// mcpServers) ein oder entfernt ihn wieder. Fasst NUR mcpServers["ecc-memory"] an - andere MCP-Server, Projekte
// und alle uebrigen Schluessel bleiben unberuehrt. ~/.claude/settings.json und ~/.claude/hooks sind hier kein Thema.
// --check prueft nur, ob die Datei verarbeitbar ist (kein Schreiben). Vor jedem Schreiben entsteht eine Sicherung.
const fs = require('fs'); const path = require('path');
const NAME = 'ecc-memory';
const args = process.argv.slice(2);
const remove = args.includes('--remove'); const checkOnly = args.includes('--check');
const serverIdx = args.indexOf('--server'); const server0 = serverIdx >= 0 ? args[serverIdx + 1] : null;
const file0 = args.find((a, i) => !a.startsWith('--') && (serverIdx < 0 || i !== serverIdx + 1));
if (!file0) { console.error('Aufruf: claude-json-merge.js <pfad/zur/.claude.json> [--server <pfad>] [--remove] [--check]'); process.exit(9); }
const fail = (msg) => { console.error('ABBRUCH: ' + msg + ' - nichts geaendert.'); process.exit(2); };
if (!remove && !checkOnly && !server0) fail('--server <pfad/memory-mcp.mjs> fehlt');
const fwd = (p) => p.replace(/\\/g, '/');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

let file = file0; let existed = false; let raw = '{}';
try { file = fs.realpathSync(file0); } catch { /* neue Datei */ }          // Symlink: das ZIEL bearbeiten, den Link erhalten
try { raw = fs.readFileSync(file, 'utf8'); existed = true; } catch (e) { if (e.code !== 'ENOENT') fail(file + ' nicht lesbar (' + e.code + ')'); }
raw = raw.replace(/^﻿/, '');                                           // UTF-8-BOM (Windows-Editoren)
let cfg; try { cfg = JSON.parse(raw.trim() === '' ? '{}' : raw); } catch (e) { fail(file + ' ist kein gueltiges JSON (' + e.message + ')'); }
if (!isObj(cfg)) fail(file + ' enthaelt kein JSON-Objekt');
if (cfg.mcpServers !== undefined && !isObj(cfg.mcpServers)) fail('mcpServers hat ein unerwartetes Format');
if (checkOnly) { console.log('[claude-json-merge] ok: ' + file + ' ist verarbeitbar'); process.exit(0); }

const wanted = remove ? undefined : {
  type: 'stdio',
  command: 'node',
  // Absoluter Pfad mit Vorwaertsschraegstrichen: unabhaengig davon, aus welchem Ordner/welcher Shell Claude Code startet.
  args: [fwd(path.resolve(server0))],
  env: {
    ECC_MEMORY_HARNESS: 'claude-code',      // Pflicht: ohne Harness-Slug startet der Server nicht
    ECC_MEMORY_ALLOW_USER_SCOPE: '1',       // schaltet den repo-uebergreifenden Scope "user" (~/.ecc/memory) frei
  },
};
const current = cfg.mcpServers ? cfg.mcpServers[NAME] : undefined;
if (JSON.stringify(current) === JSON.stringify(wanted)) {
  console.log('[claude-json-merge] unveraendert: "' + NAME + '" ist ' + (remove ? 'nicht eingetragen' : 'bereits aktuell eingetragen'));
  process.exit(0);
}

if (existed) {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  let bak = file + '.bak-mnemosyne-' + ts; let n = 0;
  while (fs.existsSync(bak)) { n += 1; bak = file + '.bak-mnemosyne-' + ts + '-' + n; }
  try { fs.copyFileSync(file, bak); fs.chmodSync(bak, 0o600); } catch (e) { fail('Sicherung gescheitert (' + e.code + ')'); }
  console.log('[claude-json-merge] gesichert: ' + bak);
}
if (remove) {
  delete cfg.mcpServers[NAME];
} else {
  cfg.mcpServers = { ...(cfg.mcpServers || {}), [NAME]: wanted };
}
const indentMatch = /^\{\r?\n([ \t]+)/.exec(raw); const indent = indentMatch ? indentMatch[1] : 2;
const tmp = file + '.tmp-mnemosyne-' + process.pid;
try {
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, indent) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);                                                 // atomar: nie eine halb geschriebene Konfiguration
} catch (e) { try { fs.unlinkSync(tmp); } catch { /* egal */ } fail('Schreiben gescheitert (' + e.message + ')'); }
console.log('[claude-json-merge] "' + NAME + '" ' + (remove ? 'entfernt' : 'eingetragen -> ' + wanted.args[0]));
