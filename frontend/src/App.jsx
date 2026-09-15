/**
 * App routes for Healio.
 */
import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Book from './pages/Book';
import Waitlist from './pages/Waitlist';
import StaffLogin from './pages/StaffLogin';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/home" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/book" element={<Book />} />
      <Route path="/waitlist" element={<Waitlist />} />
      <Route path="/staff/login" element={<StaffLogin />} />
      <Route path="/doctor" element={<DoctorDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}

export default App;
