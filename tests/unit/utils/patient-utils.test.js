const {
  normalizeValue,
  normalizeSpacing,
  normalizeTimestamp,
  buildPatientGroups,
  buildGroupSummaries,
  mergeCaregivers,
  parseFamilyContact,
  dedupeIntakeRecords,
} = require('../../../cloudfunctions/utils/patient');

describe('patient utils', () => {
  test('normalizeValue trims text and removes pseudo-null', () => {
    expect(normalizeValue(null)).toBe('');
    expect(normalizeValue('  foo ')).toBe('foo');
    expect(normalizeValue('undefined')).toBe('');
  });

  test('normalizeSpacing collapses internal whitespace', () => {
    expect(normalizeSpacing('父亲  联系')).toBe('父亲 联系');
    expect(normalizeSpacing('\t母亲\n电话')).toBe('母亲 电话');
  });

  test('normalizeTimestamp parses common date formats', () => {
    const ts = normalizeTimestamp('2024-01-02');
    expect(typeof ts).toBe('number');
    expect(ts).toBe(Number(new Date('2024-01-02').getTime()));
  });

  test('mergeCaregivers deduplicates existing entries', () => {
    expect(mergeCaregivers('张三', '李四')).toBe('张三、李四');
    expect(mergeCaregivers('张三、李四', ' 李四 ')).toBe('张三、李四');
    expect(mergeCaregivers('张三、李四', '李四、王五')).toBe('张三、李四、王五');
  });

  test('parseFamilyContact extracts key fields', () => {
    expect(parseFamilyContact('胡斌 15278506397 452525197910271216', 'father')).toEqual({
      role: 'father',
      raw: '胡斌 15278506397 452525197910271216',
      name: '胡斌',
      phone: '15278506397',
      idNumber: '452525197910271216',
    });
    expect(parseFamilyContact('黄丽华', 'mother')).toMatchObject({
      role: 'mother',
      name: '黄丽华',
    });
  });

  test('buildPatientGroups aggregates admission data consistently', () => {
    const records = [
      {
        patientName: '张三',
        recordKey: 'ID123',
        gender: '男',
        admissionTimestamp: Date.parse('2024-01-01'),
        diagnosis: '初诊',
        hospital: '协和医院',
        caregivers: '父亲',
        importOrder: 2,
      },
      {
        patientName: '张三',
        recordKey: 'ID123',
        gender: '男',
        admissionDate: '2024/02/03',
        diagnosis: '复查',
        hospital: '协和医院',
        caregivers: '母亲',
        importOrder: 1,
      },
    ];

    const groups = buildPatientGroups(records);
    expect(groups.size).toBe(1);
    const group = groups.get('ID123');
    expect(group).toBeDefined();
    expect(group.patientName).toBe('张三');
    expect(group.importOrder).toBe(1);
    expect(group.summaryCaregivers).toBe('父亲、母亲');
    expect(group.latestDiagnosis).toBe('复查');
    expect(group.admissionCount).toBe(2);
    expect(Array.isArray(group.familyContacts)).toBe(true);

    const summaries = buildGroupSummaries(groups);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      recordKey: 'ID123',
      patientName: '张三',
      excelImportOrder: 1,
      admissionCount: 2,
    });
    expect(Array.isArray(summaries[0].familyContacts)).toBe(true);
  });

  test('buildPatientGroups ignores drafts and deduplicates excel imports', () => {
    const intakeTs = Date.parse('2024-03-01T10:00:00Z');
    const records = [
      {
        patientName: '林日燊',
        recordKey: 'lin',
        status: 'submitted',
        intakeTime: intakeTs,
        diagnosis: '初诊',
        hospital: '协和医院',
        metadata: { excelRecordId: 'excel-row-1' },
      },
      {
        patientName: '林日燊',
        recordKey: 'lin',
        status: 'submitted',
        intakeTime: intakeTs,
        diagnosis: '初诊',
        hospital: '协和医院',
        metadata: { excelRecordId: 'excel-row-1' },
        updatedAt: intakeTs + 5000,
      },
      {
        patientName: '林日燊',
        recordKey: 'lin',
        status: 'draft',
        intakeTime: intakeTs + 86400000,
        diagnosis: '复诊',
        hospital: '协和医院',
      },
    ];

    const groups = buildPatientGroups(records);
    const group = groups.get('lin');
    expect(group).toBeDefined();
    expect(group.admissionCount).toBe(1);
    expect(group.latestAdmissionTimestamp).toBe(intakeTs);
    expect(group.firstAdmissionTimestamp).toBe(intakeTs);
    expect(group.latestDiagnosis).toBe('初诊');
  });

  test('dedupeIntakeRecords keeps historical excel rows distinct when identifiers differ', () => {
    const baseTs = Date.parse('2022-09-01T08:00:00Z');
    const records = Array.from({ length: 4 }).map((_, index) => ({
      _id: `excel-doc-${index}`,
      patientKey: 'wang_zhaohong',
      patientName: '王朝弘',
      status: 'imported',
      intakeTime: baseTs,
      updatedAt: baseTs + index,
      metadata: {
        source: 'excel-import',
        excelRecordId: `excel-row-${index}`,
      },
    }));

    const deduped = dedupeIntakeRecords(records);
    expect(deduped).toHaveLength(4);
  });
});
