import 'server-only'

type Level = 'debug' | 'info' | 'warn' | 'error'

// The line's own fields cannot be overwritten by context.
type Context = {
  err?: unknown
  level?: never
  msg?: never
  time?: never
  [key: string]: unknown
}

type SerializedError = { name: string; message: string; stack?: string; cause?: SerializedError }

// Deep enough for a wrapped driver error; a cause chain cannot recurse forever.
const maxCauseDepth = 3

// Drizzle's failed-query error ends its message, and so its stack's first lines, with
// `\nparams: <values>`: emails, phone numbers, hashes. Only the query text is kept; the driver's
// error (the cause) says what went wrong.
const queryParams = /\nparams: [\s\S]*?(?=\n {4}at |$)/

function withoutParams(text: string): string {
  return text.replace(queryParams, '')
}

function serializeError(err: unknown, depth = 1): SerializedError {
  if (!(err instanceof Error)) return { name: 'NonError', message: stringifyThrown(err) }
  const serialized: SerializedError = {
    name: err.name,
    message: withoutParams(err.message),
    stack: err.stack === undefined ? undefined : withoutParams(err.stack),
  }
  if (err.cause !== undefined && depth < maxCauseDepth) {
    serialized.cause = serializeError(err.cause, depth + 1)
  }
  return serialized
}

function stringifyThrown(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

function write(level: Level, msg: string, context: Context = {}) {
  if (level === 'debug' && process.env.NODE_ENV === 'production') return
  const { err, ...fields } = context
  const base = { level, msg, time: new Date().toISOString() }
  const error = err === undefined ? {} : { err: serializeError(err) }
  let line: string
  try {
    line = JSON.stringify({ ...base, ...fields, ...error })
  } catch {
    // Circular or BigInt context must not turn logging a failure into a new failure.
    line = JSON.stringify({ ...base, ...error, context: 'unserialisable' })
  }
  console[level](line)
}

/** Structured server logging: one JSON line per call, so logs can be searched and parsed. */
export const logger = {
  debug: (msg: string, context?: Context) => write('debug', msg, context),
  info: (msg: string, context?: Context) => write('info', msg, context),
  warn: (msg: string, context?: Context) => write('warn', msg, context),
  error: (msg: string, context?: Context) => write('error', msg, context),
}
