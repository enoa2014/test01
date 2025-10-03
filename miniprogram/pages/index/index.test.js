global.Page = jest.fn();

const {
  mapGenderLabel,
  resolveAgeBucket,
  getAgeBucketLabelById,
  applyAdvancedFilters,
} = require('./index.js');

describe('patient index helpers', () => {
  test('mapGenderLabel should normalize gender variants', () => {
    expect(mapGenderLabel('M')).toBe('男');
    expect(mapGenderLabel('female')).toBe('女');
    expect(mapGenderLabel('未知')).toBe('未知');
  });

  test('resolveAgeBucket should map age to correct bucket', () => {
    const bucket = resolveAgeBucket(10);
    expect(bucket).toBeDefined();
    expect(bucket.id).toBe('7-12');
    expect(getAgeBucketLabelById(bucket.id)).toBe(bucket.label);
    expect(resolveAgeBucket(-1)).toBeNull();
  });

  test('applyAdvancedFilters should respect gender, doctor and age filters', () => {
    const now = Date.now();
    const patients = [
      {
        patientName: '张三',
        careStatus: 'in_care',
        riskLevel: 'high',
        latestHospital: '协和医院',
        firstHospital: '协和医院',
        latestDiagnosis: '白血病',
        firstDiagnosis: '白血病',
        tags: [],
        latestDoctor: '王医生',
        firstDoctor: '王医生',
        gender: '男',
        genderLabel: '男',
        ethnicity: '汉',
        nativePlace: '广西',
        ageBucketId: '7-12',
        latestAdmissionTimestamp: now,
        firstAdmissionTimestamp: now,
      },
      {
        patientName: '李四',
        careStatus: 'pending',
        riskLevel: 'medium',
        latestHospital: '儿童医院',
        firstHospital: '儿童医院',
        latestDiagnosis: '感冒',
        firstDiagnosis: '感冒',
        tags: [],
        latestDoctor: '张医生',
        firstDoctor: '张医生',
        gender: '女',
        genderLabel: '女',
        ethnicity: '汉',
        nativePlace: '北京',
        ageBucketId: '18+',
        latestAdmissionTimestamp: now - 86400000,
        firstAdmissionTimestamp: now - 86400000,
      },
    ];

    const femaleFilter = applyAdvancedFilters(patients, {
      genders: ['女'],
      ageRanges: [],
      diagnosis: [],
      hospitals: [],
      statuses: [],
      riskLevels: [],
      doctors: [],
      ethnicities: [],
      nativePlaces: [],
      dateRange: { start: '', end: '' },
      logicMode: 'AND',
    });
    expect(femaleFilter).toHaveLength(1);
    expect(femaleFilter[0].patientName).toBe('李四');

    const doctorFilter = applyAdvancedFilters(patients, {
      genders: [],
      doctors: ['王医生'],
      statuses: [],
      riskLevels: [],
      hospitals: [],
      diagnosis: [],
      ethnicities: [],
      nativePlaces: [],
      ageRanges: [],
      dateRange: { start: '', end: '' },
      logicMode: 'AND',
    });
    expect(doctorFilter).toHaveLength(1);
    expect(doctorFilter[0].patientName).toBe('张三');

    const ageFilter = applyAdvancedFilters(patients, {
      genders: [],
      doctors: [],
      statuses: [],
      riskLevels: [],
      hospitals: [],
      diagnosis: [],
      ethnicities: [],
      nativePlaces: [],
      ageRanges: ['18+'],
      dateRange: { start: '', end: '' },
      logicMode: 'AND',
    });
    expect(ageFilter).toHaveLength(1);
    expect(ageFilter[0].patientName).toBe('李四');

    const combined = applyAdvancedFilters(patients, {
      genders: ['女'],
      doctors: ['张医生'],
      ageRanges: ['18+'],
      statuses: [],
      riskLevels: [],
      hospitals: [],
      diagnosis: [],
      ethnicities: [],
      nativePlaces: [],
      dateRange: { start: '', end: '' },
      logicMode: 'AND',
    });
    expect(combined).toHaveLength(1);
    expect(combined[0].patientName).toBe('李四');
  });
});
