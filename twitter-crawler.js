/**
 * Twitter Crawler Entry Point
 * Script để chạy crawler từ thư mục gốc dự án
 */

require('dotenv').config();
const twitterCrawler = require('./src/twitter-crawler');

async function main() {
  const command = process.argv[2] || 'help';
  
  switch (command) {
    case 'start':
      await twitterCrawler.startCrawlers();
      console.log('Twitter crawler đang chạy trong background. Nhấn Ctrl+C để dừng.');
      break;
      
    case 'run-once':
      await twitterCrawler.runManualCrawl();
      process.exit(0);
      break;
      
    case 'stats':
      await twitterCrawler.getTopCoinStats();
      process.exit(0);
      break;
      
    case 'crawl-hashtags':
      await twitterCrawler.crawlHashtagsOnly();
      process.exit(0);
      break;
      
    case 'help':
    default:
      console.log(`
Twitter Crawler - Thu thập tin tức crypto từ Twitter

Cách sử dụng:
  node twitter-crawler.js [lệnh]

Lệnh:
  start           Bắt đầu crawler theo lịch trình (cronjob)
  run-once        Chạy thu thập dữ liệu một lần
  crawl-hashtags  Chỉ thu thập tweets từ các hashtag đã cấu hình
  stats           Hiển thị thống kê về top coins được đề cập
  help            Hiển thị trợ giúp này

Ví dụ:
  node twitter-crawler.js start
  node twitter-crawler.js crawl-hashtags
      `);
      process.exit(0);
  }
}

// Bắt đầu script
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 