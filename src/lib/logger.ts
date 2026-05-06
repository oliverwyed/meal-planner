const KEY = 'mp_logs';
const COST_KEY = 'mp_cost';
const MAX = 100;

// Haiku 4.5 pricing per million tokens
const PRICE_INPUT  = 0.80;
const PRICE_OUTPUT = 4.00;

export interface LogEntry {
  ts: number;
  level: 'info' | 'warn' | 'error';
  ctx: string;
  msg: string;
  data?: Record<string, unknown>;
}

export interface CostEntry {
  ts: number;
  ctx: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

function read(): LogEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

function write(entries: LogEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))); } catch {}
}

function append(entry: LogEntry) {
  write([...read(), entry]);
  const line = `[${new Date(entry.ts).toISOString()}] [${entry.level.toUpperCase()}] [${entry.ctx}] ${entry.msg}`;
  if (entry.level === 'error') console.error(line, entry.data ?? '');
  else if (entry.level === 'warn') console.warn(line, entry.data ?? '');
  else console.log(line, entry.data ?? '');
}

export const log = {
  info:  (ctx: string, msg: string, data?: Record<string, unknown>) => append({ ts: Date.now(), level: 'info',  ctx, msg, data }),
  warn:  (ctx: string, msg: string, data?: Record<string, unknown>) => append({ ts: Date.now(), level: 'warn',  ctx, msg, data }),
  error: (ctx: string, msg: string, data?: Record<string, unknown>) => append({ ts: Date.now(), level: 'error', ctx, msg, data }),
};

export function recordCost(ctx: string, inputTokens: number, outputTokens: number) {
  const costUsd = (inputTokens / 1_000_000) * PRICE_INPUT + (outputTokens / 1_000_000) * PRICE_OUTPUT;
  const entry: CostEntry = { ts: Date.now(), ctx, inputTokens, outputTokens, costUsd };
  try {
    const prev: CostEntry[] = JSON.parse(localStorage.getItem(COST_KEY) ?? '[]');
    localStorage.setItem(COST_KEY, JSON.stringify([...prev, entry]));
  } catch {}
  log.info(ctx, `tokens: ${inputTokens} in / ${outputTokens} out — $${costUsd.toFixed(5)}`);
}

export async function logFetch(ctx: string, url: string, init: RequestInit): Promise<Response> {
  const start = Date.now();
  log.info(ctx, `→ ${init.method ?? 'GET'} ${url}`);
  try {
    const res = await fetch(url, init);
    const ms = Date.now() - start;
    if (res.ok) {
      log.info(ctx, `← ${res.status} (${ms}ms)`);
    } else {
      let body = '';
      try { body = await res.clone().text(); } catch {}
      log.error(ctx, `← ${res.status} (${ms}ms)`, { body: body.slice(0, 500) });
    }
    return res;
  } catch (err: unknown) {
    const ms = Date.now() - start;
    log.error(ctx, `✗ fetch failed (${ms}ms)`, { err: String(err) });
    throw err;
  }
}

export function getLogs(): LogEntry[] { return read(); }
export function getCosts(): CostEntry[] {
  try { return JSON.parse(localStorage.getItem(COST_KEY) ?? '[]'); } catch { return []; }
}
export function getTotalCost(): number {
  return getCosts().reduce((sum, e) => sum + e.costUsd, 0);
}
export function clearLogs() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(COST_KEY); } catch {}
}
