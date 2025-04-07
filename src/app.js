const express = require('express');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./routes/api');

const app = express();

// Middleware để parse JSON
app.use(express.json());

// Phục vụ các file tĩnh từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// Middleware để log request
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api', apiRoutes);

// Route mặc định trả về file HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Xử lý route không tồn tại
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Không tìm thấy endpoint'
  });
});

// Xử lý lỗi
app.use((err, req, res, next) => {
  console.error('Lỗi server:', err);
  res.status(500).json({
    success: false,
    message: 'Lỗi server',
    error: err.message
  });
});

// Khởi động server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  console.log(`Solana network: ${config.network}`);
}); 