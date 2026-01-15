import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // สำคัญมากสำหรับ Docker
    port: 5173,
    watch: {
      usePolling: true // แก้ปัญหา Hot Reload ใน Windows
    }
  }
})