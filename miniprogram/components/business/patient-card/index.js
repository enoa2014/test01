const MODE_PRESETS = {
  list: {
    cardVariant: 'default',
    padding: 'var(--space-5)',
  },
  compact: {
    cardVariant: 'elevated',
    padding: 'var(--space-4)',
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
  },
  data: {
    avatarText: '—',
    avatarBackground: 'var(--color-primary)',
    ageText: '',
    primaryLine: '',
    secondaryLine: '',
    tags: [],
    hasActions: false,
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
    'patient,mode,badges,actions': function observer() {
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
      const hasActions = Array.isArray(this.data.actions) && this.data.actions.length > 0;
      const infoItems = [];
      if (patient.latestAdmissionDateFormatted) {
        infoItems.push({ label: '最近入住', value: patient.latestAdmissionDateFormatted });
      } else {
        infoItems.push({ label: '最近入住', value: '未入住' });
      }
      if (safeString(patient.latestDoctor)) {
        infoItems.push({ label: '责任医生', value: patient.latestDoctor });
      }
      if (safeString(patient.ageBucketLabel)) {
        infoItems.push({ label: '年龄段', value: patient.ageBucketLabel });
      }
      if (safeString(patient.nativePlace)) {
        infoItems.push({ label: '籍贯', value: patient.nativePlace });
      }

      this.setData({
        avatarText,
        avatarBackground,
        ageText,
        primaryLine,
        secondaryLine,
        tags,
        hasActions,
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
    handleActionTap(event) {
      const action = event.currentTarget.dataset.action;
      this.triggerEvent('actiontap', { action, patient: this.data.patient });
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
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
  },
});
