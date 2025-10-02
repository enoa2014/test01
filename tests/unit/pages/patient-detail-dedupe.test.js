const path = require('path');

describe('dedupeIntakeRecords', () => {
  const { dedupeIntakeRecords } = require(path.join(
    __dirname,
    '..',
    '..',
    '..',
    'miniprogram',
    'pages',
    'patient-detail',
    'data-mappers.js'
  ));

  test('keeps active record when duplicate with non-active status exists', () => {
    const duplicate = [
      {
        intakeId: 'intake-001',
        status: 'draft',
        updatedAt: 1700000000000,
      },
      {
        intakeId: 'intake-001',
        status: 'active',
        updatedAt: 1699999999999,
      },
    ];

    const result = dedupeIntakeRecords(duplicate);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('active');
  });

  test('prefers record with latest timestamp when status equal', () => {
    const duplicate = [
      {
        intakeId: 'intake-002',
        status: 'active',
        updatedAt: 1700000000000,
        displayTime: '2024-01-01 08:00',
      },
      {
        intakeId: 'intake-002',
        status: 'active',
        updatedAt: 1700001000000,
        displayTime: '2024-01-01 09:00',
      },
    ];

    const result = dedupeIntakeRecords(duplicate);
    expect(result).toHaveLength(1);
    expect(result[0].displayTime).toBe('2024-01-01 09:00');
  });

  test('dedupes excel-imported records using time, patient, hospital, diagnosis', () => {
    const baseTimestamp = Date.UTC(2023, 10, 1, 2, 30); // 2023-11-01 10:30 GMT+8 approx
    const excelRecords = [
      {
        status: 'imported',
        updatedAt: baseTimestamp,
        metadata: { source: 'excel-import', excelRecordId: 'rec-1' },
        patientKey: 'patient-A',
        hospital: '广州脑科医院',
        diagnosis: '脑瘫',
      },
      {
        status: 'imported',
        updatedAt: baseTimestamp + 5000,
        metadata: { source: 'excel-import', excelRecordId: 'rec-1' },
        patientKey: 'patient-A',
        hospital: '广州脑科医院',
        diagnosis: '脑瘫',
      },
    ];

    const result = dedupeIntakeRecords(excelRecords);
    expect(result).toHaveLength(1);
    expect(result[0].updatedAt).toBe(baseTimestamp + 5000);
  });
});
