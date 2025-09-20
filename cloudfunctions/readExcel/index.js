const cloud = require("wx-server-sdk");
const XLSX = require("xlsx");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const FILE_PATH = "data/b.xlsx";
const COLLECTION = "excel_records";

const LABEL_MAP = {
  patientName: ["姓名"],
  gender: ["性别"],
  admissionDate: ["入住时间"],
  caregivers: ["入住人"],
  birthDate: ["患儿基本信息_出生日期"],
  nativePlace: ["患儿基本信息_籍贯"],
  ethnicity: ["患儿基本信息_民族"],
  idNumber: ["患儿基本信息_身份证号"],
  hospital: ["就诊情况_就诊医院"],
  diagnosis: ["就诊情况_医院诊断"],
  doctor: ["就诊情况_医生姓名"],
  symptoms: ["医疗情况_症状详情"],
  treatmentProcess: ["医疗情况_医治过程"],
  followUpPlan: ["医疗情况_后续治疗安排"],
  address: ["家庭基本情况_家庭地址"],
  fatherInfo: ["家庭基本情况_父亲姓名、电话、身份证号"],
  motherInfo: ["家庭基本情况_母亲姓名、电话、身份证号"],
  otherGuardian: ["家庭基本情况_其他监护人"],
  familyEconomy: ["家庭基本情况_家庭经济"],
  hospitalAdditional: ["就诊情况_医院诊断", "医院诊断"],
  diagnosisAdditional: ["医疗情况_症状详情", "症状详情"]
};

async function downloadExcelBuffer(filePath) {
  const { ENV } = cloud.getWXContext();
  const fileID = ENV ? `cloud://${ENV}/${filePath}` : filePath;
  const { fileContent } = await cloud.downloadFile({ fileID });
  return fileContent;
}

function buildLabelIndex(headers, subHeaders) {
  const index = new Map();
  for (let i = 0; i < Math.max(headers.length, subHeaders.length); i += 1) {
    const top = (headers[i] || "").toString().trim();
    const sub = (subHeaders[i] || "").toString().trim();
    const candidates = [];
    if (top && sub) {
      candidates.push(`${top}_${sub}`);
    }
    if (top) {
      candidates.push(top);
    }
    if (sub) {
      candidates.push(sub);
    }
    candidates.push(`col_${i + 1}`);
    candidates.forEach((label) => {
      if (label && !index.has(label)) {
        index.set(label, i);
      }
    });
  }
  return index;
}

function normalizeValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function parseDateValue(value) {
  const str = normalizeValue(value);
  if (!str) {
    return { text: "", timestamp: 0 };
  }
  const normalized = str.replace(/[./]/g, "-");
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) {
    return { text: str, timestamp: date.getTime() };
  }
  return { text: str, timestamp: 0 };
}

function getFieldValue(row, labelIndex, labels) {
  for (const label of labels) {
    const idx = labelIndex.get(label);
    if (idx !== undefined) {
      return normalizeValue(row[idx]);
    }
  }
  return "";
}

function extractRecords(rows, labelIndex) {
  const records = [];
  rows.forEach((row, rawIndex) => {
    const patientName = getFieldValue(row, labelIndex, LABEL_MAP.patientName);
    if (!patientName) {
      return;
    }
    const idNumber = getFieldValue(row, labelIndex, LABEL_MAP.idNumber);
    const birthDate = getFieldValue(row, labelIndex, LABEL_MAP.birthDate);
    const key = idNumber || `${patientName}_${birthDate || rawIndex}`;
    const admissionInfo = parseDateValue(getFieldValue(row, labelIndex, LABEL_MAP.admissionDate));

    records.push({
      key,
      patientName,
      gender: getFieldValue(row, labelIndex, LABEL_MAP.gender),
      birthDate,
      nativePlace: getFieldValue(row, labelIndex, LABEL_MAP.nativePlace),
      ethnicity: getFieldValue(row, labelIndex, LABEL_MAP.ethnicity),
      idNumber,
      caregivers: getFieldValue(row, labelIndex, LABEL_MAP.caregivers),
      admissionDate: admissionInfo.text,
      admissionTimestamp: admissionInfo.timestamp,
      hospital: getFieldValue(row, labelIndex, LABEL_MAP.hospital),
      diagnosis: getFieldValue(row, labelIndex, LABEL_MAP.diagnosis),
      doctor: getFieldValue(row, labelIndex, LABEL_MAP.doctor),
      symptoms: getFieldValue(row, labelIndex, LABEL_MAP.symptoms),
      treatmentProcess: getFieldValue(row, labelIndex, LABEL_MAP.treatmentProcess),
      followUpPlan: getFieldValue(row, labelIndex, LABEL_MAP.followUpPlan),
      address: getFieldValue(row, labelIndex, LABEL_MAP.address),
      fatherInfo: getFieldValue(row, labelIndex, LABEL_MAP.fatherInfo),
      motherInfo: getFieldValue(row, labelIndex, LABEL_MAP.motherInfo),
      otherGuardian: getFieldValue(row, labelIndex, LABEL_MAP.otherGuardian),
      familyEconomy: getFieldValue(row, labelIndex, LABEL_MAP.familyEconomy),
      rawRowIndex: rawIndex + 1
    });
  });
  return records;
}

function buildPatientGroups(records) {
  const groups = new Map();
  records.forEach((record) => {
    if (!record.key) {
      return;
    }
    if (!groups.has(record.key)) {
      groups.set(record.key, {
        key: record.key,
        patientName: record.patientName,
        gender: record.gender,
        idNumber: record.idNumber,
        birthDate: record.birthDate,
        nativePlace: record.nativePlace,
        ethnicity: record.ethnicity,
        caregivers: new Set(),
        records: []
      });
    }
    const group = groups.get(record.key);
    group.records.push(record);
    if (record.caregivers) {
      group.caregivers.add(record.caregivers);
    }
  });

  const summaries = [];
  groups.forEach((group) => {
    group.records.sort((a, b) => (b.admissionTimestamp || 0) - (a.admissionTimestamp || 0));
    const latest = group.records[0] || {};
    summaries.push({
      key: group.key,
      patientName: group.patientName,
      gender: group.gender,
      idNumber: group.idNumber,
      birthDate: group.birthDate,
      nativePlace: group.nativePlace,
      ethnicity: group.ethnicity,
      caregivers: Array.from(group.caregivers).join("、"),
      latestAdmissionDate: latest.admissionDate,
      latestDiagnosis: latest.diagnosis,
      latestHospital: latest.hospital,
      admissionCount: group.records.length,
      latestAdmissionTimestamp: latest.admissionTimestamp || 0
    });
  });

  summaries.sort((a, b) => (b.latestAdmissionTimestamp || 0) - (a.latestAdmissionTimestamp || 0));

  return {
    summaries,
    groups
  };
}

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, sheetStubs: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { sheetName: "", headers: [], subHeaders: [], rows: [] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  const headers = rows[0] || [];
  const subHeaders = rows[1] || [];
  const dataRows = rows.slice(2);
  return { sheetName, headers, subHeaders, rows: dataRows };
}

async function importToDatabase(records) {
  const db = cloud.database();
  const collection = db.collection(COLLECTION);
  await collection.where({}).remove();

  if (!records.length) {
    return { inserted: 0 };
  }

  const timestamp = Date.now();
  const docs = records.map((record, index) => ({
    ...record,
    _importedAt: timestamp,
    _rowIndex: index + 1
  }));

  const batchSize = 100;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    await collection.add({ data: batch });
  }

  return { inserted: docs.length };
}

exports.main = async (event = {}) => {
  try {
    const buffer = await downloadExcelBuffer(FILE_PATH);
    const parsed = parseExcel(buffer);
    const labelIndex = buildLabelIndex(parsed.headers, parsed.subHeaders);
    const records = extractRecords(parsed.rows, labelIndex);
    const { summaries, groups } = buildPatientGroups(records);

    if (event.action === "import") {
      const stats = await importToDatabase(records);
      return {
        action: "import",
        sheetName: parsed.sheetName,
        imported: stats,
        totalPatients: summaries.length
      };
    }

    if (event.action === "detail") {
      const key = event.key;
      if (!key) {
        throw new Error("detail action requires key");
      }
      const group = groups.get(key);
      if (!group) {
        throw new Error("patient not found");
      }
      const latest = group.records[0] || {};
      return {
        patient: {
          key: group.key,
          patientName: group.patientName,
          gender: group.gender,
          idNumber: group.idNumber,
          birthDate: group.birthDate,
          nativePlace: group.nativePlace,
          ethnicity: group.ethnicity,
          caregivers: Array.from(group.caregivers).join("、"),
          latestAdmissionDate: latest.admissionDate,
          latestDiagnosis: latest.diagnosis,
          latestHospital: latest.hospital,
          admissionCount: group.records.length
        },
        records: group.records
      };
    }

    return {
      patients: summaries
    };
  } catch (error) {
    console.error("readExcel error", error);
    throw error;
  }
};
