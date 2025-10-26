#!/usr/bin/env node

/**
 * 将 Excel 数据导出为 JSONL 文件，方便云数据库通过单文件导入。
 * 使用: node scripts/export-excel-jsonl.js --input prepare/b.xlsx --output prepare/b.json
 */

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const XLSX = require('xlsx');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: 'prepare/b.xlsx',
    sheet: null,
    output: 'prepare/b.json',
    batchId: ,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--input' && args[i + 1]) {
      options.input = args[i + 1];
      i += 1;
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i += 1;
    } else if (arg === '--sheet' && args[i + 1]) {
      options.sheet = args[i + 1];
      i += 1;
    } else if (arg === '--batch' && args[i + 1]) {
      options.batchId = args[i + 1];
      i += 1;
    }
  }

  return options;
}

function normalizeValue(value) {
  if (value === undefined || value === null) {
    return '';
  }
  const str = String(value).trim();
  if (!str || str === 'null' || str === 'undefined') {
    return '';
  }
  return str;
}

function normalizeSpacing(value) {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return '';
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

function sanitizeIdentifier(value, fallbackSeed) {
  const base = normalizeSpacing(value);
  if (base) {
    const sanitized = base.replace(/[^a-zA-Z0-9_-]/g, '');
    const meaningful = sanitized.replace(/^excel_?/, '');
    if (sanitized && meaningful) {
      return sanitized;
    }
  }
  const seed = normalizeSpacing(fallbackSeed);
  if (seed) {
    const sanitizedSeed = seed.replace(/[^a-zA-Z0-9_-]/g, '');
    const meaningfulSeed = sanitizedSeed.replace(/^excel_?/, '');
    if (sanitizedSeed && meaningfulSeed) {
      return sanitizedSeed;
    }
  }
  return ;
}

function generateRecordKey(record) {
  const normalizedIdNumber = normalizeSpacing(record && record.idNumber);
  if (normalizedIdNumber) {
    return sanitizeIdentifier(normalizedIdNumber, record && record.patientName);
  }
  const normalizedName = normalizeSpacing(record && record.patientName);
  const normalizedBirth = normalizeSpacing(record && record.birthDate);
  if (normalizedName && normalizedBirth) {
    return sanitizeIdentifier(, normalizedName);
  }
  const rowIndex = record && (record.excelRowIndex || record.importOrder);
  if (normalizedName) {
    return sanitizeIdentifier(normalizedName, );
  }
  if (rowIndex) {
    return sanitizeIdentifier(, );
  }
  return sanitizeIdentifier('', );
}

function parseAdmissionDate(raw) {
  const original = normalizeValue(raw);
  if (!original) {
    return { text: '', timestamp: null };
  }

  const normalized = original
    .replace(/[\/年.]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const cleaned = normalized.replace(/-{2,}/g, '-');

  const patterns = [
    /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/,
    /^([0-9]{1,2})-([0-9]{1,2})-([0-9]{4})$/,
  ];

  for (const regex of patterns) {
    const match = cleaned.match(regex);
    if (match) {
      if (regex === patterns[0]) {
        const [, year, month, day] = match;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        if (!Number.isNaN(date.getTime())) {
          return {
            text: ,
            timestamp: date.getTime(),
          };
        }
      } else {
        const [, month, day, year] = match;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        if (!Number.isNaN(date.getTime())) {
          return {
            text: ,
            timestamp: date.getTime(),
          };
        }
      }
    }
  }

  const fallbackDate = new Date(cleaned);
  if (!Number.isNaN(fallbackDate.getTime())) {
    const year = fallbackDate.getFullYear();
    const month = String(fallbackDate.getMonth() + 1).padStart(2, '0');
    const day = String(fallbackDate.getDate()).padStart(2, '0');
    return {
      text: ,
      timestamp: fallbackDate.getTime(),
    };
  }

  return { text: original, timestamp: null };
}

function isRowEmpty(row) {
  return !row || row.every((cell) => !normalizeValue(cell));
}

function convertRowToRecord(row, rowIndex, meta) {
  if (isRowEmpty(row)) {
    return null;
  }

  const fieldMap = {
    0: 'serialNumber',
    1: 'patientName',
    2: 'gender',
    3: 'admissionDateRaw',
    4: 'caregivers',
    5: 'birthDate',
    6: 'nativePlace',
    7: 'ethnicity',
    8: 'idNumber',
    9: 'hospital',
    10: 'diagnosis',
    11: 'doctor',
    12: 'symptoms',
    13: 'treatmentProcess',
    14: 'followUpPlan',
    15: 'address',
    16: 'fatherInfo',
    17: 'motherInfo',
    18: 'otherGuardian',
    19: 'familyEconomy',
  };

  const record = {};
  Object.entries(fieldMap).forEach(([index, key]) => {
    const value = normalizeSpacing(row[Number(index)]);
    if (value) {
      record[key] = value;
    }
  });

  if (!record.patientName) {
    return null;
  }

  const admission = parseAdmissionDate(record.admissionDateRaw);
  record.admissionDate = admission.text;
  record.admissionTimestamp = admission.timestamp;

  record.excelRowIndex = rowIndex + 1;
  record.importOrder = record.excelRowIndex;
  record.importBatchId = meta.batchId;
  record.source = {
    fileName: meta.fileName,
    sheetName: meta.sheetName,
    rowIndex: rowIndex + meta.dataStartRow,
    exportedAt: meta.exportedAt,
  };

  record.caregivers = record.caregivers || '';
  record.recordKey = generateRecordKey(record);
  record.key = record.recordKey;

  record.raw = {
    cells: row.map((cell) => (cell === undefined || cell === null ? '' : cell)),
  };

  return record;
}

function main() {
  const options = parseArgs();
  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    console.error();
    process.exit(1);
  }

  const workbook = XLSX.readFile(inputPath, { cellDates: true, raw: false });
  const sheetName = options.sheet || workbook.SheetNames[0];
  if (!sheetName) {
    console.error('❌ Excel 文件中未找到工作表');
    process.exit(1);
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    console.error();
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
  if (rows.length <= 2) {
    console.error('❌ 数据行不足，无法生成 JSONL');
    process.exit(1);
  }

  const dataRows = rows.slice(2);
  const outputPath = path.resolve(options.output);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const writable = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  const exportedAt = new Date().toISOString();
  let count = 0;

  dataRows.forEach((row, idx) => {
    const record = convertRowToRecord(row, idx, {
      batchId: options.batchId,
      fileName: path.basename(inputPath),
      sheetName,
      dataStartRow: 3,
      exportedAt,
    });

    if (record) {
      writable.write();
      count += 1;
    }
  });

  writable.end(() => {
    console.log();
    console.log();
    console.log();
    console.log();
  });
}

if (require.main === module) {
  main();
}

module.exports = { parseAdmissionDate, convertRowToRecord };
