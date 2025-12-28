type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

function getLogLevel(): LogLevel {
  const envLevel = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined
  if (envLevel && envLevel in LEVEL_PRIORITY) {
    return envLevel
  }
  return import.meta.env.DEV ? 'debug' : 'error'
}

const currentLevel = getLogLevel()

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel]
}

export const logger = {
  debug: (...args: unknown[]) => shouldLog('debug') && console.debug('[DEBUG]', ...args),
  info: (...args: unknown[]) => shouldLog('info') && console.info('[INFO]', ...args),
  warn: (...args: unknown[]) => shouldLog('warn') && console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => shouldLog('error') && console.error('[ERROR]', ...args),
}
