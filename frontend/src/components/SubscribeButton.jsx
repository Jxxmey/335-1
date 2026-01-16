import React from 'react';
import axios from 'axios';
import { FaBell } from 'react-icons/fa';

const PUBLIC_VAPID_KEY = 'BBt-YTzQDmOepSYF9tJ9EvplFuXW7uSO-dk-b_mZW_ywcJ3maPIvFrCqP3j_o68muB7etWBp1rr30Y7Q9_RKIsQ'; // ใส่ Key ที่ได้จาก Backend

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function SubscribeButton() {
  const subscribe = async () => {
    if (!('serviceWorker' in navigator)) return;
    const register = await navigator.serviceWorker.register('/sw.js');
    const subscription = await register.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });
    await axios.post('/api/notifications/subscribe', subscription);
    alert('🔔 ติดตามข่าวสารเรียบร้อย!');
  };

  return (
    <button className="btn btn-warning btn-sm rounded-pill px-3" onClick={subscribe}>
      <FaBell className="me-1"/> แจ้งเตือน
    </button>
  );
}