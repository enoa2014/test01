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

    const admissionTs = ensureRecordTimestamp(rawRecord);
    if (admissionTs !== null) {
      group.admissionCount += 1;
      if (!group.firstAdmissionTimestamp || admissionTs < group.firstAdmissionTimestamp) {
        group.firstAdmissionTimestamp = admissionTs;
        group.firstAdmissionDate = rawRecord.admissionDate || null;
        group.firstDiagnosis =
          normalizeSpacing(rawRecord.diagnosis) || group.firstDiagnosis || '';
        group.firstHospital = normalizeSpacing(rawRecord.hospital) || group.firstHospital || '';
      }
      if (!group.latestAdmissionTimestamp || admissionTs > group.latestAdmissionTimestamp) {
        group.latestAdmissionTimestamp = admissionTs;
        group.latestAdmissionDate = rawRecord.admissionDate || null;
        group.latestDiagnosis =
          normalizeSpacing(rawRecord.diagnosis) || group.latestDiagnosis || '';
        group.latestHospital = normalizeSpacing(rawRecord.hospital) || group.latestHospital || '';
        group.latestDoctor = normalizeSpacing(rawRecord.doctor) || group.latestDoctor || '';
      }
    }
  });

  groups.forEach(group => {
    const totalRecords = Array.isArray(group.records) ? group.records.length : 0;
    if (totalRecords > group.admissionCount) {
      group.admissionCount = totalRecords;
    }

    if (group.records && group.records.length) {
      group.records.sort((a, b) => {
        const tsA = ensureRecordTimestamp(a);
        const tsB = ensureRecordTimestamp(b);
        if (tsA === tsB) {
          return (Number(b.importOrder) || 0) - (Number(a.importOrder) || 0);
        }
        return tsB - tsA;
      });
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
  buildGroupSummaries,
};
