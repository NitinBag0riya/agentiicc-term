/**
 * Logger Service
 * 
 * Centralized logging with consistent formatting.
 * Replaces scattered console.log statements.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL as LogLevel];
}

function formatMessage(level: LogLevel, module: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${module}]`;
  
  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }
  return `${prefix} ${message}`;
}

/**
 * Create a logger instance for a specific module
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, context?: LogContext) => {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', module, message, context));
      }
    },

    info: (message: string, context?: LogContext) => {
      if (shouldLog('info')) {
        console.info(formatMessage('info', module, message, context));
      }
    },

    warn: (message: string, context?: LogContext) => {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', module, message, context));
      }
    },

    error: (message: string, error?: Error | LogContext) => {
      if (shouldLog('error')) {
        if (error instanceof Error) {
          console.error(formatMessage('error', module, message, {
            error: error.message,
            stack: error.stack
          }));
        } else {
          console.error(formatMessage('error', module, message, error));
        }
      }
    }
  };
}

// Pre-configured loggers for common modules
export const logger = {
  bot: createLogger('Bot'),
  api: createLogger('API'),
  db: createLogger('Database'),
  ws: createLogger('WebSocket'),
  adapter: createLogger('Adapter'),
  price: createLogger('PriceCache')
};
