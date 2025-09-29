class VerificationDashboard {
    constructor() {
        // Основные параметры
        this.currentTab = 'general';
        this.currentPeriod = '7';
        this.user = 'User';
        this.timestamp = this.getCurrentTimestamp();
        
        // Коллекции для управления
        this.charts = new Map();
        this.miniCharts = new Map();
        this.pendingCharts = new Map();
        this.data = new Map();
        this.isLoading = false;
        this.animationQueue = [];
        this.isChartReady = typeof Chart !== 'undefined';
        
        // Конфигурация
        this.config = {
            colors: {
                primary: '#ff6b35',
                secondary: '#ff8555', 
                success: '#10b981',
                warning: '#f59e0b',
                danger: '#ef4444',
                neutral: '#6b7280',
                background: 'rgba(255, 107, 53, 0.1)'
            },
            animation: {
                duration: 1200,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                staggerDelay: 100
            },
            apiEndpoint: '/api/verification-stats'
        };
        
        this.initialize();
    }
    
    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКА
    // ==========================================
    
    async initialize() {
        try {
            this.setupAnimationStyles();
            this.applyTableStyles();
            this.setupEventListeners();
            this.startTimeDisplay();
            
            await this.animateInitialization();
            await this.loadInitialData();
            
        } catch (error) {
            this.handleError('Ошибка инициализации', error);
        }
    }
    
    setupAnimationStyles() {
        const styleId = 'verif-animation-styles';
        if (document.getElementById(styleId)) return;
        
        const animationStyles = document.createElement('style');
        animationStyles.id = styleId;
        animationStyles.textContent = `
            :root {
                --verif-primary: #ff6b35;
                --verif-primary-light: #ff8555;
                --verif-primary-dark: #e85a2b;
                --verif-secondary: #f59e0b;
                --verif-success: #10b981;
                --verif-danger: #ef4444;
                --verif-warning: #f59e0b;
                --verif-info: #3b82f6;
                --verif-gray-50: #f9fafb;
                --verif-gray-100: #f3f4f6;
                --verif-gray-200: #e5e7eb;
                --verif-gray-300: #d1d5db;
                --verif-gray-400: #9ca3af;
                --verif-gray-500: #6b7280;
                --verif-gray-600: #4b5563;
                --verif-gray-700: #374151;
                --verif-gray-800: #1f2937;
                --verif-gray-900: #111827;
                
                --verif-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                --verif-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                --verif-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                --verif-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                --verif-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                
                --verif-radius-sm: 0.375rem;
                --verif-radius: 0.5rem;
                --verif-radius-md: 0.75rem;
                --verif-radius-lg: 1rem;
                --verif-radius-xl: 1.5rem;
                
                --verif-spacing-xs: 0.25rem;
                --verif-spacing-sm: 0.5rem;
                --verif-spacing: 1rem;
                --verif-spacing-md: 1.5rem;
                --verif-spacing-lg: 2rem;
                --verif-spacing-xl: 3rem;
                
                --verif-transition: 300ms cubic-bezier(0.4, 0, 0.2, 1);
                --verif-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }

            @keyframes verif-fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            @keyframes verif-fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes verif-scaleIn {
                from {
                    opacity: 0;
                    transform: scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            @keyframes verif-spin {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }

            @keyframes verif-pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
            }

            .verif-animate-fadeIn {
                animation: verif-fadeIn 0.6s var(--verif-transition) forwards;
            }

            .verif-animate-fadeInUp {
                animation: verif-fadeInUp 0.6s var(--verif-transition) forwards;
            }

            .verif-animate-scaleIn {
                animation: verif-scaleIn 0.4s var(--verif-bounce) forwards;
            }

            .verif-animate-pulse {
                animation: verif-pulse 2s infinite;
            }

            .verif-loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%);
                backdrop-filter: blur(8px) saturate(180%);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                z-index: 1000;
                border-radius: var(--verif-radius-xl);
                animation: verif-fadeIn 0.3s var(--verif-transition);
            }

            .verif-spinner {
                width: 48px;
                height: 48px;
                position: relative;
                margin-bottom: var(--verif-spacing);
            }

            .verif-spinner::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border: 4px solid var(--verif-gray-200);
                border-top: 4px solid var(--verif-primary);
                border-radius: 50%;
                animation: verif-spin 1s linear infinite;
            }

            .verif-loading-text {
                color: var(--verif-gray-600);
                font-size: 0.875rem;
                font-weight: 500;
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
                letter-spacing: 0.025em;
                animation: verif-pulse 2s ease-in-out infinite;
            }

            .verif-card-hover {
                transition: all var(--verif-transition);
                cursor: pointer;
            }

            .verif-card-hover:hover {
                transform: translateY(-4px) scale(1.02);
                box-shadow: var(--verif-shadow-xl);
            }

            .verif-tab-switching {
                animation: verif-tab-switch 0.5s var(--verif-transition) forwards;
            }

            @keyframes verif-tab-switch {
                0% {
                    opacity: 0;
                    transform: translateY(20px) rotateX(10deg);
                }
                50% {
                    opacity: 0.5;
                    transform: translateY(10px) rotateX(5deg);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0) rotateX(0deg);
                }
            }

            .verif-counter-animate {
                animation: verif-counter-up 0.8s var(--verif-bounce) forwards;
            }

            @keyframes verif-counter-up {
                from {
                    transform: translateY(20px) scale(0.8);
                    opacity: 0;
                }
                60% {
                    transform: translateY(-5px) scale(1.1);
                    opacity: 0.8;
                }
                to {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
            }

            .verif-table-row-animate {
                animation: verif-table-row-slide 0.5s var(--verif-transition) forwards;
                opacity: 0;
            }

            @keyframes verif-table-row-slide {
                from {
                    opacity: 0;
                    transform: translateX(-20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .verif-animate-fadeIn,
                .verif-animate-fadeInUp,
                .verif-animate-scaleIn,
                .verif-animate-pulse,
                .verif-card-hover,
                .verif-tab-switching,
                .verif-counter-animate,
                .verif-table-row-animate {
                    animation: none;
                    transition: none;
                }
            }
        `;
        document.head.appendChild(animationStyles);
    }

    applyTableStyles() {
        const styleId = 'verif-table-styles';
        if (document.getElementById(styleId)) return;
        
        const tableStyles = document.createElement('style');
        tableStyles.id = styleId;
        tableStyles.textContent = `
            .verif-data-table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
                background: #ffffff;
                border-radius: var(--verif-radius-xl);
                overflow: hidden;
                box-shadow: var(--verif-shadow-lg);
                border: 1px solid var(--verif-gray-200);
                transition: all var(--verif-transition);
                margin: var(--verif-spacing) 0;
            }

            .verif-data-table:hover {
                box-shadow: var(--verif-shadow-xl);
                transform: translateY(-2px);
            }

            .verif-data-table thead {
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                position: relative;
            }

            .verif-data-table thead::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, var(--verif-primary), var(--verif-primary-light));
            }

            .verif-data-table th {
                text-align: center !important;
                vertical-align: middle !important;
                padding: var(--verif-spacing) var(--verif-spacing-md) !important;
                font-weight: 600 !important;
                color: var(--verif-gray-700) !important;
                font-size: 0.8125rem !important;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                position: sticky;
                top: 0;
                z-index: 10;
                border: none !important;
                background: inherit;
                transition: all var(--verif-transition);
            }

            .verif-data-table td {
                text-align: center !important;
                vertical-align: middle !important;
                padding: var(--verif-spacing-md) var(--verif-spacing) !important;
                font-size: 0.875rem !important;
                color: var(--verif-gray-700) !important;
                font-weight: 500 !important;
                border: none !important;
                border-bottom: 1px solid var(--verif-gray-100) !important;
                background-color: #ffffff !important;
                transition: all var(--verif-transition);
            }

            .verif-data-table tbody tr:nth-child(even) td {
                background-color: var(--verif-gray-50) !important;
            }

            .verif-data-table tbody tr:hover {
                background: linear-gradient(135deg, rgba(255, 107, 53, 0.04) 0%, rgba(255, 133, 85, 0.06) 100%) !important;
                transform: scale(1.01);
                z-index: 5;
            }

            .verif-data-table tbody tr:hover td {
                background: inherit !important;
                color: var(--verif-gray-800) !important;
                font-weight: 600 !important;
                box-shadow: 0 2px 8px rgba(255, 107, 53, 0.1);
            }

            .verif-data-table tbody tr:last-child td {
                border-bottom: none !important;
            }

            .verif-data-table-section {
                background: #ffffff;
                border-radius: var(--verif-radius-xl);
                padding: var(--verif-spacing-lg);
                box-shadow: var(--verif-shadow);
                border: 1px solid var(--verif-gray-200);
                margin: var(--verif-spacing-lg) 0;
                transition: all var(--verif-transition);
            }

            .verif-table-title {
                font-size: 1.25rem;
                font-weight: 700;
                color: var(--verif-gray-800);
                margin-bottom: var(--verif-spacing-md);
                display: flex;
                align-items: center;
                gap: var(--verif-spacing);
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            }

            .verif-table-title::before {
                content: '';
                width: 4px;
                height: 24px;
                background: linear-gradient(135deg, var(--verif-primary), var(--verif-primary-light));
                border-radius: var(--verif-radius-sm);
                flex-shrink: 0;
            }

            .record-count {
                margin-left: auto !important;
                font-size: 0.8125rem !important;
                color: var(--verif-gray-500) !important;
                font-weight: 500 !important;
                background: linear-gradient(135deg, var(--verif-gray-50), var(--verif-gray-100)) !important;
                padding: var(--verif-spacing-xs) var(--verif-spacing) !important;
                border-radius: var(--verif-radius-lg) !important;
                border: 1px solid var(--verif-gray-200) !important;
                transition: all var(--verif-transition) !important;
            }
        `;
        document.head.appendChild(tableStyles);
    }
    
    async animateInitialization() {
        const elements = [
            { selector: '.verif-header-section', delay: 0 },
            { selector: '.verif-nav-section', delay: 100 },
            { selector: '.verif-period-section', delay: 200 },
            { selector: '.verif-content-section', delay: 300 }
        ];
        
        for (const { selector, delay } of elements) {
            const element = document.querySelector(selector);
            if (element) {
                element.style.opacity = '0';
                element.style.transform = 'translateY(30px)';
                
                await this.waitFor(delay);
                
                element.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }
        }
    }
    
    setupEventListeners() {
        // Переключение вкладок
        document.querySelectorAll('.verif-nav-tab').forEach(tab => {
            tab.addEventListener('click', async (e) => {
                e.preventDefault();
                const tabName = e.currentTarget.dataset.tab;
                if (tabName && tabName !== this.currentTab && !this.isLoading) {
                    await this.animatedTabSwitch(tabName);
                }
            });
        });
        
        // Выбор периода
        document.querySelectorAll('.verif-period-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const period = e.currentTarget.dataset.period;
                if (period && !this.isLoading) {
                    await this.animatedPeriodChange(period);
                }
            });
        });
        
        // Применение пользовательского периода
        const applyBtn = document.getElementById('verif-apply-custom');
        if (applyBtn) {
            applyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.applyCustomDateRange();
            });
        }
        
        // Поиск в таблицах
        document.querySelectorAll('.verif-table-search').forEach(input => {
            input.addEventListener('input', this.debounce((e) => {
                this.animatedTableSearch(e.target.value);
            }, 300));
        });
        
        // Изменение размера окна
        window.addEventListener('resize', this.debounce(() => {
            this.resizeAllCharts();
        }, 250));
        
        // Видимость страницы
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateTimeDisplay();
            }
        });
        
        this.setupCardHoverEffects();
    }
    
    setupCardHoverEffects() {
        document.querySelectorAll('.verif-summary-card-compact').forEach(card => {
            card.classList.add('verif-card-hover');
        });
        
        document.querySelectorAll('.verif-chart-card-orange').forEach(card => {
            card.classList.add('verif-card-hover');
        });
    }
    
    startTimeDisplay() {
        this.updateTimeDisplay();
        this.timeDisplayInterval = setInterval(() => {
            this.updateTimeDisplay();
        }, 30000);
    }
    
    updateTimeDisplay() {
        const now = new Date();
        const dateElement = document.getElementById('verif-current-date');
        if (dateElement) {
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric'
            };
            
            dateElement.style.transition = 'all 0.3s ease';
            dateElement.style.transform = 'scale(0.95)';
            
            setTimeout(() => {
                dateElement.textContent = now.toLocaleDateString('ru-RU', options);
                dateElement.style.transform = 'scale(1)';
            }, 150);
        }
        this.timestamp = this.getCurrentTimestamp();
    }
    
    async loadInitialData() {
        await this.loadTabData(this.currentTab);
    }
    
    // ==========================================
    // ЗАГРУЗКА И ОБРАБОТКА ДАННЫХ
    // ==========================================
    
    async loadTabData(tabName) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showAnimatedLoading(tabName, true);
        
        try {
            const data = await this.fetchRealData(tabName);
            
            if (data && Object.keys(data).length > 0) {
                this.data.set(tabName, data);
                await this.animatedContentUpdate(tabName, data);
            } else {
                throw new Error('API не вернул данные');
            }
            
        } catch (error) {
            this.showNoDataMessage(tabName, error.message);
        } finally {
            this.showAnimatedLoading(tabName, false);
            this.isLoading = false;
        }
    }
    
    async fetchRealData(tabName) {
        const url = `${this.config.apiEndpoint}?tab=${tabName}&period=${this.currentPeriod}`;
        
        const headers = {
            'Content-Type': 'application/json',
            'X-User': this.user,
            'Accept': 'application/json'
        };
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        try {
            const response = await fetch(url, { 
                headers,
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success || !result.data) {
                throw new Error(result.message || 'Некорректный ответ сервера');
            }
            
            return result.data;
            
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Превышено время ожидания ответа сервера');
            }
            throw error;
        }
    }
    
    showAnimatedLoading(tabName, show) {
        if (show) {
            this.createAnimatedLoadingOverlay(tabName);
        } else {
            this.removeAnimatedLoadingOverlay(tabName);
        }
    }
    
    createAnimatedLoadingOverlay(tabName) {
        const panel = document.getElementById(`panel-${tabName}`);
        if (!panel) return;
        
        let overlay = panel.querySelector('.verif-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'verif-loading-overlay';
            overlay.innerHTML = `
                <div class="verif-spinner"></div>
                <div class="verif-loading-text">Загрузка данных</div>
                <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 8px; text-align: center;">
                    Получение данных от сервера...
                </div>
            `;
            panel.style.position = 'relative';
            panel.appendChild(overlay);
            
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                overlay.style.opacity = '1';
            }, 10);
        }
    }
    
    removeAnimatedLoadingOverlay(tabName) {
        const panel = document.getElementById(`panel-${tabName}`);
        if (panel) {
            const overlay = panel.querySelector('.verif-loading-overlay');
            if (overlay) {
                overlay.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                overlay.style.opacity = '0';
                overlay.style.transform = 'scale(0.9)';
                
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.remove();
                    }
                }, 300);
            }
        }
    }
    
    showNoDataMessage(tabName, errorMessage) {
        const panel = document.getElementById(`panel-${tabName}`);
        if (!panel) return;
        
        panel.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 4rem 2rem;
                text-align: center;
                min-height: 400px;
            ">
                <div style="
                    width: 96px;
                    height: 96px;
                    background: linear-gradient(135deg, #fef3cd, #fde68a);
                    border: 4px solid #f59e0b;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 24px;
                    animation: pulse 2s infinite;
                ">
                    <svg width="48" height="48" fill="#f59e0b" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                </div>
                <h3 style="
                    font-size: 24px;
                    font-weight: 700;
                    color: #d97706;
                    margin: 0 0 16px 0;
                ">Данные недоступны</h3>
                <p style="
                    font-size: 16px;
                    color: #6b7280;
                    margin: 0 0 24px 0;
                    max-width: 500px;
                    line-height: 1.6;
                ">
                    Не удалось загрузить данные для раздела "${tabName}".<br>
                    <strong>Причина:</strong> ${errorMessage}<br><br>
                    Попробуйте обновить страницу или выберите другой период.
                </p>
                <button onclick="window.verificationDashboard?.refreshData(true)" style="
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    🔄 Попробовать еще раз
                </button>
            </div>
        `;
    }
    
    // ==========================================
    // АНИМИРОВАННЫЕ ПЕРЕХОДЫ И ДЕЙСТВИЯ
    // ==========================================
    
    async animatedTabSwitch(tabName) {
        if (this.currentTab === tabName || this.isLoading) return;
        
        try {
            const currentPanel = document.getElementById(`panel-${this.currentTab}`);
            if (currentPanel) {
                currentPanel.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                currentPanel.style.opacity = '0';
                currentPanel.style.transform = 'translateX(-20px) scale(0.98)';
            }
            
            await this.waitFor(200);
            
            this.updateActiveTab(tabName);
            this.currentTab = tabName;
            
            const newPanel = document.getElementById(`panel-${tabName}`);
            if (newPanel) {
                newPanel.classList.add('verif-tab-switching');
                newPanel.style.opacity = '0';
                newPanel.style.transform = 'translateX(20px) scale(0.98)';
                
                await this.waitFor(100);
                
                newPanel.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                newPanel.style.opacity = '1';
                newPanel.style.transform = 'translateX(0) scale(1)';
            }
            
            await this.waitFor(200);
            await this.loadTabData(tabName);
            
            setTimeout(() => this.createPendingCharts(), 400);
            
        } catch (error) {
            this.handleError('Ошибка переключения вкладки', error);
        }
    }
    
    async animatedPeriodChange(period) {
        if (this.currentPeriod === period || this.isLoading) return;
        
        try {
            const buttons = document.querySelectorAll('.verif-period-btn');
            buttons.forEach(btn => {
                btn.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                if (btn.dataset.period === period) {
                    btn.style.transform = 'scale(1.05)';
                    setTimeout(() => {
                        btn.style.transform = 'scale(1)';
                    }, 200);
                }
            });
            
            this.updateActivePeriod(period);
            
            const customSection = document.getElementById('verif-custom-period');
            if (customSection) {
                if (period === 'custom') {
                    customSection.style.display = 'block';
                    customSection.style.opacity = '0';
                    customSection.style.transform = 'translateY(-10px)';
                    
                    setTimeout(() => {
                        customSection.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                        customSection.style.opacity = '1';
                        customSection.style.transform = 'translateY(0)';
                    }, 50);
                    
                    this.setupDateInputs();
                    return;
                } else {
                    customSection.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                    customSection.style.opacity = '0';
                    customSection.style.transform = 'translateY(-10px)';
                    
                    setTimeout(() => {
                        customSection.style.display = 'none';
                    }, 200);
                }
            }
            
            this.currentPeriod = period;
            await this.loadTabData(this.currentTab);
            
        } catch (error) {
            this.handleError('Ошибка изменения периода', error);
        }
    }
    
    updateActiveTab(tabName) {
        document.querySelectorAll('.verif-nav-tab').forEach(tab => {
            tab.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        });
        
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
            
            activeTab.style.transform = 'scale(1.02)';
            setTimeout(() => {
                activeTab.style.transform = 'scale(1)';
            }, 200);
        }
        
        document.querySelectorAll('.verif-panel-orange').forEach(panel => {
            panel.classList.remove('active');
            panel.style.display = 'none';
        });
        
        const activePanel = document.getElementById(`panel-${tabName}`);
        if (activePanel) {
            activePanel.classList.add('active');
            activePanel.style.display = 'block';
        }
    }
    
    updateActivePeriod(period) {
        document.querySelectorAll('.verif-period-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-period="${period}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
    
    setupDateInputs() {
        const fromInput = document.getElementById('verif-date-from');
        const toInput = document.getElementById('verif-date-to');
        
        if (fromInput && toInput) {
            const today = new Date();
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            fromInput.value = weekAgo.toISOString().split('T')[0];
            toInput.value = today.toISOString().split('T')[0];
            
            [fromInput, toInput].forEach((input, index) => {
                input.style.opacity = '0';
                input.style.transform = 'translateY(10px)';
                
                setTimeout(() => {
                    input.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                    input.style.opacity = '1';
                    input.style.transform = 'translateY(0)';
                }, index * 100);
            });
        }
    }
    
    async applyCustomDateRange() {
        const fromInput = document.getElementById('verif-date-from');
        const toInput = document.getElementById('verif-date-to');
        
        if (!fromInput || !toInput) return;
        
        const fromDate = fromInput.value;
        const toDate = toInput.value;
        
        if (!fromDate || !toDate) return;
        
        const fromDateObj = new Date(fromDate);
        const toDateObj = new Date(toDate);
        
        if (fromDateObj > toDateObj) return;
        if (toDateObj > new Date()) return;
        
        const diffTime = Math.abs(toDateObj - fromDateObj);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 365) return;
        
        this.currentPeriod = `${fromDate}_${toDate}`;
        await this.loadTabData(this.currentTab);
    }
    
    // ==========================================
    // АНИМИРОВАННОЕ ОБНОВЛЕНИЕ КОНТЕНТА
    // ==========================================
    
    async animatedContentUpdate(tabName, data) {
        const contentHandlers = {
            'general': () => this.animatedUpdateGeneralTab(data),
            'confirmed': () => this.animatedUpdateConfirmedTab(data), 
            'vpn': () => this.animatedUpdateVpnTab(data)
        };
        
        const handler = contentHandlers[tabName];
        if (handler) {
            try {
                await handler();
            } catch (error) {
                this.handleError(`Ошибка обновления контента вкладки ${tabName}`, error);
            }
        }
    }
    
    async animatedUpdateGeneralTab(data) {
        const totalCount = this.safeNumber(data.totalCount);
        const totalAmount = this.safeNumber(data.totalAmount);
        const confirmedCount = this.safeNumber(data.confirmedCount);
        const confirmedAmount = this.safeNumber(data.confirmedAmount);
        const gisAmount = this.safeNumber(data.gisAmount);
        
        const confirmationRate = totalCount > 0 ? this.calculatePercentage(confirmedCount, totalCount) : 0;
        
        await this.animateCardsStagger([
            { id: 'total-trips-amount', value: totalAmount, format: 'currency' },
            { id: 'gis-amount', value: gisAmount, format: 'currency' },
            { id: 'total-trips-count', value: totalCount },
            { id: 'confirmed-trips-count', value: confirmedCount },
            { id: 'confirmed-trips-amount', value: confirmedAmount, format: 'currency' },
            { id: 'confirmation-rate', value: confirmationRate, format: 'percent' }
        ]);
        
        await this.animatedMiniChartsUpdate([
            { id: 'summary-chart-1', data: data.amountTrend },
            { id: 'summary-chart-2', data: data.amountTrend },
            { id: 'summary-chart-3', data: data.countTrend },
            { id: 'summary-chart-4', data: data.confirmedTrend },
            { id: 'summary-chart-7', data: data.confirmedAmountTrend },
            { id: 'summary-chart-5', data: data.rateTrend }
        ]);
        
        await this.waitFor(400);
        
        if (data.monthlyData) {
            await this.animatedChartCreate('general-monthly-chart', data.monthlyData, 'bar');
        }
        if (data.dailyData) {
            await this.animatedChartCreate('general-daily-chart', data.dailyData, 'line');
        }
        
        if (data.tableData) {
            await this.animatedTableUpdate('general-data-table', data.tableData, 'general');
        }
    }
    
    async animatedUpdateConfirmedTab(data) {
        const confirmedCount = this.safeNumber(data.confirmedCount);
        const confirmedAmount = this.safeNumber(data.confirmedAmount);
        const paidCount = this.safeNumber(data.paidCount);
        const paidAmount = this.safeNumber(data.paidAmount);
        const avgTime = this.safeNumber(data.avgTime, 1);
        
        const paidPercentage = confirmedCount > 0 ? this.calculatePercentage(paidCount, confirmedCount) : 0;
        
        await this.animateCardsStagger([
            { id: 'confirmed-count', value: confirmedCount },
            { id: 'confirmed-amount', value: confirmedAmount, format: 'currency' },
            { id: 'confirmed-paid-count', value: paidCount },
            { id: 'confirmed-paid-amount', value: paidAmount, format: 'currency' },
            { id: 'confirmed-percentage', value: paidPercentage, format: 'percent' },
            { id: 'confirmed-avg-time', value: avgTime, format: 'hours' }
        ]);
        
        await this.animatedMiniChartsUpdate([
            { id: 'confirmed-chart-1', data: data.countTrend },
            { id: 'confirmed-chart-2', data: data.amountTrend },
            { id: 'confirmed-chart-3', data: data.countTrend },
            { id: 'confirmed-chart-4', data: data.amountTrend },
            { id: 'confirmed-chart-5', data: data.percentageTrend },
            { id: 'confirmed-chart-6', data: data.timeTrend }
        ]);
        
        await this.waitFor(400);
        
        if (data.monthlyData) {
            await this.animatedChartCreate('confirmed-monthly-chart', data.monthlyData, 'bar');
        }
        if (data.sourcesData) {
            await this.animatedChartCreate('confirmed-sources-chart', data.sourcesData, 'doughnut');
        }
        
        if (data.tableData) {
            await this.animatedTableUpdate('confirmed-data-table', data.tableData, 'confirmed');
        }
    }
    
    async animatedUpdateVpnTab(data) {
        const vpnCount = this.safeNumber(data.vpnCount);
        const totalVpn = this.safeNumber(data.totalVpn);
        const corrected = this.safeNumber(data.corrected);
        const vpnRemoved = this.safeNumber(data.vpnRemoved);
        const vpnRemovedAmount = this.safeNumber(data.vpnRemovedAmount);
        
        const correctedPercentage = vpnCount > 0 ? this.calculatePercentage(corrected, vpnCount) : 0;
        
        await this.animateCardsStagger([
            { id: 'vpn-count', value: vpnCount },
            { id: 'vpn-total', value: totalVpn, format: 'currency' },
            { id: 'vpn-corrected', value: corrected },
            { id: 'vpn-corrected-percentage', value: correctedPercentage, format: 'percent' },
            { id: 'vpn-removed', value: vpnRemoved },
            { id: 'vpn-removed-amount', value: vpnRemovedAmount, format: 'currency' }
        ]);
        
        await this.animatedMiniChartsUpdate([
            { id: 'vpn-chart-1', data: data.countTrend },
            { id: 'vpn-chart-2', data: data.amountTrend },
            { id: 'vpn-chart-3', data: data.correctedTrend },
            { id: 'vpn-chart-4', data: data.correctedTrend },
            { id: 'vpn-chart-5', data: data.removedTrend },
            { id: 'vpn-chart-6', data: data.removedAmountTrend }
        ]);
        
        await this.waitFor(400);
        
        if (data.monthlyData) {
            await this.animatedChartCreate('vpn-monthly-chart', data.monthlyData, 'mixed');
        }
        
        if (data.tableData) {
            await this.animatedTableUpdate('vpn-data-table', data.tableData, 'vpn');
        }
    }
    
    // ==========================================
    // АНИМИРОВАННЫЕ КОМПОНЕНТЫ
    // ==========================================
    
    async animateCardsStagger(cards) {
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const element = document.getElementById(card.id);
            
            if (element) {
                const cardElement = element.closest('.verif-summary-card-compact');
                if (cardElement) {
                    cardElement.style.animation = 'none';
                    cardElement.style.opacity = '0';
                    cardElement.style.transform = 'translateY(20px) scale(0.9)';
                    
                    setTimeout(() => {
                        cardElement.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                        cardElement.style.opacity = '1';
                        cardElement.style.transform = 'translateY(0) scale(1)';
                    }, i * this.config.animation.staggerDelay);
                }
                
                setTimeout(() => {
                    this.animatedCounter(card.id, card.value, card.format || 'number');
                }, (i * this.config.animation.staggerDelay) + 200);
            }
        }
        
        await this.waitFor(cards.length * this.config.animation.staggerDelay + 800);
    }
    
    async animatedMiniChartsUpdate(charts) {
        const promises = charts.map((chart, index) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    this.animatedMiniChartUpdate(chart.id, chart.data);
                    resolve();
                }, index * 50);
            });
        });
        
        await Promise.all(promises);
    }
    
    animatedMiniChartUpdate(canvasId, trendData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const container = canvas.closest('.verif-summary-chart-compact');
        if (container) {
            container.style.opacity = '0';
            container.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                container.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                container.style.opacity = '1';
                container.style.transform = 'scale(1)';
            }, 100);
        }
        
        setTimeout(() => {
            this.updateMiniChart(canvasId, trendData);
        }, 200);
    }
    
    async animatedChartCreate(canvasId, chartData, chartType) {
        this.showLoading(canvasId);
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            return;
        }
        
        const container = canvas.closest('.verif-chart-container');
        if (container) {
            container.style.opacity = '0';
            container.style.transform = 'scale(0.95) translateY(10px)';
            
            setTimeout(() => {
                this.createChart(canvasId, chartData, chartType);
                
                container.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                container.style.opacity = '1';
                container.style.transform = 'scale(1) translateY(0)';
            }, 300);
        } else {
            this.createChart(canvasId, chartData, chartType);
        }
    }
    
    async animatedTableUpdate(tableId, tableData, tableType) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        const existingRows = tbody.querySelectorAll('tr');
        if (existingRows.length > 0) {
            existingRows.forEach((row, index) => {
                setTimeout(() => {
                    row.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                    row.style.opacity = '0';
                    row.style.transform = 'translateX(-20px) scale(0.95)';
                }, index * 20);
            });
            
            await this.waitFor(existingRows.length * 20 + 200);
        }
        
        tbody.innerHTML = '';
        
        if (!tableData || tableData.length === 0) {
            this.showEmptyTableMessage(tbody, tableType);
            return;
        }
        
        await this.animatedTablePopulate(tbody, tableData, tableType);
        this.updateTableCounter(table, tableData.length);
    }
    
    async animatedTablePopulate(tbody, tableData, tableType) {
        const rows = [];
        tableData.forEach((rowData, index) => {
            const tableRow = document.createElement('tr');
            tableRow.className = 'verif-table-row-animate';
            tableRow.style.opacity = '0';
            tableRow.style.transform = 'translateX(30px) scale(0.9)';
            tableRow.innerHTML = this.generateTableRowContent(rowData, tableType);
            tbody.appendChild(tableRow);
            rows.push(tableRow);
        });
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const delay = i * 30;
            
            setTimeout(() => {
                row.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                row.style.opacity = '1';
                row.style.transform = 'translateX(0) scale(1)';
                
                setTimeout(() => {
                    row.style.transform = 'translateX(0) scale(1.01)';
                    setTimeout(() => {
                        row.style.transform = 'translateX(0) scale(1)';
                    }, 100);
                }, 200);
            }, delay);
        }
        
        await this.waitFor(rows.length * 30 + 400);
    }
    
    async animatedTableSearch(searchTerm) {
        const activePanel = document.querySelector('.verif-panel-orange.active');
        if (!activePanel) return;
        
        const table = activePanel.querySelector('.verif-data-table');
        if (!table) return;
        
        const rows = table.querySelectorAll('tbody tr');
        const term = searchTerm.toLowerCase().trim();
        
        let visibleCount = 0;
        
        rows.forEach((row, index) => {
            const text = row.textContent.toLowerCase();
            const shouldShow = !term || text.includes(term);
            
            setTimeout(() => {
                row.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                
                if (shouldShow) {
                    visibleCount++;
                    row.style.display = '';
                    row.style.opacity = '1';
                    row.style.transform = 'scale(1)';
                    
                    if (term) {
                        row.style.backgroundColor = 'rgba(255, 107, 53, 0.08)';
                        row.style.borderColor = 'rgba(255, 107, 53, 0.2)';
                        row.style.transform = 'scale(1.01)';
                    } else {
                        row.style.backgroundColor = '';
                        row.style.borderColor = '';
                    }
                } else {
                    row.style.opacity = '0';
                    row.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        row.style.display = 'none';
                    }, 300);
                }
            }, index * 20);
        });
        
        setTimeout(() => {
            if (term) {
                this.updateTableCounter(table, visibleCount);
            } else {
                this.updateTableCounter(table, rows.length);
            }
        }, rows.length * 20 + 300);
    }
    
    // ==========================================
    // АНИМИРОВАННЫЕ СЧЕТЧИКИ
    // ==========================================
    
    async animatedCounter(elementId, targetValue, format = 'number') {
        const element = document.getElementById(elementId);
        if (!element) return Promise.resolve();
        
        element.classList.add('verif-counter-animate');
        
        const startValue = 0;
        const duration = 2000;
        const startTime = performance.now();
        
        return new Promise(resolve => {
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                const easeProgress = progress < 0.5 
                    ? 4 * progress * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                
                const currentValue = Math.floor(startValue + (targetValue - startValue) * easeProgress);
                
                element.textContent = this.formatCounterValue(currentValue, format);
                
                if (progress < 1) {
                    const pulseScale = 1 + Math.sin(progress * Math.PI * 6) * 0.02;
                    element.style.transform = `scale(${pulseScale})`;
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    element.textContent = this.formatCounterValue(targetValue, format);
                    element.style.transform = 'scale(1)';
                    
                    element.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                    element.style.transform = 'scale(1.05)';
                    setTimeout(() => {
                        element.style.transform = 'scale(1)';
                    }, 150);
                    
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }
    
    formatCounterValue(value, format) {
        switch (format) {
            case 'currency':
                return this.formatCurrency(value);
            case 'percent':
                return this.formatPercentage(value) + '%';
            case 'hours':
                return this.formatHours(value);
            case 'number':
            default:
                return this.formatNumber(value);
        }
    }
    
    // ==========================================
    // РАБОТА С ГРАФИКАМИ
    // ==========================================
    
    createChart(canvasId, chartData, chartType = 'bar') {
        if (!this.isChartReady || typeof Chart === 'undefined') {
            this.pendingCharts.set(canvasId, { data: chartData, type: chartType });
            return;
        }
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            return;
        }

        if (this.charts.has(canvasId)) {
            try {
                this.charts.get(canvasId).destroy();
            } catch (error) {
                // Игнорируем ошибки уничтожения
            }
            this.charts.delete(canvasId);
        }

        if (!chartData || !chartData.labels || !chartData.datasets) {
            this.showNoDataMessage(canvasId);
            return;
        }

        const ctx = canvas.getContext('2d');

        const config = {
            type: chartType === 'mixed' ? 'bar' : chartType,
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: chartType !== 'line' || chartData.datasets.length > 1,
                        position: 'top',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                family: 'Inter, sans-serif',
                                size: 12,
                                weight: '500'
                            },
                            color: '#374151'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#ff6b35',
                        borderWidth: 2,
                        cornerRadius: 12,
                        displayColors: true,
                        callbacks: {
                            title: function(context) {
                                return context[0]?.label || 'Данные';
                            },
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed?.y ?? context.parsed ?? 0;
                                
                                if (label.toLowerCase().includes('сумма') || 
                                    label.toLowerCase().includes('amount')) {
                                    return `${label}: ${value.toLocaleString('ru-RU')} руб.`;
                                } else if (label.toLowerCase().includes('процент')) {
                                    return `${label}: ${value.toFixed(1)}%`;
                                } else {
                                    return `${label}: ${value.toLocaleString('ru-RU')}`;
                                }
                            }
                        }
                    }
                },
                scales: this.getScalesConfig(chartType),
                animation: {
                    duration: 1200,
                    easing: 'easeOutQuart'
                }
            }
        };

        try {
            const chart = new Chart(ctx, config);
            this.charts.set(canvasId, chart);
            this.hideLoading(canvasId);
            
        } catch (error) {
            this.showErrorMessage(canvasId, error.message);
        }
    }

    getScalesConfig(chartType) {
        if (['doughnut', 'pie'].includes(chartType)) {
            return {};
        }

        const scales = {
            x: {
                grid: { 
                    display: chartType !== 'bar',
                    color: 'rgba(0, 0, 0, 0.05)',
                    drawBorder: false
                },
                ticks: { 
                    font: { 
                        size: 11, 
                        family: 'Inter, system-ui, sans-serif',
                        weight: '500'
                    },
                    color: '#6b7280',
                    maxRotation: 45,
                    minRotation: 0,
                    padding: 8
                },
                border: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    width: 1
                }
            },
            y: {
                beginAtZero: true,
                grid: { 
                    color: 'rgba(0, 0, 0, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    font: { 
                        size: 11, 
                        family: 'Inter, system-ui, sans-serif',
                        weight: '500'
                    },
                    color: '#6b7280',
                    padding: 8,
                    callback: (value) => this.formatAxisValue(value)
                },
                border: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    width: 1
                }
            }
        };

        if (chartType === 'mixed') {
            scales.y1 = {
                type: 'linear',
                display: true,
                position: 'right',
                beginAtZero: true,
                grid: { 
                    drawOnChartArea: false,
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    font: { 
                        size: 11, 
                        family: 'Inter, system-ui, sans-serif',
                        weight: '500'
                    },
                    color: '#6b7280',
                    padding: 8,
                    callback: (value) => this.formatAxisValue(value)
                },
                border: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    width: 1
                }
            };
        }
        
        return scales;
    }
    
    updateMiniChart(canvasId, trendData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            return;
        }
        
        if (this.miniCharts.has(canvasId)) {
            try {
                this.miniCharts.get(canvasId).destroy();
            } catch (error) {
                // Игнорируем ошибки
            }
            this.miniCharts.delete(canvasId);
        }
        
        let chartData;
        if (trendData && trendData.labels && trendData.values) {
            chartData = {
                labels: trendData.labels,
                values: trendData.values
            };
        } else {
            chartData = {
                labels: ['', '', '', '', '', '', ''],
                values: [0, 0, 0, 0, 0, 0, 0]
            };
        }
        
        const config = {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.values,
                    borderColor: this.config.colors.primary,
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    fill: true,
                                        tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: { 
                    x: { display: false }, 
                    y: { display: false } 
                },
                animation: { 
                    duration: 800, 
                    easing: 'easeInOutCubic'
                }
            }
        };
        
        try {
            const miniChart = new Chart(canvas, config);
            this.miniCharts.set(canvasId, miniChart);
        } catch (error) {
            // Игнорируем ошибки создания мини-графика
        }
    }
    
    createPendingCharts() {
        if (this.pendingCharts.size === 0) return;
        
        const toCreate = [];
        this.pendingCharts.forEach((chartInfo, canvasId) => {
            const canvas = document.getElementById(canvasId);
            if (canvas && canvas.offsetParent !== null) {
                toCreate.push({ canvasId, chartInfo });
            }
        });
        
        toCreate.forEach(({ canvasId, chartInfo }, index) => {
            setTimeout(() => {
                this.createChart(canvasId, chartInfo.data, chartInfo.type);
                this.pendingCharts.delete(canvasId);
            }, index * 100);
        });
    }
    
    resizeAllCharts() {
        const allCharts = [...this.charts.values(), ...this.miniCharts.values()];
        
        allCharts.forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                try {
                    chart.resize();
                } catch (error) {
                    // Игнорируем ошибки изменения размера
                }
            }
        });
    }
    
    showLoading(canvasId) {
        const loadingId = canvasId.replace('-chart', '-loading');
        const loading = document.getElementById(loadingId);
        if (loading) {
            loading.style.display = 'flex';
        }
    }

    hideLoading(canvasId) {
        const loadingId = canvasId.replace('-chart', '-loading');
        const loading = document.getElementById(loadingId);
        if (loading) {
            loading.style.display = 'none';
        }
    }

    showErrorMessage(canvasId, errorMessage = 'Ошибка загрузки') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const container = canvas.closest('.verif-chart-container');
        if (container) {
            container.innerHTML = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 250px;
                    color: #ef4444;
                    font-size: 14px;
                    background: #fef2f2;
                    border-radius: 12px;
                    border: 2px dashed #fca5a5;
                    text-align: center;
                    padding: 20px;
                ">
                    <svg style="width: 32px; height: 32px; margin-bottom: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    <div style="font-weight: bold; margin-bottom: 4px;">Ошибка загрузки графика</div>
                    <div style="font-size: 12px; color: #6b7280; max-width: 200px; line-height: 1.4;">
                        ${errorMessage}
                    </div>
                </div>
            `;
        }
    }

    showNoDataMessage(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const container = canvas.closest('.verif-chart-container');
        if (container) {
            container.innerHTML = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 250px;
                    color: #6b7280;
                    font-size: 14px;
                    background: #f9fafb;
                    border-radius: 12px;
                    border: 2px dashed #d1d5db;
                    text-align: center;
                    padding: 20px;
                ">
                    <svg style="width: 32px; height: 32px; margin-bottom: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
                        <path d="M13 13l6 6"/>
                    </svg>
                    <div>Нет данных для отображения</div>
                    <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Выберите другой период</div>
                </div>
            `;
        }
    }
    
    // ==========================================
    // РАБОТА С ТАБЛИЦАМИ
    // ==========================================
    
    updateTable(tableId, tableData, tableType) {
        const table = document.getElementById(tableId);
        if (!table) {
            return;
        }
        
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            return;
        }
        
        tbody.innerHTML = '';
        
        if (!tableData || tableData.length === 0) {
            this.showEmptyTableMessage(tbody, tableType);
            return;
        }
        
        this.populateTable(tbody, tableData, tableType);
        this.updateTableCounter(table, tableData.length);
    }
    
    showEmptyTableMessage(tbody, tableType) {
        const colspan = this.getTableColumnCount(tableType);
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="${colspan}" style="text-align: center; padding: 3rem; color: #9ca3af;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
                    <div style="
                        width: 64px; 
                        height: 64px; 
                        background: linear-gradient(135deg, #fee2e2, #fecaca); 
                        border: 3px solid #ef4444;
                        border-radius: 50%; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        animation: pulse 2s infinite;
                    ">
                        <svg width="32" height="32" fill="#ef4444" viewBox="0 0 24 24" style="opacity: 0.4;">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px; color: #ef4444;">Нет данных за данный период</div>
                        <div style="font-size: 14px; opacity: 0.7;">Таблица заполнится после получения данных от сервера</div>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(emptyRow);
        
        emptyRow.style.opacity = '0';
        emptyRow.style.transform = 'translateY(20px)';
        setTimeout(() => {
            emptyRow.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            emptyRow.style.opacity = '1';
            emptyRow.style.transform = 'translateY(0)';
        }, 100);
    }
    
    populateTable(tbody, tableData, tableType) {
        tableData.forEach((row, index) => {
            const tableRow = document.createElement('tr');
            tableRow.style.opacity = '0';
            tableRow.style.transform = 'translateY(10px)';
            
            tableRow.innerHTML = this.generateTableRowContent(row, tableType);
            tbody.appendChild(tableRow);
            
            const animationDelay = Math.min(index * 30, 800);
            setTimeout(() => {
                tableRow.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                tableRow.style.opacity = '1';
                tableRow.style.transform = 'translateY(0)';
                
                setTimeout(() => {
                    tableRow.style.transform = 'translateY(-2px)';
                    setTimeout(() => {
                        tableRow.style.transform = 'translateY(0)';
                    }, 100);
                }, 200);
            }, animationDelay);
        });
    }
    
    generateTableRowContent(row, tableType) {
        switch (tableType) {
            case 'general':
                return `
                    <td>${this.safeString(row.date)}</td>
                    <td>${this.formatNumber(this.safeNumber(row.trips))}</td>
                    <td>${this.formatCurrency(this.safeNumber(row.amount))}</td>
                    <td>${this.formatNumber(this.safeNumber(row.confirmed))}</td>
                    <td>${this.formatPercentage(this.safeNumber(row.percentage, 1))}%</td>
                `;
            
            case 'confirmed':
                return `
                    <td>${this.safeString(row.date)}</td>
                    <td>${this.formatNumber(this.safeNumber(row.totalTrips || row.trips))}</td>
                    <td>${this.formatNumber(this.safeNumber(row.confirmedTrips || row.confirmed))}</td>
                    <td>${this.formatCurrency(this.safeNumber(row.paidAmount || row.amount))}</td>
                    <td>${this.formatHours(this.safeNumber(row.avgTime, 1))}</td>
                `;
            
            case 'vpn':
                return `
                    <td>${this.safeString(row.date)}</td>
                    <td>${this.formatNumber(this.safeNumber(row.vpnCount || row.trips))}</td>
                    <td>${this.formatCurrency(this.safeNumber(row.vpnAmount || row.amount))}</td>
                    <td>${this.formatNumber(this.safeNumber(row.corrected || row.confirmed))}</td>
                    <td>${this.formatNumber(this.safeNumber(row.removed))}</td>
                `;
            
            default:
                return `<td colspan="5" style="text-align: center; color: #ef4444;">Неизвестный тип таблицы: ${tableType}</td>`;
        }
    }
    
    getTableColumnCount(tableType) {
        const columnCounts = {
            'general': 5,
            'confirmed': 5,
            'vpn': 5
        };
        return columnCounts[tableType] || 5;
    }
    
    updateTableCounter(table, count) {
        const tableSection = table.closest('.verif-data-table-section');
        const header = tableSection?.querySelector('.verif-table-title');
        
        if (header) {
            const existingCounter = header.querySelector('.record-count');
            if (existingCounter) {
                existingCounter.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                existingCounter.style.opacity = '0';
                existingCounter.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    existingCounter.remove();
                }, 200);
            }
            
            setTimeout(() => {
                const counter = document.createElement('span');
                counter.className = 'record-count';
                counter.style.cssText = `
                    margin-left: 12px; 
                    font-size: 0.875rem; 
                    color: #6b7280; 
                    font-weight: 500;
                    background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
                    padding: 4px 12px;
                    border-radius: 16px;
                    border: 1px solid #d1d5db;
                    opacity: 0;
                    transform: scale(0.8);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                `;
                counter.textContent = `${count} записей`;
                header.appendChild(counter);
                
                setTimeout(() => {
                    counter.style.opacity = '1';
                    counter.style.transform = 'scale(1)';
                }, 10);
            }, existingCounter ? 200 : 0);
        }
    }
    
    // ==========================================
    // УТИЛИТЫ И ФОРМАТИРОВАНИЕ
    // ==========================================
    
    safeNumber(value, decimals = 0) {
        let num = Number(value);
        
        if (isNaN(num) || !isFinite(num)) {
            return 0;
        }
        
        if (decimals > 0) {
            return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
        } else {
            return Math.round(num);
        }
    }
    
    safeString(value) {
        if (value === null || value === undefined) {
            return '-';
        }
        return String(value);
    }
    
    calculatePercentage(value, total) {
        if (!total || total === 0) return 0;
        const percentage = (value / total) * 100;
        return Math.round(percentage * 10) / 10;
    }
    
    formatNumber(number) {
        const num = this.safeNumber(number);
        
        const formatted = new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
            useGrouping: true
        }).format(num);
        
        return formatted;
    }
        
    formatCurrency(number) {
        const num = this.safeNumber(number);
        
        const formatted = new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
            useGrouping: true
        }).format(num);
        
        return formatted;
    }
    
    formatPercentage(number, decimals = 1) {
        const num = this.safeNumber(number, decimals);
        
        if (num === Math.floor(num)) {
            return Math.floor(num).toString();
        } else {
            return num.toFixed(decimals).replace(/\.?0+$/, '');
        }
    }
        
    formatHours(number) {
        const num = this.safeNumber(number, 1);
        
        if (num === Math.floor(num)) {
            return Math.floor(num).toString() + ' ч';
        } else {
            return num.toFixed(1).replace(/\.?0+$/, '') + ' ч';
        }
    }
    
    formatAxisValue(value) {
        const num = this.safeNumber(value);
        
        if (Math.abs(num) >= 1000000) {
            return new Intl.NumberFormat('ru-RU', {
                notation: 'compact',
                maximumFractionDigits: 0
            }).format(num);
        }
        
        return this.formatNumber(num);
    }
    
    getCurrentTimestamp() {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }
    
    waitFor(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // ==========================================
    // ОБРАБОТКА ОШИБОК
    // ==========================================
    
    handleError(message, error) {
        // Тихо обрабатываем ошибки без вывода в консоль
        if (error && error.message) {
            // Можно отправить ошибку в систему мониторинга
        }
    }
    
    // ==========================================
    // УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ
    // ==========================================
    
    cleanup() {
        if (this.timeDisplayInterval) {
            clearInterval(this.timeDisplayInterval);
            this.timeDisplayInterval = null;
        }
        
        [...this.charts.values(), ...this.miniCharts.values()].forEach(chart => {
            try {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            } catch (error) {
                // Игнорируем ошибки уничтожения
            }
        });
        
        this.charts.clear();
        this.miniCharts.clear();
        this.pendingCharts.clear();
        this.data.clear();
    }
    
    // ==========================================
    // ПУБЛИЧНЫЙ API
    // ==========================================
    
    switchToTab(tabName) {
        if (['general', 'confirmed', 'vpn'].includes(tabName)) {
            this.animatedTabSwitch(tabName);
        }
    }
    
    setPeriod(period) {
        if (['7', '30', '90', 'custom'].includes(period)) {
            this.animatedPeriodChange(period);
        }
    }
    
    getCurrentData() {
        return this.data.get(this.currentTab);
    }
    
    refreshCharts() {
        this.resizeAllCharts();
        this.createPendingCharts();
    }
    
    refreshData(force = false) {
        if (this.isLoading && !force) {
            return;
        }
        
        this.loadTabData(this.currentTab);
    }
    
    getStats() {
        const currentData = this.getCurrentData();
        if (!currentData) return null;
        
        return {
            user: this.user,
            timestamp: this.getCurrentTimestamp(),
            tab: this.currentTab,
            period: this.currentPeriod,
            totalRecords: currentData.tableData?.length || 0,
            lastUpdate: this.timestamp,
            chartsActive: this.charts.size,
            miniChartsActive: this.miniCharts.size
        };
    }
    
    exportData(tabName = null) {
        const dataToExport = tabName ? 
            { [tabName]: this.data.get(tabName) } : 
            Object.fromEntries(this.data);
        
        const exportPayload = {
            metadata: {
                exportedAt: this.getCurrentTimestamp(),
                exportedBy: this.user,
                tab: tabName || 'all',
                period: this.currentPeriod
            },
            data: dataToExport
        };
            
        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `verification-data-${tabName || 'all'}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// ==========================================
// ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ
// ==========================================

// Настройка Chart.js при загрузке
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.font.weight = '500';
    Chart.defaults.color = '#6b7280';
    Chart.defaults.borderColor = '#e5e7eb';
    Chart.defaults.backgroundColor = 'rgba(255, 107, 53, 0.1)';
    
    Chart.defaults.animation = {
        duration: 1200,
        easing: 'easeInOutCubic'
    };
    
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.interaction = {
        intersect: false,
        mode: 'index'
    };
    
    Chart.defaults.elements.point = {
        radius: 4,
        hoverRadius: 6,
        borderWidth: 2
    };
    
    Chart.defaults.elements.line = {
        borderWidth: 2,
        tension: 0.4
    };
    
    Chart.defaults.elements.bar = {
        borderWidth: 2,
        borderRadius: 6
    };
}

let verificationDashboard = null;

async function initializeVerificationDashboard() {
    try {
        if (verificationDashboard) {
            verificationDashboard.cleanup();
        }
        
        verificationDashboard = new VerificationDashboard();
        window.verificationDashboard = verificationDashboard;
        
        // Горячие клавиши для отладки
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey) {
                switch (e.key) {
                    case 'R':
                        e.preventDefault();
                        verificationDashboard.refreshData(true);
                        break;
                    case 'E':
                        e.preventDefault();
                        verificationDashboard.exportData();
                        break;
                    case 'C':
                        e.preventDefault();
                        verificationDashboard.refreshCharts();
                        break;
                }
            }
        });
        
    } catch (error) {
        // Показываем пользователю сообщение об ошибке
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 20px; left: 20px; right: 20px; 
            background: #fef2f2; border: 2px solid #ef4444; color: #b91c1c; 
            padding: 16px; border-radius: 8px; font-weight: bold; z-index: 10000;
            text-align: center;
        `;
        errorDiv.innerHTML = `
            ❌ Ошибка инициализации дашборда: ${error.message}
            <button onclick="this.parentElement.remove()" style="
                margin-left: 16px; padding: 4px 12px; background: #ef4444; 
                color: white; border: none; border-radius: 4px; cursor: pointer;
            ">Закрыть</button>
        `;
        document.body.appendChild(errorDiv);
    }
}

function waitForDOMReady() {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            resolve();
        }
    });
}

function waitForChartJS() {
    return new Promise((resolve) => {
        if (typeof Chart !== 'undefined' && Chart.version) {
            resolve();
        } else {
            let attempts = 0;
            const maxAttempts = 100;
            
            const checkInterval = setInterval(() => {
                attempts++;
                
                if (typeof Chart !== 'undefined' && Chart.version) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        }
    });
}

async function startVerificationDashboard() {
    try {        
        await waitForDOMReady();
        await waitForChartJS();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        initializeVerificationDashboard();
        
    } catch (error) {
        // Тихо обрабатываем ошибки
    }
}

// Запускаем дашборд
startVerificationDashboard();

// Очистка при выгрузке страницы
window.addEventListener('beforeunload', () => {
    if (verificationDashboard) {
        verificationDashboard.cleanup();
    }
});

// Обработка изменения видимости страницы
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && verificationDashboard) {
        verificationDashboard.updateTimeDisplay();
        
        setTimeout(() => {
            verificationDashboard.refreshCharts();
        }, 500);
    }
});

// Экспорт для модульных систем
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        VerificationDashboard,
        initializeVerificationDashboard,
        startVerificationDashboard
    };
}

// Добавляем в глобальную область видимости для совместимости
window.VerificationDashboard = VerificationDashboard;
window.initializeVerificationDashboard = initializeVerificationDashboard;
