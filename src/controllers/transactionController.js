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
    const statusDetails = await solanaService.checkTransactionStatus(signature);
    
    // Kiểm tra xem giao dịch có tồn tại không
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy giao dịch',
        status: statusDetails 
      });
    }

    // Phân tích thêm thông tin chi tiết
    let details = {};
    if (transaction) {
      details = solanaService.parseTransactionDetails ? 
               solanaService.parseTransactionDetails(transaction, '') : {};
    }

    return res.json({
      success: true,
      data: {
        transaction,
        status: statusDetails,
        details
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
 * Xác minh thông tin giao dịch
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function verifyTransaction(req, res) {
  try {
    const { signature } = req.params;
    const verifyParams = req.query;
    
    if (!signature) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu chữ ký giao dịch (signature)' 
      });
    }

    // Xác minh giao dịch với các tham số đã cung cấp
    const result = await solanaService.verifyTransaction(signature, verifyParams);

    return res.json({
      success: result.verified,
      message: result.verified ? 'Giao dịch đã được xác minh thành công' : result.reason,
      data: result
    });
  } catch (error) {
    console.error('Lỗi khi xác minh giao dịch:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi xác minh giao dịch', 
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
  getWalletTransactions,
  verifyTransaction
}; 