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

// Hiển thị trang phân tích chi tiết cho một coin cụ thể
exports.getCoinAnalysis = async (req, res) => {
  try {
    const coin = req.params.coin.toUpperCase();
    await Tweet.initialize();
    
    // Lấy dữ liệu phân tích cho coin trong 30 ngày qua
    const last30Days = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    
    // --- Lấy dữ liệu về coin ---
    
    // 1. Số lượng tweets về coin theo ngày
    const coinTweetsByDay = await Tweet.getCoinMentionTrend(coin, 30);
    
    // Map dữ liệu theo ngày vào mảng
    const dailyMentionsData = {
      labels: last30Days.map(date => new Date(date).toLocaleDateString('vi-VN')),
      data: last30Days.map(date => {
        const found = coinTweetsByDay.find(item => item._id.split('T')[0] === date);
        return found ? found.count : 0;
      })
    };
    
    // 2. Phân tích sentiment của coin theo ngày
    const coinSentimentByDay = await Tweet.getCoinSentimentTrend(coin, 30);
    
    const sentimentData = {
      positive: last30Days.map(date => {
        const found = coinSentimentByDay.find(item => 
          item._id.split('T')[0] === date && item.sentiment === 'positive'
        );
        return found ? found.count : 0;
      }),
      negative: last30Days.map(date => {
        const found = coinSentimentByDay.find(item => 
          item._id.split('T')[0] === date && item.sentiment === 'negative'
        );
        return found ? found.count : 0;
      }),
      neutral: last30Days.map(date => {
        const found = coinSentimentByDay.find(item => 
          item._id.split('T')[0] === date && 
          (item.sentiment === 'neutral' || !item.sentiment)
        );
        return found ? found.count : 0;
      })
    };
    
    // Tính chỉ số sentiment của coin
    const totalPositive = sentimentData.positive.reduce((a, b) => a + b, 0);
    const totalNegative = sentimentData.negative.reduce((a, b) => a + b, 0);
    const totalNeutral = sentimentData.neutral.reduce((a, b) => a + b, 0);
    const total = totalPositive + totalNegative + totalNeutral;
    
    // Chỉ số cảm xúc coin (coin sentiment)
    let coinSentiment = 50; // Giá trị mặc định
    if (total > 0) {
      // Áp dụng công thức tính điểm sentiment
      coinSentiment = Math.round(((totalPositive * 1.2 - totalNegative * 1.1) / (total * 1.1)) * 50 + 50);
    }
    
    // Giới hạn trong khoảng 0-100
    coinSentiment = Math.max(0, Math.min(100, coinSentiment));
    
    let coinSentimentStatus = 'Trung lập';
    let coinSentimentClass = 'text-warning';
    
    // Phân loại cảm xúc
    if (coinSentiment >= 75) {
      coinSentimentStatus = 'Rất tích cực';
      coinSentimentClass = 'text-success';
    } else if (coinSentiment >= 60) {
      coinSentimentStatus = 'Tích cực';
      coinSentimentClass = 'text-success';
    } else if (coinSentiment >= 55) {
      coinSentimentStatus = 'Hơi tích cực';
      coinSentimentClass = 'text-success';
    } else if (coinSentiment >= 45) {
      coinSentimentStatus = 'Trung lập';
      coinSentimentClass = 'text-warning';
    } else if (coinSentiment >= 40) {
      coinSentimentStatus = 'Hơi tiêu cực';
      coinSentimentClass = 'text-danger';
    } else if (coinSentiment >= 25) {
      coinSentimentStatus = 'Tiêu cực';
      coinSentimentClass = 'text-danger';
    } else {
      coinSentimentStatus = 'Rất tiêu cực';
      coinSentimentClass = 'text-danger';
    }
    
    // 3. Top tài khoản đề cập nhiều nhất về coin
    const topInfluencers = await Tweet.getTopAccountsForCoin(coin, 10);
    
    // 4. Top hashtags liên quan đến coin
    const relatedHashtags = await Tweet.getRelatedHashtagsForCoin(coin, 10);
    
    // 5. Lấy giá coin (giả lập)
    const priceRange = getPriceRange(coin);
    const coinPriceData = generateCoinPriceData(priceRange.min, priceRange.max, 30);
    
    // 6. Phân tích xu hướng giá
    const priceData = coinPriceData.map(d => d.close);
    const priceChange = {
      day: calculatePercentChange(priceData, 1),
      week: calculatePercentChange(priceData, 7),
      month: calculatePercentChange(priceData, 30),
    };
    
    // 7. So sánh giá với sentiment
    const priceChanges = last30Days.map((_, i) => {
      if (i === 0) return 0;
      const previousPrice = coinPriceData[i-1]?.close || 0;
      const currentPrice = coinPriceData[i]?.close || 0;
      if (previousPrice === 0) return 0;
      return ((currentPrice - previousPrice) / previousPrice) * 100;
    });
    
    // 8. Tính chỉ số tương quan giữa sentiment và giá
    const sentimentValues = last30Days.map((date, i) => {
      const positive = sentimentData.positive[i] || 0;
      const negative = sentimentData.negative[i] || 0;
      const neutral = sentimentData.neutral[i] || 0;
      const total = positive + negative + neutral;
      if (total === 0) return 50;
      return ((positive - negative) / total) * 50 + 50;
    });
    
    const correlation = calculateCorrelation(sentimentValues.slice(1), priceChanges.slice(1));
    
    // 9. Lấy 10 tweets gần đây nhất về coin
    const recentTweets = await Tweet.getRecentTweetsForCoin(coin, 10);
    
    // 10. Đề xuất giao dịch dựa trên sentiment và xu hướng
    let tradingSuggestion = 'HOLD';
    let tradingSuggestionReason = 'Thị trường ổn định, chưa có tín hiệu rõ ràng.';
    let tradingSignalClass = 'text-warning';
    
    // Phân tích tín hiệu dựa trên sentiment và xu hướng giá
    if (coinSentiment >= 70 && priceChange.week > 0) {
      tradingSuggestion = 'BUY';
      tradingSuggestionReason = 'Sentiment tích cực mạnh và xu hướng giá tăng.';
      tradingSignalClass = 'text-success';
    } else if (coinSentiment <= 30 && priceChange.week < 0) {
      tradingSuggestion = 'SELL';
      tradingSuggestionReason = 'Sentiment tiêu cực và xu hướng giá giảm.';
      tradingSignalClass = 'text-danger';
    } else if (coinSentiment >= 60 && priceChange.day < 0) {
      tradingSuggestion = 'BUY DIP';
      tradingSuggestionReason = 'Sentiment tích cực nhưng giá giảm ngắn hạn, có thể là cơ hội mua.';
      tradingSignalClass = 'text-primary';
    } else if (coinSentiment <= 40 && priceChange.day > 5) {
      tradingSuggestion = 'TAKE PROFIT';
      tradingSuggestionReason = 'Sentiment đang tiêu cực nhưng giá tăng mạnh, có thể chốt lời.';
      tradingSignalClass = 'text-danger';
    }

    // Render trang phân tích coin
    res.render('coin-analysis', {
      title: `Phân tích ${coin}`,
      coin: coin,
      dailyMentionsData,
      sentimentData,
      coinSentiment,
      coinSentimentStatus,
      coinSentimentClass,
      topInfluencers,
      relatedHashtags,
      coinPriceData,
      priceChange,
      correlation,
      recentTweets,
      tradingSuggestion,
      tradingSuggestionReason,
      tradingSignalClass,
      moment
    });
  } catch (error) {
    console.error(`Lỗi khi tải trang phân tích coin ${req.params.coin}:`, error);
    res.status(500).render('error', {
      title: 'Lỗi server',
      error: 'Không thể tải dữ liệu phân tích coin.'
    });
  }
};

// Hàm tính % thay đổi
function calculatePercentChange(data, period) {
  if (!data || data.length < period || data[data.length - period] === 0) {
    return 0;
  }
  return ((data[data.length - 1] - data[data.length - period - 1]) / data[data.length - period - 1]) * 100;
}

// Hàm tính hệ số tương quan Pearson
function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length === 0) {
    return 0;
  }
  
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) {
    return 0;
  }
  
  return numerator / denominator;
}

// Giá mặc định cho một số coin phổ biến
function getPriceRange(coin) {
  const ranges = {
    BTC: { min: 50000, max: 65000 },
    ETH: { min: 2800, max: 3500 },
    BNB: { min: 350, max: 450 },
    SOL: { min: 100, max: 150 },
    XRP: { min: 0.5, max: 0.7 },
    ADA: { min: 0.3, max: 0.5 },
    DOT: { min: 5, max: 7 },
    DOGE: { min: 0.08, max: 0.12 },
    SHIB: { min: 0.00001, max: 0.00002 },
    AVAX: { min: 25, max: 35 }
  };
  
  return ranges[coin] || { min: 10, max: 100 };
}