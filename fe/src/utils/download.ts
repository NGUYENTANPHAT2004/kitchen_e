export function downloadCsv(
  filename: string,
  rows: (string | number | null | undefined)[][]
) {
  const quote = (value: string | number | null | undefined) => {
    const raw = String(value ?? "");
    const safe = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const blob = new Blob(
    ["\uFEFF", rows.map((row) => row.map(quote).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
