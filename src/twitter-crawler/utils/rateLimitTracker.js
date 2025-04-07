/**
 * Rate Limit Tracker
 * 
 * Tiện ích theo dõi và quản lý giới hạn tốc độ gọi API
 */

const config = require('../config/twitterConfig');

class RateLimitTracker {
  constructor() {
    // Số lượng yêu cầu đã thực hiện trong cửa sổ hiện tại
    this.requestCount = 0;
    // Thời gian reset cuối cùng
    this.lastResetTime = Date.now();
    // Cờ đánh dấu đã vượt quá giới hạn
    this.isLimited = false;
    // Thời gian reset tiếp theo (từ header API)
    this.nextResetTime = null;
    // Theo dõi giới hạn theo từng endpoint
    this.endpointLimits = new Map();
  }
  
  /**
   * Kiểm tra xem có thể thực hiện yêu cầu API không
   * @returns {boolean} - true nếu có thể thực hiện, false nếu đã đạt giới hạn
   */
  canMakeRequest() {
    // Nếu đã đánh dấu giới hạn, kiểm tra xem đã đến thời gian reset chưa
    if (this.isLimited && this.nextResetTime) {
      if (Date.now() >= this.nextResetTime) {
        this.resetLimits();
        return true;
      }
      return false;
    }
    
    // Nếu đã qua cửa sổ giới hạn, reset bộ đếm
    const timeElapsed = Date.now() - this.lastResetTime;
    if (timeElapsed >= config.rateLimit.windowMs) {
      this.resetLimits();
      return true;
    }
    
    // Kiểm tra số lượng yêu cầu đã thực hiện
    return this.requestCount < config.rateLimit.requestsPerWindow;
  }
  
  /**
   * Đánh dấu đã thực hiện một yêu cầu API
   * @param {string} endpoint - Endpoint API đã gọi
   * @returns {boolean} - true nếu vẫn trong giới hạn, false nếu đã vượt quá
   */
  trackRequest(endpoint = 'default') {
    this.requestCount++;
    
    // Theo dõi theo endpoint cụ thể nếu cần
    if (!this.endpointLimits.has(endpoint)) {
      this.endpointLimits.set(endpoint, 1);
    } else {
      this.endpointLimits.set(endpoint, this.endpointLimits.get(endpoint) + 1);
    }
    
    // Kiểm tra xem đã vượt quá giới hạn chưa
    if (this.requestCount >= config.rateLimit.requestsPerWindow) {
      this.isLimited = true;
      return false;
    }
    
    return true;
  }
  
  /**
   * Cập nhật thông tin giới hạn từ response headers của Twitter API
   * @param {Object} headers - Headers từ response API
   */
  updateFromResponseHeaders(headers) {
    if (!headers) return;
    
    // Lấy thông tin từ header x-rate-limit-*
    const remaining = headers['x-rate-limit-remaining'];
    const reset = headers['x-rate-limit-reset'];
    const limit = headers['x-rate-limit-limit'];
    
    if (remaining !== undefined && reset !== undefined) {
      // Cập nhật giới hạn còn lại
      this.requestCount = config.rateLimit.requestsPerWindow - parseInt(remaining, 10);
      
      // Thời gian reset (đổi từ timestamp sang milliseconds)
      this.nextResetTime = parseInt(reset, 10) * 1000;
      
      // Đánh dấu giới hạn nếu không còn yêu cầu nào
      if (parseInt(remaining, 10) <= 0) {
        this.isLimited = true;
        console.log(`Rate limit reached. Reset at: ${new Date(this.nextResetTime).toLocaleString()}`);
      }
    }
  }
  
  /**
   * Reset trạng thái giới hạn
   */
  resetLimits() {
    this.requestCount = 0;
    this.lastResetTime = Date.now();
    this.isLimited = false;
    this.nextResetTime = null;
    this.endpointLimits.clear();
    console.log('Rate limit tracker reset');
  }
  
  /**
   * Lấy thời gian cần đợi trước khi yêu cầu tiếp theo (ms)
   * @returns {number} - Thời gian cần đợi (ms)
   */
  getWaitTime() {
    if (this.isLimited && this.nextResetTime) {
      return Math.max(0, this.nextResetTime - Date.now());
    }
    
    // Kiểm tra xem có đang tiến gần đến giới hạn không 
    const usageRatio = this.requestCount / config.rateLimit.requestsPerWindow;
    
    // Nếu đã sử dụng hơn 80% giới hạn, tăng thời gian chờ
    if (usageRatio > 0.8) {
      return config.crawlLimits.apiRequestDelay * 5;
    } else if (usageRatio > 0.5) {
      return config.crawlLimits.apiRequestDelay * 2;
    }
    
    return config.crawlLimits.apiRequestDelay;
  }
  
  /**
   * Lấy tình trạng sử dụng hiện tại
   * @returns {Object} - Thông tin sử dụng
   */
  getStatus() {
    return {
      requestCount: this.requestCount,
      isLimited: this.isLimited,
      lastResetTime: new Date(this.lastResetTime).toLocaleString(),
      nextResetTime: this.nextResetTime ? new Date(this.nextResetTime).toLocaleString() : null,
      usageRatio: this.requestCount / config.rateLimit.requestsPerWindow,
      endpointUsage: Object.fromEntries(this.endpointLimits)
    };
  }
}

module.exports = new RateLimitTracker(); 