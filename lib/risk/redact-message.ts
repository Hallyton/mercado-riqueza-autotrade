const SENSITIVE_PATTERNS = [
  "bearer ",
  "authorization",
  "master_ea_api_secret",
  "auth_secret",
  "database_url",
  "activation_code",
  "postgres://",
  "password",
  "secret",
  "token",
];

export function redactSensitiveMessage(
  message: string | undefined | null
): string | undefined {
  if (!message) return undefined;
  const lowered = message.toLowerCase();
  if (SENSITIVE_PATTERNS.some((p) => lowered.includes(p))) {
    return "[REDACTED]";
  }
  return message.slice(0, 2000);
}
