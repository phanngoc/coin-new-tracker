require('dotenv').config();
const { clusterApiUrl } = require('@solana/web3.js');

// Lấy thông tin mạng Solana từ biến môi trường
const network = process.env.SOLANA_NETWORK || 'devnet';

// Cấu hình kết nối
const config = {
  // Endpoint API của Solana dựa trên mạng đã chọn
  endpoint: clusterApiUrl(network),
  network,
  port: process.env.PORT || 3000
};

module.exports = config; 