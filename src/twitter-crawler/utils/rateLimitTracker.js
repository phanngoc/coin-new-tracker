/**
 * Rate Limit Tracker
 * 
 * Tiện ích theo dõi và quản lý giới hạn tốc độ gọi API
 */

const config = require('../config/twitterConfig');

class RateLimitTracker {
  constructor() {
    // Khởi tạo trạng thái giới hạn tốc độ
    this.resetTrackers();
    console.log('Rate Limit Tracker initialized with separated endpoint tracking');
  }
  
  /**
   * Reset tất cả trackers
   */
  resetTrackers() {
    // Theo dõi chung
    this.requestCount = 0;
    this.lastResetTime = Date.now();
    this.isLimited = false;
    this.nextResetTime = null;
    
    // Theo dõi chi tiết theo từng endpoint
    this.endpoints = {
      default: {
        requestCount: 0,
        lastResetTime: Date.now(),
        isLimited: false,
        nextResetTime: null,
        limit: config.rateLimit.requestsPerWindow,
        windowMs: config.rateLimit.windowMs
      }
    };
    
    // Thêm các endpoint đã cấu hình
    if (config.rateLimit.endpoints) {
      Object.keys(config.rateLimit.endpoints).forEach(endpoint => {
        this.endpoints[endpoint] = {
          requestCount: 0,
          lastResetTime: Date.now(),
          isLimited: false,
          nextResetTime: null,
          limit: config.rateLimit.endpoints[endpoint].requestsPerWindow,
          windowMs: config.rateLimit.endpoints[endpoint].windowMs
        };
      });
    }
  }
  
  /**
   * Kiểm tra xem có thể thực hiện yêu cầu API không
   * @param {string} endpoint - Tên endpoint muốn kiểm tra
   * @returns {boolean} - true nếu có thể thực hiện, false nếu đã đạt giới hạn
   */
  canMakeRequest(endpoint = 'default') {
    // Sử dụng tracker mặc định nếu không có endpoint cụ thể
    if (!this.endpoints[endpoint]) {
      endpoint = 'default';
    }
    
    const tracker = this.endpoints[endpoint];
    
    // Kiểm tra xem đã đến thời gian reset chưa nếu đang bị giới hạn
    if (tracker.isLimited && tracker.nextResetTime) {
      if (Date.now() >= tracker.nextResetTime) {
        this._resetEndpoint(endpoint);
        return true;
      }
      return false;
    }
    
    // Nếu đã qua cửa sổ giới hạn, reset bộ đếm
    const timeElapsed = Date.now() - tracker.lastResetTime;
    if (timeElapsed >= tracker.windowMs) {
      this._resetEndpoint(endpoint);
      return true;
    }
    
    // Kiểm tra số lượng yêu cầu đã thực hiện
    return tracker.requestCount < tracker.limit;
  }
  
  /**
   * Đánh dấu đã thực hiện một yêu cầu API
   * @param {string} endpoint - Endpoint API đã gọi
   * @returns {boolean} - true nếu vẫn trong giới hạn, false nếu đã vượt quá
   */
  trackRequest(endpoint = 'default') {
    // Luôn tăng bộ đếm chung
    this.requestCount++;
    
    // Kiểm tra xem endpoint có được theo dõi riêng không
    if (!this.endpoints[endpoint]) {
      endpoint = 'default';
    }
    
    // Tăng bộ đếm cho endpoint
    const tracker = this.endpoints[endpoint];
    tracker.requestCount++;
    
    // Kiểm tra xem đã vượt quá giới hạn chưa
    const isLimited = tracker.requestCount >= tracker.limit;
    if (isLimited) {
      tracker.isLimited = true;
      
      // Nếu chưa có nextResetTime, tính toán dựa trên windowMs
      if (!tracker.nextResetTime) {
        tracker.nextResetTime = tracker.lastResetTime + tracker.windowMs;
      }
      
      console.log(`Rate limit reached for endpoint ${endpoint}. Reset at: ${new Date(tracker.nextResetTime).toLocaleString()}`);
    }
    
    // Cập nhật giới hạn chung nếu một endpoint bị giới hạn
    if (isLimited) {
      this.isLimited = true;
      if (!this.nextResetTime || tracker.nextResetTime < this.nextResetTime) {
        this.nextResetTime = tracker.nextResetTime;
      }
    }
    
    return !isLimited;
  }
  
  /**
   * Cập nhật thông tin giới hạn từ response headers của Twitter API
   * @param {Object} headers - Headers từ response API
   * @param {string} endpoint - Endpoint API đã gọi
   */
  updateFromResponseHeaders(headers, endpoint = 'default') {
    if (!headers) return;
    
    // Nếu endpoint không tồn tại, sử dụng mặc định
    if (!this.endpoints[endpoint]) {
      endpoint = 'default';
    }
    
    const tracker = this.endpoints[endpoint];
    
    // Lấy thông tin từ header x-rate-limit-*
    const remaining = headers['x-rate-limit-remaining'];
    const reset = headers['x-rate-limit-reset'];
    const limit = headers['x-rate-limit-limit'];
    
    if (remaining !== undefined && reset !== undefined) {
      // Cập nhật giới hạn còn lại
      if (limit !== undefined) {
        tracker.limit = parseInt(limit, 10);
      }
      
      // Cập nhật số lượng request đã sử dụng
      const remainingInt = parseInt(remaining, 10);
      tracker.requestCount = tracker.limit - remainingInt;
      
      // Thời gian reset từ timestamp (giây) sang milliseconds
      const resetTime = parseInt(reset, 10) * 1000;
      tracker.nextResetTime = resetTime;
      
      // Đánh dấu giới hạn nếu không còn yêu cầu nào
      if (remainingInt <= 0) {
        tracker.isLimited = true;
        console.log(`Rate limit reached for endpoint ${endpoint}. Reset at: ${new Date(resetTime).toLocaleString()}`);
        
        // Cập nhật giới hạn chung
        this.isLimited = true;
        if (!this.nextResetTime || resetTime < this.nextResetTime) {
          this.nextResetTime = resetTime;
        }
      }
      
      // Log debug info
      console.log(`Updated rate limits for ${endpoint}: ${remainingInt}/${tracker.limit} remaining, reset at ${new Date(resetTime).toLocaleString()}`);
    }
  }
  
  /**
   * Reset trạng thái giới hạn cho một endpoint cụ thể
   * @private
   * @param {string} endpoint - Endpoint cần reset
   */
  _resetEndpoint(endpoint) {
    const tracker = this.endpoints[endpoint];
    if (!tracker) return;
    
    tracker.requestCount = 0;
    tracker.lastResetTime = Date.now();
    tracker.isLimited = false;
    tracker.nextResetTime = null;
    
    console.log(`Rate limit tracker reset for endpoint ${endpoint}`);
    
    // Kiểm tra xem có cần reset giới hạn chung không
    this._checkAndResetGlobalLimits();
  }
  
  /**
   * Kiểm tra và reset giới hạn chung nếu cần
   * @private
   */
  _checkAndResetGlobalLimits() {
    // Kiểm tra xem còn endpoint nào bị giới hạn không
    const anyLimited = Object.values(this.endpoints).some(tracker => tracker.isLimited);
    
    if (!anyLimited) {
      this.isLimited = false;
      this.nextResetTime = null;
      
      // Tính lại thời gian reset nếu cần
      const nextResetTimes = Object.values(this.endpoints)
        .filter(tracker => tracker.nextResetTime)
        .map(tracker => tracker.nextResetTime);
        
      if (nextResetTimes.length > 0) {
        this.nextResetTime = Math.min(...nextResetTimes);
      }
    }
  }
  
  /**
   * Reset trạng thái giới hạn cho tất cả các endpoints
   */
  resetLimits() {
    this.resetTrackers();
    console.log('All rate limit trackers reset');
  }
  
  /**
   * Lấy thời gian cần đợi trước khi yêu cầu tiếp theo (ms)
   * @param {string} endpoint - Endpoint cần kiểm tra
   * @returns {number} - Thời gian cần đợi (ms)
   */
  getWaitTime(endpoint = 'default') {
    // Nếu endpoint không tồn tại, sử dụng mặc định
    if (!this.endpoints[endpoint]) {
      endpoint = 'default';
    }
    
    const tracker = this.endpoints[endpoint];
    
    // Nếu đang bị giới hạn và có thời gian reset
    if (tracker.isLimited && tracker.nextResetTime) {
      return Math.max(0, tracker.nextResetTime - Date.now() + 1000); // Thêm 1 giây buffer
    }
    
    // Kiểm tra xem có đang tiến gần đến giới hạn không 
    const usageRatio = tracker.requestCount / tracker.limit;
    
    // Điều chỉnh thời gian chờ dựa trên mức độ sử dụng
    if (usageRatio > 0.9) {
      return config.crawlLimits.apiRequestDelay * 8;
    } else if (usageRatio > 0.8) {
      return config.crawlLimits.apiRequestDelay * 5;
    } else if (usageRatio > 0.6) {
      return config.crawlLimits.apiRequestDelay * 3;
    } else if (usageRatio > 0.4) {
      return config.crawlLimits.apiRequestDelay * 2;
    }
    
    return config.crawlLimits.apiRequestDelay;
  }
  
  /**
   * Lấy tình trạng sử dụng hiện tại
   * @returns {Object} - Thông tin sử dụng
   */
  getStatus() {
    const endpointStatus = {};
    
    // Thu thập trạng thái của từng endpoint
    Object.entries(this.endpoints).forEach(([name, tracker]) => {
      endpointStatus[name] = {
        requestCount: tracker.requestCount,
        limit: tracker.limit,
        isLimited: tracker.isLimited,
        usageRatio: tracker.requestCount / tracker.limit,
        nextResetTime: tracker.nextResetTime ? new Date(tracker.nextResetTime).toLocaleString() : null,
        remainingRequests: Math.max(0, tracker.limit - tracker.requestCount)
      };
    });
    
    return {
      globalRequestCount: this.requestCount,
      isGloballyLimited: this.isLimited,
      globalNextReset: this.nextResetTime ? new Date(this.nextResetTime).toLocaleString() : null,
      lastActivityTime: new Date().toLocaleString(),
      endpoints: endpointStatus
    };
  }
}

module.exports = new RateLimitTracker();