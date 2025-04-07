const solanaService = require('../services/solana');

/**
 * Kiểm tra thông tin giao dịch
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function checkTransaction(req, res) {
  try {
    const { signature } = req.params;
    
    if (!signature) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu chữ ký giao dịch (signature)' 
      });
    }

    const transaction = await solanaService.getTransaction(signature);
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy giao dịch' 
      });
    }

    const status = await solanaService.checkTransactionStatus(signature);

    return res.json({
      success: true,
      data: {
        transaction,
        status
      }
    });
  } catch (error) {
    console.error('Lỗi khi kiểm tra giao dịch:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi kiểm tra giao dịch', 
      error: error.message 
    });
  }
}

/**
 * Lấy thông tin số dư ví
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getWalletInfo(req, res) {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu địa chỉ ví' 
      });
    }

    const balance = await solanaService.getBalance(address);
    const tokens = await solanaService.getTokenAccounts(address);

    return res.json({
      success: true,
      data: {
        address,
        balance,
        tokens
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin ví:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi lấy thông tin ví', 
      error: error.message 
    });
  }
}

/**
 * Lấy danh sách giao dịch của ví
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function getWalletTransactions(req, res) {
  try {
    const { address } = req.params;
    let { limit } = req.query;
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu địa chỉ ví' 
      });
    }

    // Chuyển đổi limit thành số nguyên
    limit = limit ? parseInt(limit, 10) : 20;
    // Giới hạn số lượng giao dịch tối đa
    limit = Math.min(limit, 100);

    const transactions = await solanaService.getWalletTransactions(address, limit);

    return res.json({
      success: true,
      data: {
        address,
        limit,
        count: transactions.length,
        transactions
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách giao dịch của ví:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi lấy danh sách giao dịch', 
      error: error.message 
    });
  }
}

module.exports = {
  checkTransaction,
  getWalletInfo,
  getWalletTransactions
}; 