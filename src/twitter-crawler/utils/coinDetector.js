/**
 * Công cụ nhận diện các đồng coin được đề cập trong nội dung tweet
 */

// Danh sách top coin và các từ khóa liên quan
const TOP_COINS = {
  BTC: ['bitcoin', 'btc', 'xbt', 'satoshi', '#btc', '#bitcoin'],
  ETH: ['ethereum', 'eth', 'ether', 'vitalik', '#eth', '#ethereum'],
  BNB: ['binance coin', 'bnb', 'binance', '#bnb'],
  SOL: ['solana', 'sol', '#sol', '#solana'],
  ADA: ['cardano', 'ada', '#ada', '#cardano'],
  XRP: ['ripple', 'xrp', '#xrp', '#ripple'],
  DOGE: ['dogecoin', 'doge', '#doge', '#dogecoin'],
  DOT: ['polkadot', 'dot', '#dot', '#polkadot'],
  AVAX: ['avalanche', 'avax', '#avax', '#avalanche'],
  SHIB: ['shiba inu', 'shib', '#shib', '#shibainu'],
  MATIC: ['polygon', 'matic', '#matic', '#polygon'],
  LINK: ['chainlink', 'link', '#link', '#chainlink']
};

/**
 * Phát hiện các đồng coin được đề cập trong văn bản
 * @param {string} text - Nội dung cần phân tích
 * @returns {string[]} - Mảng các ký hiệu coin được phát hiện
 */
function detectCoinsInText(text) {
  if (!text) return [];
  
  const lowercaseText = text.toLowerCase();
  const mentionedCoins = [];
  
  // Kiểm tra từng đồng coin trong danh sách
  for (const [symbol, keywords] of Object.entries(TOP_COINS)) {
    for (const keyword of keywords) {
      // Kiểm tra xem từ khóa có xuất hiện trong văn bản không
      // Sử dụng regex với word boundary để tránh phát hiện một phần của từ khác
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lowercaseText)) {
        mentionedCoins.push(symbol);
        break; // Nếu đã phát hiện coin này, không cần kiểm tra các từ khóa khác
      }
    }
  }
  
  return [...new Set(mentionedCoins)]; // Loại bỏ các giá trị trùng lặp
}

/**
 * Phân tích hashtags từ tweet và xác định xem có liên quan đến coin nào không
 * @param {string[]} hashtags - Mảng các hashtag từ tweet
 * @returns {string[]} - Mảng các ký hiệu coin liên quan
 */
function detectCoinsFromHashtags(hashtags) {
  if (!Array.isArray(hashtags) || hashtags.length === 0) return [];
  
  const mentionedCoins = [];
  const lowercaseHashtags = hashtags.map(tag => tag.toLowerCase());
  
  for (const [symbol, keywords] of Object.entries(TOP_COINS)) {
    // Tìm các hashtag liên quan đến coin
    const relatedHashtags = keywords.filter(word => word.startsWith('#'));
    
    for (const tag of relatedHashtags) {
      if (lowercaseHashtags.includes(tag.substring(1))) { // Bỏ dấu # để so sánh
        mentionedCoins.push(symbol);
        break;
      }
    }
  }
  
  return [...new Set(mentionedCoins)];
}

/**
 * Trích xuất tất cả hashtags từ nội dung tweet
 * @param {string} text - Nội dung tweet
 * @returns {string[]} - Mảng các hashtag đã trích xuất
 */
function extractHashtags(text) {
  if (!text) return [];
  
  // Sử dụng regex để tìm tất cả các hashtag trong văn bản
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  
  if (!matches) return [];
  
  // Loại bỏ dấu # và trả về mảng các hashtag
  return matches.map(tag => tag.substring(1));
}

/**
 * Gộp các chức năng phát hiện coin từ nhiều nguồn
 * @param {Object} tweet - Đối tượng tweet cần phân tích
 * @returns {Object} - Đối tượng chứa danh sách coin và hashtag được phát hiện
 */
function analyzeTweet(tweet) {
  const text = tweet.text || '';
  const hashtags = tweet.entities?.hashtags?.map(tag => tag.tag) || extractHashtags(text);
  
  // Phát hiện coin từ nội dung và hashtag
  const coinsFromText = detectCoinsInText(text);
  const coinsFromHashtags = detectCoinsFromHashtags(hashtags);
  
  // Gộp kết quả và loại bỏ trùng lặp
  const detectedCoins = [...new Set([...coinsFromText, ...coinsFromHashtags])];
  
  return {
    coins: detectedCoins,
    hashtags: hashtags
  };
}

module.exports = {
  detectCoinsInText,
  detectCoinsFromHashtags,
  extractHashtags,
  analyzeTweet,
  TOP_COINS
}; 