import { Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import DashboardRouter from './dashboard/DashboardRouter.jsx';

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/dashboard/*" element={<DashboardRouter />} />
    </Routes>
  );
}
