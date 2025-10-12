import React from 'react';
import type { LegendItem } from '../../types/analysis';

const LegendPanel: React.FC = () => {
  const legendItems: LegendItem[] = [
    {
      id: 'success',
      status: 'success',
      label: '最高占比',
      description: '当前分面中数量最多的类目',
    },
    {
      id: 'info',
      status: 'info',
      label: '常规分布',
      description: '常规对比项，无特殊标记',
    },
    {
      id: 'warning',
      status: 'warning',
      label: '数据缺失',
      description: '缺少信息或未知的类目',
    },
  ];

  const getStatusColor = (status: LegendItem['status']) => {
    switch (status) {
      case 'success':
        return '#4caf50';
      case 'info':
        return '#2196f3';
      case 'warning':
        return '#ff9800';
      default:
        return '#9e9e9e';
    }
  };

  return (
    <div className="legend-panel">
      <div className="legend-header">
        <div className="legend-title">图例说明</div>
        <div className="legend-subtitle">理解颜色语义，快速识别异常</div>
      </div>

      <div className="legend-items">
        {legendItems.map(item => (
          <div key={item.id} className="legend-item">
            <div
              className="legend-dot"
              style={{ backgroundColor: getStatusColor(item.status) }}
            />
            <div className="legend-copy">
              <div className="legend-label">{item.label}</div>
              <div className="legend-description">{item.description}</div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .legend-panel {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 24px;
        }

        .legend-header {
          margin-bottom: 16px;
        }

        .legend-title {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }

        .legend-subtitle {
          font-size: 14px;
          color: #666;
        }

        .legend-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .legend-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-top: 4px;
          flex-shrink: 0;
        }

        .legend-copy {
          flex: 1;
        }

        .legend-label {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          margin-bottom: 2px;
        }

        .legend-description {
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }

        @media (max-width: 768px) {
          .legend-panel {
            padding: 16px;
          }

          .legend-title {
            font-size: 14px;
          }

          .legend-subtitle {
            font-size: 12px;
          }

          .legend-label {
            font-size: 12px;
          }

          .legend-description {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
};

export default LegendPanel;