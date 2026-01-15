import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { password });
      localStorage.setItem('token', res.data.token);
      navigate('/admin');
    } catch { alert('รหัสผิด'); }
  };

  return (
    <div className="d-flex justify-content-center mt-5">
      <form onSubmit={handleLogin} className="card p-4 shadow-sm" style={{width: '300px'}}>
        <h3 className="text-center mb-3">Admin Login</h3>
        <input type="password" className="form-control mb-3" placeholder="Password" onChange={e => setPassword(e.target.value)} />
        <button className="btn btn-primary w-100">Login</button>
      </form>
    </div>
  );
}