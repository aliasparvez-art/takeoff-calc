// Centralized logger that respects environment
// In production builds, log calls become no-ops to avoid leaking
// debugging info and to reduce performance overhead.
const isDev = process.env.NODE_ENV === 'development';

const logger = {
  log: (...args) => {
    if (isDev) console.log(...args);
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  error: (...args) => {
    if (isDev) console.error(...args);
  },
};

export default logger;
