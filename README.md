# Solana Chain Checker

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