/**
 * Centralized input validation and sanitization for TrueNorth.
 * Used at all system boundaries (API routes, webhooks, CSV imports).
 */

// ---------------------------------------------------------------------------
// String sanitization
// ---------------------------------------------------------------------------

const HTML_TAG_RE = /<[^>]*>/g;

/**
 * Strips HTML tags, trims whitespace, and enforces max length.
 * Returns an empty string for nullish input.
 */
export function sanitizeText(input: string | null | undefined, maxLength = 2000): string {
  if (input == null) return "";
  return input.replace(HTML_TAG_RE, "").trim().slice(0, maxLength);
}

// ---------------------------------------------------------------------------
// Primitive validators
// ---------------------------------------------------------------------------

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const URL_RE =
  /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/**
 * Simple cron: 5 or 6 space-separated fields, each containing digits, *, /, -, or comma.
 */
const CRON_FIELD = /^(?:\*|(?:\d+(?:-\d+)?(?:\/\d+)?))(?:,(?:\*|(?:\d+(?:-\d+)?(?:\/\d+)?)))*$/;

export function validateEmail(email: string): boolean {
  return typeof email === "string" && EMAIL_RE.test(email) && email.length <= 320;
}

export function validateUuid(id: string): boolean {
  return typeof id === "string" && UUID_RE.test(id);
}

export function validateUrl(url: string): boolean {
  return typeof url === "string" && URL_RE.test(url) && url.length <= 2048;
}

export function validateCronExpression(expr: string): boolean {
  if (typeof expr !== "string") return false;
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return false;
  return parts.every((p) => CRON_FIELD.test(p));
}

/**
 * Coerces unknown input to a finite number, or returns null.
 */
export function validateNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Webhook token validation
// ---------------------------------------------------------------------------

/**
 * Webhook tokens must be non-empty strings of 16-256 chars (alphanumeric/dash/underscore).
 */
const WEBHOOK_TOKEN_RE = /^[a-zA-Z0-9_-]{16,256}$/;

export function validateWebhookToken(token: string): boolean {
  return typeof token === "string" && WEBHOOK_TOKEN_RE.test(token);
}

// ---------------------------------------------------------------------------
// Structured validators
// ---------------------------------------------------------------------------

/**
 * Validates that `body` is a non-null object containing all `fields` with truthy values.
 * Returns `{ valid: true, errors: [] }` or `{ valid: false, errors: [...] }`.
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  body: unknown,
  fields: string[]
): { valid: boolean; errors: string[]; data: T } {
  const errors: string[] = [];

  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, errors: ["Request body must be a JSON object"], data: {} as T };
  }

  const obj = body as Record<string, unknown>;
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors, data: obj as T };
}

// ---------------------------------------------------------------------------
// KPI entry validation
// ---------------------------------------------------------------------------

export function validateKpiEntry(
  value: unknown,
  unit?: string
): { valid: boolean; value: number; error?: string } {
  const num = validateNumericValue(value);
  if (num === null) {
    return { valid: false, value: 0, error: "KPI value must be a finite number" };
  }

  // Percentage KPIs should be 0-100 (soft check: allow up to 1000 for growth rates)
  if (unit === "%" && (num < -1000 || num > 1000)) {
    return { valid: false, value: num, error: "Percentage value seems out of range (-1000 to 1000)" };
  }

  // Currency and count should not be negative (allow override if needed)
  if ((unit === "$" || unit === "USD" || unit === "EUR") && num < 0) {
    return { valid: false, value: num, error: "Currency value should not be negative" };
  }

  return { valid: true, value: num };
}

// ---------------------------------------------------------------------------
// Date validation
// ---------------------------------------------------------------------------

/**
 * Validates an ISO 8601 date string. Returns a Date object or null.
 */
export function validateDateString(dateStr: string): Date | null {
  if (typeof dateStr !== "string" || dateStr.length === 0) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  // Sanity: reject dates before 2000 or more than 10 years in the future
  const year = d.getFullYear();
  if (year < 2000 || year > new Date().getFullYear() + 10) return null;
  return d;
}

// ---------------------------------------------------------------------------
// CSV format validation
// ---------------------------------------------------------------------------

/**
 * Validates that a CSV text has the required header columns and at least one data row.
 * Does not parse values — just structural validation.
 */
export function validateCsvStructure(
  text: string,
  requiredColumns: string[]
): { valid: boolean; error?: string } {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { valid: false, error: "CSV content is empty" };
  }

  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    return { valid: false, error: "CSV must have a header row and at least one data row" };
  }

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const missing = requiredColumns.filter(
    (col) => !header.includes(col.toLowerCase())
  );
  if (missing.length > 0) {
    return { valid: false, error: `CSV missing required columns: ${missing.join(", ")}` };
  }

  // Cap row count for safety
  if (lines.length > 10001) {
    return { valid: false, error: "CSV exceeds maximum of 10,000 data rows" };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Search query sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitizes a search query: trims, removes special characters that could
 * interfere with SQL LIKE / trigram queries, and enforces max length.
 */
export function sanitizeSearchQuery(query: string, maxLength = 200): string {
  if (typeof query !== "string") return "";
  return query
    .replace(/[%_\\]/g, "") // Remove SQL LIKE special chars
    .replace(HTML_TAG_RE, "")
    .trim()
    .slice(0, maxLength);
}
