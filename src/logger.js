// -----------------------------------------------------------------------------
// Tiny dependency-free logger.
//
// Integration logs are captured by the Gladys supervisor (the container
// stdout / stderr), so writing to the console is enough: it is the main debug
// channel for an external integration.
//
// Set the desired level through the `LOG_LEVEL` environment variable
// (debug | info | warn | error). Defaults to info.
// -----------------------------------------------------------------------------

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function line(level, args) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  const stream = level === 'error' || level === 'warn' ? console.error : console.log;
  stream(prefix, ...args);
}

export const logger = {
  debug: (...args) => currentLevel <= LEVELS.debug && line('debug', args),
  info: (...args) => currentLevel <= LEVELS.info && line('info', args),
  warn: (...args) => currentLevel <= LEVELS.warn && line('warn', args),
  error: (...args) => currentLevel <= LEVELS.error && line('error', args),
};
