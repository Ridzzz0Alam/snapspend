/**
 * @jest-environment node
 */
import { strFromU8, unzipSync } from 'fflate';

import { buildXlsx, columnName, excelSerial } from '@/lib/xlsx';

function files(bytes: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, data] of Object.entries(unzipSync(bytes))) out[name] = strFromU8(data);
  return out;
}

describe('helpers', () => {
  it('column names', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual([
      'A',
      'B',
      'Z',
      'AA',
      'AB',
      'AZ',
      'BA',
      'ZZ',
      'AAA',
    ]);
  });

  it('Excel date serials (days since 1899-12-30)', () => {
    expect(excelSerial('1900-03-01')).toBe(61);
    expect(excelSerial('2026-01-01')).toBe(46023);
    expect(excelSerial('2026-11-28')).toBe(46354);
  });
});

describe('buildXlsx', () => {
  const bytes = buildXlsx([
    {
      name: 'Items',
      columns: [
        { header: 'Date', format: 'date', width: 12 },
        { header: 'Item', width: 30 },
        { header: 'Qty', format: 'qty' },
        { header: 'Total (Ft)', format: 'money' },
      ],
      rows: [
        [{ date: '2026-11-28' }, 'Milk & "cheese" <1L>', 0.792, 1059],
        [{ date: '2026-11-27' }, 'Túró Rudi', 2, null],
      ],
    },
    { name: 'Receipts / all', columns: [{ header: 'Store' }], rows: [['ALDI']] },
  ]);
  const f = files(bytes);

  it('is a zip with the parts Excel and Google Sheets need', () => {
    expect(Object.keys(f).sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'docProps/app.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
        'xl/worksheets/sheet2.xml',
      ].sort(),
    );
    expect(f['[Content_Types].xml']).toContain('/xl/worksheets/sheet2.xml');
  });

  it('names the sheets, removing characters Excel forbids', () => {
    expect(f['xl/workbook.xml']).toContain('<sheet name="Items" sheetId="1" r:id="rId1"/>');
    expect(f['xl/workbook.xml']).toContain('name="Receipts  all"');
  });

  it('writes a bold header, frozen first row and a filter', () => {
    const s = f['xl/worksheets/sheet1.xml']!;
    expect(s).toContain('<c r="A1" t="inlineStr" s="1"><is><t>Date</t></is></c>');
    expect(s).toContain(
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    );
    expect(s).toContain('<autoFilter ref="A1:D3"/>');
    expect(s).toContain('<col min="2" max="2" width="30" customWidth="1"/>');
  });

  it('writes dates as serials, numbers as numbers, escapes text, skips empty cells', () => {
    const s = f['xl/worksheets/sheet1.xml']!;
    expect(s).toContain('<c r="A2" s="2"><v>46354</v></c>');
    expect(s).toContain(
      '<c r="B2" t="inlineStr"><is><t>Milk &amp; &quot;cheese&quot; &lt;1L&gt;</t></is></c>',
    );
    expect(s).toContain('<c r="C2" s="4"><v>0.792</v></c>');
    expect(s).toContain('<c r="D2" s="3"><v>1059</v></c>');
    expect(s).toContain('<t>Túró Rudi</t>');
    expect(s).not.toContain('r="D3"');
  });

  it('defines the number formats (date dd/mm/yyyy, money #,##0)', () => {
    expect(f['xl/styles.xml']).toContain('formatCode="dd/mm/yyyy"');
    expect(f['xl/styles.xml']).toContain('numFmtId="3"');
  });
});
