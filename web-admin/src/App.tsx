import React from 'react';
import { Navigate, Route, Routes, useLocation, Link } from 'react-router-dom';
import PatientListPage from './pages/PatientListPage';
import PatientDetailPage from './pages/PatientDetailPage';
import PatientFormPage from './pages/PatientFormPage';
import IntakeWizardPage from './pages/IntakeWizardPage';
import IntakeRecordsPage from './pages/IntakeRecordsPage';
import AnalysisPage from './pages/AnalysisPage';
import './styles/analysis.css';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <strong>同心源 小家管理后台</strong>
        </div>
        <div className="flex-row">
          <nav className="app-nav">
            <Link
              to="/patients"
              className={`nav-link ${location.pathname === '/patients' ? 'active' : ''}`}
            >
              住户列表
            </Link>
            <Link
              to="/analysis"
              className={`nav-link ${location.pathname === '/analysis' ? 'active' : ''}`}
            >
              数据分析
            </Link>
          </nav>
          <span>管理员</span>
        </div>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/patients" replace />} />
        <Route path="/patients" element={<PatientListPage />} />
        <Route path="/patients/new" element={<IntakeWizardPage />} />
        <Route path="/patients/:patientKey" element={<PatientDetailPage />} />
        <Route path="/patients/:patientKey/edit" element={<PatientFormPage />} />
        <Route path="/patients/:patientKey/intakes" element={<IntakeRecordsPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        {/* 向后兼容：旧的 /intake 路由重定向到 /patients/new */}
        <Route path="/intake" element={<Navigate to="/patients/new" replace />} />
        <Route path="*" element={<Navigate to="/patients" replace />} />
      </Routes>
    </AppShell>
  );
};

export default App;
