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
 * Kiểm tra trạng thái giao dịch và trả về thông tin chi tiết
 * @param {string} signature - Chữ ký giao dịch
 * @returns {Promise<Object>} Trạng thái giao dịch chi tiết
 */
async function checkTransactionStatus(signature) {
  try {
    const status = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });

    // Nếu không tìm thấy giao dịch
    if (!status || !status.value) {
      return {
        exists: false,
        status: 'không tồn tại',
        confirmations: 0,
        confirmationStatus: null,
        err: null
      };
    }

    // Lấy thông tin trạng thái
    const { confirmations, confirmationStatus, err } = status.value;
    
    let transactionStatus = 'không xác định';
    
    // Xác định trạng thái giao dịch
    if (err) {
      transactionStatus = 'thất bại';
    } else if (confirmationStatus === 'finalized') {
      transactionStatus = 'hoàn tất';
    } else if (confirmationStatus === 'confirmed') {
      transactionStatus = 'xác nhận';
    } else if (confirmationStatus === 'processed') {
      transactionStatus = 'đang xử lý';
    } else if (!confirmationStatus) {
      transactionStatus = 'đang chờ';
    }

    return {
      exists: true,
      status: transactionStatus,
      confirmations: confirmations || 0,
      confirmationStatus: confirmationStatus || 'chưa xác nhận',
      err: err || null
    };
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
 * Lấy thông tin token từ mint address
 * @param {string} mintAddress - Địa chỉ mint của token
 * @returns {Promise<Object>} Thông tin token
 */
async function getTokenInfo(mintAddress) {
  try {
    const mint = new PublicKey(mintAddress);
    const tokenInfo = await connection.getParsedAccountInfo(mint);
    
    if (tokenInfo && tokenInfo.value && tokenInfo.value.data) {
      const parsedData = tokenInfo.value.data;
      
      // Nếu dữ liệu đã được phân tích
      if (parsedData.parsed) {
        return {
          mint: mintAddress,
          decimals: parsedData.parsed.info.decimals,
          supply: parsedData.parsed.info.supply,
          ...parsedData.parsed.info
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Lỗi khi lấy thông tin token:', error);
    return null;
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
      type: 'không xác định',
      token: null
    };
  }

  const { meta, transaction: tx } = transaction;
  let amount = 0;
  let sender = '';
  let receiver = '';
  let type = 'không xác định';
  let token = null;

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
        
        // Thử phân tích thông tin token từ instruction
        try {
          if (meta.postTokenBalances && meta.postTokenBalances.length > 0) {
            const tokenInfo = meta.postTokenBalances[0];
            token = {
              mint: tokenInfo.mint,
              decimals: tokenInfo.uiTokenAmount.decimals,
              amount: tokenInfo.uiTokenAmount.uiAmount
            };
          }
        } catch (err) {
          console.error('Lỗi khi phân tích thông tin token:', err);
        }
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
          token = {
            mint: tokenDetails.mint,
            decimals: tokenDetails.uiTokenAmount.decimals,
            amount: tokenDetails.uiTokenAmount.uiAmount
          };
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
    type,
    token
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
          
          // Lấy trạng thái giao dịch chi tiết
          const statusDetails = await checkTransactionStatus(sig.signature);
          
          // Phân tích chi tiết giao dịch
          const details = parseTransactionDetails(tx, address);

          return {
            signature: sig.signature,
            timestamp: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null,
            status: statusDetails.status,
            confirmations: statusDetails.confirmations,
            confirmationStatus: statusDetails.confirmationStatus,
            error: sig.err,
            slot: sig.slot,
            fee: tx?.meta?.fee || 0,
            amount: details.amount,
            sender: details.sender,
            receiver: details.receiver,
            type: details.type,
            token: details.token,
            transaction: tx
          };
        } catch (err) {
          console.error(`Lỗi khi lấy giao dịch ${sig.signature}:`, err);
          const statusDetails = await checkTransactionStatus(sig.signature);
          return {
            signature: sig.signature,
            timestamp: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null,
            status: statusDetails.status,
            confirmations: statusDetails.confirmations,
            confirmationStatus: statusDetails.confirmationStatus,
            slot: sig.slot,
            error: err.message,
            amount: 0,
            sender: 'không xác định',
            receiver: 'không xác định',
            type: 'không xác định',
            token: null
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

/**
 * Xác minh thông tin giao dịch
 * @param {string} signature - Chữ ký giao dịch
 * @param {Object} verifyParams - Các tham số xác minh
 * @returns {Promise<Object>} Kết quả xác minh
 */
async function verifyTransaction(signature, verifyParams) {
  try {
    // Lấy thông tin giao dịch
    const transaction = await getTransaction(signature);
    if (!transaction) {
      return {
        verified: false,
        reason: 'Không tìm thấy giao dịch',
        transaction: null
      };
    }

    // Lấy trạng thái giao dịch
    const statusDetails = await checkTransactionStatus(signature);
    if (statusDetails.status !== 'hoàn tất' && statusDetails.status !== 'xác nhận') {
      return {
        verified: false,
        reason: `Giao dịch chưa được xác nhận hoàn tất (${statusDetails.status})`,
        transaction,
        status: statusDetails
      };
    }

    // Phân tích chi tiết giao dịch
    const details = parseTransactionDetails(transaction, '');
    
    // Kết quả xác minh
    const result = {
      verified: true,
      transaction,
      details,
      status: statusDetails,
      checks: {}
    };

    // Xác minh người gửi nếu được chỉ định
    if (verifyParams.sender) {
      const senderMatch = details.sender.toLowerCase() === verifyParams.sender.toLowerCase();
      result.checks.sender = {
        verified: senderMatch,
        expected: verifyParams.sender,
        actual: details.sender
      };
      
      if (!senderMatch) {
        result.verified = false;
        result.reason = 'Người gửi không khớp';
      }
    }

    // Xác minh người nhận nếu được chỉ định
    if (verifyParams.receiver) {
      const receiverMatch = details.receiver.toLowerCase() === verifyParams.receiver.toLowerCase();
      result.checks.receiver = {
        verified: receiverMatch,
        expected: verifyParams.receiver,
        actual: details.receiver
      };
      
      if (!receiverMatch) {
        result.verified = false;
        result.reason = 'Người nhận không khớp';
      }
    }

    // Xác minh số lượng nếu được chỉ định
    if (verifyParams.amount) {
      // Chuyển đổi tham số số lượng thành số
      const expectedAmount = parseFloat(verifyParams.amount);
      // Sử dụng sai số nhỏ cho việc so sánh số thập phân
      const amountMatch = Math.abs(details.amount - expectedAmount) < 0.000001;
      
      result.checks.amount = {
        verified: amountMatch,
        expected: expectedAmount,
        actual: details.amount
      };
      
      if (!amountMatch) {
        result.verified = false;
        result.reason = 'Số lượng không khớp';
      }
    }

    // Xác minh loại token nếu được chỉ định
    if (verifyParams.tokenMint && details.token) {
      const tokenMatch = details.token.mint.toLowerCase() === verifyParams.tokenMint.toLowerCase();
      result.checks.token = {
        verified: tokenMatch,
        expected: verifyParams.tokenMint,
        actual: details.token.mint
      };
      
      if (!tokenMatch) {
        result.verified = false;
        result.reason = 'Loại token không khớp';
      }
      
      // Lấy thêm thông tin chi tiết về token
      const tokenInfo = await getTokenInfo(details.token.mint);
      if (tokenInfo) {
        result.tokenInfo = tokenInfo;
      }
    }

    return result;
  } catch (error) {
    console.error('Lỗi khi xác minh giao dịch:', error);
    return {
      verified: false,
      reason: `Lỗi khi xác minh: ${error.message}`,
      error: error.message
    };
  }
}

module.exports = {
  getTransaction,
  checkTransactionStatus,
  getBalance,
  getTokenAccounts,
  getWalletTransactions,
  verifyTransaction,
  getTokenInfo,
  connection
}; 