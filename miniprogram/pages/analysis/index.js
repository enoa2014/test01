const AGE_BUCKETS = [
  { label: '0-5岁', min: 0, max: 5 },
  { label: '6-12岁', min: 6, max: 12 },
  { label: '13-17岁', min: 13, max: 17 },
  { label: '18岁及以上', min: 18, max: Infinity }
];

function normalizeDateString(value) {
  if (!value) {
    return '';
  }
  return String(value).replace(/[./]/g, '-');
}

function formatDate(value) {
  const normalized = normalizeDateString(value);
  if (!normalized) {
    return '';
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value || '';
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateAge(birthDate) {
  const normalized = normalizeDateString(birthDate);
  if (!normalized) {
    return null;
  }
  const birth = new Date(normalized);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function getPatientRef(item) {
  return {
    key: item.key,
    name: item.patientName || '未命名患者'
  };
}

function toStat(label, patients) {
  if (!patients || !patients.length) {
    return null;
  }
  const sample = patients.slice(0, 3).map((p) => p.name).join('、');
  return {
    label,
    count: patients.length,
    patients,
    sampleNames: sample
  };
}

function buildAgePanel(patients) {
  const buckets = AGE_BUCKETS.map((bucket) => ({ ...bucket, patients: [] }));
  const unknown = { label: '未知年龄', patients: [] };
  patients.forEach((item) => {
    const age = calculateAge(item.birthDate);
    const ref = getPatientRef(item);
    if (age == null) {
      unknown.patients.push(ref);
      return;
    }
    const bucket = buckets.find((range) => age >= range.min && age <= range.max);
    if (bucket) {
      bucket.patients.push(ref);
    } else {
      unknown.patients.push(ref);
    }
  });

  const stats = [];
  buckets.forEach((bucket) => {
    const stat = toStat(bucket.label, bucket.patients);
    if (stat) {
      stats.push(stat);
    }
  });
  const unknownStat = toStat(unknown.label, unknown.patients);
  if (unknownStat) {
    stats.push(unknownStat);
  }

  return {
    title: '按年龄段分析',
    stats,
    emptyText: '暂无年龄数据'
  };
}

function buildGroupPanel(title, groups, { emptyText = '暂无数据', sortByLabel = null, sortByValueDesc = true } = {}) {
  const stats = Object.keys(groups).map((label) => toStat(label, groups[label])).filter(Boolean);
  if (sortByLabel === 'asc') {
    stats.sort((a, b) => {
      const aUnknown = /未知/.test(a.label);
      const bUnknown = /未知/.test(b.label);
      if (aUnknown && !bUnknown) return 1;
      if (!aUnknown && bUnknown) return -1;
      return a.label > b.label ? 1 : -1;
    });
  } else if (sortByLabel === 'desc') {
    stats.sort((a, b) => {
      const aUnknown = /未知/.test(a.label);
      const bUnknown = /未知/.test(b.label);
      if (aUnknown && !bUnknown) return 1;
      if (!aUnknown && bUnknown) return -1;
      return a.label > b.label ? -1 : 1;
    });
  } else if (sortByValueDesc) {
    stats.sort((a, b) => b.count - a.count);
  }
  return { title, stats, emptyText };
}

function getMonthLabel(item) {
  const timestamp = Number(item.latestAdmissionTimestamp || 0);
  if (timestamp) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
    }
  }
  const formatted = item.latestAdmissionDateFormatted || formatDate(item.latestAdmissionDate || '');
  if (formatted) {
    const normalized = normalizeDateString(formatted);
    const date = normalized ? new Date(normalized) : null;
    if (date && !Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
    }
  }
  return '未知月份';
}

Page({
  data: {
    loading: true,
    error: '',
    patients: [],
    panels: [],
    selection: {
      visible: false,
      title: '',
      items: []
    }
  },

  onLoad() {
    this.fetchPatients();
  },

  async fetchPatients() {
    this.setData({ loading: true, error: '' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'patientProfile',
        data: { action: 'list' }
      });
      const sourcePatients = res?.result?.patients || [];
      const patients = sourcePatients.map((item) => {
        const latestAdmissionDateFormatted = formatDate(item.latestAdmissionDate || item.firstAdmissionDate);
        const firstAdmissionDateFormatted = formatDate(item.firstAdmissionDate || item.latestAdmissionDate);
        const firstDiagnosis = item.firstDiagnosis || item.latestDiagnosis || '';
        const latestDiagnosis = item.latestDiagnosis || item.firstDiagnosis || '';
        const firstHospital = item.firstHospital || item.latestHospital || '';
        const latestHospital = item.latestHospital || item.firstHospital || '';
        const latestDoctor = item.latestDoctor || '';
        return {
          ...item,
          latestAdmissionDateFormatted,
          firstAdmissionDateFormatted,
          firstDiagnosis,
          latestDiagnosis,
          firstHospital,
          latestHospital,
          latestDoctor
        };
      });
      const panels = this.buildPanels(patients);
      this.setData({ patients, panels, loading: false });
    } catch (error) {
      console.error('Failed to load analysis data', error);
      this.setData({
        loading: false,
        error: (error && error.errMsg) || '加载分析数据失败，请稍后重试'
      });
    }
  },

  buildPanels(patients) {
    const agePanel = buildAgePanel(patients);

    const placeGroups = {};
    patients.forEach((item) => {
      const label = (item.nativePlace || '').trim() || '未知籍贯';
      const ref = getPatientRef(item);
      if (!placeGroups[label]) {
        placeGroups[label] = [];
      }
      placeGroups[label].push(ref);
    });
    const placePanel = buildGroupPanel('按籍贯分析', placeGroups, { emptyText: '暂无籍贯数据' });

    const monthGroups = {};
    patients.forEach((item) => {
      const label = getMonthLabel(item);
      const ref = getPatientRef(item);
      if (!monthGroups[label]) {
        monthGroups[label] = [];
      }
      monthGroups[label].push(ref);
    });
    const monthPanel = buildGroupPanel('按最近入住月份分析', monthGroups, { emptyText: '暂无入住数据', sortByLabel: true });

    const hospitalGroups = {};
    patients.forEach((item) => {
      const label = (item.latestHospital || item.firstHospital || '').trim() || '未记录医院';
      const ref = getPatientRef(item);
      if (!hospitalGroups[label]) {
        hospitalGroups[label] = [];
      }
      hospitalGroups[label].push(ref);
    });
    const hospitalPanel = buildGroupPanel('按就诊医院分析', hospitalGroups, { emptyText: '暂无医院数据' });

    const doctorGroups = {};
    patients.forEach((item) => {
      const label = (item.latestDoctor || '').trim() || '未记录医生';
      const ref = getPatientRef(item);
      if (!doctorGroups[label]) {
        doctorGroups[label] = [];
      }
      doctorGroups[label].push(ref);
    });
    const doctorPanel = buildGroupPanel('按医生分析', doctorGroups, { emptyText: '暂无医生数据' });

    return [agePanel, placePanel, monthPanel, hospitalPanel, doctorPanel];
  },

  onStatTap(event) {
    const { panelIndex, statIndex } = event.currentTarget.dataset;
    const panel = this.data.panels?.[panelIndex];
    const stat = panel?.stats?.[statIndex];
    if (!stat || !stat.patients?.length) {
      return;
    }
    this.setData({
      selection: {
        visible: true,
        title: `${panel.title} · ${stat.label}`,
        items: stat.patients
      }
    });
  },

  onSelectionClose() {
    if (!this.data.selection.visible) {
      return;
    }
    this.setData({ 'selection.visible': false });
  },

  onSelectionItemTap(event) {
    const { key } = event.currentTarget.dataset;
    if (!key) {
      return;
    }
    this.setData({ 'selection.visible': false }, () => {
      wx.navigateTo({
        url: `/pages/patient-detail/detail?key=${encodeURIComponent(key)}`
      });
    });
  },

  noop() {}
});
