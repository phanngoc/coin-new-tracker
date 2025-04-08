const { TwitterApi } = require('twitter-api-v2');
const config = require('../config/twitterConfig');
const Tweet = require('../models/Tweet');
const { analyzeTweet } = require('../utils/coinDetector');
const rateLimitTracker = require('../utils/rateLimitTracker');
const { CronJob } = require('cron');

// Thêm hàm trì hoãn
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm để thêm jitter (độ ngẫu nhiên) vào các khoảng thời gian delay
// Giúp ngăn các request đồng loạt khi nhiều tiến trình đều bị rate limit cùng lúc
const delayWithJitter = (baseMs) => {
  const jitter = Math.random() * 0.3 * baseMs; // 0-30% jitter
  return delay(baseMs + jitter);
};

class TwitterCrawler {
  constructor() {
    // Danh sách các tokens/credentials để xoay vòng
    this.apiTokens = this._initializeTokens();
    this.currentTokenIndex = 0;
    
    // Khởi tạo Twitter clients
    this._initializeClients();
    
    // Khởi tạo cron jobs
    this.accountsCronJob = null;
    this.hashtagsCronJob = null;
    this.trendingCronJob = null;
    this.searchCronJob = null;
    
    // Cấu hình cơ chế thử lại
    this.retryConfig = {
      maxRetries: 7,           // Tăng số lần thử lại tối đa
      initialDelay: 15000,     // 15 giây cho lần thử đầu tiên
      maxDelay: 10 * 60 * 1000, // 10 phút tối đa
    };
    
    // Biến theo dõi tiến trình hiện tại
    this.isProcessingAccounts = false;
    this.isProcessingHashtags = false;
    this.isProcessingTrending = false;
    this.isProcessingSearch = false;
    
    // Danh sách các nhóm tìm kiếm liên quan đến crypto
    this.cryptoSearchQueries = [
      'crypto news',
      'bitcoin analysis',
      'ethereum development',
      'defi project',
      'nft marketplace',
      'blockchain technology',
      'solana ecosystem',
      'web3 innovation'
    ];
    
    // Danh sách backoff cho mỗi endpoint
    this.endpointBackoffs = {
      userTimeline: 0,
      search: 0,
      trending: 0
    };
  }

  /**
   * Khởi tạo danh sách các tokens API
   * @private
   * @returns {Array} Danh sách các token
   */
  _initializeTokens() {
    // Token mặc định từ biến môi trường
    const defaultToken = {
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_KEY_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
      bearerToken: process.env.TWITTER_BEARER_TOKEN
    };
    
    // Thêm tokens phụ nếu có (từ cấu hình)
    const tokens = [defaultToken];
    
    if (config.additionalApiTokens && Array.isArray(config.additionalApiTokens)) {
      tokens.push(...config.additionalApiTokens);
    }
    
    console.log(`Initialized ${tokens.length} Twitter API tokens`);
    return tokens;
  }
  
  /**
   * Khởi tạo các Twitter clients với token hiện tại
   * @private
   */
  _initializeClients() {
    const token = this.apiTokens[this.currentTokenIndex];
    
    // Khởi tạo client chính
    this.twitterClient = new TwitterApi({
      appKey: token.appKey,
      appSecret: token.appSecret,
      accessToken: token.accessToken,
      accessSecret: token.accessSecret,
    });
    
    // Khởi tạo client chỉ đọc (sử dụng bearer token)
    this.readOnlyClient = token.bearerToken 
      ? new TwitterApi(token.bearerToken).readOnly
      : this.twitterClient.readOnly;
      
    console.log(`Twitter clients initialized with token index ${this.currentTokenIndex}`);
  }
  
  /**
   * Xoay vòng sang token API tiếp theo
   * @private
   */
  _rotateToNextToken() {
    this.currentTokenIndex = (this.currentTokenIndex + 1) % this.apiTokens.length;
    this._initializeClients();
    console.log(`Rotated to next API token, index: ${this.currentTokenIndex}`);
    
    // Reset lại endpoint backoffs khi đổi token
    Object.keys(this.endpointBackoffs).forEach(key => {
      this.endpointBackoffs[key] = 0;
    });
  }

  /**
   * Bắt đầu các cronjob để crawl dữ liệu
   */
  startCronJobs() {
    // Phân bổ các cronjobs vào các thời điểm khác nhau
    
    // Cron job để crawl tweets từ tài khoản (mỗi 3 giờ)
    this.accountsCronJob = new CronJob('0 0 */3 * * *', async () => {
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

    // Cron job để crawl tweets từ hashtag (mỗi 4 giờ)
    // Bắt đầu vào phút 15 để không trùng với job khác
    this.hashtagsCronJob = new CronJob('0 15 */4 * * *', async () => {
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
    
    // Cron job để crawl trending topics (mỗi 6 giờ)
    // Bắt đầu vào phút 30 để phân tán các jobs
    this.trendingCronJob = new CronJob('0 30 */6 * * *', async () => {
      console.log('Running trending crawler job...');
      if (this.isProcessingTrending) {
        console.log('Previous trending crawling job still running, skipping...');
        return;
      }
      
      try {
        this.isProcessingTrending = true;
        await this.crawlTrendingTopics();
      } catch (error) {
        console.error('Error in trending crawler job:', error);
      } finally {
        this.isProcessingTrending = false;
      }
    });
    
    // Cron job để crawl search queries (mỗi 8 giờ)
    // Bắt đầu vào phút 45 để phân tán các jobs
    this.searchCronJob = new CronJob('0 45 */8 * * *', async () => {
      console.log('Running search crawler job...');
      if (this.isProcessingSearch) {
        console.log('Previous search crawling job still running, skipping...');
        return;
      }
      
      try {
        this.isProcessingSearch = true;
        await this.crawlSearchQueries();
      } catch (error) {
        console.error('Error in search crawler job:', error);
      } finally {
        this.isProcessingSearch = false;
      }
    });

    // Bắt đầu các cronjob
    this.accountsCronJob.start();
    this.hashtagsCronJob.start();
    this.trendingCronJob.start();
    this.searchCronJob.start();
    
    console.log('Twitter crawler cron jobs started with staggered schedule');
  }

  /**
   * Kiểm tra tình trạng giới hạn và chờ nếu cần
   * @param {string} endpoint - Tên endpoint đang sử dụng
   * @returns {Promise<boolean>} - true nếu có thể tiếp tục
   */
  async checkRateLimit(endpoint = 'default') {
    if (!rateLimitTracker.canMakeRequest(endpoint)) {
      const waitTime = rateLimitTracker.getWaitTime(endpoint);
      console.log(`Rate limit reached for ${endpoint}, waiting for ${Math.round(waitTime/1000)} seconds...`);
      await delayWithJitter(waitTime);
      
      // Kiểm tra lại sau khi đợi
      if (!rateLimitTracker.canMakeRequest(endpoint)) {
        console.log(`Still rate limited for ${endpoint} after waiting, will try to rotate token`);
        // Nếu vẫn bị rate limit sau khi đợi, xoay vòng token
        this._rotateToNextToken();
        return this.apiTokens.length > 1; // Có thể tiếp tục nếu có nhiều token
      }
    }
    
    // Đánh dấu đã sử dụng một yêu cầu
    rateLimitTracker.trackRequest(endpoint);
    return true;
  }

  /**
   * Thực hiện API call với cơ chế thử lại thông minh
   * @param {Function} apiCallFn - Hàm API call cần thực hiện
   * @param {string} endpoint - Endpoint đang gọi
   * @returns {Promise} - Kết quả từ API call
   */
  async withRetry(apiCallFn, endpoint = 'default') {
    let retries = 0;
    let rotationAttempts = 0;
    const maxTokenRotations = this.apiTokens.length;
    
    while (retries <= this.retryConfig.maxRetries && rotationAttempts <= maxTokenRotations) {
      try {
        // Kiểm tra rate limit trước khi gọi API
        if (!(await this.checkRateLimit(endpoint))) {
          // Nếu vẫn bị giới hạn sau khi xoay vòng token, tăng số lần thử và đợi thêm
          if (rotationAttempts >= maxTokenRotations) {
            // Tăng thời gian backoff cho endpoint này
            this.endpointBackoffs[endpoint] = this.endpointBackoffs[endpoint] || 0;
            const backoffTime = Math.min(
              this.retryConfig.maxDelay,
              (this.retryConfig.initialDelay * Math.pow(2, retries)) + 
              this.endpointBackoffs[endpoint]
            );
            
            console.log(`All tokens rate limited for ${endpoint}. Backing off for ${Math.round(backoffTime/1000)} seconds... (${retries + 1}/${this.retryConfig.maxRetries + 1})`);
            await delayWithJitter(backoffTime);
            
            // Tăng backoff cho lần sau
            this.endpointBackoffs[endpoint] += this.retryConfig.initialDelay;
            
            retries++;
            continue;
          }
          
          // Nếu còn token để xoay vòng, tăng số lần xoay
          rotationAttempts++;
          continue;
        }
        
        // Reset lại endpoint backoff khi gọi API thành công
        this.endpointBackoffs[endpoint] = 0;
        
        // Thực hiện API call
        const result = await apiCallFn();
        
        // Cập nhật thông tin rate limit từ response nếu có
        if (result && result._headers) {
          rateLimitTracker.updateFromResponseHeaders(result._headers, endpoint);
        }
        
        return result;
      } catch (error) {
        // Nếu là lỗi rate limit (429)
        if (error.code === 429) {
          console.log(`Rate limit error (429) for ${endpoint}`);
          
          // Cập nhật thông tin giới hạn từ response
          if (error.rateLimit) {
            rateLimitTracker.updateFromResponseHeaders({
              'x-rate-limit-remaining': '0',
              'x-rate-limit-reset': error.rateLimit.reset
            }, endpoint);
          }
          
          // Xoay vòng sang token kế tiếp
          this._rotateToNextToken();
          rotationAttempts++;
          
          // Nếu đã thử tất cả tokens
          if (rotationAttempts >= maxTokenRotations) {
            // Lấy thời gian chờ từ header nếu có, hoặc tính toán dựa trên số lần thử
            let waitTime = error.rateLimit?.reset ? 
              (error.rateLimit.reset * 1000 - Date.now() + 1000) : // Chuyển đổi sang ms và thêm 1 giây buffer
              Math.min(
                this.retryConfig.maxDelay,
                this.retryConfig.initialDelay * Math.pow(2, retries)
              );
            
            // Thêm jitter để tránh "thundering herd"
            waitTime = waitTime * (0.8 + Math.random() * 0.4); // 80-120% của waitTime
            
            console.log(`All tokens rate limited. Retrying after ${Math.round(waitTime/1000)} seconds... (${retries + 1}/${this.retryConfig.maxRetries + 1})`);
            
            // Đợi theo thời gian tính toán
            await delay(waitTime);
            retries++;
          }
        } else {
          // Nếu là lỗi khác 
          console.error(`API error (non-rate limit) for ${endpoint}:`, error);
          
          // Thử xoay token trước khi throw lỗi
          if (rotationAttempts < maxTokenRotations) {
            console.log(`Trying next token due to API error...`);
            this._rotateToNextToken();
            rotationAttempts++;
            continue;
          }
          
          throw error;
        }
      }
    }
    
    throw new Error(`Failed after ${retries} retries and ${rotationAttempts} token rotations due to rate limits on ${endpoint}`);
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
    
    if (this.trendingCronJob) {
      this.trendingCronJob.stop();
    }
    
    if (this.searchCronJob) {
      this.searchCronJob.stop();
    }
    
    console.log('Twitter crawler cron jobs stopped');
  }

  /**
   * Crawl tweets từ danh sách tài khoản đã cấu hình
   */
  async crawlAccountTweets() {
    console.log('Crawling tweets from configured accounts...');
    
    // Xáo trộn thứ tự tài khoản để đa dạng hóa khi gặp rate limit
    const shuffledAccounts = [...config.accounts].sort(() => Math.random() - 0.5);
    
    // Chia nhỏ danh sách tài khoản thành các nhóm và xử lý tuần tự
    const chunkSize = Math.min(3, config.crawlLimits.concurrentAccountLimit); // Giảm kích thước chunk để giảm tải
    const accountChunks = [];
    
    for (let i = 0; i < shuffledAccounts.length; i += chunkSize) {
      accountChunks.push(shuffledAccounts.slice(i, i + chunkSize));
    }
    
    for (const chunk of accountChunks) {
      // Xử lý tuần tự thay vì đồng thời để giảm tải API
      for (const username of chunk) {
        await this.crawlAccountTweetsForUser(username);
        // Đợi ngắn giữa các tài khoản trong cùng chunk
        await delayWithJitter(config.crawlLimits.apiRequestDelay * 2);
      }
      
      // Đợi một khoảng thời gian dài hơn giữa các nhóm
      await delayWithJitter(config.crawlLimits.apiRequestDelay * 5);
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
      const user = await this.withRetry(
        () => this.readOnlyClient.v2.userByUsername(username),
        'userTimeline'
      );
      
      if (!user?.data) {
        console.warn(`User not found: @${username}`);
        return;
      }
      
      // Lấy timeline của user với cơ chế thử lại
      const timeline = await this.withRetry(
        () => this.readOnlyClient.v2.userTimeline(user.data.id, {
          max_results: config.crawlLimits.maxTweetsPerAccount, // Số lượng từ cấu hình
          'tweet.fields': 'created_at,public_metrics,entities,context_annotations',
          expansions: 'author_id,referenced_tweets.id',
          'user.fields': 'name,username,profile_image_url',
        }),
        'userTimeline'
      );
      
      // Xử lý và lưu trữ tweets
      let count = 0;
      for await (const tweet of timeline) {
        await this.processTweet(tweet, username);
        count++;
        
        // Thêm độ trễ ngẫu nhiên giữa các lần xử lý tweet để giảm tải
        if (count % 3 === 0) { // Giảm xuống mỗi 3 tweets thay vì 5
          await delayWithJitter(config.crawlLimits.apiRequestDelay);
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
    
    // Xáo trộn hashtags để đa dạng hóa
    const shuffledHashtags = [...config.hashtags].sort(() => Math.random() - 0.5);
    
    // Phân phối crawling hashtag theo thời gian
    for (const hashtag of shuffledHashtags) {
      try {
        console.log(`Crawling tweets with hashtag #${hashtag}...`);
        
        // Tìm kiếm tweets với hashtag, sử dụng cơ chế thử lại
        const searchResults = await this.withRetry(
          () => this.readOnlyClient.v2.search(`#${hashtag}`, {
            max_results: config.crawlLimits.maxTweetsPerHashtag,
            'tweet.fields': 'created_at,public_metrics,entities,context_annotations',
            expansions: 'author_id,referenced_tweets.id',
            'user.fields': 'name,username,profile_image_url',
          }),
          'search'
        );
        
        // Xử lý và lưu trữ tweets
        let count = 0;
        for await (const tweet of searchResults) {
          await this.processTweet(tweet);
          count++;
          
          // Thêm độ trễ ngẫu nhiên giữa các tweets để tránh rate limit
          if (count % 3 === 0) {
            await delayWithJitter(config.crawlLimits.apiRequestDelay);
          }
        }
        
        console.log(`Processed ${count} tweets with hashtag #${hashtag}`);
        
        // Đợi giữa các hashtag để tránh rate limit với jitter
        await delayWithJitter(config.crawlLimits.hashtagProcessingDelay);
      } catch (error) {
        console.error(`Error crawling tweets with hashtag #${hashtag}:`, error);
        // Nếu gặp lỗi, tăng thời gian nghỉ trước khi xử lý hashtag tiếp theo
        await delayWithJitter(config.crawlLimits.hashtagProcessingDelay * 2);
      }
    }
    
    // In ra tình trạng rate limit sau khi hoàn thành
    console.log('Rate limit status after hashtag crawling:', rateLimitTracker.getStatus());
  }

  /**
   * Crawl trending topics và tweets liên quan
   */
  async crawlTrendingTopics() {
    try {
      console.log('Crawling trending topics...');
      
      // Danh sách WOEID của một số thị trường tài chính và công nghệ
      const woeids = [
        1, // Worldwide
        23424977, // United States
        23424829, // Germany
        23424856, // Japan
        23424848, // India
        23424975, // UK
        23424856, // Korea
      ];
      
      // Chỉ lấy một số WOEID ngẫu nhiên mỗi lần để tránh rate limit
      const selectedWoeids = woeids.sort(() => Math.random() - 0.5).slice(0, 2);
      
      for (const woeid of selectedWoeids) {
        try {
          // Lấy trending topics với cơ chế thử lại
          const trends = await this.withRetry(
            () => this.twitterClient.v1.trendsByPlace(woeid),
            'trending'
          );
          
          if (!trends?.[0]?.trends) continue;
          
          console.log(`Got ${trends[0].trends.length} trending topics for WOEID ${woeid}`);
          
          // Lọc các trends liên quan đến crypto
          const cryptoTrends = trends[0].trends.filter(trend => {
            const name = trend.name.toLowerCase();
            return config.cryptoKeywords.some(keyword => 
              name.includes(keyword.toLowerCase())
            );
          });
          
          console.log(`Found ${cryptoTrends.length} crypto-related trends`);
          
          // Lấy một số trending topics ngẫu nhiên (tối đa 2)
          const selectedTrends = cryptoTrends
            .sort(() => Math.random() - 0.5)
            .slice(0, 2);
          
          // Crawl tweets từ mỗi trending topic
          for (const trend of selectedTrends) {
            try {
              console.log(`Crawling trending topic: ${trend.name}`);
              
              // Tìm kiếm tweets với trending topic
              const searchResults = await this.withRetry(
                () => this.readOnlyClient.v2.search(trend.name, {
                  max_results: Math.min(10, config.crawlLimits.maxTweetsPerHashtag),
                  'tweet.fields': 'created_at,public_metrics,entities,context_annotations',
                  expansions: 'author_id,referenced_tweets.id',
                  'user.fields': 'name,username,profile_image_url',
                }),
                'search'
              );
              
              // Xử lý và lưu trữ tweets
              let count = 0;
              for await (const tweet of searchResults) {
                await this.processTweet(tweet, null, trend.name);
                count++;
                
                // Giới hạn số lượng tweet xử lý mỗi trend
                if (count >= 10) break;
                
                // Thêm độ trễ ngẫu nhiên
                await delayWithJitter(config.crawlLimits.apiRequestDelay);
              }
              
              console.log(`Processed ${count} tweets from trending topic ${trend.name}`);
              
              // Đợi giữa các trend
              await delayWithJitter(config.crawlLimits.hashtagProcessingDelay);
              
            } catch (error) {
              console.error(`Error processing trend ${trend.name}:`, error);
              continue;
            }
          }
          
          // Đợi giữa các WOEID
          await delayWithJitter(config.crawlLimits.hashtagProcessingDelay * 2);
          
        } catch (error) {
          console.error(`Error getting trends for WOEID ${woeid}:`, error);
          continue;
        }
      }
      
      console.log('Finished crawling trending topics');
      
    } catch (error) {
      console.error('Error during trending topics crawl:', error);
    }
  }

  /**
   * Crawl tweets từ các search queries liên quan đến crypto
   */
  async crawlSearchQueries() {
    try {
      console.log('Crawling crypto search queries...');
      
      // Xáo trộn các search query
      const shuffledQueries = [...this.cryptoSearchQueries].sort(() => Math.random() - 0.5);
      
      // Chỉ lấy một số query mỗi lần chạy để tránh rate limit
      const selectedQueries = shuffledQueries.slice(0, 3);
      
      for (const query of selectedQueries) {
        try {
          console.log(`Searching for: "${query}"...`);
          
          // Tìm kiếm tweets với query
          const searchResults = await this.withRetry(
            () => this.readOnlyClient.v2.search(query, {
              max_results: 15,
              'tweet.fields': 'created_at,public_metrics,entities,context_annotations',
              expansions: 'author_id,referenced_tweets.id',
              'user.fields': 'name,username,profile_image_url',
            }),
            'search'
          );
          
          // Xử lý và lưu trữ tweets
          let count = 0;
          for await (const tweet of searchResults) {
            await this.processTweet(tweet, null, query);
            count++;
            
            // Thêm độ trễ ngẫu nhiên
            if (count % 3 === 0) {
              await delayWithJitter(config.crawlLimits.apiRequestDelay);
            }
          }
          
          console.log(`Processed ${count} tweets from search query "${query}"`);
          
          // Đợi giữa các queries
          await delayWithJitter(config.crawlLimits.hashtagProcessingDelay);
          
        } catch (error) {
          console.error(`Error searching for query "${query}":`, error);
          // Đợi lâu hơn nếu gặp lỗi
          await delayWithJitter(config.crawlLimits.hashtagProcessingDelay * 2);
          continue;
        }
      }
      
      console.log('Finished crawling search queries');
      
    } catch (error) {
      console.error('Error during search queries crawl:', error);
    }
  }

  /**
   * Xử lý tweet và lưu vào cơ sở dữ liệu
   * @param {Object} tweet - Đối tượng tweet từ Twitter API
   * @param {string} sourceUsername - Username nguồn nếu crawl từ tài khoản cụ thể
   * @param {string} searchQuery - Query tìm kiếm hoặc trending topic nếu có
   */
  async processTweet(tweet, sourceUsername = null, searchQuery = null) {
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
        searchQuery: searchQuery, // Thêm trường lưu nguồn query
        source: sourceUsername ? 'account' : (searchQuery ? (searchQuery.startsWith('#') ? 'hashtag' : 'search') : 'other')
      };
      
      // Phân tích nội dung để tìm coin và hashtag
      const analysisResult = analyzeTweet(tweet);
      tweetData.coins = analysisResult.coins;
      tweetData.hashtags = analysisResult.hashtags;
      
      // Thêm context annotations nếu có
      if (tweet.context_annotations) {
        tweetData.contextAnnotations = tweet.context_annotations;
      }
      
      // Thêm referenced tweets nếu có (retweets, quotes, replies)
      if (tweet.referenced_tweets) {
        tweetData.referencedTweets = tweet.referenced_tweets;
      }
      
      // Lưu vào cơ sở dữ liệu
      await Tweet.saveTweet(tweetData);
    } catch (error) {
      console.error('Error processing tweet:', error);
    }
  }

  /**
   * Crawl theo yêu cầu thủ công với phân bổ thông minh hơn
   */
  async crawlOnDemand() {
    try {
      console.log('Running manual Twitter crawl...');
      
      // Sử dụng cấu hình hạn chế hơn khi chạy thủ công
      const maxTweetsPerAccount = 3; // Giảm số lượng tweets để thu thập
      const maxTweetsPerSource = 5; // Giới hạn số lượng tweets mỗi nguồn
      
      // === 1. Crawl một số tài khoản ===
      console.log('Crawling selected accounts...');
      
      // Lấy ngẫu nhiên một số tài khoản từ danh sách đã cấu hình
      const accountSample = [...config.accounts]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
        
      // Xử lý tuần tự từng tài khoản
      for (const username of accountSample) {
        try {
          console.log(`Crawling tweets from @${username}...`);
          
          // Tìm kiếm user
          const user = await this.withRetry(
            () => this.readOnlyClient.v2.userByUsername(username),
            'userTimeline'
          );
          
          if (!user?.data) {
            console.warn(`User not found: @${username}`);
            continue;
          }
          
          // Lấy timeline
          const timeline = await this.withRetry(
            () => this.readOnlyClient.v2.userTimeline(user.data.id, {
              max_results: maxTweetsPerAccount,
              'tweet.fields': 'created_at,public_metrics,entities,context_annotations',
              expansions: 'author_id,referenced_tweets.id',
              'user.fields': 'name,username,profile_image_url',
            }),
            'userTimeline'
          );
          
          // Xử lý tweets
          let tweetCount = 0;
          for await (const tweet of timeline) {
            await this.processTweet(tweet, username);
            tweetCount++;
            
            if (tweetCount >= maxTweetsPerAccount) break;
          }
          
          console.log(`Processed ${tweetCount} tweets from @${username}`);
          
          // Đợi giữa các tài khoản
          await delayWithJitter(3000);
        } catch (error) {
          console.error(`Error crawling tweets for @${username}:`, error.message);
          continue;
        }
      }
      
      // === 2. Crawl một số hashtag ===
      console.log('Crawling selected hashtags...');
      
      // Lấy ngẫu nhiên một số hashtag
      const hashtagSample = [...config.hashtags]
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
        
      // Xử lý từng hashtag
      for (const hashtag of hashtagSample) {
        try {
          console.log(`Crawling tweets with hashtag #${hashtag}...`);
          
          // Tìm kiếm tweets với hashtag
          const searchResults = await this.withRetry(
            () => this.readOnlyClient.v2.search(`#${hashtag}`, {
              max_results: maxTweetsPerSource,
              'tweet.fields': 'created_at,public_metrics,entities,context_annotations',
              expansions: 'author_id,referenced_tweets.id',
              'user.fields': 'name,username,profile_image_url',
            }),
            'search'
          );
          
          // Xử lý tweets
          let tweetCount = 0;
          for await (const tweet of searchResults) {
            await this.processTweet(tweet, null, `#${hashtag}`);
            tweetCount++;
            
            if (tweetCount >= maxTweetsPerSource) break;
          }
          
          console.log(`Processed ${tweetCount} tweets with hashtag #${hashtag}`);
          
          // Đợi giữa các hashtag
          await delayWithJitter(3000);
        } catch (error) {
          console.error(`Error crawling tweets with hashtag #${hashtag}:`, error.message);
          continue;
        }
      }
      
      // === 3. Crawl một trending topic (nếu có) ===
      try {
        console.log('Looking for crypto trending topics...');
        
        // Lấy trending topics từ worldwide
        const trends = await this.withRetry(
          () => this.twitterClient.v1.trendsByPlace(1), // 1 = worldwide
          'trending'
        );
        
        if (trends?.[0]?.trends) {
          // Lọc trends có thể liên quan đến crypto
          const cryptoTrends = trends[0].trends.filter(trend => {
            const name = trend.name.toLowerCase();
            return config.cryptoKeywords.some(keyword => 
              name.includes(keyword.toLowerCase())
            );
          });
          
          // Nếu có crypto trends, lấy ngẫu nhiên một trend
          if (cryptoTrends.length > 0) {
            const selectedTrend = cryptoTrends[Math.floor(Math.random() * cryptoTrends.length)];
            
            console.log(`Crawling trending topic: ${selectedTrend.name}`);
            
            // Tìm kiếm tweets với trending topic
            const searchResults = await this.withRetry(
              () => this.readOnlyClient.v2.search(selectedTrend.name, {
                max_results: maxTweetsPerSource,
                'tweet.fields': 'created_at,public_metrics,entities,context_annotations',
                expansions: 'author_id,referenced_tweets.id',
                'user.fields': 'name,username,profile_image_url',
              }),
              'search'
            );
            
            // Xử lý tweets
            let tweetCount = 0;
            for await (const tweet of searchResults) {
              await this.processTweet(tweet, null, selectedTrend.name);
              tweetCount++;
              
              if (tweetCount >= maxTweetsPerSource) break;
            }
            
            console.log(`Processed ${tweetCount} tweets from trending topic ${selectedTrend.name}`);
          } else {
            console.log('No crypto-related trends found');
          }
        }
      } catch (error) {
        console.error('Error processing trending topics:', error.message);
      }
      
      console.log('Manual crawl completed successfully');
    } catch (error) {
      console.error('Error during manual crawl:', error);
      throw error;
    }
  }

  /**
   * Crawl chỉ các tweets dựa trên hashtags với chiến lược mới
   */
  async crawlHashtagsOnly() {
    try {
      console.log('Crawling tweets from hashtags only with adaptive strategy...');
      
      // Xáo trộn hashtags để đa dạng hóa khi gặp rate limit
      const shuffledHashtags = [...config.hashtags].sort(() => Math.random() - 0.5);
      
      // Giới hạn số lượng hashtag xử lý mỗi lần để tránh rate limit
      const limitedHashtags = shuffledHashtags.slice(0, 5);
      
      // Xử lý từng hashtag
      for (const hashtag of limitedHashtags) {
        try {
          console.log(`Crawling tweets with hashtag #${hashtag}...`);
          
          // Giới hạn số lượng tweet thu thập
          const maxTweetsPerHashtag = Math.min(5, config.crawlLimits.maxTweetsPerHashtag);
          
          // Tìm kiếm tweets với hashtag, sử dụng cơ chế thử lại thông minh
          const searchResults = await this.withRetry(
            () => this.readOnlyClient.v2.search(`#${hashtag}`, {
              max_results: maxTweetsPerHashtag,
              'tweet.fields': 'created_at,public_metrics,entities,context_annotations',
              expansions: 'author_id,referenced_tweets.id',
              'user.fields': 'name,username,profile_image_url',
            }),
            'search'
          );
          
          // Xử lý và lưu trữ tweets
          let count = 0;
          for await (const tweet of searchResults) {
            await this.processTweet(tweet, null, `#${hashtag}`);
            count++;
            
            // Chỉ xử lý đến số lượng đã cấu hình
            if (count >= maxTweetsPerHashtag) break;
            
            // Thêm độ trễ nhỏ giữa các tweet
            await delayWithJitter(1000);
          }
          
          console.log(`Processed ${count} tweets with hashtag #${hashtag}`);
          
          // Đợi giữa các hashtag với thời gian ngẫu nhiên
          await delayWithJitter(5000 + Math.random() * 2000);
          
        } catch (error) {
          console.error(`Error crawling tweets with hashtag #${hashtag}:`, error.message);
          // Đợi lâu hơn nếu gặp lỗi
          await delayWithJitter(10000);
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
    const status = rateLimitTracker.getStatus();
    status.currentToken = this.currentTokenIndex;
    status.totalTokens = this.apiTokens.length;
    status.endpointBackoffs = this.endpointBackoffs;
    return status;
  }
}

module.exports = new TwitterCrawler();