import React, { useState, useRef, useEffect } from 'react';
import type {
  AnalysisPanel as IAnalysisPanel,
  AnalysisStat,
  PanelDisplayMode
} from '../../types/analysis';

interface AnalysisPanelProps {
  panel: IAnalysisPanel;
  panelIndex: number;
  viewMode: PanelDisplayMode;
  isCollapsed: boolean;
  displayModes: PanelDisplayMode[];
  onModeToggle: (panelKey: string, mode: PanelDisplayMode) => void;
  onCollapseToggle: (panelKey: string) => void;
  onStatClick: (panelIndex: number, statIndex: number) => void;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  panel,
  panelIndex,
  viewMode,
  isCollapsed,
  displayModes,
  onModeToggle,
  onCollapseToggle,
  onStatClick
}) => {
  const [isInView, setIsInView] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Intersection observer for lazy rendering
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.1 }
    );

    if (panelRef.current) {
      observer.observe(panelRef.current);
    }

    return () => {
      if (panelRef.current) {
        observer.unobserve(panelRef.current);
      }
    };
  }, []);

  // Render pie chart when in view and mode is pie
  useEffect(() => {
    if (isInView && viewMode === 'pie' && !isCollapsed && canvasRef.current) {
      renderPieChart();
    }
  }, [isInView, viewMode, isCollapsed, panel.stats]);

  const renderPieChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    const total = panel.stats.reduce((sum, stat) => sum + (stat.count || 0), 0);

    if (total === 0 || radius <= 0) {
      // Draw empty state
      ctx.beginPath();
      ctx.fillStyle = '#e0e0e0';
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    let startAngle = -Math.PI / 2;

    panel.stats.forEach(stat => {
      const value = stat.count || 0;
      if (value <= 0) return;

      const ratio = value / total;
      const endAngle = startAngle + ratio * Math.PI * 2;

      // Draw pie slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = stat.color || '#1976d2';
      ctx.fill();

      startAngle = endAngle;
    });

    // Draw center circle
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleModeChange = (mode: PanelDisplayMode) => {
    onModeToggle(panel.panelKey, mode);
  };

  const handleCollapseToggle = () => {
    onCollapseToggle(panel.panelKey);
  };

  const handleStatClick = (statIndex: number) => {
    onStatClick(panelIndex, statIndex);
  };

  const renderStatCards = () => (
    <div className="stats-scroll">
      {panel.stats.map((stat, statIndex) => (
        <div
          key={stat.label}
          className={`stat-card ${stat.variant || 'default'} ${stat.status || 'default'}`}
          onClick={() => handleStatClick(statIndex)}
        >
          <div className="stat-label">{stat.label}</div>
          <div className="stat-count">
            <span className="stat-figure">{stat.count}</span>
            <span className="stat-unit">人</span>
          </div>
          {stat.sampleNames && (
            <div className="stat-samples">{stat.sampleNames}</div>
          )}
        </div>
      ))}
    </div>
  );

  const renderStatBars = () => (
    <div className="stat-bars">
      {panel.stats.map((stat, statIndex) => (
        <div
          key={stat.label}
          className="stat-bar"
          onClick={() => handleStatClick(statIndex)}
        >
          <div className="stat-bar-header">
            <div className="stat-bar-label">{stat.label}</div>
            <div className="stat-bar-value">{stat.count} 人</div>
          </div>
          <div className="stat-bar-track">
            <div
              className="stat-bar-fill"
              style={{
                width: `${stat.percentage || 0}%`,
                backgroundColor: stat.color || '#1976d2'
              }}
            />
          </div>
          <div className="stat-bar-percent">{stat.percentageLabel || '0%'}</div>
        </div>
      ))}
    </div>
  );

  const renderStatPie = () => (
    <div className="stat-pie">
      <div className="pie-chart-container">
        <canvas
          ref={canvasRef}
          className="pie-chart"
          width={200}
          height={200}
        />
      </div>
      <div className="pie-legend">
        {panel.stats.map((stat, statIndex) => (
          <div
            key={stat.label}
            className="pie-legend-item"
            onClick={() => handleStatClick(statIndex)}
          >
            <div
              className="pie-legend-dot"
              style={{ backgroundColor: stat.color || '#1976d2' }}
            />
            <div className="pie-legend-copy">
              <div className="pie-legend-label">{stat.label}</div>
              <div className="pie-legend-meta">
                {stat.count} 人 · {stat.percentageLabel || '0%'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderContent = () => {
    if (isCollapsed) {
      return <div className="panel-placeholder">{panel.emptyText || '暂无数据'}</div>;
    }

    if (!panel.stats.length) {
      return <div className="panel-placeholder">{panel.emptyText || '暂无数据'}</div>;
    }

    switch (viewMode) {
      case 'cards':
        return renderStatCards();
      case 'bars':
        return renderStatBars();
      case 'pie':
        return renderStatPie();
      default:
        return renderStatCards();
    }
  };

  return (
    <div ref={panelRef} className="analysis-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="panel-title">{panel.title}</div>
          {panel.totalCount > 0 && (
            <div className="panel-total">共 {panel.totalCount} 人</div>
          )}
        </div>

        {/* Month trend for month panel */}
        {panel.panelKey === 'month' && panel.trend && panel.trend.points && (
          <div className="mini-trend">
            <div className="mini-trend-bars">
              {panel.trend.points.map((point, index) => (
                <div
                  key={point.label}
                  className="mini-trend-bar"
                  style={{
                    height: `${Math.max(8, Math.min(100, point.ratio))}px`
                  }}
                />
              ))}
            </div>
            <div className="mini-trend-labels">
              {panel.trend.points.map(point => (
                <span key={point.label}>{point.label.substring(5)}</span>
              ))}
            </div>
          </div>
        )}

        {/* Display mode switcher */}
        {displayModes.length > 1 && (
          <div className="panel-mode-switch">
            {displayModes.map(mode => (
              <button
                key={mode}
                className={`panel-mode-option ${viewMode === mode ? 'active' : ''}`}
                onClick={() => handleModeChange(mode)}
              >
                {mode === 'cards' ? '卡片' : mode === 'bars' ? '柱状图' : '圆饼图'}
              </button>
            ))}
          </div>
        )}

        {/* Collapse toggle */}
        <button className="panel-collapse-toggle" onClick={handleCollapseToggle}>
          <span>{isCollapsed ? '展开' : '收起'}</span>
          <span className="collapse-icon">{isCollapsed ? '▸' : '▾'}</span>
        </button>
      </div>

      <div className="panel-content">
        {renderContent()}
      </div>

      <style jsx>{`
        .analysis-panel {
          background: white;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .panel-title-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .panel-title {
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .panel-total {
          font-size: 12px;
          color: #666;
        }

        .mini-trend {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        .mini-trend-bars {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          height: 40px;
        }

        .mini-trend-bar {
          width: 8px;
          background: #1976d2;
          border-radius: 2px;
        }

        .mini-trend-labels {
          display: flex;
          gap: 6px;
          justify-content: flex-end;
          font-size: 10px;
          color: #666;
        }

        .panel-mode-switch {
          display: flex;
          padding: 2px;
          background: #f5f5f5;
          border-radius: 16px;
          gap: 2px;
        }

        .panel-mode-option {
          padding: 6px 12px;
          font-size: 12px;
          color: #666;
          border: none;
          background: transparent;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .panel-mode-option:hover {
          color: #333;
        }

        .panel-mode-option.active {
          background: #e3f2fd;
          color: #1976d2;
          font-weight: 500;
        }

        .panel-collapse-toggle {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          font-size: 12px;
          color: #666;
          background: transparent;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .panel-collapse-toggle:hover {
          background: #f5f5f5;
          border-color: #bbb;
        }

        .collapse-icon {
          font-size: 10px;
        }

        .panel-content {
          min-height: 120px;
          flex: 1;
        }

        .panel-placeholder {
          padding: 40px;
          text-align: center;
          color: #999;
          font-size: 14px;
        }

        .stats-scroll {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          width: 100%;
        }

        .stat-card {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid #e9ecef;
        }

        .stat-card:hover {
          background: #e9ecef;
          transform: translateY(-2px);
        }

        .stat-card.elevated {
          border-color: #4caf50;
          background: #f1f8e9;
        }

        .stat-card.outlined {
          border-color: #ff9800;
          background: #fff3e0;
        }

        .stat-label {
          font-size: 14px;
          color: #333;
          margin-bottom: 8px;
        }

        .stat-count {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin-bottom: 8px;
        }

        .stat-figure {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }

        .stat-unit {
          font-size: 12px;
          color: #666;
        }

        .stat-samples {
          font-size: 12px;
          color: #666;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .stat-bars {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }

        .stat-bar {
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .stat-bar:hover {
          background: #e9ecef;
        }

        .stat-bar-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 8px;
        }

        .stat-bar-label {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .stat-bar-value {
          font-size: 12px;
          color: #666;
        }

        .stat-bar-track {
          position: relative;
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }

        .stat-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .stat-bar-percent {
          font-size: 11px;
          color: #666;
          margin-top: 4px;
          text-align: right;
        }

        .stat-pie {
          display: flex;
          gap: 24px;
          align-items: center;
          flex-wrap: wrap;
          width: 100%;
        }

        .pie-chart-container {
          display: flex;
          justify-content: center;
        }

        .pie-chart {
          max-width: 200px;
          max-height: 200px;
        }

        .pie-legend {
          flex: 1;
          min-width: 200px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pie-legend-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .pie-legend-item:hover {
          background: #f8f9fa;
        }

        .pie-legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .pie-legend-copy {
          flex: 1;
        }

        .pie-legend-label {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          margin-bottom: 2px;
        }

        .pie-legend-meta {
          font-size: 12px;
          color: #666;
        }

        @media (max-width: 768px) {
          .analysis-panel {
            padding: 16px;
          }

          .panel-header {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }

          .panel-title-group {
            align-items: flex-start;
          }

          .panel-mode-switch {
            align-self: center;
          }

          .panel-collapse-toggle {
            align-self: center;
          }

          .panel-content {
            display: block;
          }

          .stats-scroll {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding-bottom: 8px;
          }

          .stat-card {
            flex: 0 0 160px;
            padding: 12px;
          }

          .stat-figure {
            font-size: 20px;
          }

          .stat-pie {
            flex-direction: column;
            gap: 16px;
          }

          .pie-legend {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default AnalysisPanel;
