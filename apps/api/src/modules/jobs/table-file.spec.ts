// CSV / XLSX readers and writers used by imports and exports.
import { strToU8, zipSync } from 'fflate';
import { detectFormat, parseCsv, readTable, TableFileError, writeTable } from './table-file';
import { readXlsx, writeXlsx, XLSX_MIME } from './xlsx';

const BOM = String.fromCharCode(0xfeff);

describe('CSV', () => {
  it('separators , ; and tab, quotes, embedded line breaks, CRLF, BOM', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv(`${BOM}nom;prix\r\n"Tapis; grand";12 500\r\n`)).toEqual([
      ['nom', 'prix'],
      ['Tapis; grand', '12 500'],
    ]);
    expect(parseCsv('nom\tprix\nA\t1')).toEqual([
      ['nom', 'prix'],
      ['A', '1'],
    ]);
    expect(parseCsv('nom,note\n"Dit ""bonjour""","ligne 1\nligne 2"')).toEqual([
      ['nom', 'note'],
      ['Dit "bonjour"', 'ligne 1\nligne 2'],
    ]);
  });

  it('readTable: headers, trimmed cells, empty rows dropped', () => {
    const t = readTable(Buffer.from(' Nom , Prix \n\n Tapis , 100 \n,\n'), 'f.csv', 'text/csv');
    expect(t).toEqual({ format: 'csv', headers: ['Nom', 'Prix'], rows: [['Tapis', '100']] });
  });

  it('writeTable: BOM, quoting, formula-injection guard', () => {
    const columns = [
      { header: 'Nom', value: (r: { n: string; p: number | null }) => r.n },
      { header: 'Prix', value: (r: { n: string; p: number | null }) => r.p },
    ];
    const { body, mime, ext } = writeTable('csv', 'S', columns, [
      { n: 'A, "B"', p: 10 },
      { n: '=SUM(A1)', p: null },
      { n: '-5', p: -5 },
    ]);
    expect([mime, ext]).toEqual(['text/csv; charset=utf-8', 'csv']);
    expect(body.toString('utf8')).toBe(`${BOM}Nom,Prix\r\n"A, ""B""",10\r\n'=SUM(A1),\r\n'-5,-5\r\n`);
  });
});

describe('XLSX', () => {
  it('round trip: strings (XML characters, Arabic), numbers, booleans, empty cells', () => {
    const rows = [
      ['Nom', 'Prix', 'Actif', 'Note'],
      ['Thé & café <bio> "x"', 1250, true, null],
      ['منتج', -4, false, ''],
      [null, null, null, 'fin'],
    ];
    expect(readXlsx(writeXlsx('Feuille / 1', rows))).toEqual([
      ['Nom', 'Prix', 'Actif', 'Note'],
      ['Thé & café <bio> "x"', '1250', 'true'],
      ['منتج', '-4', 'false'],
      ['', '', '', 'fin'],
    ]);
  });

  it('reads workbooks written by spreadsheet applications: shared strings, rich text, sparse cells, renamed sheet', () => {
    const head = '<?xml version="1.0" encoding="UTF-8"?>';
    const zip = zipSync({
      'xl/workbook.xml': strToU8(`${head}<workbook xmlns:r="r"><sheets><sheet name="Produits" sheetId="3" r:id="rId7"/></sheets></workbook>`),
      'xl/_rels/workbook.xml.rels': strToU8(`${head}<Relationships><Relationship Id="rId1" Target="styles.xml"/><Relationship Id="rId7" Target="worksheets/feuille.xml"/></Relationships>`),
      'xl/sharedStrings.xml': strToU8(`${head}<sst><si><t>Nom</t></si><si><t>Prix</t></si><si><r><rPr><b/></rPr><t>Tapis </t></r><r><t xml:space="preserve">berb&#232;re</t></r></si><si><t/></si></sst>`),
      'xl/worksheets/feuille.xml': strToU8(
        `${head}<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s" s="4"><v>2</v></c><c r="C2"><v>12500</v></c></row><row r="3"/><row r="4"><c r="B4" t="inlineStr"><is><t>x &amp; y</t></is></c><c r="C4" t="b"><v>1</v></c><c r="D4" s="1"/></row></sheetData></worksheet>`,
      ),
      'xl/styles.xml': strToU8(`${head}<styleSheet/>`),
    });
    expect(readXlsx(Buffer.from(zip))).toEqual([['Nom', 'Prix'], ['Tapis berbère', '', '12500'], [], ['', 'x & y', 'true', '']]);
  });

  it('format detection trusts the content, not the name', () => {
    const xlsx = writeXlsx('S', [['a']]);
    expect(detectFormat('f.xlsx', XLSX_MIME, xlsx)).toBe('xlsx');
    expect(detectFormat('f.xlsx', XLSX_MIME, Buffer.from('a,b'))).toBeNull();
    expect(detectFormat('f.csv', 'text/csv', xlsx)).toBeNull();
    expect(detectFormat('f.csv', 'application/vnd.ms-excel', Buffer.from('a,b'))).toBe('csv');
    expect(detectFormat('f.xls', 'application/vnd.ms-excel', Buffer.from('a,b'))).toBeNull();
    expect(detectFormat('f.pdf', 'application/pdf', Buffer.from('%PDF'))).toBeNull();
    expect(() => readTable(Buffer.from('PK-not-a-real-zip-archive'), 'f.xlsx', XLSX_MIME)).toThrow(TableFileError);
  });

  it('writeTable xlsx is read back by readTable', () => {
    const columns = [
      { header: 'SKU', value: (r: { sku: string; stock: number }) => r.sku },
      { header: 'Stock', value: (r: { sku: string; stock: number }) => r.stock },
    ];
    const { body, mime } = writeTable('xlsx', 'Produits', columns, [
      { sku: 'A-1', stock: 4 },
      { sku: '+33', stock: 0 },
    ]);
    expect(mime).toBe(XLSX_MIME);
    expect(readTable(body, 'export.xlsx', mime)).toEqual({ format: 'xlsx', headers: ['SKU', 'Stock'], rows: [['A-1', '4'], ["'+33", '0']] });
  });
});
