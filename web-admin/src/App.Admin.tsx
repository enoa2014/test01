import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RBACProvider } from './contexts/RBACContext';
import { AdminRouteGuard } from './components/AdminRouteGuard';
import { AdminLayout } from './components/AdminLayout';
import LoginPage from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import RootRedirect from './routes/RootRedirect';

// 导入现有页面
import PatientListPage from './pages/PatientListPage';
import PatientDetailPage from './pages/PatientDetailPage';
import PatientFormPage from './pages/PatientFormPage';
import IntakeWizardPage from './pages/IntakeWizardPage';
import IntakeRecordsPage from './pages/IntakeRecordsPage';
import AnalysisPage from './pages/AnalysisPage';

// 导入新的管理页面
import { UsersPage } from './pages/UsersPage';
import { RolesPage } from './pages/RolesPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { InvitesPage } from './pages/InvitesPage';
import ImportPage from './pages/ImportPage';
import ExportPage from './pages/ExportPage';
import AuditPage from './pages/AuditPage';
import SettingsPage from './pages/SettingsPage';

import './styles/critical.css';
import './styles/analysis.css';

const AdminApp: React.FC = () => {
  return (
      <RBACProvider>
        <Routes>
          {/* 根路径快速分流：未登录跳 /login，已登录跳 /dashboard */}
          <Route path="/" element={<RootRedirect />} />
          {/* 登录页面 */}
          <Route path="/login" element={<LoginPage />} />

          {/* 管理端路由 */}
          <Route path="/*" element={
            <AdminRouteGuard>
              <AdminLayout>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />

                  {/* 患者管理相关页面 */}
                  <Route path="/patients" element={<PatientListPage />} />
                  <Route path="/patients/new" element={<IntakeWizardPage />} />
                  <Route path="/patients/:patientKey" element={<PatientDetailPage />} />
                  <Route path="/patients/:patientKey/edit" element={<PatientFormPage />} />
                  <Route path="/patients/:patientKey/intakes" element={<IntakeRecordsPage />} />

                  {/* 数据分析页面 */}
                  <Route path="/analysis" element={<AnalysisPage />} />

                  {/* 管理功能页面 */}
                  <Route path="/users" element={
                    <AdminRouteGuard requireAdmin={true}>
                      <UsersPage />
                    </AdminRouteGuard>
                  } />

                  <Route path="/roles" element={
                    <AdminRouteGuard requireAdmin={true}>
                      <RolesPage />
                    </AdminRouteGuard>
                  } />

                  <Route path="/approvals" element={<ApprovalsPage />} />

                  <Route path="/invites" element={<InvitesPage />} />

                  <Route path="/import" element={
                    <AdminRouteGuard requireAdmin={true}>
                      <ImportPage />
                    </AdminRouteGuard>
                  } />

                  <Route path="/export" element={
                    <AdminRouteGuard>
                      <ExportPage />
                    </AdminRouteGuard>
                  } />

                  <Route path="/audit" element={
                    <AdminRouteGuard>
                      <AuditPage />
                    </AdminRouteGuard>
                  } />

                  <Route path="/settings" element={
                    <AdminRouteGuard requireAdmin={true}>
                      <SettingsPage />
                    </AdminRouteGuard>
                  } />

                  {/* 向后兼容重定向 */}
                  <Route path="/intake" element={<Navigate to="/patients/new" replace />} />

                  {/* 404 页面 */}
                  <Route path="*" element={
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <h2>页面未找到</h2>
                      <p>请检查URL是否正确</p>
                    </div>
                  } />
                </Routes>
              </AdminLayout>
            </AdminRouteGuard>
          } />
        </Routes>
      </RBACProvider>
  );
};

export default AdminApp;
