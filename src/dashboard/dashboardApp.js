const express = require('express');
const path = require('path');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Khởi tạo ứng dụng Express
const app = express();

// Đặt EJS làm view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware để parse body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ các file tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// Middleware để log request
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - [Dashboard] ${req.method} ${req.url}`);
  next();
});

// Routes chính
app.use('/', dashboardRoutes);

// Xử lý lỗi 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Không tìm thấy trang',
    error: 'Trang bạn đang tìm kiếm không tồn tại.'
  });
});

// Xử lý lỗi server
app.use((err, req, res, next) => {
  console.error('Lỗi dashboard server:', err);
  res.status(500).render('error', {
    title: 'Lỗi máy chủ',
    error: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn.'
  });
});

module.exports = app; 