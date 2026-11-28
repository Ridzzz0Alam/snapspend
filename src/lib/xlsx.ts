/**
 * Minimal .xlsx writer (D71): an Office Open XML workbook zipped with fflate. Enough for a
 * readable export that Excel and Google Sheets open on a phone: several sheets, bold frozen
 * header with filter, column widths, real dates (dd/mm/yyyy), money as #,##0, quantities.
 * Text uses inline strings, so no shared-strings table is needed.
 */
import { strToU8, zipSync } from 'fflate';

export type CellFormat = 'text' | 'date' | 'money' | 'qty';
export type Cell = string | number | null | undefined | { date: string };

export interface Column {
  header: string;
  format?: CellFormat;
  /** Width in Excel character units. */
  width?: number;
}

export interface SheetSpec {
  name: string;
  columns: Column[];
  rows: Cell[][];
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** ISO date → Excel serial (days since 1899-12-30, the 1900 date system). */
export function excelSerial(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

function esc(s: string): string {
  return (
    s
      // Characters XML 1.0 can't contain at all.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  );
}

/** Excel sheet names: max 31 chars, none of : \ / ? * [ ] */
function sheetName(name: string, index: number): string {
  const clean = name
    .replace(/[:\\/?*[\]]/g, '')
    .slice(0, 31)
    .trim();
  return clean || `Sheet${index + 1}`;
}

// cellXfs indexes in styles.xml
const STYLE = { header: 1, date: 2, money: 3, qty: 4 } as const;

function cellXml(ref: string, value: Cell, format: CellFormat | undefined): string {
  if (value == null || value === '') return '';
  if (typeof value === 'object')
    return `<c r="${ref}" s="${STYLE.date}"><v>${excelSerial(value.date)}</v></c>`;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    const s =
      format === 'money' ? ` s="${STYLE.money}"` : format === 'qty' ? ` s="${STYLE.qty}"` : '';
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  }
  const t = esc(value);
  const space = /^\s|\s$/.test(t) ? ' xml:space="preserve"' : '';
  return `<c r="${ref}" t="inlineStr"><is><t${space}>${t}</t></is></c>`;
}

function sheetXml(sheet: SheetSpec): string {
  const lastCol = columnName(Math.max(0, sheet.columns.length - 1));
  const lastRow = sheet.rows.length + 1;
  const cols = sheet.columns
    .map((c, i) =>
      c.width ? `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>` : '',
    )
    .join('');
  const header = sheet.columns
    .map(
      (c, i) =>
        `<c r="${columnName(i)}1" t="inlineStr" s="${STYLE.header}"><is><t>${esc(c.header)}</t></is></c>`,
    )
    .join('');
  const body = sheet.rows
    .map((row, r) => {
      const cells = sheet.columns
        .map((col, i) => cellXml(`${columnName(i)}${r + 2}`, row[i], col.format))
        .join('');
      return `<row r="${r + 2}">${cells}</row>`;
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData><row r="1">${header}</row>${body}</sheetData>` +
    `<autoFilter ref="A1:${lastCol}${lastRow}"/>` +
    '</worksheet>'
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.###"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

export function buildXlsx(sheets: readonly SheetSpec[]): Uint8Array {
  const names = sheets.map((s, i) => sheetName(s.name, i));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
        '</Relationships>',
    ),
    'docProps/app.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Snap Spend</Application></Properties>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets>' +
        names
          .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('') +
        '</sheets>' +
        '<definedNames>' +
        sheets
          .map((s, i) => {
            const ref = `$A$1:$${columnName(Math.max(0, s.columns.length - 1))}$${s.rows.length + 1}`;
            return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(names[i]!).replace(/'/g, "''")}'!${ref}</definedName>`;
          })
          .join('') +
        '</definedNames>' +
        '</workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(STYLES_XML),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s));
  });
  return zipSync(files, { level: 6 });
}
