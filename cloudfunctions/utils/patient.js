const normalizeValue = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  const str = String(value).trim();
  return str === 'null' || str === 'undefined' ? '' : str;
};

const normalizeSpacing = (value) => {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return '';
  }
  return normalized.replace(/\s+/g, ' ').trim();
};

const normalizeTimestamp = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isNaN(ts) ? null : ts;
  }
  const str = String(value).trim();
  if (!str) {
    return null;
  }
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    return Number.isFinite(num) ? num : null;
  }
  const normalized = str.replace(/[./]/g, '-');
  const date = new Date(normalized);
  const ts = date.getTime();
  return Number.isNaN(ts) ? null : ts;
};

const mergeCaregivers = (base, candidate) => {
  const existing = normalizeSpacing(base);
  const incoming = normalizeSpacing(candidate);
  if (!incoming) {
    return existing;
  }
  if (!existing) {
    return incoming;
  }
  const parts = new Set(existing.split('、').map((item) => normalizeSpacing(item)).filter(Boolean));
  if (!parts.has(incoming)) {
    parts.add(incoming);
  }
  return Array.from(parts).join('、');
};

const ensureRecordTimestamp = (record = {}) => {
  const direct = normalizeTimestamp(record.admissionTimestamp);
  if (direct !== null) {
    return direct;
  }
  const parsedDate = normalizeTimestamp(record.admissionDate);
  if (parsedDate !== null) {
    return parsedDate;
  }
  const imported = normalizeTimestamp(record.importedAt || record._importedAt);
  if (imported !== null) {
    return imported;
  }
  const updated = normalizeTimestamp(record.updatedAt || record.createdAt);
  if (updated !== null) {
    return updated;
  }
  return 0;
};

const buildPatientGroups = (records = []) => {
  const groups = new Map();

  records.forEach((rawRecord) => {
    const patientName = normalizeSpacing(rawRecord && rawRecord.patientName);
    const recordKey = normalizeSpacing(
      (rawRecord && (rawRecord.recordKey || rawRecord.key)) || patientName
    );

    if (!recordKey || !patientName) {
      return;
    }

    let group = groups.get(recordKey);
    if (!group) {
      group = {
        key: recordKey,
        recordKey,
        patientName,
        gender: '',
        birthDate: '',
        nativePlace: '',
        ethnicity: '',
        idNumber: '',
        importOrder: null,
        admissionCount: 0,
        firstAdmissionDate: null,
        latestAdmissionDate: null,
        firstAdmissionTimestamp: null,
        latestAdmissionTimestamp: null,
        firstDiagnosis: '',
        latestDiagnosis: '',
        firstHospital: '',
        latestHospital: '',
        latestDoctor: '',
        summaryCaregivers: '',
        records: [],
      };
      groups.set(recordKey, group);
    }

    if (!group.gender && rawRecord && rawRecord.gender) {
      group.gender = normalizeSpacing(rawRecord.gender);
    }
    if (!group.birthDate && rawRecord && rawRecord.birthDate) {
      group.birthDate = normalizeSpacing(rawRecord.birthDate);
    }
    if (!group.nativePlace && rawRecord && rawRecord.nativePlace) {
      group.nativePlace = normalizeSpacing(rawRecord.nativePlace);
    }
    if (!group.ethnicity && rawRecord && rawRecord.ethnicity) {
      group.ethnicity = normalizeSpacing(rawRecord.ethnicity);
    }
    if (!group.idNumber && rawRecord && rawRecord.idNumber) {
      group.idNumber = normalizeSpacing(rawRecord.idNumber);
    }
    if (rawRecord && rawRecord.patientName && rawRecord.patientName.length > group.patientName.length) {
      group.patientName = normalizeSpacing(rawRecord.patientName) || group.patientName;
    }

    const importOrder = Number(rawRecord && (rawRecord.importOrder || rawRecord.excelRowIndex));
    if (Number.isFinite(importOrder) && importOrder > 0) {
      if (!group.importOrder || importOrder < group.importOrder) {
        group.importOrder = importOrder;
      }
    }

    if (rawRecord && rawRecord.caregivers) {
      group.summaryCaregivers = mergeCaregivers(group.summaryCaregivers, rawRecord.caregivers);
    }

    group.records.push(rawRecord);

    const admissionTs = ensureRecordTimestamp(rawRecord);
    if (admissionTs !== null) {
      group.admissionCount += 1;
      if (!group.firstAdmissionTimestamp || admissionTs < group.firstAdmissionTimestamp) {
        group.firstAdmissionTimestamp = admissionTs;
        group.firstAdmissionDate = rawRecord.admissionDate || null;
        group.firstDiagnosis = normalizeSpacing(rawRecord.diagnosis) || group.firstDiagnosis || '';
        group.firstHospital = normalizeSpacing(rawRecord.hospital) || group.firstHospital || '';
      }
      if (!group.latestAdmissionTimestamp || admissionTs > group.latestAdmissionTimestamp) {
        group.latestAdmissionTimestamp = admissionTs;
        group.latestAdmissionDate = rawRecord.admissionDate || null;
        group.latestDiagnosis = normalizeSpacing(rawRecord.diagnosis) || group.latestDiagnosis || '';
        group.latestHospital = normalizeSpacing(rawRecord.hospital) || group.latestHospital || '';
        group.latestDoctor = normalizeSpacing(rawRecord.doctor) || group.latestDoctor || '';
      }
    }
  });

  groups.forEach((group) => {
    const totalRecords = Array.isArray(group.records) ? group.records.length : 0;
    if (totalRecords > group.admissionCount) {
      group.admissionCount = totalRecords;
    }

    const latestRecord = totalRecords ? group.records[0] : {};
    const earliestRecord = totalRecords ? group.records[totalRecords - 1] : latestRecord;

    const fallbackTimestamp = (record) =>
      normalizeTimestamp(
        (record && (record.admissionTimestamp || record.admissionDate || record.importedAt))
      );

    if (!group.firstAdmissionDate && earliestRecord) {
      group.firstAdmissionDate = earliestRecord.admissionDate || fallbackTimestamp(earliestRecord) || 0;
    }
    if (!group.firstAdmissionTimestamp && earliestRecord) {
      group.firstAdmissionTimestamp =
        normalizeTimestamp(earliestRecord.admissionTimestamp) || fallbackTimestamp(earliestRecord) || 0;
    }
    if (!group.latestAdmissionDate && latestRecord) {
      group.latestAdmissionDate = latestRecord.admissionDate || fallbackTimestamp(latestRecord) || 0;
    }
    if (!group.latestAdmissionTimestamp && latestRecord) {
      group.latestAdmissionTimestamp =
        normalizeTimestamp(latestRecord.admissionTimestamp) || fallbackTimestamp(latestRecord) || 0;
    }
    if (!group.latestDiagnosis && latestRecord) {
      group.latestDiagnosis = normalizeSpacing(latestRecord.diagnosis) || group.latestDiagnosis || '';
    }
    if (!group.latestHospital && latestRecord) {
      group.latestHospital = normalizeSpacing(latestRecord.hospital) || group.latestHospital || '';
    }
    if (!group.latestDoctor && latestRecord) {
      group.latestDoctor = normalizeSpacing(latestRecord.doctor) || group.latestDoctor || '';
    }
    if (!group.summaryCaregivers && latestRecord && latestRecord.caregivers) {
      group.summaryCaregivers = mergeCaregivers('', latestRecord.caregivers);
    }
  });

  return groups;
};

const buildGroupSummaries = (groups) => {
  const list = groups instanceof Map
    ? Array.from(groups.values())
    : Array.isArray(groups)
      ? groups
      : Object.values(groups || {});

  return list.map((group) => ({
    key: group.key,
    recordKey: group.recordKey || group.key,
    patientName: group.patientName,
    importOrder: group.importOrder || null,
    excelImportOrder: group.importOrder || null,
    gender: group.gender || '',
    birthDate: group.birthDate || '',
    nativePlace: group.nativePlace || '',
    ethnicity: group.ethnicity || '',
    idNumber: group.idNumber || '',
    firstAdmissionDate: group.firstAdmissionDate || null,
    latestAdmissionDate: group.latestAdmissionDate || null,
    firstAdmissionTimestamp: group.firstAdmissionTimestamp || null,
    latestAdmissionTimestamp: group.latestAdmissionTimestamp || null,
    firstDiagnosis: group.firstDiagnosis || '',
    latestDiagnosis: group.latestDiagnosis || '',
    firstHospital: group.firstHospital || '',
    latestHospital: group.latestHospital || '',
    latestDoctor: group.latestDoctor || '',
    admissionCount: group.admissionCount || (group.records ? group.records.length : 0),
    summaryCaregivers: group.summaryCaregivers || '',
  }));
};

const ensureCollectionExists = async (db, name) => {
  if (!db) {
    throw new Error('Database instance is required for ensureCollectionExists');
  }
  try {
    await db.collection(name).limit(1).get();
    return true;
  } catch (error) {
    const code = error && (error.errCode !== undefined ? error.errCode : error.code);
    const message = error && error.errMsg ? error.errMsg : '';
    const notExists =
      code === -502005 ||
      (message && message.indexOf('DATABASE_COLLECTION_NOT_EXIST') >= 0) ||
      (message && message.indexOf('collection not exists') >= 0);

    if (notExists) {
      try {
        await db.createCollection(name);
        return false;
      } catch (createError) {
        const createCode = createError && (createError.errCode !== undefined ? createError.errCode : createError.code);
        const alreadyExists = createCode === -502002;
        if (!alreadyExists) {
          console.warn('createCollection failed', name, createError);
        }
        return false;
      }
    }
    console.warn('ensureCollectionExists unexpected error', name, error);
    return false;
  }
};

module.exports = {
  normalizeValue,
  normalizeSpacing,
  normalizeTimestamp,
  ensureCollectionExists,
  buildPatientGroups,
  mergeCaregivers,
  ensureRecordTimestamp,
  buildGroupSummaries,
};
