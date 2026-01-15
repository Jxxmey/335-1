# ---------------------------------------
# Stage 1: Build Frontend (สร้างหน้าเว็บ)
# ---------------------------------------
FROM node:18-alpine as build-stage

WORKDIR /app/frontend
# ก๊อปปี้ไฟล์ package ของ frontend มาลง
COPY frontend/package*.json ./
RUN npm install

# ก๊อปปี้โค้ด frontend ทั้งหมดมา แล้วสั่ง Build
COPY frontend/ .
# กำหนด URL API เป็น /api เพราะอยู่ server เดียวกัน
ENV VITE_API_URL=/api
RUN npm run build

# ---------------------------------------
# Stage 2: Setup Backend (รวมร่าง)
# ---------------------------------------
FROM node:18-alpine

WORKDIR /app

# ก๊อปปี้ไฟล์ package ของ backend มาลง
COPY backend/package*.json ./
RUN npm install --production

# ก๊อปปี้โค้ด backend ทั้งหมด
COPY backend/ .

# 🔥 ก๊อปปี้ไฟล์หน้าเว็บที่ Build เสร็จแล้วจาก Stage 1 มาไว้ใน Backend
COPY --from=build-stage /app/frontend/dist ../frontend/dist

# เปิด Port 5000
EXPOSE 5000

# รัน Server
CMD ["node", "server.js"]