class VerificationDashboard {
    constructor() {
        // Основные параметры
        this.currentTab = 'general';
        this.currentPeriod = '7';
        this.user = 'kondakov_av';
        this.timestamp = this.getCurrentTimestamp();
        
        // Коллекции для управления
        this.charts = new Map();
        this.miniCharts = new Map();
        this.pendingCharts = new Map();
        this.data = new Map();
        this.isLoading = false;
        this.animationQueue = [];
        
        // Кеш для стабильных данных
        this.dataCache = new Map();
        this.seedCache = new Map();
        
        // ИСПРАВЛЕННАЯ конфигурация
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
                staggerDelay: 100,
                fastDuration: 300,
                slowDuration: 800
            },
            // ИСПРАВЛЕНИЕ 1: Правильный API endpoint
            apiEndpoint: '/api/verification-stats',
            useRealData: true,
            apiTimeout: 10000
        };
        
        this.initialize();
    }
    
    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКА
    // ==========================================
    
    async initialize() {
        try {
            console.log('🚀 Инициализация дашборда верификации...');
            
            this.setupAnimationStyles();
            this.applyTableStyles();
            this.applyCardLayoutStyles();
            this.setupEventListeners();
            this.startTimeDisplay();
            
            await this.animateInitialization();
            
            // Проверяем доступность API
            const apiAvailable = await this.testApiConnection();
            if (!apiAvailable) {
                console.warn('⚠️ API недоступен, используем тестовые данные');
                this.config.useRealData = false;
            }
            
            await this.loadInitialData();
            
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
        }
    }

    async testApiConnection() {
        try {
            console.log('🔍 Проверяем подключение к API...');
            const response = await fetch('/api/verification-health', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ API доступен:', result);
                return result.success;
            } else {
                console.warn('⚠️ API недоступен, статус:', response.status);
                return false;
            }
        } catch (error) {
            console.warn('⚠️ Ошибка подключения к API:', error.message);
            return false;
        }
    }
    
    setupAnimationStyles() {
        const styleId = 'verif-animation-styles';
        if (document.getElementById(styleId)) return;
        
        const animationStyles = document.createElement('style');
        animationStyles.id = styleId;
        animationStyles.textContent = `
            /* === СОВРЕМЕННЫЕ CSS ПЕРЕМЕННЫЕ === */
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
                --verif-shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                
                --verif-radius-sm: 0.375rem;
                --verif-radius: 0.5rem;
                --verif-radius-md: 0.75rem;
                --verif-radius-lg: 1rem;
                --verif-radius-xl: 1.5rem;
                --verif-radius-2xl: 2rem;
                
                --verif-spacing-xs: 0.25rem;
                --verif-spacing-sm: 0.5rem;
                --verif-spacing: 1rem;
                --verif-spacing-md: 1.5rem;
                --verif-spacing-lg: 2rem;
                --verif-spacing-xl: 3rem;
                --verif-spacing-2xl: 4rem;
                
                --verif-transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
                --verif-transition: 300ms cubic-bezier(0.4, 0, 0.2, 1);
                --verif-transition-slow: 500ms cubic-bezier(0.4, 0, 0.2, 1);
                --verif-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
                --verif-smooth: cubic-bezier(0.25, 0.46, 0.45, 0.94);
            }

            /* === БАЗОВЫЕ АНИМАЦИИ === */
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

            @keyframes verif-fadeInDown {
                from {
                    opacity: 0;
                    transform: translateY(-30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes verif-fadeInLeft {
                from {
                    opacity: 0;
                    transform: translateX(-30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            @keyframes verif-fadeInRight {
                from {
                    opacity: 0;
                    transform: translateX(30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
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

            @keyframes verif-slideInUp {
                from {
                    opacity: 0;
                    transform: translateY(100%) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            @keyframes verif-bounce {
                0%, 20%, 53%, 80%, 100% {
                    transform: translateY(0);
                }
                40%, 43% {
                    transform: translateY(-15px);
                }
                70% {
                    transform: translateY(-7px);
                }
                90% {
                    transform: translateY(-3px);
                }
            }

            @keyframes verif-pulse {
                0% {
                    transform: scale(1);
                    box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.7);
                }
                70% {
                    transform: scale(1.05);
                    box-shadow: 0 0 0 10px rgba(255, 107, 53, 0);
                }
                100% {
                    transform: scale(1);
                    box-shadow: 0 0 0 0 rgba(255, 107, 53, 0);
                }
            }

            @keyframes verif-glow {
                0%, 100% {
                    box-shadow: 0 0 5px rgba(255, 107, 53, 0.5);
                }
                50% {
                    box-shadow: 0 0 20px rgba(255, 107, 53, 0.8), 0 0 30px rgba(255, 107, 53, 0.6);
                }
            }

            @keyframes verif-shimmer {
                0% {
                    background-position: -1000px 0;
                }
                100% {
                    background-position: 1000px 0;
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

            @keyframes verif-wiggle {
                0%, 7% {
                    transform: rotateZ(0);
                }
                15% {
                    transform: rotateZ(-15deg);
                }
                20% {
                    transform: rotateZ(10deg);
                }
                25% {
                    transform: rotateZ(-10deg);
                }
                30% {
                    transform: rotateZ(6deg);
                }
                35% {
                    transform: rotateZ(-4deg);
                }
                40%, 100% {
                    transform: rotateZ(0);
                }
            }

            @keyframes verif-heartbeat {
                0% {
                    transform: scale(1);
                }
                14% {
                    transform: scale(1.3);
                }
                28% {
                    transform: scale(1);
                }
                42% {
                    transform: scale(1.3);
                }
                70% {
                    transform: scale(1);
                }
            }

            /* === КЛАССЫ АНИМАЦИЙ === */
            .verif-animate-fadeIn {
                animation: verif-fadeIn 0.6s var(--verif-smooth) forwards;
            }

            .verif-animate-fadeInUp {
                animation: verif-fadeInUp 0.6s var(--verif-smooth) forwards;
            }

            .verif-animate-fadeInDown {
                animation: verif-fadeInDown 0.6s var(--verif-smooth) forwards;
            }

            .verif-animate-fadeInLeft {
                animation: verif-fadeInLeft 0.6s var(--verif-smooth) forwards;
            }

            .verif-animate-fadeInRight {
                animation: verif-fadeInRight 0.6s var(--verif-smooth) forwards;
            }

            .verif-animate-scaleIn {
                animation: verif-scaleIn 0.4s var(--verif-bounce) forwards;
            }

            .verif-animate-slideInUp {
                animation: verif-slideInUp 0.6s var(--verif-smooth) forwards;
            }

            .verif-animate-bounce {
                animation: verif-bounce 1s;
            }

            .verif-animate-pulse {
                animation: verif-pulse 2s infinite;
            }

            .verif-animate-glow {
                animation: verif-glow 2s ease-in-out infinite alternate;
            }

            .verif-animate-spin {
                animation: verif-spin 1s linear infinite;
            }

            .verif-animate-wiggle {
                animation: verif-wiggle 1s ease-in-out;
            }

            .verif-animate-heartbeat {
                animation: verif-heartbeat 1.5s ease-in-out infinite;
            }

            /* === ЗАГРУЗОЧНЫЕ ИНДИКАТОРЫ === */
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
                animation: verif-fadeIn 0.3s var(--verif-smooth);
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

            .verif-spinner::after {
                content: '';
                position: absolute;
                top: 8px;
                left: 8px;
                width: 32px;
                height: 32px;
                border: 3px solid transparent;
                border-top: 3px solid var(--verif-primary-light);
                border-radius: 50%;
                animation: verif-spin 1.5s linear infinite reverse;
            }

            .verif-loading-dots {
                display: flex;
                gap: var(--verif-spacing-xs);
                margin: var(--verif-spacing) 0;
            }

            .verif-loading-dot {
                width: 12px;
                height: 12px;
                background: linear-gradient(135deg, var(--verif-primary), var(--verif-primary-light));
                border-radius: 50%;
                animation: verif-loading-dot 1.4s ease-in-out infinite both;
                box-shadow: 0 2px 4px rgba(255, 107, 53, 0.3);
            }

            .verif-loading-dot:nth-child(1) { animation-delay: -0.32s; }
            .verif-loading-dot:nth-child(2) { animation-delay: -0.16s; }
            .verif-loading-dot:nth-child(3) { animation-delay: 0s; }

            @keyframes verif-loading-dot {
                0%, 80%, 100% {
                    transform: scale(0);
                    opacity: 0.5;
                }
                40% {
                    transform: scale(1);
                    opacity: 1;
                }
            }

            .verif-loading-text {
                color: var(--verif-gray-600);
                font-size: 0.875rem;
                font-weight: 500;
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
                letter-spacing: 0.025em;
                animation: verif-pulse 2s ease-in-out infinite;
            }

            /* === СКЕЛЕТОН ЗАГРУЗКА === */
            .verif-loading-skeleton {
                background: linear-gradient(
                    90deg,
                    var(--verif-gray-100) 25%,
                    var(--verif-gray-200) 50%,
                    var(--verif-gray-100) 75%
                );
                background-size: 200% 100%;
                animation: verif-shimmer 1.5s infinite ease-in-out;
                border-radius: var(--verif-radius);
                min-height: 20px;
            }

            /* === HOVER ЭФФЕКТЫ === */
            .verif-card-hover {
                transition: all var(--verif-transition);
                cursor: pointer;
            }

            .verif-card-hover:hover {
                transform: translateY(-4px) scale(1.02);
                box-shadow: var(--verif-shadow-xl);
            }

            .verif-card-hover:active {
                transform: translateY(-2px) scale(1.01);
            }

            /* === ПЕРЕХОДЫ МЕЖДУ ВКЛАДКАМИ === */
            .verif-tab-switching {
                animation: verif-tab-switch 0.5s var(--verif-smooth) forwards;
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

            /* === АНИМАЦИИ ГРАФИКОВ === */
            .verif-chart-reveal {
                animation: verif-chart-reveal 0.8s var(--verif-smooth) forwards;
            }

            @keyframes verif-chart-reveal {
                from {
                    opacity: 0;
                    transform: scale(0.9) rotateY(5deg);
                }
                to {
                    opacity: 1;
                    transform: scale(1) rotateY(0deg);
                }
            }

            /* === АНИМАЦИИ СЧЕТЧИКОВ === */
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

            /* === АНИМАЦИИ ТАБЛИЦ === */
            .verif-table-row-animate {
                animation: verif-table-row-slide 0.5s var(--verif-smooth) forwards;
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

            /* === УТИЛИТАРНЫЕ КЛАССЫ === */
            .verif-transition {
                transition: all var(--verif-transition);
            }

            .verif-transition-fast {
                transition: all var(--verif-transition-fast);
            }

            .verif-transition-slow {
                transition: all var(--verif-transition-slow);
            }

            .verif-shadow-glow {
                box-shadow: 0 0 20px rgba(255, 107, 53, 0.3);
            }

            .verif-gradient-primary {
                background: linear-gradient(135deg, var(--verif-primary) 0%, var(--verif-primary-light) 100%);
            }

            .verif-gradient-soft {
                background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
            }

            /* === РЕСПОНСИВНОСТЬ === */
            @media (max-width: 768px) {
                .verif-loading-overlay {
                    backdrop-filter: blur(4px);
                }
                
                .verif-spinner {
                    width: 40px;
                    height: 40px;
                }
                
                .verif-loading-text {
                    font-size: 0.8rem;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .verif-animate-fadeIn,
                .verif-animate-fadeInUp,
                .verif-animate-fadeInDown,
                .verif-animate-fadeInLeft,
                .verif-animate-fadeInRight,
                .verif-animate-scaleIn,
                .verif-animate-slideInUp,
                .verif-animate-bounce,
                .verif-animate-pulse,
                .verif-animate-glow,
                .verif-animate-spin,
                .verif-animate-wiggle,
                .verif-animate-heartbeat,
                .verif-card-hover,
                .verif-tab-switching,
                .verif-chart-reveal,
                .verif-counter-animate,
                .verif-table-row-animate {
                    animation: none;
                    transition: none;
                }
            }
        `;
        document.head.appendChild(animationStyles);
    }

        applyComponentStyles() {
        const styleId = 'verif-component-styles';
        if (document.getElementById(styleId)) return;
        
        const componentStyles = document.createElement('style');
        componentStyles.id = styleId;
        componentStyles.textContent = `
            /* === СТИЛИ КАРТОЧЕК === */
            .verif-summary-card-compact {
                background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                border-radius: var(--verif-radius-xl);
                padding: var(--verif-spacing-lg);
                box-shadow: var(--verif-shadow-md);
                border: 1px solid var(--verif-gray-200);
                transition: all var(--verif-transition);
                position: relative;
                overflow: hidden;
            }

            .verif-summary-card-compact::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, var(--verif-primary), var(--verif-primary-light));
            }

            .verif-summary-card-compact:hover {
                transform: translateY(-4px) scale(1.02);
                box-shadow: var(--verif-shadow-xl);
                border-color: var(--verif-primary);
            }

            /* === СТИЛИ ГРАФИКОВ === */
            .verif-chart-card-orange {
                background: #ffffff;
                border-radius: var(--verif-radius-xl);
                padding: var(--verif-spacing-lg);
                box-shadow: var(--verif-shadow-lg);
                border: 1px solid var(--verif-gray-200);
                transition: all var(--verif-transition);
                margin: var(--verif-spacing-md) 0;
            }

            .verif-chart-container {
                position: relative;
                height: 300px;
                margin: var(--verif-spacing) 0;
            }

            /* === НАВИГАЦИЯ === */
            .verif-nav-tab {
                padding: var(--verif-spacing) var(--verif-spacing-lg);
                border-radius: var(--verif-radius-lg);
                font-weight: 500;
                font-size: 0.875rem;
                color: var(--verif-gray-600);
                background: transparent;
                border: 2px solid transparent;
                transition: all var(--verif-transition);
                cursor: pointer;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: var(--verif-spacing-sm);
            }

            .verif-nav-tab:hover {
                color: var(--verif-primary);
                background: rgba(255, 107, 53, 0.05);
                border-color: rgba(255, 107, 53, 0.2);
                transform: translateY(-2px);
            }

            .verif-nav-tab.active {
                color: white;
                background: linear-gradient(135deg, var(--verif-primary), var(--verif-primary-light));
                border-color: var(--verif-primary);
                box-shadow: var(--verif-shadow-md);
            }

            /* === КНОПКИ ПЕРИОДА === */
            .verif-period-btn {
                padding: var(--verif-spacing-sm) var(--verif-spacing);
                border-radius: var(--verif-radius);
                font-weight: 500;
                font-size: 0.8125rem;
                color: var(--verif-gray-600);
                background: var(--verif-gray-100);
                border: 2px solid var(--verif-gray-200);
                transition: all var(--verif-transition);
                cursor: pointer;
            }

            .verif-period-btn:hover {
                color: var(--verif-primary);
                background: rgba(255, 107, 53, 0.05);
                border-color: var(--verif-primary);
                transform: scale(1.05);
            }

            .verif-period-btn.active {
                color: white;
                background: linear-gradient(135deg, var(--verif-primary), var(--verif-primary-light));
                border-color: var(--verif-primary);
                box-shadow: var(--verif-shadow-sm);
            }
        `;
        document.head.appendChild(componentStyles);
    }

    applyCardLayoutStyles() {
        const styleId = 'verif-card-layout-styles';
        if (document.getElementById(styleId)) return;
        
        const cardStyles = document.createElement('style');
        cardStyles.id = styleId;
        cardStyles.textContent = `
            /* === ИСПРАВЛЕНИЕ МАКЕТА КАРТОЧЕК === */
            
            /* Контейнер для навигационных карточек (вкладки) */
            .verif-nav-section,
            .verif-nav-tabs {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                margin-bottom: 24px;
                width: 100%;
            }
            
            .verif-nav-tab {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-height: 80px !important;
                padding: 16px 20px !important;
                border-radius: 12px !important;
                border: 2px solid var(--verif-gray-200) !important;
                background: #ffffff !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                text-align: center !important;
                font-weight: 500 !important;
                color: var(--verif-gray-600) !important;
                text-decoration: none !important;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
            }
            
            .verif-nav-tab:hover {
                border-color: var(--verif-primary) !important;
                background: rgba(255, 107, 53, 0.05) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 4px 12px rgba(255, 107, 53, 0.15) !important;
            }
            
            .verif-nav-tab.active {
                border-color: var(--verif-primary) !important;
                background: linear-gradient(135deg, var(--verif-primary), var(--verif-primary-light)) !important;
                color: white !important;
                box-shadow: 0 4px 16px rgba(255, 107, 53, 0.3) !important;
            }
            
            /* Контейнер для статистических карточек */
            .verif-stats-grid,
            .verif-summary-cards,
            .verif-cards-container {
                display: grid !important;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
                gap: 20px !important;
                margin: 24px 0 !important;
                width: 100% !important;
            }
            
            /* Унификация всех карточек статистики */
            .verif-summary-card-compact,
            .verif-stat-card,
            .verif-metric-card {
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                min-height: 140px !important;
                max-height: 140px !important;
                padding: 20px !important;
                border-radius: 16px !important;
                border: 1px solid var(--verif-gray-200) !important;
                background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                position: relative !important;
                overflow: hidden !important;
            }
            
            /* Цветная полоска сверху карточки */
            .verif-summary-card-compact::before,
            .verif-stat-card::before,
            .verif-metric-card::before {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                height: 4px !important;
                background: linear-gradient(90deg, var(--verif-primary), var(--verif-primary-light)) !important;
            }
            
            /* Иконка в карточке */
            .verif-summary-card-compact .verif-summary-icon,
            .verif-stat-card .icon,
            .verif-metric-card .icon {
                width: 48px !important;
                height: 48px !important;
                border-radius: 12px !important;
                background: linear-gradient(135deg, var(--verif-primary), var(--verif-primary-light)) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                margin-bottom: 12px !important;
                flex-shrink: 0 !important;
            }
            
            /* Контейнер для текста */
            .verif-summary-card-compact .verif-summary-content,
            .verif-stat-card .content,
            .verif-metric-card .content {
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                flex-grow: 1 !important;
                min-height: 0 !important;
            }
            
            /* Заголовок карточки */
            .verif-summary-card-compact .verif-summary-title,
            .verif-stat-card .title,
            .verif-metric-card .title {
                font-size: 14px !important;
                font-weight: 500 !important;
                color: var(--verif-gray-600) !important;
                line-height: 1.3 !important;
                margin-bottom: 8px !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                display: -webkit-box !important;
                -webkit-line-clamp: 2 !important;
                -webkit-box-orient: vertical !important;
            }
            
            /* Значение в карточке */
            .verif-summary-card-compact .verif-summary-value,
            .verif-stat-card .value,
            .verif-metric-card .value {
                font-size: 24px !important;
                font-weight: 700 !important;
                color: var(--verif-gray-800) !important;
                line-height: 1.2 !important;
                margin-top: auto !important;
            }
            
            /* Hover эффект для карточек */
            .verif-summary-card-compact:hover,
            .verif-stat-card:hover,
            .verif-metric-card:hover {
                transform: translateY(-4px) scale(1.02) !important;
                box-shadow: 0 8px 25px rgba(255, 107, 53, 0.15) !important;
                border-color: var(--verif-primary) !important;
            }
            
            /* Специальные стили для карточек с графиками */
            .verif-summary-chart-compact {
                height: 40px !important;
                margin-top: 8px !important;
                opacity: 0.7 !important;
            }
            
            /* Адаптивность для разных экранов */
            @media (max-width: 1200px) {
                .verif-stats-grid,
                .verif-summary-cards,
                .verif-cards-container {
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important;
                    gap: 16px !important;
                }
                
                .verif-summary-card-compact,
                .verif-stat-card,
                .verif-metric-card {
                    min-height: 130px !important;
                    max-height: 130px !important;
                    padding: 16px !important;
                }
            }
            
            @media (max-width: 768px) {
                .verif-nav-section,
                .verif-nav-tabs {
                    grid-template-columns: 1fr !important;
                    gap: 12px !important;
                }
                
                .verif-nav-tab {
                    min-height: 60px !important;
                    padding: 12px 16px !important;
                }
                
                .verif-stats-grid,
                .verif-summary-cards,
                .verif-cards-container {
                    grid-template-columns: repeat(2, 1fr) !important;
                    gap: 12px !important;
                }
                
                .verif-summary-card-compact,
                .verif-stat-card,
                .verif-metric-card {
                    min-height: 120px !important;
                    max-height: 120px !important;
                    padding: 14px !important;
                }
                
                .verif-summary-card-compact .verif-summary-value,
                .verif-stat-card .value,
                .verif-metric-card .value {
                    font-size: 20px !important;
                }
            }
            
            @media (max-width: 480px) {
                .verif-stats-grid,
                .verif-summary-cards,
                .verif-cards-container {
                    grid-template-columns: 1fr !important;
                }
                
                .verif-summary-card-compact,
                .verif-stat-card,
                .verif-metric-card {
                    min-height: 100px !important;
                    max-height: 100px !important;
                    padding: 12px !important;
                }
            }
            
            /* Исправление для 6 карточек в ряду */
            .verif-stats-grid-6 {
                display: grid !important;
                grid-template-columns: repeat(6, 1fr) !important;
                gap: 16px !important;
                margin: 24px 0 !important;
            }
            
            @media (max-width: 1400px) {
                .verif-stats-grid-6 {
                    grid-template-columns: repeat(3, 1fr) !important;
                }
            }
            
            @media (max-width: 768px) {
                .verif-stats-grid-6 {
                    grid-template-columns: repeat(2, 1fr) !important;
                }
            }
            
            @media (max-width: 480px) {
                .verif-stats-grid-6 {
                    grid-template-columns: 1fr !important;
                }
            }
            
            /* Контейнер для 5 карточек в ряду */
            .verif-stats-grid-5 {
                display: grid !important;
                grid-template-columns: repeat(5, 1fr) !important;
                gap: 16px !important;
                margin: 24px 0 !important;
            }
            
            @media (max-width: 1200px) {
                .verif-stats-grid-5 {
                    grid-template-columns: repeat(3, 1fr) !important;
                }
            }
            
            @media (max-width: 768px) {
                .verif-stats-grid-5 {
                    grid-template-columns: repeat(2, 1fr) !important;
                }
            }
            
            @media (max-width: 480px) {
                .verif-stats-grid-5 {
                    grid-template-columns: 1fr !important;
                }
            }
            
            /* Принудительное выравнивание для всех flex контейнеров */
            .verif-container,
            .verif-row,
            .verif-grid {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 16px !important;
                align-items: stretch !important;
            }
            
            .verif-container > *,
            .verif-row > *,
            .verif-grid > * {
                flex: 1 1 calc(33.333% - 16px) !important;
                min-width: 200px !important;
            }
            
            @media (max-width: 768px) {
                .verif-container > *,
                .verif-row > *,
                .verif-grid > * {
                    flex: 1 1 calc(50% - 8px) !important;
                    min-width: 150px !important;
                }
            }
            
            @media (max-width: 480px) {
                .verif-container > *,
                .verif-row > *,
                .verif-grid > * {
                    flex: 1 1 100% !important;
                    min-width: 100% !important;
                }
            }
        `;
        document.head.appendChild(cardStyles);
    }
    
    applyTableStyles() {
        const styleId = 'verif-table-styles';
        if (document.getElementById(styleId)) return;
        
        const tableStyles = document.createElement('style');
        tableStyles.id = styleId;
        tableStyles.textContent = `
            /* === СОВРЕМЕННЫЕ СТИЛИ ТАБЛИЦ === */
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

            /* === ЗАГОЛОВКИ ТАБЛИЦЫ === */
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

            .verif-data-table th:first-child {
                padding-left: var(--verif-spacing-lg) !important;
            }

            .verif-data-table th:last-child {
                padding-right: var(--verif-spacing-lg) !important;
            }

            /* === ЯЧЕЙКИ ТАБЛИЦЫ === */
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
                transition: all var(--verif-transition-fast);
                position: relative;
            }

            .verif-data-table td:first-child {
                padding-left: var(--verif-spacing-lg) !important;
                border-left: 3px solid transparent !important;
            }

            .verif-data-table td:last-child {
                padding-right: var(--verif-spacing-lg) !important;
            }

            /* === СТРОКИ ТАБЛИЦЫ === */
            .verif-data-table tbody tr {
                transition: all var(--verif-transition-fast);
                position: relative;
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

            .verif-data-table tbody tr:hover td:first-child {
                border-left-color: var(--verif-primary) !important;
            }

            /* === ПОСЛЕДНЯЯ СТРОКА === */
            .verif-data-table tbody tr:last-child td {
                border-bottom: none !important;
            }

            /* === РАВНОМЕРНОЕ РАСПРЕДЕЛЕНИЕ КОЛОНОК === */
            .verif-data-table th,
            .verif-data-table td {
                width: 20% !important;
            }

            /* === КОНТЕЙНЕР ТАБЛИЦЫ === */
            .verif-data-table-section {
                background: #ffffff;
                border-radius: var(--verif-radius-xl);
                padding: var(--verif-spacing-lg);
                box-shadow: var(--verif-shadow);
                border: 1px solid var(--verif-gray-200);
                margin: var(--verif-spacing-lg) 0;
                transition: all var(--verif-transition);
            }

            .verif-data-table-section:hover {
                box-shadow: var(--verif-shadow-lg);
            }

            /* === ЗАГОЛОВОК ТАБЛИЦЫ === */
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

            /* === СЧЕТЧИК ЗАПИСЕЙ === */
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
                display: inline-flex !important;
                align-items: center !important;
                gap: var(--verif-spacing-xs) !important;
            }

            .record-count::before {
                content: '📊';
                font-size: 0.75rem;
            }

            .record-count:hover {
                background: linear-gradient(135deg, var(--verif-primary), var(--verif-primary-light)) !important;
                color: white !important;
                border-color: var(--verif-primary) !important;
                transform: scale(1.05);
            }

            /* === ПОИСК В ТАБЛИЦЕ === */
            .verif-table-search {
                width: 100%;
                max-width: 300px;
                padding: var(--verif-spacing) var(--verif-spacing-md);
                border: 2px solid var(--verif-gray-200);
                border-radius: var(--verif-radius-lg);
                font-size: 0.875rem;
                font-weight: 500;
                color: var(--verif-gray-700);
                background: #ffffff;
                transition: all var(--verif-transition);
                margin-bottom: var(--verif-spacing-md);
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            }

            .verif-table-search::placeholder {
                color: var(--verif-gray-400);
                font-weight: 400;
            }

            .verif-table-search:focus {
                outline: none;
                border-color: var(--verif-primary);
                box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
                background: var(--verif-gray-50);
            }

            /* === ПУСТОЕ СОСТОЯНИЕ ТАБЛИЦЫ === */
            .verif-empty-table {
                text-align: center;
                padding: var(--verif-spacing-2xl);
                color: var(--verif-gray-500);
            }

            .verif-empty-icon {
                width: 64px;
                height: 64px;
                background: linear-gradient(135deg, var(--verif-gray-100), var(--verif-gray-200));
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto var(--verif-spacing);
                animation: verif-pulse 2s infinite;
            }

            /* === АДАПТИВНОСТЬ === */
            @media (max-width: 1024px) {
                .verif-data-table th,
                .verif-data-table td {
                    padding: var(--verif-spacing) var(--verif-spacing-sm) !important;
                    font-size: 0.8125rem !important;
                }
            }

            @media (max-width: 768px) {
                .verif-data-table-section {
                    padding: var(--verif-spacing);
                    margin: var(--verif-spacing) 0;
                }

                .verif-data-table {
                    font-size: 0.75rem;
                }

                .verif-data-table th,
                .verif-data-table td {
                    padding: var(--verif-spacing-sm) var(--verif-spacing-xs) !important;
                    font-size: 0.75rem !important;
                }

                .verif-data-table th:first-child,
                .verif-data-table td:first-child {
                    padding-left: var(--verif-spacing-sm) !important;
                }

                .verif-data-table th:last-child,
                .verif-data-table td:last-child {
                    padding-right: var(--verif-spacing-sm) !important;
                }

                .verif-table-title {
                    font-size: 1.125rem;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: var(--verif-spacing-sm);
                }

                .record-count {
                    margin-left: 0 !important;
                    align-self: flex-end;
                }

                .verif-table-search {
                    max-width: 100%;
                }
            }

            @media (max-width: 640px) {
                .verif-data-table {
                    display: block;
                    overflow-x: auto;
                    white-space: nowrap;
                    scrollbar-width: thin;
                    scrollbar-color: var(--verif-primary) var(--verif-gray-100);
                }

                .verif-data-table::-webkit-scrollbar {
                    height: 8px;
                }

                .verif-data-table::-webkit-scrollbar-track {
                    background: var(--verif-gray-100);
                    border-radius: var(--verif-radius);
                }

                .verif-data-table::-webkit-scrollbar-thumb {
                    background: linear-gradient(135deg, var(--verif-primary), var(--verif-primary-light));
                    border-radius: var(--verif-radius);
                }

                .verif-data-table::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(135deg, var(--verif-primary-dark), var(--verif-primary));
                }
            }

            /* === АНИМАЦИИ СТРОК === */
            @keyframes verif-row-highlight {
                0% {
                    background-color: rgba(255, 107, 53, 0.2);
                }
                100% {
                    background-color: transparent;
                }
            }

            .verif-data-table tbody tr.highlight {
                animation: verif-row-highlight 1s ease-out;
            }

            /* === СОРТИРОВКА СТОЛБЦОВ === */
            .verif-sortable {
                cursor: pointer;
                user-select: none;
                position: relative;
            }

            .verif-sortable:hover {
                color: var(--verif-primary) !important;
                background: rgba(255, 107, 53, 0.05) !important;
            }

            .verif-sortable::after {
                content: '';
                position: absolute;
                right: var(--verif-spacing-sm);
                top: 50%;
                transform: translateY(-50%);
                width: 0;
                height: 0;
                border-left: 4px solid transparent;
                border-right: 4px solid transparent;
                border-bottom: 4px solid var(--verif-gray-400);
                transition: all var(--verif-transition);
            }

            .verif-sortable.asc::after {
                border-bottom: 4px solid var(--verif-primary);
                transform: translateY(-50%) rotate(180deg);
            }

            .verif-sortable.desc::after {
                border-bottom: 4px solid var(--verif-primary);
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
        
        // Выбор периода с анимацией
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
        
        // Поиск в таблицах с анимацией
        document.querySelectorAll('.verif-table-search').forEach(input => {
            input.addEventListener('input', this.debounce((e) => {
                this.animatedTableSearch(e.target.value);
            }, 300));
        });
        
        // Изменение размера окна
        window.addEventListener('resize', this.debounce(() => {
            this.resizeAllCharts();
        }, 250));
        
        // Обработка видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateTimeDisplay();
            }
        });
        
        // Добавляем hover эффекты для карточек
        this.setupCardHoverEffects();
    }
    
    setupCardHoverEffects() {
        // Добавляем класс для hover анимаций
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
                day: 'numeric',
                timeZone: 'Europe/Moscow'
            };
            dateElement.textContent = now.toLocaleDateString('ru-RU', options);
        }
        this.timestamp = this.getCurrentTimestamp();
    }
    
    async loadInitialData() {
        await this.loadTabData(this.currentTab);
    }
    
    // ==========================================
    // АНИМИРОВАННЫЕ ПЕРЕХОДЫ И ДЕЙСТВИЯ
    // ==========================================
    
    async animatedTabSwitch(tabName) {
        if (this.currentTab === tabName || this.isLoading) return;
        
        try {
            this.updateActiveTab(tabName);
            this.currentTab = tabName;
            await this.loadTabData(tabName);
        } catch (error) {
            console.error('Ошибка переключения вкладки:', error);
        }
    }
    
    async animatedPeriodChange(period) {
        if (this.currentPeriod === period || this.isLoading) return;
        
        try {
            this.dataCache.clear();
            this.updateActivePeriod(period);
            
            const customSection = document.getElementById('verif-custom-period');
            if (customSection) {
                if (period === 'custom') {
                    customSection.style.display = 'block';
                    this.setupDateInputs();
                    return;
                } else {
                    customSection.style.display = 'none';
                }
            }
            
            this.currentPeriod = period;
            await this.loadTabData(this.currentTab);
            
        } catch (error) {
            console.error('Ошибка изменения периода:', error);
        }
    }
    
    updateActiveTab(tabName) {
        document.querySelectorAll('.verif-nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
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
    // ЗАГРУЗКА И ОБРАБОТКА ДАННЫХ
    // ==========================================
    
    async loadTabData(tabName) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showAnimatedLoading(tabName, true);
        
        try {
            console.log(`🔄 Загружаем данные для вкладки: ${tabName}, период: ${this.currentPeriod}`);
            
            let data;
            
            if (this.config.useRealData) {
                try {
                    data = await this.fetchRealData(tabName);
                    console.log(`✅ Получены данные из API:`, data);
                } catch (apiError) {
                    console.warn('❌ Ошибка API, переключаемся на тестовые данные:', apiError.message);
                    data = this.generateMockData(tabName);
                }
            } else {
                data = this.generateMockData(tabName);
            }
            
            this.data.set(tabName, data);
            await this.animatedContentUpdate(tabName, data);
            
        } catch (error) {
            console.error('❌ Критическая ошибка загрузки данных:', error);
            this.handleLoadingError(tabName);
        } finally {
            this.showAnimatedLoading(tabName, false);
            this.isLoading = false;
        }
    }
    
    async fetchRealData(tabName) {
        const url = `${this.config.apiEndpoint}?tab=${tabName}&period=${this.currentPeriod}&timestamp=${Date.now()}`;
        const headers = {
            'Content-Type': 'application/json',
            'X-User': this.user,
            'X-Timestamp': this.timestamp,
            'Accept': 'application/json'
        };
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);
        
        try {
            console.log(`🌐 Запрос к API: ${url}`);
            
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
            console.log('📊 Получен ответ API:', result);
            
            if (!result.success || !result.data) {
                throw new Error(result.message || 'Некорректный ответ сервера');
            }
            
            return this.processApiData(result.data, result.metadata);
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Превышено время ожидания ответа сервера');
            }
            
            console.error('❌ Ошибка API запроса:', error);
            throw error;
        }
    }

    processApiData(apiData, metadata) {
        console.log('🔄 Обрабатываем данные от сервера:', apiData);
        
        // Обрабатываем данные согласно структуре сервера
        const processedData = {
            // Основные поля из API
            totalCount: parseInt(apiData.totalCount) || 0,
            totalAmount: parseFloat(apiData.totalAmount) || 0,
            confirmedCount: parseInt(apiData.confirmedCount) || 0,
            gisAmount: parseFloat(apiData.gisAmount) || 0,
            confirmationRate: parseFloat(apiData.confirmationRate) || 0,
            
            // Поля для подтвержденных поездок
            confirmedAmount: parseFloat(apiData.confirmedAmount) || 0,
            paidCount: parseInt(apiData.paidCount) || 0,
            paidAmount: parseFloat(apiData.paidAmount) || 0,
            paidPercentage: parseFloat(apiData.paidPercentage) || 0,
            avgTime: parseFloat(apiData.avgTime) || 0,
            
            // Поля для ВПН
            vpnCount: parseInt(apiData.vpnCount) || 0,
            totalVpn: parseFloat(apiData.totalVpn) || 0,
            corrected: parseInt(apiData.corrected) || 0,
            correctedPercentage: parseFloat(apiData.correctedPercentage) || 0,
            vpnRemoved: parseInt(apiData.vpnRemoved) || 0,
            vpnRemovedAmount: parseFloat(apiData.vpnRemovedAmount) || 0,
            
            // Данные графиков
            monthlyData: this.processChartDataFromApi(apiData.monthlyData),
            dailyData: this.processChartDataFromApi(apiData.dailyData),
            sourcesData: apiData.sourcesData || null,
            
            // Табличные данные
            tableData: Array.isArray(apiData.tableData) ? apiData.tableData : [],
            
            // Тренды для мини-графиков
            countTrend: this.processTrendFromApi(apiData.countTrend),
            amountTrend: this.processTrendFromApi(apiData.amountTrend),
            confirmedTrend: this.processTrendFromApi(apiData.confirmedTrend),
            rateTrend: this.processTrendFromApi(apiData.rateTrend),
            percentageTrend: this.processTrendFromApi(apiData.percentageTrend),
            timeTrend: this.processTrendFromApi(apiData.timeTrend),
            correctedTrend: this.processTrendFromApi(apiData.correctedTrend),
            removedTrend: this.processTrendFromApi(apiData.removedTrend),
            removedAmountTrend: this.processTrendFromApi(apiData.removedAmountTrend)
        };
        
        console.log('✅ Данные обработаны:', processedData);
        return processedData;
    }

    processChartDataFromApi(chartData) {
        if (!chartData || !chartData.labels || !chartData.datasets) {
            return null;
        }
        
        return {
            labels: chartData.labels,
            datasets: chartData.datasets.map(dataset => ({
                ...dataset,
                data: Array.isArray(dataset.data) ? dataset.data : []
            }))
        };
    }
     
    processTrendFromApi(trendData) {
        if (!trendData || !Array.isArray(trendData.values)) {
            return {
                labels: Array.from({length: 7}, (_, i) => `${i + 1}`),
                values: Array.from({length: 7}, () => 0)
            };
        }
        
        return trendData;
    }

    // Вспомогательные методы
    generateStableSeed(period, date = null) {
        const baseDate = date || new Date().toISOString().split('T')[0];
        const key = `${period}-${baseDate}`;
        
        if (this.seedCache.has(key)) {
            return this.seedCache.get(key);
        }
        
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        const seed = Math.abs(hash) % 10000;
        this.seedCache.set(key, seed);
        return seed;
    }

    seededRandom(seed, min, max, decimals = 0) {
        const x = Math.sin(seed) * 10000;
        const random = x - Math.floor(x);
        
        const value = random * (max - min) + min;
        return decimals > 0 ? 
            Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals) : 
            Math.floor(value);
    }

    generateStableChartData(type, periods, seed) {
        const labels = [];
        const data = [];
        
        if (type === 'monthly') {
            const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
            const currentMonth = new Date().getMonth();
            
            for (let i = periods - 1; i >= 0; i--) {
                const monthIndex = (currentMonth - i + 12) % 12;
                labels.push(months[monthIndex]);
                data.push(this.seededRandom(seed + i, 200, 1500));
            }
        } else {
            for (let i = periods - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                labels.push(date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));
                data.push(this.seededRandom(seed + i, 100, 800));
            }
        }
        
        return {
            labels: labels,
            datasets: [{
                label: type === 'monthly' ? 'По месяцам' : 'По дням',
                data: data,
                backgroundColor: type === 'monthly' ? 
                    'rgba(255, 107, 53, 0.7)' : 
                    'rgba(255, 107, 53, 0.1)',
                borderColor: '#ff6b35',
                borderWidth: 2,
                fill: type !== 'monthly',
                tension: type !== 'monthly' ? 0.4 : 0
            }]
        };
    }


    generateStableTrendData(seed) {
        return {
            labels: Array.from({length: 7}, (_, i) => `День ${i + 1}`),
            values: Array.from({length: 7}, (_, i) => this.seededRandom(seed + i, 0, 100))
        };
    }
    
    generateStableSourcesData(seed) {
        const values = [
            this.seededRandom(seed + 1, 35, 50),
            this.seededRandom(seed + 2, 20, 30),
            this.seededRandom(seed + 3, 10, 20),
            this.seededRandom(seed + 4, 5, 15),
            this.seededRandom(seed + 5, 2, 8)
        ];
        
        const sum = values.reduce((a, b) => a + b, 0);
        const normalized = values.map(v => Math.round((v / sum) * 100));
        
        return {
            labels: ['ГИС ЖКХ', 'Банковские карты', 'Касса', 'Мобильные платежи', 'Другое'],
            datasets: [{
                data: normalized,
                backgroundColor: [
                    '#ff6b35',
                    '#ff8555',
                    '#ffa040',
                    '#ffb74d',
                    '#e0e0e0'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
    }
    
    generateStableTableData(tabType, days, seed) {
        const data = [];
        const currentDate = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(currentDate);
            date.setDate(currentDate.getDate() - i);
            
            const baseSeed = seed + i * 10;
            
            const row = {
                date: date.toLocaleDateString('ru-RU'),
                trips: this.seededRandom(baseSeed + 1, 100, 800),
                amount: this.seededRandom(baseSeed + 2, 50000, 300000),
                confirmed: this.seededRandom(baseSeed + 3, 80, 600),
                percentage: this.seededRandom(baseSeed + 4, 70, 95, 1)
            };
            
            if (tabType === 'confirmed') {
                row.totalTrips = row.trips;
                row.confirmedTrips = row.confirmed;
                row.paidAmount = this.seededRandom(baseSeed + 5, 40000, 250000);
                row.avgTime = this.seededRandom(baseSeed + 6, 2, 24, 1);
            } else if (tabType === 'vpn') {
                row.vpnCount = this.seededRandom(baseSeed + 7, 20, 150);
                row.vpnAmount = this.seededRandom(baseSeed + 8, 10000, 80000);
                row.corrected = this.seededRandom(baseSeed + 9, 10, 100);
                row.removed = this.seededRandom(baseSeed + 10, 5, 50);
            }
            
            data.push(row);
        }
        
        return data;
    }

    // Утилитарные методы форматирования
    safeNumber(value, decimals = 0) {
        const num = Number(value);
        if (isNaN(num)) return 0;
        return decimals > 0 ? Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals) : Math.floor(num);
    }
    
    calculatePercentage(value, total) {
        if (!total || total === 0) return 0;
        const percentage = (value / total) * 100;
        return Math.round(percentage * 10) / 10;
    }
    
    formatCounterValue(value, format) {
        switch (format) {
            case 'currency':
                return this.formatCurrency(value);
            case 'percent':
                return this.formatPercentage(value) + '%';
            case 'hours':
                return this.formatHours(value);
            default:
                return this.formatNumber(value);
        }
    }
    
    formatNumber(number) {
        const num = this.safeNumber(number);
        
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + ' млрд';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + ' млн';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + ' тыс.';
        }
        
        return new Intl.NumberFormat('ru-RU').format(num);
    }
    
    formatCurrency(number) {
        return this.formatNumber(number) + ' ₽';
    }
    
    formatPercentage(number, decimals = 1) {
        const num = this.safeNumber(number, decimals);
        return num.toFixed(decimals);
    }
    
    formatHours(number) {
        const num = this.safeNumber(number, 1);
        return num.toFixed(1) + 'ч';
    }

    getCurrentTimestamp() {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    getPeriodDays() {
        switch (this.currentPeriod) {
            case '7': return 7;
            case '30': return 30;
            case '90': return 90;
            default:
                if (this.currentPeriod.includes('_')) {
                    const [start, end] = this.currentPeriod.split('_');
                    const startDate = new Date(start);
                    const endDate = new Date(end);
                    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                }
                return 7;
        }
    }

    waitFor(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateMockData(tabName) {
        const period = this.currentPeriod;
        const cacheKey = `${tabName}-${period}`;
        
        if (this.dataCache.has(cacheKey)) {
            console.log(`🔄 Используем кешированные данные для ${cacheKey}`);
            return this.dataCache.get(cacheKey);
        }
        
        const baseSeed = this.generateStableSeed(period);
        const periodDays = this.getPeriodDays();
        
        console.log(`🎲 Генерируем стабильные тестовые данные для ${cacheKey} с seed: ${baseSeed}`);
        
        const baseData = {
            totalCount: this.seededRandom(baseSeed + 1, 5000, 15000),
            totalAmount: this.seededRandom(baseSeed + 2, 2000000, 8000000),
            confirmedCount: this.seededRandom(baseSeed + 3, 2000, 8000),
            gisAmount: this.seededRandom(baseSeed + 4, 1000000, 4000000),
            confirmationRate: this.seededRandom(baseSeed + 5, 70, 95, 1),
            
            monthlyData: this.generateStableChartData('monthly', 6, baseSeed + 10),
            dailyData: this.generateStableChartData('daily', periodDays, baseSeed + 20),
            
            countTrend: this.generateStableTrendData(baseSeed + 30),
            amountTrend: this.generateStableTrendData(baseSeed + 31),
            confirmedTrend: this.generateStableTrendData(baseSeed + 32),
            rateTrend: this.generateStableTrendData(baseSeed + 33),
            
            tableData: this.generateStableTableData(tabName, Math.min(periodDays, 30), baseSeed + 40)
        };
        
        // Специфичные данные для каждой вкладки
        let finalData;
        switch (tabName) {
            case 'confirmed':
                finalData = {
                    ...baseData,
                    confirmedAmount: this.seededRandom(baseSeed + 5, 1500000, 5000000),
                    paidCount: this.seededRandom(baseSeed + 6, 1500, 6000),
                    paidAmount: this.seededRandom(baseSeed + 7, 1200000, 4500000),
                    avgTime: this.seededRandom(baseSeed + 8, 2, 48, 1),
                    sourcesData: this.generateStableSourcesData(baseSeed + 50),
                    percentageTrend: this.generateStableTrendData(baseSeed + 34),
                    timeTrend: this.generateStableTrendData(baseSeed + 35)
                };
                break;
                
            case 'vpn':
                finalData = {
                    ...baseData,
                    vpnCount: this.seededRandom(baseSeed + 9, 500, 3000),
                    totalVpn: this.seededRandom(baseSeed + 10, 500000, 2000000),
                    corrected: this.seededRandom(baseSeed + 11, 200, 1500),
                    vpnRemoved: this.seededRandom(baseSeed + 12, 100, 800),
                    vpnRemovedAmount: this.seededRandom(baseSeed + 13, 50000, 500000),
                    correctedTrend: this.generateStableTrendData(baseSeed + 36),
                    removedTrend: this.generateStableTrendData(baseSeed + 37),
                    removedAmountTrend: this.generateStableTrendData(baseSeed + 38)
                };
                break;
                
            default:
                finalData = baseData;
        }
        
        this.dataCache.set(cacheKey, finalData);
        console.log(`💾 Тестовые данные закешированы для ${cacheKey}`);
        
        return finalData;
    }
    
    generateChartData(type, periods) {
        const labels = [];
        const data = [];
        
        if (type === 'monthly') {
            const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
            const currentMonth = new Date().getMonth();
            
            for (let i = periods - 1; i >= 0; i--) {
                const monthIndex = (currentMonth - i + 12) % 12;
                labels.push(months[monthIndex]);
                data.push(this.randomInRange(200, 1500));
            }
        } else {
            // Daily data
            for (let i = periods - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                labels.push(date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));
                data.push(this.randomInRange(100, 800));
            }
        }
        
        // ИСПРАВЛЕНИЕ: Всегда возвращаем корректную структуру
        return {
            labels: labels,
            datasets: [{
                label: type === 'monthly' ? 'По месяцам' : 'По дням',
                data: data,
                backgroundColor: type === 'monthly' ? 
                    'rgba(255, 107, 53, 0.7)' : 
                    'rgba(255, 107, 53, 0.1)',
                borderColor: '#ff6b35',
                borderWidth: 2,
                fill: type !== 'monthly',
                tension: type !== 'monthly' ? 0.4 : 0
            }]
        };
    }
    
    generateSourcesData() {
        return {
            labels: ['ГИС ЖКХ', 'Банковские карты', 'Касса', 'Мобильные платежи', 'Другое'],
            datasets: [{
                data: [45, 25, 15, 10, 5],
                backgroundColor: [
                    '#ff6b35',
                    '#ff8555',
                    '#ffa040',
                    '#ffb74d',
                    '#e0e0e0'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
    }
    
    generateTrendData() {
        return {
            labels: Array.from({length: 7}, (_, i) => `День ${i + 1}`),
            values: Array.from({length: 7}, () => this.randomInRange(0, 100))
        };
    }
    
    generateTableData(tabType, days) {
        const data = [];
        const currentDate = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(currentDate);
            date.setDate(currentDate.getDate() - i);
            
            const row = {
                date: date.toLocaleDateString('ru-RU'),
                trips: this.randomInRange(100, 800),
                amount: this.randomInRange(50000, 300000),
                confirmed: this.randomInRange(80, 600),
                percentage: this.randomInRange(70, 95, 1)
            };
            
            // Добавляем специфичные поля для разных типов таблиц
            if (tabType === 'confirmed') {
                row.totalTrips = row.trips;
                row.confirmedTrips = row.confirmed;
                row.paidAmount = this.randomInRange(40000, 250000);
                row.avgTime = this.randomInRange(2, 24, 1);
            } else if (tabType === 'vpn') {
                row.vpnCount = this.randomInRange(20, 150);
                row.vpnAmount = this.randomInRange(10000, 80000);
                row.corrected = this.randomInRange(10, 100);
                row.removed = this.randomInRange(5, 50);
            }
            
            data.push(row);
        }
        
        return data;
    }
    
    getPeriodDays() {
        switch (this.currentPeriod) {
            case '7': return 7;
            case '30': return 30;
            case '90': return 90;
            default:
                if (this.currentPeriod.includes('_')) {
                    const [start, end] = this.currentPeriod.split('_');
                    const startDate = new Date(start);
                    const endDate = new Date(end);
                    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                }
                return 7;
        }
    }
    
    randomInRange(min, max, decimals = 0) {
        const value = Math.random() * (max - min) + min;
        return decimals > 0 ? Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals) : Math.floor(value);
    }
    
    showAnimatedLoading(tabName, show) {
        const panel = document.getElementById(`panel-${tabName}`);
        if (!panel) return;
        
        if (show) {
            let overlay = panel.querySelector('.verif-loading-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'verif-loading-overlay';
                overlay.innerHTML = `
                    <div class="verif-spinner"></div>
                    <div class="verif-loading-text">Загрузка данных...</div>
                `;
                panel.style.position = 'relative';
                panel.appendChild(overlay);
            }
        } else {
            const overlay = panel.querySelector('.verif-loading-overlay');
            if (overlay) {
                overlay.remove();
            }
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
                <div class="verif-loading-dots">
                    <div class="verif-loading-dot"></div>
                    <div class="verif-loading-dot"></div>
                    <div class="verif-loading-dot"></div>
                </div>
                <div class="verif-loading-text">Загрузка данных...</div>
            `;
            panel.style.position = 'relative';
            panel.appendChild(overlay);
            
            // Анимация появления
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
    
    handleLoadingError(tabName) {
        const errorData = {
            totalCount: 0,
            totalAmount: 0,
            confirmedCount: 0,
            gisAmount: 0,
            monthlyData: { 
                labels: ['Нет данных'], 
                datasets: [{ 
                    label: 'Нет данных',
                    data: [0], 
                    backgroundColor: '#e5e7eb',
                    borderColor: '#9ca3af'
                }] 
            },
            dailyData: { 
                labels: ['Нет данных'], 
                datasets: [{ 
                    label: 'Нет данных',
                    data: [0], 
                    backgroundColor: '#e5e7eb',
                    borderColor: '#9ca3af'
                }] 
            },
            tableData: []
        };
        
        this.animatedContentUpdate(tabName, errorData);
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
                console.error(`❌ Ошибка обновления контента вкладки ${tabName}:`, error);
            }
        } else {
            console.warn(`⚠️ Обработчик для вкладки ${tabName} не найден`);
        }
    }
    
    async animatedUpdateGeneralTab(data) {
        const totalCount = this.safeNumber(data.totalCount);
        const totalAmount = this.safeNumber(data.totalAmount);
        const confirmedCount = this.safeNumber(data.confirmedCount);
        const gisAmount = this.safeNumber(data.gisAmount);
        const confirmationRate = this.safeNumber(data.confirmationRate);
        
        console.log(`📊 Обновляем общую статистику:
        - Общая сумма: ${this.formatCurrency(totalAmount)}
        - ГИС: ${this.formatCurrency(gisAmount)}
        - Количество: ${totalCount}
        - Подтверждено: ${confirmedCount}
        - Процент: ${confirmationRate}%`);
        
        // ИСПОЛЬЗУЕМ ПРАВИЛЬНЫЕ ID ИЗ HTML
        await this.animateCardsStagger([
            { id: 'total-trips-amount', value: totalAmount, format: 'currency', title: 'Общая сумма поездок' },
            { id: 'gis-amount', value: gisAmount, format: 'currency', title: 'Оплачено через ГИС' },
            { id: 'total-trips-count', value: totalCount, title: 'Количество поездок' },
            { id: 'confirmed-trips-count', value: confirmedCount, title: 'Подтвержденные поездки' },
            { id: 'confirmation-rate', value: confirmationRate, format: 'percent', title: 'Процент подтверждения' }
        ]);
        
        // Обновляем мини-графики
        await this.animatedMiniChartsUpdate([
            { id: 'summary-chart-1', data: data.amountTrend },
            { id: 'summary-chart-2', data: data.countTrend },
            { id: 'summary-chart-3', data: data.confirmedTrend },
            { id: 'summary-chart-4', data: data.rateTrend },
            { id: 'summary-chart-5', data: data.rateTrend }
        ]);
        
        await this.waitFor(400);
        
        // Создаем графики
        if (data.monthlyData) {
            await this.animatedChartCreate('general-monthly-chart', data.monthlyData, 'bar');
        }
        if (data.dailyData) {
            await this.animatedChartCreate('general-daily-chart', data.dailyData, 'line');
        }
        
        // Обновляем таблицу
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
        
        console.log(`💳 Обновляем статистику подтвержденных:
        - Подтверждено: ${confirmedCount} (${this.formatCurrency(confirmedAmount)})
        - Оплачено: ${paidCount} (${this.formatCurrency(paidAmount)})
        - Среднее время: ${avgTime}ч`);

        // ИСПОЛЬЗУЕМ ПРАВИЛЬНЫЕ ID ИЗ HTML
        await this.animateCardsStagger([
            { id: 'confirmed-count', value: confirmedCount, title: 'Количество подтвержденных' },
            { id: 'confirmed-amount', value: confirmedAmount, format: 'currency', title: 'Сумма подтвержденных' },
            { id: 'confirmed-paid-count', value: paidCount, title: 'Количество оплаченных' },
            { id: 'confirmed-paid-amount', value: paidAmount, format: 'currency', title: 'Сумма оплаченных' },
            { id: 'confirmed-avg-time', value: avgTime, format: 'hours', title: 'Среднее время подтверждения' }
        ]);
        
        await this.animatedMiniChartsUpdate([
            { id: 'confirmed-chart-1', data: data.countTrend },
            { id: 'confirmed-chart-2', data: data.amountTrend },
            { id: 'confirmed-chart-3', data: data.countTrend },
            { id: 'confirmed-chart-4', data: data.amountTrend },
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
        const correctedPercentage = vpnCount > 0 ? this.calculatePercentage(corrected, vpnCount) : 0;
        const vpnRemoved = this.safeNumber(data.vpnRemoved);
        const vpnRemovedAmount = this.safeNumber(data.vpnRemovedAmount);
        
        console.log(`🚗 Обновляем статистику ВПН:
        - ВПН: ${vpnCount} (${this.formatCurrency(totalVpn)})
        - Скорректировано: ${corrected} (${correctedPercentage.toFixed(1)}%)
        - Удалено: ${vpnRemoved} (${this.formatCurrency(vpnRemovedAmount)})`);
        
        // ИСПОЛЬЗУЕМ ПРАВИЛЬНЫЕ ID ИЗ HTML
        await this.animateCardsStagger([
            { id: 'vpn-count', value: vpnCount, title: 'Кол-во ВПН' },
            { id: 'vpn-total', value: totalVpn, format: 'currency', title: 'Сумма ВПН' },
            { id: 'vpn-corrected', value: corrected, title: 'Скорректировано ВПН' },
            { id: 'vpn-corrected-percentage', value: correctedPercentage, format: 'percent', title: 'Процент скорректированных' },
            { id: 'vpn-removed', value: vpnRemoved, title: 'Удалено ВПН' },
            { id: 'vpn-removed-amount', value: vpnRemovedAmount, format: 'currency', title: 'Сумма удаленных ВПН' }
        ]);
        
        await this.animatedMiniChartsUpdate([
            { id: 'vpn-chart-count', data: data.countTrend },
            { id: 'vpn-chart-1', data: data.amountTrend },
            { id: 'vpn-chart-2', data: data.correctedTrend },
            { id: 'vpn-chart-3', data: data.correctedTrend },
            { id: 'vpn-chart-4', data: data.removedTrend },
            { id: 'vpn-chart-5', data: data.removedAmountTrend }
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
        console.log(`🎯 Анимируем ${cards.length} карточек:`);
        cards.forEach((card, index) => {
            console.log(`${index + 1}. ${card.title}: ${this.formatCounterValue(card.value, card.format || 'number')}`);
        });
        
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const element = document.getElementById(card.id);
            
            if (element) {
                // Ищем родительскую карточку
                const cardElement = element.closest('.verif-summary-card-orange, .verif-summary-card-compact');
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
                
                // Анимируем значение
                setTimeout(() => {
                    this.animatedCounter(card.id, card.value, card.format || 'number');
                }, (i * this.config.animation.staggerDelay) + 200);
            } else {
                console.warn(`⚠️ Элемент с ID ${card.id} не найден в DOM`);
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
        
        // Анимация контейнера
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
        
        // Обновляем график
        setTimeout(() => {
            this.updateMiniChart(canvasId, trendData);
        }, 200);
    }
    
    async animatedChartCreate(canvasId, chartData, chartType) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const container = canvas.closest('.verif-chart-container');
        if (container) {
            // Подготовка к анимации
            container.style.opacity = '0';
            container.style.transform = 'scale(0.95) rotateY(5deg)';
            
            // Создаем график
            this.createChart(canvasId, chartData, chartType);
            
            // Анимация появления
            setTimeout(() => {
                container.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                container.style.opacity = '1';
                container.style.transform = 'scale(1) rotateY(0deg)';
                
                // Добавляем класс для дополнительной анимации
                container.classList.add('verif-chart-reveal');
            }, 100);
        } else {
            this.createChart(canvasId, chartData, chartType);
        }
        
        await this.waitFor(300);
    }
    
    async animatedTableUpdate(tableId, tableData, tableType) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        // Анимация исчезновения старых данных
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
        
        // Очищаем таблицу
        tbody.innerHTML = '';
        
        if (!tableData || tableData.length === 0) {
            this.showEmptyTableMessage(tbody, tableType);
            return;
        }
        
        // Создаем новые строки с анимацией
        await this.animatedTablePopulate(tbody, tableData, tableType);
        this.updateTableCounter(table, tableData.length);
    }
    
    async animatedTablePopulate(tbody, tableData, tableType) {
        // Создаем все строки сразу, но невидимыми
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
        
        // Анимируем появление строк с эффектом stagger
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const delay = i * 30; // Уменьшенная задержка для более быстрой анимации
            
            setTimeout(() => {
                row.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                row.style.opacity = '1';
                row.style.transform = 'translateX(0) scale(1)';
                
                // Добавляем небольшой bounce эффект
                setTimeout(() => {
                    row.style.transform = 'translateX(0) scale(1.01)';
                    setTimeout(() => {
                        row.style.transform = 'translateX(0) scale(1)';
                    }, 100);
                }, 200);
            }, delay);
        }
        
        // Ждем завершения всех анимаций
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
        
        // Анимируем изменения для каждой строки
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
                    
                    // Подсветка найденного текста
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
        
        // Обновляем счетчик с анимацией
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
        if (!element) {
            console.warn(`⚠️ Элемент ${elementId} не найден для анимации счетчика`);
            return Promise.resolve();
        }
        
        element.classList.add('verif-counter-animate');
        
        const startValue = 0;
        const duration = 2000;
        const startTime = performance.now();
        
        return new Promise(resolve => {
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing функция
                const easeProgress = progress < 0.5 
                    ? 4 * progress * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                
                const currentValue = Math.floor(startValue + (targetValue - startValue) * easeProgress);
                
                element.textContent = this.formatCounterValue(currentValue, format);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    element.textContent = this.formatCounterValue(targetValue, format);
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
            default:
                return this.formatNumber(value);
        }
    }
    
    // ==========================================
    // РАБОТА С ГРАФИКАМИ (с анимациями)
    // ==========================================
    
        createChart(canvasId, chartData, chartType) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas с ID ${canvasId} не найден`);
            return;
        }
        
        if (typeof Chart === 'undefined') {
            console.error('Chart.js не загружен');
            return;
        }
        
        // ИСПРАВЛЕНИЕ: Более строгая проверка данных
        if (!chartData || !chartData.labels || !chartData.datasets || 
            !Array.isArray(chartData.labels) || !Array.isArray(chartData.datasets)) {
            console.warn(`Некорректные данные для графика ${canvasId}:`, chartData);
            return;
        }
        
        // Проверяем видимость canvas
        if (canvas.offsetParent === null) {
            this.pendingCharts.set(canvasId, { data: chartData, type: chartType });
            return;
        }
        
        // Уничтожаем существующий график
        if (this.charts.has(canvasId)) {
            try {
                this.charts.get(canvasId).destroy();
            } catch (error) {
                console.warn(`Ошибка уничтожения графика ${canvasId}:`, error);
            }
            this.charts.delete(canvasId);
        }
        
        try {
            const config = this.buildAnimatedChartConfig(chartType, chartData);
            
            // ИСПРАВЛЕНИЕ: Проверяем config
            if (!config) {
                console.error(`Не удалось создать конфигурацию для графика ${canvasId}`);
                return;
            }
            
            const chart = new Chart(canvas, config);
            this.charts.set(canvasId, chart);
            this.pendingCharts.delete(canvasId);
            
            console.log(`График ${canvasId} успешно создан`);
            
        } catch (error) {
            console.error(`Ошибка создания графика ${canvasId}:`, error);
            
            // ИСПРАВЛЕНИЕ: Показываем сообщение об ошибке на canvas
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ef4444';
            ctx.font = '16px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('Ошибка загрузки графика', canvas.width / 2, canvas.height / 2);
        }
    }
    
   buildAnimatedChartConfig(chartType, chartData) {
        // ИСПРАВЛЕНИЕ: Проверяем корректность данных
        if (!chartData || !chartData.labels || !chartData.datasets) {
            console.error('Некорректные данные для графика:', chartData);
            return null;
        }

        const baseConfig = {
            type: chartType === 'mixed' ? 'bar' : chartType,
            data: this.processChartData(chartData, chartType),
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
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: { 
                                size: 12, 
                                family: 'Inter, system-ui, sans-serif', // ИСПРАВЛЕНИЕ: убрали Montserrat
                                weight: '500'
                            },
                            color: '#374151'
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: this.config.colors.primary,
                        borderWidth: 2,
                        cornerRadius: 12,
                        displayColors: true,
                        titleFont: { size: 14, weight: '600' },
                        bodyFont: { size: 13, weight: '500' },
                        padding: 12,
                        caretPadding: 8,
                        callbacks: {
                            title: (tooltipItems) => tooltipItems[0]?.label || '',
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed?.y ?? context.parsed;
                                return `${label}: ${this.formatTooltipValue(value, context.datasetIndex)}`;
                            }
                        }
                    }
                },
                // ИСПРАВЛЕНИЕ: Упрощенная анимация
                animation: {
                    duration: 1000,
                    easing: 'easeInOutCubic'
                }
            }
        };
        
        // Добавляем оси только для не-круговых графиков
        if (!['doughnut', 'pie'].includes(chartType)) {
            baseConfig.options.scales = this.buildAnimatedScalesConfig(chartType, chartData);
        }
        
        return baseConfig;
    }
    
    buildAnimatedScalesConfig(chartType, chartData) {
        const scales = {
            x: {
                grid: { 
                    display: chartType !== 'bar',
                    color: 'rgba(0, 0, 0, 0.05)',
                    borderDash: [2, 2],
                    drawBorder: false
                },
                ticks: { 
                    font: { 
                        size: 11, 
                        family: 'Montserrat',
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
                    drawBorder: false,
                    borderDash: [1, 3]
                },
                ticks: {
                    font: { 
                        size: 11, 
                        family: 'Montserrat',
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
        
        // Дополнительная ось для mixed графиков
        if (chartType === 'mixed' && chartData.datasets.some(d => d.yAxisID === 'y1')) {
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
                        family: 'Montserrat',
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
    
    processChartData(chartData, chartType) {
        const processed = JSON.parse(JSON.stringify(chartData)); // Deep clone
        
        // Обработка цветов для dataset-ов
        processed.datasets.forEach((dataset, index) => {
            if (!dataset.backgroundColor) {
                if (chartType === 'doughnut' || chartType === 'pie') {
                    dataset.backgroundColor = this.generatePaletteColors(dataset.data.length);
                } else {
                    dataset.backgroundColor = this.config.colors.background;
                }
            }
            
            if (!dataset.borderColor) {
                dataset.borderColor = this.config.colors.primary;
            }
            
            if (typeof dataset.borderWidth === 'undefined') {
                dataset.borderWidth = 2;
            }
            
            // Специальные настройки для линейных графиков
            if (chartType === 'line') {
                dataset.tension = dataset.tension ?? 0.4;
                dataset.fill = dataset.fill ?? false;
                dataset.pointBackgroundColor = dataset.pointBackgroundColor ?? this.config.colors.primary;
                dataset.pointBorderColor = dataset.pointBorderColor ?? '#fff';
                dataset.pointBorderWidth = dataset.pointBorderWidth ?? 2;
                dataset.pointRadius = dataset.pointRadius ?? 4;
                dataset.pointHoverRadius = dataset.pointHoverRadius ?? 6;
                
                // Анимированный градиент для линий
                if (dataset.fill) {
                    dataset.backgroundColor = this.createAnimatedGradient(chartType);
                }
            }
            
            // Специальные настройки для столбчатых графиков
            if (chartType === 'bar') {
                dataset.borderRadius = dataset.borderRadius ?? 6;
                dataset.borderSkipped = false;
                dataset.hoverBackgroundColor = this.adjustColorOpacity(dataset.backgroundColor, 0.8);
                dataset.hoverBorderColor = this.config.colors.secondary;
                dataset.hoverBorderWidth = 3;
            }
            
            // Специальные настройки для круговых графиков
            if (chartType === 'doughnut' || chartType === 'pie') {
                dataset.borderWidth = 3;
                dataset.hoverBorderWidth = 5;
                dataset.hoverOffset = 8;
                dataset.spacing = 2;
                dataset.cutout = chartType === 'doughnut' ? '65%' : 0;
            }
        });
        
        return processed;
    }
    
    createAnimatedGradient(chartType) {
        // Создаем динамический градиент для более красивых графиков
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        
        gradient.addColorStop(0, 'rgba(255, 107, 53, 0.3)');
        gradient.addColorStop(0.5, 'rgba(255, 107, 53, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 107, 53, 0.05)');
        
        return gradient;
    }
    
    adjustColorOpacity(color, opacity) {
        if (color.startsWith('rgba')) {
            return color.replace(/[\d\.]+\)$/g, `${opacity})`);
        } else if (color.startsWith('rgb')) {
            return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
        } else if (color.startsWith('#')) {
            const hex = color.slice(1);
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
        return color;
    }
    
    updateMiniChart(canvasId, trendData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Mini-canvas с ID ${canvasId} не найден`);
            return;
        }
        
        // Уничтожаем существующий мини-график
        if (this.miniCharts.has(canvasId)) {
            try {
                this.miniCharts.get(canvasId).destroy();
            } catch (error) {
                console.warn(`Ошибка уничтожения мини-графика ${canvasId}:`, error);
            }
            this.miniCharts.delete(canvasId);
        }
        
        const data = trendData || this.getDefaultTrendData();
        
        const config = {
            type: 'line',
            data: {
                labels: data.labels || Array.from({length: 7}, (_, i) => `${i + 1}`),
                datasets: [{
                    data: data.values || Array.from({length: 7}, () => this.randomInRange(20, 80)),
                    borderColor: this.config.colors.primary,
                    backgroundColor: this.config.colors.background,
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
                    duration: 1000, 
                    easing: 'easeInOutCubic',
                    // Анимация рисования линии
                    x: {
                        type: 'number',
                        easing: 'linear',
                        duration: 800,
                        from: NaN,
                        delay(ctx) {
                            if (ctx.type !== 'data' || ctx.xStarted) {
                                return 0;
                            }
                            ctx.xStarted = true;
                            return ctx.index * 30;
                        }
                    }
                },
                elements: {
                    point: { radius: 0 }
                }
            }
        };
        
        try {
            const miniChart = new Chart(canvas, config);
            this.miniCharts.set(canvasId, miniChart);
        } catch (error) {
            console.error(`Ошибка создания мини-графика ${canvasId}:`, error);
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
        
        // Создаем графики с небольшой задержкой для плавности
        toCreate.forEach(({ canvasId, chartInfo }, index) => {
            setTimeout(() => {
                this.createChart(canvasId, chartInfo.data, chartInfo.type);
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
                    console.warn('Ошибка изменения размера графика:', error);
                }
            }
        });
    }
    
    generatePaletteColors(count) {
        const baseColors = [
            '#ff6b35', '#ff8555', '#ffa040', '#ffb74d', 
            '#ffc107', '#ffcc80', '#ffd8a6', '#ffe0b2'
        ];
        
        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    }
    
    // ==========================================
    // РАБОТА С ТАБЛИЦАМИ (улучшенная)
    // ==========================================
    
    updateTable(tableId, tableData, tableType) {
        const table = document.getElementById(tableId);
        if (!table) {
            console.warn(`Таблица с ID ${tableId} не найдена`);
            return;
        }
        
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.warn(`Tbody в таблице ${tableId} не найден`);
            return;
        }
        
        // Очищаем таблицу
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
                    <div class="verif-empty-icon" style="
                        width: 64px; 
                        height: 64px; 
                        background: linear-gradient(135deg, #f3f4f6, #e5e7eb); 
                        border-radius: 50%; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        animation: pulse 2s infinite;
                    ">
                        <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24" style="opacity: 0.4;">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">Нет данных</div>
                        <div style="font-size: 14px; opacity: 0.7;">Данные будут отображены после их загрузки</div>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(emptyRow);
        
        // Анимация появления пустого сообщения
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
            
            // Анимация появления строк с улучшенным эффектом
            const animationDelay = Math.min(index * 30, 800);
            setTimeout(() => {
                tableRow.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                tableRow.style.opacity = '1';
                tableRow.style.transform = 'translateY(0)';
                
                // Добавляем легкий bounce эффект
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
            // Удаляем существующий счетчик
            const existingCounter = header.querySelector('.record-count');
            if (existingCounter) {
                // Анимация исчезновения старого счетчика
                existingCounter.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                existingCounter.style.opacity = '0';
                existingCounter.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    existingCounter.remove();
                }, 200);
            }
            
            // Добавляем новый счетчик с анимацией
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
                
                // Анимация появления нового счетчика
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
        const num = Number(value);
        if (isNaN(num)) return 0;
        return decimals > 0 ? Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals) : Math.floor(num);
    }
    
    safeString(value) {
        return value != null ? String(value) : '-';
    }
    
    calculatePercentage(value, total) {
        if (!total || total === 0) return 0;
        const percentage = (value / total) * 100;
        return Math.round(percentage * 10) / 10;
    }
    
    formatNumber(number) {
        const num = this.safeNumber(number);
        
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + ' млрд';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + ' млн';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + ' тыс.';
        }
        
        return new Intl.NumberFormat('ru-RU').format(num);
    }
    
    formatCurrency(number) {
        return this.formatNumber(number) + ' ₽';
    }
    
    formatPercentage(number, decimals = 1) {
        const num = this.safeNumber(number, decimals);
        return num.toFixed(decimals);
    }
    
    formatHours(number) {
        const num = this.safeNumber(number, 1);
        return num.toFixed(1) + 'ч';
    }
    
    formatAxisValue(value) {
        if (value >= 1000000) return (value / 1000000).toFixed(0) + 'M';
        if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
        return value.toString();
    }
    
    formatTooltipValue(value, datasetIndex = 0) {
        if (typeof value === 'number') {
            if (value > 1000000) {
                return this.formatCurrency(value);
            } else if (value > 100) {
                return this.formatNumber(value);
            } else {
                return value.toFixed(1);
            }
        }
        return String(value);
    }
    
    getCurrentTimestamp() {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }
    
    getDefaultTrendData() {
        return {
            labels: Array.from({length: 7}, (_, i) => `День ${i + 1}`),
            values: Array.from({length: 7}, () => this.randomInRange(20, 80))
        };
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
    // УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ
    // ==========================================
    
    cleanup() {
        console.log('Очистка дашборда верификации...');
        
        // Очистка интервалов
        if (this.timeDisplayInterval) {
            clearInterval(this.timeDisplayInterval);
            this.timeDisplayInterval = null;
        }
        
        // Уничтожение всех графиков с анимацией
        const allCharts = [...this.charts.values(), ...this.miniCharts.values()];
        allCharts.forEach(chart => {
            try {
                if (chart && typeof chart.destroy === 'function') {
                    // Анимация исчезновения
                    const canvas = chart.canvas;
                    if (canvas) {
                        canvas.style.transition = 'all 0.3s ease-out';
                        canvas.style.opacity = '0';
                        canvas.style.transform = 'scale(0.9)';
                        
                        setTimeout(() => {
                            chart.destroy();
                        }, 300);
                    } else {
                        chart.destroy();
                    }
                }
            } catch (error) {
                console.warn('Ошибка уничтожения графика:', error);
            }
        });
        
        // Очистка коллекций
        this.charts.clear();
        this.miniCharts.clear();
        this.pendingCharts.clear();
        this.data.clear();
        
        // Удаление обработчиков событий
        this.removeEventListeners();
        
        // Удаление стилей
        const customStyles = document.getElementById('verif-table-styles');
        if (customStyles) {
            customStyles.remove();
        }
        
        const animationStyles = document.getElementById('verif-animation-styles');
        if (animationStyles) {
            animationStyles.remove();
        }
        
        console.log('Дашборд верификации очищен');
    }
    
    removeEventListeners() {
        // Удаляем слушатели событий для предотвращения утечек памяти
        const elements = [
            ...document.querySelectorAll('.verif-nav-tab'),
            ...document.querySelectorAll('.verif-period-btn'),
            ...document.querySelectorAll('.verif-table-search'),
            document.getElementById('verif-apply-custom')
        ].filter(Boolean);
        
        elements.forEach(element => {
            // Клонируем элемент для удаления всех слушателей
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
        });
    }
    
    // ==========================================
    // МЕТОДЫ ДЛЯ ОТЛАДКИ И ДИАГНОСТИКИ
    // ==========================================
    
    getDebugInfo() {
        return {
            currentTab: this.currentTab,
            currentPeriod: this.currentPeriod,
            isLoading: this.isLoading,
            chartsCount: this.charts.size,
            miniChartsCount: this.miniCharts.size,
            pendingChartsCount: this.pendingCharts.size,
            dataKeys: Array.from(this.data.keys()),
            timestamp: this.timestamp,
            user: this.user,
            animationQueue: this.animationQueue.length
        };
    }
    
    exportData(tabName = null) {
        const dataToExport = tabName ? 
            { [tabName]: this.data.get(tabName) } : 
            Object.fromEntries(this.data);
            
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
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
    
    refreshData(force = false) {
        if (this.isLoading && !force) {
            return;
        }
        
        this.loadTabData(this.currentTab);
    }
    
    // ==========================================
    // ПУБЛИЧНЫЙ API ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ
    // ==========================================
    
    switchToTab(tabName) {
        if (['general', 'confirmed', 'vpn'].includes(tabName)) {
            this.animatedTabSwitch(tabName);
        } else {
            console.warn(`Неизвестная вкладка: ${tabName}`);
        }
    }
    
    setPeriod(period) {
        if (['7', '30', '90', 'custom'].includes(period)) {
            this.animatedPeriodChange(period);
        } else {
            console.warn(`Неизвестный период: ${period}`);
        }
    }
    
    getCurrentData() {
        return this.data.get(this.currentTab);
    }
    
    refreshCharts() {
        this.resizeAllCharts();
        this.createPendingCharts();
    }
    
    getStats() {
        const currentData = this.getCurrentData();
        if (!currentData) return null;
        
        return {
            tab: this.currentTab,
            period: this.currentPeriod,
            totalRecords: currentData.tableData?.length || 0,
            lastUpdate: this.timestamp,
            chartsActive: this.charts.size,
            miniChartsActive: this.miniCharts.size
        };
    }
}

// ==========================================
// ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКА
// ==========================================

// Настройка Chart.js при загрузке
if (typeof Chart !== 'undefined') {
    // Глобальные настройки Chart.js
    Chart.defaults.font.family = "'Montserrat', system-ui, -apple-system, sans-serif";
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
    
    // Настройки для элементов
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
    
    console.log('Chart.js настроен для дашборда верификации');
} else {
    console.warn('Chart.js не загружен. Графики не будут работать.');
}

// Глобальная переменная для доступа к дашборду
let verificationDashboard = null;

// Функция инициализации
function initializeVerificationDashboard() {
    try {
        if (verificationDashboard) {
            console.log('Дашборд уже инициализирован, выполняем очистку...');
            verificationDashboard.cleanup();
        }
        
        verificationDashboard = new VerificationDashboard();
        
        // Добавляем в глобальную область видимости для отладки
        window.verificationDashboard = verificationDashboard;
        
        console.log('Дашборд верификации успешно инициализирован');
        
        // Добавляем горячие клавиши для разработки
        if (process?.env?.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey) {
                    switch (e.key) {
                        case 'D':
                            e.preventDefault();
                            console.log('Debug Info:', verificationDashboard.getDebugInfo());
                            break;
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
            console.log('Горячие клавиши для разработки активированы');
        }
        
    } catch (error) {
        console.error('Критическая ошибка инициализации дашборда:', error);
    }
}

// Проверка готовности DOM
function waitForDOMReady() {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            resolve();
        }
    });
}

// Проверка загрузки Chart.js
function waitForChartJS() {
    return new Promise((resolve) => {
        if (typeof Chart !== 'undefined') {
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (typeof Chart !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            // Таймаут на случай, если Chart.js не загрузится
            setTimeout(() => {
                clearInterval(checkInterval);
                console.warn('Chart.js не был загружен в течение 10 секунд');
                resolve();
            }, 10000);
        }
    });
}

// Основная функция запуска
async function startVerificationDashboard() {
    try {
        console.log('Запуск дашборда верификации...');
        
        // Ждем готовности DOM
        await waitForDOMReady();
        console.log('DOM готов');
        
        // Ждем загрузки Chart.js
        await waitForChartJS();
        console.log('Chart.js загружен');
        
        // Небольшая задержка для полной загрузки страницы
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Инициализируем дашборд
        initializeVerificationDashboard();
        
    } catch (error) {
        console.error('Ошибка запуска дашборда:', error);
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

console.log('Модуль дашборда верификации загружен с улучшенными анимациями');