/** RFC4180-ish CSV parser. Handles quoted fields, escaped quotes, and CR/LF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  const pushRow = () => {
    const isEmpty = row.length === 1 && row[0] === '' && field === '';
    if (isEmpty && rows.length > 0) return;
    rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      pushRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }

  row.push(field);
  if (row.length > 1 || row[0] !== '' || rows.length === 0) {
    rows.push(row);
  }
  return rows;
}

export function csvHeaderMap(headerRow: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((cell, idx) => {
    map.set(cell.trim().toLowerCase(), idx);
  });
  return map;
}

export function csvCell(row: string[], headers: Map<string, number>, name: string): string {
  const idx = headers.get(name.toLowerCase());
  if (idx == null) return '';
  return (row[idx] ?? '').trim();
}
