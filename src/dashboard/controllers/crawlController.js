const moment = require('moment');
const { getRateLimitState, fetchTweetsFromAccount, fetchTweetsFromHashtag, CRYPTO_ACCOUNTS, CRYPTO_HASHTAGS } = require('../../twitter-crawler/twitter-crawler');
const { connectToMongoDB } = require('../../twitter-crawler/twitter-crawler');

// Hiển thị trang crawl
exports.getCrawlPage = async (req, res) => {
  const rateLimitState = getRateLimitState();
  
  try {
    // Kết nối MongoDB
    const mongoClient = await connectToMongoDB();
    const db = mongoClient.db('crypto_news');
    
    // Lấy thống kê mới nhất
    const stats = await db.collection('stats').findOne({ _id: 'latest' });
    
    // Lấy lịch sử crawl
    const crawlHistory = await db.collection('crawl_history')
      .find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    
    await mongoClient.close();
    
    res.render('crawl', {
      title: 'Twitter Crawler',
      rateLimitState,
      stats,
      crawlHistory,
      accounts: CRYPTO_ACCOUNTS,
      hashtags: CRYPTO_HASHTAGS,
      moment
    });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu cho trang crawl:', error);
    res.render('error', {
      title: 'Lỗi',
      error: 'Không thể kết nối đến database. Vui lòng thử lại sau.'
    });
  }
};

// Thực hiện crawl một tài khoản
exports.crawlAccount = async (req, res) => {
  const { username } = req.body;
  const maxResults = parseInt(req.body.maxResults) || 10;
  
  try {
    // Kết nối MongoDB
    const mongoClient = await connectToMongoDB();
    
    // Thực hiện crawl
    const result = await fetchTweetsFromAccount(mongoClient, username, maxResults);
    
    // Lưu lịch sử crawl
    const crawlHistory = {
      type: 'account',
      target: username,
      timestamp: new Date(),
      success: result.success,
      count: result.count || 0,
      error: result.error || null
    };
    
    await mongoClient.db('crypto_news').collection('crawl_history').insertOne(crawlHistory);
    await mongoClient.close();
    
    if (result.success) {
      req.flash('success', `Đã crawl thành công ${result.count} tweets từ tài khoản @${username}`);
    } else {
      req.flash('error', `Lỗi khi crawl từ tài khoản @${username}: ${result.error}`);
    }
    
    res.redirect('/dashboard/crawl');
  } catch (error) {
    console.error('Lỗi khi crawl tài khoản:', error);
    req.flash('error', `Lỗi: ${error.message}`);
    res.redirect('/dashboard/crawl');
  }
};

// Thực hiện crawl một hashtag
exports.crawlHashtag = async (req, res) => {
  const { hashtag } = req.body;
  const maxResults = parseInt(req.body.maxResults) || 10;
  
  try {
    // Kết nối MongoDB
    const mongoClient = await connectToMongoDB();
    
    // Thực hiện crawl
    const result = await fetchTweetsFromHashtag(mongoClient, hashtag, maxResults);
    
    // Lưu lịch sử crawl
    const crawlHistory = {
      type: 'hashtag',
      target: hashtag,
      timestamp: new Date(),
      success: result.success,
      count: result.count || 0,
      error: result.error || null
    };
    
    await mongoClient.db('crypto_news').collection('crawl_history').insertOne(crawlHistory);
    await mongoClient.close();
    
    if (result.success) {
      req.flash('success', `Đã crawl thành công ${result.count} tweets với hashtag #${hashtag}`);
    } else {
      req.flash('error', `Lỗi khi crawl hashtag #${hashtag}: ${result.error}`);
    }
    
    res.redirect('/dashboard/crawl');
  } catch (error) {
    console.error('Lỗi khi crawl hashtag:', error);
    req.flash('error', `Lỗi: ${error.message}`);
    res.redirect('/dashboard/crawl');
  }
}; 