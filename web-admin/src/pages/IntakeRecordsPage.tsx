import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const IntakeRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientKey = '' } = useParams();

  return (
    <div className="card" style={{ maxWidth: 960, margin: '0 auto' }}>
      <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>入住记录管理</h2>
        <div className="flex-row" style={{ gap: 8 }}>
          <button className="secondary-button" onClick={() => navigate(`/patients/${encodeURIComponent(patientKey)}`)}>
            返回详情
          </button>
          <button className="primary-button" onClick={() => navigate('/patients/new')}>新建入住登记</button>
        </div>
      </div>

      <div style={{ padding: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <p style={{ margin: 0, color: '#6b7280' }}>
          入住记录列表功能正在完善中。您可以返回患者详情查看摘要，或使用“新建入住登记”创建新的记录。
        </p>
      </div>
    </div>
  );
};

export default IntakeRecordsPage;

