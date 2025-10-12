import React from 'react';

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="analysis-page">
      <div className="analysis-container">
        {/* Summary cards skeleton */}
        <div className="analysis-header">
          <div className="summary-cards-skeleton">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="summary-card-skeleton">
                <div className="skeleton-item" />
                <div className="skeleton-item small" />
                <div className="skeleton-item smaller" />
              </div>
            ))}
          </div>

          {/* Filter bar skeleton */}
          <div className="filter-bar-skeleton">
            <div className="skeleton-item" />
            <div className="skeleton-item" />
          </div>

          {/* Legend skeleton */}
          <div className="legend-skeleton">
            <div className="skeleton-item" />
            {[1, 2, 3].map(i => (
              <div key={i} className="legend-item-skeleton">
                <div className="skeleton-dot" />
                <div className="skeleton-item small" />
                <div className="skeleton-item smaller" />
              </div>
            ))}
          </div>
        </div>

        {/* Analysis panels skeleton */}
        <div className="analysis-panels">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="analysis-panel-skeleton">
              <div className="panel-header-skeleton">
                <div className="skeleton-item" />
                <div className="panel-modes-skeleton">
                  <div className="skeleton-item small" />
                  <div className="skeleton-item small" />
                  <div className="skeleton-item small" />
                </div>
              </div>
              <div className="panel-content-skeleton">
                <div className="stats-scroll-skeleton">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="stat-card-skeleton">
                      <div className="skeleton-item" />
                      <div className="skeleton-item small" />
                      <div className="skeleton-item smaller" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .analysis-page {
          padding: 20px;
          background: #f5f5f5;
          min-height: 100vh;
        }

        .analysis-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .analysis-header {
          margin-bottom: 32px;
        }

        .summary-cards-skeleton {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .summary-card-skeleton {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .filter-bar-skeleton {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }

        .legend-skeleton {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .legend-item-skeleton {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .analysis-panels {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .analysis-panel-skeleton {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .panel-header-skeleton {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .panel-modes-skeleton {
          display: flex;
          gap: 8px;
        }

        .stats-scroll-skeleton {
          display: flex;
          gap: 16px;
          overflow-x: auto;
        }

        .stat-card-skeleton {
          flex: 0 0 200px;
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
        }

        .skeleton-item {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 4px;
          height: 20px;
          margin-bottom: 8px;
        }

        .skeleton-item.small {
          height: 16px;
          width: 80%;
        }

        .skeleton-item.smaller {
          height: 14px;
          width: 60%;
        }

        .skeleton-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
        }

        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};

export default LoadingSkeleton;