import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import PrivateEvents from './pages/PrivateEvents';
import BookEvent from './pages/BookEvent';
import CancelReservation from './pages/CancelReservation';
import Donate from './pages/Donate';
import LeaveReview from './pages/LeaveReview';
import Waiver from './pages/Waiver';
import api from './api';
import './App.css';

function AdminLoader() {
  const [AdminDashboard, setAdminDashboard] = useState(null);
  const [checked, setChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.post('/admin/verify', { path: location.pathname })
      .then(res => {
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
            <Route path="*" element={<AdminLoader />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
