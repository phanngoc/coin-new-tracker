/**
 * Dashboard Server cho Twitter Crypto Crawler
 * 
 * Server web đơn giản để xem dữ liệu từ MongoDB
 */

// Dashboard Server
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const session = require('express-session');
const flash = require('connect-flash');
const moment = require('moment');
require('dotenv').config();

// Routes
const dashboardRoutes = require('./routes/dashboardRoutes');

// Create Express app
const app = express();

// Port
const PORT = process.env.DASHBOARD_PORT || 3002;

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware
app.use(session({
    secret: 'crypto-twitter-dashboard-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));

// Flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.moment = moment;
    next();
});

// Routes
app.use('/', dashboardRoutes);
app.use('/dashboard', dashboardRoutes);

// Error handling
app.use((req, res, next) => {
    res.status(404).render('error', {
        title: 'Không tìm thấy trang',
        error: 'Trang bạn đang tìm kiếm không tồn tại.',
        moment
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Lỗi máy chủ',
        error: 'Đã xảy ra lỗi trên máy chủ. Vui lòng thử lại sau.',
        moment
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Dashboard server đang chạy ở http://localhost:${PORT}`);
}); 