type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const configuredLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

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

  if (level === 'error') {
    console.error(json);
  } else if (level === 'warn') {
    console.warn(json);
  } else {
    console.log(json);
  }
}

export const logger = {
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
};
