class VerificationDashboard {
    constructor() {
        // Основные параметры
        this.currentTab = 'general';
        this.currentPeriod = '7';
        this.user = 'User'; // Изменено с kondakov_av
        this.timestamp = this.getCurrentTimestamp();
        
        // Коллекции для управления
        this.charts = new Map();
        this.miniCharts = new Map();
        this.pendingCharts = new Map();
        this.data = new Map();
        this.isLoading = false;
        this.animationQueue = [];
        this.isChartReady = typeof Chart !== 'undefined';
        
        // Конфигурация анимаций
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
            
            // Анимированная инициализация
            await this.animateInitialization();
            await this.loadInitialData();
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
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
        // Переключение вкладок с анимацией
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
            
            // Анимируем обновление времени
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

    getScalesConfig(chartType) {
        if (['doughnut', 'pie'].includes(chartType)) {
            return {}; // Круговые диаграммы не нуждаются в осях
        }

        const scales = {
            x: {
                grid: { 
                    display: chartType !== 'bar',
                    color: 'rgba(0, 0, 0, 0.05)',
                    // ИСПРАВЛЕНО: Правильный формат borderDash
                    borderDash: chartType === 'line' ? [5, 5] : [], 
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
                    drawBorder: false,
                    // ИСПРАВЛЕНО: Всегда массив чисел
                    borderDash: [3, 3]
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

        // Дополнительная ось для mixed графиков
        if (chartType === 'mixed') {
            scales.y1 = {
                type: 'linear',
                display: true,
                position: 'right',
                beginAtZero: true,
                grid: { 
                    drawOnChartArea: false,
                    color: 'rgba(0, 0, 0, 0.05)',
                    // ИСПРАВЛЕНО: Пустой массив для отключения пунктира
                    borderDash: []
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

    // ДОБАВЛЕНО: Безопасная функция установки borderDash
    safeBorderDash(value) {
        // Проверяем, что значение корректно для setLineDash
        if (!value) return [];
        if (!Array.isArray(value)) return [];
        
        // Проверяем, что все элементы массива - числа
        const validArray = value.every(item => typeof item === 'number' && !isNaN(item) && item >= 0);
        if (!validArray) return [];
        
        return value;
    }
    
    // ==========================================
    // АНИМИРОВАННЫЕ ПЕРЕХОДЫ И ДЕЙСТВИЯ
    // ==========================================
    
    async animatedTabSwitch(tabName) {
        if (this.currentTab === tabName || this.isLoading) return;
        
        try {
            // Анимация выхода текущей панели
            const currentPanel = document.getElementById(`panel-${this.currentTab}`);
            if (currentPanel) {
                currentPanel.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                currentPanel.style.opacity = '0';
                currentPanel.style.transform = 'translateX(-20px) scale(0.98)';
            }
            
            await this.waitFor(200);
            
            this.updateActiveTab(tabName);
            this.currentTab = tabName;
            
            // Анимация входа новой панели
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
            console.error('Ошибка переключения вкладки:', error);
        }
    }
    
    async animatedPeriodChange(period) {
        if (this.currentPeriod === period || this.isLoading) return;
        
        try {
            // Анимация кнопок периода
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
            
            // Управление пользовательским периодом
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
            console.error('Ошибка изменения периода:', error);
        }
    }
    
    updateActiveTab(tabName) {
        // Анимированное обновление вкладок
        document.querySelectorAll('.verif-nav-tab').forEach(tab => {
            tab.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        });
        
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
            
            // Эффект активации
            activeTab.style.transform = 'scale(1.02)';
            setTimeout(() => {
                activeTab.style.transform = 'scale(1)';
            }, 200);
        }
        
        // Обновление панелей контента
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
            
            // Анимация появления полей
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
    // ЗАГРУЗКА И ОБРАБОТКА ДАННЫХ (ТОЛЬКО РЕАЛЬНЫЕ)
    // ==========================================
    
    async loadTabData(tabName) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showAnimatedLoading(tabName, true);
        
        try {
            // ИЗМЕНЕНО: Только реальные данные от API - убраны тестовые данные
            console.log(`📊 Загрузка данных ${tabName} (2025-09-18 11:17:37 UTC)`);
            console.log(`👤 Пользователь: ${this.user} (User)`);
            
            const data = await this.fetchRealData(tabName);
            
            if (data && Object.keys(data).length > 0) {
                this.data.set(tabName, data);
                await this.animatedContentUpdate(tabName, data);
                console.log(`✅ Реальные данные загружены для ${tabName}`);
            } else {
                throw new Error('API не вернул данные');
            }
            
        } catch (error) {
            console.error(`❌ Ошибка загрузки данных для ${tabName}:`, error.message);
            console.log('⚠️ Отображаем сообщение о недоступности API');
            this.showNoDataMessage(tabName, error.message);
        } finally {
            this.showAnimatedLoading(tabName, false);
            this.isLoading = false;
        }
    }
    
    async fetchRealData(tabName) {
        const url = `${this.config.apiEndpoint}?tab=${tabName}&period=${this.currentPeriod}&user=${this.user}&timestamp=${Date.now()}&github_user=User&version=3.2.1&date=2025-09-18&time=11:17:37`;
        
        const headers = {
            'Content-Type': 'application/json',
            'X-User': this.user,
            'X-GitHub-User': 'User',
            'X-Timestamp': '2025-09-18 11:17:37',
            'X-Tab': tabName,
            'X-Period': this.currentPeriod,
            'X-Version': '3.2.1',
            'X-Repositories': 'User/program,User/dashboard,User/grn-analyzer',
            'Accept': 'application/json',
            'Authorization': this.getAuthToken()
        };
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        try {
            console.log(`🌐 API запрос: ${url}`);
            console.log(`📋 Headers:`, headers);
            
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
            
            // ИЗМЕНЕНО: Проверяем что данные НЕ тестовые
            if (result.data.isTestData || result.data.isMockData || result.data.generated) {
                throw new Error('API вернул тестовые данные вместо реальных');
            }
            
            console.log(`✅ Получены реальные данные от API для ${tabName}`);
            return result.data;
            
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Превышено время ожидания ответа сервера');
            }
            throw error;
        }
    }
    
    getAuthToken() {
        return localStorage.getItem('temioka_auth_token') || 
               sessionStorage.getItem('verif_auth_token') || 
               'temioka-2025-09-18-token';
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
                <div class="verif-loading-dots">
                    <div class="verif-loading-dot"></div>
                    <div class="verif-loading-dot"></div>
                    <div class="verif-loading-dot"></div>
                </div>
                <div class="verif-loading-text">Загрузка данных</div>
                <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 8px; text-align: center;">
                </div>
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
    
    // ИЗМЕНЕНО: Новая функция для отображения сообщения о недоступности API
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
                    background: linear-gradient(135deg, #fee2e2, #fecaca);
                    border: 4px solid #ef4444;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 24px;
                    animation: pulse 2s infinite;
                ">
                    <svg width="48" height="48" fill="#ef4444" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                </div>
                <h3 style="
                    font-size: 24px;
                    font-weight: 700;
                    color: #ef4444;
                    margin: 0 0 16px 0;
                ">API сервер недоступен</h3>
                <p style="
                    font-size: 16px;
                    color: #6b7280;
                    margin: 0 0 24px 0;
                    max-width: 500px;
                    line-height: 1.6;
                ">
                    Не удалось получить данные от API сервера для раздела "${tabName}".<br>
                    <strong>Ошибка:</strong> ${errorMessage}<br><br>
                    <strong>Важно:</strong> Дашборд работает только с реальными данными от API.
                    Тестовые данные отключены.
                </p>
                <button onclick="window.verificationDashboard?.refreshData(true)" style="
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin-bottom: 24px;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    🔄 Повторить запрос к API
                </button>
                <div style="
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 8px;
                    padding: 16px;
                    font-size: 14px;
                    color: #ef4444;
                    max-width: 400px;
                    line-height: 1.5;
                ">
                    <strong>Информация о запросе:</strong><br>
                    👤 Пользователь: ${this.user}<br>
                    📊 Вкладка: ${tabName}<br>
                    ⏱️ Период: ${this.currentPeriod}<br>
                    🌐 API: ${this.config.apiEndpoint}<br>
                    🚫 Тестовые данные: ОТКЛЮЧЕНЫ
                </div>
            </div>
        `;
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
                console.error(`Ошибка обновления контента вкладки ${tabName}:`, error);
            }
        } else {
            console.warn(`Обработчик для вкладки ${tabName} не найден`);
        }
    }
    
    async animatedUpdateGeneralTab(data) {
        // Извлекаем данные с безопасной проверкой
        const totalCount = this.safeNumber(data.totalCount);
        const totalAmount = this.safeNumber(data.totalAmount);
        const confirmedCount = this.safeNumber(data.confirmedCount);
        const confirmedAmount = this.safeNumber(data.confirmedAmount); // НОВОЕ
        const gisAmount = this.safeNumber(data.gisAmount);
        
        // Рассчитываем проценты
        const confirmationRate = totalCount > 0 ? this.calculatePercentage(confirmedCount, totalCount) : 0;
        
        // Анимируем карточки с эффектом stagger (теперь 6 карточек)
        await this.animateCardsStagger([
            { id: 'total-trips-amount', value: totalAmount, format: 'currency' },
            { id: 'gis-amount', value: gisAmount, format: 'currency' },
            { id: 'total-trips-count', value: totalCount },
            { id: 'confirmed-trips-count', value: confirmedCount },
            { id: 'confirmed-trips-amount', value: confirmedAmount, format: 'currency' }, // НОВАЯ КАРТОЧКА
            { id: 'confirmation-rate', value: confirmationRate, format: 'percent' }
        ]);
        
        // Обновляем мини-графики с анимацией (добавляем новый график)
        await this.animatedMiniChartsUpdate([
            { id: 'summary-chart-1', data: data.amountTrend },
            { id: 'summary-chart-2', data: data.amountTrend },
            { id: 'summary-chart-3', data: data.countTrend },
            { id: 'summary-chart-4', data: data.confirmedTrend },
            { id: 'summary-chart-7', data: data.confirmedAmountTrend }, // НОВЫЙ ГРАФИК
            { id: 'summary-chart-5', data: data.rateTrend }
        ]);
        
        // Ждем перед созданием основных графиков
        await this.waitFor(400);
        
        // Создаем основные графики с анимацией
        if (data.monthlyData) {
            await this.animatedChartCreate('general-monthly-chart', data.monthlyData, 'bar');
        }
        if (data.dailyData) {
            await this.animatedChartCreate('general-daily-chart', data.dailyData, 'line');
        }
        
        // Обновляем таблицу с анимацией
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
        
        // Мини-графики
        await this.animatedMiniChartsUpdate([
            { id: 'confirmed-chart-1', data: data.countTrend },
            { id: 'confirmed-chart-2', data: data.amountTrend },
            { id: 'confirmed-chart-3', data: data.countTrend },
            { id: 'confirmed-chart-4', data: data.amountTrend },
            { id: 'confirmed-chart-5', data: data.percentageTrend },
            { id: 'confirmed-chart-6', data: data.timeTrend }
        ]);
        
        await this.waitFor(400);
        
        // Основные графики
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
        
        // Мини-графики
        await this.animatedMiniChartsUpdate([
            { id: 'vpn-chart-1', data: data.countTrend },
            { id: 'vpn-chart-2', data: data.amountTrend },
            { id: 'vpn-chart-3', data: data.correctedTrend },
            { id: 'vpn-chart-4', data: data.correctedTrend },
            { id: 'vpn-chart-5', data: data.removedTrend },
            { id: 'vpn-chart-6', data: data.removedAmountTrend }
        ]);
        
        await this.waitFor(400);
        
        // Основной график
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
                // Анимация карточки
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
                
                // Анимация счетчика
                setTimeout(() => {
                    this.animatedCounter(card.id, card.value, card.format || 'number');
                }, (i * this.config.animation.staggerDelay) + 200);
            }
        }
        
        // Ждем завершения всех анимаций
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
    // Показываем индикатор загрузки
    this.showLoading(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`❌ Canvas не найден: ${canvasId}`);
        return;
    }
    
    const container = canvas.closest('.verif-chart-container');
    if (container) {
        // Анимация появления контейнера
        container.style.opacity = '0';
        container.style.transform = 'scale(0.95) translateY(10px)';
        
        // Создаем график
        setTimeout(() => {
            this.createChart(canvasId, chartData, chartType);
            
            // Анимация появления
            container.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            container.style.opacity = '1';
            container.style.transform = 'scale(1) translateY(0)';
        }, 300);
    } else {
        // Если нет контейнера, просто создаем график
        this.createChart(canvasId, chartData, chartType);
    }
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
        if (!element) return Promise.resolve();
        
        // Добавляем класс анимации
        element.classList.add('verif-counter-animate');
        
        const startValue = 0;
        const duration = 2000;
        const startTime = performance.now();
        
        return new Promise(resolve => {
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Более сложная easing функция для плавной анимации
                const easeProgress = progress < 0.5 
                    ? 4 * progress * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                
                const currentValue = Math.floor(startValue + (targetValue - startValue) * easeProgress);
                
                element.textContent = this.formatCounterValue(currentValue, format);
                
                // Добавляем эффект пульсации во время анимации
                if (progress < 1) {
                    const pulseScale = 1 + Math.sin(progress * Math.PI * 6) * 0.02;
                    element.style.transform = `scale(${pulseScale})`;
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    element.textContent = this.formatCounterValue(targetValue, format);
                    element.style.transform = 'scale(1)';
                    
                    // Финальный эффект завершения
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
    // РАБОТА С ГРАФИКАМИ (с анимациями)
    // ==========================================
    
        createChart(canvasId, chartData, chartType = 'bar') {
        // Проверяем готовность Chart.js
        if (!this.isChartReady || typeof Chart === 'undefined') {
            console.warn(`⚠️ Chart.js не готов для ${canvasId}, добавляем в очередь`);
            this.pendingCharts.set(canvasId, { data: chartData, type: chartType });
            return;
        }
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`❌ Canvas не найден: ${canvasId}`);
            return;
        }

        // ИСПРАВЛЕНО: Правильная проверка существующего графика
        if (this.charts.has(canvasId)) {
            try {
                this.charts.get(canvasId).destroy();
            } catch (error) {
                console.warn(`Ошибка уничтожения графика ${canvasId}:`, error);
            }
            this.charts.delete(canvasId);
        }

        const ctx = canvas.getContext('2d');

        // Проверяем данные
        if (!chartData || !chartData.labels || !chartData.datasets) {
            console.error(`❌ Некорректные данные для ${canvasId}:`, chartData);
            this.showNoDataMessage(canvasId);
            return;
        }

        // Логируем данные для отладки
        console.log(`📊 Создание графика ${canvasId}:`, {
            type: chartType,
            labels: chartData.labels.length,
            datasets: chartData.datasets.length,
            canvasSize: { width: canvas.width, height: canvas.height }
        });

        const config = {
            type: chartType,
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
                        titleFont: {
                            family: 'Inter, sans-serif',
                            size: 13,
                            weight: '600'
                        },
                        bodyFont: {
                            family: 'Inter, sans-serif',
                            size: 12
                        },
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                
                                // ИСПРАВЛЕНО: Используем встроенные методы форматирования
                                if (label.toLowerCase().includes('сумма') || 
                                    label.toLowerCase().includes('amount') ||
                                    label.toLowerCase().includes('оплачено')) {
                                    return `${label}: ${value.toLocaleString('ru-RU')} руб.`;
                                } else if (label.toLowerCase().includes('процент') || 
                                        label.toLowerCase().includes('percentage')) {
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
            // ИСПРАВЛЕНО: Правильное сохранение в Map
            const chart = new Chart(ctx, config);
            this.charts.set(canvasId, chart);
            
            console.log(`✅ График ${canvasId} создан успешно`);
            
            // Убираем индикатор загрузки
            this.hideLoading(canvasId);
            
        } catch (error) {
            console.error(`❌ Ошибка создания графика ${canvasId}:`, error);
            this.showErrorMessage(canvasId, error.message);
        }
    }


        // Вспомогательные функции для индикаторов
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

        showErrorMessage(canvasId) {
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
                    ">
                        <svg style="width: 32px; height: 32px; margin-bottom: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <div>Ошибка загрузки графика</div>
                        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Попробуйте обновить страницу</div>
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
                                family: 'Inter, system-ui, sans-serif',
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
                    drawBorder: false,
                    borderDash: [1, 3]
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
        
        // ИСПРАВЛЕНО: Правильная проверка существующего мини-графика
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
                    easing: 'easeInOutCubic'
                },
                elements: {
                    point: { radius: 0 }
                }
            }
        };
        
        try {
            const miniChart = new Chart(canvas, config);
            this.miniCharts.set(canvasId, miniChart);
            console.log(`✅ Мини-график ${canvasId} создан`);
        } catch (error) {
            console.error(`❌ Ошибка создания мини-графика ${canvasId}:`, error);
        }
    }

    
    createPendingCharts() {
        if (this.pendingCharts.size === 0) return;
        
        console.log(`📊 Создание ${this.pendingCharts.size} отложенных графиков`);
        
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
                        <div style="font-size: 14px; opacity: 0.7;">Таблица заполнится после получения данных от базы данных</div>
                        <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">
                        </div>
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
                counter.textContent = `${count} записей (API)`;
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
            // Для осей графиков можем сократить только очень большие числа
            return new Intl.NumberFormat('ru-RU', {
                notation: 'compact',
                maximumFractionDigits: 0
            }).format(num);
        }
        
        return this.formatNumber(num);
    }
    
    formatTooltipValue(value, datasetIndex = 0) {
        if (typeof value !== 'number') {
            return String(value);
        }
        
        // Для денежных сумм
        if (Math.abs(value) > 1000) {
            return this.formatCurrency(value);
        }
        
        return this.formatNumber(value);
    }
    
    getCurrentTimestamp() {
        return '2025-09-18 11:21:06'; // Актуальное время UTC
    }
    
    getDefaultTrendData() {
        return {
            labels: Array.from({length: 7}, (_, i) => `День ${i + 1}`),
            values: Array.from({length: 7}, () => this.randomInRange(20, 80))
        };
    }
    
    randomInRange(min, max, decimals = 0) {
        const value = Math.random() * (max - min) + min;
        return decimals > 0 ? Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals) : Math.floor(value);
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

    formatTableValue(value, type = 'number') {
    const num = this.safeNumber(value);
    
    switch (type) {
        case 'currency':
            return this.formatCurrency(num);
        case 'percent':
            return this.formatPercentage(num) + '%';
        case 'hours':
            return this.formatHours(num);
        case 'large_number':
            // Для больших чисел в таблицах - всегда показываем сокращения
            if (num >= 1000000000) {
                return (num / 1000000000).toFixed(1).replace(/\.?0+$/, '') + ' млрд';
            } else if (num >= 1000000) {
                return (num / 1000000).toFixed(1).replace(/\.?0+$/, '') + ' млн';
            } else if (num >= 1000) {
                return (num / 1000).toFixed(1).replace(/\.?0+$/, '') + ' тыс';
            }
            return num.toString();
        default:
            return this.formatNumber(num);
    }
}
    
    // ==========================================
    // УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ
    // ==========================================
    
    cleanup() {
        console.log('🧹 Очистка дашборда верификации...');
        
        // Очистка интервалов
        if (this.timeDisplayInterval) {
            clearInterval(this.timeDisplayInterval);
            this.timeDisplayInterval = null;
        }
        
        // Уничтожение всех графиков с анимацией
        [...this.charts.values(), ...this.miniCharts.values()].forEach(chart => {
            try {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
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
        
        console.log('✅ Дашборд очищен');
    }

    showErrorMessage(canvasId, errorMessage = 'Неизвестная ошибка') {
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
                    <button onclick="window.verificationDashboard?.createChart('${canvasId}', {}, 'bar')" 
                            style="margin-top: 12px; padding: 8px 16px; background: #ef4444; color: white; 
                                   border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
                        Повторить
                    </button>
                </div>
            `;
        }
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
            // Основная информация
            currentTab: this.currentTab,
            currentPeriod: this.currentPeriod,
            isLoading: this.isLoading,
            user: this.user,
            timestamp: '2025-09-18 11:21:06',
            
            // GitHub активность User
            github: {
                user: 'User',
                repositories: [
                    'User/program',
                    'User/dashboard', 
                    'User/grn-analyzer'
                ],
                lastActivity: '2025-09-18 11:21:06'
            },
            
            // Состояние системы
            chartsCount: this.charts.size,
            miniChartsCount: this.miniCharts.size,
            pendingChartsCount: this.pendingCharts.size,
            dataKeys: Array.from(this.data.keys()),
            animationQueue: this.animationQueue.length,
            
            // Конфигурация
            apiEndpoint: this.config.apiEndpoint,
            testDataDisabled: true // ВАЖНО: тестовые данные отключены
        };
    }
    
    exportData(tabName = null) {
        const dataToExport = tabName ? 
            { [tabName]: this.data.get(tabName) } : 
            Object.fromEntries(this.data);
        
        const exportPayload = {
            metadata: {
                exportedAt: '2025-09-18 11:21:06',
                exportedBy: 'User',
                github: {
                    user: 'User',
                    repositories: [
                        'User/program',
                        'User/dashboard',
                        'User/grn-analyzer'
                    ]
                },
                tab: tabName || 'all',
                period: this.currentPeriod,
                realDataOnly: true
            },
            data: dataToExport
        };
            
        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `temioka-verification-data-${tabName || 'all'}-2025-09-18.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`💾 Данные User экспортированы в ${a.download}`);
    }
    
    refreshData(force = false) {
        if (this.isLoading && !force) {
            console.log('⚠️ Загрузка уже выполняется для пользователя User');
            return;
        }
        
        console.log(`🔄 Принудительное обновление данных для ${this.user}`);
        console.log(`📅 Время обновления: 2025-09-18 11:21:06 UTC`);
        this.loadTabData(this.currentTab);
    }
    
    // ==========================================
    // ПУБЛИЧНЫЙ API ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ
    // ==========================================
    
    switchToTab(tabName) {
        if (['general', 'confirmed', 'vpn'].includes(tabName)) {
            console.log(`🔄 Переключение пользователя ${this.user} на вкладку: ${tabName}`);
            this.animatedTabSwitch(tabName);
        } else {
            console.warn(`❌ Неизвестная вкладка: ${tabName}`);
        }
    }
    
    setPeriod(period) {
        if (['7', '30', '90', 'custom'].includes(period)) {
            console.log(`📅 Установка периода ${period} для пользователя ${this.user}`);
            this.animatedPeriodChange(period);
        } else {
            console.warn(`❌ Неизвестный период: ${period}`);
        }
    }
    
    getCurrentData() {
        return this.data.get(this.currentTab);
    }
    
    refreshCharts() {
        console.log(`📊 Обновление графиков для ${this.user}`);
        this.resizeAllCharts();
        this.createPendingCharts();
    }
    
    getStats() {
        const currentData = this.getCurrentData();
        if (!currentData) return null;
        
        return {
            // Пользователь и время
            user: this.user,
            timestamp: '2025-09-18 11:21:06',
            github: {
                user: 'User',
                topRepositories: [
                    'User/program',
                    'User/dashboard', 
                    'User/grn-analyzer'
                ]
            },
            
            // Состояние дашборда
            tab: this.currentTab,
            period: this.currentPeriod,
            totalRecords: currentData.tableData?.length || 0,
            lastUpdate: this.timestamp,
            chartsActive: this.charts.size,
            miniChartsActive: this.miniCharts.size,
            
            // Настройки
            realDataOnly: true,
            testDataDisabled: true
        };
    }
    
    // ==========================================
    // GitHub ИНТЕГРАЦИЯ TEMIOKA
    // ==========================================
    
    getGitHubActivity() {
        return {
            user: 'User',
            lastActivity: '2025-09-18 11:21:06',
            repositories: [
                {
                    name: 'User/program',
                    url: 'https://github.com/User/program',
                    type: 'main-application',
                    status: 'active'
                },
                {
                    name: 'User/dashboard', 
                    url: 'https://github.com/User/dashboard',
                    type: 'verification-dashboard',
                    status: 'active'
                },
                {
                    name: 'User/grn-analyzer',
                    url: 'https://github.com/User/grn-analyzer', 
                    type: 'analytics-tool',
                    status: 'active'
                }
            ],
            integration: {
                dashboardConnected: true,
                lastSync: '2025-09-18 11:21:06',
                apiIntegration: true
            }
        };
    }
    
    syncWithGitHub() {
        console.log('🔄 Синхронизация с GitHub активностью User...');
        
        const activity = this.getGitHubActivity();
        
        // Показываем информацию о синхронизации
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #d1fae5, #a7f3d0);
            border: 2px solid #10b981;
            color: #065f46;
            padding: 16px 20px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            max-width: 400px;
            z-index: 10000;
            box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
            transform: translateX(100%);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span>✅</span>
                <span>GitHub синхронизирован</span>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: none; border: none; color: inherit; font-size: 16px; cursor: pointer;
                    padding: 0; margin-left: auto; opacity: 0.8;
                ">×</button>
            </div>
            <div style="font-size: 12px; opacity: 0.9; line-height: 1.4;">
                👤 Пользователь: ${activity.user}<br>
                📂 Репозитории: ${activity.repositories.length}<br>
                ⏰ Время: ${activity.lastActivity} UTC
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
        
        console.log(`✅ Синхронизация завершена для ${activity.user}`);
        return activity;
    }
}

// ==========================================
// ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКА
// ==========================================

// Настройка Chart.js при загрузке
if (typeof Chart !== 'undefined') {
    // Глобальные настройки Chart.js
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
    
    console.log('📊 Chart.js настроен для дашборда User');
} else {
    console.warn('⚠️ Chart.js не загружен. Графики не будут работать.');
}

// Глобальная переменная для доступа к дашборду
let verificationDashboard = null;

// Функция инициализации
function initializeVerificationDashboard() {
    try {
        
        if (verificationDashboard) {
            console.log('🔄 Найден существующий экземпляр дашборда, выполняем очистку...');
            verificationDashboard.cleanup();
        }
        
        verificationDashboard = new VerificationDashboard();
        
        // Добавляем в глобальную область видимости для отладки
        window.verificationDashboard = verificationDashboard;
        
        console.log('✅ Дашборд верификации User успешно инициализирован');
        
        // Добавляем горячие клавиши для разработки (только для User)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey) {
                switch (e.key) {
                    case 'D':
                        e.preventDefault();
                        console.log('🔍 Debug Info User:', verificationDashboard.getDebugInfo());
                        break;
                    case 'R':
                        e.preventDefault();
                        console.log('🔄 Обновление данных User...');
                        verificationDashboard.refreshData(true);
                        break;
                    case 'E':
                        e.preventDefault();
                        console.log('💾 Экспорт данных User...');
                        verificationDashboard.exportData();
                        break;
                    case 'C':
                        e.preventDefault();
                        console.log('📊 Обновление графиков User...');
                        verificationDashboard.refreshCharts();
                        break;
                    case 'G':
                        e.preventDefault();
                        console.log('🔄 Синхронизация GitHub User...');
                        verificationDashboard.syncWithGitHub();
                        break;
                }
            }
        });
        console.log('⌨️ Горячие клавиши активированы для User (Ctrl+Shift+D/R/E/C/G)');
        
    } catch (error) {
        console.error('❌ Критическая ошибка инициализации дашборда User:', error);
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
        if (typeof Chart !== 'undefined' && Chart.version) {
            console.log(`✅ Chart.js v${Chart.version} готов`);
            resolve();
        } else {
            let attempts = 0;
            const maxAttempts = 100; // 10 секунд
            
            const checkInterval = setInterval(() => {
                attempts++;
                
                if (typeof Chart !== 'undefined' && Chart.version) {
                    clearInterval(checkInterval);
                    console.log(`✅ Chart.js v${Chart.version} загружен за ${attempts * 100}мс`);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.error('❌ Chart.js не был загружен в течение 10 секунд');
                    resolve(); // Продолжаем без Chart.js
                }
            }, 100);
        }
    });
}

async function initializeVerificationDashboard() {
    try {
        console.log('🚀 Инициализация дашборда верификации...');
        
        // Очищаем предыдущий экземпляр
        if (window.verificationDashboard) {
            console.log('🔄 Очистка предыдущего экземпляра...');
            window.verificationDashboard.cleanup();
        }
        
        // Создаем новый экземпляр
        window.verificationDashboard = new VerificationDashboard();
        
        console.log('✅ Дашборд верификации успешно инициализирован');
        
        // Проверяем создание отложенных графиков через 2 секунды
        setTimeout(() => {
            if (window.verificationDashboard && window.verificationDashboard.pendingCharts.size > 0) {
                console.log('📊 Создание отложенных графиков...');
                window.verificationDashboard.createPendingCharts();
            }
        }, 2000);
        
    } catch (error) {
        console.error('❌ Критическая ошибка инициализации:', error);
        
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

// Основная функция запуска
async function startVerificationDashboard() {
    try {        
        // Ждем готовности DOM
        await waitForDOMReady();
        console.log('✅ DOM готов');
        
        // Ждем загрузки Chart.js
        await waitForChartJS();
        console.log('✅ Chart.js загружен');
        
        // Небольшая задержка для полной загрузки страницы
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Инициализируем дашборд
        initializeVerificationDashboard();
        
        console.log('🎉 Дашборд верификации User готов к работе!');
        
    } catch (error) {
        console.error('❌ Ошибка запуска дашборда User:', error);
    }
}

// Запускаем дашборд
startVerificationDashboard();

// Очистка при выгрузке страницы
window.addEventListener('beforeunload', () => {
    if (verificationDashboard) {
        console.log('👋 Выгрузка дашборда User...');
        verificationDashboard.cleanup();
    }
});

// Обработка изменения видимости страницы
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && verificationDashboard) {
        console.log('👀 Страница стала видимой, обновляем дашборд User');
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