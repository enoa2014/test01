const {
  normalizeValue,
  normalizeSpacing,
  normalizeTimestamp,
  buildPatientGroups,
  buildGroupSummaries,
  mergeCaregivers,
} = require('../../../cloudfunctions/utils/patient');

describe('patient utils', () => {
  test('normalizeValue trims text and removes pseudo-null', () => {
    expect(normalizeValue(null)).toBe('');
    expect(normalizeValue('  foo ')).toBe('foo');
    expect(normalizeValue('undefined')).toBe('');
  });

  test('normalizeSpacing collapses internal whitespace', () => {
    expect(normalizeSpacing('父亲  联系') ).toBe('父亲 联系');
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

    const summaries = buildGroupSummaries(groups);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      recordKey: 'ID123',
      patientName: '张三',
      excelImportOrder: 1,
      admissionCount: 2,
    });
  });
});
