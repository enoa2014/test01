import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './routes/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import PatientListPage from './pages/PatientListPage';
import PatientDetailPage from './pages/PatientDetailPage';
import PatientFormPage from './pages/PatientFormPage';
import IntakeWizardPage from './pages/IntakeWizardPage';
import { useCloudbase } from './hooks/useCloudbase';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useCloudbase();
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <strong>同心源 小家管理后台</strong>
        </div>
        {user ? (
          <div className="flex-row">
            <span>{user.username || user.uid}</span>
            <button className="secondary-button" onClick={logout}>
              退出登录
            </button>
          </div>
        ) : (
          location.pathname !== '/login' && <span>未登录</span>
        )}
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppShell>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/patients" replace />} />
          <Route path="/patients" element={<PatientListPage />} />
          <Route path="/patients/:patientKey" element={<PatientDetailPage />} />
          <Route path="/intake" element={<IntakeWizardPage />} />
          <Route path="/patients/:patientKey/edit" element={<PatientFormPage mode="edit" />} />
        </Route>
        <Route path="*" element={<Navigate to="/patients" replace />} />
      </Routes>
    </AppShell>
  );
};

export default App;
