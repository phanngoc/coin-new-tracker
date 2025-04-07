/**
 * Dashboard Controller
 * 
 * Xử lý các yêu cầu hiển thị dữ liệu từ MongoDB
 */

const Tweet = require('../../twitter-crawler/models/Tweet');
const moment = require('moment');

// Trang chủ dashboard
exports.getHomePage = async (req, res) => {
  try {
    // Lấy thống kê top 10 coin được đề cập nhiều nhất
    const topCoins = await Tweet.getTopCoinsWithTweetCount(10);
    
    // Lấy tổng số tweets đã thu thập
    await Tweet.initialize();
    const totalTweets = await Tweet.collection.countDocuments();
    
    // Lấy tweets mới nhất
    const latestTweets = await Tweet.collection.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    res.render('home', {
      title: 'Crypto Twitter Analytics Dashboard',
      topCoins: topCoins,
      totalTweets: totalTweets,
      latestTweets: latestTweets,
      moment: moment
    });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu trang chủ:', error);
    res.status(500).render('error', {
      title: 'Lỗi server',
      error: 'Không thể tải dữ liệu từ database.'
    });
  }
};

// Hiển thị tweets theo coin
exports.getTweetsByCoin = async (req, res) => {
  try {
    const coin = req.params.coin.toUpperCase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Lấy tweets liên quan đến coin
    const tweets = await Tweet.getTweetsByCoins([coin], limit, skip);
    
    // Đếm tổng số tweets của coin này
    await Tweet.initialize();
    const totalTweets = await Tweet.collection.countDocuments({ coins: coin });
    
    // Tính toán phân trang
    const totalPages = Math.ceil(totalTweets / limit);
    
    res.render('tweets-by-coin', {
      title: `Tweets về ${coin}`,
      coin: coin,
      tweets: tweets,
      currentPage: page,
      totalPages: totalPages,
      totalTweets: totalTweets,
      moment: moment
    });
  } catch (error) {
    console.error(`Lỗi khi lấy tweets cho coin ${req.params.coin}:`, error);
    res.status(500).render('error', {
      title: 'Lỗi server',
      error: 'Không thể tải dữ liệu tweets.'
    });
  }
};

// Hiển thị tweets theo tài khoản
exports.getTweetsByAccount = async (req, res) => {
  try {
    const username = req.params.username;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Lấy tweets từ tài khoản cụ thể
    const tweets = await Tweet.getTweetsByUser(username, limit, skip);
    
    // Đếm tổng số tweets từ tài khoản này
    await Tweet.initialize();
    const totalTweets = await Tweet.collection.countDocuments({ username });
    
    // Tính toán phân trang
    const totalPages = Math.ceil(totalTweets / limit);
    
    res.render('tweets-by-account', {
      title: `Tweets từ @${username}`,
      username: username,
      tweets: tweets,
      currentPage: page,
      totalPages: totalPages,
      totalTweets: totalTweets,
      moment: moment
    });
  } catch (error) {
    console.error(`Lỗi khi lấy tweets cho tài khoản @${req.params.username}:`, error);
    res.status(500).render('error', {
      title: 'Lỗi server',
      error: 'Không thể tải dữ liệu tweets.'
    });
  }
};

// Hiển thị tweets theo hashtag
exports.getTweetsByHashtag = async (req, res) => {
  try {
    const hashtag = req.params.hashtag;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Lấy tweets có hashtag cụ thể
    const tweets = await Tweet.getTweetsByHashtag(hashtag, limit, skip);
    
    // Đếm tổng số tweets có hashtag này
    await Tweet.initialize();
    const totalTweets = await Tweet.collection.countDocuments({ hashtags: hashtag });
    
    // Tính toán phân trang
    const totalPages = Math.ceil(totalTweets / limit);
    
    res.render('tweets-by-hashtag', {
      title: `Tweets với #${hashtag}`,
      hashtag: hashtag,
      tweets: tweets,
      currentPage: page,
      totalPages: totalPages,
      totalTweets: totalTweets,
      moment: moment
    });
  } catch (error) {
    console.error(`Lỗi khi lấy tweets cho hashtag #${req.params.hashtag}:`, error);
    res.status(500).render('error', {
      title: 'Lỗi server',
      error: 'Không thể tải dữ liệu tweets.'
    });
  }
};

// Trang tìm kiếm
exports.getSearchPage = (req, res) => {
  res.render('search', {
    title: 'Tìm kiếm tweets',
    results: null,
    query: '',
    searchType: 'text',
    moment: moment
  });
};

// Xử lý tìm kiếm
exports.searchTweets = async (req, res) => {
  try {
    const searchQuery = req.body.query;
    const searchType = req.body.type || 'text';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    await Tweet.initialize();
    
    let query = {};
    let totalResults = 0;
    let results = [];
    
    if (searchType === 'text') {
      // Tìm kiếm trong nội dung tweet
      query = { text: { $regex: searchQuery, $options: 'i' } };
    } else if (searchType === 'coin') {
      // Tìm kiếm theo coin
      query = { coins: searchQuery.toUpperCase() };
    } else if (searchType === 'username') {
      // Tìm kiếm theo username
      query = { username: { $regex: searchQuery, $options: 'i' } };
    } else if (searchType === 'hashtag') {
      // Tìm kiếm theo hashtag
      query = { hashtags: searchQuery.toLowerCase() };
    }
    
    // Đếm tổng số kết quả
    totalResults = await Tweet.collection.countDocuments(query);
    
    // Lấy kết quả phân trang
    results = await Tweet.collection.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Tính toán phân trang
    const totalPages = Math.ceil(totalResults / limit);
    
    res.render('search', {
      title: 'Kết quả tìm kiếm',
      results: results,
      query: searchQuery,
      searchType: searchType,
      totalResults: totalResults,
      currentPage: page,
      totalPages: totalPages,
      moment: moment
    });
  } catch (error) {
    console.error('Lỗi khi tìm kiếm:', error);
    res.status(500).render('error', {
      title: 'Lỗi server',
      error: 'Không thể thực hiện tìm kiếm.'
    });
  }
};

// Hiển thị trang phân tích
exports.getAnalytics = async (req, res) => {
  try {
    // Khởi tạo Tweet collection
    await Tweet.initialize();
    
    // Lấy dữ liệu thống kê cho dashboard
    const [topCoins, topAccounts, emergingTrends] = await Promise.all([
      Tweet.getTopCoinsWithTweetCount(10),
      Tweet.getTopAccountsWithTweetCount(5), 
      Tweet.getEmergingHashtags(10)
    ]);
    
    // Dữ liệu tweet theo ngày (7 ngày gần nhất)
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    
    const dailyTweetCounts = await Tweet.getTweetCountsByDate(7);
    
    // Map dữ liệu theo ngày vào mảng
    const dailyTweets = {
      labels: last7Days.map(date => new Date(date).toLocaleDateString('vi-VN')),
      data: last7Days.map(date => {
        const found = dailyTweetCounts.find(item => item._id.split('T')[0] === date);
        return found ? found.count : 0;
      })
    };
    
    // Dữ liệu sentiment
    const sentimentData = {
      positive: last7Days.map(date => {
        const found = dailyTweetCounts.find(item => 
          item._id.split('T')[0] === date && item.sentiment === 'positive'
        );
        return found ? found.count : 0;
      }),
      negative: last7Days.map(date => {
        const found = dailyTweetCounts.find(item => 
          item._id.split('T')[0] === date && item.sentiment === 'negative'
        );
        return found ? found.count : 0;
      }),
      neutral: last7Days.map(date => {
        const found = dailyTweetCounts.find(item => 
          item._id.split('T')[0] === date && 
          (item.sentiment === 'neutral' || !item.sentiment)
        );
        return found ? found.count : 0;
      })
    };
    
    // Tính trung bình sentiment 
    const totalPositive = sentimentData.positive.reduce((a, b) => a + b, 0);
    const totalNegative = sentimentData.negative.reduce((a, b) => a + b, 0);
    const totalNeutral = sentimentData.neutral.reduce((a, b) => a + b, 0);
    const total = totalPositive + totalNegative + totalNeutral;
    
    // Chỉ số cảm xúc thị trường (market sentiment) với ML 
    let marketSentiment = 50; // Giá trị mặc định
    if (total > 0) {
        // Áp dụng công thức tính điểm sentiment cải tiến với trọng số
        // Positive: +1, Negative: -1, Neutral: +0, có nhân thêm trọng số để cải thiện độ chính xác
        marketSentiment = Math.round(((totalPositive * 1.2 - totalNegative * 1.1) / (total * 1.1)) * 50 + 50);
    }
    
    // Giới hạn trong khoảng 0-100
    marketSentiment = Math.max(0, Math.min(100, marketSentiment));
    
    let marketStatus = 'Trung lập';
    let marketClass = 'text-warning';
    
    // Phân loại cảm xúc thị trường chi tiết hơn dựa trên ML sentiment
    if (marketSentiment >= 75) {
        marketStatus = 'Tham lam cực độ';
        marketClass = 'text-success';
    } else if (marketSentiment >= 60) {
        marketStatus = 'Tham lam';
        marketClass = 'text-success';
    } else if (marketSentiment >= 55) {
        marketStatus = 'Lạc quan nhẹ';
        marketClass = 'text-success';
    } else if (marketSentiment >= 45) {
        marketStatus = 'Trung lập';
        marketClass = 'text-warning';
    } else if (marketSentiment >= 40) {
        marketStatus = 'Lo ngại nhẹ';
        marketClass = 'text-danger';
    } else if (marketSentiment >= 25) {
        marketStatus = 'Sợ hãi';
        marketClass = 'text-danger';
    } else {
        marketStatus = 'Hoảng loạn cực độ';
        marketClass = 'text-danger';
    }
    
    // Tính xu hướng của coin qua các ngày
    const coinTrends = {};
    const coinTrendChanges = {};
    
    for (const coin of topCoins) {
      // Lấy số lượng tweet về coin trong 7 ngày qua 
      const trendData = await Tweet.getCoinMentionTrend(coin._id, 7);
      
      coinTrends[coin._id] = {
        mentions: last7Days.map(date => {
          const found = trendData.find(item => item._id.split('T')[0] === date);
          return found ? found.count : 0;
        })
      };
      
      // Tính % thay đổi xu hướng
      const today = coinTrends[coin._id].mentions[coinTrends[coin._id].mentions.length - 1] || 0;
      const yesterday = coinTrends[coin._id].mentions[coinTrends[coin._id].mentions.length - 2] || 0;
      
      let trendChange = 0;
      if (yesterday > 0) {
        trendChange = Math.round((today - yesterday) / yesterday * 100);
      } else if (today > 0) {
        trendChange = 100;
      }
      
      coinTrendChanges[coin._id] = {
        change: trendChange,
        class: trendChange > 0 ? 'text-success' : (trendChange < 0 ? 'text-danger' : 'text-muted')
      };
    }
    
    // Dữ liệu giá coin (giả lập)
    const priceChanges = {
      BTC: 2.4,
      ETH: 1.2,
      BNB: -0.8,
      SOL: 3.6,
      XRP: -1.2,
      ADA: 0.5,
      DOT: -0.3,
      DOGE: 1.8,
      SHIB: 4.2,
      AVAX: 2.7
    };
    
    // Màu sắc cho biến động giá
    const priceChangeColors = {};
    for (const [coin, change] of Object.entries(priceChanges)) {
      priceChangeColors[coin] = change > 0 ? 'text-success' : (change < 0 ? 'text-danger' : 'text-muted');
    }
    
    // Dữ liệu giá coin cho biểu đồ (giả lập - thực tế sẽ lấy từ API)
    const coinPriceData = {
      BTC: generateCoinPriceData(50000, 65000, 30),
      ETH: generateCoinPriceData(2800, 3500, 30),
      BNB: generateCoinPriceData(350, 450, 30),
      SOL: generateCoinPriceData(100, 150, 30)
    };
    
    res.render('analytics', {
      title: 'Phân tích Crypto Twitter',
      topCoins,
      topAccounts,
      emergingTrends,
      dailyTweets,
      sentimentData,
      marketSentiment,
      marketStatus,
      marketClass,
      coinTrends,
      coinTrendChanges,
      priceChanges,
      priceChangeColors,
      coinPriceData,
      moment
    });
  } catch (error) {
    console.error('Lỗi khi tải trang phân tích:', error);
    res.status(500).render('error', {
      title: 'Lỗi server',
      error: 'Không thể tải dữ liệu phân tích.'
    });
  }
};

// Hàm tạo dữ liệu giá coin cho biểu đồ (giả lập)
function generateCoinPriceData(min, max, days) {
  const data = [];
  let currentPrice = min + Math.random() * (max - min);
  
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - i - 1));
    
    const changePercent = (Math.random() - 0.5) * 0.02; // Biến động +/- 1%
    currentPrice = currentPrice * (1 + changePercent);
    currentPrice = Math.max(min * 0.9, Math.min(max * 1.1, currentPrice));
    
    const open = currentPrice;
    const close = open * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = Math.random() * 1000 + 500;
    
    data.push({
      time: date.toISOString().split('T')[0],
      open, high, low, close, volume
    });
  }
  
  return data;
}