import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Form, Carousel } from 'react-bootstrap';
import { FaListAlt, FaClock, FaPlusCircle, FaSignOutAlt, FaEdit, FaTrash, FaCheck, FaTimes, FaCamera } from 'react-icons/fa';
import '../App.css'; // ใช้ CSS เดียวกับ UserApp

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('manage'); // manage, pending, form
  
  // Data States
  const [events, setEvents] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  
  // Form & Edit States
  const [formData, setFormData] = useState({ 
    title: '', start: '', end: '', color: '#3788d8', description: '', linkUrl: '' 
  });
  const [files, setFiles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null); // Modal ดูรูป

  const token = localStorage.getItem('token');
  const API_URL = 'http://localhost:5000/api/events';

  useEffect(() => {
    if (!token) navigate('/login');
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API_URL}?role=admin`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const all = res.data;
      setEvents(all.filter(e => e.status === 'approved' || !e.status));
      setPendingEvents(all.filter(e => e.status === 'pending'));
    } catch (err) { console.error(err); }
  };

  // --- Logic การจัดการข้อมูล ---

  const handleDelete = async (id) => {
    if(!confirm('ยืนยันลบรายการนี้?')) return;
    await axios.delete(`${API_URL}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    fetchEvents();
  };

  const handleApprove = async (id) => {
    await axios.put(`${API_URL}/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } });
    alert('✅ อนุมัติแล้ว'); 
    fetchEvents();
  };

  const handleEdit = (ev) => {
    setEditingId(ev._id);
    setFormData({
      title: ev.title,
      start: ev.start.split('T')[0],
      end: ev.end.split('T')[0],
      color: ev.color,
      description: ev.description || '',
      linkUrl: ev.linkUrl || ''
    });
    setActiveTab('form'); // สลับไปหน้าฟอร์ม
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Fix Time Logic: 00:01 - 12:00
    const fixedStart = formData.start + 'T00:01:00';
    const fixedEnd = formData.end + 'T12:00:00';

    const data = new FormData();
    data.append('title', formData.title);
    data.append('start', fixedStart);
    data.append('end', fixedEnd);
    data.append('color', formData.color);
    data.append('description', formData.description);
    data.append('linkUrl', formData.linkUrl);
    for (let f of files) data.append('images', f);

    try {
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, data, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
        alert('✅ แก้ไขเรียบร้อย');
      } else {
        await axios.post(API_URL, data, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
        alert('✅ เพิ่มรายการเรียบร้อย');
      }
      
      // Reset Form
      setFormData({ title: '', start: '', end: '', color: '#3788d8', description: '', linkUrl: '' });
      setFiles([]);
      setEditingId(null);
      fetchEvents();
      setActiveTab('manage'); // กลับไปหน้าหน้ารายการ
    } catch (err) { alert('Error: ' + err.message); }
  };

  // --- Render Views ---

  // 1. หน้าจัดการ (รายการปัจจุบัน)
  const renderManage = () => (
    <div className="px-3 pb-5">
      <h5 className="text-secondary mb-3">✅ รายการปัจจุบัน ({events.length})</h5>
      {events.length === 0 && <p className="text-center text-muted mt-5">ไม่มีรายการ</p>}
      {events.map(ev => (
        <div key={ev._id} className="card border-0 shadow-sm mb-3 overflow-hidden rounded-4">
            {/* ส่วนรูปภาพ */}
            <div className="bg-light position-relative" style={{height: '150px'}}>
                {ev.imageUrls?.[0] ? (
                    <img 
                        src={ev.imageUrls[0]} 
                        className="w-100 h-100 object-fit-cover" 
                        onClick={() => setPreviewImage(ev.imageUrls[0])} // คลิกเพื่อดูรูปใหญ่
                    />
                ) : (
                    <div className="d-flex align-items-center justify-content-center h-100 text-muted">No Image</div>
                )}
                <span className="position-absolute top-0 end-0 badge bg-primary m-2">{new Date(ev.start).toLocaleDateString()}</span>
            </div>
            
            {/* ส่วนเนื้อหา */}
            <div className="p-3">
                <h5 className="fw-bold mb-1">{ev.title}</h5>
                <p className="text-muted small text-truncate">{ev.description}</p>
                <div className="d-flex gap-2 mt-3">
                    <button className="btn btn-warning btn-sm flex-fill rounded-pill" onClick={() => handleEdit(ev)}>
                        <FaEdit /> แก้ไข
                    </button>
                    <button className="btn btn-outline-danger btn-sm flex-fill rounded-pill" onClick={() => handleDelete(ev._id)}>
                        <FaTrash /> ลบ
                    </button>
                </div>
            </div>
        </div>
      ))}
    </div>
  );

  // 2. หน้ารออนุมัติ
  const renderPending = () => (
    <div className="px-3 pb-5">
      <h5 className="text-warning-emphasis mb-3">⏳ รอการอนุมัติ ({pendingEvents.length})</h5>
      {pendingEvents.length === 0 && <div className="text-center text-muted py-5"><FaCheck className="display-1 text-success opacity-25 mb-3"/><br/>ไม่มีรายการค้าง</div>}
      
      {pendingEvents.map(ev => (
        <div key={ev._id} className="card border-warning mb-3 shadow-sm rounded-4">
           <div className="card-body">
              <div className="d-flex justify-content-between">
                 <h5 className="card-title fw-bold text-dark">{ev.title}</h5>
                 <small className="text-muted">User Request</small>
              </div>
              <p className="card-text text-secondary">{ev.description}</p>
              <div className="d-flex gap-2">
                 {ev.imageUrls?.map((url, i) => (
                    <img key={i} src={url} style={{width:40, height:40, borderRadius:8, objectFit:'cover'}} onClick={()=>setPreviewImage(url)} />
                 ))}
              </div>
              <hr/>
              <div className="d-flex gap-2">
                  <button className="btn btn-success flex-fill rounded-pill" onClick={() => handleApprove(ev._id)}>อนุมัติ</button>
                  <button className="btn btn-danger flex-fill rounded-pill" onClick={() => handleDelete(ev._id)}>ไม่อนุมัติ</button>
              </div>
           </div>
        </div>
      ))}
    </div>
  );

  // 3. หน้าฟอร์ม (Add/Edit)
  const renderForm = () => (
    <div className="px-3 pb-5">
      <div className="card border-0 shadow-sm p-4 rounded-4">
        <h4 className="text-center mb-4 text-primary">
            {editingId ? '✏️ แก้ไขข้อมูล' : '➕ เพิ่มโปรโมชั่น'}
        </h4>
        <Form onSubmit={handleSubmit}>
           <Form.Group className="mb-3">
             <Form.Label>หัวข้อกิจกรรม</Form.Label>
             <Form.Control type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required placeholder="เช่น ลดราคา 50%..." />
           </Form.Group>
           
           <div className="row mb-3">
             <div className="col-6">
                 <Form.Label>วันเริ่ม <small className="text-muted">(00:01)</small></Form.Label>
                 <Form.Control type="date" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} required />
             </div>
             <div className="col-6">
                 <Form.Label>วันจบ <small className="text-muted">(12:00)</small></Form.Label>
                 <Form.Control type="date" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} required />
             </div>
           </div>

           <Form.Group className="mb-3">
             <Form.Label>รายละเอียด</Form.Label>
             <Form.Control as="textarea" rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="รายละเอียดเพิ่มเติม..." />
           </Form.Group>
           
           <div className="row mb-3">
             <div className="col-9">
                <Form.Label>ลิงก์ (ถ้ามี)</Form.Label>
                <Form.Control type="text" value={formData.linkUrl} onChange={e => setFormData({...formData, linkUrl: e.target.value})} placeholder="https://..." />
             </div>
             <div className="col-3">
                <Form.Label>สี</Form.Label>
                <Form.Control type="color" className="form-control form-control-color w-100" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
             </div>
           </div>

           <Form.Group className="mb-4">
             <Form.Label><FaCamera/> อัปโหลดรูปภาพ {editingId && <small className="text-muted">(เพิ่มต่อจากเดิม)</small>}</Form.Label>
             <Form.Control type="file" multiple onChange={e => setFiles(e.target.files)} />
           </Form.Group>

           <Button variant={editingId ? "warning" : "primary"} type="submit" className="w-100 rounded-pill py-2 fw-bold shadow-sm">
             {editingId ? 'บันทึกการแก้ไข' : 'ยืนยันและประกาศ'}
           </Button>
           
           {editingId && (
               <Button variant="link" className="w-100 mt-2 text-muted text-decoration-none" onClick={() => { setEditingId(null); setFormData({ title: '', start: '', end: '', color: '#3788d8', description: '', linkUrl: '' }); setActiveTab('manage'); }}>
                   ยกเลิก
               </Button>
           )}
        </Form>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      {/* Header Admin */}
      <div className="app-header d-flex justify-content-between align-items-center bg-dark">
        <div>
            <h3 className="m-0 fw-bold">Admin Console</h3>
            <p className="m-0 opacity-75 small">จัดการระบบหลังบ้าน</p>
        </div>
        <button className="btn btn-sm btn-outline-light rounded-pill px-3" onClick={() => { localStorage.removeItem('token'); navigate('/'); }}>
            <FaSignOutAlt/> ออก
        </button>
      </div>

      {/* Content Area */}
      <div style={{minHeight: '80vh'}}>
          {activeTab === 'manage' && renderManage()}
          {activeTab === 'pending' && renderPending()}
          {activeTab === 'form' && renderForm()}
      </div>

      {/* Admin Bottom Navigation */}
      <div className="bottom-nav">
        <button className={`nav-item ${activeTab==='manage'?'active':''}`} onClick={()=>setActiveTab('manage')}>
          <FaListAlt className="nav-icon"/> <span>จัดการ</span>
        </button>
        <button className={`nav-item ${activeTab==='pending'?'active':''}`} onClick={()=>setActiveTab('pending')}>
          <div className="position-relative">
             <FaClock className="nav-icon"/> 
             {pendingEvents.length > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{fontSize:'0.5rem'}}>{pendingEvents.length}</span>}
          </div>
          <span>รออนุมัติ</span>
        </button>
        <button className={`nav-item ${activeTab==='form'?'active':''}`} onClick={()=>{ setEditingId(null); setActiveTab('form'); }}>
          <FaPlusCircle className="nav-icon"/> <span>เพิ่ม/แก้</span>
        </button>
      </div>

      {/* Image Preview Modal */}
      <Modal show={!!previewImage} onHide={() => setPreviewImage(null)} centered>
        <Modal.Body className="p-0 bg-dark text-center">
            <img src={previewImage} className="img-fluid" style={{maxHeight:'80vh'}} />
            <button className="btn btn-light position-absolute top-0 end-0 m-2 rounded-circle" onClick={() => setPreviewImage(null)}><FaTimes/></button>
        </Modal.Body>
      </Modal>

    </div>
  );
}