const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

// Khởi tạo Twitter API client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_KEY_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    bearerToken: process.env.TWITTER_BEARER_TOKEN
});

// Rate limit state cho các API endpoints
let rateLimitState = {
    userTimeline: {
        limit: 1500,
        remaining: 1500,
        reset: Date.now() + 3600000
    },
    search: {
        limit: 450,
        remaining: 450,
        reset: Date.now() + 900000
    }
};

// Hàm kiểm tra rate limit của Twitter API
async function checkRateLimit() {
    try {
        // Lấy thông tin rate limit từ Twitter API
        const rateLimitInfo = await twitterClient.v2.rateLimitStatus(['users', 'tweets']);
        
        // Cập nhật trạng thái rate limit
        if (rateLimitInfo.data && rateLimitInfo.data['users']) {
            rateLimitState.userTimeline = {
                limit: rateLimitInfo.data['users']['/2/users/:id/tweets'].limit,
                remaining: rateLimitInfo.data['users']['/2/users/:id/tweets'].remaining,
                reset: new Date(rateLimitInfo.data['users']['/2/users/:id/tweets'].reset * 1000)
            };
        }
        
        if (rateLimitInfo.data && rateLimitInfo.data['tweets']) {
            rateLimitState.search = {
                limit: rateLimitInfo.data['tweets']['/2/tweets/search/recent'].limit,
                remaining: rateLimitInfo.data['tweets']['/2/tweets/search/recent'].remaining,
                reset: new Date(rateLimitInfo.data['tweets']['/2/tweets/search/recent'].reset * 1000)
            };
        }
        
        return rateLimitState;
    } catch (error) {
        console.error('Lỗi khi kiểm tra rate limit:', error);
        return rateLimitState;
    }
}

// Hàm kiểm tra xem còn limit để crawl không
function canCrawl(type = 'userTimeline') {
    const now = Date.now();
    const rateLimitInfo = rateLimitState[type];
    
    // Nếu quá thời gian reset, reset lại remaining
    if (now > new Date(rateLimitInfo.reset).getTime()) {
        rateLimitState[type].remaining = rateLimitState[type].limit;
        rateLimitState[type].reset = now + 900000; // Mặc định 15 phút
    }
    
    return rateLimitState[type].remaining > 0;
}

// Cập nhật rate limit sau mỗi request
function updateRateLimit(type = 'userTimeline', rateLimit) {
    if (rateLimit && rateLimit.limit && rateLimit.remaining && rateLimit.reset) {
        rateLimitState[type] = {
            limit: rateLimit.limit,
            remaining: rateLimit.remaining,
            reset: new Date(rateLimit.reset * 1000)
        };
    } else {
        // Nếu không có thông tin rateLimit, giảm remaining đi 1
        rateLimitState[type].remaining = Math.max(0, rateLimitState[type].remaining - 1);
    }
}

// Lấy trạng thái rate limit hiện tại
function getRateLimitState() {
    return rateLimitState;
}

// Lấy thông tin về các tweets gần đây của một user
async function getUserTweets(username, maxResults = 10) {
    try {
        if (!canCrawl('userTimeline')) {
            return {
                error: true,
                message: `Rate limit exceeded for user timeline. Reset at ${new Date(rateLimitState.userTimeline.reset).toLocaleString()}`,
                rateLimit: rateLimitState.userTimeline
            };
        }

        const user = await twitterClient.v2.userByUsername(username);
        if (!user.data) {
            throw new Error(`Không tìm thấy user ${username}`);
        }

        const userId = user.data.id;
        const userTweets = await twitterClient.v2.userTimeline(userId, {
            max_results: maxResults,
            'tweet.fields': ['created_at', 'public_metrics', 'entities']
        });

        // Cập nhật rate limit
        if (userTweets._rateLimit) {
            updateRateLimit('userTimeline', userTweets._rateLimit);
        }

        return userTweets;
    } catch (error) {
        console.error(`Error getting tweets for user ${username}:`, error);
        return {
            error: true,
            message: error.message,
            rateLimit: rateLimitState.userTimeline
        };
    }
}

// Tìm kiếm tweets
async function searchTweets(query, maxResults = 10) {
    try {
        if (!canCrawl('search')) {
            return {
                error: true,
                message: `Rate limit exceeded for search. Reset at ${new Date(rateLimitState.search.reset).toLocaleString()}`,
                rateLimit: rateLimitState.search
            };
        }

        const searchResults = await twitterClient.v2.search(query, {
            max_results: maxResults,
            'tweet.fields': ['created_at', 'public_metrics', 'entities']
        });

        // Cập nhật rate limit
        if (searchResults._rateLimit) {
            updateRateLimit('search', searchResults._rateLimit);
        }

        return searchResults;
    } catch (error) {
        console.error(`Error searching for tweets with query ${query}:`, error);
        return {
            error: true,
            message: error.message,
            rateLimit: rateLimitState.search
        };
    }
}

module.exports = {
    twitterClient,
    getUserTweets,
    searchTweets,
    checkRateLimit,
    canCrawl,
    getRateLimitState
}; 