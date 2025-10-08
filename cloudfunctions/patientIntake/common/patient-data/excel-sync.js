const crypto = require('crypto');

const {
  normalizeValue,
  normalizeSpacing,
  normalizeTimestamp,
  ensureCollectionExists,
  ensureRecordTimestamp,
} = require('../../utils/patient');

function createExcelSync({
  db,
  ensureCollectionExists: ensureCollectionExistsInput,
  normalizeString,
  collections = {},
}) {
  const ensureCollection = async name => {
    if (ensureCollectionExistsInput) {
      return ensureCollectionExistsInput(name);
    }
    return ensureCollectionExists(db, name);
  };
  const normalizeStringValue = normalizeString || normalizeSpacing;
  const normalizeExcelValue = normalizeValue;
  const normalizeExcelSpacing = normalizeSpacing;
  const toTimestampFromExcel = normalizeTimestamp;
  const {
    PATIENTS_COLLECTION,
    PATIENT_INTAKE_COLLECTION,
    EXCEL_RECORDS_COLLECTION,
    EXCEL_CACHE_COLLECTION,
    PATIENT_CACHE_DOC_ID,
  } = collections;

  const command = db.command;

  const invalidatePatientCache = async () => {
    if (!EXCEL_CACHE_COLLECTION || !PATIENT_CACHE_DOC_ID) {
      return;
    }
    try {
      await ensureCollection(EXCEL_CACHE_COLLECTION);
      await db
        .collection(EXCEL_CACHE_COLLECTION)
        .doc(PATIENT_CACHE_DOC_ID)
        .set({
          data: {
            patients: [],
            totalCount: 0,
            hasMore: false,
            limit: 0,
            updatedAt: 0,
            invalidatedAt: Date.now(),
          },
        });
    } catch (error) {
      const code = error && (error.errCode !== undefined ? error.errCode : error.code);
      console.warn('invalidatePatientCache failed', PATIENT_CACHE_DOC_ID, code || error);
    }
  };

  const CONTACT_PHONE_REGEX = /1[3-9]\d{9}/;

  const parseGuardianContact = rawValue => {
    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        const parsed = parseGuardianContact(item);
        if (parsed) {
          return parsed;
        }
      }
      return null;
    }

    if (typeof rawValue === 'object') {
      const candidateKeys = Object.keys(rawValue || {});
      if (!candidateKeys.length) {
        return null;
      }

      const pickValue = patterns => {
        for (const key of candidateKeys) {
          if (patterns.some(pattern => pattern.test(key))) {
            const value = normalizeExcelSpacing(rawValue[key]);
            if (value) {
              return value;
            }
          }
        }
        return '';
      };

      const phoneText = pickValue([/phone/i, /mobile/i, /tel/i, /联系方式/, /联系电话/]);
      const nameText = pickValue([/name/i, /联系人/, /guardian/i, /监护/]);

      if (phoneText && nameText) {
        const phoneMatch = (phoneText.replace(/[^0-9]/g, '').match(CONTACT_PHONE_REGEX) || [])[0];
        if (phoneMatch) {
          return {
            name: normalizeExcelSpacing(nameText),
            phone: phoneMatch,
            raw: `${normalizeExcelSpacing(nameText)} ${phoneMatch}`.trim(),
          };
        }
      }

      const flattened = candidateKeys
        .map(key => rawValue[key])
        .filter(value => typeof value === 'string' || typeof value === 'number')
        .join(' ');
      if (flattened) {
        return parseGuardianContact(flattened);
      }
      return null;
    }

    const text = normalizeExcelSpacing(rawValue);
    if (!text) {
      return null;
    }

    const digitsOnly = text.replace(/[^0-9]/g, '');
    const phoneMatch = digitsOnly.match(CONTACT_PHONE_REGEX);
    if (!phoneMatch) {
      return null;
    }
    const phone = phoneMatch[0];

    let name = text
      .replace(CONTACT_PHONE_REGEX, ' ')
      .replace(/\d{15,18}[Xx]?/g, ' ')
      .replace(/身份证|证件|电话号码|联系电话|联系方式|手机|手机号/g, ' ')
      .replace(/[\(\)（）:\-]/g, ' ')
      .replace(/[,，、;；]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) {
      return null;
    }

    return {
      name,
      phone,
      raw: text,
    };
  };

  const deriveGuardianInfo = (records = []) => {
    const info = {
      fatherRaw: '',
      fatherName: '',
      fatherPhone: '',
      motherRaw: '',
      motherName: '',
      motherPhone: '',
      guardianRaw: '',
      guardianName: '',
      guardianPhone: '',
      excelKeys: new Set(),
    };

    const assignIfEmpty = (field, value) => {
      if (value && !info[field]) {
        info[field] = value;
      }
    };

    records.forEach(record => {
      if (!record) {
        return;
      }
      const candidateKey = normalizeExcelSpacing(
        record.recordKey || record.key || record.patientName
      );
      if (candidateKey) {
        info.excelKeys.add(candidateKey);
      }

      const fatherRaw = normalizeExcelSpacing(record.fatherInfo);
      if (fatherRaw) {
        assignIfEmpty('fatherRaw', fatherRaw);
        const parsedFather = parseGuardianContact(fatherRaw);
        if (parsedFather) {
          assignIfEmpty('fatherName', parsedFather.name);
          assignIfEmpty('fatherPhone', parsedFather.phone);
        }
      }

      const motherRaw = normalizeExcelSpacing(record.motherInfo);
      if (motherRaw) {
        assignIfEmpty('motherRaw', motherRaw);
        const parsedMother = parseGuardianContact(motherRaw);
        if (parsedMother) {
          assignIfEmpty('motherName', parsedMother.name);
          assignIfEmpty('motherPhone', parsedMother.phone);
        }
      }

      const guardianRaw = normalizeExcelSpacing(record.otherGuardian || record.guardianInfo);
      if (guardianRaw) {
        if (!info.guardianRaw) {
          info.guardianRaw = guardianRaw;
        }
        const parsedGuardian = parseGuardianContact(guardianRaw);
        if (parsedGuardian) {
          assignIfEmpty('guardianName', parsedGuardian.name);
          assignIfEmpty('guardianPhone', parsedGuardian.phone);
        }
      }

      if (record.contactInfo) {
        const parsedContact = parseGuardianContact(record.contactInfo);
        if (parsedContact) {
          assignIfEmpty('guardianName', parsedContact.name);
          assignIfEmpty('guardianPhone', parsedContact.phone);
          if (!info.guardianRaw) {
            info.guardianRaw = parsedContact.raw;
          }
        }
      }
    });

    info.excelKeys = Array.from(info.excelKeys);
    return info;
  };

  const mergeExcelKeys = (existingKeys = [], incomingKeys = []) => {
    const merged = new Set();
    (Array.isArray(existingKeys) ? existingKeys : []).forEach(key => {
      const normalized = normalizeExcelSpacing(key);
      if (normalized) {
        merged.add(normalized);
      }
    });
    (Array.isArray(incomingKeys) ? incomingKeys : []).forEach(key => {
      const normalized = normalizeExcelSpacing(key);
      if (normalized) {
        merged.add(normalized);
      }
    });
    return Array.from(merged);
  };

  const buildGuardianUpdates = (patientDoc = {}, guardianInfo = {}) => {
    const updates = {};
    const ensureField = (field, value) => {
      if (!value) {
        return;
      }
      const existing = patientDoc && patientDoc[field];
      if (
        !normalizeStringValue(existing) ||
        normalizeStringValue(existing) !== normalizeStringValue(value)
      ) {
        updates[field] = value;
      }
    };

    ensureField('fatherInfo', guardianInfo.fatherRaw);
    ensureField('fatherContactName', guardianInfo.fatherName);
    ensureField('fatherContactPhone', guardianInfo.fatherPhone);
    ensureField('motherInfo', guardianInfo.motherRaw);
    ensureField('motherContactName', guardianInfo.motherName);
    ensureField('motherContactPhone', guardianInfo.motherPhone);
    ensureField('guardianInfo', guardianInfo.guardianRaw);
    ensureField('guardianContactName', guardianInfo.guardianName);
    ensureField('guardianContactPhone', guardianInfo.guardianPhone);

    if (Array.isArray(guardianInfo.excelKeys) && guardianInfo.excelKeys.length) {
      const existingKeys =
        patientDoc && Array.isArray(patientDoc.excelRecordKeys) ? patientDoc.excelRecordKeys : [];
      const mergedKeys = mergeExcelKeys(existingKeys, guardianInfo.excelKeys);
      const existingSet = new Set(existingKeys);
      const mergedSet = new Set(mergedKeys);
      let differs = existingSet.size !== mergedSet.size;
      if (!differs) {
        for (const key of mergedSet) {
          if (!existingSet.has(key)) {
            differs = true;
            break;
          }
        }
      }
      if (differs) {
        updates.excelRecordKeys = mergedKeys;
      }
    }

    return updates;
  };

  const toStableHash = value => crypto.createHash('md5').update(value, 'utf8').digest('hex');

  function sanitizeIdentifier(value, fallbackSeed) {
    const base = normalizeExcelValue(value);
    if (base) {
      const sanitized = base.replace(/[^a-zA-Z0-9_-]/g, '');
      if (sanitized) {
        return sanitized;
      }
      return `h_${toStableHash(base).slice(0, 24)}`;
    }
    const seed = normalizeExcelValue(fallbackSeed);
    if (seed) {
      const sanitizedSeed = seed.replace(/[^a-zA-Z0-9_-]/g, '');
      if (sanitizedSeed) {
        return sanitizedSeed;
      }
      return `h_${toStableHash(seed).slice(0, 24)}`;
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async function fetchExcelRecordsByKey(primaryKey, fallbackKeys = []) {
    await ensureCollection(EXCEL_RECORDS_COLLECTION);
    const collection = db.collection(EXCEL_RECORDS_COLLECTION);
    const records = [];
    const seenIds = new Set();
    const limit = 100;

    const keysToTry = [];
    const pushKey = rawKey => {
      const normalized = normalizeExcelSpacing(rawKey);
      if (normalized && !keysToTry.includes(normalized)) {
        keysToTry.push(normalized);
      }
    };

    pushKey(primaryKey);
    if (Array.isArray(fallbackKeys)) {
      fallbackKeys.forEach(pushKey);
    }

    for (const key of keysToTry) {
      if (!key) {
        continue;
      }
      let skip = 0;
      while (true) {
        const res = await collection.where({ key }).skip(skip).limit(limit).get();
        if (!res.data || res.data.length === 0) {
          break;
        }
        res.data.forEach(record => {
          const id = record && record._id;
          if (id) {
            if (!seenIds.has(id)) {
              seenIds.add(id);
              records.push(record);
            }
          } else {
            records.push(record);
          }
        });
        if (res.data.length < limit) {
          break;
        }
        skip += res.data.length;
      }
      if (records.length > 0) {
        break;
      }
    }

    records.sort((a, b) => {
      const aTime = Number(
        a && a.admissionTimestamp !== undefined
          ? a.admissionTimestamp
          : toTimestampFromExcel(a && a.admissionDate)
      );
      const bTime = Number(
        b && b.admissionTimestamp !== undefined
          ? b.admissionTimestamp
          : toTimestampFromExcel(b && b.admissionDate)
      );
      return (bTime || 0) - (aTime || 0);
    });

    return records;
  }

  function buildPatientDocFromExcelRecords(records, patientKey) {
    if (!Array.isArray(records) || records.length === 0) {
      return null;
    }

    const now = Date.now();
    const sorted = [...records].sort((a, b) => {
      const aTime = Number(
        a && a.admissionTimestamp !== undefined
          ? a.admissionTimestamp
          : toTimestampFromExcel(a && a.admissionDate)
      );
      const bTime = Number(
        b && b.admissionTimestamp !== undefined
          ? b.admissionTimestamp
          : toTimestampFromExcel(b && b.admissionDate)
      );
      return (aTime || 0) - (bTime || 0);
    });
    const first = sorted[0] || {};
    const last = sorted[sorted.length - 1] || first;

    const firstTs = toTimestampFromExcel(first.admissionTimestamp || first.admissionDate) || null;
    const lastTs = toTimestampFromExcel(last.admissionTimestamp || last.admissionDate) || null;
    const recordKey = normalizeExcelSpacing(patientKey);
    const guardianInfo = deriveGuardianInfo(records);

    return {
      patientName: normalizeExcelSpacing(last.patientName) || recordKey,
      idType: '身份证',
      idNumber: normalizeExcelSpacing(last.idNumber),
      gender: normalizeExcelSpacing(last.gender),
      birthDate: normalizeExcelSpacing(last.birthDate),
      nativePlace:
        normalizeExcelSpacing(last.nativePlace) || normalizeExcelSpacing(first.nativePlace),
      ethnicity: normalizeExcelSpacing(last.ethnicity) || normalizeExcelSpacing(first.ethnicity),
      phone: '',
      address: normalizeExcelSpacing(last.address),
      backupContact: '',
      backupPhone: '',
      lastIntakeNarrative: normalizeExcelSpacing(
        last.symptoms || last.diagnosis || last.treatmentProcess
      ),
      admissionCount: records.length,
      firstAdmissionDate: firstTs,
      latestAdmissionDate: lastTs,
      sourceType: 'excel-import',
      recordKey,
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: 'excel-import',
        createdFromExcel: true,
        excelRecordKey: recordKey,
      },
      excelRecordKeys: guardianInfo.excelKeys,
      fatherInfo: guardianInfo.fatherRaw || '',
      fatherContactName: guardianInfo.fatherName || '',
      fatherContactPhone: guardianInfo.fatherPhone || '',
      motherInfo: guardianInfo.motherRaw || '',
      motherContactName: guardianInfo.motherName || '',
      motherContactPhone: guardianInfo.motherPhone || '',
      guardianInfo: guardianInfo.guardianRaw || '',
      guardianContactName: guardianInfo.guardianName || '',
      guardianContactPhone: guardianInfo.guardianPhone || '',
      careStatus: 'discharged',
    };
  }

  
function buildIntakeRecordFromExcel(record, patientKey, patientName, serverDate, excelRecordId) {
  const pickTimestamp = (...candidates) => {
    for (const candidate of candidates) {
      const ts = normalizeTimestamp(candidate);
      if (ts !== null && Number.isFinite(ts) && ts > 0) {
        return ts;
      }
    }
    return null;
  };

  const admissionTimestamp = pickTimestamp(
    record.admissionTimestamp,
    record.intakeTime,
    record.metadata && record.metadata.intakeTime,
    record.admissionDate,
    record.importedAt,
    record._importedAt
  );

  const fallbackSeed = `${patientKey || patientName || 'excel'}_${
    admissionTimestamp !== null ? admissionTimestamp : serverDate
  }`;
  const sanitizedId = sanitizeIdentifier(excelRecordId, fallbackSeed);
  const intakeId = `excel_${sanitizedId}`;

  const medicalInfo = {
    hospital: normalizeExcelSpacing(record.hospital),
    diagnosis: normalizeExcelSpacing(record.diagnosis),
    doctor: normalizeExcelSpacing(record.doctor),
    treatmentProcess: normalizeExcelSpacing(record.treatmentProcess),
    followUpPlan: normalizeExcelSpacing(record.followUpPlan),
    symptoms: normalizeExcelSpacing(record.symptoms),
    visitReason: normalizeExcelSpacing(record.visitReason),
  };
  Object.keys(medicalInfo).forEach(key => {
    if (!medicalInfo[key]) {
      delete medicalInfo[key];
    }
  });

  const situationText =
    normalizeExcelSpacing(record.symptoms) ||
    normalizeExcelSpacing(record.diagnosis) ||
    normalizeExcelSpacing(record.treatmentProcess);

  const metadata = {
    source: 'excel-import',
    excelRecordId,
    lastExcelSyncAt: serverDate,
    lastExcelSyncBatchId: record.syncBatchId || null,
  };

  if (admissionTimestamp !== null) {
    metadata.intakeTime = admissionTimestamp;
    metadata.submittedAt = admissionTimestamp;
    metadata.lastModifiedAt = admissionTimestamp;
  } else {
    metadata.submittedAt = serverDate;
  }

  const intakeRecord = {
    intakeId,
    patientKey,
    patientName,
    status: 'imported',
    basicInfo: {
      patientName,
      idType: '身份证',
      idNumber: normalizeExcelSpacing(record.idNumber),
      gender: normalizeExcelSpacing(record.gender),
      birthDate: normalizeExcelSpacing(record.birthDate),
      phone: '',
    },
    contactInfo: {
      address: normalizeExcelSpacing(record.address),
      backupContact: '',
      backupPhone: '',
    },
    intakeInfo: {
      situation: situationText,
      followUpPlan: normalizeExcelSpacing(record.followUpPlan),
      medicalHistory: [],
      attachments: [],
    },
    medicalInfo: Object.keys(medicalInfo).length ? medicalInfo : undefined,
    metadata,
    createdAt: admissionTimestamp !== null ? admissionTimestamp : serverDate,
    updatedAt: admissionTimestamp !== null ? admissionTimestamp : serverDate,
  };

  if (admissionTimestamp !== null) {
    intakeRecord.intakeInfo.intakeTime = admissionTimestamp;
    intakeRecord.admissionTimestamp = admissionTimestamp;
    intakeRecord.importedAt = admissionTimestamp;
    intakeRecord._importedAt = admissionTimestamp;
  }

  return intakeRecord;
}

function pickRecordTimestamp(record) {
    return ensureRecordTimestamp(record);
  }

  const isDraftStatus = value => {
    const normalized = normalizeExcelSpacing(value);
    if (!normalized) {
      return false;
    }
    return normalized.toLowerCase() === 'draft';
  };

  const safeTrim = value => {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value).trim();
  };

  const extractRecordTimestampForKey = (record = {}) => {
    const ts = pickRecordTimestamp(record);
    return Number.isFinite(ts) ? ts : 0;
  };

  const isActiveStatus = status => {
    const normalized = normalizeExcelSpacing(status);
    if (!normalized) {
      return false;
    }
    return normalized.toLowerCase() === 'active';
  };

  const toIntakeRecordKey = (record = {}) => {
    if (!record || typeof record !== 'object') {
      return `empty-${Math.random()}`;
    }

    const metadata = record.metadata || {};
    const source = safeTrim(metadata.source).toLowerCase();
    const intakeId = safeTrim(record.intakeId);
    const excelRecordId = safeTrim(metadata.excelRecordId);

    const excelFlags = [
      normalizeExcelSpacing(record.status).toLowerCase() === 'imported',
      (intakeId || '').includes('-excel'),
      source === 'excel-import',
      Boolean(excelRecordId),
    ];
    const isExcelImportedRecord = excelFlags.some(Boolean);

    if (isExcelImportedRecord) {
      const time = extractRecordTimestampForKey(record);
      if (time) {
        const normalizedTime = Math.round(time / 60000);
        const identifier =
          excelRecordId ||
          intakeId ||
          safeTrim(record.patientKey) ||
          safeTrim(record.patientName) ||
          '';
        const hospital =
          safeTrim(record.hospital) ||
          safeTrim(record.hospitalDisplay) ||
          safeTrim(record.intakeInfo && record.intakeInfo.hospital) ||
          '';
        const diagnosis =
          safeTrim(record.diagnosis) ||
          safeTrim(record.diagnosisDisplay) ||
          safeTrim(record.intakeInfo && record.intakeInfo.visitReason) ||
          '';
        const baseKey = `excel:${normalizedTime}-${identifier}-${hospital}-${diagnosis}`;
        if (excelRecordId || hospital || diagnosis) {
          return baseKey;
        }
        const docId = safeTrim(record._id);
        if (docId) {
          return `${baseKey}-${docId}`;
        }
        return baseKey;
      }
      if (excelRecordId) {
        return `excel-record:${excelRecordId}`;
      }
      if (intakeId) {
        return `excel-intake:${intakeId}`;
      }
      const docId = safeTrim(record._id);
      if (docId) {
        return `excel-doc:${docId}`;
      }
    }

    const candidates = [record.intakeId, record._id, record.id, metadata.intakeId].filter(Boolean);

    if (candidates.length) {
      return candidates[0];
    }

    const time = extractRecordTimestampForKey(record);
    if (time) {
      const normalizedTime = Math.round(time / 60000);
      const identifier = safeTrim(record.patientKey) || safeTrim(record.patientName) || '';
      return `time:${normalizedTime}-${identifier}`;
    }

    const admissionDate = safeTrim(record.displayTime) || safeTrim(record.admissionDate) || '';
    const diagnosis = safeTrim(record.diagnosis) || safeTrim(record.diagnosisDisplay) || '';
    const hospital = safeTrim(record.hospital) || safeTrim(record.hospitalDisplay) || '';
    const fallbackKey = `fallback:${admissionDate}-${diagnosis}-${hospital}`;
    if (!admissionDate && !diagnosis && !hospital) {
      const docId = safeTrim(record._id) || intakeId || safeTrim(metadata.intakeId);
      if (docId) {
        return `${fallbackKey}-${docId}`;
      }
    }
    return fallbackKey;
  };

  const dedupeIntakeRecordsForSummary = (records = []) => {
    if (!Array.isArray(records) || records.length <= 1) {
      return Array.isArray(records) ? records : [];
    }

    const map = new Map();

    records.forEach(record => {
      if (!record) {
        return;
      }
      const key = toIntakeRecordKey(record);
      if (!map.has(key)) {
        map.set(key, record);
        return;
      }

      const existing = map.get(key);
      const existingIsActive = isActiveStatus(existing.status);
      const candidateIsActive = isActiveStatus(record.status);

      if (existingIsActive !== candidateIsActive) {
        if (candidateIsActive) {
          map.set(key, record);
        }
        return;
      }

      const existingTime = extractRecordTimestampForKey(existing);
      const candidateTime = extractRecordTimestampForKey(record);
      if (candidateTime > existingTime) {
        map.set(key, record);
      }
    });

    return Array.from(map.values());
  };

  async function summarizeIntakeHistory(patientKey, options = {}) {
    const normalizedKey = normalizeStringValue(patientKey);
    const summary = {
      count: 0,
      earliestTimestamp: null,
      latestTimestamp: null,
      latestNarrative: '',
      latestHospital: '',
      latestDoctor: '',
      latestDiagnosis: '',
      firstDiagnosis: '',
      firstHospital: '',
      firstDoctor: '',
      firstNarrative: '',
      hasActiveRecords: false,
    };

    if (!normalizedKey) {
      return summary;
    }

    const applyExcelFallback = async () => {
      try {
        const fallbackKeys = [];
        const sanitizedKey = normalizeExcelSpacing(normalizedKey).replace(/^excel_/, '');
        if (sanitizedKey && sanitizedKey !== normalizedKey) {
          fallbackKeys.push(sanitizedKey);
        }
        if (options.ensureOptions && Array.isArray(options.ensureOptions.excelKeys)) {
          fallbackKeys.push(...options.ensureOptions.excelKeys);
        }
        const excelRecords = await fetchExcelRecordsByKey(normalizedKey, fallbackKeys);
        if (!Array.isArray(excelRecords) || !excelRecords.length) {
          return;
        }
        summary.count = excelRecords.length;
        const sorted = [...excelRecords].sort((a, b) => {
          const aTs = toTimestampFromExcel(a.admissionTimestamp || a.admissionDate);
          const bTs = toTimestampFromExcel(b.admissionTimestamp || b.admissionDate);
          return (aTs || 0) - (bTs || 0);
        });
        const earliest = sorted[0];
        const latest = sorted[sorted.length - 1];

        const earliestTs = toTimestampFromExcel(
          earliest.admissionTimestamp || earliest.admissionDate
        );
        const latestTs = toTimestampFromExcel(latest.admissionTimestamp || latest.admissionDate);

        if (earliestTs) {
          summary.earliestTimestamp = earliestTs;
          summary.firstNarrative = normalizeExcelSpacing(
            earliest.symptoms ||
              earliest.diagnosis ||
              earliest.treatmentProcess ||
              summary.firstNarrative
          );
          summary.firstHospital = normalizeExcelSpacing(earliest.hospital) || summary.firstHospital;
          summary.firstDoctor = normalizeExcelSpacing(earliest.doctor) || summary.firstDoctor;
          summary.firstDiagnosis =
            normalizeExcelSpacing(earliest.diagnosis) || summary.firstDiagnosis;
        }
        if (latestTs) {
          summary.latestTimestamp = latestTs;
          summary.latestNarrative = normalizeExcelSpacing(
            latest.symptoms ||
              latest.diagnosis ||
              latest.treatmentProcess ||
              summary.latestNarrative
          );
          summary.latestHospital = normalizeExcelSpacing(latest.hospital) || summary.latestHospital;
          summary.latestDoctor = normalizeExcelSpacing(latest.doctor) || summary.latestDoctor;
          summary.latestDiagnosis =
            normalizeExcelSpacing(latest.diagnosis) || summary.latestDiagnosis;
        }
      } catch (error) {
        console.warn('summarizeIntakeHistory excel fallback failed', normalizedKey, error);
      }
    };

    await ensureCollection(PATIENT_INTAKE_COLLECTION);
    const collection = db.collection(PATIENT_INTAKE_COLLECTION);

    let count = 0;
    try {
      const countRes = await collection.where({ patientKey: normalizedKey }).count();
      count = Number(countRes && countRes.total) || 0;
    } catch (error) {
      console.warn('summarizeIntakeHistory count failed', normalizedKey, error);
      await applyExcelFallback();
      return summary;
    }

    if (!count) {
      await applyExcelFallback();
      return summary;
    }

    const batchSize = 100;
    const batchTimes = Math.max(1, Math.ceil(count / batchSize));
    const allActiveRecords = [];

    for (let i = 0; i < batchTimes; i++) {
      try {
        const res = await collection
          .where({ patientKey: normalizedKey })
          .field({
            patientKey: 1,
            updatedAt: 1,
            createdAt: 1,
            intakeTime: 1,
            'intakeInfo.intakeTime': 1,
            'intakeInfo.situation': 1,
            'medicalInfo.hospital': 1,
            'medicalInfo.doctor': 1,
            'medicalInfo.diagnosis': 1,
            'medicalInfo.treatmentProcess': 1,
            'metadata.lastModifiedAt': 1,
            status: 1,
            'metadata.submittedAt': 1,
            'metadata.excelRecordId': 1,
            'metadata.source': 1,
            'metadata.submittedBy': 1,
            'metadata.importMode': 1,
            _id: 1,
          })
          .skip(i * batchSize)
          .limit(batchSize)
          .get();

        const records = Array.isArray(res && res.data) ? res.data : [];
        const activeRecords = records.filter(record => !isDraftStatus(record && record.status));
        const cleanedRecords = activeRecords.filter(record => {
          const metadata = record && record.metadata ? record.metadata : {};
          const recordId = typeof record._id === 'string' ? record._id : '';
          const isAggregatedBySource =
            metadata.source === 'excel-import' &&
            !metadata.excelRecordId &&
            recordId.startsWith(`${normalizedKey}-excel`);
          const isAggregatedBySubmitter =
            (metadata.submittedBy === 'excel-import' || metadata.importMode === 'excel-import') &&
            recordId.endsWith('-excel') &&
            !metadata.excelRecordId;
          const isAggregatedByIdSuffix = recordId.endsWith('-excel') && !metadata.excelRecordId;
          return !(isAggregatedBySource || isAggregatedBySubmitter || isAggregatedByIdSuffix);
        });
        if (!cleanedRecords.length) {
          continue;
        }

        allActiveRecords.push(...cleanedRecords);
      } catch (error) {
        console.warn('summarizeIntakeHistory batch failed', normalizedKey, error);
      }
    }

    if (!allActiveRecords.length) {
      await applyExcelFallback();
      return summary;
    }

    const dedupedRecords = dedupeIntakeRecordsForSummary(allActiveRecords);

    if (!dedupedRecords.length) {
      await applyExcelFallback();
      return summary;
    }

    summary.count = dedupedRecords.length;
    summary.hasActiveRecords = dedupedRecords.length > 0;

    let latestRecord = null;
    let earliestRecord = null;

    dedupedRecords.forEach(record => {
      const timestamp = pickRecordTimestamp(record);
      if (timestamp && (!summary.earliestTimestamp || timestamp < summary.earliestTimestamp)) {
        summary.earliestTimestamp = timestamp;
        earliestRecord = record;
      }
      if (timestamp && (!summary.latestTimestamp || timestamp >= summary.latestTimestamp)) {
        summary.latestTimestamp = timestamp;
        latestRecord = record;
      }
    });

    if (!latestRecord && dedupedRecords.length) {
      latestRecord = dedupedRecords[dedupedRecords.length - 1];
    }
    if (!earliestRecord) {
      earliestRecord = latestRecord;
    }

    const extractMedicalFields = record => {
      if (!record) {
        return {
          narrative: '',
          hospital: '',
          doctor: '',
          diagnosis: '',
        };
      }
      const medicalInfo = record.medicalInfo || {};
      const intakeInfo = record.intakeInfo || {};
      return {
        narrative: normalizeExcelSpacing(
          intakeInfo.situation ||
            medicalInfo.diagnosis ||
            medicalInfo.treatmentProcess ||
            record.situation ||
            ''
        ),
        hospital: normalizeExcelSpacing(medicalInfo.hospital || record.hospital),
        doctor: normalizeExcelSpacing(medicalInfo.doctor || record.doctor),
        diagnosis: normalizeExcelSpacing(
          medicalInfo.diagnosis ||
            intakeInfo.diagnosis ||
            record.diagnosis ||
            intakeInfo.visitReason ||
            ''
        ),
      };
    };

    const latestInfo = extractMedicalFields(latestRecord);
    const earliestInfo = extractMedicalFields(earliestRecord || latestRecord);

    summary.latestNarrative = latestInfo.narrative;
    summary.latestHospital = latestInfo.hospital;
    summary.latestDoctor = latestInfo.doctor;
    summary.latestDiagnosis = latestInfo.diagnosis;

    summary.firstNarrative = earliestInfo.narrative || summary.latestNarrative;
    summary.firstHospital = earliestInfo.hospital || summary.latestHospital;
    summary.firstDoctor = earliestInfo.doctor || summary.latestDoctor;
    summary.firstDiagnosis = earliestInfo.diagnosis || summary.latestDiagnosis;

    if (!summary.hasActiveRecords) {
      await applyExcelFallback();
    }

    return summary;
  }

  async function syncPatientAggregates(patientKey, options = {}) {
    const normalizedKey = normalizeStringValue(patientKey);
    if (!normalizedKey) {
      return {
        count: 0,
        earliestTimestamp: null,
        latestTimestamp: null,
        latestNarrative: '',
        latestHospital: '',
        latestDoctor: '',
        latestDiagnosis: '',
        firstDiagnosis: '',
        firstHospital: '',
        firstDoctor: '',
        firstNarrative: '',
      };
    }

    const summary = await summarizeIntakeHistory(normalizedKey, options);
    const patientDoc = options.patientDoc || null;
    const serverDate = options.serverDate || Date.now();
    const hasRecords = Number.isFinite(summary && summary.count) ? summary.count > 0 : false;

    let targetDocId =
      (patientDoc && (patientDoc._id || patientDoc.id || patientDoc.patientKey)) || normalizedKey;
    if (!patientDoc || !patientDoc._id) {
      try {
        const ensured = await ensurePatientDoc(normalizedKey, options.ensureOptions || {});
        if (ensured && ensured.patientDoc) {
          targetDocId = ensured.patientDoc._id || targetDocId;
        }
      } catch (error) {
        console.warn('syncPatientAggregates ensure failed', normalizedKey, error);
      }
    }

    if (!targetDocId) {
      return summary;
    }

    const updates = {
      updatedAt: serverDate,
      'data.updatedAt': serverDate,
    };

    if (hasRecords) {
      updates.admissionCount = summary.count;
      updates['data.admissionCount'] = summary.count;
    } else {
      updates.admissionCount = command.remove();
      updates['data.admissionCount'] = command.remove();
    }

    if (Number.isFinite(summary.earliestTimestamp)) {
      updates.firstAdmissionDate = summary.earliestTimestamp;
      updates['data.firstAdmissionDate'] = summary.earliestTimestamp;
    } else if (!hasRecords) {
      updates.firstAdmissionDate = command.remove();
      updates['data.firstAdmissionDate'] = command.remove();
    }

    if (Number.isFinite(summary.latestTimestamp)) {
      updates.latestAdmissionDate = summary.latestTimestamp;
      updates.latestAdmissionTimestamp = summary.latestTimestamp;
      updates['data.latestAdmissionDate'] = summary.latestTimestamp;
      updates['data.latestAdmissionTimestamp'] = summary.latestTimestamp;
    } else if (!hasRecords) {
      updates.latestAdmissionDate = command.remove();
      updates.latestAdmissionTimestamp = command.remove();
      updates['data.latestAdmissionDate'] = command.remove();
      updates['data.latestAdmissionTimestamp'] = command.remove();
    }

    if (summary.latestNarrative) {
      updates.lastIntakeNarrative = summary.latestNarrative;
    } else if (!hasRecords) {
      updates.lastIntakeNarrative = command.remove();
    }

    if (summary.latestHospital) {
      updates.latestHospital = summary.latestHospital;
    } else if (!hasRecords) {
      updates.latestHospital = command.remove();
    }

    if (summary.latestDoctor) {
      updates.latestDoctor = summary.latestDoctor;
    } else if (!hasRecords) {
      updates.latestDoctor = command.remove();
    }

    if (summary.latestDiagnosis) {
      updates.latestDiagnosis = summary.latestDiagnosis;
    } else if (!hasRecords) {
      updates.latestDiagnosis = command.remove();
    }

    if (summary.firstHospital) {
      updates.firstHospital = summary.firstHospital;
    } else if (!hasRecords) {
      updates.firstHospital = command.remove();
    }

    if (summary.firstDiagnosis) {
      updates.firstDiagnosis = summary.firstDiagnosis;
    } else if (!hasRecords) {
      updates.firstDiagnosis = command.remove();
    }

    if (summary.firstDoctor) {
      updates.firstDoctor = summary.firstDoctor;
    } else if (!hasRecords) {
      updates.firstDoctor = command.remove();
    }

    if (summary.firstNarrative) {
      updates.firstNarrative = summary.firstNarrative;
    } else if (!hasRecords) {
      updates.firstNarrative = command.remove();
    }

    try {
      await ensureCollection(PATIENTS_COLLECTION);
      await db.collection(PATIENTS_COLLECTION).doc(targetDocId).update({ data: updates });
      await invalidatePatientCache();
    } catch (error) {
      console.warn('syncPatientAggregates update failed', targetDocId, error);
    }

    return summary;
  }
  async function ensurePatientDoc(patientKey, options = {}) {
    const normalizedKey = normalizeStringValue(patientKey);
    if (!normalizedKey) {
      return { patientDoc: null, patientKey: normalizedKey };
    }

    await ensureCollection(PATIENTS_COLLECTION);

    try {
      const docRes = await db.collection(PATIENTS_COLLECTION).doc(normalizedKey).get();
      if (docRes && docRes.data) {
        const doc = { _id: normalizedKey, ...docRes.data };
        return { patientDoc: doc, patientKey: normalizedKey };
      }
    } catch (error) {
      const code = error && (error.errCode !== undefined ? error.errCode : error.code);
      const notFound =
        code === -1 || code === 'DATABASE_DOCUMENT_NOT_EXIST' || code === 'DOCUMENT_NOT_FOUND';
      if (!notFound) {
        console.warn('ensurePatientDoc unexpected error', patientKey, error);
      }
    }

    const recordKey = normalizeExcelSpacing(patientKey);
    if (recordKey) {
      const byRecordKey = await db
        .collection(PATIENTS_COLLECTION)
        .where({ recordKey })
        .limit(1)
        .get();
      if (byRecordKey.data && byRecordKey.data.length) {
        const doc = byRecordKey.data[0];
        const docId = doc._id || normalizedKey;
        return { patientDoc: { _id: docId, ...doc }, patientKey: docId };
      }
    }

    const fallbackKeys = Array.isArray(options.excelKeys) ? options.excelKeys : [];
    const excelRecords = await fetchExcelRecordsByKey(normalizedKey, fallbackKeys);
    if (!excelRecords.length) {
      return { patientDoc: null, patientKey: normalizedKey };
    }

    const payload = buildPatientDocFromExcelRecords(excelRecords, normalizedKey);
    if (!payload) {
      return { patientDoc: null, patientKey: normalizedKey };
    }

    const docId = sanitizeIdentifier(normalizedKey, `excel_${Date.now()}`);

    try {
      await db.collection(PATIENTS_COLLECTION).doc(docId).set({ data: payload });
      return { patientDoc: { _id: docId, ...payload }, patientKey: docId, created: true };
    } catch (error) {
      if (error && (error.errCode === -502002 || error.code === 'ALREADY_EXISTS')) {
        const docRes = await db.collection(PATIENTS_COLLECTION).doc(docId).get();
        if (docRes && docRes.data) {
          return { patientDoc: docRes.data, patientKey: docId };
        }
      }
      console.warn('ensurePatientDoc create failed', docId, error);
      return { patientDoc: { _id: docId, ...payload }, patientKey: docId };
    }
  }

  async function syncExcelRecordsToIntake(patientKey, options = {}) {
    const normalizedKey = normalizeStringValue(patientKey);
    if (!normalizedKey) {
      return { created: 0, updated: 0, skipped: 0 };
    }

    const providedExcelKeys = Array.isArray(options.excelKeys) ? [...options.excelKeys] : [];

    let patientDoc = options.patientDoc || null;
    if (!patientDoc) {
      const ensured = await ensurePatientDoc(normalizedKey, { excelKeys: providedExcelKeys });
      patientDoc = ensured ? ensured.patientDoc : null;
    }

    const searchKeys = [...providedExcelKeys];
    if (options.recordKey) {
      searchKeys.push(options.recordKey);
    }
    if (patientDoc && patientDoc.recordKey) {
      searchKeys.push(patientDoc.recordKey);
    }
    if (patientDoc && patientDoc.patientName) {
      searchKeys.push(patientDoc.patientName);
    }

    const excelRecords = await fetchExcelRecordsByKey(normalizedKey, searchKeys);
    if (!excelRecords.length) {
      return { created: 0, updated: 0, skipped: 0 };
    }

    const guardianInfo = deriveGuardianInfo(excelRecords);
    const patientDocId =
      (patientDoc && (patientDoc._id || patientDoc.id || patientDoc.docId)) || normalizedKey;
    if (patientDocId) {
      const guardianUpdates = buildGuardianUpdates(patientDoc, guardianInfo);
      if (Object.keys(guardianUpdates).length) {
        try {
          await db
            .collection(PATIENTS_COLLECTION)
            .doc(patientDocId)
            .update({ data: guardianUpdates });
          patientDoc = { ...(patientDoc || {}), ...guardianUpdates, _id: patientDocId };
          await invalidatePatientCache();
        } catch (guardianError) {
          console.warn(
            'syncExcelRecordsToIntake guardian update failed',
            patientDocId,
            guardianError
          );
        }
      }
    }

    await ensureCollection(PATIENT_INTAKE_COLLECTION);
    const collection = db.collection(PATIENT_INTAKE_COLLECTION);
    const serverDate = Date.now();
    const result = { created: 0, updated: 0, skipped: 0 };

    const patientName =
      normalizeExcelSpacing(patientDoc && patientDoc.patientName) || normalizedKey;

    for (const record of excelRecords) {
      const metadata = (record && record.metadata) || {};
      let excelRecordId = normalizeExcelSpacing(metadata.excelRecordId || metadata.recordSignature || '');

      if (!excelRecordId) {
        const keyFragments = [];

        const normalizedRowIndex =
          record && (record._rowIndex !== undefined ? Number(record._rowIndex) : null);
        if (Number.isFinite(normalizedRowIndex) && normalizedRowIndex >= 0) {
          keyFragments.push(`row:${normalizedRowIndex}`);
        }

        const importOrder = record && record.importOrder;
        if (Number.isFinite(importOrder) && importOrder >= 0) {
          keyFragments.push(`order:${importOrder}`);
        }

        const admissionTimestamp = normalizeTimestamp(record && record.admissionTimestamp);
        if (admissionTimestamp !== null) {
          keyFragments.push(`ts:${admissionTimestamp}`);
        }

        const admissionDateText = normalizeExcelSpacing(record && record.admissionDateRaw);
        if (admissionDateText) {
          keyFragments.push(`date:${admissionDateText}`);
        }

        const hospital = normalizeExcelSpacing(record && record.hospital);
        const diagnosis = normalizeExcelSpacing(record && record.diagnosis);
        if (hospital || diagnosis) {
          keyFragments.push(`info:${hospital || ''}-${diagnosis || ''}`);
        }

        if (!keyFragments.length) {
          keyFragments.push(`fallback:${serverDate}`);
        }

        const rawIdentifier = `${normalizedKey}|${keyFragments.join('|')}`;
        const digest = crypto.createHash('md5').update(rawIdentifier).digest('hex');
        excelRecordId = `excel_${digest}`;
      } else if (!excelRecordId.startsWith('excel_')) {
        excelRecordId = `excel_${excelRecordId}`;
      }

      const intakeRecord = buildIntakeRecordFromExcel(
        record,
        normalizedKey,
        patientName,
        serverDate,
        excelRecordId
      );

      let existingDoc = null;
      if (excelRecordId) {
        const existingRes = await collection
          .where({ 'metadata.excelRecordId': excelRecordId })
          .limit(1)
          .get();
        if (existingRes && existingRes.data && existingRes.data.length) {
          existingDoc = existingRes.data[0];
        }
      }

      if (existingDoc) {
        const updatePayload = {
          patientKey: normalizedKey,
          patientName,
          status: intakeRecord.status,
          basicInfo: intakeRecord.basicInfo,
          contactInfo: intakeRecord.contactInfo,
          intakeInfo: intakeRecord.intakeInfo,
          metadata: intakeRecord.metadata,
          updatedAt: serverDate,
        };
        if (intakeRecord.medicalInfo !== undefined) {
          updatePayload.medicalInfo = intakeRecord.medicalInfo;
        }
        try {
          await collection.doc(existingDoc._id).update({ data: updatePayload });
          result.updated += 1;
        } catch (error) {
          console.warn('syncExcelRecordsToIntake update failed', existingDoc._id, error);
        }
        continue;
      }

      try {
        await collection.doc(intakeRecord.intakeId).set({ data: intakeRecord });
        result.created += 1;
      } catch (error) {
        if (error && (error.errCode === -502002 || error.code === 'ALREADY_EXISTS')) {
          result.skipped += 1;
        } else {
          console.warn('syncExcelRecordsToIntake create failed', intakeRecord.intakeId, error);
        }
      }
    }

    const docAdmissionCount =
      patientDoc && typeof patientDoc === 'object'
        ? patientDoc.data && typeof patientDoc.data.admissionCount === 'number'
          ? patientDoc.data.admissionCount
          : patientDoc.admissionCount
        : null;

    const shouldSyncAggregates =
      Boolean(options.forceSummary) ||
      (result.created || 0) + (result.updated || 0) > 0 ||
      !Number.isFinite(docAdmissionCount);

    let summary = null;
    if (shouldSyncAggregates) {
      try {
        const ensureExcelKeys = new Set();
        const inheritKeys =
          options.ensureOptions && Array.isArray(options.ensureOptions.excelKeys)
            ? options.ensureOptions.excelKeys
            : [];
        [...inheritKeys, ...(Array.isArray(providedExcelKeys) ? providedExcelKeys : [])].forEach(
          key => {
            if (key) {
              ensureExcelKeys.add(key);
            }
          }
        );
        if (patientDoc && patientDoc.recordKey) {
          ensureExcelKeys.add(patientDoc.recordKey);
        }
        if (patientDoc && patientDoc.patientName) {
          ensureExcelKeys.add(patientDoc.patientName);
        }
        const ensureOptions = {
          ...(options.ensureOptions || {}),
          excelKeys: Array.from(ensureExcelKeys),
        };
        summary = await syncPatientAggregates(normalizedKey, {
          patientDoc,
          serverDate,
          ensureOptions,
        });
      } catch (error) {
        console.warn('syncExcelRecordsToIntake summary failed', normalizedKey, error);
      }
    }

    return {
      ...result,
      summary,
    };
  }

  return {
    ensurePatientDoc,
    syncExcelRecordsToIntake,
    syncPatientAggregates,
    fetchExcelRecordsByKey,
    normalizeExcelSpacing,
  };
}

module.exports = createExcelSync;
