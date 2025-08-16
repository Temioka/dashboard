// Основной класс для управления страницей ООДВГК
class OODVGKDashboard {
    constructor() {
        this.statistics = [];
        this.chartData = null;
        this.summary = null;
        this.charts = {};
        
        this.init();
    }
    
    async init() {
        try {
            console.log('[DEBUG] Initializing OODVGK Dashboard');
            
            // Создаем основную структуру страницы
            this.createPageStructure();
            
            // Показываем загрузку с анимацией
            this.showAnimatedLoading();
            
            // Загружаем все данные сразу
            await this.loadAllData();
            
            // Показываем страницу с анимацией
            this.showMainContentWithAnimation();
            
            console.log('[DEBUG] OODVGK Dashboard initialized successfully');
            
        } catch (error) {
            console.error('[ERROR] Failed to initialize OODVGK Dashboard:', error);
            this.showError('Ошибка при инициализации страницы');
        }
    }
    
    createPageStructure() {
        const mainContent = document.getElementById('mainContent');
        
        mainContent.innerHTML = `
            <h1 class="department-title">Отдел обработки данных весового и габаритного контроля</h1>

            <ul class="breadcrumbs">
                <li class="breadcrumbs__item">
                    <a href="/index.html" class="breadcrumbs__link">Главная</a>
                    <span class="breadcrumbs__separator"></span>
                </li>
                <li class="breadcrumbs__item">
                    <span class="breadcrumbs__current">Отдел обработки данных весового и габаритного контроля</span>
                </li>
            </ul>

            <!-- Информационная панель -->
            <div class="info-panel-orange">
                <div class="info-content">
                    <div class="info-header">
                        <div class="info-icon-wrapper">
                            <svg class="info-icon" viewBox="0 0 24 24" fill="none">
                                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="info-text">
                            <h2 id="periodTitle" class="info-title">Статистика ООДВГК</h2>
                        </div>
                    </div>
                    <div class="info-details">
                        <div class="info-date">
                            <svg class="date-icon" viewBox="0 0 24 24" fill="none">
                                <path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span class="current-date-text" id="currentDate"></span>
                        </div>
                        <div class="info-update">
                            <div class="update-indicator">
                                <div class="pulse-ring"></div>
                                <div class="pulse-dot"></div>
                            </div>
                            <span class="last-update" id="lastUpdate">Последнее обновление: загрузка...</span>
                        </div>
                    </div>
                </div>
                <div class="orange-pattern">
                    <div class="pattern-shape shape-1"></div>
                    <div class="pattern-shape shape-2"></div>
                    <div class="pattern-shape shape-3"></div>
                    <div class="pattern-shape shape-4"></div>
                </div>
            </div>

            <!-- Основные метрики в одну линию -->
            <div class="metrics-container">
                <div class="metrics-row-orange" id="metricsGrid">
                    <div class="loading-state">
                        <div class="orange-loader">
                            <div class="loader-ring"></div>
                            <div class="loader-ring"></div>
                            <div class="loader-ring"></div>
                        </div>
                        <p class="loading-text">Загрузка статистики...</p>
                    </div>
                </div>
            </div>

            <!-- Детальная аналитика -->
            <div class="analytics-section">
                <div class="glass-panel">
                    <div class="tabs-wrapper">
                        <div class="orange-tabs">
                            <button class="orange-tab active" data-tab="charts">
                                <svg class="tab-icon" viewBox="0 0 24 24" fill="none">
                                    <path d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span class="tab-label">Графики и диаграммы</span>
                            </button>
                            <button class="orange-tab" data-tab="efficiency">
                                <svg class="tab-icon" viewBox="0 0 24 24" fill="none">
                                    <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span class="tab-label">Показатели эффективности</span>
                            </button>
                        </div>
                    </div>

                    <!-- Контент вкладок -->
                    <div class="tab-content active" id="chartsTab">
                        <div class="tab-content-wrapper">
                            <div class="content-header">
                                <h4>Визуализация данных</h4>
                                <p>Графическое представление статистики работы отдела</p>
                            </div>
                            <div class="charts-grid">
                                <div class="chart-container">
                                    <div class="chart-header">
                                        <h5>Обработка нарушений</h5>
                                        <div class="chart-status">
                                            <div class="status-dot active"></div>
                                            <span>Активно</span>
                                        </div>
                                    </div>
                                    <div class="chart-body">
                                        <div class="chart-loading" id="violationsChartLoading">
                                            <div class="mini-loader"></div>
                                            <span>Загрузка графика...</span>
                                        </div>
                                        <canvas id="violationsChart" style="display: none;"></canvas>
                                    </div>
                                </div>
                                <div class="chart-container">
                                    <div class="chart-header">
                                        <h5>Финансовые показатели</h5>
                                        <div class="chart-status">
                                            <div class="status-dot active"></div>
                                            <span>Активно</span>
                                        </div>
                                    </div>
                                    <div class="chart-body">
                                        <div class="chart-loading" id="paymentsChartLoading">
                                            <div class="mini-loader"></div>
                                            <span>Загрузка графика...</span>
                                        </div>
                                        <canvas id="paymentsChart" style="display: none;"></canvas>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="tab-content" id="efficiencyTab">
                        <div class="tab-content-wrapper">
                            <div class="content-header">
                                <h4>Показатели эффективности</h4>
                                <p>Ключевые метрики производительности и результативности</p>
                            </div>
                            <div class="efficiency-grid" id="efficiencyMetrics">
                                <div class="skeleton-loader">
                                    <div class="skeleton-efficiency"></div>
                                    <div class="skeleton-efficiency"></div>
                                    <div class="skeleton-efficiency"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Стили -->
            <style>
                /* Анимации */
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes slideInLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes orangeGlow {
                    0%, 100% {
                        box-shadow: 0 0 20px rgba(249, 115, 22, 0.3);
                    }
                    50% {
                        box-shadow: 0 0 30px rgba(249, 115, 22, 0.6);
                    }
                }

                @keyframes pulseRing {
                    0% {
                        transform: scale(0.33);
                    }
                    80%, 100% {
                        opacity: 0;
                    }
                }

                @keyframes pulseDot {
                    0% {
                        transform: scale(0.8);
                    }
                    50% {
                        transform: scale(1);
                    }
                    100% {
                        transform: scale(0.8);
                    }
                }

                @keyframes floatPattern {
                    0%, 100% {
                        transform: translateY(0px) rotate(0deg);
                    }
                    33% {
                        transform: translateY(-15px) rotate(120deg);
                    }
                    66% {
                        transform: translateY(-7px) rotate(240deg);
                    }
                }

                @keyframes shimmerOrange {
                    0% {
                        background-position: -200px 0;
                    }
                    100% {
                        background-position: calc(200px + 100%) 0;
                    }
                }

                @keyframes rotateLoader {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }

                @keyframes miniSpin {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }

                /* Информационная панель */
                .info-panel-orange {
                    background: linear-gradient(135deg, #ea580c 0%, #dc2626 25%, #c2410c 50%, #9a3412 75%, #7c2d12 100%);
                    border-radius: 20px;
                    padding: 30px;
                    margin: 30px 0;
                    color: white;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 
                        0 25px 50px -12px rgba(234, 88, 12, 0.25),
                        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
                    animation: fadeInUp 0.8s ease-out 0.2s both;
                }

                .info-content {
                    position: relative;
                    z-index: 2;
                }

                .info-header {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 25px;
                }

                .info-icon-wrapper {
                    width: 60px;
                    height: 60px;
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    animation: orangeGlow 3s ease-in-out infinite;
                }

                .info-icon {
                    width: 32px;
                    height: 32px;
                    color: white;
                    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
                }

                .info-text {
                    flex: 1;
                }

                .info-title {
                    font-size: 26px;
                    font-weight: 700;
                    margin: 0 0 5px 0;
                    color: white;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .info-subtitle {
                    font-size: 16px;
                    opacity: 0.9;
                    font-weight: 500;
                }

                .info-details {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 20px;
                }

                .info-date {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(255, 255, 255, 0.1);
                    padding: 10px 15px;
                    border-radius: 25px;
                    backdrop-filter: blur(10px);
                }

                .date-icon {
                    width: 18px;
                    height: 18px;
                    color: white;
                }

                .current-date-text {
                    font-size: 14px;
                    font-weight: 500;
                    color: white;
                }

                .info-update {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .update-indicator {
                    position: relative;
                    width: 16px;
                    height: 16px;
                }

                .pulse-ring {
                    position: absolute;
                    width: 16px;
                    height: 16px;
                    border: 2px solid #10b981;
                    border-radius: 50%;
                    animation: pulseRing 1.25s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
                }

                .pulse-dot {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    width: 8px;
                    height: 8px;
                    background: #10b981;
                    border-radius: 50%;
                    animation: pulseDot 1.25s cubic-bezier(0.455, 0.03, 0.515, 0.955) -0.4s infinite;
                }

                .last-update {
                    font-size: 14px;
                    opacity: 0.9;
                    font-weight: 500;
                }

                .orange-pattern {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 1;
                    overflow: hidden;
                }

                .pattern-shape {
                    position: absolute;
                    background: rgba(255, 255, 255, 0.08);
                    border-radius: 50%;
                }

                .shape-1 {
                    width: 120px;
                    height: 120px;
                    top: -60px;
                    right: -40px;
                    animation: floatPattern 8s ease-in-out infinite;
                }

                .shape-2 {
                    width: 80px;
                    height: 80px;
                    bottom: -30px;
                    left: 60px;
                    animation: floatPattern 6s ease-in-out infinite reverse;
                }

                .shape-3 {
                    width: 60px;
                    height: 60px;
                    top: 40%;
                    right: 120px;
                    animation: floatPattern 7s ease-in-out infinite;
                }

                .shape-4 {
                    width: 40px;
                    height: 40px;
                    top: 20%;
                    left: 20%;
                    animation: floatPattern 9s ease-in-out infinite reverse;
                }

                /* Метрики в одну линию */
                .metrics-container {
                    margin: 40px 0;
                    animation: fadeInUp 0.8s ease-out 0.4s both;
                }

                .metrics-row-orange {
                    display: flex;
                    gap: 20px;
                    justify-content: center;
                    align-items: stretch;
                    flex-wrap: wrap;
                    max-width: 1600px;
                    margin: 0 auto;
                }

                .orange-metric-card {
                    background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
                    border-radius: 20px;
                    padding: 25px;
                    color: white;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 
                        0 10px 25px rgba(234, 88, 12, 0.3),
                        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    opacity: 0;
                    transform: translateY(30px);
                    flex: 1;
                    min-width: 280px;
                    max-width: 300px;
                    display: flex;
                    flex-direction: column;
                    text-align: center;
                }

                .orange-metric-card.animate-in {
                    opacity: 1;
                    transform: translateY(0);
                }

                .orange-metric-card:hover {
                    transform: translateY(-10px) scale(1.02);
                    box-shadow: 
                        0 20px 40px rgba(234, 88, 12, 0.4),
                        0 0 0 1px rgba(255, 255, 255, 0.2) inset;
                }

                .orange-metric-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
                    transition: left 0.5s;
                }

                .orange-metric-card:hover::before {
                    left: 100%;
                }

                .metric-header {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .metric-icon-container {
                    width: 60px;
                    height: 60px;
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    position: relative;
                    overflow: hidden;
                }

                .metric-icon-svg {
                    width: 30px;
                    height: 30px;
                    color: white;
                    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
                    z-index: 2;
                }

                .metric-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: white;
                    margin: 0;
                    opacity: 0.95;
                    line-height: 1.3;
                    text-align: center;
                }

                .metric-value {
                    font-size: 32px;
                    font-weight: 800;
                    color: white;
                    margin: 15px 0;
                    line-height: 1;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    font-family: 'SF Pro Display', -apple-system, system-ui, sans-serif;
                }

                .metric-description {
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.8);
                    margin: 0;
                    line-height: 1.4;
                    font-weight: 500;
                    text-align: center;
                    margin-top: auto;
                }

                /* Загрузчик */
                .loading-state {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 80px 20px;
                }

                .orange-loader {
                    position: relative;
                    width: 60px;
                    height: 60px;
                    margin-bottom: 30px;
                }

                .loader-ring {
                    position: absolute;
                    border: 3px solid transparent;
                    border-top: 3px solid #ea580c;
                    border-radius: 50%;
                    animation: rotateLoader 1s linear infinite;
                }

                .loader-ring:nth-child(1) {
                    width: 60px;
                    height: 60px;
                    animation-delay: 0s;
                }

                .loader-ring:nth-child(2) {
                    width: 40px;
                    height: 40px;
                    top: 10px;
                    left: 10px;
                    animation-delay: -0.3s;
                    border-top-color: #f97316;
                }

                .loader-ring:nth-child(3) {
                    width: 20px;
                    height: 20px;
                    top: 20px;
                    left: 20px;
                    animation-delay: -0.6s;
                    border-top-color: #fb923c;
                }

                .loading-text {
                    color: #6b7280;
                    font-size: 18px;
                    font-weight: 600;
                }

                /* Мини-загрузчик для графиков */
                .chart-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 300px;
                    color: rgba(255, 255, 255, 0.8);
                    gap: 15px;
                }

                .mini-loader {
                    width: 30px;
                    height: 30px;
                    border: 3px solid rgba(255, 255, 255, 0.3);
                    border-top: 3px solid rgba(255, 255, 255, 0.8);
                    border-radius: 50%;
                    animation: miniSpin 1s linear infinite;
                }

                /* Аналитика */
                .analytics-section {
                    margin: 50px 0;
                    animation: fadeInUp 0.8s ease-out 0.6s both;
                }

                .glass-panel {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(20px);
                    border-radius: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 
                        0 25px 50px -12px rgba(0, 0, 0, 0.25),
                        0 0 0 1px rgba(255, 255, 255, 0.05) inset;
                    overflow: hidden;
                }

                /* Табы (теперь только 2) */
                .orange-tabs {
                    display: flex;
                    background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
                    position: relative;
                }

                .orange-tab {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 20px 15px;
                    border: none;
                    background: transparent;
                    color: #9a3412;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                    z-index: 1;
                }

                .orange-tab:hover:not(.active) {
                    background: rgba(234, 88, 12, 0.1);
                    color: #ea580c;
                }

                .orange-tab.active {
                    background: white;
                    color: #ea580c;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
                }

                .tab-icon {
                    width: 20px;
                    height: 20px;
                }

                .tab-label {
                    font-size: 14px;
                    font-weight: 600;
                }

                /* Контент */
                .tab-content {
                    display: none;
                    min-height: 500px;
                }

                .tab-content.active {
                    display: block;
                    animation: fadeInUp 0.5s ease-out;
                }

                .tab-content-wrapper {
                    padding: 40px;
                }

                .content-header {
                    text-align: center;
                    margin-bottom: 40px;
                }

                .content-header h4 {
                    font-size: 28px;
                    font-weight: 700;
                    color: #1f2937;
                    margin: 0 0 10px 0;
                }

                .content-header p {
                    color: #6b7280;
                    font-size: 16px;
                    margin: 0;
                    font-weight: 500;
                }

                /* Графики */
                .charts-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
                    gap: 30px;
                }

                .chart-container {
                    background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
                    border-radius: 20px;
                    padding: 25px;
                    color: white;
                    box-shadow: 
                        0 10px 25px rgba(234, 88, 12, 0.3),
                        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
                    position: relative;
                    overflow: hidden;
                }

                .chart-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 25px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                }

                .chart-header h5 {
                    font-size: 18px;
                    font-weight: 600;
                    color: white;
                    margin: 0;
                }

                .chart-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.8);
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #10b981;
                }

                .status-dot.active {
                    animation: pulseDot 2s infinite;
                }

                .chart-body {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 20px;
                    height: 300px;
                    position: relative;
                    backdrop-filter: blur(10px);
                }

                /* Эффективность */
                .efficiency-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 30px;
                }

                .efficiency-card-orange {
                    background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
                    border-radius: 20px;
                    padding: 40px;
                    color: white;
                    text-align: center;
                    box-shadow: 
                        0 15px 35px rgba(234, 88, 12, 0.3),
                        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
                    transition: all 0.4s ease;
                    position: relative;
                    overflow: hidden;
                }

                .efficiency-card-orange:hover {
                    transform: translateY(-12px) scale(1.02);
                    box-shadow: 
                        0 25px 50px rgba(234, 88, 12, 0.4),
                        0 0 0 1px rgba(255, 255, 255, 0.2) inset;
                }

                .efficiency-icon-wrapper {
                    width: 80px;
                    height: 80px;
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 25px;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }

                .efficiency-icon-svg {
                    width: 40px;
                    height: 40px;
                    color: white;
                    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
                }

                .efficiency-percentage {
                    font-size: 48px;
                    font-weight: 800;
                    margin: 25px 0;
                    line-height: 1;
                    color: white;
                    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }

                .efficiency-label {
                    font-size: 16px;
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0;
                    font-weight: 600;
                }

                /* Скелетоны */
                .skeleton-efficiency {
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200px 100%;
                    animation: shimmerOrange 1.5s infinite;
                    height: 200px;
                    border-radius: 20px;
                }

                /* Адаптивность */
                @media (max-width: 1400px) {
                    .metrics-row-orange {
                        gap: 15px;
                    }
                    
                    .orange-metric-card {
                        min-width: 220px;
                        max-width: 250px;
                        padding: 20px;
                    }
                    
                    .metric-value {
                        font-size: 28px;
                    }
                }

                @media (max-width: 1200px) {
                    .metrics-row-orange {
                        flex-wrap: wrap;
                        justify-content: center;
                    }
                    
                    .orange-metric-card {
                        min-width: 280px;
                        max-width: 300px;
                    }
                }

                @media (max-width: 768px) {
                    .info-panel-orange {
                        padding: 25px 20px;
                    }

                    .info-header {
                        flex-direction: column;
                        text-align: center;
                        gap: 15px;
                    }

                    .info-details {
                        flex-direction: column;
                        align-items: center;
                        gap: 15px;
                    }

                    .metrics-row-orange {
                        flex-direction: column;
                        align-items: center;
                    }

                    .orange-metric-card {
                        min-width: 100%;
                        max-width: 400px;
                    }

                    .orange-tabs {
                        flex-direction: column;
                    }

                    .tab-content-wrapper {
                        padding: 30px 20px;
                    }

                    .charts-grid {
                        grid-template-columns: 1fr;
                    }

                    .efficiency-grid {
                        grid-template-columns: 1fr;
                    }
                }

                /* Дополнительные анимации появления */
                .orange-metric-card:nth-child(1) { animation-delay: 0.1s; }
                .orange-metric-card:nth-child(2) { animation-delay: 0.2s; }
                .orange-metric-card:nth-child(3) { animation-delay: 0.3s; }
                .orange-metric-card:nth-child(4) { animation-delay: 0.4s; }
                .orange-metric-card:nth-child(5) { animation-delay: 0.5s; }
            </style>
        `;
        
        // Устанавливаем текущую дату
        this.updateCurrentDate();
        
        // Инициализируем переключение вкладок
        this.initTabs();
    }
    
    // Получение SVG иконок
    getMetricIcon(iconType) {
        const icons = {
            violations: `<svg viewBox="0 0 24 24" fill="none" class="metric-icon-svg">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`,
            transfer: `<svg viewBox="0 0 24 24" fill="none" class="metric-icon-svg">
                <path d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`,
            resolutions: `<svg viewBox="0 0 24 24" fill="none" class="metric-icon-svg">
                <path d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`,
            money: `<svg viewBox="0 0 24 24" fill="none" class="metric-icon-svg">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`,
            paid: `<svg viewBox="0 0 24 24" fill="none" class="metric-icon-svg">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`
        };
        
        return icons[iconType] || icons.violations;
    }
    
    getEfficiencyIcon(iconType) {
        const icons = {
            transfer: `<svg viewBox="0 0 24 24" fill="none" class="efficiency-icon-svg">
                <path d="M7 16l-4-4m0 0l4-4m-4 4h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`,
            payment: `<svg viewBox="0 0 24 24" fill="none" class="efficiency-icon-svg">
                <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`,
            resolution: `<svg viewBox="0 0 24 24" fill="none" class="efficiency-icon-svg">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`
        };
        
        return icons[iconType] || icons.transfer;
    }
    
    updateCurrentDate() {
        const now = new Date();
        const dateOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        const currentDateElement = document.getElementById('currentDate');
        if (currentDateElement) {
            currentDateElement.textContent = `${now.toLocaleDateString('ru-RU', dateOptions)}`;
        }
    }
    
    initTabs() {
        const tabButtons = document.querySelectorAll('.orange-tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Убираем активность со всех кнопок и контента
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Активируем выбранную вкладку
                button.classList.add('active');
                const targetContent = document.getElementById(`${tabId}Tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                // Графики уже будут загружены, не нужно перерисовывать
            });
        });
    }
    
    // Главное изменение - загружаем все данные сразу
    async loadAllData() {
        try {
            console.log('[DEBUG] Loading all OODVGK data at once');
            
            const response = await fetch('/api/oodvgk-stats');
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Ошибка при загрузке данных');
            }
            
            this.statistics = result.data.statistics || [];
            this.chartData = result.data.chartData || null;
            this.summary = result.data.summary || null;
            
            // Обновляем все компоненты последовательно с анимацией
            setTimeout(() => {
                this.updateMetricsWithAnimation();
                this.updateLastUpdate(result.data.recordInfo);
                this.updatePeriodTitle(result.data.recordInfo);
            }, 300);
            
            // Создаем графики сразу после загрузки данных
            setTimeout(() => {
                this.createChartsWithLoading();
            }, 600);
            
            // Загружаем показатели эффективности
            setTimeout(() => {
                this.updateEfficiencyMetrics();
            }, 900);
            
            console.log('[DEBUG] Successfully loaded all OODVGK data');
            
        } catch (error) {
            console.error('[ERROR] Failed to load OODVGK data:', error);
            this.showError('Ошибка при загрузке данных');
        }
    }
    
    showAnimatedLoading() {
        // Загрузка уже показана в HTML
    }
    
    updateMetricsWithAnimation() {
        const metricsGrid = document.getElementById('metricsGrid');
        if (!metricsGrid || !this.statistics.length) return;
        
        metricsGrid.innerHTML = '';
        
        this.statistics.forEach((metric, index) => {
            const card = document.createElement('div');
            card.className = 'orange-metric-card';
            
            const value = metric.format === 'currency' 
                ? this.formatCurrency(metric.value)
                : this.formatNumber(metric.value);
            
            card.innerHTML = `
                <div class="metric-header">
                    <div class="metric-icon-container">
                        ${this.getMetricIcon(metric.icon)}
                    </div>
                    <h3 class="metric-title">${metric.title}</h3>
                </div>
                <div class="metric-value">${value}</div>
                <p class="metric-description">${metric.description}</p>
            `;
            
            metricsGrid.appendChild(card);
            
            // Анимация появления
            setTimeout(() => {
                card.classList.add('animate-in');
            }, index * 150);
        });
    }
    
    updateEfficiencyMetrics() {
        const efficiencyMetrics = document.getElementById('efficiencyMetrics');
        if (!efficiencyMetrics || !this.chartData?.efficiencyMetrics) return;
        
        const metrics = this.chartData.efficiencyMetrics;
        
        const cards = [
            { 
                label: 'Доля передачи в КНО', 
                value: metrics.transferRate,
                icon: 'transfer'
            },
            { 
                label: 'Доля оплаты штрафов', 
                value: metrics.paymentRate,
                icon: 'payment'
            },
            { 
                label: 'Эффективность постановлений', 
                value: metrics.resolutionRate,
                icon: 'resolution'
            }
        ];
        
        efficiencyMetrics.innerHTML = cards.map(card => `
            <div class="efficiency-card-orange">
                <div class="efficiency-icon-wrapper">
                    ${this.getEfficiencyIcon(card.icon)}
                </div>
                <div class="efficiency-percentage">
                    ${card.value}%
                </div>
                <p class="efficiency-label">${card.label}</p>
            </div>
        `).join('');
    }
    
    updateLastUpdate(recordInfo) {
        const lastUpdateElement = document.getElementById('lastUpdate');
        if (!lastUpdateElement || !recordInfo) return;
        
        const updateDate = new Date(recordInfo.updatedAt);
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit'
        };
        
        lastUpdateElement.textContent = `Последнее обновление: ${updateDate.toLocaleDateString('ru-RU')} в ${updateDate.toLocaleTimeString('ru-RU', timeOptions)}`;
    }
    
    updatePeriodTitle(recordInfo) {
        const periodTitleElement = document.getElementById('periodTitle');
        if (!periodTitleElement || !recordInfo) return;
        
        periodTitleElement.textContent = `Статистика ООДВГК за 2025 год`;
    }
    
    // Создаем графики с показом загрузки
    createChartsWithLoading() {
        if (!this.chartData) return;
        
        // Создаем график нарушений
        this.createViolationsChart();
        
        // Создаем график платежей с небольшой задержкой
        setTimeout(() => {
            this.createPaymentsChart();
        }, 500);
    }
    
    createViolationsChart() {
        const violationsCtx = document.getElementById('violationsChart');
        const loadingElement = document.getElementById('violationsChartLoading');
        
        if (!violationsCtx || !this.chartData) return;
        
        // Скрываем загрузку и показываем график
        setTimeout(() => {
            if (loadingElement) loadingElement.style.display = 'none';
            violationsCtx.style.display = 'block';
            
            this.charts.violations = new Chart(violationsCtx, {
                type: 'bar',
                data: {
                    labels: this.chartData.violationsChart.labels,
                    datasets: [{
                        data: this.chartData.violationsChart.data,
                        backgroundColor: ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.5)'],
                        borderColor: ['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.6)'],
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1500,
                        easing: 'easeOutQuart'
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.8)',
                                callback: (value) => this.formatNumber(value)
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.8)'
                            }
                        }
                    }
                }
            });
        }, 1000);
    }
    
    createPaymentsChart() {
        const paymentsCtx = document.getElementById('paymentsChart');
        const loadingElement = document.getElementById('paymentsChartLoading');
        
        if (!paymentsCtx || !this.chartData) return;
        
        // Скрываем загрузку и показываем график
        setTimeout(() => {
            if (loadingElement) loadingElement.style.display = 'none';
            paymentsCtx.style.display = 'block';
            
            this.charts.payments = new Chart(paymentsCtx, {
                type: 'doughnut',
                data: {
                    labels: this.chartData.paymentsChart.labels,
                    datasets: [{
                        data: this.chartData.paymentsChart.data,
                        backgroundColor: ['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.9)'],
                        borderColor: ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 1)'],
                        borderWidth: 2,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1500,
                        easing: 'easeOutQuart'
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: {
                                    size: 14
                                },
                                color: 'rgba(255, 255, 255, 0.9)'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    return `${context.label}: ${this.formatCurrency(context.raw)}`;
                                }
                            }
                        }
                    }
                }
            });
        }, 1000);
    }
    
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        this.charts = {};
    }
    
    formatNumber(number) {
        return new Intl.NumberFormat('ru-RU').format(number);
    }
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
    
    showMainContentWithAnimation() {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.style.display = 'block';
            mainContent.classList.add('fade-active');
        }
    }
    
    showError(message) {
        const metricsGrid = document.getElementById('metricsGrid');
        if (metricsGrid) {
            metricsGrid.innerHTML = `
                <div class="loading-state">
                    <p style="color: #ef4444; font-size: 18px; font-weight: 600;">❌ ${message}</p>
                </div>
            `;
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, что мы на правильной странице
    if (window.location.pathname.includes('oodvgk') || 
        document.getElementById('mainContent')) {
        
        // Подключаем Chart.js если не подключен
        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => {
                new OODVGKDashboard();
            };
            document.head.appendChild(script);
        } else {
            new OODVGKDashboard();
        }
    }
});

// Обработка обновления страницы
window.addEventListener('beforeunload', () => {
    // Очищаем графики при закрытии страницы
    if (window.oodvgkDashboard) {
        window.oodvgkDashboard.destroyCharts();
    }
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OODVGKDashboard;
}