export interface XlsxSheet {
  name: string;
  header: string[];
  rows: (string | number)[][];
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

let crcTable: Uint32Array | undefined;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 0 ? value >>> 1 : (value >>> 1) ^ 0xedb88320;
    }
    crcTable[index] = value >>> 0;
  }
  return crcTable;
}

function crc32(data: Buffer): number {
  const table = getCrcTable();
  let value = 0xffffffff;
  for (const byte of data) {
    value = table[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (~value) >>> 0;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnLetters(column: number): string {
  let value = column;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function sanitizeSheetName(name: string): string {
  return name
    .split("")
    .filter((character) => !"[]:*?/\\".includes(character))
    .join("")
    .slice(0, 31) || "Sheet1";
}

function cellXml(row: number, column: number, value: string | number): string {
  const reference = `${columnLetters(column)}${row}`;
  if (typeof value === "number") {
    return `<c r="${reference}"><v>${value}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const rows = [sheet.header, ...sheet.rows]
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((value, columnIndex) => cellXml(rowIndex + 1, columnIndex + 1, value))
          .join("")}</row>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rows}</sheetData></worksheet>`;
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ` +
    `ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ` +
    `ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>`;
}

function rootRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ` +
    `Target="xl/workbook.xml"/>` +
    `</Relationships>`;
}

function workbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>` +
    `</sheets></workbook>`;
}

function workbookRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ` +
    `Target="worksheets/sheet1.xml"/>` +
    `</Relationships>`;
}

function localFileHeader(entry: ZipEntry, checksum: number): Buffer {
  const name = Buffer.from(entry.name, "utf8");
  const header = Buffer.alloc(30 + name.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0x21, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(entry.data.length, 18);
  header.writeUInt32LE(entry.data.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  name.copy(header, 30);
  return header;
}

function centralDirectoryHeader(entry: ZipEntry, checksum: number, offset: number): Buffer {
  const name = Buffer.from(entry.name, "utf8");
  const header = Buffer.alloc(46 + name.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0x21, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(entry.data.length, 20);
  header.writeUInt32LE(entry.data.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  name.copy(header, 46);
  return header;
}

function endOfCentralDirectory(entryCount: number, directorySize: number, directoryOffset: number): Buffer {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(entryCount, 8);
  record.writeUInt16LE(entryCount, 10);
  record.writeUInt32LE(directorySize, 12);
  record.writeUInt32LE(directoryOffset, 16);
  record.writeUInt16LE(0, 20);
  return record;
}

function zipEntries(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const checksum = crc32(entry.data);
    const localHeader = localFileHeader(entry, checksum);
    localParts.push(localHeader, entry.data);
    centralParts.push(centralDirectoryHeader(entry, checksum, offset));
    offset += localHeader.length + entry.data.length;
  }
  const localData = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  return Buffer.concat([
    localData,
    centralDirectory,
    endOfCentralDirectory(entries.length, centralDirectory.length, localData.length),
  ]);
}

export function buildXlsx(sheet: XlsxSheet): Buffer {
  const name = sanitizeSheetName(sheet.name);
  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml(), "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRelationshipsXml(), "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml(name), "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRelationshipsXml(), "utf8") },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheetXml(sheet), "utf8") },
  ];
  return zipEntries(entries);
}
