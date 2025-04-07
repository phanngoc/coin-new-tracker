const {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const config = require('../config');

// Tạo kết nối Solana
const connection = new Connection(config.endpoint, 'confirmed');

/**
 * Lấy thông tin giao dịch từ signature
 * @param {string} signature - Chữ ký giao dịch
 * @returns {Promise<Object>} Thông tin giao dịch
 */
async function getTransaction(signature) {
  try {
    const transaction = await connection.getParsedTransaction(signature, 'confirmed');
    return transaction;
  } catch (error) {
    console.error('Lỗi khi lấy thông tin giao dịch:', error);
    throw error;
  }
}

/**
 * Kiểm tra trạng thái giao dịch
 * @param {string} signature - Chữ ký giao dịch
 * @returns {Promise<Object>} Trạng thái giao dịch
 */
async function checkTransactionStatus(signature) {
  try {
    const status = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    return status;
  } catch (error) {
    console.error('Lỗi khi kiểm tra trạng thái giao dịch:', error);
    throw error;
  }
}

/**
 * Lấy số dư của địa chỉ ví
 * @param {string} address - Địa chỉ ví Solana
 * @returns {Promise<Object>} Thông tin số dư
 */
async function getBalance(address) {
  try {
    const pubKey = new PublicKey(address);
    const balance = await connection.getBalance(pubKey);
    return {
      lamports: balance,
      sol: balance / LAMPORTS_PER_SOL
    };
  } catch (error) {
    console.error('Lỗi khi lấy số dư:', error);
    throw error;
  }
}

/**
 * Lấy danh sách token SPL của địa chỉ
 * @param {string} address - Địa chỉ ví Solana
 * @returns {Promise<Array>} Danh sách token
 */
async function getTokenAccounts(address) {
  try {
    const pubKey = new PublicKey(address);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    return tokenAccounts.value.map(account => {
      const { mint, tokenAmount } = account.account.data.parsed.info;
      return {
        mint,
        amount: tokenAmount.uiAmount,
        decimals: tokenAmount.decimals,
        uiAmountString: tokenAmount.uiAmountString
      };
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin token:', error);
    throw error;
  }
}

/**
 * Phân tích giao dịch để lấy thông tin SOL, người gửi và người nhận
 * @param {Object} transaction - Đối tượng giao dịch phân tích
 * @param {string} address - Địa chỉ ví đang xem
 * @returns {Object} Thông tin chi tiết giao dịch
 */
function parseTransactionDetails(transaction, address) {
  if (!transaction || !transaction.meta) {
    return {
      amount: 0,
      sender: '',
      receiver: '',
      type: 'không xác định'
    };
  }

  const { meta, transaction: tx } = transaction;
  let amount = 0;
  let sender = '';
  let receiver = '';
  let type = 'không xác định';

  try {
    // Xác định loại giao dịch
    if (tx.message.instructions && tx.message.instructions.length > 0) {
      const programId = tx.message.instructions[0].programId?.toString();
      
      // Nếu là chương trình hệ thống (chuyển SOL)
      if (programId === '11111111111111111111111111111111') {
        type = 'chuyển SOL';
      } 
      // Nếu là chương trình token
      else if (programId === TOKEN_PROGRAM_ID.toString()) {
        type = 'chuyển token';
      }
    }

    // Phân tích các thay đổi số dư SOL
    if (meta.preBalances && meta.postBalances && meta.preBalances.length === meta.postBalances.length) {
      const accountKeys = tx.message.accountKeys.map(key => key.pubkey.toString());
      
      for (let i = 0; i < accountKeys.length; i++) {
        const preBal = meta.preBalances[i];
        const postBal = meta.postBalances[i];
        const currentAddress = accountKeys[i];
        
        // Xác định người gửi (số dư giảm đi)
        if (preBal > postBal && currentAddress !== meta.feePayerKey) {
          const diff = (preBal - postBal) / LAMPORTS_PER_SOL;
          if (diff > amount) {
            amount = diff;
            sender = currentAddress;
          }
        } 
        // Xác định người nhận (số dư tăng lên)
        else if (postBal > preBal) {
          const diff = (postBal - preBal) / LAMPORTS_PER_SOL;
          receiver = currentAddress;
        }
      }

      // Nếu người dùng là người gửi
      if (sender === address) {
        amount = -amount; // Hiển thị số âm nếu gửi tiền đi
      }
      
      // Nếu không tìm thấy người gửi nhưng có phí giao dịch
      if (!sender && meta.fee) {
        sender = meta.feePayerKey || '';
        amount = meta.fee / LAMPORTS_PER_SOL;
        type = 'phí giao dịch';
      }
    }
    
    // Nếu không thể xác định được số lượng từ thay đổi số dư, thử lấy từ metaData
    if (amount === 0 && type === 'chuyển SOL' && meta.postTokenBalances && meta.postTokenBalances.length > 0) {
      try {
        // Xử lý chuyển token (SPL)
        const tokenDetails = meta.postTokenBalances[0];
        if (tokenDetails && tokenDetails.uiTokenAmount) {
          amount = tokenDetails.uiTokenAmount.uiAmount;
          type = `chuyển token: ${tokenDetails.mint || 'SPL'}`;
        }
      } catch (err) {
        console.error('Lỗi khi phân tích thông tin token:', err);
      }
    }

  } catch (err) {
    console.error('Lỗi khi phân tích giao dịch:', err);
  }

  return {
    amount: parseFloat(amount.toFixed(9)),
    sender: sender || 'không xác định',
    receiver: receiver || 'không xác định',
    type
  };
}

/**
 * Lấy danh sách giao dịch của địa chỉ ví
 * @param {string} address - Địa chỉ ví Solana
 * @param {number} limit - Số lượng giao dịch tối đa
 * @returns {Promise<Array>} Danh sách giao dịch
 */
async function getWalletTransactions(address, limit = 20) {
  try {
    const pubKey = new PublicKey(address);
    
    // Lấy chữ ký của các giao dịch
    const signatures = await connection.getSignaturesForAddress(pubKey, { limit });
    
    // Lấy thông tin chi tiết về từng giao dịch
    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        try {
          const tx = await connection.getParsedTransaction(sig.signature, 'confirmed');
          
          // Phân tích chi tiết giao dịch
          const details = parseTransactionDetails(tx, address);

          return {
            signature: sig.signature,
            timestamp: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null,
            status: sig.err ? 'thất bại' : 'thành công',
            error: sig.err,
            slot: sig.slot,
            fee: tx?.meta?.fee || 0,
            amount: details.amount,
            sender: details.sender,
            receiver: details.receiver,
            type: details.type,
            transaction: tx
          };
        } catch (err) {
          console.error(`Lỗi khi lấy giao dịch ${sig.signature}:`, err);
          return {
            signature: sig.signature,
            timestamp: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null,
            status: 'lỗi khi lấy thông tin',
            slot: sig.slot,
            error: err.message,
            amount: 0,
            sender: 'không xác định',
            receiver: 'không xác định',
            type: 'không xác định'
          };
        }
      })
    );
    
    return transactions;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách giao dịch của ví:', error);
    throw error;
  }
}

module.exports = {
  getTransaction,
  checkTransactionStatus,
  getBalance,
  getTokenAccounts,
  getWalletTransactions,
  connection
}; 