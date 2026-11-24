/** Build a CSV safe to open in Excel/Sheets (blocks formula injection). */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  return (
    rows
      .map((row) =>
        row
          .map((cell) => {
            let s = cell == null ? "" : String(cell);
            if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\r\n") + "\r\n"
  );
}

export function csvResponse(csv: string, filename: string) {
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "-")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
