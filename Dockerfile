# ---------------------------------------
# Stage 1: Build Frontend
# ---------------------------------------
FROM node:18-alpine as build-stage

WORKDIR /app/frontend

# ก๊อปปี้ package.json ไปลง
COPY frontend/package*.json ./
RUN npm install

# ก๊อปปี้โค้ดทั้งหมด
COPY frontend/ .

# 🔥 [สำคัญมาก] บังคับให้ใช้ /api ตรงนี้เลย (แก้ปัญหา localhost)
ENV VITE_API_URL=/api

# สั่ง Build เว็บ (มันจะเอาค่าข้างบนไปฝังในโค้ด)
RUN npm run build

# ---------------------------------------
# Stage 2: Setup Backend (รวมร่าง)
# ---------------------------------------
FROM node:18-alpine

WORKDIR /app

# ก๊อปปี้ package.json ของ Backend
COPY backend/package*.json ./
RUN npm install --production

# ก๊อปปี้โค้ด Backend
COPY backend/ .

# ก๊อปปี้ไฟล์หน้าเว็บที่ Build เสร็จแล้วจาก Stage 1 มาใส่
COPY --from=build-stage /app/frontend/dist ../frontend/dist

# เปิด Port
EXPOSE 5000

# รัน Server
CMD ["node", "server.js"]