// P1-4: 卡片密度模式预设
const MODE_PRESETS = {
  list: {
    cardVariant: 'default',
    padding: 'var(--space-5)',
  },
  compact: {
    cardVariant: 'elevated',
    padding: 'var(--space-4)',
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
    swipeActions: {
      type: Array,
      value: [
        { id: 'edit', icon: '✏️', type: 'default' },
        { id: 'call', icon: '📞', type: 'primary' },
        { id: 'delete', icon: '🗑️', type: 'danger' }
      ],
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
    hasActions: false,
    statusIndicator: null,
    statusIcon: null,
    isSwiping: false,
    isLongPressing: false,
    computedBadges: [],
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
      const avatarBackground =
        AVATAR_COLORS[hashToIndex(patient.name || patient.patientName || '', AVATAR_COLORS.length)];
      const ageSource =
        patient.ageText !== undefined && patient.ageText !== null
          ? patient.ageText
          : patient.age !== undefined && patient.age !== null
            ? patient.age
            : patient.ageYears;
      const ageText = safeString(ageSource !== undefined ? `${ageSource}` : '');
      const primaryLine = safeString(
        patient.latestAdmissionDisplay ||
          patient.latestEvent ||
          patient.latestDiagnosis ||
          patient.firstDiagnosis
      );
      const secondaryLine = safeString(patient.latestHospital || patient.firstHospital);
      const tags = Array.isArray(patient.tags) ? patient.tags : [];
      const infoItems = [];

      // 状态指示处理
      const status = patient.status || patient.cardStatus || 'default';
      let statusIndicator = null;
      let statusIcon = null;

      if (status === 'in_care') {
        statusIndicator = { type: 'in_care' };
        statusIcon = { type: 'in_care', icon: '🏠' };
      } else if (status === 'pending') {
        statusIndicator = { type: 'pending' };
        statusIcon = { type: 'pending', icon: '⏳' };
      } else if (status === 'discharged') {
        statusIndicator = { type: 'discharged' };
        statusIcon = { type: 'discharged', icon: '✅' };
      }

      // P0: 最近入住时间 - 小家入住周期管理核心
      if (patient.latestAdmissionDateFormatted) {
        infoItems.push({
          label: '最近入住',
          value: patient.latestAdmissionDateFormatted,
          priority: 0,
        });
      } else {
        infoItems.push({ label: '最近入住', value: '未入住', priority: 0 });
      }

      // P1: 入住次数 - 服务频次统计
      if (patient.admissionCount !== undefined && patient.admissionCount !== null) {
        infoItems.push({ label: '入住次数', value: `${patient.admissionCount}次`, priority: 1 });
      }

      // 智能信息展示策略
      const mode = this.data.mode;

      // P2: 就医医院 - 背景信息 (comfortable模式及以上显示)
      if (safeString(patient.latestHospital) && mode !== 'compact') {
        infoItems.push({ label: '就医医院', value: patient.latestHospital, priority: 2 });
      }

      // P3: 年龄段 - 次要信息 (comfortable模式及以上显示)
      if (safeString(patient.ageBucketLabel) && (mode === 'comfortable' || mode === 'spacious' || mode === 'detail')) {
        infoItems.push({ label: '年龄段', value: patient.ageBucketLabel, priority: 3 });
      }

      // P4: 籍贯 - 次要信息 (spacious模式及以上显示)
      if (safeString(patient.nativePlace) && (mode === 'spacious' || mode === 'detail')) {
        infoItems.push({ label: '籍贯', value: patient.nativePlace, priority: 4 });
      }

      // P5: 主要诊断 - 关键信息 (所有模式显示)
      if (safeString(patient.firstDiagnosis) && mode !== 'compact') {
        infoItems.push({ label: '主要诊断', value: patient.firstDiagnosis, priority: 1 });
      }

      // 根据模式限制信息数量
      const maxInfoItems = {
        compact: 2,
        list: 3,
        comfortable: 4,
        spacious: 5,
        detail: 6
      };

      // 按优先级排序并限制数量
      infoItems.sort((a, b) => a.priority - b.priority);
      const maxItems = maxInfoItems[mode] || 3;
      if (infoItems.length > maxItems) {
        infoItems.splice(maxItems);
      }

      const hasActions = Array.isArray(this.data.actions) && this.data.actions.length > 0;

      const badgesInput = Array.isArray(this.data.badges) ? this.data.badges : [];
      // 在单元测试上下文中，methods 未绑定到 this，兜底使用本地映射逻辑
      const mapBadges = (arr) => arr.map(b => {
        const type = String((b && b.type) || '').toLowerCase();
        const mappedType = (type === 'info' || type === 'default') ? 'secondary' : (type || 'secondary');
        const variant = b && b.variant
          ? b.variant
          : (b && b._type === 'media')
            ? 'soft'
            : ((mappedType === 'success' || mappedType === 'warning' || mappedType === 'danger') ? 'solid' : 'outline');
        return { ...b, type: mappedType, variant };
      });
      const computedBadges = (this && typeof this.computeBadges === 'function')
        ? this.computeBadges(badgesInput)
        : mapBadges(badgesInput);

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
        hasActions,
        statusIndicator,
        statusIcon,
        computedBadges,
      });
    },
    computeBadges(badges) {
      const mapType = t => {
        const s = (t || '').toLowerCase();
        if (s === 'info' || s === 'default') return 'secondary';
        return s || 'secondary';
      };
      const decideVariant = (badge) => {
        if (badge && badge.variant) return badge.variant;
        if (badge && badge._type === 'media') return 'soft';
        const t = mapType(badge && badge.type);
        if (t === 'success' || t === 'warning' || t === 'danger') return 'solid';
        return 'outline';
      };
      return badges.map(b => ({
        ...b,
        type: mapType(b.type),
        variant: decideVariant(b),
      }));
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
    handleActionTap(event) {
      const action =
        event && event.currentTarget && event.currentTarget.dataset
          ? event.currentTarget.dataset.action
          : undefined;
      if (!action) {
        return;
      }
      this.triggerEvent('actiontap', {
        action,
        patient: this.data.patient,
      });
    },
    handleLongPress() {
      const applyState = updates => {
        if (typeof this.setData === 'function') {
          this.setData(updates);
        } else if (this.data && typeof this.data === 'object') {
          this.data = { ...this.data, ...updates };
        }
      };

      applyState({ isLongPressing: true });
      this.triggerEvent('longpress', { patient: this.data.patient });

      // 长按结束后重置状态
      setTimeout(() => {
        applyState({ isLongPressing: false });
      }, 300);
    },
    handleMediaTap(event) {
      const { type } = event.currentTarget.dataset;
      this.triggerEvent('mediatap', {
        patient: this.data.patient,
        mediaType: type,
      });
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    },
    handleSwipeActionTap(event) {
      const { action } = event.currentTarget.dataset;
      this.triggerEvent('swipeactiontap', {
        action,
        patient: this.data.patient,
      });
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    },
    handleThumbnailTap(event) {
      const { index } = event.currentTarget.dataset;
      this.triggerEvent('thumbnailtap', {
        index: parseInt(index, 10),
        patient: this.data.patient,
        thumbnails: this.data.mediaPreview?.thumbnails || [],
      });
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    },
  },
});
