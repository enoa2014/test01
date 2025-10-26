import React from 'react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  return (
    <div className="error-container">
      <div className="error-content">
        <div className="error-icon">⚠️</div>
        <h3>加载失败</h3>
        <p>{message}</p>
        {onRetry && (
          <button className="retry-button" onClick={onRetry}>
            重试
          </button>
        )}
      </div>

      <style jsx>{`
        .error-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
          padding: 20px;
        }

        .error-content {
          text-align: center;
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          max-width: 400px;
        }

        .error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        h3 {
          color: #d32f2f;
          margin: 0 0 16px 0;
          font-size: 20px;
        }

        p {
          color: #666;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }

        .retry-button {
          background: #1976d2;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .retry-button:hover {
          background: #1565c0;
        }

        .retry-button:active {
          background: #0d47a1;
        }
      `}</style>
    </div>
  );
};

export default ErrorMessage;