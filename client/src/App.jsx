import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import PrivateEvents from './pages/PrivateEvents';
import BookEvent from './pages/BookEvent';
import CancelReservation from './pages/CancelReservation';
import Donate from './pages/Donate';
import LeaveReview from './pages/LeaveReview';
import Waiver from './pages/Waiver';
import PayInvoice from './pages/PayInvoice';
import api from './api';
import './App.css';

function AdminLoader() {
  const [AdminDashboard, setAdminDashboard] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [checked, setChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.post('/admin/verify', { path: location.pathname })
      .then(res => {
        if (res.data.requiresPassword) setNeedsPassword(true);
        if (res.data.valid) {
          // Store admin token for authenticated API calls
          api.defaults.headers.common['x-admin-token'] = res.data.token;
          import('./pages/AdminDashboard').then(mod => {
            setAdminDashboard(() => mod.default);
          });
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [location.pathname]);

  if (!checked) return <p>Loading...</p>;
  if (!AdminDashboard && needsPassword) return <form onSubmit={async e => {
    e.preventDefault();
    try {
      const { data } = await api.post('/admin/verify', { path: location.pathname, password });
      if (!data.valid) { setLoginError('Incorrect password'); return; }
      api.defaults.headers.common['x-admin-token'] = data.token;
      const mod = await import('./pages/AdminDashboard');
      setAdminDashboard(() => mod.default); setPassword('');
    } catch { setLoginError('Unable to sign in'); }
  }}><h2>Administrator sign in</h2><label>Password <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button type="submit">Sign in</button>{loginError && <p role="alert">{loginError}</p>}</form>;
  if (!AdminDashboard) return null;
  return <AdminDashboard />;
}

function App() {
  return (
    <Router>
      <div className="App">
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/private" element={<PrivateEvents />} />
            <Route path="/book/:eventId" element={<BookEvent />} />
            <Route path="/cancel/:reservationId" element={<CancelReservation />} />
            <Route path="/donate" element={<Donate />} />
            <Route path="/review/:reservationId" element={<LeaveReview />} />
            <Route path="/waiver" element={<Waiver />} />
            <Route path="/invoice/:invoiceId" element={<PayInvoice />} />
            <Route path="*" element={<AdminLoader />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
