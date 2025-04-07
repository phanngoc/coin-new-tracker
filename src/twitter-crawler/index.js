/**
 * Twitter Crawler - Module Entry Point
 * 
 * Script này khởi động quá trình crawl dữ liệu từ Twitter
 * Nó có thể được chạy độc lập hoặc được import vào ứng dụng chính
 */

require('dotenv').config();
const twitterCrawler = require('./services/twitterCrawler');
const Tweet = require('./models/Tweet');

// Khởi chạy crawlers theo cronjob
async function startCrawlers() {
  console.log('Starting Twitter crawlers...');
  twitterCrawler.startCronJobs();
}

// Chạy thủ công một lần
async function runManualCrawl() {
  try {
    console.log('Starting manual Twitter crawl...');
    await twitterCrawler.crawlOnDemand();
    console.log('Manual crawl completed');
  } catch (error) {
    console.error('Error during manual crawl:', error);
  }
}

// Lấy thống kê top coins
async function getTopCoinStats(limit = 10) {
  try {
    const stats = await twitterCrawler.getTopCoinStats(limit);
    console.log('Top coins mentioned in tweets:');
    console.table(stats.map(item => ({
      coin: item._id,
      mentions: item.count,
      positive: item.positiveTweets,
      negative: item.negativeTweets,
      neutral: item.count - item.positiveTweets - item.negativeTweets
    })));
    return stats;
  } catch (error) {
    console.error('Error getting top coin stats:', error);
    return [];
  }
}

// Chỉ crawl tweets dựa trên hashtags đã cấu hình
async function crawlHashtagsOnly() {
  try {
    console.log('Starting hashtags-only crawl...');
    await twitterCrawler.crawlHashtagsOnly();
    console.log('Hashtags crawl completed');
  } catch (error) {
    console.error('Error during hashtags crawl:', error);
  }
}

// Kiểm tra tình trạng rate limit
function checkRateLimit() {
  const status = twitterCrawler.getRateLimitStatus();
  console.log('Current Twitter API rate limit status:');
  console.log(`- Request count: ${status.requestCount} (${Math.round(status.usageRatio * 100)}% of limit)`);
  console.log(`- Is limited: ${status.isLimited}`);
  console.log(`- Last reset: ${status.lastResetTime}`);
  console.log(`- Next reset: ${status.nextResetTime || 'N/A'}`);
  
  if (status.isLimited) {
    console.log(`You are currently rate limited. Please wait until ${status.nextResetTime} before making more requests.`);
  } else {
    const remainingRequests = Math.floor((1 - status.usageRatio) * 300);
    console.log(`You can make approximately ${remainingRequests} more requests before hitting the rate limit.`);
  }
  
  return status;
}

// Xử lý các lệnh từ command line
async function processCommands() {
  const command = process.argv[2];
  
  if (!command) {
    console.log('Usage: node index.js [start|run-once|stats|rate-limit]');
    process.exit(1);
  }
  
  switch (command) {
    case 'start':
      await startCrawlers();
      break;
      
    case 'run-once':
      await runManualCrawl();
      process.exit(0);
      break;
      
    case 'stats':
      await getTopCoinStats();
      process.exit(0);
      break;
      
    case 'rate-limit':
      checkRateLimit();
      process.exit(0);
      break;
      
    case 'hashtags-only':
      await crawlHashtagsOnly();
      process.exit(0);
      break;
      
    default:
      console.log(`Unknown command: ${command}`);
      console.log('Usage: node index.js [start|run-once|stats|rate-limit|hashtags-only]');
      process.exit(1);
  }
}

// Khởi chạy khi script được chạy trực tiếp
if (require.main === module) {
  processCommands();
}

// Export các chức năng để sử dụng trong module khác
module.exports = {
  startCrawlers,
  runManualCrawl,
  getTopCoinStats,
  checkRateLimit,
  crawlHashtagsOnly,
  twitterCrawler
}; 