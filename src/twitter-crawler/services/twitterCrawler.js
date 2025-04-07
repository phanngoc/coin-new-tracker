const { TwitterApi } = require('twitter-api-v2');
const config = require('../config/twitterConfig');
const Tweet = require('../models/Tweet');
const { analyzeTweet } = require('../utils/coinDetector');
const rateLimitTracker = require('../utils/rateLimitTracker');
const { CronJob } = require('cron');

// Thêm hàm trì hoãn
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class TwitterCrawler {
  constructor() {
    // Khởi tạo Twitter client với thông tin xác thực
    this.twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_KEY_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });
    
    // Lấy client chỉ đọc (sử dụng bearer token)
    this.readOnlyClient = this.twitterClient.readOnly;

    // Khởi tạo cron jobs
    this.accountsCronJob = null;
    this.hashtagsCronJob = null;
    
    // Cấu hình cơ chế thử lại
    this.retryConfig = {
      maxRetries: 5,
      initialDelay: 10000, // 10 giây
      maxDelay: 5 * 60 * 1000, // 5 phút
    };
    
    // Biến theo dõi tiến trình hiện tại
    this.isProcessingAccounts = false;
    this.isProcessingHashtags = false;
  }

  /**
   * Bắt đầu các cronjob để crawl dữ liệu
   */
  startCronJobs() {
    // Cron job để crawl tweets từ tài khoản (mỗi giờ)
    this.accountsCronJob = new CronJob('0 */1 * * *', async () => {
      console.log('Running account crawler job...');
      if (this.isProcessingAccounts) {
        console.log('Previous account crawling job still running, skipping...');
        return;
      }
      
      try {
        this.isProcessingAccounts = true;
        await this.crawlAccountTweets();
      } catch (error) {
        console.error('Error in account crawler job:', error);
      } finally {
        this.isProcessingAccounts = false;
      }
    });

    // Cron job để crawl tweets từ hashtag (mỗi 2 giờ)
    this.hashtagsCronJob = new CronJob('0 */2 * * *', async () => {
      console.log('Running hashtag crawler job...');
      if (this.isProcessingHashtags) {
        console.log('Previous hashtag crawling job still running, skipping...');
        return;
      }
      
      try {
        this.isProcessingHashtags = true;
        await this.crawlHashtagTweets();
      } catch (error) {
        console.error('Error in hashtag crawler job:', error);
      } finally {
        this.isProcessingHashtags = false;
      }
    });

    // Bắt đầu các cronjob
    this.accountsCronJob.start();
    this.hashtagsCronJob.start();
    
    console.log('Twitter crawler cron jobs started');
  }

  /**
   * Kiểm tra tình trạng giới hạn và chờ nếu cần
   * @returns {Promise<boolean>} - true nếu có thể tiếp tục
   */
  async checkRateLimit() {
    if (!rateLimitTracker.canMakeRequest()) {
      const waitTime = rateLimitTracker.getWaitTime();
      console.log(`Rate limit reached, waiting for ${Math.round(waitTime/1000)} seconds...`);
      await delay(waitTime);
      
      // Kiểm tra lại sau khi đợi
      if (!rateLimitTracker.canMakeRequest()) {
        console.log('Still rate limited after waiting, will try again later');
        return false;
      }
    }
    
    // Đánh dấu đã sử dụng một yêu cầu
    rateLimitTracker.trackRequest();
    return true;
  }

  /**
   * Thực hiện API call với cơ chế thử lại khi gặp lỗi rate limit
   * @param {Function} apiCallFn - Hàm API call cần thực hiện
   * @returns {Promise} - Kết quả từ API call
   */
  async withRetry(apiCallFn) {
    let retries = 0;
    
    while (retries <= this.retryConfig.maxRetries) {
      try {
        // Kiểm tra rate limit trước khi gọi API
        if (!(await this.checkRateLimit())) {
          // Nếu vẫn bị giới hạn sau khi đợi, tăng số lần thử và đợi thêm
          const waitTime = Math.min(
            this.retryConfig.maxDelay,
            this.retryConfig.initialDelay * Math.pow(2, retries)
          );
          console.log(`Rate limit still active, retrying after ${Math.round(waitTime/1000)} seconds... (${retries + 1}/${this.retryConfig.maxRetries + 1})`);
          await delay(waitTime);
          retries++;
          continue;
        }
        
        // Thực hiện API call
        const result = await apiCallFn();
        
        // Cập nhật thông tin rate limit từ response nếu có
        if (result && result._headers) {
          rateLimitTracker.updateFromResponseHeaders(result._headers);
        }
        
        return result;
      } catch (error) {
        // Nếu là lỗi rate limit (429)
        if (error.code === 429) {
          // Cập nhật thông tin giới hạn từ response
          if (error.rateLimit) {
            rateLimitTracker.updateFromResponseHeaders({
              'x-rate-limit-remaining': '0',
              'x-rate-limit-reset': error.rateLimit.reset
            });
          }
          
          // Lấy thời gian chờ từ header nếu có, hoặc tính toán dựa trên số lần thử
          let waitTime = error.rateLimit?.reset ? 
            (error.rateLimit.reset * 1000 - Date.now() + 1000) : // Chuyển đổi sang ms và thêm 1 giây buffer
            Math.min(
              this.retryConfig.maxDelay,
              this.retryConfig.initialDelay * Math.pow(2, retries)
            );
          
          console.log(`Rate limit exceeded. Retrying after ${Math.round(waitTime/1000)} seconds... (${retries + 1}/${this.retryConfig.maxRetries + 1})`);
          
          // Đợi theo thời gian tính toán
          await delay(waitTime);
          retries++;
        } else {
          // Nếu là lỗi khác thì throw luôn
          throw error;
        }
      }
    }
    
    throw new Error(`Failed after ${this.retryConfig.maxRetries} retries due to rate limits`);
  }

  /**
   * Dừng các cronjob
   */
  stopCronJobs() {
    if (this.accountsCronJob) {
      this.accountsCronJob.stop();
    }
    
    if (this.hashtagsCronJob) {
      this.hashtagsCronJob.stop();
    }
    
    console.log('Twitter crawler cron jobs stopped');
  }

  /**
   * Crawl tweets từ danh sách tài khoản đã cấu hình
   */
  async crawlAccountTweets() {
    console.log('Crawling tweets from configured accounts...');
    
    // Chia nhỏ danh sách tài khoản thành các nhóm và xử lý tuần tự
    const chunkSize = config.crawlLimits.concurrentAccountLimit; // Xử lý đồng thời theo cấu hình
    const accountChunks = [];
    
    for (let i = 0; i < config.accounts.length; i += chunkSize) {
      accountChunks.push(config.accounts.slice(i, i + chunkSize));
    }
    
    for (const chunk of accountChunks) {
      await Promise.all(chunk.map(username => this.crawlAccountTweetsForUser(username)));
      // Đợi một khoảng thời gian giữa các nhóm
      await delay(config.crawlLimits.apiRequestDelay * 10);
    }
    
    // In ra tình trạng rate limit sau khi hoàn thành
    console.log('Rate limit status after account crawling:', rateLimitTracker.getStatus());
  }
  
  /**
   * Crawl tweets cho một tài khoản cụ thể
   * @param {string} username - Tên tài khoản Twitter
   */
  async crawlAccountTweetsForUser(username) {
    try {
      console.log(`Crawling tweets from @${username}...`);
      
      // Tìm user ID từ username với cơ chế thử lại
      const user = await this.withRetry(() => 
        this.readOnlyClient.v2.userByUsername(username)
      );
      
      if (!user.data) {
        console.warn(`User not found: @${username}`);
        return;
      }
      
      // Lấy timeline của user với cơ chế thử lại
      const timeline = await this.withRetry(() => 
        this.readOnlyClient.v2.userTimeline(user.data.id, {
          max_results: config.crawlLimits.maxTweetsPerAccount, // Số lượng từ cấu hình
          'tweet.fields': 'created_at,public_metrics,entities',
          expansions: 'author_id',
          'user.fields': 'name,username,profile_image_url',
        })
      );
      
      // Xử lý và lưu trữ tweets
      let count = 0;
      for await (const tweet of timeline) {
        await this.processTweet(tweet, username);
        count++;
        
        // Thêm độ trễ nhỏ giữa các lần xử lý tweet để giảm tải
        if (count % 5 === 0) {
          await delay(config.crawlLimits.apiRequestDelay);
        }
      }
      
      console.log(`Processed ${count} tweets from @${username}`);
    } catch (error) {
      console.error(`Error crawling tweets from @${username}:`, error);
    }
  }

  /**
   * Crawl tweets dựa trên các hashtag đã cấu hình
   */
  async crawlHashtagTweets() {
    console.log('Crawling tweets from hashtags...');
    
    // Phân phối crawling hashtag theo thời gian
    for (const hashtag of config.hashtags) {
      try {
        console.log(`Crawling tweets with hashtag #${hashtag}...`);
        
        // Tìm kiếm tweets với hashtag, sử dụng cơ chế thử lại
        const searchResults = await this.withRetry(() => 
          this.readOnlyClient.v2.search(`#${hashtag}`, {
            max_results: config.crawlLimits.maxTweetsPerHashtag, // Số lượng từ cấu hình
            'tweet.fields': 'created_at,public_metrics,entities',
            expansions: 'author_id',
            'user.fields': 'name,username,profile_image_url',
          })
        );
        
        // Xử lý và lưu trữ tweets
        let count = 0;
        for await (const tweet of searchResults) {
          await this.processTweet(tweet);
          count++;
          
          // Thêm độ trễ giữa các tweets để tránh rate limit
          if (count % 5 === 0) {
            await delay(config.crawlLimits.apiRequestDelay);
          }
        }
        
        console.log(`Processed ${count} tweets with hashtag #${hashtag}`);
        
        // Đợi giữa các hashtag để tránh rate limit
        await delay(config.crawlLimits.hashtagProcessingDelay);
      } catch (error) {
        console.error(`Error crawling tweets with hashtag #${hashtag}:`, error);
      }
    }
    
    // In ra tình trạng rate limit sau khi hoàn thành
    console.log('Rate limit status after hashtag crawling:', rateLimitTracker.getStatus());
  }

  /**
   * Xử lý tweet và lưu vào cơ sở dữ liệu
   * @param {Object} tweet - Đối tượng tweet từ Twitter API
   * @param {string} sourceUsername - Username nguồn nếu crawl từ tài khoản cụ thể
   */
  async processTweet(tweet, sourceUsername = null) {
    try {
      // Trích xuất thông tin bài đăng
      const user = tweet.includes?.users?.find(u => u.id === tweet.author_id) || {};
      
      // Chuẩn bị dữ liệu tweet
      const tweetData = {
        tweetId: tweet.id,
        text: tweet.text,
        username: user.username || sourceUsername,
        authorName: user.name,
        authorId: tweet.author_id,
        profileImageUrl: user.profile_image_url,
        createdAt: new Date(tweet.created_at),
        metrics: tweet.public_metrics,
        entities: tweet.entities,
      };
      
      // Phân tích nội dung để tìm coin và hashtag
      const analysisResult = analyzeTweet(tweet);
      tweetData.coins = analysisResult.coins;
      tweetData.hashtags = analysisResult.hashtags;
      
      // Todo: Thêm phân tích sentiment ở đây nếu cần
      
      // Lưu vào cơ sở dữ liệu
      await Tweet.saveTweet(tweetData);
    } catch (error) {
      console.error('Error processing tweet:', error);
    }
  }

  /**
   * Crawl theo yêu cầu thủ công
   */
  async crawlOnDemand() {
    try {
      console.log('Running manual Twitter crawl...');
      
      // Sửa đổi: Sử dụng cấu hình hạn chế hơn khi chạy thủ công
      const maxTweetsPerAccount = 5; // Giảm số lượng tweets để thu thập (từ 20 xuống 5)
      const maxTweetsPerHashtag = 3; // Giảm số lượng tweets hashtag (từ 15 xuống 3)
      
      // Crawl tweets từ tài khoản đã cấu hình (chỉ lấy 3 tài khoản đầu tiên)
      console.log('Crawling tweets from configured accounts...');
      const limitedAccounts = config.accounts.slice(0, 3);
      
      // Xử lý tuần tự từng tài khoản để tránh rate limit
      for (const username of limitedAccounts) {
        try {
          console.log(`Crawling tweets from @${username}...`);
          
          // Bỏ qua cơ chế thử lại và kiểm tra rate limit - chỉ thực hiện một lần duy nhất
          const user = await this.readOnlyClient.v2.userByUsername(username);
          
          if (!user.data) {
            console.warn(`User not found: @${username}`);
            continue;
          }
          
          // Giới hạn số lượng tweet lấy về
          const timeline = await this.readOnlyClient.v2.userTimeline(user.data.id, {
            max_results: maxTweetsPerAccount,
            'tweet.fields': 'created_at,public_metrics,entities',
            expansions: 'author_id',
            'user.fields': 'name,username,profile_image_url',
          });
          
          // Xử lý tweets
          let tweetCount = 0;
          for await (const tweet of timeline) {
            await this.processTweet(tweet, username);
            tweetCount++;
            
            // Chỉ xử lý số lượng tweet đã cấu hình
            if (tweetCount >= maxTweetsPerAccount) break;
          }
          
          // Đợi giữa các tài khoản để tránh rate limit
          await delay(3000);
        } catch (error) {
          console.error(`Error crawling tweets for @${username}:`, error.message);
          // Tiếp tục xử lý tài khoản tiếp theo nếu một tài khoản lỗi
          continue;
        }
      }
      
      console.log('Manual crawl completed successfully');
    } catch (error) {
      console.error('Error during manual crawl:', error);
      throw error;
    }
  }

  /**
   * Crawl chỉ các tweets dựa trên hashtags
   */
  async crawlHashtagsOnly() {
    try {
      console.log('Crawling tweets from hashtags only...');
      
      // Giới hạn số lượng tweets thu thập cho mỗi hashtag
      const maxTweetsPerHashtag = 5;
      
      // Xử lý từng hashtag để tránh rate limit
      for (const hashtag of config.hashtags) {
        try {
          console.log(`Crawling tweets with hashtag #${hashtag}...`);
          
          // Tìm kiếm tweets với hashtag, không sử dụng cơ chế thử lại để tránh vượt rate limit
          const searchResults = await this.readOnlyClient.v2.search(`#${hashtag}`, {
            max_results: maxTweetsPerHashtag,
            'tweet.fields': 'created_at,public_metrics,entities',
            expansions: 'author_id',
            'user.fields': 'name,username,profile_image_url',
          });
          
          // Xử lý và lưu trữ tweets
          let count = 0;
          for await (const tweet of searchResults) {
            await this.processTweet(tweet);
            count++;
            
            // Chỉ xử lý số lượng tweet đã cấu hình
            if (count >= maxTweetsPerHashtag) break;
          }
          
          console.log(`Processed ${count} tweets with hashtag #${hashtag}`);
          
          // Đợi giữa các hashtag để tránh rate limit
          await delay(5000);
        } catch (error) {
          console.error(`Error crawling tweets with hashtag #${hashtag}:`, error.message);
          // Tiếp tục xử lý hashtag tiếp theo nếu một hashtag lỗi
          continue;
        }
      }
      
      console.log('Hashtags crawl completed successfully');
    } catch (error) {
      console.error('Error during hashtags crawl:', error);
      throw error;
    }
  }

  /**
   * Lấy thống kê về top coin được đề cập
   */
  async getTopCoinStats(limit = 10) {
    return Tweet.getTopCoinsWithTweetCount(limit);
  }
  
  /**
   * Lấy tình trạng rate limit hiện tại
   */
  getRateLimitStatus() {
    return rateLimitTracker.getStatus();
  }
}

module.exports = new TwitterCrawler(); 