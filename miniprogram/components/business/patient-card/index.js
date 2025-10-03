// P1-4: 卡片密度模式预设
const MODE_PRESETS = {
  list: {
    cardVariant: 'default',
    padding: 'var(--space-5)',
  },
  compact: {
    cardVariant: 'elevated',
    padding: 'var(--space-3)',
  },
  comfortable: {
    cardVariant: 'elevated',
    padding: 'var(--space-4)',
  },
  spacious: {
    cardVariant: 'elevated',
    padding: 'var(--space-6)',
  },
  detail: {
    cardVariant: 'default',
    padding: 'var(--space-5)',
  },
};

const AVATAR_COLORS = [
  'var(--color-primary)',
  'var(--color-info)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
];

function safeString(input) {
  if (input === null || input === undefined) return '';
  return String(input).trim();
}

function getInitials(name) {
  const str = safeString(name);
  if (!str) {
    return '—';
  }
  const simplified = str.replace(/\s+/g, '');
  return simplified.slice(0, 1).toUpperCase();
}

function hashToIndex(value, modulo) {
  const str = safeString(value);
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    hash = (hash << 5) - hash + code;
    hash |= 0; // Convert to 32bit
  }
  const positive = Math.abs(hash);
  return modulo > 0 ? positive % modulo : 0;
}

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true,
  },
  properties: {
    patient: {
      type: Object,
      value: {},
    },
    mode: {
      type: String,
      value: 'compact',
    },
    selectable: {
      type: Boolean,
      value: false,
    },
    selected: {
      type: Boolean,
      value: false,
    },
    badges: {
      type: Array,
      value: [],
    },
    actions: {
      type: Array,
      value: [],
    },
    clickable: {
      type: Boolean,
      value: true,
    },
    status: {
      type: String,
      value: 'default',
    },
    mediaPreview: {
      type: Object,
      value: null,
    },
  },
  data: {
    avatarText: '—',
    avatarBackground: 'var(--color-primary)',
    ageText: '',
    primaryLine: '',
    secondaryLine: '',
    tags: [],
    cardVariant: 'default',
    cardPadding: 'var(--space-4)',
    infoItems: [],
  },
  lifetimes: {
    attached() {
      this.updateComputedState();
    },
  },
  observers: {
    'patient,mode,badges': function observer() {
      this.updateComputedState();
    },
  },
  methods: {
    updateComputedState() {
      const patient = this.data.patient || {};
      const modePreset = MODE_PRESETS[this.data.mode] || MODE_PRESETS.compact;
      const avatarText = getInitials(patient.name || patient.patientName || patient.fullName);
      const avatarBackground = AVATAR_COLORS[hashToIndex(patient.name || patient.patientName || '', AVATAR_COLORS.length)];
      const ageText = safeString(patient.ageText || patient.age ? `${patient.age || patient.ageText}` : '');
      const primaryLine = safeString(patient.latestAdmissionDisplay || patient.latestEvent || patient.latestDiagnosis || patient.firstDiagnosis);
      const secondaryLine = safeString(patient.latestHospital || patient.firstHospital);
      const tags = Array.isArray(patient.tags) ? patient.tags : [];
      const infoItems = [];

      // P0: 最近入住时间 - 小家入住周期管理核心
      if (patient.latestAdmissionDateFormatted) {
        infoItems.push({ label: '最近入住', value: patient.latestAdmissionDateFormatted, priority: 0 });
      } else {
        infoItems.push({ label: '最近入住', value: '未入住', priority: 0 });
      }

      // P1: 入住次数 - 服务频次统计
      if (patient.admissionCount !== undefined && patient.admissionCount !== null) {
        infoItems.push({ label: '入住次数', value: `${patient.admissionCount}次`, priority: 1 });
      }

      // P2: 就医医院 - 背景信息 (comfortable模式及以上显示)
      if (safeString(patient.latestHospital) && this.data.mode !== 'compact') {
        infoItems.push({ label: '就医医院', value: patient.latestHospital, priority: 2 });
      }

      // P3: 年龄段 - 次要信息 (spacious模式显示)
      if (safeString(patient.ageBucketLabel) && this.data.mode === 'spacious') {
        infoItems.push({ label: '年龄段', value: patient.ageBucketLabel, priority: 3 });
      }

      // P4: 籍贯 - 次要信息 (spacious模式显示)
      if (safeString(patient.nativePlace) && this.data.mode === 'spacious') {
        infoItems.push({ label: '籍贯', value: patient.nativePlace, priority: 4 });
      }

      this.setData({
        avatarText,
        avatarBackground,
        ageText,
        primaryLine,
        secondaryLine,
        tags,
        cardVariant: modePreset.cardVariant,
        cardPadding: modePreset.padding,
        infoItems,
      });
    },
    handleCardTap() {
      if (!this.data.clickable) {
        return;
      }
      this.triggerEvent('cardtap', { patient: this.data.patient });
    },
    handleSelectChange(event) {
      const nextSelected = !this.data.selected;
      this.triggerEvent('selectchange', { selected: nextSelected, patient: this.data.patient });
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    },
    handleLongPress() {
      this.triggerEvent('longpress', { patient: this.data.patient });
    },
    handleMediaTap(event) {
      const { type } = event.currentTarget.dataset;
      this.triggerEvent('mediatap', {
        patient: this.data.patient,
        mediaType: type
      });
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    },
  },
});
