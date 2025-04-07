// Twitter Crawler
const { MongoClient } = require('mongodb');
const axios = require('axios');
const { CronJob } = require('cron');
const { twitterClient, getUserTweets, searchTweets, canCrawl, getRateLimitState } = require('./twitter-api');
const sentimentAnalyzer = require('./utils/sentimentAnalyzer');
require('dotenv').config();

// Mongo DB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_news';
const DB_NAME = 'crypto_news';
const TWEETS_COLLECTION = 'tweets';
const STATS_COLLECTION = 'stats';

// Accounts to monitor
const CRYPTO_ACCOUNTS = [
    'cz_binance',     // Changpeng Zhao (CZ) - Binance CEO
    'SBF_FTX',        // Sam Bankman-Fried - FTX CEO
    'VitalikButerin', // Vitalik Buterin - Ethereum co-founder
    'saylor',         // Michael Saylor - MicroStrategy CEO
    'elonmusk',       // Elon Musk
    'APompliano',     // Anthony Pompliano
    'brian_armstrong' // Brian Armstrong - Coinbase CEO
];

// Hashtags to monitor
const CRYPTO_HASHTAGS = [
    'bitcoin',
    'ethereum',
    'crypto',
    'blockchain',
    'nft',
    'defi',
    'solana',
    'binance'
];

// Coins to detect in tweets
const CRYPTO_COINS = {
    'BTC': ['bitcoin', 'btc', 'xbt', 'bitcoins'],
    'ETH': ['ethereum', 'eth', 'ether'],
    'BNB': ['binance coin', 'bnb', 'binancecoin'],
    'SOL': ['solana', 'sol'],
    'XRP': ['ripple', 'xrp'],
    'DOGE': ['dogecoin', 'doge'],
    'ADA': ['cardano', 'ada'],
    'DOT': ['polkadot', 'dot'],
    'AVAX': ['avalanche', 'avax'],
    'SHIB': ['shiba inu', 'shib', 'shibainu']
};

// Kết nối đến MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('Đã kết nối đến MongoDB!');
        return client;
    } catch (err) {
        console.error('Lỗi kết nối MongoDB:', err);
        throw err;
    }
}

// Phân tích sentiment từ nội dung tweet sử dụng ML
function analyzeSentiment(text) {
    if (!text) return 'neutral';
    
    // Sử dụng machine learning sentiment analyzer
    const result = sentimentAnalyzer.analyzeSentiment(text);
    return result.sentiment;
}

// Nhận diện coins được đề cập trong tweet
function detectCoins(text) {
    const lowerText = text.toLowerCase();
    const coins = [];
    
    for (const [coin, keywords] of Object.entries(CRYPTO_COINS)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                if (!coins.includes(coin)) {
                    coins.push(coin);
                }
                break;
            }
        }
    }
    
    return coins;
}

// Cập nhật hoặc chèn tweet vào database
async function upsertTweet(client, tweet) {
    try {
        const db = client.db(DB_NAME);
        const collection = db.collection(TWEETS_COLLECTION);
        
        // Kiểm tra xem tweet đã tồn tại chưa
        const existingTweet = await collection.findOne({ id: tweet.id });
        
        if (existingTweet) {
            // Cập nhật tweet nếu đã tồn tại
            await collection.updateOne(
                { id: tweet.id },
                { $set: tweet }
            );
            return { success: true, action: 'updated' };
        } else {
            // Chèn tweet mới nếu chưa tồn tại
            await collection.insertOne(tweet);
            return { success: true, action: 'inserted' };
        }
    } catch (error) {
        console.error('Lỗi khi upsert tweet:', error);
        return { success: false, error: error.message };
    }
}

// Lấy tweets từ tài khoản
async function fetchTweetsFromAccount(client, username, maxResults = 20) {
    // Kiểm tra rate limit trước khi thực hiện
    if (!canCrawl('userTimeline')) {
        console.log(`Rate limit exceeded for user ${username}. Skipping.`);
        return {
            success: false,
            error: 'Rate limit exceeded',
            rateLimit: getRateLimitState().userTimeline
        };
    }

    try {
        console.log(`Đang lấy tweets từ ${username}...`);
        const userTweets = await getUserTweets(username, maxResults);
        
        if (userTweets.error) {
            console.error(`Lỗi khi lấy tweets từ ${username}:`, userTweets.message);
            return { success: false, error: userTweets.message, rateLimit: userTweets.rateLimit };
        }
        
        const results = [];
        const tweetData = [];
        
        // Xử lý tweets
        for (const tweet of userTweets.data.data) {
            // Phân tích tweet
            const sentiment = analyzeSentiment(tweet.text);
            const coins = detectCoins(tweet.text);
            const hashtags = [];
            
            // Trích xuất hashtags
            if (tweet.entities && tweet.entities.hashtags) {
                for (const tag of tweet.entities.hashtags) {
                    hashtags.push(tag.tag.toLowerCase());
                }
            }
            
            const tweetObj = {
                id: tweet.id,
                text: tweet.text,
                username: username,
                createdAt: new Date(tweet.created_at),
                coins: coins,
                hashtags: hashtags,
                sentiment: sentiment,
                metrics: tweet.public_metrics ? tweet.public_metrics : {},
                updatedAt: new Date()
            };
            
            tweetData.push(tweetObj);
            
            // Lưu vào database
            const upsertResult = await upsertTweet(client, tweetObj);
            results.push({ tweet: tweet.id, result: upsertResult });
        }
        
        return { 
            success: true, 
            count: tweetData.length, 
            results: results 
        };
    } catch (error) {
        console.error(`Lỗi khi xử lý tweets từ ${username}:`, error);
        return { success: false, error: error.message };
    }
}

// Lấy tweets từ hashtag
async function fetchTweetsFromHashtag(client, hashtag, maxResults = 20) {
    // Kiểm tra rate limit trước khi thực hiện
    if (!canCrawl('search')) {
        console.log(`Rate limit exceeded for hashtag ${hashtag}. Skipping.`);
        return {
            success: false,
            error: 'Rate limit exceeded',
            rateLimit: getRateLimitState().search
        };
    }

    try {
        console.log(`Đang lấy tweets với hashtag #${hashtag}...`);
        const hashtagTweets = await searchTweets(`#${hashtag}`, maxResults);
        
        if (hashtagTweets.error) {
            console.error(`Lỗi khi lấy tweets với hashtag #${hashtag}:`, hashtagTweets.message);
            return { success: false, error: hashtagTweets.message, rateLimit: hashtagTweets.rateLimit };
        }
        
        const results = [];
        const tweetData = [];
        
        // Xử lý tweets
        for (const tweet of hashtagTweets.data.data) {
            // Lấy username từ thông tin người dùng
            const author = hashtagTweets.includes && hashtagTweets.includes.users ? 
                hashtagTweets.includes.users.find(user => user.id === tweet.author_id) : null;
            
            const username = author ? author.username : 'unknown';
            
            // Phân tích tweet
            const sentiment = analyzeSentiment(tweet.text);
            const coins = detectCoins(tweet.text);
            const hashtags = [];
            
            // Trích xuất hashtags
            if (tweet.entities && tweet.entities.hashtags) {
                for (const tag of tweet.entities.hashtags) {
                    hashtags.push(tag.tag.toLowerCase());
                }
            }
            
            // Nếu không có hashtag trong entities, thêm hashtag hiện tại
            if (hashtags.length === 0) {
                hashtags.push(hashtag);
            }
            
            const tweetObj = {
                id: tweet.id,
                text: tweet.text,
                username: username,
                createdAt: new Date(tweet.created_at),
                coins: coins,
                hashtags: hashtags,
                sentiment: sentiment,
                metrics: tweet.public_metrics ? tweet.public_metrics : {},
                updatedAt: new Date()
            };
            
            tweetData.push(tweetObj);
            
            // Lưu vào database
            const upsertResult = await upsertTweet(client, tweetObj);
            results.push({ tweet: tweet.id, result: upsertResult });
        }
        
        return { 
            success: true, 
            count: tweetData.length, 
            results: results 
        };
    } catch (error) {
        console.error(`Lỗi khi xử lý tweets với hashtag #${hashtag}:`, error);
        return { success: false, error: error.message };
    }
}

// Thống kê tổng hợp
async function generateStats(client) {
    try {
        const db = client.db(DB_NAME);
        const tweetsCollection = db.collection(TWEETS_COLLECTION);
        const statsCollection = db.collection(STATS_COLLECTION);
        
        // Số lượng tweets
        const totalTweets = await tweetsCollection.countDocuments();
        
        // Top coins
        const topCoins = await tweetsCollection.aggregate([
            { $unwind: "$coins" },
            { $group: { 
                _id: "$coins", 
                count: { $sum: 1 },
                positiveTweets: { 
                    $sum: { 
                        $cond: [{ $eq: ["$sentiment", "positive"] }, 1, 0] 
                    } 
                },
                negativeTweets: { 
                    $sum: { 
                        $cond: [{ $eq: ["$sentiment", "negative"] }, 1, 0] 
                    } 
                }
            }},
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]).toArray();
        
        // Top hashtags
        const topHashtags = await tweetsCollection.aggregate([
            { $unwind: "$hashtags" },
            { $group: { _id: "$hashtags", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]).toArray();
        
        // Top accounts
        const topAccounts = await tweetsCollection.aggregate([
            { $group: { _id: "$username", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]).toArray();
        
        // Tweets theo ngày
        const last7Days = await tweetsCollection.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();
        
        // Lưu stats
        const stats = {
            totalTweets,
            topCoins,
            topHashtags,
            topAccounts,
            last7Days,
            updatedAt: new Date()
        };
        
        await statsCollection.updateOne(
            { _id: 'latest' },
            { $set: stats },
            { upsert: true }
        );
        
        console.log('Đã cập nhật thống kê.');
        return stats;
    } catch (error) {
        console.error('Lỗi khi tạo thống kê:', error);
        return null;
    }
}

// Hiển thị thống kê
async function displayStats(client) {
    try {
        const db = client.db(DB_NAME);
        const statsCollection = db.collection(STATS_COLLECTION);
        
        // Lấy thống kê mới nhất
        const stats = await statsCollection.findOne({ _id: 'latest' });
        
        if (!stats) {
            console.log('Chưa có thống kê. Đang tạo thống kê mới...');
            return await generateStats(client);
        }
        
        console.log('=== CRYPTO TWITTER CRAWLER STATS ===');
        console.log(`Tổng số tweets: ${stats.totalTweets}`);
        
        console.log('\n=== TOP 5 COINS ===');
        stats.topCoins.slice(0, 5).forEach((coin, index) => {
            console.log(`${index + 1}. ${coin._id}: ${coin.count} tweets (${coin.positiveTweets} tích cực, ${coin.negativeTweets} tiêu cực)`);
        });
        
        console.log('\n=== TOP 5 HASHTAGS ===');
        stats.topHashtags.slice(0, 5).forEach((hashtag, index) => {
            console.log(`${index + 1}. #${hashtag._id}: ${hashtag.count} tweets`);
        });
        
        console.log('\n=== TOP 5 ACCOUNTS ===');
        stats.topAccounts.slice(0, 5).forEach((account, index) => {
            console.log(`${index + 1}. @${account._id}: ${account.count} tweets`);
        });
        
        console.log('\n=== TWEETS TRONG 7 NGÀY GẦNYYYY ===');
        stats.last7Days.forEach(day => {
            console.log(`${day._id}: ${day.count} tweets`);
        });
        
        console.log(`\nCập nhật lần cuối: ${stats.updatedAt}`);
        
        // Hiển thị trạng thái rate limit
        const rateLimitState = getRateLimitState();
        console.log('\n=== TWITTER API RATE LIMIT ===');
        console.log(`User Timeline: ${rateLimitState.userTimeline.remaining}/${rateLimitState.userTimeline.limit} (reset at ${new Date(rateLimitState.userTimeline.reset).toLocaleString()})`);
        console.log(`Search: ${rateLimitState.search.remaining}/${rateLimitState.search.limit} (reset at ${new Date(rateLimitState.search.reset).toLocaleString()})`);
        
        return stats;
    } catch (error) {
        console.error('Lỗi khi hiển thị thống kê:', error);
        return null;
    }
}

// Hàm chính để crawl dữ liệu
async function runCrawler(isOneTime = false) {
    let client;
    
    try {
        client = await connectToMongoDB();
        
        // Hiển thị thống kê ban đầu
        console.log('Thống kê ban đầu:');
        await displayStats(client);
        
        // Crawl dữ liệu từ các tài khoản
        console.log('\nĐang crawl dữ liệu từ các tài khoản...');
        for (const account of CRYPTO_ACCOUNTS) {
            const accountResult = await fetchTweetsFromAccount(client, account);
            
            if (accountResult.success) {
                console.log(`Đã crawl ${accountResult.count} tweets từ ${account}.`);
            } else {
                console.error(`Lỗi khi crawl từ ${account}: ${accountResult.error}`);
                
                // Nếu là lỗi rate limit, tạm dừng crawl
                if (accountResult.error === 'Rate limit exceeded') {
                    console.log(`Đạt giới hạn rate limit. Sẽ tiếp tục sau khi reset at ${new Date(accountResult.rateLimit.reset).toLocaleString()}.`);
                    break;
                }
            }
        }
        
        // Crawl dữ liệu từ các hashtag
        console.log('\nĐang crawl dữ liệu từ các hashtag...');
        for (const hashtag of CRYPTO_HASHTAGS) {
            const hashtagResult = await fetchTweetsFromHashtag(client, hashtag);
            
            if (hashtagResult.success) {
                console.log(`Đã crawl ${hashtagResult.count} tweets với hashtag #${hashtag}.`);
            } else {
                console.error(`Lỗi khi crawl hashtag #${hashtag}: ${hashtagResult.error}`);
                
                // Nếu là lỗi rate limit, tạm dừng crawl
                if (hashtagResult.error === 'Rate limit exceeded') {
                    console.log(`Đạt giới hạn rate limit. Sẽ tiếp tục sau khi reset at ${new Date(hashtagResult.rateLimit.reset).toLocaleString()}.`);
                    break;
                }
            }
        }
        
        // Tạo thống kê
        console.log('\nĐang tạo thống kê...');
        await generateStats(client);
        
        // Hiển thị thống kê sau khi crawl
        console.log('\nThống kê sau khi crawl:');
        await displayStats(client);
        
        // Đóng kết nối nếu chỉ chạy một lần
        if (isOneTime) {
            await client.close();
            console.log('Đã hoàn thành crawl một lần.');
        }
    } catch (error) {
        console.error('Lỗi khi chạy crawler:', error);
        
        // Đóng kết nối nếu có lỗi
        if (client) {
            await client.close();
        }
    }
}

// Chạy crawler theo lịch trình
function startScheduledCrawler() {
    console.log('Bắt đầu crawler theo lịch trình (mỗi 6 giờ)...');
    
    // Khởi tạo cron job (chạy mỗi 6 giờ)
    const job = new CronJob(
        '0 */6 * * *',    // Cron expression: 0 phút, mỗi 6 giờ, mỗi ngày
        () => {
            console.log(`\nBắt đầu crawl theo lịch trình vào ${new Date()}...`);
            runCrawler();
        },
        null,             // onComplete
        true,             // start
        'Asia/Ho_Chi_Minh'// timezone
    );
    
    // Chạy ngay lập tức một lần
    runCrawler();
}

// Hàm chính
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    
    switch (command) {
        case 'start':
            // Chạy theo lịch trình
            startScheduledCrawler();
            break;
            
        case 'run-once':
            // Chạy một lần
            await runCrawler(true);
            break;
            
        case 'stats':
            // Hiển thị thống kê
            const client = await connectToMongoDB();
            await displayStats(client);
            await client.close();
            break;
            
        case 'help':
        default:
            console.log('Crypto Twitter Crawler');
            console.log('Usage:');
            console.log('  npm run twitter:start     - Chạy crawler theo lịch trình');
            console.log('  npm run twitter:crawl     - Chạy crawler một lần');
            console.log('  npm run twitter:stats     - Hiển thị thống kê');
            break;
    }
}

// Xuất các hàm để sử dụng từ bên ngoài
module.exports = {
    runCrawler,
    generateStats,
    connectToMongoDB,
    fetchTweetsFromAccount,
    fetchTweetsFromHashtag,
    getRateLimitState,
    CRYPTO_ACCOUNTS,
    CRYPTO_HASHTAGS,
    CRYPTO_COINS
};

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
    main();
}