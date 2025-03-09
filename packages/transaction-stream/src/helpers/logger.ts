import Pino from 'pino'

export type Logger = ReturnType<typeof createLogger>
export const createLogger = (options?: Parameters<typeof Pino>[0]) =>
  Pino(options)
