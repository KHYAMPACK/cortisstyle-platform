import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crc32, deflateRawSync } from "node:zlib";
import { parseSharedStrings, parseSheetRows, readXlsxFirstSheet, readZipEntries } from "./xlsxRead";

/** A minimal zip writer, enough to build a tiny .xlsx for the tests. */
function zip(files: Record<string, string>, deflate = true): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, "utf8");
    const body = deflate ? deflateRawSync(data) : data;
    const nameBuffer = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);
    offset += 30 + nameBuffer.length + body.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

const SHARED = `<?xml version="1.0"?><sst><si><t>URUNADI</t></si><si><t>Tatlı &amp; Paket</t></si><si><r><t>Zey</t></r><r><t>tin</t></r></si><si><t xml:space="preserve">&#x15f;</t></si></sst>`;
const SHEET = `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Fiyat</t></is></c><c r="D1"><v>12.5</v></c></row>
<row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2" t="s"><v>2</v></c><c r="D2" t="s"><v>3</v></c></row>
</sheetData></worksheet>`;

describe("xlsx reading", () => {
  it("reads shared strings, including rich runs and entities", () => {
    assert.deepEqual(parseSharedStrings(SHARED), ["URUNADI", "Tatlı & Paket", "Zeytin", "ş"]);
  });

  it("reads rows with sparse cells, numbers and inline strings", () => {
    const rows = parseSheetRows(SHEET, parseSharedStrings(SHARED));
    assert.deepEqual(rows, [
      ["URUNADI", "Fiyat", "", "12.5"],
      ["Tatlı & Paket", "", "Zeytin", "ş"],
    ]);
  });

  it("reads a whole file, deflated or stored", () => {
    for (const deflate of [true, false]) {
      const file = zip(
        { "xl/sharedStrings.xml": SHARED, "xl/worksheets/sheet1.xml": SHEET, "[Content_Types].xml": "<x/>" },
        deflate,
      );
      assert.equal(readZipEntries(file).size, 3);
      assert.deepEqual(readXlsxFirstSheet(file)[1], ["Tatlı & Paket", "", "Zeytin", "ş"]);
    }
  });

  it("refuses something that is not a zip", () => {
    assert.throws(() => readZipEntries(Buffer.from("just some text, not a zip file at all")), /Not a zip/);
  });
});
