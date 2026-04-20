// Cursor encodes (createdAt, id) so results are stable across inserts.
// Exported so tests can exercise round-tripping directly.

export function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString("base64url");
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const [ts, id] = raw.split("|");
    if (!ts || !id) return null;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return { createdAt: d, id };
  } catch {
    return null;
  }
}
