/**
 * Minimal client-side CSV exporter — no third-party dependency.
 * Quotes every cell defensively; strips control chars; UTF-8 BOM for Excel.
 */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s = typeof value === "string" ? value : JSON.stringify(value);
  // strip control chars
  s = s.replace(/[\u0000-\u001f\u007f]/g, " ");
  // escape internal quotes
  s = s.replace(/"/g, '""');
  return `"${s}"`;
}

export function rowsToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns?: Array<keyof T>,
): string {
  if (rows.length === 0) return "";
  const cols = (columns ?? (Object.keys(rows[0]) as Array<keyof T>)) as string[];
  const header = cols.map(escapeCell).join(",");
  const body = rows
    .map((r) => cols.map((c) => escapeCell((r as Record<string, unknown>)[c])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRowsAsCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: Array<keyof T>,
): void {
  downloadCsv(filename, rowsToCsv(rows, columns));
}
