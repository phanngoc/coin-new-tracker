const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// Route kiểm tra giao dịch theo signature
router.get('/transaction/:signature', transactionController.checkTransaction);

// Route lấy thông tin ví và token
router.get('/wallet/:address', transactionController.getWalletInfo);

// Route lấy danh sách giao dịch của ví
router.get('/wallet/:address/transactions', transactionController.getWalletTransactions);

module.exports = router; 