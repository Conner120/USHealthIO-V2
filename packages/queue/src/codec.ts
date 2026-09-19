/** JSON codec for payloads. Dates serialize as ISO strings and revive on read. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function encode(value: unknown): string {
  return JSON.stringify(value);
}

export function decode<T>(raw: string): T {
  return JSON.parse(raw, (_k, v) => (typeof v === "string" && ISO_DATE.test(v) ? new Date(v) : v)) as T;
}
