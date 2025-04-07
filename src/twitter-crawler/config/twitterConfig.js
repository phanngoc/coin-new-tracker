/**
 * Twitter API Configuration
 */
module.exports = {
  // Twitter API v2 credentials
  twitter: {
    apiKey: process.env.TWITTER_API_KEY,
    apiKeySecret: process.env.TWITTER_API_KEY_SECRET,
    bearerToken: process.env.TWITTER_BEARER_TOKEN,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  },
  
  // MongoDB connection string
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_news',
  },
  
  // Danh sách các tài khoản crypto KOLs và tin tức để theo dõi
  accounts: [
    'cz_binance',       // Changpeng Zhao (Binance CEO)
    'SBF_FTX',          // Sam Bankman-Fried (FTX CEO)
    'VitalikButerin',   // Vitalik Buterin (Ethereum)
    'elonmusk',         // Elon Musk 
    'CoinDesk',         // CoinDesk
  ],
  
  // Danh sách hashtags crypto để theo dõi
  hashtags: [
    'bitcoin',
    'ethereum',
    'crypto',
    'binancecoin',
    'xrp',
    'solana',
  ],
  
  // Cấu hình về tần suất crawl
  crawlInterval: {
    accounts: 120 * 60 * 1000, // Tăng lên 120 phút
    hashtags: 4 * 60 * 60 * 1000, // Tăng lên 4 giờ
  },
  
  // Cấu hình giới hạn crawl để tránh rate limit
  crawlLimits: {
    // Số lượng tweet tối đa cho mỗi tài khoản
    maxTweetsPerAccount: 10,
    // Số lượng tweet tối đa cho mỗi hashtag
    maxTweetsPerHashtag: 5,
    // Số lượng tài khoản xử lý đồng thời
    concurrentAccountLimit: 1,
    // Thời gian chờ giữa các yêu cầu API (ms)
    apiRequestDelay: 3000,
    // Thời gian chờ giữa các hashtag (ms)
    hashtagProcessingDelay: 30000,
  },
  
  // Giới hạn token rate (có thể điều chỉnh dựa trên cấp độ Twitter API của bạn)
  rateLimit: {
    // Giảm giới hạn yêu cầu API để tránh vượt quá
    requestsPerWindow: 150,
    // Thời gian reset (15 phút)
    windowMs: 15 * 60 * 1000
  }
}; 