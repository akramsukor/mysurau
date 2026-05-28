import { Routes, Route } from 'react-router-dom';
import App from './App.jsx';

// Dashboard routes wired in Slice 2
function DashboardPlaceholder() {
  return null;
}

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/dashboard/*" element={<DashboardPlaceholder />} />
    </Routes>
  );
}
