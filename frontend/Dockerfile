FROM node:18-alpine

WORKDIR /app

# Copy package.json และ install library
COPY package*.json ./
RUN npm install

# Copy source code ทั้งหมด
COPY . .

# เปิด port 5173
EXPOSE 5173

# รัน Vite
CMD ["npm", "run", "dev", "--", "--host"]