type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const configuredLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

// Axiom cloud logging (free tier: 500MB/month, 30 days retention)
const AXIOM_TOKEN = process.env.AXIOM_TOKEN || '';
const AXIOM_DATASET = process.env.AXIOM_DATASET || 'clean-shop';
const AXIOM_ENABLED = !!AXIOM_TOKEN;

// Buffer for batching Axiom sends (reduces HTTP overhead)
let axiomBuffer: Record<string, unknown>[] = [];
let axiomFlushTimer: ReturnType<typeof setTimeout> | null = null;
const AXIOM_FLUSH_INTERVAL = 5_000; // 5 seconds
const AXIOM_BATCH_SIZE = 50;

async function flushToAxiom() {
  if (axiomBuffer.length === 0) return;

  const batch = axiomBuffer.splice(0);
  try {
    await fetch(`https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AXIOM_TOKEN}`,
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Non-blocking — don't crash the app if Axiom is down
  }
}

function scheduleFlush() {
  if (axiomFlushTimer) return;
  axiomFlushTimer = setTimeout(() => {
    axiomFlushTimer = null;
    flushToAxiom();
  }, AXIOM_FLUSH_INTERVAL);
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[configuredLevel];
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const json = JSON.stringify(entry);

  // Always output to stdout/stderr (captured by Docker/PM2)
  if (level === 'error') {
    console.error(json);
  } else if (level === 'warn') {
    console.warn(json);
  } else {
    console.log(json);
  }

  // Also send to Axiom if configured
  if (AXIOM_ENABLED) {
    axiomBuffer.push({ _time: entry.timestamp, ...entry });
    if (axiomBuffer.length >= AXIOM_BATCH_SIZE) {
      flushToAxiom();
    } else {
      scheduleFlush();
    }
  }
}

export const logger = {
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  /** Force-flush buffered logs to Axiom (call on shutdown) */
  flush: flushToAxiom,
};
