import React, { useState, useEffect } from 'react';
import type { AdvancedFilters, FilterOption } from '../shared/filters';

type Props = {
  visible: boolean;
  filters: AdvancedFilters;
  hospitalOptions: FilterOption[];
  diagnosisOptions: FilterOption[];
  genderOptions: FilterOption[];
  ethnicityOptions: FilterOption[];
  nativePlaceOptions: FilterOption[];
  doctorOptions: FilterOption[];
  previewCount: number;
  previewLoading: boolean;
  onClose: () => void;
  onApply: (filters: AdvancedFilters) => void;
  onReset: () => void;
  onPreview: (filters: AdvancedFilters) => void;
  onDiagnosisSearch: (keyword: string) => void;
};

const DEFAULT_STATUSES = [
  { id: 'in_care', label: '在住' },
  { id: 'pending', label: '待入住' },
  { id: 'discharged', label: '已离开' },
];

const DEFAULT_RISK_LEVELS = [
  { id: 'high', label: '高风险' },
  { id: 'medium', label: '中风险' },
  { id: 'low', label: '低风险' },
];

const AGE_RANGES = [
  { id: '0-3', label: '0-3岁' },
  { id: '4-6', label: '4-6岁' },
  { id: '7-12', label: '7-12岁' },
  { id: '13-17', label: '13-17岁' },
  { id: '18+', label: '18岁及以上' },
];

const AdvancedFilterPanel: React.FC<Props> = ({
  visible,
  filters,
  hospitalOptions,
  diagnosisOptions,
  genderOptions,
  ethnicityOptions,
  nativePlaceOptions,
  doctorOptions,
  previewCount,
  previewLoading,
  onClose,
  onApply,
  onReset,
  onPreview,
  onDiagnosisSearch,
}) => {
  // 本地筛选状态
  const [localFilters, setLocalFilters] = useState<AdvancedFilters>(filters);
  const [logicMode, setLogicMode] = useState<'AND' | 'OR'>('AND');
  const [diagnosisSearchTerm, setDiagnosisSearchTerm] = useState('');

  // 同步外部filters到本地状态
  useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
    }
  }, [visible, filters]);

  // 预览延迟
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onPreview(localFilters);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [localFilters, visible, onPreview]);

  // 切换选项
  const toggleOption = (key: keyof AdvancedFilters, value: string) => {
    setLocalFilters(prev => {
      const currentArray = prev[key] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value];
      return { ...prev, [key]: newArray };
    });
  };

  // 更新日期范围
  const updateDateRange = (field: 'start' | 'end', value: string) => {
    setLocalFilters(prev => ({
      ...prev,
      dateRange: { ...prev.dateRange, [field]: value },
    }));
  };

  // 添加诊断
  const addDiagnosis = (id: string) => {
    if (!localFilters.diagnosis.includes(id)) {
      setLocalFilters(prev => ({
        ...prev,
        diagnosis: [...prev.diagnosis, id],
      }));
    }
    setDiagnosisSearchTerm('');
  };

  // 移除诊断
  const removeDiagnosis = (id: string) => {
    setLocalFilters(prev => ({
      ...prev,
      diagnosis: prev.diagnosis.filter(d => d !== id),
    }));
  };

  // 处理诊断搜索
  const handleDiagnosisSearch = (value: string) => {
    setDiagnosisSearchTerm(value);
    onDiagnosisSearch(value);
  };

  // 重置筛选
  const handleReset = () => {
    const resetFilters: AdvancedFilters = {
      statuses: [],
      riskLevels: [],
      hospitals: [],
      diagnosis: [],
      genders: [],
      ethnicities: [],
      nativePlaces: [],
      ageRanges: [],
      doctors: [],
      dateRange: { start: '', end: '' },
    };
    setLocalFilters(resetFilters);
    setLogicMode('AND');
    setDiagnosisSearchTerm('');
    onReset();
  };

  // 应用筛选
  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  if (!visible) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={onClose}
      />

      {/* 抽屉面板 */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '90%',
          maxWidth: 600,
          background: '#f9fafb',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div style={{
          padding: '20px 24px',
          background: 'white',
          borderBottom: '2px solid #e5e7eb',
          position: 'relative',
        }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1f2937' }}>
            高级筛选
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            组合条件快速锁定目标住户
          </p>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              right: 16,
              top: 16,
              width: 32,
              height: 32,
              border: 'none',
              background: 'transparent',
              fontSize: 24,
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.color = '#1f2937';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            ×
          </button>
        </div>

        {/* 滚动内容区域 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* 条件关系 */}
          <FilterSection title="条件关系">
            <div style={{ display: 'flex', gap: 8 }}>
              <FilterChip
                active={logicMode === 'AND'}
                onClick={() => setLogicMode('AND')}
              >
                满足全部
              </FilterChip>
              <FilterChip
                active={logicMode === 'OR'}
                onClick={() => setLogicMode('OR')}
              >
                满足任一
              </FilterChip>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 0' }}>
              AND 表示必须同时满足，OR 表示任意条件即可
            </p>
          </FilterSection>

          {/* 住户状态 */}
          <FilterSection title="住户状态">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DEFAULT_STATUSES.map(status => (
                <FilterChip
                  key={status.id}
                  active={localFilters.statuses.includes(status.id)}
                  onClick={() => toggleOption('statuses', status.id)}
                >
                  {status.label}
                </FilterChip>
              ))}
            </div>
          </FilterSection>

          {/* 入住时间范围 */}
          <FilterSection title="入住时间范围">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  开始日期
                </label>
                <input
                  type="date"
                  value={localFilters.dateRange.start || ''}
                  onChange={(e) => updateDateRange('start', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                />
              </div>
              <div style={{ paddingTop: 20, color: '#9ca3af' }}>—</div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  结束日期
                </label>
                <input
                  type="date"
                  value={localFilters.dateRange.end || ''}
                  onChange={(e) => updateDateRange('end', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                />
              </div>
            </div>
          </FilterSection>

          {/* 风险等级 */}
          <FilterSection title="风险等级">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DEFAULT_RISK_LEVELS.map(risk => (
                <FilterChip
                  key={risk.id}
                  active={localFilters.riskLevels.includes(risk.id)}
                  onClick={() => toggleOption('riskLevels', risk.id)}
                >
                  {risk.label}
                </FilterChip>
              ))}
            </div>
          </FilterSection>

          {/* 性别 */}
          {genderOptions.length > 0 && (
            <FilterSection title="性别">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {genderOptions.map(gender => (
                  <FilterChip
                    key={gender.id}
                    active={localFilters.genders.includes(gender.id)}
                    onClick={() => toggleOption('genders', gender.id)}
                  >
                    {gender.label}
                  </FilterChip>
                ))}
              </div>
            </FilterSection>
          )}

          {/* 年龄段 */}
          <FilterSection title="年龄段">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AGE_RANGES.map(age => (
                <FilterChip
                  key={age.id}
                  active={localFilters.ageRanges.includes(age.id)}
                  onClick={() => toggleOption('ageRanges', age.id)}
                >
                  {age.label}
                </FilterChip>
              ))}
            </div>
          </FilterSection>

          {/* 民族 */}
          {ethnicityOptions.length > 0 && (
            <FilterSection title="民族">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ethnicityOptions.map(ethnicity => (
                  <FilterChip
                    key={ethnicity.id}
                    active={localFilters.ethnicities.includes(ethnicity.id)}
                    onClick={() => toggleOption('ethnicities', ethnicity.id)}
                  >
                    {ethnicity.label}
                  </FilterChip>
                ))}
              </div>
            </FilterSection>
          )}

          {/* 籍贯 */}
          {nativePlaceOptions.length > 0 && (
            <FilterSection title="籍贯">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                {nativePlaceOptions.map(place => (
                  <FilterGridItem
                    key={place.id}
                    active={localFilters.nativePlaces.includes(place.id)}
                    onClick={() => toggleOption('nativePlaces', place.id)}
                  >
                    {place.label}
                  </FilterGridItem>
                ))}
              </div>
            </FilterSection>
          )}

          {/* 责任医生 */}
          {doctorOptions.length > 0 && (
            <FilterSection title="责任医生">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                {doctorOptions.map(doctor => (
                  <FilterGridItem
                    key={doctor.id}
                    active={localFilters.doctors.includes(doctor.id)}
                    onClick={() => toggleOption('doctors', doctor.id)}
                  >
                    {doctor.label}
                  </FilterGridItem>
                ))}
              </div>
            </FilterSection>
          )}

          {/* 诊断类型 */}
          <FilterSection title="诊断类型">
            <input
              type="text"
              placeholder="搜索诊断关键字"
              value={diagnosisSearchTerm}
              onChange={(e) => handleDiagnosisSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                marginBottom: 12,
              }}
            />
            {diagnosisOptions.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>常用诊断</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {diagnosisOptions.map(diag => (
                    <FilterChip
                      key={diag.id}
                      active={false}
                      ghost
                      onClick={() => addDiagnosis(diag.id)}
                    >
                      {diag.label}
                    </FilterChip>
                  ))}
                </div>
              </>
            )}
            {localFilters.diagnosis.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>已选诊断</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {localFilters.diagnosis.map(id => {
                    const option = diagnosisOptions.find(d => d.id === id);
                    return (
                      <div
                        key={id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          background: '#dbeafe',
                          border: '1px solid #3b82f6',
                          borderRadius: 6,
                          fontSize: 13,
                          color: '#1e40af',
                        }}
                      >
                        <span>{option ? option.label : id}</span>
                        <button
                          onClick={() => removeDiagnosis(id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#1e40af',
                            cursor: 'pointer',
                            fontSize: 16,
                            padding: 0,
                            width: 16,
                            height: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </FilterSection>

          {/* 医院筛选 */}
          {hospitalOptions.length > 0 && (
            <FilterSection title="医院筛选">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                {hospitalOptions.map(hospital => (
                  <FilterGridItem
                    key={hospital.id}
                    active={localFilters.hospitals.includes(hospital.id)}
                    onClick={() => toggleOption('hospitals', hospital.id)}
                  >
                    {hospital.label}
                  </FilterGridItem>
                ))}
              </div>
            </FilterSection>
          )}
        </div>

        {/* 底部操作栏 */}
        <div style={{
          padding: '16px 24px',
          background: 'white',
          borderTop: '2px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#1f2937' }}>
              {previewLoading ? '...' : previewCount >= 0 ? previewCount : '--'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              名住户符合筛选
            </div>
          </div>
          <button className="secondary-button" onClick={handleReset}>
            重置
          </button>
          <button className="primary-button" onClick={handleApply}>
            应用筛选
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

// 筛选分区组件
const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{
      padding: 16,
      background: 'white',
      borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    }}>
      <h4 style={{
        margin: '0 0 12px 0',
        fontSize: 15,
        fontWeight: 600,
        color: '#1f2937',
      }}>
        {title}
      </h4>
      {children}
    </div>
  </div>
);

// 筛选芯片组件
const FilterChip: React.FC<{
  active: boolean;
  ghost?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, ghost, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: '8px 16px',
      border: active ? '2px solid #2563eb' : ghost ? '1px solid #d1d5db' : '1px solid #d1d5db',
      borderRadius: 8,
      background: active ? '#dbeafe' : ghost ? 'transparent' : 'white',
      color: active ? '#1e40af' : '#374151',
      fontSize: 14,
      fontWeight: active ? 600 : 500,
      cursor: 'pointer',
      transition: 'all 0.2s',
      whiteSpace: 'nowrap',
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.borderColor = '#9ca3af';
        e.currentTarget.style.background = '#f9fafb';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.borderColor = '#d1d5db';
        e.currentTarget.style.background = ghost ? 'transparent' : 'white';
      }
    }}
  >
    {children}
  </button>
);

// 网格项组件
const FilterGridItem: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: '10px 12px',
      border: active ? '2px solid #2563eb' : '1px solid #e5e7eb',
      borderRadius: 8,
      background: active ? '#dbeafe' : 'white',
      color: active ? '#1e40af' : '#374151',
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      cursor: 'pointer',
      transition: 'all 0.2s',
      textAlign: 'center',
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.borderColor = '#9ca3af';
        e.currentTarget.style.background = '#f9fafb';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.borderColor = '#e5e7eb';
        e.currentTarget.style.background = 'white';
      }
    }}
  >
    {children}
  </button>
);

export default AdvancedFilterPanel;
