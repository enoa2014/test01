import React from 'react';
import type { TimeRangeFilter, StatusFilter } from '../../types/analysis';

interface FilterBarProps {
  timeRange: TimeRangeFilter;
  statusFilter: StatusFilter;
  isDefaultFilter: boolean;
  onTimeRangeChange: (value: TimeRangeFilter) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onClearFilters: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  timeRange,
  statusFilter,
  isDefaultFilter,
  onTimeRangeChange,
  onStatusFilterChange,
  onClearFilters
}) => {
  const timeRangeOptions = [
    { value: 'last30' as TimeRangeFilter, label: '近30天' },
    { value: 'month' as TimeRangeFilter, label: '本月' },
    { value: 'year' as TimeRangeFilter, label: '本年' },
    { value: 'all' as TimeRangeFilter, label: '全部' },
  ];

  const statusFilterOptions = [
    { value: 'all' as StatusFilter, label: '全部' },
    { value: 'in_care' as StatusFilter, label: '在住' },
    { value: 'pending' as StatusFilter, label: '待入住' },
    { value: 'discharged' as StatusFilter, label: '已离开' },
  ];

  return (
    <div className="filter-bar">
      <div className="filter-section">
        <div className="filter-label">时间范围：</div>
        <div className="chips">
          {timeRangeOptions.map(option => (
            <button
              key={option.value}
              className={`chip ${timeRange === option.value ? 'active' : ''}`}
              onClick={() => onTimeRangeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-label">状态筛选：</div>
        <div className="chips">
          {statusFilterOptions.map(option => (
            <button
              key={option.value}
              className={`chip ${statusFilter === option.value ? 'active' : ''}`}
              onClick={() => onStatusFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {!isDefaultFilter && (
        <div className="filter-actions">
          <button className="clear-button" onClick={onClearFilters}>
            清除筛选
          </button>
        </div>
      )}

      <style jsx>{`
        .filter-bar {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .filter-section {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }

        .filter-label {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          min-width: auto;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chip {
          padding: 6px 12px;
          border-radius: 16px;
          border: 1px solid #ddd;
          background: white;
          color: #666;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .chip:hover {
          border-color: #1976d2;
          color: #1976d2;
        }

        .chip.active {
          background: #e3f2fd;
          border-color: #1976d2;
          color: #1976d2;
          font-weight: 500;
        }

        .chip:active {
          transform: scale(0.95);
        }

        .filter-actions {
          display: flex;
          justify-content: flex-end;
        }

        .clear-button {
          padding: 6px 12px;
          border-radius: 4px;
          border: 1px solid #ddd;
          background: white;
          color: #666;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .clear-button:hover {
          border-color: #f44336;
          color: #f44336;
        }

        .clear-button:active {
          background: #ffebee;
        }

        @media (min-width: 1280px) {
          .filter-bar {
            padding: 24px;
          }

          .filter-section {
            gap: 12px;
          }
        }

        @media (max-width: 768px) {
          .chips {
            width: 100%;
          }

          .chip {
            flex: 1;
            text-align: center;
            min-width: 96px;
          }

          .filter-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default FilterBar;
