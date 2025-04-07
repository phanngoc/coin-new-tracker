# Chain Checker

Ứng dụng kiểm tra và xác minh giao dịch trên mạng Solana blockchain, với tính năng theo dõi tin tức crypto từ Twitter.

## Twitter Crawler

Tính năng này crawl dữ liệu từ Twitter để theo dõi và phân tích các tin tức về cryptocurrency từ các tài khoản KOLs và hashtags phổ biến.

### Cài đặt MongoDB với Docker

Dự án sử dụng MongoDB để lưu trữ dữ liệu. Bạn có thể dễ dàng cài đặt MongoDB bằng Docker Compose:

```bash
# Khởi động MongoDB
docker-compose up -d

# Kiểm tra trạng thái
docker-compose ps

# Dừng và xóa container
docker-compose down
```

Sau khi khởi động, MongoDB sẽ hoạt động ở địa chỉ `mongodb://localhost:27017/crypto_news`.

MongoDB Express UI: http://localhost:8081 (username: admin, password: admin123)

### Sử dụng Twitter Crawler

1. Cấu hình Twitter API trong file `.env`

2. Các lệnh có sẵn:
   ```bash
   # Chạy crawler theo lịch trình
   npm run twitter:start
   
   # Crawl dữ liệu một lần
   npm run twitter:crawl
   
   # Xem thống kê
   npm run twitter:stats
   ```

Chi tiết hơn về Twitter crawler có trong file [src/twitter-crawler/README.md](src/twitter-crawler/README.md).

## Dashboard Analytics

Dự án cung cấp dashboard web để trực quan hóa và phân tích dữ liệu đã crawl.

### Tính năng Dashboard

- Hiển thị thống kê top 10 đồng coin được đề cập nhiều nhất
- Phân tích xu hướng đề cập theo thời gian
- Lọc tweets theo coin, tài khoản, hashtag
- Tìm kiếm nâng cao trong nội dung tweets

### Sử dụng Dashboard

1. Khởi động MongoDB (như hướng dẫn ở trên)

2. Cấu hình Dashboard trong file `.env`:
   ```
   DASHBOARD_PORT=3002
   DASHBOARD_ENABLE_CACHE=true
   DASHBOARD_CACHE_DURATION=300
   ```

3. Khởi động Dashboard:
   ```bash
   # Khởi động Dashboard
   npm run dashboard
   
   # Hoặc chạy với nodemon cho phát triển
   npm run dev:dashboard
   ```

4. Truy cập Dashboard tại: http://localhost:3002

## Solana Chain Checker

Ứng dụng kiểm tra và xác minh giao dịch trên mạng Solana blockchain. Cung cấp API để kiểm tra thông tin giao dịch, trạng thái giao dịch và thông tin tài khoản ví.

## Chức năng

- Kiểm tra thông tin giao dịch dựa vào chữ ký (signature)
- Kiểm tra trạng thái giao dịch (thành công/thất bại)
- Lấy thông tin số dư tài khoản ví
- Lấy danh sách token SPL trong ví
- Lấy lịch sử giao dịch của ví

## Cài đặt

1. Clone repository:
```bash
git clone <repository-url>
cd chain-checker
```

2. Cài đặt các dependencies:
```bash
npm install
```

3. Tạo file .env và cấu hình:
```
SOLANA_NETWORK=mainnet-beta
PORT=3001
```

## Chạy ứng dụng

Chạy trong môi trường development:
```bash
npm run dev
```

Chạy trong môi trường production:
```bash
npm start
```

## API Endpoints

### Kiểm tra giao dịch
```
GET /api/transaction/:signature
```

Ví dụ:
```
GET /api/transaction/4EPmz5Vb6APxGRMCqNaohLnCBpaKKjRpHM7Xsspno7L321MZutCzW6S1TPwYBEw8Sin9yG8euYiYFJ7N5MwFSSHT
```

### Kiểm tra thông tin ví
```
GET /api/wallet/:address
```

Ví dụ:
```
GET /api/wallet/Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
```

### Lấy lịch sử giao dịch của ví
```
GET /api/wallet/:address/transactions?limit=20
```

Ví dụ:
```
GET /api/wallet/Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr/transactions?limit=50
```

Tham số `limit` là tùy chọn (mặc định: 20, tối đa: 100).

## Môi trường hỗ trợ

- Mainnet: `mainnet-beta`
- Testnet: `testnet`
- Devnet: `devnet`

## Công nghệ sử dụng

- Node.js
- Express.js
- @solana/web3.js
- @solana/spl-token