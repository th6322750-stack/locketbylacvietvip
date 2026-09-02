# Sử dụng Node.js Alpine siêu nhẹ và ổn định
FROM node:20-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy package.json và cài đặt dependencies
COPY package*.json ./
RUN npm install --production

# Copy toàn bộ mã nguồn vào container
COPY . .

# Mở cổng 3000
EXPOSE 3000

# Thiết lập biến môi trường
ENV NODE_ENV=production
ENV PORT=3000

# Khởi chạy server 24/7
CMD ["node", "server.js"]
