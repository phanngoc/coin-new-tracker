/**
 * Crypto Twitter Analytics Dashboard
 * Main JavaScript file
 */

document.addEventListener('DOMContentLoaded', function() {
    // Tooltips initialization
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Popovers initialization
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function(popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Initialize dropdowns
    const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
    const dropdownList = dropdownElementList.map(function(dropdownToggleEl) {
        return new bootstrap.Dropdown(dropdownToggleEl);
    });

    // Hiệu ứng scroll smooth cho các anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Khi cuộn trang, hiển thị nút "Back to top"
    const backToTopButton = document.getElementById('back-to-top');
    if (backToTopButton) {
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                backToTopButton.style.display = 'block';
            } else {
                backToTopButton.style.display = 'none';
            }
        });

        // Cuộn lên đầu trang khi nhấp vào nút
        backToTopButton.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Thêm active class cho các menu items dựa trên URL hiện tại
    const currentLocation = window.location.pathname;
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    const menuLength = navLinks.length;
    
    for (let i = 0; i < menuLength; i++) {
        if (navLinks[i].getAttribute('href') === currentLocation) {
            navLinks[i].classList.add('active');
        }
    }

    // Xử lý submit form tìm kiếm
    const searchForm = document.querySelector('form.search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
            const searchInput = this.querySelector('input[name="query"]');
            if (!searchInput.value.trim()) {
                event.preventDefault();
                searchInput.classList.add('is-invalid');
            } else {
                searchInput.classList.remove('is-invalid');
            }
        });
    }

    // Xử lý pagination cho các API requests
    const paginationLinks = document.querySelectorAll('.pagination .page-link');
    paginationLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.parentElement.classList.contains('disabled')) {
                e.preventDefault();
            }
        });
    });

    // Nếu không ở trang analytics, khởi tạo biểu đồ và bảng giá
    if (currentLocation !== '/analytics') {
        initCryptoChartWidget();
        loadCryptoPrices();
    }
}); 

// Danh sách dữ liệu mẫu (trong thực tế, nên lấy từ API)
const cryptoData = {
    BTC: {
        name: 'Bitcoin',
        prices: generateSampleData(50000, 65000, 100),
        volumes: generateSampleVolumes(100)
    },
    ETH: {
        name: 'Ethereum',
        prices: generateSampleData(2800, 3500, 100),
        volumes: generateSampleVolumes(100)
    },
    BNB: {
        name: 'Binance Coin',
        prices: generateSampleData(350, 450, 100),
        volumes: generateSampleVolumes(100)
    },
    SOL: {
        name: 'Solana',
        prices: generateSampleData(100, 150, 100),
        volumes: generateSampleVolumes(100)
    }
};

let cryptoChartWidget = null;
let currentCoin = 'BTC';
let currentInterval = '1d';

// Hàm tạo dữ liệu mẫu cho giá
function generateSampleData(min, max, count) {
    const data = [];
    let currentPrice = min + Math.random() * (max - min);
    
    for (let i = 0; i < count; i++) {
        const changePercent = (Math.random() - 0.5) * 0.02; // Biến động +/- 1%
        currentPrice = currentPrice * (1 + changePercent);
        currentPrice = Math.max(min * 0.9, Math.min(max * 1.1, currentPrice));
        
        const open = currentPrice;
        const close = open * (1 + (Math.random() - 0.5) * 0.01);
        const high = Math.max(open, close) * (1 + Math.random() * 0.005);
        const low = Math.min(open, close) * (1 - Math.random() * 0.005);
        
        data.push({
            time: new Date(Date.now() - (count - i) * 86400000),
            open, high, low, close
        });
    }
    
    return data;
}

// Hàm tạo dữ liệu mẫu cho khối lượng
function generateSampleVolumes(count) {
    const volumes = [];
    for (let i = 0; i < count; i++) {
        volumes.push(Math.random() * 1000 + 500);
    }
    return volumes;
}

// Hàm tính Moving Average
function calculateMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
            continue;
        }
        
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        result.push(sum / period);
    }
    return result;
}

// Hàm tính Exponential Moving Average
function calculateEMA(data, period) {
    const result = [];
    const k = 2 / (period + 1);
    
    // Dùng SMA làm giá trị EMA đầu tiên
    let ema = calculateMA(data.slice(0, period), period)[period - 1];
    
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
            continue;
        }
        
        if (i === period - 1) {
            result.push(ema);
            continue;
        }
        
        ema = data[i].close * k + ema * (1 - k);
        result.push(ema);
    }
    
    return result;
}

// Hàm khởi tạo biểu đồ giá
function initCryptoChartWidget() {
    const chartCanvas = document.getElementById('cryptoChart');
    if (!chartCanvas) return;
    
    // Kiểm tra nếu biểu đồ đã tồn tại, hủy nó trước khi tạo mới
    if (cryptoChartWidget) {
        cryptoChartWidget.destroy();
        cryptoChartWidget = null;
    }
    
    try {
        const ctx = chartCanvas.getContext('2d');
        
        // Khởi tạo biểu đồ nến
        cryptoChartWidget = new Chart(ctx, {
            type: 'candlestick',
            data: {
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        },
                        adapters: {
                            date: {
                                locale: 'vi'
                            }
                        }
                    },
                    y: {
                        position: 'right'
                    },
                    volume: {
                        position: 'left',
                        display: true,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
        
        // Cập nhật dữ liệu ban đầu
        updateChartData(currentCoin);
        
        // Xử lý các nút chọn coin
        document.querySelectorAll('[data-coin]').forEach(button => {
            button.addEventListener('click', function() {
                document.querySelectorAll('[data-coin]').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentCoin = this.getAttribute('data-coin');
                updateChartData(currentCoin);
            });
        });
        
        // Xử lý các nút chọn khoảng thời gian
        document.querySelectorAll('[data-interval]').forEach(button => {
            button.addEventListener('click', function() {
                document.querySelectorAll('[data-interval]').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentInterval = this.getAttribute('data-interval');
                updateChartData(currentCoin);
            });
        });
        
        // Xử lý các checkbox hiển thị chỉ báo
        document.getElementById('showMA')?.addEventListener('change', function() {
            updateChartData(currentCoin);
        });
        
        document.getElementById('showEMA')?.addEventListener('change', function() {
            updateChartData(currentCoin);
        });
        
        document.getElementById('showVolume')?.addEventListener('change', function() {
            updateChartData(currentCoin);
        });
    } catch (error) {
        console.error('Lỗi khi khởi tạo biểu đồ:', error);
    }
}

// Hàm cập nhật dữ liệu biểu đồ
// function updateChartData(coin) {
//     if (!cryptoChartWidget || !cryptoData[coin]) return;
    
//     const data = cryptoData[coin].prices;
//     const showMA = document.getElementById('showMA')?.checked ?? true;
//     const showEMA = document.getElementById('showEMA')?.checked ?? true;
//     const showVolume = document.getElementById('showVolume')?.checked ?? true;
    
//     // Xóa dữ liệu cũ
//     cryptoChartWidget.data.datasets = [];
    
//     // Thêm dữ liệu nến
//     cryptoChartWidget.data.datasets.push({
//         label: `${coin} Price`,
//         data: data.map(d => ({
//             x: d.time,
//             o: d.open,
//             h: d.high,
//             l: d.low,
//             c: d.close
//         })),
//         type: 'candlestick',
//         candleStick: {
//             color: {
//                 up: 'rgba(75, 192, 192, 1)',
//                 down: 'rgba(255, 99, 132, 1)',
//                 unchanged: 'rgba(90, 90, 90, 1)',
//             }
//         }
//     });
    
//     // Thêm đường MA nếu được chọn
//     if (showMA) {
//         const ma7 = calculateMA(data, 7);
//         const ma25 = calculateMA(data, 25);
        
//         cryptoChartWidget.data.datasets.push({
//             label: 'MA(7)',
//             data: ma7.map((value, index) => ({ x: data[index]?.time, y: value })),
//             borderColor: 'rgba(255, 159, 64, 1)',
//             borderWidth: 2,
//             fill: false,
//             tension: 0.1,
//             pointRadius: 0,
//             type: 'line',
//             yAxisID: 'y'
//         });
        
//         cryptoChartWidget.data.datasets.push({
//             label: 'MA(25)',
//             data: ma25.map((value, index) => ({ x: data[index]?.time, y: value })),
//             borderColor: 'rgba(153, 102, 255, 1)',
//             borderWidth: 2,
//             fill: false,
//             tension: 0.1,
//             pointRadius: 0,
//             type: 'line',
//             yAxisID: 'y'
//         });
//     }
    
//     // Thêm đường EMA nếu được chọn
//     if (showEMA) {
//         const ema7 = calculateEMA(data, 7);
//         const ema25 = calculateEMA(data, 25);
        
//         cryptoChartWidget.data.datasets.push({
//             label: 'EMA(7)',
//             data: ema7.map((value, index) => ({ x: data[index]?.time, y: value })),
//             borderColor: 'rgba(54, 162, 235, 1)',
//             borderWidth: 2,
//             fill: false,
//             tension: 0.1,
//             pointRadius: 0,
//             type: 'line',
//             borderDash: [5, 5],
//             yAxisID: 'y'
//         });
        
//         cryptoChartWidget.data.datasets.push({
//             label: 'EMA(25)',
//             data: ema25.map((value, index) => ({ x: data[index]?.time, y: value })),
//             borderColor: 'rgba(255, 206, 86, 1)',
//             borderWidth: 2,
//             fill: false,
//             tension: 0.1,
//             pointRadius: 0,
//             type: 'line',
//             borderDash: [5, 5],
//             yAxisID: 'y'
//         });
//     }
    
//     // Thêm khối lượng nếu được chọn
//     if (showVolume && cryptoData[coin].volumes) {
//         cryptoChartWidget.data.datasets.push({
//             label: 'Volume',
//             data: cryptoData[coin].volumes.map((value, index) => ({ x: data[index]?.time, y: value })),
//             backgroundColor: 'rgba(75, 192, 192, 0.2)',
//             type: 'bar',
//             yAxisID: 'volume'
//         });
//     }
    
//     // Cập nhật biểu đồ
//     cryptoChartWidget.update();
// }

// Hàm tải bảng giá
function loadCryptoPrices() {
    const priceTable = document.getElementById('crypto-price-table');
    if (!priceTable) return;
    
    // Trong thực tế, dữ liệu sẽ được lấy từ API
    const coins = [
        { symbol: 'BTC', name: 'Bitcoin', price: 61234.56, change24h: 2.45, volume24h: 32500000000, marketCap: 1250000000000 },
        { symbol: 'ETH', name: 'Ethereum', price: 3245.78, change24h: 1.23, volume24h: 18700000000, marketCap: 365000000000 },
        { symbol: 'BNB', name: 'Binance Coin', price: 412.34, change24h: -0.87, volume24h: 2300000000, marketCap: 68000000000 },
        { symbol: 'SOL', name: 'Solana', price: 124.56, change24h: 3.67, volume24h: 3400000000, marketCap: 42000000000 },
        { symbol: 'XRP', name: 'Ripple', price: 0.5678, change24h: -1.23, volume24h: 1800000000, marketCap: 28000000000 }
    ];
    
    // Xóa spinner và hiển thị dữ liệu
    priceTable.innerHTML = '';
    
    coins.forEach(coin => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <img src="https://cryptologos.cc/logos/${coin.name.toLowerCase()}-${coin.symbol.toLowerCase()}-logo.png" 
                         alt="${coin.symbol}" width="24" height="24" class="me-2" 
                         onerror="this.onerror=null; this.src='/images/default-coin.png';">
                    <strong>${coin.symbol}</strong>
                </div>
            </td>
            <td>$${coin.price.toLocaleString()}</td>
            <td class="${coin.change24h >= 0 ? 'text-success' : 'text-danger'}">
                ${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%
            </td>
            <td>$${(coin.volume24h / 1000000).toFixed(0)}M</td>
            <td>$${(coin.marketCap / 1000000000).toFixed(0)}B</td>
        `;
        
        priceTable.appendChild(tr);
    });
} 