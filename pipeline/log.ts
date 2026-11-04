/** Structured JSON-lines logs. Never pass secrets or full source text here. */
export function log(level: 'info' | 'warn' | 'error', msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
  (level === 'error' ? console.error : console.log)(line);
}
