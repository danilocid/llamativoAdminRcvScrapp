#!/usr/bin/env node
/**
 * Script CLI para disparar una sincronización del RCV desde la terminal.
 *
 * Uso:
 *   npm run sync -- --mes=9 --anio=2026
 *   npm run sync -- --url=http://localhost:3010
 *
 * Autenticación: ninguna (GET /rcv/sincronizar está abierto; el login
 * contra el backend lo hace el servicio).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const file = resolve(ROOT, '.env');
  if (!existsSync(file)) return;

  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    const value = rawValue.replace(/^["']|["']$/g, '');
    if (value.length > 0) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) args[match[1]] = match[2] ?? true;
  }
  return args;
}

async function jsonOrThrow(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message =
      body?.serverResponseMessage || body?.message || response.statusText;
    throw new Error(`HTTP ${response.status}: ${message}`);
  }
  return body;
}

async function main() {
  loadEnv();

  const args = parseArgs(process.argv.slice(2));
  const now = new Date();
  const mes = args.mes || String(now.getMonth() + 1);
  const anio = args.anio || String(now.getFullYear());
  const base = (
    args.url ||
    process.env.SCRAPER_URL ||
    `http://localhost:${process.env.PORT || 3010}`
  ).replace(/\/+$/, '');

  const headers = { 'Content-Type': 'application/json' };

  const url = `${base}/rcv/sincronizar?mes=${mes}&anio=${anio}`;
  console.log(`Sincronizando RCV ${mes}/${anio} -> ${url}`);
  console.log('Esto puede tardar varios minutos...');

  const started = Date.now();
  const response = await fetch(url, { method: 'GET', headers });
  const body = await jsonOrThrow(response);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`Listo en ${seconds}s`);
  console.log(JSON.stringify(body, null, 2));

  if (body.serverResponseCode !== 200) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
