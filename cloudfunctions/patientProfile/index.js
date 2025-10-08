const cloud = require('wx-server-sdk');
const ExcelJS = require('exceljs');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const {
  normalizeValue,
  normalizeSpacing,
  normalizeTimestamp,
  ensureCollectionExists,
  buildPatientGroups,
  parseFamilyContact,
  toIntakeRecordKey,
} = require('./utils/patient');

// Collection names
const EXCEL_RECORDS_COLLECTION = 'excel_records';
const EXCEL_CACHE_COLLECTION = 'excel_cache';
const PATIENTS_COLLECTION = 'patients';
const PATIENT_INTAKE_COLLECTION = 'patient_intake_records';
const PATIENT_MEDIA_COLLECTION = 'patient_media';
const PATIENT_MEDIA_QUOTA_COLLECTION = 'patient_media_quota';
const PATIENT_OPERATION_LOGS_COLLECTION = 'patient_operation_logs';
const PATIENT_CACHE_DOC_ID = 'patients_summary_cache';
const PATIENT_LIST_CACHE_TTL = 5 * 60 * 1000;
const DEFAULT_PATIENT_LIST_LIMIT = 80;
const MAX_PATIENT_LIST_LIMIT = 200;
const EXPORT_TEMPLATE_FILE_ID =
  'cloud://cloud1-6g2fzr5f7cf51e38.636c-cloud1-6g2fzr5f7cf51e38-1375978325/data/b.xlsx';
const EXPORT_CLOUD_DIR = 'exports';

// Utility functions
function makeError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}
function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function firstDefined() {
  for (let i = 0; i < arguments.length; i += 1) {
    const value = arguments[i];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function mapGenderLabel(value) {
  const text = normalizeSpacing(value).toLowerCase();
  if (!text) {
    return '';
  }
  const maleValues = ['m', 'male', 'man', '男', '男性'];
  const femaleValues = ['f', 'female', 'woman', '女', '女性'];
  if (maleValues.indexOf(text) >= 0) {
    return '男';
  }
  if (femaleValues.indexOf(text) >= 0) {
    return '女';
  }
  return value || '';
}

function formatDateText(value) {
  const text = normalizeSpacing(value);
  if (!text) {
    return '';
  }
  if (/^\d{4}[.\/年-]\d{1,2}[.\/月-]\d{1,2}/.test(text)) {
    return text.replace(/[年\/-]/g, '.').replace(/月/g, '.').replace(/日/g, '');
  }
  const date = new Date(text);
  if (isNaN(date.getTime())) {
    return text;
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return year + '.' + month + '.' + day;
}

function prefer() {
  for (let i = 0; i < arguments.length; i += 1) {
    const value = arguments[i];
    const normalized = normalizeSpacing(value);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function buildPatientDocFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const normalize = value => normalizeSpacing(value);
  const key = normalize(snapshot.key);
  const recordKey = normalize(snapshot.recordKey) || key;
  const patientKey = normalize(snapshot.patientKey) || recordKey || key;

  const doc = {
    key,
    recordKey,
    patientKey,
    patientName: normalize(snapshot.patientName || snapshot.name),
    gender: normalize(snapshot.gender),
    genderLabel: normalize(snapshot.genderLabel || snapshot.gender),
    birthDate: normalize(snapshot.birthDate),
    nativePlace: normalize(snapshot.nativePlace),
    ethnicity: normalize(snapshot.ethnicity),
    idNumber: normalize(snapshot.idNumber),
    latestHospital: normalize(snapshot.latestHospital),
    firstHospital: normalize(snapshot.firstHospital),
    latestDiagnosis: normalize(snapshot.latestDiagnosis),
    firstDiagnosis: normalize(snapshot.firstDiagnosis),
    latestDoctor: normalize(snapshot.latestDoctor),
    summaryCaregivers: normalize(snapshot.summaryCaregivers || snapshot.caregivers),
    caregivers: normalize(snapshot.caregivers),
    address: normalize(snapshot.address),
    fatherInfo: normalize(snapshot.fatherInfo),
    motherInfo: normalize(snapshot.motherInfo),
    otherGuardian: normalize(snapshot.otherGuardian),
    familyEconomy: normalize(snapshot.familyEconomy),
    familyEconomyRaw: normalize(snapshot.familyEconomy),
    fatherInfoRaw: normalize(snapshot.fatherInfo),
    motherInfoRaw: normalize(snapshot.motherInfo),
    otherGuardianRaw: normalize(snapshot.otherGuardian),
    latestAdmissionDateFormatted: normalize(
      snapshot.latestAdmissionDateFormatted || snapshot.latestAdmissionDate
    ),
    latestAdmissionDate: normalize(snapshot.latestAdmissionDate || snapshot.latestAdmissionDateFormatted),
    firstAdmissionDateFormatted: normalize(
      snapshot.firstAdmissionDateFormatted || snapshot.firstAdmissionDate
    ),
    firstAdmissionDate: normalize(snapshot.firstAdmissionDate || snapshot.firstAdmissionDateFormatted),
    symptoms: normalize(snapshot.symptoms || (snapshot.lastIntakeNarrative && snapshot.lastIntakeNarrative.symptoms)),
    treatmentProcess: normalize(
      snapshot.treatmentProcess ||
        (snapshot.lastIntakeNarrative && snapshot.lastIntakeNarrative.treatmentProcess)
    ),
    followUpPlan: normalize(
      snapshot.followUpPlan || (snapshot.lastIntakeNarrative && snapshot.lastIntakeNarrative.followUpPlan)
    ),
    latestAdmissionTimestamp: normalizeTimestamp(
      snapshot.latestAdmissionTimestamp || snapshot.admissionTimestamp || snapshot.intakeTimestamp
    ),
    firstAdmissionTimestamp: normalizeTimestamp(snapshot.firstAdmissionTimestamp),
  };

  const contactSet = new Set();
  const contacts = [];
  const addContact = (role, rawValue) => {
    const normalizedRaw = normalize(rawValue);
    if (!normalizedRaw) {
      return;
    }
    const segments =
      role === 'other'
        ? normalizedRaw
            .replace(/[、，,]/g, '、')
            .split('、')
            .map(item => normalize(item))
            .filter(Boolean)
        : [normalizedRaw];

    segments.forEach(segment => {
      const parsed = typeof parseFamilyContact === 'function' ? parseFamilyContact(segment, role) : null;
      const contact = parsed || {
        role,
        raw: segment,
        name: normalize(segment),
        phone: '',
        idNumber: '',
      };
      const key = [contact.role, contact.name, contact.phone, contact.idNumber]
        .map(value => normalize(value).toLowerCase())
        .join('|');
      if (!key.trim()) {
        return;
      }
      if (!contactSet.has(key)) {
        contactSet.add(key);
        contacts.push(contact);
      }
    });
  };

  addContact('father', snapshot.fatherInfo);
  addContact('mother', snapshot.motherInfo);
  addContact('other', snapshot.otherGuardian);

  if (Array.isArray(snapshot.familyContacts)) {
    snapshot.familyContacts.forEach(contact => {
      if (!contact || typeof contact !== 'object') {
        return;
      }
      const role = normalize(contact.role) || 'other';
      const raw = normalize(contact.raw || contact.name);
      const parsed = {
        role,
        raw,
        name: normalize(contact.name || raw),
        phone: normalize(contact.phone),
        idNumber: normalize(contact.idNumber),
      };
      const key = [parsed.role, parsed.name, parsed.phone, parsed.idNumber]
        .map(value => normalize(value).toLowerCase())
        .join('|');
      if (key.trim() && !contactSet.has(key)) {
        contactSet.add(key);
        contacts.push(parsed);
      }
    });
  }

  doc.familyContacts = contacts;

  return doc;
}

function buildRecordFromSnapshot(snapshot) {
  const patientDoc = buildPatientDocFromSnapshot(snapshot);
  if (!patientDoc) {
    return null;
  }

  const normalize = value => normalizeSpacing(value);
  const admissionTimestamp = normalizeTimestamp(
    snapshot && (snapshot.admissionTimestamp || snapshot.latestAdmissionTimestamp)
  );
  const intakeTimestamp = normalizeTimestamp(snapshot && snapshot.intakeTimestamp);
  const admissionDate =
    patientDoc.latestAdmissionDate ||
    patientDoc.latestAdmissionDateFormatted ||
    patientDoc.firstAdmissionDate ||
    patientDoc.firstAdmissionDateFormatted;

  const record = {
    key: patientDoc.recordKey || patientDoc.key || patientDoc.patientKey || '',
    recordKey: patientDoc.recordKey || patientDoc.key || patientDoc.patientKey || '',
    patientKey: patientDoc.patientKey || patientDoc.key || '',
    patientName: patientDoc.patientName || '',
    gender: patientDoc.gender || '',
    genderLabel: patientDoc.genderLabel || '',
    admissionDate: admissionDate || '',
    admissionDateRaw: normalize(snapshot && (snapshot.admissionDateRaw || snapshot.latestAdmissionDateRaw)),
    admissionTimestamp: admissionTimestamp !== null ? admissionTimestamp : undefined,
    intakeTimestamp: intakeTimestamp !== null ? intakeTimestamp : undefined,
    birthDate: patientDoc.birthDate || '',
    nativePlace: patientDoc.nativePlace || '',
    ethnicity: patientDoc.ethnicity || '',
    idNumber: patientDoc.idNumber || '',
    hospital: patientDoc.latestHospital || patientDoc.firstHospital || '',
    latestHospital: patientDoc.latestHospital || '',
    firstHospital: patientDoc.firstHospital || '',
    diagnosis: patientDoc.latestDiagnosis || patientDoc.firstDiagnosis || '',
    latestDiagnosis: patientDoc.latestDiagnosis || '',
    firstDiagnosis: patientDoc.firstDiagnosis || '',
    doctor: patientDoc.latestDoctor || '',
    caregivers: patientDoc.summaryCaregivers || patientDoc.caregivers || '',
    summaryCaregivers: patientDoc.summaryCaregivers || '',
    symptoms: patientDoc.symptoms || '',
    treatmentProcess: patientDoc.treatmentProcess || '',
    followUpPlan: patientDoc.followUpPlan || '',
    address: patientDoc.address || '',
    fatherInfo: patientDoc.fatherInfo || '',
    motherInfo: patientDoc.motherInfo || '',
    otherGuardian: patientDoc.otherGuardian || '',
    familyEconomy: patientDoc.familyEconomy || '',
    excelRowIndex: Number(snapshot && snapshot.excelRowIndex) || undefined,
    importOrder: Number(snapshot && snapshot.importOrder) || undefined,
    raw: { cells: [] },
  };

  const baseCells = new Array(20).fill('');
  baseCells[1] = record.patientName;
  baseCells[2] = mapGenderLabel(record.genderLabel || record.gender || '');
  baseCells[3] = formatDateText(record.admissionDate || record.admissionDateRaw || '');
  baseCells[4] = record.caregivers;
  baseCells[5] = formatDateText(record.birthDate || '');
  baseCells[6] = record.nativePlace;
  baseCells[7] = record.ethnicity;
  baseCells[8] = record.idNumber;
  baseCells[9] = record.hospital;
  baseCells[10] = record.diagnosis;
  baseCells[11] = record.doctor;
  baseCells[12] = record.symptoms;
  baseCells[13] = record.treatmentProcess;
  baseCells[14] = record.followUpPlan;
  baseCells[15] = record.address;
  baseCells[16] = record.fatherInfo;
  baseCells[17] = record.motherInfo;
  baseCells[18] = record.otherGuardian;
  baseCells[19] = record.familyEconomy;

  record.raw.cells = baseCells;

  return record;
}

function formatGuardian(name, phone) {
  const normalizedName = normalizeValue(name);
  const normalizedPhone = normalizeValue(phone);
  if (normalizedName && normalizedPhone) {
    return `${normalizedName} ${normalizedPhone}`;
  }
  return normalizedName || normalizedPhone || '';
}

function getRecordOrder(record) {
  if (!record || typeof record !== 'object') {
    return 0;
  }
  if (record.excelRowIndex !== undefined && record.excelRowIndex !== null) {
    return Number(record.excelRowIndex) || 0;
  }
  if (record.importOrder !== undefined && record.importOrder !== null) {
    return Number(record.importOrder) || 0;
  }
  if (record.rowIndex !== undefined && record.rowIndex !== null) {
    return Number(record.rowIndex) || 0;
  }
  return 0;
}

function getRecordTimestamp(record) {
  if (!record || typeof record !== 'object') {
    return 0;
  }
  if (record.admissionTimestamp !== undefined && record.admissionTimestamp !== null) {
    return Number(record.admissionTimestamp) || 0;
  }
  if (record.intakeTimestamp !== undefined && record.intakeTimestamp !== null) {
    return Number(record.intakeTimestamp) || 0;
  }
  return 0;
}

async function fetchPatientDocByKey(rawKey) {
  const normalizedKey = normalizeSpacing(rawKey);
  if (!normalizedKey) {
    return null;
  }

  await ensureCollectionExists(db, PATIENTS_COLLECTION);

  async function tryQuery(promise) {
    try {
      const res = await promise;
      if (res && res.data && res.data.length) {
        const doc = res.data[0];
        const docId = doc._id || doc.patientKey || doc.recordKey || normalizedKey;
        return Object.assign({ _id: docId }, doc);
      }
    } catch (error) {
      // ignore and continue
    }
    return null;
  }

  let doc = await tryQuery(db.collection(PATIENTS_COLLECTION).doc(normalizedKey).get());
  if (doc) {
    return doc;
  }

  doc = await tryQuery(
    db.collection(PATIENTS_COLLECTION).where({ patientKey: normalizedKey }).limit(1).get()
  );
  if (doc) {
    return doc;
  }

  doc = await tryQuery(
    db.collection(PATIENTS_COLLECTION).where({ recordKey: normalizedKey }).limit(1).get()
  );
  if (doc) {
    return doc;
  }

  doc = await tryQuery(
    db.collection(PATIENTS_COLLECTION).where({ excelRecordKeys: normalizedKey }).limit(1).get()
  );
  if (doc) {
    return doc;
  }

  doc = await tryQuery(
    db.collection(PATIENTS_COLLECTION).where({ patientName: normalizedKey }).limit(1).get()
  );
  return doc;
}


async function fetchExcelRecordsByCandidates(candidateKeys) {
  const keys = Array.isArray(candidateKeys) ? candidateKeys.slice() : [];
  const normalizedKeys = [];
  keys.forEach(value => {
    const key = normalizeSpacing(value);
    if (key && normalizedKeys.indexOf(key) === -1) {
      normalizedKeys.push(key);
    }
  });

  if (!normalizedKeys.length) {
    return [];
  }

  await ensureCollectionExists(db, EXCEL_RECORDS_COLLECTION);
  const collection = db.collection(EXCEL_RECORDS_COLLECTION);
  const recordsMap = {};

  function addRecords(docs) {
    if (!Array.isArray(docs)) {
      return;
    }
    docs.forEach(doc => {
      if (doc && doc._id && !recordsMap[doc._id]) {
        recordsMap[doc._id] = doc;
      }
    });
  }

  for (let i = 0; i < normalizedKeys.length; i += 1) {
    const key = normalizedKeys[i];

    try {
      const docRes = await collection.doc(key).get();
      if (docRes && docRes.data) {
        addRecords([{ _id: key, ...docRes.data }]);
      }
    } catch (error) {
      const code = error && (error.errCode !== undefined ? error.errCode : error.code);
      if (code !== -1 && code !== 'DOCUMENT_NOT_FOUND' && code !== 'DATABASE_DOCUMENT_NOT_EXIST') {
        console.warn('fetch excel by id failed', key, error);
      }
    }

    const queryFields = ['key', 'recordKey', 'patientKey', 'excelRecordId'];
    for (let j = 0; j < queryFields.length; j += 1) {
      const field = queryFields[j];
      const filter = {};
      filter[field] = key;
      try {
        const res = await collection.where(filter).limit(1000).get();
        addRecords(res && res.data);
      } catch (error) {
        console.warn('fetch excel records failed', field, key, error);
      }
    }
  }

  const records = Object.keys(recordsMap).map(id => recordsMap[id]);
  records.sort((a, b) => {
    const orderA = getRecordOrder(a);
    const orderB = getRecordOrder(b);
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    const tsA = getRecordTimestamp(a);
    const tsB = getRecordTimestamp(b);
    if (tsA !== tsB) {
      return tsA - tsB;
    }
    const idA = a && a._id ? String(a._id) : '';
    const idB = b && b._id ? String(b._id) : '';
    return idA.localeCompare(idB);
  });

  return records;
}

function buildExportRow(rowIndex, record, patientDoc, fallbackDoc, key) {
  const sourceRecord = record || {};
  const patient = patientDoc || {};
  const fallback = fallbackDoc || {};

  const baseCells =
    sourceRecord.raw && Array.isArray(sourceRecord.raw.cells)
      ? sourceRecord.raw.cells.slice(0, 20)
      : new Array(20).fill('');

  const admissionDate = prefer(
    sourceRecord.admissionDateRaw,
    sourceRecord.admissionDate,
    patient.latestAdmissionDateFormatted,
    patient.latestAdmissionDate,
    fallback.latestAdmissionDateFormatted,
    fallback.latestAdmissionDate,
    patient.firstAdmissionDate,
    fallback.firstAdmissionDate
  );

  const birthDate = prefer(sourceRecord.birthDate, patient.birthDate, fallback.birthDate);

  const caregivers = prefer(
    sourceRecord.caregivers,
    patient.summaryCaregivers,
    patient.caregivers,
    fallback.summaryCaregivers,
    fallback.caregivers,
    Array.isArray(patient.familyContacts)
      ? patient.familyContacts.map(contact => contact.raw || contact.name).join('、')
      : ''
  );

  const symptoms = prefer(sourceRecord.symptoms, patient.symptoms, fallback.symptoms);
  const treatmentProcess = prefer(
    sourceRecord.treatmentProcess,
    patient.treatmentProcess,
    fallback.treatmentProcess
  );
  const followUpPlan = prefer(sourceRecord.followUpPlan, patient.followUpPlan, fallback.followUpPlan);
  const address = prefer(sourceRecord.address, patient.address, fallback.address);
  const fatherInfo = prefer(sourceRecord.fatherInfo, patient.fatherInfo, fallback.fatherInfo);
  const motherInfo = prefer(sourceRecord.motherInfo, patient.motherInfo, fallback.motherInfo);
  const otherGuardian = prefer(
    sourceRecord.otherGuardian,
    patient.otherGuardian,
    fallback.otherGuardian
  );
  const familyEconomy = prefer(
    sourceRecord.familyEconomy,
    patient.familyEconomy,
    fallback.familyEconomy
  );

  const hospital = prefer(
    sourceRecord.hospital,
    patient.latestHospital,
    fallback.latestHospital,
    patient.firstHospital,
    fallback.firstHospital
  );
  const diagnosis = prefer(
    sourceRecord.diagnosis,
    patient.latestDiagnosis,
    fallback.latestDiagnosis,
    patient.firstDiagnosis,
    fallback.firstDiagnosis
  );
  const doctor = prefer(sourceRecord.doctor, patient.latestDoctor, fallback.latestDoctor);

  const gender = prefer(
    sourceRecord.gender,
    patient.gender,
    patient.genderLabel,
    fallback.gender,
    fallback.genderLabel
  );

  const values = baseCells.slice(0, 20);
  while (values.length < 20) {
    values.push('');
  }

  values[0] = rowIndex + 1;
  values[1] = prefer(patient.patientName, fallback.patientName, sourceRecord.patientName, key, values[1]);
  values[2] = mapGenderLabel(gender || values[2]);
  values[3] = formatDateText(admissionDate || values[3]);
  values[4] = caregivers || values[4];
  values[5] = formatDateText(birthDate || values[5]);
  values[6] = prefer(sourceRecord.nativePlace, patient.nativePlace, fallback.nativePlace, values[6]);
  values[7] = prefer(sourceRecord.ethnicity, patient.ethnicity, fallback.ethnicity, values[7]);
  values[8] = prefer(sourceRecord.idNumber, patient.idNumber, fallback.idNumber, values[8]);
  values[9] = hospital || values[9];
  values[10] = diagnosis || values[10];
  values[11] = doctor || values[11];
  values[12] = symptoms || values[12];
  values[13] = treatmentProcess || values[13];
  values[14] = followUpPlan || values[14];
  values[15] = address || values[15];
  values[16] = fatherInfo || values[16];
  values[17] = motherInfo || values[17];
  values[18] = otherGuardian || values[18];
  values[19] = familyEconomy || values[19];

  return values.map(function(item) {
    if (item === undefined || item === null) {
      return '';
    }
    return item;
  });
}

// Load patient list from cache
async function fetchPatientsFromCache(options = {}) {
  const forceRefresh = !!(options && options.forceRefresh);
  const page = Math.max(Number(options && options.page) || 0, 0);
  const includeTotal = !!(options && options.includeTotal);
  const rawLimit = Number(options && options.limit);
  const limit = Math.max(
    1,
    Math.min(
      Number.isFinite(rawLimit) ? rawLimit : DEFAULT_PATIENT_LIST_LIMIT,
      MAX_PATIENT_LIST_LIMIT
    )
  );
  const eligibleForCache = !forceRefresh && page === 0;

  if (eligibleForCache) {
    try {
      await ensureCollectionExists(db, EXCEL_CACHE_COLLECTION);
      const res = await db.collection(EXCEL_CACHE_COLLECTION).doc(PATIENT_CACHE_DOC_ID).get();
      const cached = res && res.data ? res.data : null;
      const cacheAge = cached ? Date.now() - (cached.updatedAt || 0) : Number.MAX_SAFE_INTEGER;

      const cacheHasNativePlace =
        Array.isArray(cached && cached.patients) &&
        cached.patients.every(item =>
          item && Object.prototype.hasOwnProperty.call(item, 'nativePlace')
        );

      if (
        cached &&
        cacheAge < PATIENT_LIST_CACHE_TTL &&
        Array.isArray(cached.patients) &&
        cacheHasNativePlace
      ) {
        const slice = cached.patients.slice(0, limit);
        const totalCount = cached.totalCount !== undefined ? cached.totalCount : slice.length;
        const hasMore = cached.hasMore !== undefined ? cached.hasMore : totalCount > slice.length;
        return {
          patients: slice,
          totalCount,
          hasMore,
          nextPage: hasMore ? 1 : null,
          limit,
        };
      }
    } catch (error) {
      const code = error && (error.errCode !== undefined ? error.errCode : error.code);
      if (code !== -1 && code !== 'DOCUMENT_NOT_FOUND' && code !== 'DATABASE_DOCUMENT_NOT_EXIST') {
        console.warn('Failed to read from cache', error);
      }
    }
  }

  const fresh = await buildPatientsFromDatabase({
    page,
    limit,
    includeTotal,
  });

  if (page === 0) {
    try {
      await ensureCollectionExists(db, EXCEL_CACHE_COLLECTION);
      await db
        .collection(EXCEL_CACHE_COLLECTION)
        .doc(PATIENT_CACHE_DOC_ID)
        .set({
          data: {
            patients: fresh.patients,
            totalCount: fresh.totalCount,
            hasMore: fresh.hasMore,
            limit,
            updatedAt: Date.now(),
          },
        });
    } catch (error) {
      console.warn('Failed to write patient cache', error);
    }
  }

  return fresh;
}

// Build patient list from database
async function buildPatientsFromDatabase(options = {}) {
  await ensureCollectionExists(db, PATIENTS_COLLECTION);

  const page = Math.max(Number(options && options.page) || 0, 0);
  const rawLimit = Number(options && options.limit);
  const limit = Math.max(
    1,
    Math.min(
      Number.isFinite(rawLimit) ? rawLimit : DEFAULT_PATIENT_LIST_LIMIT,
      MAX_PATIENT_LIST_LIMIT
    )
  );
  const includeTotal = !!(options && options.includeTotal);

  const skip = page * limit;

  const res = await db
    .collection(PATIENTS_COLLECTION)
    .orderBy('data.updatedAt', 'desc')
    .skip(skip)
    .limit(limit)
    .field({
      _id: 1,
      key: 1,
      patientKey: 1,
      patientName: 1,
      gender: 1,
      birthDate: 1,
      idNumber: 1,
      phone: 1,
      address: 1,
      backupContact: 1,
      backupPhone: 1,
      nativePlace: 1,
      ethnicity: 1,
      recordKey: 1,
      careStatus: 1,
      checkoutAt: 1,
      checkoutReason: 1,
      checkoutNote: 1,
      'metadata.checkoutAt': 1,
      firstAdmissionDate: 1,
      latestAdmissionDate: 1,
      latestAdmissionTimestamp: 1,
      firstHospital: 1,
      latestHospital: 1,
      latestDoctor: 1,
      firstDiagnosis: 1,
      latestDiagnosis: 1,
      admissionCount: 1,
      summaryCaregivers: 1,
      lastIntakeNarrative: 1,
      'data.firstAdmissionDate': 1,
      'data.latestAdmissionDate': 1,
      'data.latestAdmissionTimestamp': 1,
      'data.firstHospital': 1,
      'data.latestHospital': 1,
      'data.latestDoctor': 1,
      'data.firstDiagnosis': 1,
      'data.latestDiagnosis': 1,
      'data.admissionCount': 1,
      'data.summaryCaregivers': 1,
      'data.lastIntakeNarrative': 1,
      'data.careStatus': 1,
      'data.checkoutAt': 1,
      'data.checkoutReason': 1,
      'data.checkoutNote': 1,
      'data.nativePlace': 1,
      'data.ethnicity': 1,
      'data.data.nativePlace': 1,
      'data.data.ethnicity': 1,
    })
    .get();

  const docs = Array.isArray(res.data) ? res.data : [];
  const summaries = [];

  docs.forEach(doc => {
    const docId = doc._id || doc.key || doc.patientKey;
    const recordKey = doc.recordKey || (doc.metadata && doc.metadata.excelRecordKey);
    const nameKey = recordKey || doc.patientName || doc.key;
    if (!docId || !nameKey) {
      return;
    }

    const data = doc.data && typeof doc.data === 'object' ? doc.data : {};
    const nestedData = data.data && typeof data.data === 'object' ? data.data : {};
    const pickValue = (...candidates) => {
      for (const value of candidates) {
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
      return undefined;
    };

    const dataAdmissionCount = Math.max(
      safeNumber(data.admissionCount),
      safeNumber(nestedData.admissionCount)
    );
    const docAdmissionCount = safeNumber(doc.admissionCount);
    const admissionCount = Math.max(dataAdmissionCount, docAdmissionCount);

    const firstSource = pickValue(
      nestedData.firstAdmissionDate,
      data.firstAdmissionDate,
      doc.firstAdmissionDate
    );
    const firstTs = normalizeTimestamp(firstSource);

    const latestSource = pickValue(
      nestedData.latestAdmissionDate,
      data.latestAdmissionDate,
      doc.latestAdmissionDate
    );
    const latestTimestampSource = pickValue(
      nestedData.latestAdmissionTimestamp,
      data.latestAdmissionTimestamp,
      doc.latestAdmissionTimestamp
    );
    const latestTs = normalizeTimestamp(latestSource);
    const latestTimestamp = normalizeTimestamp(latestTimestampSource) || latestTs;

    const summaryCaregivers =
      pickValue(
        doc.summaryCaregivers,
        doc.caregivers,
        data.summaryCaregivers,
        nestedData.summaryCaregivers
      ) || '';
    const lastNarrative =
      pickValue(
        doc.lastIntakeNarrative,
        data.lastIntakeNarrative,
        nestedData.lastIntakeNarrative
      ) || '';
    let careStatus = pickValue(doc.careStatus, data.careStatus, nestedData.careStatus) || '';
    const checkoutAtSource = pickValue(doc.checkoutAt, data.checkoutAt, nestedData.checkoutAt);
    const checkoutAt = normalizeTimestamp(checkoutAtSource);
    const checkoutReason =
      pickValue(doc.checkoutReason, data.checkoutReason, nestedData.checkoutReason) || '';
    const checkoutNote =
      pickValue(doc.checkoutNote, data.checkoutNote, nestedData.checkoutNote) || '';

    if (!careStatus && checkoutAt) {
      careStatus = 'discharged';
    } else if (
      careStatus === 'in_care' &&
      checkoutAt &&
      latestTimestamp &&
      checkoutAt >= latestTimestamp
    ) {
      careStatus = 'discharged';
    }
    const phone = doc.phone || data.phone || '';
    const address = doc.address || data.address || '';
    const backupContact = doc.backupContact || data.backupContact || '';
    const backupPhone = doc.backupPhone || data.backupPhone || '';

    const nativePlace = normalizeValue(
      pickValue(doc.nativePlace, data.nativePlace, nestedData.nativePlace)
    );
    const ethnicity = normalizeValue(
      pickValue(doc.ethnicity, data.ethnicity, nestedData.ethnicity)
    );
    const excelImportOrder = pickValue(
      doc.excelImportOrder,
      data.excelImportOrder,
      nestedData.excelImportOrder
    );
    const importOrder = pickValue(
      doc.importOrder,
      data.importOrder,
      nestedData.importOrder,
      excelImportOrder
    );

    // 优先从data字段获取诊断和医院信息，如果没有则从doc根级字段获取
    const firstDiagnosis =
      pickValue(data.firstDiagnosis, nestedData.firstDiagnosis, doc.firstDiagnosis) || '';
    const latestDiagnosis =
      pickValue(data.latestDiagnosis, nestedData.latestDiagnosis, doc.latestDiagnosis) || '';
    const firstHospital =
      pickValue(data.firstHospital, nestedData.firstHospital, doc.firstHospital) || '';
    const latestHospital =
      pickValue(data.latestHospital, nestedData.latestHospital, doc.latestHospital) || '';
    const latestDoctor =
      pickValue(data.latestDoctor, nestedData.latestDoctor, doc.latestDoctor) || '';

    summaries.push({
      key: nameKey,
      patientKey: docId,
      recordKey: nameKey,
      needsProfileSync: false,
      patientName: doc.patientName || '',
      gender: doc.gender || '',
      birthDate: doc.birthDate || '',
      idNumber: doc.idNumber || '',
      phone,
      address,
      backupContact,
      backupPhone,
      nativePlace,
      ethnicity,
      excelImportOrder,
      importOrder,
      firstAdmissionDate: firstTs || null,
      latestAdmissionDate: latestTs || null,
      firstDiagnosis,
      latestDiagnosis,
      firstHospital,
      latestHospital,
      latestDoctor,
      admissionCount,
      summaryCaregivers,
      latestAdmissionTimestamp: latestTimestamp || null,
      lastIntakeNarrative: lastNarrative,
      careStatus,
      checkoutAt: checkoutAt || null,
      checkoutReason,
      checkoutNote,
    });
  });

  let totalCount = summaries.length;
  if (!includeTotal && page > 0) {
    totalCount = skip + summaries.length;
  }
  if (includeTotal) {
    try {
      const countRes = await db.collection(PATIENTS_COLLECTION).count();
      if (countRes && typeof countRes.total === 'number') {
        totalCount = countRes.total;
      }
    } catch (error) {
      console.warn('Failed to count patient summaries', error);
    }
  }

  let hasMore = docs.length === limit;
  if (includeTotal && typeof totalCount === 'number') {
    hasMore = skip + docs.length < totalCount;
  }
  const nextPage = hasMore ? page + 1 : null;

  return {
    patients: summaries,
    totalCount,
    hasMore,
    nextPage,
    limit,
  };
}

function normalizeKeyCandidate(value) {
  return normalizeSpacing(value || '');
}

async function findPatientDocForDeletion(options = {}) {
  await ensureCollectionExists(db, PATIENTS_COLLECTION);

  const candidateKeys = new Set();
  const addCandidate = value => {
    const normalized = normalizeKeyCandidate(value);
    if (normalized) {
      candidateKeys.add(normalized);
    }
  };

  addCandidate(options && options.patientKey);
  addCandidate(options && options.recordKey);

  let patientDoc = null;

  const assignFromSnapshot = snapshot => {
    if (!snapshot || !snapshot.data) {
      return false;
    }
    const data = snapshot.data;
    if (Array.isArray(data) && data.length) {
      const doc = data[0];
      const docId = doc._id || doc.id || doc.patientKey || doc.recordKey;
      if (docId) {
        patientDoc = { _id: docId, ...doc };
        return true;
      }
    }
    if (snapshot._id && !patientDoc) {
      patientDoc = { _id: snapshot._id, ...snapshot };
      return true;
    }
    return false;
  };

  for (const key of candidateKeys) {
    try {
      const res = await db.collection(PATIENTS_COLLECTION).doc(key).get();
      if (res && res.data) {
        patientDoc = { _id: key, ...res.data };
        break;
      }
    } catch (error) {
      const code = error && (error.errCode !== undefined ? error.errCode : error.code);
      if (
        code !== -1 &&
        code !== 'DOCUMENT_NOT_FOUND' &&
        code !== 'DATABASE_DOCUMENT_NOT_EXIST'
      ) {
        console.warn('findPatientDoc direct lookup failed', key, error);
      }
    }
  }

  if (!patientDoc) {
    for (const key of candidateKeys) {
      try {
        const res = await db
          .collection(PATIENTS_COLLECTION)
          .where({ recordKey: key })
          .limit(1)
          .get();
        if (assignFromSnapshot(res)) {
          break;
        }
      } catch (error) {
        console.warn('findPatientDoc by recordKey failed', key, error);
      }
    }
  }

  if (!patientDoc) {
    for (const key of candidateKeys) {
      try {
        const res = await db
          .collection(PATIENTS_COLLECTION)
          .where({ excelRecordKeys: key })
          .limit(1)
          .get();
        if (assignFromSnapshot(res)) {
          break;
        }
      } catch (error) {
        console.warn('findPatientDoc by excelRecordKeys failed', key, error);
      }
    }
  }

  if (!patientDoc) {
    for (const key of candidateKeys) {
      try {
        const res = await db
          .collection(PATIENTS_COLLECTION)
          .where({ patientName: key })
          .limit(1)
          .get();
        if (assignFromSnapshot(res)) {
          break;
        }
      } catch (error) {
        console.warn('findPatientDoc by patientName failed', key, error);
      }
    }
  }

  if (!patientDoc) {
    throw makeError('PATIENT_NOT_FOUND', '未找到对应的住户档案');
  }

  const recordKeys = new Set();
  const patientKeys = new Set();

  const pushRecordKey = value => {
    const normalized = normalizeKeyCandidate(value);
    if (normalized) {
      recordKeys.add(normalized);
    }
  };

  const pushPatientKey = value => {
    const normalized = normalizeKeyCandidate(value);
    if (normalized) {
      patientKeys.add(normalized);
    }
  };

  pushRecordKey(options && options.recordKey);
  pushRecordKey(patientDoc.recordKey);
  pushRecordKey(patientDoc.key);
  pushRecordKey(patientDoc.patientName);
  if (Array.isArray(patientDoc.excelRecordKeys)) {
    patientDoc.excelRecordKeys.forEach(pushRecordKey);
  }

  pushPatientKey(options && options.patientKey);
  pushPatientKey(patientDoc._id);
  pushPatientKey(patientDoc.patientKey);
  pushPatientKey(patientDoc.key);

  return {
    patientDoc,
    recordKeys,
    patientKeys,
  };
}

async function deleteExcelRecordsByKeys(recordKeys) {
  const keys = Array.isArray(recordKeys) ? recordKeys.slice() : [];
  const uniqueKeys = keys
    .map(item => normalizeKeyCandidate(item))
    .filter(item => !!item);
  if (!uniqueKeys.length) {
    return 0;
  }

  await ensureCollectionExists(db, EXCEL_RECORDS_COLLECTION);

  let removed = 0;
  const chunkSize = 10;
  for (let i = 0; i < uniqueKeys.length; i += chunkSize) {
    const chunk = uniqueKeys.slice(i, i + chunkSize);
    const condition = { key: _.in(chunk) };
    try {
      const res = await db
        .collection(EXCEL_RECORDS_COLLECTION)
        .where(condition)
        .remove();
      removed += (res && res.stats && res.stats.removed) || 0;
    } catch (error) {
      throw makeError('DELETE_EXCEL_FAILED', '删除Excel导入记录失败', {
        error: error && error.message,
      });
    }
  }

  return removed;
}

async function deleteIntakeRecordsByPatientKeys(patientKeys) {
  const keys = Array.isArray(patientKeys) ? patientKeys.slice() : [];
  const uniqueKeys = keys
    .map(item => normalizeKeyCandidate(item))
    .filter(item => !!item);
  if (!uniqueKeys.length) {
    return 0;
  }

  await ensureCollectionExists(db, PATIENT_INTAKE_COLLECTION);

  try {
    const res = await db
      .collection(PATIENT_INTAKE_COLLECTION)
      .where({ patientKey: _.in(uniqueKeys) })
      .remove();
    return (res && res.stats && res.stats.removed) || 0;
  } catch (error) {
    throw makeError('DELETE_INTAKE_FAILED', '删除入住记录失败', {
      error: error && error.message,
    });
  }
}

async function deletePatientMediaAssets(patientKeysSet) {
  const keys = Array.isArray(patientKeysSet)
    ? patientKeysSet
    : patientKeysSet instanceof Set
      ? Array.from(patientKeysSet)
      : [];
  const uniqueKeys = keys
    .map(item => normalizeKeyCandidate(item))
    .filter(item => !!item);
  if (!uniqueKeys.length) {
    return { mediaRemoved: 0, filesRemoved: 0, quotaRemoved: 0 };
  }

  await ensureCollectionExists(db, PATIENT_MEDIA_COLLECTION);

  const processedKeys = new Set();
  const fileIds = new Set();
  let mediaRemoved = 0;
  let quotaRemoved = 0;

  for (const key of uniqueKeys) {
    if (processedKeys.has(key)) {
      continue;
    }
    processedKeys.add(key);

    let skip = 0;
    const batchSize = 50;
    while (true) {
      let res;
      try {
        res = await db
          .collection(PATIENT_MEDIA_COLLECTION)
          .where({ patientKey: key })
          .skip(skip)
          .limit(batchSize)
          .get();
      } catch (error) {
        console.warn('加载附件以删除失败', key, error);
        break;
      }

      const docs = (res && res.data) || [];
      if (!docs.length) {
        break;
      }

      for (const doc of docs) {
        if (!doc || !doc._id) {
          continue;
        }
        if (doc.storageFileId) {
          fileIds.add(doc.storageFileId);
        }
        if (doc.thumbFileId) {
          fileIds.add(doc.thumbFileId);
        }
        try {
          const removeRes = await db.collection(PATIENT_MEDIA_COLLECTION).doc(doc._id).remove();
          mediaRemoved += (removeRes && removeRes.stats && removeRes.stats.removed) || 0;
        } catch (error) {
          console.warn('删除附件记录失败', doc._id, error);
        }
      }

      if (docs.length < batchSize) {
        break;
      }
      skip += docs.length;
    }

    try {
      await ensureCollectionExists(db, PATIENT_MEDIA_QUOTA_COLLECTION);
      const quotaRes = await db
        .collection(PATIENT_MEDIA_QUOTA_COLLECTION)
        .where({ patientKey: key })
        .remove();
      quotaRemoved += (quotaRes && quotaRes.stats && quotaRes.stats.removed) || 0;
    } catch (error) {
      console.warn('删除附件配额失败', key, error);
    }
  }

  const files = Array.from(fileIds).filter(item => !!item);
  if (files.length) {
    const chunkSize = 50;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      try {
        await cloud.deleteFile({ fileList: chunk });
      } catch (error) {
        console.warn('删除云存储文件失败', chunk, error);
      }
    }
  }

  return {
    mediaRemoved,
    filesRemoved: files.length,
    quotaRemoved,
  };
}

async function invalidatePatientListCache() {
  try {
    await ensureCollectionExists(db, EXCEL_CACHE_COLLECTION);
    await db.collection(EXCEL_CACHE_COLLECTION).doc(PATIENT_CACHE_DOC_ID).remove();
  } catch (error) {
    const code = error && (error.errCode !== undefined ? error.errCode : error.code);
    if (
      code !== -1 &&
      code !== 'DOCUMENT_NOT_FOUND' &&
      code !== 'DATABASE_DOCUMENT_NOT_EXIST'
    ) {
      console.warn('清理患者列表缓存失败', error);
    }
  }
}

async function writeDeletionLog(patientDoc, summary, operator) {
  try {
    await ensureCollectionExists(db, PATIENT_OPERATION_LOGS_COLLECTION);
    await db.collection(PATIENT_OPERATION_LOGS_COLLECTION).add({
      data: {
        patientKey: patientDoc && patientDoc._id,
        type: 'delete',
        createdAt: Date.now(),
        createdBy: operator || '',
        metadata: {
          patientName: patientDoc && patientDoc.patientName,
          recordKey: patientDoc && patientDoc.recordKey,
          removed: summary,
        },
      },
    });
  } catch (error) {
    console.warn('记录住户删除日志失败', patientDoc && patientDoc._id, error);
  }
}

// Fetch patient detail by key
async function fetchPatientDetailByKey(recordKey) {
  if (!recordKey) {
    throw makeError('INVALID_PATIENT_KEY', 'Missing patient identifier');
  }

  const normalizedKey = normalizeSpacing(recordKey);
  const keysToTry = new Set();
  if (normalizedKey) {
    keysToTry.add(normalizedKey);
  }

  await ensureCollectionExists(db, PATIENTS_COLLECTION);

  let patientDoc = null;
  const tryAssignPatientDoc = async queryPromise => {
    try {
      const snapshot = await queryPromise;
      if (snapshot && snapshot.data && snapshot.data.length) {
        const doc = snapshot.data[0];
        const docId = doc._id || doc.id || doc.patientKey || normalizedKey;
        patientDoc = { _id: docId, ...doc };
        if (Array.isArray(patientDoc.excelRecordKeys)) {
          patientDoc.excelRecordKeys.forEach(key => {
            const normalized = normalizeSpacing(key);
            if (normalized) {
              keysToTry.add(normalized);
            }
          });
        }
        if (patientDoc.recordKey) {
          const normalized = normalizeSpacing(patientDoc.recordKey);
          if (normalized) {
            keysToTry.add(normalized);
          }
        }
        if (patientDoc.patientName) {
          const normalized = normalizeSpacing(patientDoc.patientName);
          if (normalized) {
            keysToTry.add(normalized);
          }
        }
      }
    } catch (error) {
      // 忽略这些查询错误，继续尝试其他方式
    }
  };

  // 先尝试按照文档 ID 查找患者档案
  await tryAssignPatientDoc(db.collection(PATIENTS_COLLECTION).doc(normalizedKey).get());

  if (!patientDoc) {
    // 再尝试 excelRecordKeys 包含当前 key 的文档
    await tryAssignPatientDoc(
      db.collection(PATIENTS_COLLECTION).where({ excelRecordKeys: normalizedKey }).limit(1).get()
    );
  }

  if (!patientDoc) {
    // 最后尝试患者姓名匹配
    await tryAssignPatientDoc(
      db.collection(PATIENTS_COLLECTION).where({ patientName: normalizedKey }).limit(1).get()
    );
  }

  await ensureCollectionExists(db, EXCEL_RECORDS_COLLECTION);

  const records = [];
  for (const key of keysToTry) {
    if (!key) {
      continue;
    }
    try {
      const res = await db.collection(EXCEL_RECORDS_COLLECTION).where({ key }).get();
      if (res.data && res.data.length) {
        records.push(...res.data);
      }
    } catch (error) {
      console.warn('patientProfile fetch detail excel lookup failed', key, error);
    }
  }

  if (!records.length) {
    if (patientDoc && patientDoc._id) {
      const fallbackDetail = await fetchFallbackPatientDetail(patientDoc._id);
      if (fallbackDetail) {
        return fallbackDetail;
      }
    }
    throw makeError('PATIENT_NOT_FOUND', 'Patient record missing');
  }

  const groups = buildPatientGroups(records);
  let group = groups.get(normalizedKey);
  if (!group && patientDoc) {
    const candidateKeys = [].concat(
      patientDoc.recordKey || [],
      Array.isArray(patientDoc.excelRecordKeys) ? patientDoc.excelRecordKeys : [],
      patientDoc.patientName || []
    );
    for (const key of candidateKeys) {
      const normalized = normalizeSpacing(key);
      if (normalized && groups.get(normalized)) {
        group = groups.get(normalized);
        break;
      }
    }
  }
  if (!group) {
    const iterator = groups.values().next();
    if (!iterator.done) {
      group = iterator.value;
    }
  }

  if (!group) {
    if (patientDoc && patientDoc._id) {
      const fallbackDetail = await fetchFallbackPatientDetail(patientDoc._id);
      if (fallbackDetail) {
        return fallbackDetail;
      }
    }
    throw makeError('PATIENT_NOT_FOUND', 'Patient information incomplete');
  }

  return formatPatientDetail(group, patientDoc);
}

async function fetchFallbackPatientDetail(patientKey) {
  try {
    await ensureCollectionExists(db, PATIENTS_COLLECTION);
    const patientSnapshot = await db.collection(PATIENTS_COLLECTION).doc(patientKey).get();
    const patientDoc = patientSnapshot && patientSnapshot.data ? patientSnapshot.data : null;
    if (!patientDoc) {
      return null;
    }

    const buildList = (items = []) =>
      items
        .map(([label, value]) => ({ label, value: normalizeValue(value) }))
        .filter(item => item.value);

    const fallbackContacts = [];
    const contactKeys = new Set();
    const addContact = contact => {
      if (!contact || typeof contact !== 'object') {
        return;
      }
      const role = contact.role || 'other';
      const name = normalizeSpacing(contact.name || contact.raw || '');
      const phone = normalizeSpacing(contact.phone || '');
      const idNumber = normalizeSpacing(contact.idNumber || '');
      const raw = normalizeSpacing(
        contact.raw || [name, phone, idNumber].filter(Boolean).join(' ')
      );
      const key = [role, name.replace(/\s+/g, '').toLowerCase(), phone].join('|');
      if (!key.trim()) {
        return;
      }
      if (!contactKeys.has(key)) {
        contactKeys.add(key);
        fallbackContacts.push({ role, name, phone, idNumber, raw });
      }
    };

    const addRawContact = (role, rawValue) => {
      const normalized = normalizeSpacing(rawValue);
      if (!normalized) {
        return;
      }
      const segments =
        role === 'other'
          ? normalized
              .replace(/[、，,]/g, '、')
              .split('、')
              .map(item => normalizeSpacing(item))
              .filter(Boolean)
          : [normalized];
      segments.forEach(segment => {
        const parsed = parseFamilyContact(segment, role);
        if (parsed) {
          addContact(parsed);
        }
      });
    };

    addRawContact(
      'father',
      patientDoc.fatherInfo ||
        formatGuardian(patientDoc.fatherContactName, patientDoc.fatherContactPhone)
    );
    addRawContact(
      'mother',
      patientDoc.motherInfo ||
        formatGuardian(patientDoc.motherContactName, patientDoc.motherContactPhone)
    );
    addRawContact(
      'other',
      patientDoc.guardianInfo ||
        formatGuardian(patientDoc.guardianContactName, patientDoc.guardianContactPhone)
    );
    (Array.isArray(patientDoc.familyContacts) ? patientDoc.familyContacts : []).forEach(addContact);

    const contactToString = contact => {
      if (!contact) {
        return '';
      }
      const parts = [contact.name, contact.phone, contact.idNumber]
        .map(part => normalizeSpacing(part))
        .filter(Boolean);
      if (parts.length) {
        return parts.join(' ');
      }
      return normalizeSpacing(contact.raw || '');
    };

    const patient = {
      key: patientDoc._id || patientKey,
      patientName: patientDoc.patientName || '',
      gender: patientDoc.gender || '',
      birthDate: patientDoc.birthDate || '',
      idNumber: patientDoc.idNumber || '',
      nativePlace: patientDoc.nativePlace || '',
      ethnicity: patientDoc.ethnicity || '',
      latestHospital: patientDoc.latestHospital || '',
      latestDoctor: patientDoc.latestDoctor || '',
      fatherInfo: contactToString(fallbackContacts.find(contact => contact.role === 'father')),
      motherInfo: contactToString(fallbackContacts.find(contact => contact.role === 'mother')),
      otherGuardian: contactToString(fallbackContacts.find(contact => contact.role === 'other')),
      familyEconomy: patientDoc.familyEconomy || '',
      familyContacts: fallbackContacts,
    };

    const basicInfo = buildList([
      ['性别', patientDoc.gender],
      ['出生日期', patientDoc.birthDate],
      ['身份证号', patientDoc.idNumber],
      ['籍贯', patientDoc.nativePlace],
      ['民族', patientDoc.ethnicity],
      ['联系电话', patientDoc.phone],
    ]);

    const familyInfo = buildList([
      ['家庭地址', patientDoc.address],
      ['备用联系人', patientDoc.backupContact],
      ['备用联系电话', patientDoc.backupPhone],
      [
        '父亲联系方式',
        contactToString(fallbackContacts.find(contact => contact.role === 'father')),
      ],
      [
        '母亲联系方式',
        contactToString(fallbackContacts.find(contact => contact.role === 'mother')),
      ],
      ['其他监护人', contactToString(fallbackContacts.find(contact => contact.role === 'other'))],
    ]);

    const economicInfo = buildList([['家庭经济情况', patientDoc.familyEconomy]]);

    let records = [];
    try {
      await ensureCollectionExists(db, PATIENT_INTAKE_COLLECTION);
      const intakeSnapshot = await db
        .collection(PATIENT_INTAKE_COLLECTION)
        .where({ patientKey })
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get();
      records = Array.isArray(intakeSnapshot.data)
        ? intakeSnapshot.data.map(item => ({
            ...item,
            intakeId: item.intakeId || item._id || '',
          }))
        : [];
    } catch (intakeError) {
      console.warn(
        'patientProfile fallback failed to load intake records',
        patientKey,
        intakeError
      );
    }

    return {
      patient,
      basicInfo,
      familyInfo,
      economicInfo,
      familyContacts: fallbackContacts,
      records,
    };
  } catch (error) {
    console.warn('patientProfile fallback failed', patientKey, error);
    return null;
  }
}

// Format patient detail
function formatPatientDetail(group, patientDoc) {
  const latest = group.records[0] || {};

  const pickRecordValue = getter => {
    if (!Array.isArray(group.records)) {
      return '';
    }
    for (const record of group.records) {
      const value = normalizeSpacing(getter(record));
      if (value) {
        return value;
      }
    }
    return '';
  };

  const buildInfoList = (pairs = []) => {
    return pairs
      .map(({ label, value }) => ({ label, value: normalizeValue(value) }))
      .filter(item => item.value);
  };

  const contactsFromGroup = Array.isArray(group.familyContacts) ? group.familyContacts : [];
  const contactsFromPatientDoc =
    patientDoc && Array.isArray(patientDoc.familyContacts) ? patientDoc.familyContacts : [];
  const contactKeys = new Set();
  const mergedContacts = [];

  const addContacts = (list = []) => {
    list.forEach(contact => {
      if (!contact || typeof contact !== 'object') {
        return;
      }
      const role = contact.role || 'other';
      const name = normalizeSpacing(contact.name || contact.raw || '');
      const phone = normalizeSpacing(contact.phone || '');
      const idNumber = normalizeSpacing(contact.idNumber || '');
      const raw = normalizeSpacing(
        contact.raw || [name, phone, idNumber].filter(Boolean).join(' ')
      );
      const key = [role, name.replace(/\s+/g, '').toLowerCase(), phone].join('|');
      if (!key.trim()) {
        return;
      }
      if (!contactKeys.has(key)) {
        contactKeys.add(key);
        mergedContacts.push({ role, name, phone, idNumber, raw });
      }
    });
  };

  addContacts(contactsFromGroup);
  addContacts(contactsFromPatientDoc);

  const contactToString = contact => {
    if (!contact) {
      return '';
    }
    const parts = [contact.name, contact.phone, contact.idNumber]
      .map(part => normalizeSpacing(part))
      .filter(Boolean);
    if (parts.length) {
      return parts.join(' ');
    }
    return normalizeSpacing(contact.raw || '');
  };

  const fatherContact = mergedContacts.find(contact => contact.role === 'father');
  const motherContact = mergedContacts.find(contact => contact.role === 'mother');
  const guardianContact = mergedContacts.find(contact => contact.role === 'other');

  const fatherInfoValue =
    contactToString(fatherContact) ||
    pickRecordValue(record => record.fatherInfo) ||
    (patientDoc &&
      (patientDoc.fatherInfo ||
        formatGuardian(patientDoc.fatherContactName, patientDoc.fatherContactPhone)));

  const motherInfoValue =
    contactToString(motherContact) ||
    pickRecordValue(record => record.motherInfo) ||
    (patientDoc &&
      (patientDoc.motherInfo ||
        formatGuardian(patientDoc.motherContactName, patientDoc.motherContactPhone)));

  const otherGuardianValue =
    contactToString(guardianContact) ||
    pickRecordValue(record => record.otherGuardian) ||
    (patientDoc &&
      (patientDoc.guardianInfo ||
        formatGuardian(patientDoc.guardianContactName, patientDoc.guardianContactPhone)));

  const economicValue =
    pickRecordValue(record => record.familyEconomy) || (patientDoc && patientDoc.familyEconomy);

  const basicInfo = buildInfoList([
    { label: '性别', value: group.gender || latest.gender },
    { label: '出生日期', value: group.birthDate || latest.birthDate },
    { label: '身份证号', value: group.idNumber || latest.idNumber },
    { label: '籍贯', value: group.nativePlace || latest.nativePlace },
    { label: '民族', value: group.ethnicity || latest.ethnicity },
    { label: '主要照护人', value: group.summaryCaregivers },
  ]);

  const familyInfo = buildInfoList([
    {
      label: '家庭地址',
      value: pickRecordValue(record => record.address) || (patientDoc && patientDoc.address),
    },
    { label: '父亲联系方式', value: fatherInfoValue },
    { label: '母亲联系方式', value: motherInfoValue },
    { label: '其他监护人', value: otherGuardianValue },
  ]);

  // Build economic info
  const economicInfo = buildInfoList([{ label: '家庭经济情况', value: economicValue }]);

  // Build medical records
  const dedupeSet = new Set();
  const records = (Array.isArray(group.records) ? group.records : []).reduce(
    (acc, record, index) => {
      if (!record) {
        return acc;
      }

      const admissionDateText = normalizeValue(record.admissionDate);
      const admissionTimestamp = normalizeTimestamp(
        record.admissionTimestamp || record._importedAt || record.updatedAt
      );
      const hospital = normalizeSpacing(record.hospital);
      const diagnosis = normalizeSpacing(record.diagnosis);
      const doctor = normalizeSpacing(record.doctor);
      const symptoms = normalizeSpacing(record.symptoms);
      const treatmentProcess = normalizeSpacing(record.treatmentProcess);
      const followUpPlan = normalizeSpacing(record.followUpPlan);

      const dedupeKey = [
        admissionTimestamp || '',
        admissionDateText,
        hospital,
        diagnosis,
        doctor,
        symptoms,
        treatmentProcess,
        followUpPlan,
      ].join('|');

      if (dedupeSet.has(dedupeKey)) {
        return acc;
      }
      dedupeSet.add(dedupeKey);

      const situationText =
        normalizeSpacing(record.situation) ||
        normalizeSpacing(record.symptoms) ||
        normalizeSpacing(record.treatmentProcess) ||
        normalizeSpacing(record.diagnosis);

      const medicalInfo = {
        hospital,
        diagnosis,
        doctor,
        symptoms,
        treatmentProcess,
        followUpPlan,
      };

      Object.keys(medicalInfo).forEach(key => {
        if (!medicalInfo[key]) {
          delete medicalInfo[key];
        }
      });

      acc.push({
        intakeId: `excel_${group.key || 'patient'}_${index}`,
        intakeTime: admissionTimestamp || null,
        admissionDate: admissionDateText,
        status: 'excel-import',
        hospital,
        diagnosis,
        doctor,
        symptoms,
        treatmentProcess,
        followUpPlan,
        situation: situationText,
        medicalInfo: Object.keys(medicalInfo).length ? medicalInfo : undefined,
        intakeInfo:
          situationText || followUpPlan
            ? {
                intakeTime: admissionTimestamp || null,
                situation: situationText,
                followUpPlan,
              }
            : undefined,
      });

      return acc;
    },
    []
  );

  return {
    patient: {
      key: group.key,
      patientName: group.patientName,
      gender: group.gender || latest.gender || '',
      birthDate: group.birthDate || latest.birthDate || '',
      idNumber: group.idNumber || latest.idNumber || '',
      latestHospital: group.latestHospital,
      latestDoctor: group.latestDoctor,
      fatherInfo: fatherInfoValue || '',
      motherInfo: motherInfoValue || '',
      otherGuardian: otherGuardianValue || '',
      familyEconomy: economicValue || '',
      familyContacts: mergedContacts,
    },
    basicInfo,
    familyInfo,
    economicInfo,
    familyContacts: mergedContacts,
    records,
  };
}

// Handle patient list request
async function handleGetPatientsList(event = {}) {
  const forceRefresh = !!(event && event.forceRefresh);
  const page = Math.max(Number(event && event.page) || 0, 0);
  const pageSize = Number(event && event.pageSize);
  const includeTotal = !!(event && event.includeTotal);

  try {
    const result = await fetchPatientsFromCache({
      forceRefresh,
      page,
      limit: pageSize,
      includeTotal,
    });

    return {
      success: true,
      patients: result.patients,
      totalCount: result.totalCount !== undefined ? result.totalCount : result.patients.length,
      hasMore: result.hasMore,
      nextPage: result.nextPage,
    };
  } catch (error) {
    console.error('Failed to load patient list', error);
    throw makeError('LIST_FAILED', 'Failed to load patient list', { error: error.message });
  }
}

async function handleExportPatients(event = {}) {
  const rawKeys = [];
  if (Array.isArray(event.patientKeys)) {
    for (let i = 0; i < event.patientKeys.length; i += 1) {
      rawKeys.push(event.patientKeys[i]);
    }
  }
  if (event.patientKey) {
    rawKeys.push(event.patientKey);
  }

  const snapshotMap = new Map();
  if (Array.isArray(event.patientSnapshots)) {
    event.patientSnapshots.forEach(snapshot => {
      if (!snapshot || typeof snapshot !== 'object') {
        return;
      }
      const key = normalizeSpacing(snapshot.key || snapshot.patientKey || snapshot.recordKey);
      if (key && !snapshotMap.has(key)) {
        snapshotMap.set(key, snapshot);
      }
    });
  }

  const normalizedKeys = [];
  rawKeys.forEach(value => {
    const key = normalizeSpacing(value);
    if (key && normalizedKeys.indexOf(key) === -1) {
      normalizedKeys.push(key);
    }
  });

  if (!normalizedKeys.length) {
    throw makeError('EXPORT_NO_KEYS', '请先选择需要导出的住户');
  }

  const exportRows = [];
  const missingKeys = [];

  for (let i = 0; i < normalizedKeys.length; i += 1) {
    const key = normalizedKeys[i];
    const snapshot = snapshotMap.get(key);

    let detail = null;
    let fallbackDoc = null;
    try {
      detail = await fetchPatientDetailByKey(key);
    } catch (error) {
      if (error && error.code === 'PATIENT_NOT_FOUND') {
        fallbackDoc = await fetchPatientDocByKey(key);
        if (!fallbackDoc && snapshot) {
          fallbackDoc = buildPatientDocFromSnapshot(snapshot);
        }
      } else {
        throw error;
      }
    }

    const snapshotDoc = buildPatientDocFromSnapshot(snapshot);
    const candidateKeys = [key];

    if (snapshotDoc) {
      candidateKeys.push(snapshotDoc.recordKey);
      candidateKeys.push(snapshotDoc.patientKey);
    }
    if (fallbackDoc) {
      candidateKeys.push(fallbackDoc.recordKey);
      candidateKeys.push(fallbackDoc.patientKey);
    }
    if (detail && detail.patient) {
      candidateKeys.push(detail.patient.recordKey);
      candidateKeys.push(detail.patient.patientKey);
    }
    if (detail && Array.isArray(detail.records)) {
      detail.records.forEach(recordItem => {
        candidateKeys.push(recordItem && recordItem.key);
        candidateKeys.push(recordItem && recordItem.recordKey);
      });
    }

    const excelRecords = await fetchExcelRecordsByCandidates(candidateKeys);
    const recordList = [];
    const recordSeen = new Set();

    const pushRecord = recordItem => {
      if (!recordItem) {
        return;
      }
      const candidateKeys = [
        recordItem._id,
        recordItem.id,
        recordItem.recordKey,
        recordItem.key,
        recordItem.intakeId,
        recordItem.excelRecordId,
        recordItem.excelRowId,
        recordItem && recordItem.metadata && recordItem.metadata.intakeId,
        toIntakeRecordKey(recordItem),
      ];
      let uniqueKey = '';
      for (let idx = 0; idx < candidateKeys.length; idx += 1) {
        const candidate = normalizeSpacing(candidateKeys[idx]);
        if (candidate) {
          uniqueKey = candidate;
          break;
        }
      }
      if (!uniqueKey) {
        uniqueKey = `ts:${getRecordTimestamp(recordItem)}:${recordSeen.size}`;
      }
      const dedupeKey = `${uniqueKey}::${getRecordTimestamp(recordItem)}::${getRecordOrder(
        recordItem
      )}`;
      if (recordSeen.has(dedupeKey)) {
        return;
      }
      recordSeen.add(dedupeKey);
      recordList.push(recordItem);
    };

    excelRecords.forEach(pushRecord);
    if (detail && Array.isArray(detail.records)) {
      detail.records.forEach(pushRecord);
    }

    if (!recordList.length && snapshot) {
      const snapshotRecord = buildRecordFromSnapshot(snapshot);
      pushRecord(snapshotRecord);
    }

    if (recordList.length > 1) {
      recordList.sort((a, b) => {
        const orderA = getRecordOrder(a);
        const orderB = getRecordOrder(b);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        const tsA = getRecordTimestamp(a);
        const tsB = getRecordTimestamp(b);
        if (tsA !== tsB) {
          return tsA - tsB;
        }
        const idA = normalizeSpacing(a && (a._id || a.id || a.recordKey || a.intakeId || ''));
        const idB = normalizeSpacing(b && (b._id || b.id || b.recordKey || b.intakeId || ''));
        return idA.localeCompare(idB);
      });
    }

    if (!recordList.length) {
      missingKeys.push(key);
      continue;
    }

    const patientDoc = Object.assign(
      {},
      snapshotDoc || {},
      fallbackDoc || {},
      detail && detail.patient ? detail.patient : {}
    );
    const mergedFallbackDoc = fallbackDoc || snapshotDoc || {};

    recordList.forEach(recordItem => {
      exportRows.push({
        key,
        record: recordItem,
        patientDoc,
        fallbackDoc: mergedFallbackDoc,
      });
    });
  }

  if (!exportRows.length) {
    throw makeError('EXPORT_NO_DATA', '未找到可导出的住户档案', { missingKeys });
  }

  const template = await cloud.downloadFile({ fileID: EXPORT_TEMPLATE_FILE_ID });
  if (!template || !template.fileContent) {
    throw makeError('EXPORT_TEMPLATE_MISSING', '无法下载导出模板');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(template.fileContent);
  const worksheet = workbook.getWorksheet('Sheet1') || workbook.worksheets[0];
  if (!worksheet) {
    throw makeError('EXPORT_TEMPLATE_INVALID', '导出模板缺少 Sheet1 工作表');
  }

  const dataStartRow = 3;
  const templateRow = worksheet.getRow(dataStartRow);
  const templateStyles = [];
  for (let col = 1; col <= 20; col += 1) {
    const cell = templateRow.getCell(col);
    templateStyles.push(cell && cell.style ? JSON.parse(JSON.stringify(cell.style)) : {});
  }
  const templateHeight = templateRow ? templateRow.height : undefined;

  while (worksheet.rowCount >= dataStartRow) {
    worksheet.spliceRows(dataStartRow, 1);
  }

  exportRows.forEach((item, index) => {
    const values = buildExportRow(index, item.record, item.patientDoc, item.fallbackDoc, item.key);
    const rowNumber = dataStartRow + index;
    const row = index === 0 ? worksheet.getRow(rowNumber) : worksheet.insertRow(rowNumber, []);
    if (templateHeight) {
      row.height = templateHeight;
    }
    for (let col = 0; col < values.length; col += 1) {
      const cell = row.getCell(col + 1);
      cell.value = values[col];
      const style = templateStyles[col];
      if (style) {
        cell.style = JSON.parse(JSON.stringify(style));
      }
    }
  });

  worksheet.getColumn(16).hidden = true;
  worksheet.getColumn(17).hidden = true;

  const buffer = await workbook.xlsx.writeBuffer();
  const fileContent = Buffer.from(buffer);
  const cloudPath = EXPORT_CLOUD_DIR + '/patient-report-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.xlsx';

  const uploadRes = await cloud.uploadFile({
    cloudPath,
    fileContent,
  });

  if (!uploadRes || !uploadRes.fileID) {
    throw makeError('EXPORT_UPLOAD_FAILED', '导出文件上传失败');
  }

  return {
    success: true,
    fileID: uploadRes.fileID,
    exported: exportRows.length,
    missingKeys,
  };
}

// Handle patient detail request
async function handleGetPatientDetail(event) {
  const { key } = event;

  if (!key) {
    throw makeError('INVALID_PATIENT_KEY', 'Missing patient identifier');
  }

  try {
    const patientDetail = await fetchPatientDetailByKey(key);
    return {
      success: true,
      ...patientDetail,
    };
  } catch (error) {
    if (error && error.code === 'PATIENT_NOT_FOUND') {
      const fallbackDetail = await fetchFallbackPatientDetail(key);
      if (fallbackDetail) {
        console.warn('patientProfile detail fallback to patients collection', key);
        return {
          success: true,
          ...fallbackDetail,
        };
      }
    }
    console.error('Failed to load patient detail', key, error);
    if (error && error.code) {
      throw error;
    }
    throw makeError('DETAIL_FAILED', 'Failed to load patient detail', { error: error.message });
  }
}

async function handleDeletePatient(event = {}) {
  const patientKeyInput = event.patientKey;
  const recordKeyInput = event.recordKey;

  if (!patientKeyInput && !recordKeyInput) {
    throw makeError('INVALID_PATIENT_KEY', '缺少住户标识');
  }

  const context = cloud.getWXContext();
  const operator = event.operator || context.OPENID || context.UNIONID || 'mini-program';

  const lookup = await findPatientDocForDeletion({
    patientKey: patientKeyInput,
    recordKey: recordKeyInput,
  });
  const patientDoc = lookup.patientDoc;
  const recordKeys = Array.from(lookup.recordKeys);
  const patientKeys = Array.from(lookup.patientKeys);

  const mediaSummary = await deletePatientMediaAssets(patientKeys);
  const excelRemoved = await deleteExcelRecordsByKeys(recordKeys);
  const intakeRemoved = await deleteIntakeRecordsByPatientKeys(patientKeys);

  let patientRemoved = 0;
  try {
    const res = await db.collection(PATIENTS_COLLECTION).doc(patientDoc._id).remove();
    patientRemoved = (res && res.stats && res.stats.removed) || 0;
  } catch (error) {
    throw makeError('DELETE_PATIENT_FAILED', '删除住户档案失败', {
      error: error && error.message,
    });
  }

  await invalidatePatientListCache();

  const removalSummary = {
    patient: patientRemoved,
    intakeRecords: intakeRemoved,
    excelRecords: excelRemoved,
    mediaRecords: mediaSummary.mediaRemoved,
    mediaFiles: mediaSummary.filesRemoved,
    mediaQuota: mediaSummary.quotaRemoved,
  };

  await writeDeletionLog(patientDoc, removalSummary, operator);

  return {
    success: true,
    patientKey: patientDoc._id,
    removed: removalSummary,
  };
}

// Main function
exports.main = async event => {
  const action = event.action || '';

  try {
    switch (action) {
      case 'list':
        return await handleGetPatientsList(event);
      case 'detail':
        return await handleGetPatientDetail(event);
      case 'delete':
        return await handleDeletePatient(event);
      case 'export':
        return await handleExportPatients(event);
      default:
        throw makeError('UNSUPPORTED_ACTION', `Unsupported action: ${action || 'unknown'}`);
    }
  } catch (error) {
    console.error('patientProfile action failed', action, error);
    return {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Internal service error',
        details: error.details || null,
      },
    };
  }
};
