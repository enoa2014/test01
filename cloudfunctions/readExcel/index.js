const cloud = require("wx-server-sdk");
const XLSX = require("xlsx");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const FILE_PATH = "data/b.xlsx";
const COLLECTION = "excel_records";

async function downloadExcelBuffer(filePath) {
  const { ENV } = cloud.getWXContext();
  const fileID = ENV ? `cloud://${ENV}/${filePath}` : filePath;
  const { fileContent } = await cloud.downloadFile({ fileID });
  return fileContent;
}

function normalizeHeaders(headerRows) {
  const maxLength = headerRows.reduce((max, row) => Math.max(max, row.length), 0);
  const used = new Set();
  const keys = [];

  for (let i = 0; i < maxLength; i += 1) {
    const main = (headerRows[0] && headerRows[0][i]) || "";
    const sub = (headerRows[1] && headerRows[1][i]) || "";
    let base = (sub || main || `col_${i + 1}`).toString().trim();
    if (!base) {
      base = `col_${i + 1}`;
    }
    base = base.replace(/\s+/g, "_").replace(/[^\w-\uFFFF]+/g, "_").replace(/^_+|_+$/g, "");
    if (!base) {
      base = `col_${i + 1}`;
    }
    let key = base;
    let suffix = 1;
    while (used.has(key)) {
      key = `${base}_${suffix += 1}`;
    }
    used.add(key);
    keys.push(key);
  }

  return keys;
}

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, sheetStubs: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], subHeaders: [], rows: [], fieldKeys: [], sheetName: "" };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false
  });

  if (!rows.length) {
    return { headers: [], subHeaders: [], rows: [], fieldKeys: [], sheetName };
  }

  const headers = rows[0] || [];
  const subHeaders = rows[1] || [];
  const dataRows = rows.slice(2).filter((row) => Array.isArray(row) && row.some((cell) => {
    if (cell === undefined || cell === null) {
      return false;
    }
    return String(cell).trim() !== "";
  }));

  const fieldKeys = normalizeHeaders([headers, subHeaders]);

  return {
    headers: headers.map((cell) => (cell === undefined || cell === null ? "" : String(cell))),
    subHeaders: subHeaders.map((cell) => (cell === undefined || cell === null ? "" : String(cell))),
    rows: dataRows.map((row) => row.map((cell) => (cell === undefined || cell === null ? "" : String(cell)))),
    fieldKeys,
    sheetName
  };
}

async function importToDatabase(records, fieldKeys) {
  if (!records.length) {
    return { removed: 0, inserted: 0 };
  }

  const db = cloud.database();
  const collection = db.collection(COLLECTION);

  // 清空旧数据
  await collection.where({}).remove();

  const timestamp = Date.now();
  const docs = records.map((row, index) => {
    const doc = {
      _importedAt: timestamp,
      _rowIndex: index + 1
    };
    fieldKeys.forEach((key, idx) => {
      doc[key] = row[idx] === undefined ? "" : row[idx];
    });
    return doc;
  });

  const batchSize = 100;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    await collection.add({ data: batch });
  }

  return { removed: docs.length, inserted: docs.length };
}

exports.main = async (event = {}) => {
  try {
    const buffer = await downloadExcelBuffer(FILE_PATH);
    const parsed = parseExcel(buffer);

    if (event.action === "import") {
      const stats = await importToDatabase(parsed.rows, parsed.fieldKeys);
      return {
        action: "import",
        sheetName: parsed.sheetName,
        imported: stats,
        fieldKeys: parsed.fieldKeys
      };
    }

    return {
      headers: parsed.headers,
      subHeaders: parsed.subHeaders,
      rows: parsed.rows,
      meta: {
        sheetName: parsed.sheetName,
        fieldKeys: parsed.fieldKeys,
        filePath: FILE_PATH
      }
    };
  } catch (error) {
    console.error("readExcel error", error);
    throw error;
  }
};
