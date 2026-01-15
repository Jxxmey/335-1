import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Modal, Button, Form, Carousel } from 'react-bootstrap';
import { FaHome, FaCalendarAlt, FaPlusCircle, FaUserShield, FaLock, FaTimes } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import SubscribeButton from './SubscribeButton';

export default function UserApp() {
  const [activeTab, setActiveTab] = useState('home');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  // Modal States
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  
  // Form States
  const [reqForm, setReqForm] = useState({ title: '', start: '', end: '', description: '', linkUrl: '' });
  const [reqFiles, setReqFiles] = useState([]);
  const [adminPassword, setAdminPassword] = useState('');

  const navigate = useNavigate();
  const API_URL = 'http://localhost:5000/api/events';

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API_URL}?role=user`);
      setEvents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openDetail = (ev) => { setSelectedEvent(ev); setShowDetailModal(true); };

  const handleAdminClick = () => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/admin');
    } else {
      setShowLoginModal(true);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { password: adminPassword });
      localStorage.setItem('token', res.data.token);
      setShowLoginModal(false);
      setAdminPassword('');
      navigate('/admin');
    } catch {
      alert('❌ รหัสผ่านไม่ถูกต้อง');
    }
  };

  // --- Logic Render Home ---
  const renderHome = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEvents = events.filter(ev => {
        const startDate = new Date(ev.start);
        startDate.setHours(0, 0, 0, 0); 
        const endDate = new Date(ev.end);
        endDate.setHours(0, 0, 0, 0); 
        return startDate <= today && endDate >= today;
    });

    const upcomingEvents = events.filter(ev => {
        const startDate = new Date(ev.start);
        startDate.setHours(0, 0, 0, 0);
        return startDate > today;
    });

    return (
      <div className="px-3">
        <div className="d-flex justify-content-between align-items-center mb-4 mt-2">
             <h5 className="fw-bold m-0" style={{color:'#334155'}}>🔥 กำลังฮิตวันนี้</h5>
             <SubscribeButton />
        </div>
        
        {todayEvents.length === 0 && (
            <div className="text-center py-5 bg-white rounded-4 shadow-sm border border-light">
                <p className="text-muted m-0">วันนี้ยังไม่มีโปรโมชั่น</p>
            </div>
        )}
        {todayEvents.map(ev => <PromoCard key={ev._id} event={ev} onClick={() => openDetail(ev)} />)}

        <h5 className="mb-3 mt-5 fw-bold" style={{color:'#334155'}}>🔜 มาใหม่เร็วๆ นี้</h5>
        {upcomingEvents.length === 0 && <p className="text-muted text-center small">ยังไม่มีรายการล่วงหน้า</p>}
        {upcomingEvents.map(ev => <PromoCard key={ev._id} event={ev} onClick={() => openDetail(ev)} />)}
      </div>
    );
  };

  const renderCalendar = () => (
    <div className="px-3">
      <div className="bg-white rounded-4 shadow-sm p-3 border border-light">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          displayEventTime={false}
          headerToolbar={{ start: 'title', center: '', end: 'prev,next' }}
          dayMaxEvents={3}
          height="auto"
          events={events.map(e => ({ 
              id: e._id,
              title: e.title, 
              start: e.start, 
              end: e.end,
              backgroundColor: e.color,
              borderColor: 'transparent',
              extendedProps: { ...e }
          }))}
          eventClick={(info) => openDetail(info.event.extendedProps)}
        />
      </div>
    </div>
  );

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.keys(reqForm).forEach(k => formData.append(k, reqForm[k]));
    for (let f of reqFiles) formData.append('images', f);

    try {
      await axios.post(API_URL, formData);
      alert('✅ ส่งข้อมูลเรียบร้อย!');
      setReqForm({ title: '', start: '', end: '', description: '', linkUrl: '' });
      setReqFiles([]);
      setActiveTab('home');
    } catch (err) {
      alert('Error sending request');
    }
  };

  const renderRequest = () => (
    <div className="px-3">
      <div className="bg-white p-4 rounded-4 shadow-sm">
        <h4 className="text-center mb-2 fw-bold text-primary">📝 แจ้งโปรฯ ใหม่</h4>
        <p className="text-center text-muted small mb-4">มีกิจกรรมน่าสนใจบอกเราได้เลย!</p>
        <Form onSubmit={handleRequestSubmit}>
           <Form.Group className="mb-3">
             <Form.Label className="fw-bold small">หัวข้อ</Form.Label>
             <Form.Control className="bg-light border-0" type="text" value={reqForm.title} onChange={e => setReqForm({...reqForm, title: e.target.value})} required placeholder="เช่น ลด 50%..."/>
           </Form.Group>
           <div className="row mb-3">
             <div className="col"><Form.Label className="fw-bold small">เริ่ม</Form.Label><Form.Control className="bg-light border-0" type="date" value={reqForm.start} onChange={e => setReqForm({...reqForm, start: e.target.value})} required /></div>
             <div className="col"><Form.Label className="fw-bold small">จบ</Form.Label><Form.Control className="bg-light border-0" type="date" value={reqForm.end} onChange={e => setReqForm({...reqForm, end: e.target.value})} required /></div>
           </div>
           <Form.Group className="mb-3"><Form.Label className="fw-bold small">รายละเอียด</Form.Label><Form.Control className="bg-light border-0" as="textarea" rows={3} value={reqForm.description} onChange={e => setReqForm({...reqForm, description: e.target.value})} /></Form.Group>
           <Form.Group className="mb-4"><Form.Label className="fw-bold small">รูปภาพ</Form.Label><Form.Control type="file" multiple onChange={e => setReqFiles(e.target.files)} /></Form.Group>
           <Button variant="primary" type="submit" className="w-100 rounded-pill py-3 fw-bold shadow-sm" style={{background:'linear-gradient(90deg, #6366f1, #a855f7)', border:'none'}}>🚀 ส่งข้อมูล</Button>
        </Form>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      {/* Header พร้อม Logo */}
      <div className="app-header">
        <div className="d-flex align-items-center gap-3">
            {/* ✅ ส่วนโลโก้ที่เพิ่มเข้ามา */}
            <div className="bg-white rounded-circle p-1 d-flex align-items-center justify-content-center shadow-sm" style={{width:'55px', height:'55px'}}>
                <img src="./logo.png" alt="Logo" style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} />
            </div>
            
            {/* ชื่อแอปและข้อความ */}
            <div>
                <div className="d-flex align-items-center gap-2">
                    <h2 className="m-0 fw-bold" style={{letterSpacing:'-1px'}}>PromoHub</h2>
                    <span className="badge bg-white text-primary rounded-pill px-2" style={{fontSize:'0.7rem'}}>v2.0</span>
                </div>
                <p className="m-0 opacity-75 small mt-1" style={{lineHeight: '1.2'}}>แหล่งรวมโปรโมชั่น</p>
            </div>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === 'home' && renderHome()}
      {activeTab === 'calendar' && renderCalendar()}
      {activeTab === 'request' && renderRequest()}

      {/* Footer Powered by Jomey */}
      <div className="text-center mt-5 mb-5 pb-5 pt-3 opacity-50">
          <small style={{fontSize: '0.75rem', letterSpacing: '1px', textTransform: 'uppercase'}}>
              Powered by <span className="fw-bold text-primary">Jomey</span>
          </small>
      </div>

      {/* Bottom Nav */}
      <div className="bottom-nav">
        <button className={`nav-item ${activeTab==='home'?'active':''}`} onClick={()=>setActiveTab('home')}><FaHome className="nav-icon"/><span>หน้าหลัก</span></button>
        <button className={`nav-item ${activeTab==='calendar'?'active':''}`} onClick={()=>setActiveTab('calendar')}><FaCalendarAlt className="nav-icon"/><span>ปฏิทิน</span></button>
        <button className={`nav-item ${activeTab==='request'?'active':''}`} onClick={()=>setActiveTab('request')}><FaPlusCircle className="nav-icon"/><span>แจ้งโปรฯ</span></button>
        <button className="nav-item" onClick={handleAdminClick}><FaUserShield className="nav-icon"/><span>Admin</span></button>
      </div>

      {/* --- Detail Modal --- */}
      <Modal show={showDetailModal} onHide={()=>setShowDetailModal(false)} centered size="lg">
         <Modal.Header closeButton className="border-0 pb-0"></Modal.Header>
         <Modal.Body className="pt-0">
           <h3 className="fw-bold mb-3 mt-2">{selectedEvent?.title}</h3>
           
           {selectedEvent?.imageUrls && selectedEvent.imageUrls.length > 0 ? (
             <Carousel className="mb-4 rounded-4 overflow-hidden shadow-sm" interval={null} indicators={selectedEvent.imageUrls.length > 1}>
                {selectedEvent.imageUrls.map((url, i) => (
                    <Carousel.Item key={i}>
                        <div 
                            className="d-flex justify-content-center bg-light position-relative" 
                            style={{height:'350px', cursor:'zoom-in'}}
                            onClick={() => setPreviewImage(url)}
                        >
                            <img src={url} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                            <div className="position-absolute bottom-0 end-0 m-2 badge bg-dark bg-opacity-50">🔍 แตะเพื่อขยาย</div>
                        </div>
                    </Carousel.Item>
                ))}
             </Carousel>
           ) : null}

           <div className="d-flex gap-2 mb-3">
                <span className="badge bg-light text-dark border px-3 py-2 rounded-pill">
                    📅 เริ่ม: {selectedEvent && new Date(selectedEvent.start).toLocaleDateString()}
                </span>
                <span className="badge bg-light text-dark border px-3 py-2 rounded-pill">
                    🏁 จบ: {selectedEvent && new Date(selectedEvent.end).toLocaleDateString()}
                </span>
           </div>

           <p className="text-secondary" style={{whiteSpace: 'pre-wrap', lineHeight:'1.6'}}>{selectedEvent?.description}</p>
           
           {selectedEvent?.linkUrl && (
               <a href={selectedEvent.linkUrl} target="_blank" className="btn btn-primary w-100 rounded-pill py-3 fw-bold mt-2 shadow-sm" style={{background:'linear-gradient(90deg, #6366f1, #a855f7)', border:'none'}}>
                   🌐 ไปยังหน้าเว็บกิจกรรม
               </a>
           )}
         </Modal.Body>
      </Modal>

      {/* --- Login Modal --- */}
      <Modal show={showLoginModal} onHide={()=>setShowLoginModal(false)} centered contentClassName="border-0 rounded-4 shadow">
        <Modal.Header closeButton className="border-0"></Modal.Header>
        <Modal.Body className="px-4 pb-5 text-center">
            <div className="bg-primary bg-opacity-10 rounded-circle d-inline-flex p-4 mb-3">
                <FaLock className="text-primary display-4" />
            </div>
            <h4 className="fw-bold mb-1">Admin Access</h4>
            <p className="text-muted small mb-4">เข้าสู่ระบบจัดการหลังบ้าน</p>
            <Form onSubmit={handleLoginSubmit}>
                <Form.Control 
                    type="password" 
                    placeholder="Enter Password" 
                    value={adminPassword} 
                    onChange={e => setAdminPassword(e.target.value)}
                    className="text-center py-3 bg-light border-0 rounded-3 mb-3"
                    autoFocus
                />
                <Button variant="primary" type="submit" className="w-100 rounded-pill py-3 fw-bold">Login</Button>
            </Form>
        </Modal.Body>
      </Modal>

      {/* --- Image Preview Modal --- */}
      <Modal show={!!previewImage} onHide={() => setPreviewImage(null)} centered fullscreen contentClassName="bg-dark bg-opacity-90 border-0">
        <Modal.Body className="p-0 d-flex align-items-center justify-content-center position-relative h-100">
            <button className="btn btn-dark position-absolute top-0 end-0 m-4 rounded-circle p-3 shadow-lg border border-secondary" onClick={() => setPreviewImage(null)} style={{zIndex: 1050}}>
                <FaTimes size={24} color="white"/>
            </button>
            {previewImage && <img src={previewImage} className="img-fluid" style={{maxHeight:'100vh', maxWidth:'100vw', objectFit:'contain'}} />}
        </Modal.Body>
      </Modal>

    </div>
  );
}

const PromoCard = ({ event, onClick }) => (
  <div className="promo-card" onClick={onClick}>
    <div className="promo-img-container">
      {event.imageUrls?.[0] ? <img src={event.imageUrls[0]} className="promo-img" /> : <div className="d-flex align-items-center justify-content-center h-100 text-muted small">No Image</div>}
      <div className="position-absolute bottom-0 start-0 m-2 badge bg-dark bg-opacity-75 backdrop-blur rounded-pill px-3 fw-normal">
         {new Date(event.start).toLocaleDateString('th-TH', {day:'numeric', month:'short'})}
      </div>
    </div>
    <div className="p-3">
      <h6 className="fw-bold mb-1 text-truncate" style={{fontSize:'1.1rem'}}>{event.title}</h6>
      <small className="text-muted">{event.description?.substring(0, 50)}...</small>
    </div>
  </div>
);