import { Routes, Route } from 'react-router-dom';
import AuthGuard from './AuthGuard.jsx';
import Layout from './Layout.jsx';
import Login from './Login.jsx';
import Queue from './Queue.jsx';
import DetailPage from './DetailPage.jsx';
import './dashboard.css';

export default function DashboardRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="login" element={<Login />} />

      {/* Protected: AuthGuard verifies session + profiles.admin, then Layout renders the shell */}
      <Route element={<AuthGuard />}>
        <Route element={<Layout />}>
          <Route index element={<Queue />} />
          <Route path=":auditId" element={<DetailPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
