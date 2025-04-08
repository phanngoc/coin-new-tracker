/**
 * Dashboard Routes
 * 
 * Định nghĩa các routes cho dashboard
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const crawlController = require('../controllers/crawlController');

// Trang chủ
router.get('/', dashboardController.getHomePage);

// Trang phân tích
router.get('/analytics', dashboardController.getAnalytics);

// Trang phân tích chi tiết cho một coin
router.get('/coin-analysis/:coin', dashboardController.getCoinAnalysis);

// Tìm kiếm
router.get('/search', dashboardController.getSearchPage);
router.post('/search', dashboardController.searchTweets);

// Xem coins
router.get('/coin/:coin', dashboardController.getTweetsByCoin);

// Xem tài khoản
router.get('/account/:username', dashboardController.getTweetsByAccount);

// Xem hashtag
router.get('/hashtag/:hashtag', dashboardController.getTweetsByHashtag);

// Trang crawl
router.get('/crawl', crawlController.getCrawlPage);
router.post('/crawl/account', crawlController.crawlAccount);
router.post('/crawl/hashtag', crawlController.crawlHashtag);

module.exports = router;