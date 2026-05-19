import { NavLink, Route, Routes } from 'react-router-dom';
import AuditPage from './pages/AuditPage';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <div className="app-shell">
      <header className="topbar app-topbar">
        <div className="topbar-brand">
          <span className="topbar-logo">S</span>
          <div className="topbar-copy">
            <p className="eyebrow">SEO Audit Workspaces</p>
            <h1>Operator board</h1>
          </div>
        </div>
        <nav className="topnav">
          <NavLink to="/" className={({ isActive }) => `nav-link topnav-pill ${isActive ? 'active' : ''}`}>
            New Audit
          </NavLink>
        </nav>
      </header>

      <main className="page-shell">
        <Routes>
          <Route path="/" element={<AuditPage />} />
          <Route path="/audits/:auditId" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
