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

const CAREGIVER_DELIMITER_REGEX = /[、，,]/g;

const splitCaregiverList = (value) => {
  const normalized = normalizeSpacing(value);
  if (!normalized) {
    return [];
  }
  return normalized
    .replace(CAREGIVER_DELIMITER_REGEX, '、')
    .split('、')
    .map(item => normalizeSpacing(item))
    .filter(Boolean);
};

const normalizeCaregiverToken = (token) => normalizeSpacing(token).replace(/\s+/g, '').toLowerCase();

const mergeCaregivers = (base, candidate) => {
  const existingList = splitCaregiverList(base);
  const result = [];
  const seen = new Set();

  existingList.forEach(token => {
    const key = normalizeCaregiverToken(token);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(normalizeSpacing(token));
    }
  });

  splitCaregiverList(candidate).forEach(token => {
    const key = normalizeCaregiverToken(token);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(normalizeSpacing(token));
    }
  });

  return result.join('、');
};

const CONTACT_PHONE_REGEX = /(1[3-9]\d{9})/;
const CONTACT_ID_REGEX = /(\d{17}[0-9Xx]|\d{15})/;

const parseFamilyContact = (rawValue, role) => {
  const normalized = normalizeSpacing(rawValue);
  if (!normalized) {
    return null;
  }

  const contact = {
    role,
    raw: normalized,
    name: '',
    phone: '',
    idNumber: ''
  };

  const phoneMatch = normalized.match(CONTACT_PHONE_REGEX);
  let working = normalized;

  if (phoneMatch) {
    contact.phone = phoneMatch[0];
    working = working.replace(phoneMatch[0], ' ');
  }

  const idMatch = working.match(CONTACT_ID_REGEX);
  if (idMatch) {
    contact.idNumber = idMatch[0].toUpperCase();
    working = working.replace(idMatch[0], ' ');
  }

  contact.name = normalizeSpacing(working).replace(/[()（）]/g, '');
  if (!contact.name) {
    contact.name = normalizeSpacing(rawValue);
  }

  return contact;
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
        fatherInfo: '',
        motherInfo: '',
        otherGuardian: '',
        familyEconomy: '',
        familyEconomyRaw: '',
        fatherInfoRaw: '',
        motherInfoRaw: '',
        otherGuardianRaw: '',
        familyContacts: [],
        _contactKeys: new Set(),
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

    const addFamilyContact = (role, rawValue) => {
      const normalized = normalizeSpacing(rawValue);
      if (!normalized) {
        return;
      }

      const segments = role === 'other'
        ? normalized.replace(CAREGIVER_DELIMITER_REGEX, '、').split('、').map(item => normalizeSpacing(item)).filter(Boolean)
        : [normalized];

      segments.forEach(segment => {
        const contact = parseFamilyContact(segment, role);
        if (!contact) {
          return;
        }
        const key = [contact.role, normalizeCaregiverToken(contact.name || contact.raw), contact.phone || ''].join('|');
        if (group._contactKeys && !group._contactKeys.has(key)) {
          group._contactKeys.add(key);
          group.familyContacts.push(contact);
        }
      });

      if (role === 'father') {
        group.fatherInfoRaw = group.fatherInfoRaw || normalized;
        if (!normalizeSpacing(group.fatherInfo) || normalized.length > group.fatherInfo.length) {
          group.fatherInfo = normalized;
        }
      } else if (role === 'mother') {
        group.motherInfoRaw = group.motherInfoRaw || normalized;
        if (!normalizeSpacing(group.motherInfo) || normalized.length > group.motherInfo.length) {
          group.motherInfo = normalized;
        }
      } else if (role === 'other') {
        group.otherGuardianRaw = group.otherGuardianRaw || normalized;
        if (!normalizeSpacing(group.otherGuardian) || normalized.length > group.otherGuardian.length) {
          group.otherGuardian = normalized;
        }
      }
    };

    addFamilyContact('father', rawRecord && rawRecord.fatherInfo);
    addFamilyContact('mother', rawRecord && rawRecord.motherInfo);
    addFamilyContact('other', rawRecord && rawRecord.otherGuardian);

    const economyValue = normalizeSpacing(rawRecord && rawRecord.familyEconomy);
    if (economyValue) {
      group.familyEconomyRaw = group.familyEconomyRaw || economyValue;
      if (!normalizeSpacing(group.familyEconomy) || economyValue.length > group.familyEconomy.length) {
        group.familyEconomy = economyValue;
      }
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
    if (!normalizeSpacing(group.fatherInfo) && latestRecord) {
      group.fatherInfo = normalizeSpacing(latestRecord.fatherInfo) || group.fatherInfo || '';
    }
    if (!normalizeSpacing(group.motherInfo) && latestRecord) {
      group.motherInfo = normalizeSpacing(latestRecord.motherInfo) || group.motherInfo || '';
    }
    if (!normalizeSpacing(group.otherGuardian) && latestRecord) {
      group.otherGuardian = normalizeSpacing(latestRecord.otherGuardian) || group.otherGuardian || '';
    }
    if (!normalizeSpacing(group.familyEconomy) && latestRecord) {
      group.familyEconomy = normalizeSpacing(latestRecord.familyEconomy) || group.familyEconomy || '';
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

    if (group.familyContacts && group.familyContacts.length) {
      const ordered = [];
      const preferredOrder = ['father', 'mother', 'other'];
      preferredOrder.forEach(role => {
        group.familyContacts
          .filter(contact => contact.role === role)
          .forEach(contact => ordered.push(contact));
      });
      const unordered = group.familyContacts.filter(contact => !preferredOrder.includes(contact.role));
      group.familyContacts = ordered.concat(unordered);
    }

    if (group._contactKeys) {
      delete group._contactKeys;
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
    familyContacts: Array.isArray(group.familyContacts) ? group.familyContacts : [],
    familyEconomy: group.familyEconomy || '',
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
  parseFamilyContact,
  ensureRecordTimestamp,
  buildGroupSummaries,
};
