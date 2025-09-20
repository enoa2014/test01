function mergeFamilyAddresses(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    return Array.isArray(entries) ? entries : [];
  }

  const normalized = [];
  const addressValues = [];
  const seen = new Set();
  let addressInsertIndex = null;
  const familyLabel = '家庭地址';
  const addressRegex = /^家庭地址\d*$/;

  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const label = (entry.label || '').trim();
    const value = entry.value == null ? '' : String(entry.value).trim();
    const isAddress = addressRegex.test(label) || label === familyLabel;

    if (!isAddress) {
      normalized.push(entry);
      return;
    }

    if (addressInsertIndex === null) {
      addressInsertIndex = normalized.length;
    }
    if (!value) {
      return;
    }

    const key = value.replace(/\s+/g, '');
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    addressValues.push(value);
  });

  if (addressValues.length) {
    const combined = { label: familyLabel, value: addressValues.join('；') };
    if (addressInsertIndex === null || addressInsertIndex > normalized.length) {
      normalized.push(combined);
    } else {
      normalized.splice(addressInsertIndex, 0, combined);
    }
  }

  return normalized;
}

Page({
  data: {
    loading: true,
    error: '',
    patient: null,
    basicInfo: [],
    familyInfo: [],
    economicInfo: [],
    records: []
  },

  onLoad(options) {
    this.patientKey = options?.key ? decodeURIComponent(options.key) : '';
    if (!this.patientKey) {
      this.setData({ loading: false, error: '缺少患者标识' });
      return;
    }
    this.fetchPatientDetail();
  },

  async fetchPatientDetail() {
    this.setData({ loading: true, error: '' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'readExcel',
        data: { action: 'detail', key: this.patientKey }
      });
      const result = res?.result || {};
      const patient = result.patient || null;
      if (patient?.patientName) {
        wx.setNavigationBarTitle({ title: patient.patientName });
      }
      const basicInfo = (result.basicInfo || []).map((item) => (item && typeof item === 'object' ? { ...item } : { label: '', value: item || '' }));

      const ensureField = (label, fallbackValue) => {
        const existing = basicInfo.find((item) => item && item.label === label);
        const fallback = fallbackValue();
        if (existing) {
          existing.value = existing.value || fallback;
        } else {
          basicInfo.push({ label, value: fallback });
        }
      };

      ensureField('籍贯', () => (patient && patient.nativePlace) || '未知');
      ensureField('民族', () => (patient && patient.ethnicity) || '未知');

      this.setData({
        loading: false,
        patient,
        basicInfo,
        familyInfo: mergeFamilyAddresses(result.familyInfo || []),
        economicInfo: result.economicInfo || [],
        records: result.records || []
      });
    } catch (error) {
      console.error('Failed to load patient detail', error);
      this.setData({
        loading: false,
        error: (error && error.errMsg) || '加载患者详情失败'
      });
    }
  }
});
