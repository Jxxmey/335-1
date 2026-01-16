import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const [form, setForm] = useState({ username: '', password: '' });
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', form);
      localStorage.setItem('token', res.data.token); // เก็บ Token
      navigate('/admin');
    } catch (err) { alert(err.response?.data?.error || 'เข้าสู่ระบบไม่สำเร็จ'); }
  };

  return (
    <div className="d-flex justify-content-center mt-5">
      <form onSubmit={handleLogin} className="card p-4 shadow-sm" style={{width: '320px'}}>
        <h3 className="text-center mb-3">Admin Login</h3>
        <input className="form-control mb-3" placeholder="Username" autoFocus
               onChange={e => setForm({...form, username: e.target.value})} />
        <input type="password" className="form-control mb-3" placeholder="Password" 
               onChange={e => setForm({...form, password: e.target.value})} />
        <button className="btn btn-primary w-100">Login</button>
      </form>
    </div>
  );
}