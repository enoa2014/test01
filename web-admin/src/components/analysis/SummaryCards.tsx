import React from 'react';
import type { SummaryCard } from '../../types/analysis';

interface SummaryCardsProps {
  cards: SummaryCard[];
  activeFilter: string;
  onCardClick: (filterId: string) => void;
  onNavigateToList: () => void;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({
  cards,
  activeFilter,
  onCardClick,
  onNavigateToList
}) => {
  return (
    <div className="summary-cards-section">
      <div className="summary-cards-grid">
        {cards.map(card => (
          <div
            key={card.id}
            className={`summary-card ${card.isMax ? 'highlight' : ''} ${activeFilter === card.id ? 'active' : ''}`}
            onClick={() => onCardClick(card.id)}
          >
            <div className="summary-card-value">{card.value}</div>
            <div className="summary-card-label">{card.label}</div>
            <div className="summary-card-description">{card.description}</div>
          </div>
        ))}
      </div>

      <div className="summary-actions">
        <button className="secondary-button" onClick={onNavigateToList}>
          查看列表
        </button>
      </div>

      <style jsx>{`
        .summary-cards-section {
          margin-bottom: 24px;
        }

        .summary-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .summary-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: all 0.2s ease;
          border: 2px solid transparent;
          position: relative;
          overflow: hidden;
        }

        .summary-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: #e0e0e0;
          transition: background 0.3s ease;
        }

        .summary-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .summary-card.highlight::before {
          background: #4caf50;
        }

        .summary-card.highlight {
          border-color: #4caf50;
        }

        .summary-card.active::before {
          background: #1976d2;
        }

        .summary-card.active {
          border-color: #1976d2;
          box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
        }

        .summary-card-value {
          font-size: 32px;
          font-weight: bold;
          color: #333;
          line-height: 1.2;
          margin-bottom: 8px;
        }

        .summary-card-label {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }

        .summary-card-description {
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }

        .summary-actions {
          display: flex;
          justify-content: flex-end;
        }

        .secondary-button {
          background: white;
          color: #666;
          border: 1px solid #ddd;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .secondary-button:hover {
          background: #f5f5f5;
          border-color: #bbb;
        }

        .secondary-button:active {
          background: #eeeeee;
        }

        @media (max-width: 768px) {
          .summary-cards-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .summary-card-value {
            font-size: 28px;
          }

          .summary-card-label {
            font-size: 14px;
          }

          .summary-card-description {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
};

export default SummaryCards;