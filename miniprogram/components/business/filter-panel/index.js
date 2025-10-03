const DEFAULT_STATUSES = [
  { id: 'in_care', label: '在住' },
  { id: 'followup', label: '随访' },
  { id: 'pending', label: '待入住' },
  { id: 'discharged', label: '已离开' },
];

const DEFAULT_RISK_LEVELS = [
  { id: 'high', label: '高风险' },
  { id: 'medium', label: '中风险' },
  { id: 'low', label: '低风险' },
];

const DEFAULT_HOSPITAL_OPTIONS = [
  { id: 'hospital_a', label: '第一医院' },
  { id: 'hospital_b', label: '第二医院' },
  { id: 'hospital_c', label: '第三医院' },
];

const DEFAULT_DIAGNOSIS_OPTIONS = [
  { id: 'cardio', label: '心血管' },
  { id: 'neuro', label: '神经内科' },
  { id: 'resp', label: '呼吸内科' },
];

const OPTION_DATA_KEYS = {
  status: 'statusOptions',
  risk: 'riskOptions',
  hospital: 'hospitalList',
  gender: 'genderOptionsList',
  ethnicity: 'ethnicityOptionsList',
  native: 'nativePlaceOptionsList',
  doctor: 'doctorOptionsList',
  age: 'ageRangeOptionsList',
};

function normalizeOptions(list = [], selected = []) {
  const selectedSet = new Set(selected);
  return list.map(item => ({
    ...item,
    active: selectedSet.has(item.id),
  }));
}

function ensureArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value.slice() : [value];
}

function ensureDateRange(range) {
  const fallback = { start: '', end: '' };
  if (!range || typeof range !== 'object') {
    return fallback;
  }
  return {
    start: range.start || '',
    end: range.end || '',
  };
}

function buildInitialValue(props) {
  const value = props && props.value ? props.value : {};
  return {
    statuses: ensureArray(value.statuses),
    riskLevels: ensureArray(value.riskLevels),
    dateRange: ensureDateRange(value.dateRange),
    diagnosis: ensureArray(value.diagnosis),
    hospitals: ensureArray(value.hospitals),
    genders: ensureArray(value.genders),
    ethnicities: ensureArray(value.ethnicities),
    nativePlaces: ensureArray(value.nativePlaces),
    ageRanges: ensureArray(value.ageRanges),
    doctors: ensureArray(value.doctors),
    logicMode: value.logicMode === 'OR' ? 'OR' : 'AND',
  };
}

function mapDiagnosisSelection(ids, options) {
  const optionArray = Array.isArray(options) ? options : [];
  const optionMap = new Map(optionArray.map(item => [item.id, item.label || item.id]));
  return ensureArray(ids).map(id => ({
    id,
    label: optionMap.get(id) || id,
  }));
}

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true,
  },
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    statuses: {
      type: Array,
      value: DEFAULT_STATUSES,
    },
    riskLevels: {
      type: Array,
      value: DEFAULT_RISK_LEVELS,
    },
    diagnosisOptions: {
      type: Array,
      value: DEFAULT_DIAGNOSIS_OPTIONS,
    },
    hospitalOptions: {
      type: Array,
      value: DEFAULT_HOSPITAL_OPTIONS,
    },
    genderOptions: {
      type: Array,
      value: [],
    },
    ethnicityOptions: {
      type: Array,
      value: [],
    },
    nativePlaceOptions: {
      type: Array,
      value: [],
    },
    doctorOptions: {
      type: Array,
      value: [],
    },
    ageRangeOptions: {
      type: Array,
      value: [],
    },
    value: {
      type: Object,
      value: null,
    },
    closeOnOverlay: {
      type: Boolean,
      value: true,
    },
    previewCount: {
      type: Number,
      value: -1,
    },
    previewLabel: {
      type: String,
      value: '名住户符合筛选',
    },
    previewLoading: {
      type: Boolean,
      value: false,
    },
    schemes: {
      type: Array,
      value: [],
    },
  },
  data: {
    statusOptions: [],
    riskOptions: [],
    hospitalList: [],
    genderOptionsList: [],
    ethnicityOptionsList: [],
    nativePlaceOptionsList: [],
    doctorOptionsList: [],
    ageRangeOptionsList: [],
    searchTerm: '',
    selectedDiagnosis: [],
    dateRange: { start: '', end: '' },
    availableDiagnosis: DEFAULT_DIAGNOSIS_OPTIONS,
    logicMode: 'AND',
    // P1-2: 方案管理模式状态
    showSchemeManager: false,
  },
  observers: {
    statuses(list) {
      const selected = (this.data.statusOptions || []).filter(item => item.active).map(item => item.id);
      this.updateStatusOptions(list, selected);
    },
    riskLevels(list) {
      const selected = (this.data.riskOptions || []).filter(item => item.active).map(item => item.id);
      this.updateRiskOptions(list, selected);
    },
    hospitalOptions(list) {
      const selected = (this.data.hospitalList || []).filter(item => item.active).map(item => item.id);
      this.updateHospitalOptions(list, selected);
    },
    genderOptions(list) {
      const selected = (this.data.genderOptionsList || []).filter(item => item.active).map(item => item.id);
      this.updateGenderOptions(list, selected);
    },
    ethnicityOptions(list) {
      const selected = (this.data.ethnicityOptionsList || []).filter(item => item.active).map(item => item.id);
      this.updateEthnicityOptions(list, selected);
    },
    nativePlaceOptions(list) {
      const selected = (this.data.nativePlaceOptionsList || []).filter(item => item.active).map(item => item.id);
      this.updateNativePlaceOptions(list, selected);
    },
    doctorOptions(list) {
      const selected = (this.data.doctorOptionsList || []).filter(item => item.active).map(item => item.id);
      this.updateDoctorOptions(list, selected);
    },
    ageRangeOptions(list) {
      const selected = (this.data.ageRangeOptionsList || []).filter(item => item.active).map(item => item.id);
      this.updateAgeRangeOptions(list, selected);
    },
    diagnosisOptions(list) {
      const options = Array.isArray(list) && list.length ? list : DEFAULT_DIAGNOSIS_OPTIONS;
      const currentIds = ensureArray(this.data.selectedDiagnosis).map(item =>
        typeof item === 'string' ? item : item.id
      );
      this.setData({
        availableDiagnosis: options,
        selectedDiagnosis: mapDiagnosisSelection(currentIds, options),
      });
    },
    value(val) {
      this.applyValue(val);
    },
  },
  lifetimes: {
    attached() {
      const initialDiagnosis = this.properties.diagnosisOptions && this.properties.diagnosisOptions.length
        ? this.properties.diagnosisOptions
        : DEFAULT_DIAGNOSIS_OPTIONS;
      this.setData({
        availableDiagnosis: initialDiagnosis,
      });
      this.applyValue(this.properties.value);
    },
    detached() {
      this.clearTimers();
    },
  },
  methods: {
    noop() {},
    clearTimers() {
      if (this._searchDebounce) {
        clearTimeout(this._searchDebounce);
        this._searchDebounce = null;
      }
    },

    applyValue(val) {
      const initial = buildInitialValue({ value: val });
      this.updateStatusOptions(this.properties.statuses, initial.statuses);
      this.updateRiskOptions(this.properties.riskLevels, initial.riskLevels);
      this.updateHospitalOptions(this.properties.hospitalOptions, initial.hospitals);
      this.updateGenderOptions(this.properties.genderOptions, initial.genders);
      this.updateEthnicityOptions(this.properties.ethnicityOptions, initial.ethnicities);
      this.updateNativePlaceOptions(this.properties.nativePlaceOptions, initial.nativePlaces);
      this.updateDoctorOptions(this.properties.doctorOptions, initial.doctors);
      this.updateAgeRangeOptions(this.properties.ageRangeOptions, initial.ageRanges);
      this.setData({
        selectedDiagnosis: mapDiagnosisSelection(initial.diagnosis, this.data.availableDiagnosis),
        dateRange: initial.dateRange,
        logicMode: initial.logicMode,
      });
    },

    updateStatusOptions(list, selected) {
      const normalized = normalizeOptions(
        Array.isArray(list) && list.length ? list : DEFAULT_STATUSES,
        ensureArray(selected)
      );
      this.setData({ statusOptions: normalized });
    },

    updateRiskOptions(list, selected) {
      const normalized = normalizeOptions(
        Array.isArray(list) && list.length ? list : DEFAULT_RISK_LEVELS,
        ensureArray(selected)
      );
      this.setData({ riskOptions: normalized });
    },

    updateHospitalOptions(list, selected) {
      const normalized = normalizeOptions(
        Array.isArray(list) && list.length ? list : DEFAULT_HOSPITAL_OPTIONS,
        ensureArray(selected)
      );
      this.setData({ hospitalList: normalized });
    },

    updateGenderOptions(list, selected) {
      const normalized = normalizeOptions(Array.isArray(list) && list.length ? list : [], ensureArray(selected));
      this.setData({ genderOptionsList: normalized });
    },

    updateEthnicityOptions(list, selected) {
      const normalized = normalizeOptions(Array.isArray(list) && list.length ? list : [], ensureArray(selected));
      this.setData({ ethnicityOptionsList: normalized });
    },

    updateNativePlaceOptions(list, selected) {
      const normalized = normalizeOptions(Array.isArray(list) && list.length ? list : [], ensureArray(selected));
      this.setData({ nativePlaceOptionsList: normalized });
    },

    updateDoctorOptions(list, selected) {
      const normalized = normalizeOptions(Array.isArray(list) && list.length ? list : [], ensureArray(selected));
      this.setData({ doctorOptionsList: normalized });
    },

    updateAgeRangeOptions(list, selected) {
      const normalized = normalizeOptions(Array.isArray(list) && list.length ? list : [], ensureArray(selected));
      this.setData({ ageRangeOptionsList: normalized });
    },

    buildCurrentValue() {
      return {
        statuses: this.data.statusOptions.filter(item => item.active).map(item => item.id),
        riskLevels: this.data.riskOptions.filter(item => item.active).map(item => item.id),
        hospitals: this.data.hospitalList.filter(item => item.active).map(item => item.id),
        diagnosis: ensureArray(this.data.selectedDiagnosis).map(item => (item && item.id ? item.id : item)),
        dateRange: ensureDateRange(this.data.dateRange),
        genders: this.data.genderOptionsList.filter(item => item.active).map(item => item.id),
        ethnicities: this.data.ethnicityOptionsList.filter(item => item.active).map(item => item.id),
        nativePlaces: this.data.nativePlaceOptionsList.filter(item => item.active).map(item => item.id),
        ageRanges: this.data.ageRangeOptionsList.filter(item => item.active).map(item => item.id),
        doctors: this.data.doctorOptionsList.filter(item => item.active).map(item => item.id),
        logicMode: this.data.logicMode === 'OR' ? 'OR' : 'AND',
      };
    },

    emitChange(type) {
      const value = this.buildCurrentValue();
      this.triggerEvent('change', {
        source: type,
        value,
      });
      this.emitPreview(value);
    },

    emitPreview(value) {
      const activeFilters = this.computeActiveFilters(value);
      this.triggerEvent('preview', {
        value,
        activeFilters,
        logicMode: value.logicMode,
      });
    },

    computeActiveFilters(value) {
      const activeSet = [];
      if (value.statuses && value.statuses.length) {
        activeSet.push('statuses');
      }
      if (value.riskLevels && value.riskLevels.length) {
        activeSet.push('riskLevels');
      }
      if (value.hospitals && value.hospitals.length) {
        activeSet.push('hospitals');
      }
      if (value.diagnosis && value.diagnosis.length) {
        activeSet.push('diagnosis');
      }
      if (value.genders && value.genders.length) {
        activeSet.push('genders');
      }
      if (value.ethnicities && value.ethnicities.length) {
        activeSet.push('ethnicities');
      }
      if (value.nativePlaces && value.nativePlaces.length) {
        activeSet.push('nativePlaces');
      }
      if (value.ageRanges && value.ageRanges.length) {
        activeSet.push('ageRanges');
      }
      if (value.doctors && value.doctors.length) {
        activeSet.push('doctors');
      }
      const { start, end } = value.dateRange || {};
      if (start || end) {
        activeSet.push('dateRange');
      }
      return activeSet;
    },

    toggleOption(key, id) {
      const dataKey = OPTION_DATA_KEYS[key];
      if (!dataKey) {
        return;
      }
      const current = this.data[dataKey];
      if (!Array.isArray(current)) {
        return;
      }
      const updated = current.map(item => {
        if (item.id === id) {
          return { ...item, active: !item.active };
        }
        return item;
      });
      this.setData({ [dataKey]: updated }, () => {
        this.emitChange(key);
      });
    },

    onStatusToggle(event) {
      const { id } = event.currentTarget.dataset || {};
      if (!id) {
        return;
      }
      this.toggleOption('status', id);
    },

    onRiskToggle(event) {
      const { id } = event.currentTarget.dataset || {};
      if (!id) {
        return;
      }
      this.toggleOption('risk', id);
    },

    onHospitalToggle(event) {
      const { id } = event.currentTarget.dataset || {};
      if (!id) {
        return;
      }
      this.toggleOption('hospital', id);
    },

    onGenderToggle(event) {
      const { id } = event.currentTarget.dataset || {};
      if (!id) {
        return;
      }
      this.toggleOption('gender', id);
    },

    onEthnicityToggle(event) {
      const { id } = event.currentTarget.dataset || {};
      if (!id) {
        return;
      }
      this.toggleOption('ethnicity', id);
    },

    onNativePlaceToggle(event) {
      const { id } = event.currentTarget.dataset || {};
      if (!id) {
        return;
      }
      this.toggleOption('native', id);
    },

    onDoctorToggle(event) {
      const { id } = event.currentTarget.dataset || {};
      if (!id) {
        return;
      }
      this.toggleOption('doctor', id);
    },

    onAgeRangeToggle(event) {
      const { id } = event.currentTarget.dataset || {};
      if (!id) {
        return;
      }
      this.toggleOption('age', id);
    },

    onStartDateChange(event) {
      const value = (event.detail && event.detail.value) || '';
      this.setData({
        dateRange: {
          ...this.data.dateRange,
          start: value,
        },
      }, () => {
        this.emitChange('date');
      });
    },

    onEndDateChange(event) {
      const value = (event.detail && event.detail.value) || '';
      this.setData({
        dateRange: {
          ...this.data.dateRange,
          end: value,
        },
      }, () => {
        this.emitChange('date');
      });
    },

    onDiagnosisInput(event) {
      const term = (event.detail && event.detail.value) || '';
      this.setData({ searchTerm: term });
      this.clearTimers();
      this._searchDebounce = setTimeout(() => {
        this._searchDebounce = null;
        this.triggerEvent('searchdiagnosis', { keyword: term });
      }, 200);
    },

    onDiagnosisSelect(event) {
      const { id } = event.currentTarget.dataset || {};
      if (!id) {
        return;
      }
      const label = event.currentTarget.dataset.label || id;
      const selected = ensureArray(this.data.selectedDiagnosis);
      if (selected.some(item => item.id === id)) {
        return;
      }
      const next = selected.concat({ id, label });
      this.setData({ selectedDiagnosis: next }, () => {
        this.emitChange('diagnosis');
      });
      this.triggerEvent('diagnosisselect', { id, label });
    },

    onDiagnosisTagRemove(event) {
      const { id } = event.currentTarget.dataset || {};
      if (!id) {
        return;
      }
      const next = ensureArray(this.data.selectedDiagnosis).filter(item => item.id !== id);
      this.setData({ selectedDiagnosis: next }, () => {
        this.emitChange('diagnosis');
      });
    },

    onLogicModeToggle(event) {
      const { mode } = event.currentTarget.dataset || {};
      if (!mode || (mode !== 'AND' && mode !== 'OR') || mode === this.data.logicMode) {
        return;
      }
      this.setData({ logicMode: mode }, () => {
        this.emitChange('logic');
      });
    },

    onReset() {
      this.applyValue(null);
      this.setData({ searchTerm: '', logicMode: 'AND' }, () => {
        this.emitChange('reset');
      });
      this.triggerEvent('reset');
    },

    onApply() {
      const value = this.buildCurrentValue();
      this.triggerEvent('apply', { value });
      this.emitPreview(value);
    },

    onMaskTap() {
      if (this.data.closeOnOverlay) {
        this.triggerEvent('close');
      }
    },

    handleCloseTap() {
      this.triggerEvent('close');
    },

    onSaveSchemeTap() {
      this.triggerEvent('savescheme');
    },

    onApplySchemeTap(event) {
      const id = event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.id;
      if (id) {
        this.triggerEvent('appliescheme', { id });
      }
    },

    onDeleteSchemeTap(event) {
      const id = event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.id;
      if (id) {
        this.triggerEvent('deletescheme', { id });
      }
    },

    onRenameSchemeTap(event) {
      const id = event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.id;
      if (id) {
        this.triggerEvent('renamescheme', { id });
      }
    },

    // P1-2: 切换方案管理模式
    onToggleSchemeManager() {
      this.setData({
        showSchemeManager: !this.data.showSchemeManager,
      });
    },
  },
});
