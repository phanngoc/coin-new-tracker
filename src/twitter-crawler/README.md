# Twitter Crawler cho Tin tức Crypto

Module này crawl dữ liệu từ Twitter để theo dõi và phân tích các tin tức về cryptocurrency từ các tài khoản KOLs và hashtags phổ biến.

## Tính năng

- Thu thập tweets từ các tài khoản crypto KOLs và tin tức được cấu hình
- Theo dõi các hashtags liên quan đến crypto
- Phân tích nội dung tweet để xác định các đồng coin được đề cập
- Lưu trữ dữ liệu vào MongoDB
- Tạo báo cáo thống kê về các đồng coin được đề cập nhiều nhất
- Xử lý thông minh giới hạn tốc độ API (rate limit) của Twitter

## Cài đặt

1. Cài đặt các dependency:

```bash
npm install twitter-api-v2 axios cheerio cron mongodb
```

2. Cấu hình Twitter API và MongoDB trong file `.env`:

```
TWITTER_API_KEY=your_api_key_here
TWITTER_API_KEY_SECRET=your_api_key_secret_here
TWITTER_BEARER_TOKEN=your_bearer_token_here
TWITTER_ACCESS_TOKEN=your_access_token_here
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here
MONGODB_URI=mongodb://localhost:27017/crypto_news
```

## Cách sử dụng

### Chạy theo lịch trình (cronjob)

Để bắt đầu thu thập dữ liệu theo lịch trình đã cấu hình:

```bash
node src/twitter-crawler/index.js start
```

Theo mặc định:
- Tweets từ tài khoản sẽ được crawl mỗi 60 phút
- Tweets từ hashtags sẽ được crawl mỗi 2 giờ

### Chạy thủ công

Để chạy thủ công một lần:

```bash
node src/twitter-crawler/index.js run-once
```

### Xem thống kê

Để xem thống kê về top coins được đề cập:

```bash
node src/twitter-crawler/index.js stats
```

### Kiểm tra tình trạng giới hạn API

Để kiểm tra tình trạng rate limit của Twitter API:

```bash
node src/twitter-crawler/index.js rate-limit
```

## Xử lý Rate Limit

Module này có tích hợp các cơ chế thông minh để xử lý giới hạn tốc độ (rate limit) của Twitter API:

1. **Theo dõi và quản lý giới hạn tốc độ API**:
   - Tự động theo dõi số lượng yêu cầu đã thực hiện
   - Phát hiện khi đạt giới hạn và tự động chờ đến khi reset

2. **Cơ chế trì hoãn thông minh**:
   - Exponential backoff - tăng thời gian chờ theo cấp số nhân khi gặp lỗi
   - Đọc thông tin reset time từ header API response

3. **Phân phối yêu cầu API**:
   - Xử lý tuần tự các hashtag và tài khoản
   - Giới hạn số lượng yêu cầu đồng thời
   - Thêm độ trễ giữa các yêu cầu liên tiếp

4. **Cấu hình linh hoạt**:
   - Điều chỉnh số lượng tweet lấy về mỗi lần
   - Thay đổi tần suất crawl dữ liệu
   - Tùy chỉnh các giới hạn thông qua file cấu hình

Để tránh lỗi rate limit, bạn có thể điều chỉnh các thông số trong file `config/twitterConfig.js`.

## Tích hợp vào ứng dụng

Để tích hợp module này vào ứng dụng của bạn:

```javascript
const twitterCrawler = require('./src/twitter-crawler');

// Bắt đầu các cronjob
twitterCrawler.startCrawlers();

// Hoặc chạy thủ công
async function crawlData() {
  await twitterCrawler.runManualCrawl();
}

// Lấy thống kê
async function getStats() {
  const stats = await twitterCrawler.getTopCoinStats();
  console.log(stats);
}

// Kiểm tra rate limit
function checkLimit() {
  const status = twitterCrawler.checkRateLimit();
  console.log(status);
}
```

## Tùy chỉnh

- Danh sách tài khoản và hashtags có thể được cấu hình trong `config/twitterConfig.js`
- Danh sách các đồng coin được nhận diện có thể được mở rộng trong `utils/coinDetector.js`
- Cấu hình rate limit trong `config/twitterConfig.js`

## Xử lý sự cố

### Lỗi Rate Limit (429)

Nếu bạn gặp lỗi rate limit (429), crawler sẽ tự động xử lý bằng cách:
1. Đợi một khoảng thời gian dựa trên thông tin từ API
2. Thử lại tự động theo cơ chế exponential backoff
3. Giảm tải các yêu cầu trong tương lai

Nếu vẫn gặp lỗi thường xuyên, bạn có thể:
- Tăng khoảng thời gian giữa các lần crawl 
- Giảm số lượng tweet lấy về mỗi lần
- Giảm số lượng hashtag hoặc tài khoản theo dõi

### Kiểm tra logs

Crawler tạo ra logs chi tiết về quá trình xử lý, bao gồm cả thông tin về rate limit. Kiểm tra logs để nắm rõ hơn về tình trạng và nguyên nhân lỗi.

## Mở rộng

- Thêm phân tích sentiment để đánh giá tính tích cực/tiêu cực của tweets
- Tích hợp với các nguồn dữ liệu khác ngoài Twitter
- Tạo bảng điều khiển (dashboard) để trực quan hóa dữ liệu 