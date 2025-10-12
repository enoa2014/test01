import React from 'react';
import type { SelectionState, AnalysisPatientSummary } from '../../types/analysis';

interface SelectionModalProps {
  selection: SelectionState;
  onApplyFilter: () => void;
  onClose: () => void;
  onPatientClick: (patient: AnalysisPatientSummary) => void;
}

const SelectionModal: React.FC<SelectionModalProps> = ({
  selection,
  onApplyFilter,
  onClose,
  onPatientClick
}) => {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePatientClick = (patient: AnalysisPatientSummary) => {
    onPatientClick(patient);
  };

  return (
    <div className="selection-modal-backdrop" onClick={handleBackdropClick}>
      <div className="selection-modal" onClick={e => e.stopPropagation()}>
        <div className="selection-handle" />

        <div className="selection-header">
          <div className="selection-titles">
            <div className="selection-title">{selection.title}</div>
            {selection.totalCount > 0 && (
              <div className="selection-count">共 {selection.totalCount} 人</div>
            )}
          </div>

          {selection.filterAvailable && (
            <button className="selection-cta" onClick={onApplyFilter}>
              在列表中查看
            </button>
          )}
        </div>

        {selection.hint && (
          <div className="selection-hint">{selection.hint}</div>
        )}

        <div className="selection-list">
          {selection.items.map((patient, index) => (
            <div
              key={`${patient.key}-${index}`}
              className="selection-item"
              onClick={() => handlePatientClick(patient)}
            >
              {patient.name}
            </div>
          ))}
        </div>

        <div className="selection-footer">
          <button className="selection-close-button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      <style jsx>{`
        .selection-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: flex-end;
          z-index: 1000;
          padding: 20px;
        }

        .selection-modal {
          width: 100%;
          max-width: 600px;
          max-height: 80vh;
          background: white;
          border-radius: 16px 16px 0 0;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .selection-handle {
          width: 40px;
          height: 4px;
          background: #ddd;
          border-radius: 2px;
          align-self: center;
        }

        .selection-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .selection-titles {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .selection-title {
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .selection-count {
          font-size: 14px;
          color: #666;
        }

        .selection-cta {
          padding: 8px 16px;
          background: #1976d2;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .selection-cta:hover {
          background: #1565c0;
        }

        .selection-cta:active {
          background: #0d47a1;
        }

        .selection-hint {
          font-size: 12px;
          color: #666;
          line-height: 1.6;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .selection-list {
          flex: 1;
          overflow-y: auto;
          background: #f8f9fa;
          border-radius: 8px;
          max-height: 400px;
        }

        .selection-item {
          padding: 12px 16px;
          border-bottom: 1px solid #e9ecef;
          font-size: 14px;
          color: #333;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .selection-item:hover {
          background: #e9ecef;
        }

        .selection-item:last-child {
          border-bottom: none;
        }

        .selection-footer {
          display: flex;
          justify-content: flex-end;
          padding-top: 8px;
        }

        .selection-close-button {
          padding: 10px 20px;
          background: white;
          color: #666;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .selection-close-button:hover {
          background: #f5f5f5;
          border-color: #bbb;
        }

        .selection-close-button:active {
          background: #eeeeee;
        }

        @media (max-width: 768px) {
          .selection-modal-backdrop {
            padding: 16px;
          }

          .selection-modal {
            padding: 16px;
            max-height: 85vh;
          }

          .selection-title {
            font-size: 16px;
          }

          .selection-count {
            font-size: 12px;
          }

          .selection-cta {
            padding: 6px 12px;
            font-size: 12px;
          }

          .selection-hint {
            font-size: 11px;
            padding: 10px;
          }

          .selection-item {
            padding: 10px 12px;
            font-size: 13px;
          }

          .selection-close-button {
            padding: 8px 16px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default SelectionModal;