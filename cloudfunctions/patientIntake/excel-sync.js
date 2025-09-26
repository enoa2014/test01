function createExcelSync({ db, ensureCollectionExists, normalizeString, collections }) {
  const {
    PATIENTS_COLLECTION,
    PATIENT_INTAKE_COLLECTION,
    EXCEL_RECORDS_COLLECTION
  } = collections;

  const command = db.command;

  function normalizeExcelValue(value) {
    if (value === undefined || value === null) {
      return '';
    }
    const str = String(value).trim();
    if (str === 'null' || str === 'undefined') {
      return '';
    }
    return str;
  }

  function normalizeExcelSpacing(value) {
    const normalized = normalizeExcelValue(value);
    if (!normalized) {
      return '';
    }
    return normalized.replace(/\s+/g, ' ').trim();
  }

  function toTimestampFromExcel(value) {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }
    if (value instanceof Date) {
      const ts = value.getTime();
      return Number.isNaN(ts) ? undefined : ts;
    }
    const normalized = normalizeExcelValue(value).replace(/[./]/g, '-');
    if (!normalized) {
      return undefined;
    }
    const date = new Date(normalized);
    const ts = date.getTime();
    return Number.isNaN(ts) ? undefined : ts;
  }

  function sanitizeIdentifier(value, fallbackSeed) {
    const base = normalizeExcelValue(value);
    if (base) {
      const sanitized = base.replace(/[^a-zA-Z0-9_-]/g, '');
      if (sanitized) {
        return sanitized;
      }
    }
    const seed = normalizeExcelValue(fallbackSeed);
    if (seed) {
      const sanitizedSeed = seed.replace(/[^a-zA-Z0-9_-]/g, '');
      if (sanitizedSeed) {
        return sanitizedSeed;
      }
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async function fetchExcelRecordsByKey(primaryKey, fallbackKeys = []) {
    await ensureCollectionExists(EXCEL_RECORDS_COLLECTION);
    const collection = db.collection(EXCEL_RECORDS_COLLECTION);
    const records = [];
    const seenIds = new Set();
    const limit = 100;

    const keysToTry = [];
    const pushKey = (rawKey) => {
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
        res.data.forEach((record) => {
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
      const aTime = Number(a && a.admissionTimestamp !== undefined ? a.admissionTimestamp : toTimestampFromExcel(a && a.admissionDate));
      const bTime = Number(b && b.admissionTimestamp !== undefined ? b.admissionTimestamp : toTimestampFromExcel(b && b.admissionDate));
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
      const aTime = Number(a && a.admissionTimestamp !== undefined ? a.admissionTimestamp : toTimestampFromExcel(a && a.admissionDate));
      const bTime = Number(b && b.admissionTimestamp !== undefined ? b.admissionTimestamp : toTimestampFromExcel(b && b.admissionDate));
      return (aTime || 0) - (bTime || 0);
    });
    const first = sorted[0] || {};
    const last = sorted[sorted.length - 1] || first;

    const firstTs = toTimestampFromExcel(first.admissionTimestamp || first.admissionDate) || null;
    const lastTs = toTimestampFromExcel(last.admissionTimestamp || last.admissionDate) || null;
    const recordKey = normalizeExcelSpacing(patientKey);

    return {
      patientName: normalizeExcelSpacing(last.patientName) || recordKey,
      idType: '身份证',
      idNumber: normalizeExcelSpacing(last.idNumber),
      gender: normalizeExcelSpacing(last.gender),
      birthDate: normalizeExcelSpacing(last.birthDate),
      phone: '',
      address: normalizeExcelSpacing(last.address),
      emergencyContact: normalizeExcelSpacing(last.caregivers),
      emergencyPhone: '',
      backupContact: '',
      backupPhone: '',
      lastIntakeNarrative: normalizeExcelSpacing(last.symptoms || last.diagnosis || last.treatmentProcess),
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
        excelRecordKey: recordKey
      }
    };
  }

  function buildIntakeRecordFromExcel(record, patientKey, patientName, serverDate, excelRecordId) {
    const admissionTimestamp = record.admissionTimestamp || toTimestampFromExcel(record.admissionDate) || serverDate;
    const fallbackSeed = `${patientKey || patientName || 'excel'}_${admissionTimestamp || serverDate}`;
    const sanitizedId = sanitizeIdentifier(excelRecordId, fallbackSeed);
    const intakeId = `excel_${sanitizedId}`;

    const medicalInfo = {
      hospital: normalizeExcelSpacing(record.hospital),
      diagnosis: normalizeExcelSpacing(record.diagnosis),
      doctor: normalizeExcelSpacing(record.doctor),
      treatmentProcess: normalizeExcelSpacing(record.treatmentProcess),
      followUpPlan: normalizeExcelSpacing(record.followUpPlan),
      symptoms: normalizeExcelSpacing(record.symptoms),
      visitReason: normalizeExcelSpacing(record.visitReason)
    };
    Object.keys(medicalInfo).forEach((key) => {
      if (!medicalInfo[key]) {
        delete medicalInfo[key];
      }
    });

    const situationText = normalizeExcelSpacing(record.symptoms)
      || normalizeExcelSpacing(record.diagnosis)
      || normalizeExcelSpacing(record.treatmentProcess);

    return {
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
        phone: ''
      },
      contactInfo: {
        address: normalizeExcelSpacing(record.address),
        emergencyContact: normalizeExcelSpacing(record.caregivers),
        emergencyPhone: '',
        backupContact: '',
        backupPhone: ''
      },
      intakeInfo: {
        intakeTime: admissionTimestamp,
        situation: situationText,
        followUpPlan: normalizeExcelSpacing(record.followUpPlan),
        medicalHistory: [],
        attachments: []
      },
      medicalInfo: Object.keys(medicalInfo).length ? medicalInfo : undefined,
      metadata: {
        source: 'excel-import',
        excelRecordId,
        lastExcelSyncAt: serverDate,
        lastExcelSyncBatchId: record.syncBatchId || null
      },
      createdAt: serverDate,
      updatedAt: serverDate
    };
  }

  function pickRecordTimestamp(record) {
    if (!record || typeof record !== 'object') {
      return null;
    }
   const metadata = record.metadata || {};
   const intakeInfo = record.intakeInfo || {};
   const candidates = [
     record.intakeTime,
     intakeInfo.intakeTime,
      record.admissionTimestamp,
      record._importedAt,
      metadata.lastModifiedAt,
      record.updatedAt,
      metadata.submittedAt,
      record.createdAt
    ];
    for (const candidate of candidates) {
      const ts = toTimestampFromExcel(candidate);
      if (ts !== undefined && ts !== null) {
        return ts;
      }
    }
    return null;
  }

  async function summarizeIntakeHistory(patientKey) {
    const normalizedKey = normalizeString(patientKey);
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
      firstNarrative: ''
    };

    if (!normalizedKey) {
      return summary;
    }

    await ensureCollectionExists(PATIENT_INTAKE_COLLECTION);
    const collection = db.collection(PATIENT_INTAKE_COLLECTION);

    let count = 0;
    try {
      const countRes = await collection.where({ patientKey: normalizedKey }).count();
      count = Number(countRes && countRes.total) || 0;
    } catch (error) {
      console.warn('summarizeIntakeHistory count failed', normalizedKey, error);
      return summary;
    }

    summary.count = count;

    if (!count) {
      return summary;
    }

    const batchSize = 100;
    const batchTimes = Math.max(1, Math.ceil(count / batchSize));
    let latestRecord = null;
    let earliestRecord = null;

    for (let i = 0; i < batchTimes; i++) {
      try {
       const res = await collection.where({ patientKey: normalizedKey })
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
            'metadata.submittedAt': 1
          })
          .skip(i * batchSize)
          .limit(batchSize)
          .get();

        const records = Array.isArray(res && res.data) ? res.data : [];
        if (!records.length) {
          continue;
        }

        records.forEach((record) => {
          const timestamp = pickRecordTimestamp(record);
          if (timestamp && (!summary.earliestTimestamp || timestamp < summary.earliestTimestamp)) {
            summary.earliestTimestamp = timestamp;
            earliestRecord = record;
          }
          if (!summary.latestTimestamp || (timestamp && timestamp >= summary.latestTimestamp)) {
            summary.latestTimestamp = timestamp || summary.latestTimestamp;
            latestRecord = record;
          }
        });
      } catch (error) {
        console.warn('summarizeIntakeHistory batch failed', normalizedKey, error);
      }
    }

    if (!summary.latestTimestamp) {
      summary.latestTimestamp = Date.now();
    }
    if (!summary.earliestTimestamp) {
      summary.earliestTimestamp = summary.latestTimestamp;
    }

    const extractMedicalFields = (record) => {
      if (!record) {
        return {
          narrative: '',
          hospital: '',
          doctor: '',
          diagnosis: ''
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
        )
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

    return summary;
  }

  async function syncPatientAggregates(patientKey, options = {}) {
    const normalizedKey = normalizeString(patientKey);
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
        firstNarrative: ''
      };
    }

    const summary = await summarizeIntakeHistory(normalizedKey);
    const patientDoc = options.patientDoc || null;
    const serverDate = options.serverDate || Date.now();

    let targetDocId = (patientDoc && (patientDoc._id || patientDoc.id || patientDoc.patientKey)) || normalizedKey;
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
      admissionCount: summary.count,
      'data.admissionCount': summary.count
    };

    if (summary.count > 0) {
      updates.firstAdmissionDate = summary.earliestTimestamp;
      updates.latestAdmissionDate = summary.latestTimestamp;
      updates.latestAdmissionTimestamp = summary.latestTimestamp;
      updates['data.firstAdmissionDate'] = summary.earliestTimestamp;
      updates['data.latestAdmissionDate'] = summary.latestTimestamp;
      updates['data.latestAdmissionTimestamp'] = summary.latestTimestamp;
      if (summary.latestNarrative) {
        updates.lastIntakeNarrative = summary.latestNarrative;
      }
      if (summary.latestHospital) {
        updates.latestHospital = summary.latestHospital;
      }
      if (summary.latestDoctor) {
        updates.latestDoctor = summary.latestDoctor;
      }
      if (summary.latestDiagnosis) {
        updates.latestDiagnosis = summary.latestDiagnosis;
      }
      if (summary.firstHospital) {
        updates.firstHospital = summary.firstHospital;
      }
      if (summary.firstDiagnosis) {
        updates.firstDiagnosis = summary.firstDiagnosis;
      }
      if (summary.firstDoctor) {
        updates.firstDoctor = summary.firstDoctor;
      }
      if (summary.firstNarrative) {
        updates.firstNarrative = summary.firstNarrative;
      }
    } else {
      updates.firstAdmissionDate = command.remove();
      updates.latestAdmissionDate = command.remove();
      updates.latestAdmissionTimestamp = command.remove();
      updates['data.firstAdmissionDate'] = command.remove();
      updates['data.latestAdmissionDate'] = command.remove();
      updates['data.latestAdmissionTimestamp'] = command.remove();
      updates.lastIntakeNarrative = command.remove();
      updates.firstHospital = command.remove();
      updates.firstDiagnosis = command.remove();
      updates.firstDoctor = command.remove();
      updates.firstNarrative = command.remove();
      updates.latestHospital = command.remove();
      updates.latestDoctor = command.remove();
      updates.latestDiagnosis = command.remove();
    }

    try {
      await ensureCollectionExists(PATIENTS_COLLECTION);
      await db.collection(PATIENTS_COLLECTION).doc(targetDocId).update({ data: updates });
    } catch (error) {
      console.warn('syncPatientAggregates update failed', targetDocId, error);
    }

    return summary;
  }
  async function ensurePatientDoc(patientKey, options = {}) {
    const normalizedKey = normalizeString(patientKey);
    if (!normalizedKey) {
      return { patientDoc: null, patientKey: normalizedKey };
    }

    await ensureCollectionExists(PATIENTS_COLLECTION);

    try {
      const docRes = await db.collection(PATIENTS_COLLECTION).doc(normalizedKey).get();
      if (docRes && docRes.data) {
        return { patientDoc: docRes.data, patientKey: normalizedKey };
      }
    } catch (error) {
      const code = error && (error.errCode !== undefined ? error.errCode : error.code);
      const notFound = code === -1 || code === 'DATABASE_DOCUMENT_NOT_EXIST' || code === 'DOCUMENT_NOT_FOUND';
      if (!notFound) {
        console.warn('ensurePatientDoc unexpected error', patientKey, error);
      }
    }

    const recordKey = normalizeExcelSpacing(patientKey);
    if (recordKey) {
      const byRecordKey = await db.collection(PATIENTS_COLLECTION).where({ recordKey }).limit(1).get();
      if (byRecordKey.data && byRecordKey.data.length) {
        const doc = byRecordKey.data[0];
        return { patientDoc: doc, patientKey: doc._id || normalizedKey };
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
    const normalizedKey = normalizeString(patientKey);
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

    await ensureCollectionExists(PATIENT_INTAKE_COLLECTION);
    const collection = db.collection(PATIENT_INTAKE_COLLECTION);
    const serverDate = Date.now();
    const result = { created: 0, updated: 0, skipped: 0 };

    const patientName = normalizeExcelSpacing(patientDoc && patientDoc.patientName) || normalizedKey;

    for (const record of excelRecords) {
      const identifierSource = record && (record._id || record.id || `${normalizedKey}_${record._rowIndex || ''}` || `${normalizedKey}_${record.admissionTimestamp || ''}`);
      const excelRecordId = identifierSource ? String(identifierSource) : `${normalizedKey}_${serverDate}`;
      const intakeRecord = buildIntakeRecordFromExcel(record, normalizedKey, patientName, serverDate, excelRecordId);

      let existingDoc = null;
      if (excelRecordId) {
        const existingRes = await collection.where({ 'metadata.excelRecordId': excelRecordId }).limit(1).get();
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
          updatedAt: serverDate
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

    const docAdmissionCount = patientDoc && typeof patientDoc === 'object'
      ? (patientDoc.data && typeof patientDoc.data.admissionCount === 'number'
        ? patientDoc.data.admissionCount
        : patientDoc.admissionCount)
      : null;

    const shouldSyncAggregates = Boolean(options.forceSummary) ||
      ((result.created || 0) + (result.updated || 0) > 0) ||
      !Number.isFinite(docAdmissionCount);

    let summary = null;
    if (shouldSyncAggregates) {
      try {
        summary = await syncPatientAggregates(normalizedKey, {
          patientDoc,
          serverDate,
          ensureOptions: options.ensureOptions || {}
        });
      } catch (error) {
        console.warn('syncExcelRecordsToIntake summary failed', normalizedKey, error);
      }
    }

    return {
      ...result,
      summary
    };
  }

  return {
    ensurePatientDoc,
    syncExcelRecordsToIntake,
    syncPatientAggregates,
    fetchExcelRecordsByKey
  };
}

module.exports = createExcelSync;




