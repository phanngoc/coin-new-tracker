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
    'TrustWallet',      // Trust Wallet
    'Uniswap',          // Uniswap
    'APompliano',       // Anthony Pompliano
    'binance',          // Binance Exchange
    'coinbase',         // Coinbase Exchange
    'Cointelegraph',    // Cointelegraph News
    'brian_armstrong',  // Coinbase CEO
  ],
  
  // Danh sách hashtags crypto để theo dõi
  hashtags: [
    'bitcoin',
    'ethereum',
    'crypto',
    'binancecoin',
    'xrp',
    'solana',
    'defi',
    'nft',
    'blockchain',
    'web3',
    'altcoins',
    'cryptotrading',
  ],
  
  // Từ khóa để lọc các trending topic liên quan đến crypto
  cryptoKeywords: [
    'bitcoin', 'btc', 'eth', 'ethereum', 'crypto', 'blockchain', 'defi',
    'nft', 'web3', 'altcoin', 'token', 'coin', 'mining', 'binance', 
    'coinbase', 'wallet', 'solana', 'cardano', 'ripple', 'exchange'
  ],
  
  // Cấu hình token API bổ sung để xoay vòng khi cần
  // Thêm access token vào đây nếu bạn có nhiều tài khoản Twitter API
  additionalApiTokens: [
    // Ví dụ format token bổ sung
    /* 
    {
      appKey: "YOUR_API_KEY_2",
      appSecret: "YOUR_API_SECRET_2", 
      accessToken: "YOUR_ACCESS_TOKEN_2",
      accessSecret: "YOUR_ACCESS_SECRET_2",
      bearerToken: "YOUR_BEARER_TOKEN_2"
    }
    */
  ],
  
  // Cấu hình về tần suất crawl
  crawlInterval: {
    accounts: 180 * 60 * 1000,   // 3 giờ cho crawl tài khoản
    hashtags: 240 * 60 * 1000,   // 4 giờ cho hashtags
    trending: 360 * 60 * 1000,   // 6 giờ cho trending topics
    search: 480 * 60 * 1000,     // 8 giờ cho search queries
  },
  
  // Cấu hình giới hạn crawl để tránh rate limit
  crawlLimits: {
    // Số lượng tweet tối đa cho mỗi tài khoản
    maxTweetsPerAccount: 7,
    // Số lượng tweet tối đa cho mỗi hashtag
    maxTweetsPerHashtag: 5,
    // Số lượng tài khoản xử lý đồng thời
    concurrentAccountLimit: 1,
    // Thời gian chờ giữa các yêu cầu API (ms)
    apiRequestDelay: 5000,
    // Thời gian chờ giữa các hashtag (ms)
    hashtagProcessingDelay: 45000,
    // Thời gian tối đa chờ khi bị rate limit (ms)
    maxRateLimitWait: 15 * 60 * 1000, // 15 phút
  },
  
  // Giới hạn token rate (có thể điều chỉnh dựa trên cấp độ Twitter API của bạn)
  rateLimit: {
    // Giới hạn yêu cầu API để tránh vượt quá
    requestsPerWindow: 100, // Giảm xuống 100 từ 150 để thêm bộ đệm an toàn
    // Thời gian reset (15 phút)
    windowMs: 15 * 60 * 1000,
    // Theo dõi riêng theo endpoint
    endpoints: {
      userTimeline: {
        requestsPerWindow: 75,
        windowMs: 15 * 60 * 1000,
      },
      search: {
        requestsPerWindow: 60,
        windowMs: 15 * 60 * 1000,
      },
      trending: {
        requestsPerWindow: 45,
        windowMs: 15 * 60 * 1000,
      }
    }
  }
};