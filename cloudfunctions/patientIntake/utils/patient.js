const normalizeValue = value => {
  if (value === undefined || value === null) {
    return '';
  }
  const str = String(value).trim();
  return str === 'null' || str === 'undefined' ? '' : str;
};

const normalizeSpacing = value => {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return '';
  }
  return normalized.replace(/\s+/g, ' ').trim();
};

const normalizeTimestamp = value => {
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

const splitCaregiverList = value => {
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

const normalizeCaregiverToken = token => normalizeSpacing(token).replace(/\s+/g, '').toLowerCase();

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
    idNumber: '',
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
  const metadata = (record && record.metadata) || {};
  const source = normalizeSpacing(metadata.source).toLowerCase();
  const isExcelImport = source === 'excel-import';
  const direct = normalizeTimestamp(record.admissionTimestamp);
  if (direct !== null) {
    return direct;
  }
  const intakeTimeTs = normalizeTimestamp(
    record.intakeTime ||
      (record.metadata && (record.metadata.intakeTime || record.metadata.lastModifiedAt))
  );
  if (intakeTimeTs !== null) {
    return intakeTimeTs;
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
  if (updated !== null && !isExcelImport) {
    return updated;
  }
  return 0;
};

const shouldCountIntakeRecord = record => {
  if (!record) {
    return false;
  }
  const status = normalizeSpacing(record.status).toLowerCase();
  if (status === 'draft') {
    return false;
  }
  return true;
};

const safeTrim = value => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
};

const extractRecordTimestampForKey = (record = {}) => {
  const ts = ensureRecordTimestamp(record);
  return Number.isFinite(ts) ? ts : 0;
};

const resolveRecordValue = (record, paths = []) => {
  for (const pathCandidate of paths) {
    if (!pathCandidate) {
      continue;
    }
    if (Array.isArray(pathCandidate)) {
      let current = record;
      let valid = true;
      for (const segment of pathCandidate) {
        if (!current || typeof current !== 'object') {
          valid = false;
          break;
        }
        current = current[segment];
      }
      if (valid) {
        const normalized = normalizeSpacing(current);
        if (normalized) {
          return normalized;
        }
      }
    } else if (typeof record === 'object' && record !== null) {
      const value = record[pathCandidate];
      const normalized = normalizeSpacing(value);
      if (normalized) {
        return normalized;
      }
    }
  }
  return '';
};

const isActiveStatus = status => {
  const normalized = normalizeSpacing(status);
  if (!normalized) {
    return false;
  }
  return normalized.toLowerCase() === 'active';
};

const toIntakeRecordKey = (record = {}) => {
  if (!record || typeof record !== 'object') {
    return `empty-${Math.random().toString(36).slice(2, 10)}`;
  }

  const metadata = record.metadata || {};
  const source = safeTrim(metadata.source).toLowerCase();
  const intakeId = safeTrim(record.intakeId);
  const excelRecordId = safeTrim(metadata.excelRecordId);

  const excelFlags = [
    normalizeSpacing(record.status).toLowerCase() === 'imported',
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
      const hospital = resolveRecordValue(record, [
        ['medicalInfo', 'hospital'],
        'hospital',
        'hospitalDisplay',
        ['intakeInfo', 'hospital'],
      ]);
      const diagnosis = resolveRecordValue(record, [
        ['medicalInfo', 'diagnosis'],
        'diagnosis',
        'diagnosisDisplay',
        ['intakeInfo', 'visitReason'],
      ]);
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
  const diagnosis = resolveRecordValue(record, [
    ['medicalInfo', 'diagnosis'],
    'diagnosis',
    'diagnosisDisplay',
    ['intakeInfo', 'visitReason'],
  ]);
  const hospital = resolveRecordValue(record, [
    ['medicalInfo', 'hospital'],
    'hospital',
    'hospitalDisplay',
    ['intakeInfo', 'hospital'],
  ]);
  const fallbackKey = `fallback:${admissionDate}-${diagnosis}-${hospital}`;
  if (!admissionDate && !diagnosis && !hospital) {
    const docId = safeTrim(record._id) || intakeId || safeTrim(metadata.intakeId);
    if (docId) {
      return `${fallbackKey}-${docId}`;
    }
  }
  return fallbackKey;
};

const dedupeIntakeRecords = (records = []) => {
  if (!Array.isArray(records) || records.length <= 1) {
    return Array.isArray(records) ? records.slice() : [];
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
    const existingIsActive = isActiveStatus(existing && existing.status);
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
      return;
    }

    if (candidateTime === existingTime) {
      const existingUpdated = Number(existing && existing.updatedAt ? existing.updatedAt : 0);
      const candidateUpdated = Number(record && record.updatedAt ? record.updatedAt : 0);
      if (candidateUpdated > existingUpdated) {
        map.set(key, record);
      }
    }
  });

  return Array.from(map.values());
};



const buildPatientGroups = (records = []) => {
  const groups = new Map();
  const groupsById = new Map();
  const groupsByName = new Map();

  const normalizeIdNumberStrict = value => {
    const normalized = normalizeSpacing(value);
    if (!normalized) {
      return '';
    }
    return normalized.replace(/[^0-9Xx]/g, '').toUpperCase();
  };

  const buildNameIndexKey = name => {
    const normalized = normalizeSpacing(name);
    if (!normalized) {
      return '';
    }
    return normalized.replace(/\s+/g, '').toLowerCase();
  };

  const createStableKey = (value, fallback) => {
    const build = input => {
      const normalized = normalizeSpacing(input);
      if (!normalized) {
        return '';
      }
      const ascii = normalized.replace(/[^a-zA-Z0-9_-]/g, '');
      if (ascii) {
        return ascii;
      }
      return `h_${Buffer.from(normalized).toString('hex').slice(0, 24)}`;
    };
    const primary = build(value);
    if (primary) {
      return primary;
    }
    const backup = build(fallback);
    if (backup) {
      return backup;
    }
    return `excel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  };

  const registerGroupKey = (group, desiredKey, fallbackSeed) => {
    const resolved = createStableKey(desiredKey, fallbackSeed);
    if (!resolved) {
      return;
    }
    if (group.recordKey === resolved && groups.get(resolved) === group) {
      return;
    }
    if (group.recordKey && groups.get(group.recordKey) === group) {
      groups.delete(group.recordKey);
    }
    group.recordKey = resolved;
    group.key = resolved;
    if (Array.isArray(group.records)) {
      group.records.forEach(recordItem => {
        if (recordItem) {
          recordItem.recordKey = resolved;
          recordItem.key = resolved;
        }
      });
    }
    groups.set(resolved, group);
  };

  const registerGroupName = (group, name) => {
    const normalized = normalizeSpacing(name);
    if (!normalized) {
      return;
    }
    const nameKey = buildNameIndexKey(normalized);
    if (!nameKey) {
      return;
    }
    if (!group._nameKeys) {
      group._nameKeys = new Set();
    }
    if (!group._nameKeys.has(nameKey)) {
      group._nameKeys.add(nameKey);
      let set = groupsByName.get(nameKey);
      if (!set) {
        set = new Set();
        groupsByName.set(nameKey, set);
      }
      set.add(group);
    }
    if (!group.patientName || normalized.length > group.patientName.length) {
      group.patientName = normalized;
    }
  };

  const attachIdToGroup = (group, idNumber) => {
    if (!idNumber) {
      return;
    }
    if (!group._idNumbers) {
      group._idNumbers = new Set();
    }
    if (!group._idNumbers.has(idNumber)) {
      group._idNumbers.add(idNumber);
    }
    if (!group.idNumber) {
      group.idNumber = idNumber;
    }
    groupsById.set(idNumber, group);
    registerGroupKey(group, idNumber, group.recordKey || idNumber);
  };

  const ensureContactEvidence = group => {
    if (!group._contactEvidence) {
      group._contactEvidence = {
        addresses: new Set(),
        fatherNames: new Set(),
        fatherPhones: new Set(),
        fatherIds: new Set(),
        motherNames: new Set(),
        motherPhones: new Set(),
        motherIds: new Set(),
      };
    }
    return group._contactEvidence;
  };

  const registerAddressEvidence = (group, address) => {
    const normalized = normalizeSpacing(address);
    if (!normalized) {
      return;
    }
    const evidence = ensureContactEvidence(group);
    evidence.addresses.add(normalized);
    if (!group.address || normalized.length > group.address.length) {
      group.address = normalized;
    }
  };

  const registerContactEvidence = (group, role, contact) => {
    if (!contact) {
      return;
    }
    const evidence = ensureContactEvidence(group);
    const nameKey = normalizeCaregiverToken(contact.name || contact.raw);
    const phone = normalizeSpacing(contact.phone);
    const idNumber = contact.idNumber ? contact.idNumber.toUpperCase() : '';
    if (role === 'father') {
      if (nameKey) {
        evidence.fatherNames.add(nameKey);
      }
      if (phone) {
        evidence.fatherPhones.add(phone);
      }
      if (idNumber) {
        evidence.fatherIds.add(idNumber);
      }
    } else if (role === 'mother') {
      if (nameKey) {
        evidence.motherNames.add(nameKey);
      }
      if (phone) {
        evidence.motherPhones.add(phone);
      }
      if (idNumber) {
        evidence.motherIds.add(idNumber);
      }
    }
  };

  const extractContactTokens = (value, role) => {
    const tokens = { names: new Set(), phones: new Set(), ids: new Set() };
    splitCaregiverList(value).forEach(segment => {
      const contact = parseFamilyContact(segment, role);
      if (!contact) {
        return;
      }
      const nameKey = normalizeCaregiverToken(contact.name || contact.raw);
      if (nameKey) {
        tokens.names.add(nameKey);
      }
      if (contact.phone) {
        tokens.phones.add(contact.phone);
      }
      if (contact.idNumber) {
        tokens.ids.add(contact.idNumber.toUpperCase());
      }
    });
    return tokens;
  };

  const hasContactIntersection = (group, tokens, role) => {
    if (!tokens) {
      return false;
    }
    const evidence = ensureContactEvidence(group);
    const target =
      role === 'father'
        ? {
            names: evidence.fatherNames,
            phones: evidence.fatherPhones,
            ids: evidence.fatherIds,
          }
        : {
            names: evidence.motherNames,
            phones: evidence.motherPhones,
            ids: evidence.motherIds,
          };
    const nameMatch =
      tokens.names.size > 0 && Array.from(tokens.names).some(name => target.names.has(name));
    const phoneMatch =
      tokens.phones.size > 0 && Array.from(tokens.phones).some(phone => target.phones.has(phone));
    const idMatch =
      tokens.ids.size > 0 && Array.from(tokens.ids).some(id => target.ids.has(id));
    return nameMatch || phoneMatch || idMatch;
  };

  const shouldMergeByEvidence = (group, record) => {
    if (!group || !record) {
      return false;
    }
    if (!group._nameKeys || group._nameKeys.size === 0) {
      return false;
    }
    const nameKey = buildNameIndexKey(record.patientName);
    if (!nameKey || !group._nameKeys.has(nameKey)) {
      return false;
    }
    const evidence = ensureContactEvidence(group);
    const address = normalizeSpacing(record.address);
    const addressAvailable = !!address;
    const addressMatch = addressAvailable && evidence.addresses.has(address);
    const fatherTokens = extractContactTokens(record.fatherInfo, 'father');
    const fatherAvailable =
      fatherTokens.names.size || fatherTokens.phones.size || fatherTokens.ids.size;
    const fatherMatch = fatherAvailable && hasContactIntersection(group, fatherTokens, 'father');
    const motherTokens = extractContactTokens(record.motherInfo, 'mother');
    const motherAvailable =
      motherTokens.names.size || motherTokens.phones.size || motherTokens.ids.size;
    const motherMatch = motherAvailable && hasContactIntersection(group, motherTokens, 'mother');
    const availableCategories = [];
    if (addressAvailable) {
      availableCategories.push('address');
    }
    if (fatherAvailable) {
      availableCategories.push('father');
    }
    if (motherAvailable) {
      availableCategories.push('mother');
    }
    if (!availableCategories.length) {
      return false;
    }
    const matches = [];
    if (addressMatch) {
      matches.push('address');
    }
    if (fatherMatch) {
      matches.push('father');
    }
    if (motherMatch) {
      matches.push('mother');
    }
    const requiredMatches = Math.min(availableCategories.length, 2);
    return matches.length >= requiredMatches;
  };

  records.forEach(rawRecord => {
    const patientName = normalizeSpacing(rawRecord && rawRecord.patientName);
    const inputKey = normalizeSpacing(
      (rawRecord && (rawRecord.recordKey || rawRecord.key)) || patientName
    );
    if (!patientName) {
      return;
    }
    const normalizedId = normalizeIdNumberStrict(rawRecord && rawRecord.idNumber);
    const nameKey = buildNameIndexKey(patientName);

    let group = null;

    if (normalizedId) {
      group = groupsById.get(normalizedId);
    }

    if (!group && nameKey) {
      const candidates = groupsByName.get(nameKey);
      if (candidates && candidates.size) {
        for (const candidate of candidates) {
          if (!normalizedId) {
            group = candidate;
            break;
          }
          if ((candidate._idNumbers && candidate._idNumbers.has(normalizedId)) || shouldMergeByEvidence(candidate, rawRecord)) {
            group = candidate;
            break;
          }
        }
      }
    }

    if (!group && inputKey) {
      group = groups.get(inputKey);
    }

    if (!group) {
      const rowIndex = rawRecord && (rawRecord.excelRowIndex || rawRecord.importOrder);
      group = {
        key: '',
        recordKey: '',
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
        firstDoctor: '',
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
        _idNumbers: new Set(),
        _nameKeys: new Set(),
        address: '',
      };
      registerGroupKey(group, normalizedId || inputKey || patientName, `${patientName}_${rowIndex || ''}`);
      registerGroupName(group, patientName);
    } else {
      registerGroupName(group, patientName);
      if (inputKey) {
        registerGroupKey(group, group.recordKey || inputKey, patientName);
      }
    }

    if (group.recordKey) {
      rawRecord.recordKey = group.recordKey;
      rawRecord.key = group.recordKey;
    }

    if (normalizedId) {
      attachIdToGroup(group, normalizedId);
    }

    registerAddressEvidence(group, rawRecord && rawRecord.address);

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
    if (
      rawRecord &&
      rawRecord.patientName &&
      rawRecord.patientName.length > group.patientName.length
    ) {
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

      const segments =
        role === 'other'
          ? normalized
              .replace(CAREGIVER_DELIMITER_REGEX, '、')
              .split('、')
              .map(item => normalizeSpacing(item))
              .filter(Boolean)
          : [normalized];

      segments.forEach(segment => {
        const contact = parseFamilyContact(segment, role);
        if (!contact) {
          return;
        }
        registerContactEvidence(group, role, contact);
        const key = [
          contact.role,
          normalizeCaregiverToken(contact.name || contact.raw),
          contact.phone || '',
        ].join('|');
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
        if (
          !normalizeSpacing(group.otherGuardian) ||
          normalized.length > group.otherGuardian.length
        ) {
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
      if (
        !normalizeSpacing(group.familyEconomy) ||
        economyValue.length > group.familyEconomy.length
      ) {
        group.familyEconomy = economyValue;
      }
    }

    group.records.push(rawRecord);
  });

  groups.forEach(group => {
    const rawRecords = Array.isArray(group.records) ? group.records.filter(Boolean) : [];

    if (rawRecords.length) {
      rawRecords.sort((a, b) => {
        const tsA = extractRecordTimestampForKey(a);
        const tsB = extractRecordTimestampForKey(b);
        if (tsA === tsB) {
          return (Number(b.importOrder) || 0) - (Number(a.importOrder) || 0);
        }
        return tsB - tsA;
      });
    }

    group.records = rawRecords;

    const countableRecords = rawRecords.filter(shouldCountIntakeRecord);
    const dedupedRecords = dedupeIntakeRecords(countableRecords);

    group.admissionCount = dedupedRecords.length;

    if (dedupedRecords.length) {
      const sortedByTimeDesc = [...dedupedRecords].sort(
        (a, b) => extractRecordTimestampForKey(b) - extractRecordTimestampForKey(a)
      );
      const latestRecord = sortedByTimeDesc[0];
      const earliestRecord = sortedByTimeDesc[sortedByTimeDesc.length - 1];

      const latestTimestamp = extractRecordTimestampForKey(latestRecord) || null;
      const earliestTimestamp = extractRecordTimestampForKey(earliestRecord) || null;

      group.latestAdmissionTimestamp = latestTimestamp;
      group.firstAdmissionTimestamp = earliestTimestamp;

      const latestDateSource =
        latestRecord.admissionDate ||
        latestRecord.latestAdmissionDate ||
        latestRecord.intakeTime ||
        (latestRecord.metadata && latestRecord.metadata.intakeTime) ||
        null;

      const earliestDateSource =
        earliestRecord.admissionDate ||
        earliestRecord.firstAdmissionDate ||
        earliestRecord.intakeTime ||
        (earliestRecord.metadata && earliestRecord.metadata.intakeTime) ||
        null;

      group.latestAdmissionDate = latestDateSource || null;
      group.firstAdmissionDate = earliestDateSource || null;

      const latestDiagnosis = resolveRecordValue(latestRecord, [
        ['medicalInfo', 'diagnosis'],
        'diagnosis',
        'diagnosisDisplay',
        ['intakeInfo', 'visitReason'],
      ]);
      const firstDiagnosis = resolveRecordValue(earliestRecord, [
        ['medicalInfo', 'diagnosis'],
        'diagnosis',
        'diagnosisDisplay',
        ['intakeInfo', 'visitReason'],
      ]);

      if (latestDiagnosis) {
        group.latestDiagnosis = latestDiagnosis;
      }
      if (firstDiagnosis) {
        group.firstDiagnosis = firstDiagnosis;
      }

      const latestHospital = resolveRecordValue(latestRecord, [
        ['medicalInfo', 'hospital'],
        'hospital',
        'hospitalDisplay',
        ['intakeInfo', 'hospital'],
      ]);
      const firstHospital = resolveRecordValue(earliestRecord, [
        ['medicalInfo', 'hospital'],
        'hospital',
        'hospitalDisplay',
        ['intakeInfo', 'hospital'],
      ]);

      if (latestHospital) {
        group.latestHospital = latestHospital;
      }
      if (firstHospital) {
        group.firstHospital = firstHospital;
      }

      const latestDoctor = resolveRecordValue(latestRecord, [
        ['medicalInfo', 'doctor'],
        'doctor',
        ['intakeInfo', 'doctor'],
      ]);
      const firstDoctor = resolveRecordValue(earliestRecord, [
        ['medicalInfo', 'doctor'],
        'doctor',
        ['intakeInfo', 'doctor'],
      ]);

      if (latestDoctor) {
        group.latestDoctor = latestDoctor;
      }
      if (firstDoctor) {
        group.firstDoctor = firstDoctor;
      }
    } else {
      group.latestAdmissionTimestamp = null;
      group.firstAdmissionTimestamp = null;
      group.latestAdmissionDate = null;
      group.firstAdmissionDate = null;
      group.latestDiagnosis = group.latestDiagnosis || '';
      group.firstDiagnosis = group.firstDiagnosis || '';
      group.latestHospital = group.latestHospital || '';
      group.firstHospital = group.firstHospital || '';
      group.latestDoctor = group.latestDoctor || '';
      group.firstDoctor = group.firstDoctor || '';
    }

    delete group._contactKeys;
    delete group._contactEvidence;
    delete group._nameKeys;
    delete group._idNumbers;
  });

  return groups;
};



const buildGroupSummaries = groups => {
  const list =
    groups instanceof Map
      ? Array.from(groups.values())
      : Array.isArray(groups)
        ? groups
        : Object.values(groups || {});

  return list.map(group => ({
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
        const createCode =
          createError &&
          (createError.errCode !== undefined ? createError.errCode : createError.code);
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
  shouldCountIntakeRecord,
  safeTrim,
  extractRecordTimestampForKey,
  resolveRecordValue,
  isActiveStatus,
  toIntakeRecordKey,
  dedupeIntakeRecords,
  buildGroupSummaries,
};
