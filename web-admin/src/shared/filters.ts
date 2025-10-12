export type FilterOption = { id: string; label: string };

export type AdvancedFilters = {
  statuses: string[];
  riskLevels: string[];
  hospitals: string[];
  diagnosis: string[];
  genders: string[];
  ethnicities: string[];
  nativePlaces: string[];
  ageRanges: string[];
  doctors: string[];
  dateRange: { start?: string; end?: string };
};

export const getDefaultAdvancedFilters = (): AdvancedFilters => ({
  statuses: [],
  riskLevels: [],
  hospitals: [],
  diagnosis: [],
  genders: [],
  ethnicities: [],
  nativePlaces: [],
  ageRanges: [],
  doctors: [],
  dateRange: { start: '', end: '' }
});

export const normalizeAdvancedFilters = (f: AdvancedFilters): AdvancedFilters => ({
  ...getDefaultAdvancedFilters(),
  ...f,
  statuses: (f.statuses || []).filter(Boolean),
  riskLevels: (f.riskLevels || []).filter(Boolean),
  hospitals: (f.hospitals || []).filter(Boolean),
  diagnosis: (f.diagnosis || []).filter(Boolean),
  genders: (f.genders || []).filter(Boolean),
  ethnicities: (f.ethnicities || []).filter(Boolean),
  nativePlaces: (f.nativePlaces || []).filter(Boolean),
  ageRanges: (f.ageRanges || []).filter(Boolean),
  doctors: (f.doctors || []).filter(Boolean),
  dateRange: { start: f?.dateRange?.start || '', end: f?.dateRange?.end || '' }
});

// 简化版：仅返回原列表，实际筛选逻辑后续可扩展
export const applyAdvancedFilters = <T extends Record<string, any>>(items: T[], _f: AdvancedFilters): T[] => {
  return items;
};

export const deriveHospitalOptions = <T extends Record<string, any>>(items: T[]): FilterOption[] => {
  const set = new Set<string>();
  items.forEach(p => {
    const h = (p.latestHospital || p.hospital || '').toString().trim();
    if (h) set.add(h);
  });
  return Array.from(set).map(id => ({ id, label: id }));
};

export const deriveDiagnosisOptions = <T extends Record<string, any>>(items: T[]): FilterOption[] => {
  const set = new Set<string>();
  items.forEach(p => {
    const d = (p.latestDiagnosis || p.diagnosis || '').toString().trim();
    if (d) set.add(d);
  });
  return Array.from(set).map(id => ({ id, label: id }));
};

export const summarizeFiltersForScheme = (f: AdvancedFilters): string => {
  const parts: string[] = [];
  if (f.statuses.length) parts.push(`状态=${f.statuses.join(',')}`);
  if (f.hospitals.length) parts.push(`医院=${f.hospitals.slice(0, 2).join(',')}${f.hospitals.length > 2 ? '…' : ''}`);
  if (f.diagnosis.length) parts.push(`诊断=${f.diagnosis.slice(0, 2).join(',')}${f.diagnosis.length > 2 ? '…' : ''}`);
  if (f.genders.length) parts.push(`性别=${f.genders.join(',')}`);
  if (f.ethnicities.length) parts.push(`民族=${f.ethnicities.slice(0, 2).join(',')}${f.ethnicities.length > 2 ? '…' : ''}`);
  if (f.nativePlaces.length) parts.push(`籍贯=${f.nativePlaces.slice(0, 2).join(',')}${f.nativePlaces.length > 2 ? '…' : ''}`);
  if (f.doctors.length) parts.push(`医生=${f.doctors.slice(0, 2).join(',')}${f.doctors.length > 2 ? '…' : ''}`);
  if (f.dateRange.start || f.dateRange.end) parts.push(`时间=${f.dateRange.start || ''}~${f.dateRange.end || ''}`);
  return parts.join('；') || '未设置';
};

// Age bucket definitions
export const AGE_BUCKETS = [
  { id: '0-3', label: '0-3岁', min: 0, max: 3 },
  { id: '4-6', label: '4-6岁', min: 4, max: 6 },
  { id: '7-12', label: '7-12岁', min: 7, max: 12 },
  { id: '13-17', label: '13-17岁', min: 13, max: 17 },
  { id: '18+', label: '18岁及以上', min: 18, max: 200 },
];

// Resolve age bucket from age
export const resolveAgeBucket = (age: number | null | undefined) => {
  if (typeof age !== 'number' || !isFinite(age) || age < 0) {
    return null;
  }
  return AGE_BUCKETS.find(bucket => age >= bucket.min && age <= bucket.max) || null;
};

// Get age bucket label by ID
export const getAgeBucketLabelById = (id: string): string => {
  const bucket = AGE_BUCKETS.find(b => b.id === id);
  return bucket ? bucket.label : id;
};

// Calculate age from birth date
export const calculateAge = (birthDate: string | Date | null | undefined): number | null => {
  if (!birthDate) return null;
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
};

// Format age
export const formatAge = (birthDate: string | Date | null | undefined): string => {
  const age = calculateAge(birthDate);
  if (age === null) return '-';
  return `${age}岁`;
};

