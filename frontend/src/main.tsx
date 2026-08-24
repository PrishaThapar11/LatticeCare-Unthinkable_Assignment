import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { RequireRole } from './components/RequireRole';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/patient" element={<RequireRole roles={['PATIENT']}><PatientDashboard /></RequireRole>} />
            <Route path="/doctor" element={<RequireRole roles={['DOCTOR']}><DoctorDashboard /></RequireRole>} />
            <Route path="/admin" element={<RequireRole roles={['ADMIN']}><AdminDashboard /></RequireRole>} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
