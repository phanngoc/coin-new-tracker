const { MongoClient, ObjectId } = require('mongodb');
const config = require('../config/twitterConfig');

class Tweet {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      this.client = new MongoClient(config.mongodb.uri);
      await this.client.connect();
      this.db = this.client.db();
      this.collection = this.db.collection('tweets');
      
      // Tạo indexes cho việc tìm kiếm hiệu quả
      await this.collection.createIndex({ tweetId: 1 }, { unique: true });
      await this.collection.createIndex({ createdAt: -1 });
      await this.collection.createIndex({ username: 1 });
      await this.collection.createIndex({ coins: 1 });
      await this.collection.createIndex({ hashtags: 1 });
      
      this.initialized = true;
      console.log('Tweet model initialized successfully');
    } catch (error) {
      console.error('Error initializing Tweet model:', error);
      throw error;
    }
  }

  async saveTweet(tweetData) {
    await this.initialize();
    
    // Kiểm tra xem tweet đã tồn tại chưa
    const existingTweet = await this.collection.findOne({ tweetId: tweetData.tweetId });
    if (existingTweet) {
      return existingTweet;
    }
    
    // Thêm các trường metadata
    const tweet = {
      ...tweetData,
      processedAt: new Date(),
      coins: tweetData.coins || [],
      sentiment: tweetData.sentiment || 'neutral',
    };
    
    const result = await this.collection.insertOne(tweet);
    return { ...tweet, _id: result.insertedId };
  }

  async getTweetsByCoins(coinSymbols, limit = 100, skip = 0) {
    await this.initialize();
    
    return this.collection.find({
      coins: { $in: coinSymbols },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async getTweetsByUser(username, limit = 100, skip = 0) {
    await this.initialize();
    
    return this.collection.find({ username })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async getTweetsByHashtag(hashtag, limit = 100, skip = 0) {
    await this.initialize();
    
    return this.collection.find({ 
      hashtags: hashtag 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async getTopCoinsWithTweetCount(limit = 10) {
    await this.initialize();
    
    return this.collection.aggregate([
      { $unwind: '$coins' },
      { $group: { 
        _id: '$coins', 
        count: { $sum: 1 },
        positiveTweets: { 
          $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] } 
        },
        negativeTweets: { 
          $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] } 
        },
      }},
      { $sort: { count: -1 } },
      { $limit: limit }
    ]).toArray();
  }
  
  async getTopAccountsWithTweetCount(limit = 5) {
    await this.initialize();
    
    return this.collection.aggregate([
      { $group: { 
        _id: '$username', 
        count: { $sum: 1 },
        positiveTweets: { 
          $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] } 
        },
        negativeTweets: { 
          $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] } 
        }
      }},
      { $sort: { count: -1 } },
      { $limit: limit }
    ]).toArray();
  }
  
  async getEmergingHashtags(limit = 10) {
    await this.initialize();
    
    // Lấy hashtags từ tweets trong 48 giờ qua
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
    
    return this.collection.aggregate([
      { $match: { createdAt: { $gte: twoDaysAgo } } },
      { $unwind: '$hashtags' },
      { $group: { _id: '$hashtags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]).toArray();
  }
  
  async getTweetCountsByDate(days = 7) {
    await this.initialize();
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    return this.collection.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { 
        $group: { 
          _id: { 
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            sentiment: '$sentiment'
          },
          count: { $sum: 1 }
        }
      },
      { 
        $project: { 
          _id: '$_id.date',
          sentiment: '$_id.sentiment',
          count: 1
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
  }
  
  async getCoinMentionTrend(coinSymbol, days = 7) {
    await this.initialize();
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    return this.collection.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate },
          coins: coinSymbol
        }
      },
      { 
        $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          positiveTweets: { 
            $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] } 
          },
          negativeTweets: { 
            $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] } 
          }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.initialized = false;
    }
  }
}

module.exports = new Tweet(); 