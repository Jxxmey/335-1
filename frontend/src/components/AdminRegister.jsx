import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

export default function AdminRegister() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [valid, setValid] = useState(null); // null=checking, true, false
  const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '' });

  useEffect(() => {
    // เช็คว่าโค้ดใช้ได้ไหม
    axios.get(`http://localhost:5000/api/auth/check-invite/${code}`)
      .then(res => setValid(res.data.valid))
      .catch(() => setValid(false));
  }, [code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) return alert('รหัสผ่านไม่ตรงกัน');
    
    try {
      await axios.post('http://localhost:5000/api/auth/register', {
        username: formData.username,
        password: formData.password,
        inviteCode: code
      });
      alert('สมัครสมาชิกสำเร็จ! กรุณาล็อกอิน');
      navigate('/login');
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || 'Failed'));
    }
  };

  if (valid === null) return <div className="text-center mt-5">Checking Invite Code...</div>;
  if (valid === false) return <div className="text-center mt-5 text-danger"><h3>❌ Invite Link ไม่ถูกต้องหรือหมดอายุ</h3></div>;

  return (
    <div className="d-flex justify-content-center mt-5">
      <form onSubmit={handleSubmit} className="card p-4 shadow-sm" style={{width: '350px'}}>
        <h3 className="text-center mb-3">Admin Register</h3>
        <p className="text-center text-success small">Invite Code Accepted</p>
        
        <input className="form-control mb-2" placeholder="Username" required 
           onChange={e => setFormData({...formData, username: e.target.value})} />
        <input className="form-control mb-2" type="password" placeholder="Password" required 
           onChange={e => setFormData({...formData, password: e.target.value})} />
        <input className="form-control mb-3" type="password" placeholder="Confirm Password" required 
           onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
           
        <button className="btn btn-primary w-100">Register</button>
      </form>
    </div>
  );
}