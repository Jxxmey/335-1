import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UserApp from './components/UserApp';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import AdminRegister from './components/AdminRegister'; // ✅ เพิ่ม
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserApp />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/register/:code" element={<AdminRegister />} /> {/* ✅ เพิ่ม */}
      </Routes>
    </BrowserRouter>
  );
}
export default App;