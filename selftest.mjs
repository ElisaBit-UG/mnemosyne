#!/usr/bin/env node
// selftest.mjs <pfad/memory-mcp.mjs> <wegwerf-ordner>
// Spricht den INSTALLIERTEN Server ueber echtes stdio-JSON-RPC an (so wie Claude Code) - gegen einen Wegwerf-Vault.
// Beruehrt weder ~/.ecc/memory noch ein echtes Repo. rc 0 = alles gruen.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [server, tmp] = process.argv.slice(2);
if (!server || !tmp) { console.error('Aufruf: selftest.mjs <memory-mcp.mjs> <wegwerf-ordner>'); process.exit(9); }
let pass = 0; let failed = 0;
const ok = (name) => { pass += 1; console.log('  GRUEN ' + name); };
const bad = (name, detail) => { failed += 1; console.log('  ROT   ' + name + (detail ? ' (' + detail + ')' : '')); };
const check = (name, cond, detail) => (cond ? ok(name) : bad(name, detail));

function start(extraEnv) {
  const env = { ...process.env, ECC_MEMORY_USER_ROOT: path.join(tmp, 'user'), ECC_MEMORY_PROJECT_ROOT: path.join(tmp, 'proj'), ...extraEnv };
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
  const child = spawn(process.execPath, [server], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = ''; let stderr = ''; let nextId = 0; const waiters = new Map();
  child.stderr.on('data', (d) => { stderr += d; });
  child.stdout.on('data', (d) => {
    buffer += d; let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const message = JSON.parse(buffer.slice(0, i)); buffer = buffer.slice(i + 1);
      waiters.get(message.id)?.(message);
    }
  });
  const rpc = (method, params) => new Promise((resolve, reject) => {
    const id = ++nextId; waiters.set(id, resolve);
    setTimeout(() => reject(new Error('Zeitlimit bei ' + method)), 10000).unref();
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const notify = (method) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
  const call = async (name, args) => {
    const message = await rpc('tools/call', { name, arguments: args });
    if (message.error) return { isError: true, data: message.error };
    return { isError: !!message.result.isError, data: JSON.parse(message.result.content[0].text) };
  };
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve({ code, stderr })));
  return { rpc, notify, call, exited, stop: () => child.stdin.end() };
}

// 1. Ohne Harness-Slug darf der Server nicht starten (fail-closed).
{
  const s = start({ ECC_MEMORY_HARNESS: undefined });
  const { code, stderr } = await s.exited;
  check('Start ohne ECC_MEMORY_HARNESS scheitert', code === 1 && /ECC_MEMORY_HARNESS/.test(stderr), 'rc=' + code);
}

// 2. Ohne Freischaltung bleibt der user-Scope gesperrt.
{
  const s = start({ ECC_MEMORY_HARNESS: 'claude-code', ECC_MEMORY_ALLOW_USER_SCOPE: undefined });
  await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'selftest', version: '1' } });
  s.notify('notifications/initialized');
  const r = await s.call('memory_save', { title: 'gesperrt', body: 'darf nicht landen', scope: 'user' });
  check('user-Scope ohne Freischaltung gesperrt', r.isError && !fs.existsSync(path.join(tmp, 'user')));
  s.stop(); await s.exited;
}

// 3. Der Normalfall - so wie install.sh den Server eintraegt.
const s = start({ ECC_MEMORY_HARNESS: 'claude-code', ECC_MEMORY_ALLOW_USER_SCOPE: '1' });
const init = await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'selftest', version: '1' } });
check('initialize', init.result?.serverInfo?.name === 'ecc-memory-vault');
const early = await s.rpc('tools/list', {});
check('vor initialized-Notification keine Tools', early.error?.code === -32002);
s.notify('notifications/initialized');
const tools = (await s.rpc('tools/list', {})).result.tools.map((t) => t.name).sort().join(',');
check('vier Tools', tools === 'memory_doctor,memory_read,memory_save,memory_search', tools);

const a = await s.call('memory_save', { title: 'Lexware API immer mit finalize', body: 'Ohne finalize=true entsteht nur ein Draft, der nicht automatisierbar ist.', kind: 'decision', scope: 'user', tags: ['lexware'] });
const idA = a.data.memory?.id;
check('save user-Scope', !a.isError && /^mem_/.test(idA || ''));
const fileA = path.join(tmp, 'user', 'decisions', idA + '.md');
check('Datei liegt unter user/decisions/', fs.existsSync(fileA));
check('Datei ist lesbares Markdown mit Frontmatter', fs.existsSync(fileA) && /^---\n[\s\S]*\ntitle: "Lexware API immer mit finalize"\n[\s\S]*\n---\n\nOhne finalize/.test(fs.readFileSync(fileA, 'utf8')));
const b = await s.call('memory_save', { title: 'Promotion nur per cherry-pick', body: 'testing nie direkt nach staging mergen.', scope: 'project', links: [idA] });
check('save project-Scope mit Link', !b.isError);
check('project-Scope legt fail-closed .gitignore an', fs.existsSync(path.join(tmp, 'proj', 'project', '.gitignore')) && fs.readFileSync(path.join(tmp, 'proj', 'project', '.gitignore'), 'utf8') === '*\n!.gitignore\n');

const hit = await s.call('memory_search', { query: 'lexware draft', scopes: ['user', 'project', 'team'] });
check('search findet die Erinnerung', hit.data.results?.length === 1 && hit.data.results[0].memory.id === idA);
const miss = await s.call('memory_search', { query: 'kubernetes', scopes: ['user', 'project', 'team'] });
check('search ohne Treffer bleibt leer', miss.data.results?.length === 0);
const dflt = await s.call('memory_search', { query: 'lexware' });
check('search ohne scopes sieht user NICHT (Default project+team)', dflt.data.results?.length === 0);

const read = await s.call('memory_read', { id: idA, scope: 'user' });
check('read liefert den vollen Body', !read.isError && /Ohne finalize=true/.test(read.data.memory?.body || ''));
check('read liefert die Backlink-Liste', Array.isArray(read.data.backlinks));
check('neue Erinnerungen sind unreviewed', read.data.memory?.trust === 'unreviewed');
const gone = await s.call('memory_read', { id: 'mem_20000101_gibtesnicht', scope: 'user' });
check('read unbekannter ID scheitert sauber', gone.isError && gone.data.error?.code === 'MEMORY_READ_FAILED');

const secret = await s.call('memory_save', { title: 'key', body: 'token ' + 'sk-ant-' + 'api03-' + 'A'.repeat(44), scope: 'user' });
check('Secret wird abgelehnt', secret.isError && /secret/i.test(secret.data.error?.message || ''));
const extra = await s.call('memory_save', { title: 'x', body: 'y', unbekannt: true });
check('unbekannte Argumente werden abgelehnt', extra.isError);

const doctor = await s.call('memory_doctor', { scopes: ['user', 'project', 'team'] });
check('doctor gruen mit 2 Erinnerungen', doctor.data.ok === true && doctor.data.memoryCount === 2, JSON.stringify(doctor.data));
s.stop(); await s.exited;

console.log('  ' + pass + ' gruen, ' + failed + ' rot');
process.exit(failed === 0 ? 0 : 1);
