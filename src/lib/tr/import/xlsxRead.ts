/**
 * Reading the first sheet of an .xlsx file (also what Ticimax saves as ".xls") without a
 * spreadsheet library: an .xlsx is a zip of XML files, read here with Node's zlib.
 * Server/scripts only. Values come back as text; empty cells are "".
 */
import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Every file of a zip, by name. Supports stored and deflated entries (all an xlsx uses). */
export function readZipEntries(zip: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let index = zip.length - 22; index >= Math.max(0, zip.length - 66_000); index -= 1) {
    if (zip.readUInt32LE(index) === EOCD_SIGNATURE) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip/xlsx file.");

  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const entries = new Map<string, Buffer>();

  for (let entry = 0; entry < count; entry += 1) {
    if (zip.readUInt32LE(offset) !== CENTRAL_SIGNATURE) throw new Error("Broken zip directory.");
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    if (zip.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) throw new Error("Broken zip entry.");
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const raw = zip.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) entries.set(name, Buffer.from(raw));
    else if (method === 8) entries.set(name, inflateRawSync(raw));
    else throw new Error(`Unsupported zip compression (${method}) for ${name}.`);
  }
  return entries;
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** The shared string table (`xl/sharedStrings.xml`). */
export function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  for (const item of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const text = [...item[1]!.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join("");
    strings.push(decodeXml(text));
  }
  return strings;
}

/** "AB12" → 27 (zero-based column index). */
function columnIndex(reference: string): number {
  let value = 0;
  for (const char of reference.replace(/\d+/g, "")) value = value * 26 + (char.charCodeAt(0) - 64);
  return value - 1;
}

/** The rows of a worksheet as text cells (sparse cells filled with ""). */
export function parseSheetRows(sheetXml: string, strings: readonly string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cell of rowMatch[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1]!;
      const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1];
      if (!reference) continue;
      const type = /\bt="(\w+)"/.exec(attributes)?.[1];
      const body = cell[2] ?? "";
      const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const inline = /<is>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1];
      let text = "";
      if (value !== undefined) text = type === "s" ? (strings[Number(value)] ?? "") : decodeXml(value);
      else if (inline !== undefined) text = decodeXml(inline);
      row[columnIndex(reference)] = text;
    }
    for (let index = 0; index < row.length; index += 1) row[index] ??= "";
    rows.push(row);
  }
  return rows;
}

/** The first worksheet of an .xlsx file, as rows of text. */
export function readXlsxFirstSheet(file: Buffer): string[][] {
  const entries = readZipEntries(file);
  const sheetName =
    [...entries.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort()[0] ?? null;
  if (!sheetName) throw new Error("No worksheet found in the file.");
  const shared = entries.get("xl/sharedStrings.xml");
  const strings = shared ? parseSharedStrings(shared.toString("utf8")) : [];
  return parseSheetRows(entries.get(sheetName)!.toString("utf8"), strings);
}
