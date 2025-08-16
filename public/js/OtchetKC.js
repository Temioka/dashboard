const ReportModule = (function() {
    'use strict';
    
    // Константы для типов уведомлений
    const NOTIFICATION_TYPES = {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info'
    };
    
    // Глобальные переменные для хранения состояния
        const state = {
        reportType: 'call',
        dataType: 'summary',
        periodType: 'custom',
        selectedMonths: [],
        selectedYears: [],
        comparisonPeriods: [],
        customComparisonPeriods: [],
        currentData: [],
        chart: null,
        charts: {},
        chartTypes: {
            calls: 'bar',
            serviceLevel: 'line',
            satisfaction: 'line',
            waitTime: 'line',
            aht: 'line'
        },
        hourRange: null,
        
        // Флаги инициализации компонентов
        initialized: {
            month: false,
            hour: false,
            custom: false,
            year: false
        }
    };
    
    const chartColors = {
        primary: '#FF6A2C',
        secondary: '#2563EB',
        tertiary: '#059669',
        quaternary: '#DC2626',
        quinary: '#7C3AED',
        sextary: '#EA580C',
        
        teal: '#0D9488',
        indigo: '#4338CA',
        pink: '#EC4899',
        amber: '#D97706',
        lime: '#65A30D',
        
        normative: '#D81B60',
        
        slGood: '#16A34A',
        slBad: '#DC2626'
    };
        
    let elements = {};
    
    /**
     * Форматирует дату периода для отображения
     */
    function formatPeriodDate(date, periodType) {
        if (!date) return '';
        
        if (date === 'Итого' || date.includes('Итого') || date.includes('Месяц') || date.includes('Год')) {
            return date;
        }
        
        try {
            switch (periodType) {
                case 'month': {
                    const parts = date.split('.');
                    if (parts.length === 2) {
                        const month = parseInt(parts[0]);
                        const year = parseInt(parts[1]);
                        
                        const monthNames = [
                            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
                        ];
                        
                        return `${monthNames[month - 1]} ${year}`;
                    }
                    return date;
                }
                
                case 'year': {
                    if (date.includes('Год')) {
                        return date;
                    }
                    return `Год ${date}`;
                }
                
                case 'hour': {
                    const dateParts = date.split('.');
                    if (dateParts.length === 3) {
                        return `${dateParts[0]}.${dateParts[1]}.${dateParts[2]}`;
                    }
                    return date;
                }
                
                case 'custom': {
                    const dateParts = date.split('.');
                    if (dateParts.length === 3) {
                        return `${dateParts[0]}.${dateParts[1]}.${dateParts[2]}`;
                    }
                    
                    if (date.includes(' - ')) {
                        const rangeParts = date.split(' - ');
                        const formattedStart = formatPeriodDate(rangeParts[0], 'custom');
                        const formattedEnd = formatPeriodDate(rangeParts[1], 'custom');
                        return `${formattedStart} - ${formattedEnd}`;
                    }
                    
                    return date;
                }
                
                default:
                    return date;
            }
        } catch (error) {
            console.warn('Ошибка форматирования даты:', error);
            return date;
        }
    }
    
    /**
     * Парсит дату из строки
     */
    function parseDate(dateStr) {
        if (!dateStr) return null;
        
        try {
            if (dateStr === 'Итого' || dateStr.includes('Итого') || dateStr.includes('Месяц') || dateStr.includes('Год')) {
                return null;
            }
            
            // DD.MM.YYYY
            if (dateStr.match(/\d{2}\.\d{2}\.\d{4}/)) {
                const parts = dateStr.split('.');
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
            
            // MM.YYYY
            if (dateStr.match(/\d{2}\.\d{4}/)) {
                const parts = dateStr.split('.');
                return new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 1);
            }
            
            // YYYY
            if (dateStr.match(/^\d{4}$/)) {
                return new Date(parseInt(dateStr), 0, 1);
            }
            
            // "Месяц YYYY"
            const monthMatch = dateStr.match(/(\w+)\s+(\d{4})/);
            if (monthMatch) {
                const monthName = monthMatch[1];
                const year = parseInt(monthMatch[2]);
                
                const monthNames = [
                    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
                ];
                
                const monthIndex = monthNames.findIndex(m => m === monthName);
                if (monthIndex !== -1) {
                    return new Date(year, monthIndex, 1);
                }
            }
            
            // "Год YYYY"
            const yearMatch = dateStr.match(/Год\s+(\d{4})/);
            if (yearMatch) {
                return new Date(parseInt(yearMatch[1]), 0, 1);
            }
            
            return new Date(dateStr);
        } catch (error) {
            console.warn('Ошибка парсинга даты:', error);
            return null;
        }
    }
    
    /**
     * Форматирует значение для отображения
     */
    function formatValue(value, addPercent = false) {
        if (value === null || value === undefined || isNaN(value)) {
            return '-';
        }
        
        const formattedValue = Number(value).toFixed(1).replace('.', ',');
        return formattedValue;
    }
    
    /**
     * Форматирует числовое значение с разделителями
     */
    function formatNumber(number) {
        if (number === null || number === undefined || isNaN(number)) {
            return '-';
        }
        
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    
    /**
     * Кэширует DOM элементы для быстрого доступа
     */
    function cacheElements() {
        const cachedElements = {
            reportSwitches: document.querySelectorAll('#reportTypeSwitch .toggle-option'),
            dataSwitches: document.querySelectorAll('#dataTypeSwitch .toggle-option'),
            
            callBlock: document.getElementById('call-block'),
            
            periodTabs: document.querySelectorAll('.period-tab:not([data-target="omni"])'),
            
            monthSelector: document.getElementById('month-selector'),
            hourSelector: document.getElementById('hour-selector'),
            customPeriod: document.getElementById('custom-period'),
            yearSelector: document.getElementById('year-selector'),
            monthsRowsContainer: document.getElementById('months-rows-container'),
            yearsRowsContainer: document.getElementById('years-rows-container'),
            
            dateComparisonContainer: document.getElementById('date-comparison-container'),
            customComparisonContainer: document.getElementById('custom-comparison-container'),
            
            submitBtn: document.getElementById('submitBtn'),
            clearBtn: document.getElementById('clearButton'),
            exportBtn: document.getElementById('exportExcelBtn'),
            toggleChartBtn: document.getElementById('toggleChartBtn'),
            closeChartBtn: document.getElementById('closeChartBtn'),
            addMonthBtn: document.getElementById('add-month-btn'),
            addDateBtn: document.getElementById('add-date-btn'),
            addYearBtn: document.getElementById('add-year-btn'),
            addCustomComparisonBtn: document.getElementById('add-custom-comparison-btn'),
            
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            startDatetime: document.getElementById('start-datetime'),
            endDatetime: document.getElementById('end-datetime'),
            
            dataTable: document.getElementById('data-table'),
            dataTableBody: document.querySelector('#data-table tbody'),
            comparisonsContainer: document.getElementById('comparison-tables'),
            chartContainer: document.getElementById('chart-view-container'),
        };
        
        return cachedElements;
    }
    
    /**
     * Добавляет стили для интерфейса отчетов
     */
    function addReportStyles() {
        if (document.getElementById('report-module-styles')) return;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'report-module-styles';
        
        const styles = `
        /* === КРАСИВЫЕ БОЛЬШИЕ КНОПКИ "ДОБАВИТЬ" === */
            .add-btn-row {
                display: flex;
                justify-content: flex-start;
                margin: 24px 0 16px;
                padding: 0 8px;             
                gap: 12px;
            }
                /* Анимация активации кнопки периода */
                .period-tab-activating {
                    animation: periodTabActivate 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                @keyframes periodTabActivate {
                    0% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.08);
                    }
                    100% {
                        transform: scale(1);
                    }
                }

                /* Улучшенные стили для period-tab */
                .period-tab {
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
                    position: relative;
                    overflow: hidden;
                }

                .period-tab:hover {
                    transform: translateY(-3px) scale(1.05) !important;
                }

                .period-tab:active {
                    transform: translateY(-1px) scale(1.02) !important;
                    transition: transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
                }

            .big-add-btn, 
            .add-button.big-add-btn, 
            .add-year-button.big-add-btn, 
            .add-month-button.big-add-btn,
            #add-year-btn,
            #add-month-btn,
            #add-date-btn,
            #add-custom-comparison-btn {
                background: linear-gradient(135deg, #FF6A2C 0%, #FF5100 50%, #E63946 100%);
                color: #fff !important;
                border: none;
                font-weight: 700;
                font-size: 16px;
                font-family: 'Montserrat', sans-serif;
                min-width: 180px;
                min-height: 56px;
                border-radius: 16px;
                box-shadow: 
                    0 8px 32px rgba(255, 106, 44, 0.4),
                    0 4px 16px rgba(255, 81, 0, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2);
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                outline: none;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                padding: 16px 24px;
                position: relative;
                cursor: pointer;
                letter-spacing: 0.8px;
                text-transform: uppercase;
                overflow: hidden;
                backdrop-filter: blur(10px);
                border: 2px solid rgba(255, 255, 255, 0.1);
            }

            /* Улучшенный эффект свечения при ховере */
            .big-add-btn::before,
            #add-year-btn::before,
            #add-month-btn::before,
            #add-date-btn::before,
            #add-custom-comparison-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    90deg, 
                    transparent, 
                    rgba(255, 255, 255, 0.4), 
                    transparent
                );
                transition: left 0.6s ease-in-out;
            }

            /* Дополнительный внутренний свет */
            .big-add-btn::after,
            #add-year-btn::after,
            #add-month-btn::after,
            #add-date-btn::after,
            #add-custom-comparison-btn::after {
                content: '';
                position: absolute;
                inset: 2px;
                border-radius: 14px;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
                pointer-events: none;
                transition: opacity 0.4s ease;
                opacity: 0;
            }

            .big-add-btn:hover::before,
            #add-year-btn:hover::before,
            #add-month-btn:hover::before,
            #add-date-btn:hover::before,
            #add-custom-comparison-btn:hover::before {
                left: 100%;
            }

            .big-add-btn:hover::after,
            #add-year-btn:hover::after,
            #add-month-btn:hover::after,
            #add-date-btn:hover::after,
            #add-custom-comparison-btn:hover::after {
                opacity: 1;
            }

            .big-add-btn:hover,
            #add-year-btn:hover,
            #add-month-btn:hover,
            #add-date-btn:hover,
            #add-custom-comparison-btn:hover {
                transform: translateY(-4px) scale(1.08);
                box-shadow: 
                    0 16px 48px rgba(255, 106, 44, 0.6),
                    0 8px 24px rgba(255, 81, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3);
                filter: brightness(1.15) saturate(1.2);
                border-color: rgba(255, 255, 255, 0.3);
            }

            .big-add-btn:active,
            #add-year-btn:active,
            #add-month-btn:active,
            #add-date-btn:active,
            #add-custom-comparison-btn:active {
                transform: translateY(-2px) scale(1.04);
                box-shadow: 
                    0 8px 24px rgba(255, 106, 44, 0.5),
                    0 4px 12px rgba(255, 81, 0, 0.3),
                    inset 0 2px 8px rgba(0, 0, 0, 0.1);
                transition: all 0.15s ease;
            }

            /* Улучшенная иконка с анимацией */
            .add-btn-icon {
                font-size: 24px;
                font-weight: 900;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }

            .big-add-btn:hover .add-btn-icon,
            #add-year-btn:hover .add-btn-icon,
            #add-month-btn:hover .add-btn-icon,
            #add-date-btn:hover .add-btn-icon,
            #add-custom-comparison-btn:hover .add-btn-icon {
                transform: rotate(180deg) scale(1.2);
            }

            .add-btn-text {
                display: inline-block;
                font-size: 15px;
                font-weight: 700;
                line-height: 1.3;
                text-align: center;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                transition: all 0.3s ease;
            }

            /* Пульсирующий эффект для привлечения внимания */
            @keyframes pulse-glow {
                0%, 100% {
                    box-shadow: 
                        0 8px 32px rgba(255, 106, 44, 0.4),
                        0 4px 16px rgba(255, 81, 0, 0.2);
                }
                50% {
                    box-shadow: 
                        0 12px 40px rgba(255, 106, 44, 0.6),
                        0 6px 20px rgba(255, 81, 0, 0.4);
                }
            }

            .big-add-btn.pulse,
            #add-year-btn.pulse,
            #add-month-btn.pulse,
            #add-date-btn.pulse,
            #add-custom-comparison-btn.pulse {
                animation: pulse-glow 2s ease-in-out infinite;
            }

            /* Состояние загрузки */
            .big-add-btn.loading,
            #add-year-btn.loading,
            #add-month-btn.loading,
            #add-date-btn.loading,
            #add-custom-comparison-btn.loading {
                pointer-events: none;
                opacity: 0.8;
            }

            .big-add-btn.loading .add-btn-icon,
            #add-year-btn.loading .add-btn-icon,
            #add-month-btn.loading .add-btn-icon,
            #add-date-btn.loading .add-btn-icon,
            #add-custom-comparison-btn.loading .add-btn-icon {
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* Адаптивность */
            @media (max-width: 1024px) {
                .add-btn-row {
                    justify-content: flex-start;
                    flex-wrap: wrap;
                    gap: 16px;
                }
            }

            @media (max-width: 768px) {
            .add-btn-row {
                margin: 20px 0 12px;
                gap: 12px;
                justify-content: flex-start;
            }
                
                .big-add-btn,
                #add-year-btn,
                #add-month-btn,
                #add-date-btn,
                #add-custom-comparison-btn {
                    min-width: 160px;
                    min-height: 52px;
                    font-size: 15px;
                    padding: 14px 20px;
                    border-radius: 14px;
                }
                
                .add-btn-icon {
                    font-size: 22px;
                }
                
                .add-btn-text {
                    font-size: 14px;
                }
            }

            @media (max-width: 480px) {
            .add-btn-row {
                flex-direction: column;
                align-items: flex-start;
                gap: 12px;
            }
                
                .big-add-btn,
                #add-year-btn,
                #add-month-btn,
                #add-date-btn,
                #add-custom-comparison-btn {
                    min-width: 100%;
                    max-width: 280px;
                    min-height: 48px;
                    font-size: 14px;
                    gap: 10px;
                    padding: 12px 18px;
                    border-radius: 12px;
                }
                
                .add-btn-icon {
                    font-size: 20px;
                }
                
                .add-btn-text {
                    font-size: 13px;
                }
            }

            /* === УЛУЧШЕННЫЕ АНИМАЦИИ ДЛЯ ВСЕХ ЭЛЕМЕНТОВ === */
            .action-button, .period-tab, .toggle-option, .stk-btn-switch,
            .chart-type-btn, .remove-month-btn, .remove-year-btn,
            .remove-comparison-btn {
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                position: relative;
                overflow: hidden;
                border-radius: 24px;
            }

            .action-button:hover, .period-tab:hover, .toggle-option:hover,
            .stk-btn-switch:hover, .chart-type-btn:hover {
                transform: translateY(-3px) scale(1.05);
                box-shadow: 
                    0 12px 36px rgba(0, 0, 0, 0.15),
                    0 6px 18px rgba(0, 0, 0, 0.1);
                filter: brightness(1.08) saturate(1.1);
            }

            .action-button:active, .period-tab:active, .toggle-option:active {
                transform: translateY(-1px) scale(1.02);
                transition: transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            }

            /* Улучшенный волновой эффект */
            .action-button::after, .period-tab::after, .toggle-option::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
                transform: translate(-50%, -50%);
                transition: width 0.8s ease-out, height 0.8s ease-out, opacity 0.8s ease-out;
                opacity: 0;
                pointer-events: none;
            }

            .action-button:active::after, .period-tab:active::after, .toggle-option:active::after {
                width: 300px;
                height: 300px;
                opacity: 1;
                transition: width 0.3s ease-out, height 0.3s ease-out, opacity 0.1s ease-out;
            }
        
        /* Стили для интерфейса выбора месяцев */
        .month-header,
        .year-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .month-header span,
        .year-header span {
            font-weight: 500;
            color: #333;
            font-size: 15px;
        }

        .add-month-button,
        .add-year-button {
            background: transparent;
            border: 2px dashed #ccc;
            color: #555;
            border-radius: 8px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            position: relative;
            overflow: hidden;
        }

        .add-month-button:hover,
        .add-year-button:hover {
            border-color: #FF6A2C;
            background-color: rgba(255, 106, 44, 0.08);
            color: #FF6A2C;
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 6px 20px rgba(255, 106, 44, 0.2);
        }

        .months-rows-container,
        .years-rows-container {
            width: 100%;
        }

        .month-row,
        .year-row {
            display: flex;
            gap: 12px;
            margin-bottom: 10px;
            padding: 0;
            position: relative;
            border-radius: 8px;
            opacity: 0;
            transform: translateX(-30px) scale(0.95);
            animation: slideInScale 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        .month-row:nth-child(1) { animation-delay: 0.1s; }
        .month-row:nth-child(2) { animation-delay: 0.2s; }
        .month-row:nth-child(3) { animation-delay: 0.3s; }
        .month-row:nth-child(4) { animation-delay: 0.4s; }
        .month-row:nth-child(5) { animation-delay: 0.5s; }

        .year-row:nth-child(1) { animation-delay: 0.1s; }
        .year-row:nth-child(2) { animation-delay: 0.2s; }
        .year-row:nth-child(3) { animation-delay: 0.3s; }

        @keyframes slideInScale {
            0% {
                opacity: 0;
                transform: translateX(-30px) scale(0.95);
            }
            60% {
                transform: translateX(5px) scale(1.02);
            }
            100% {
                opacity: 1;
                transform: translateX(0) scale(1);
            }
        }

        .month-row .month-select,
        .month-row .year-select,
        .year-row .year-select {
            flex: 1;
        }

        .month-row select,
        .year-row select {
            width: 100%;
            padding: 10px 14px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            background-color: white;
            color: #333;
            font-size: 14px;
            height: 42px;
            appearance: auto;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
        }

        .month-row select:focus,
        .year-row select:focus {
            border-color: #FF6A2C;
            outline: none;
            box-shadow: 0 0 0 4px rgba(255, 106, 44, 0.1), 0 4px 12px rgba(0, 0, 0, 0.1);
            transform: translateY(-2px);
        }

        .month-row select:disabled,
        .year-row select:disabled {
            background-color: #f8f9fa;
            color: #adb5bd;
        }

        .month-row .remove-month-btn,
        .year-row .remove-year-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 42px;
            height: 42px;
            background: transparent;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            color: #6c757d;
            cursor: pointer;
            font-size: 18px;
            padding: 0;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            position: relative;
            overflow: hidden;
        }

        .month-row .remove-month-btn:hover,
        .year-row .remove-year-btn:hover {
            background-color: #fee;
            color: #dc3545;
            border-color: #dc3545;
            transform: translateY(-2px) scale(1.1) rotate(90deg);
            box-shadow: 0 6px 20px rgba(220, 53, 69, 0.2);
        }

        .selected-months-display,
        .months-badge-container {
            display: none !important;
        }
        
        /* Стили для контейнера графика */
        .chart-container {
            display: none;
            position: relative;
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
            margin-bottom: 20px;
            overflow: hidden;
            opacity: 0;
            transform: translateY(30px) scale(0.95);
            transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .chart-container.active {
            display: block;
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        
        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 25px;
            background: linear-gradient(135deg, #FF5100 0%, #FF6A2C 100%);
            color: white;
            position: relative;
            overflow: hidden;
        }
        
        .chart-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: -50%;
            width: 200%;
            height: 100%;
            background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
            transform: translateX(-100%);
            transition: transform 0.8s ease;
        }
        
        .chart-header:hover::before {
            transform: translateX(100%);
        }
        
        .chart-header h3 {
            margin: 0;
            font-size: 19px;
            font-weight: 600;
            position: relative;
            z-index: 1;
        }
        
        .close-chart-btn {
            background: transparent;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 8px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            position: relative;
            z-index: 1;
        }
        
        .close-chart-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: rotate(180deg) scale(1.1);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }
        
        .chart-wrapper {
            position: relative;
            min-height: 600px;
            padding: 25px;
        }
        
        /* Улучшенные стили для вертикального расположения графиков */
        .vertical-charts-container {
            display: flex;
            flex-direction: column;
            gap: 35px;
            width: 100%;
            margin-bottom: 20px;
            position: relative;
            box-sizing: border-box;
        }
        
        .single-chart-container {
            position: relative;
            height: 420px;
            padding: 25px;
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 6px 25px rgba(0, 0, 0, 0.08);
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            overflow: hidden;
            transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            border: 1px solid #f0f0f0;
            opacity: 0;
            transform: translateY(40px) scale(0.95);
            animation: chartContainerAppear 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        
        .single-chart-container:nth-child(1) { animation-delay: 0.1s; }
        .single-chart-container:nth-child(2) { animation-delay: 0.25s; }
        .single-chart-container:nth-child(3) { animation-delay: 0.4s; }
        .single-chart-container:nth-child(4) { animation-delay: 0.55s; }
        
        @keyframes chartContainerAppear {
            0% {
                opacity: 0;
                transform: translateY(40px) scale(0.95);
            }
            70% {
                transform: translateY(-5px) scale(1.02);
            }
            100% {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .single-chart-container:hover {
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
            border-color: #FF6A2C;
        }
        
        /* Улучшенные стили для селекторов типа графика */
        .chart-type-selector {
            position: absolute;
            top: 20px;
            right: 20px;
            z-index: 10;
            background-color: white;
            border-radius: 12px;
            border: 2px solid #e5e7eb;
            box-shadow: 0 6px 20px rgba(0,0,0,0.12);
            padding: 8px;
            display: flex;
            align-items: center;
            opacity: 0;
            transform: translateY(-15px) scale(0.9);
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .single-chart-container:hover .chart-type-selector {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        
        .chart-type-btn {
            background: transparent;
            border: none;
            border-radius: 8px;
            padding: 10px 12px;
            margin: 0 3px;
            cursor: pointer;
            color: #6b7280;
            font-size: 15px;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            position: relative;
            overflow: hidden;
        }
        
        .chart-type-btn:hover {
            background-color: #f8fafc;
            color: #FF5100;
            transform: translateY(-2px) scale(1.1);
            box-shadow: 0 4px 12px rgba(255, 81, 0, 0.15);
        }
        
        .chart-type-btn.active {
            background-color: #FF5100;
            color: white;
            transform: translateY(-2px) scale(1.1);
            box-shadow: 0 6px 20px rgba(255, 81, 0, 0.3);
        }
        
        .chart-type-btn:focus {
            outline: none;
            box-shadow: 0 0 0 4px rgba(255, 81, 0, 0.2);
        }
        
        /* Стили для индикаторов загрузки */
        .loading-indicator {
            text-align: center;
            padding: 30px 0;
            color: #666;
        }
        
        .loading-indicator .loading-spinner {
            margin: 0 auto 15px;
            width: 45px;
            height: 45px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #FF5100;
            border-radius: 50%;
            animation: spinner 1.2s linear infinite;
        }
        
        .chart-loading {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: rgba(255, 255, 255, 0.95);
            z-index: 10;
            backdrop-filter: blur(6px);
            opacity: 0;
            animation: fadeInLoading 0.3s ease forwards;
        }
        
        @keyframes fadeInLoading {
            to { opacity: 1; }
        }
        
        .chart-loading .loading-spinner {
            width: 55px;
            height: 55px;
            border: 5px solid #e0e0e0;
            border-top: 5px solid #FF5100;
            border-radius: 50%;
            animation: spinner 1.5s linear infinite;
        }
        
        .chart-loading .loading-message {
            margin-top: 20px;
            font-size: 16px;
            color: #333;
            font-weight: 500;
        }
        
        .chart-error {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 25px;
            background-color: #fff8f8;
            border: 2px solid #ffcccc;
            border-radius: 12px;
            color: #d33;
            font-size: 16px;
            text-align: center;
            max-width: 80%;
            z-index: 11;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }
        
        @keyframes spinner {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Улучшенные стили для таблиц */
        .data-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        
        .data-table th {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-bottom: 2px solid #dee2e6;
            padding: 18px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
            color: #495057;
            position: relative;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .data-table th.sortable:hover {
            background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
            transform: translateY(-1px);
        }
        
        .data-table th.sortable:after {
            content: '⇅';
            position: absolute;
            right: 10px;
            opacity: 0.3;
            transition: all 0.3s ease;
        }
        
        .data-table th.sortable:hover:after {
            opacity: 0.8;
            transform: scale(1.2);
        }
        
        .data-table th.sorted-asc:after {
            content: '↑';
            opacity: 1;
            color: #FF5100;
            transform: scale(1.2);
        }
        
        .data-table th.sorted-desc:after {
            content: '↓';
            opacity: 1;
            color: #FF5100;
            transform: scale(1.2);
        }
        
        .data-table td {
            border-bottom: 1px solid #e5e7eb;
            padding: 18px;
            font-size: 14px;
            color: #374151;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .data-table tr:hover td {
            background-color: rgba(255, 106, 44, 0.06);
            transform: scale(1.005);
        }
        
        .data-table .total-row {
            background: linear-gradient(135deg, rgba(255, 81, 0, 0.1) 0%, rgba(255, 106, 44, 0.05) 100%);
            font-weight: 600;
        }
        
        .data-table .total-row:hover td {
            background: linear-gradient(135deg, rgba(255, 81, 0, 0.18) 0%, rgba(255, 106, 44, 0.12) 100%);
        }
        
        .data-table .no-data-row td {
            text-align: center;
            padding: 50px 0;
            color: #6B7280;
            font-style: italic;
            font-size: 16px;
        }
        
        /* Стили для Service Level */
        .sl-good {
            color: #16A34A !important;
            font-weight: 600;
        }
        
        .sl-bad {
            color: #DC2626 !important;
            font-weight: 600;
        }
        
        /* Стили для контейнера сравнений */
        .comparison-tables-wrapper {
            margin-bottom: 20px;
        }
        
        .comparison-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 25px;
            padding: 25px;
            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
            border-radius: 16px;
            border: 2px solid #e5e7eb;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 18px;
            border-radius: 10px;
            background-color: rgba(255, 255, 255, 0.9);
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        
        .legend-item:hover {
            transform: translateY(-3px) scale(1.05);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
            background-color: white;
        }
        
        .legend-color {
            width: 18px;
            height: 18px;
            border-radius: 6px;
        }
        
        .comparison-table-header {
            font-size: 17px;
            font-weight: 600;
            margin: 25px 0 15px;
            padding-left: 15px;
            border-left: 5px solid #FF5100;
        }
        
        /* Стили для сравнения дат */
        .date-comparison-item,
        .year-comparison-item {
            background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
            border: 2px solid #e5e7eb;
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 20px;
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            opacity: 0;
            transform: translateX(-30px) scale(0.95);
            animation: slideInFromLeft 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        }
        
        .date-comparison-item:hover,
        .year-comparison-item:hover {
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.12);
            border-color: #FF6A2C;
        }
        
        .comparison-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .comparison-title {
            font-weight: 600;
            font-size: 16px;
        }
        
        .remove-comparison-btn {
            background: transparent;
            border: none;
            color: #777;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .remove-comparison-btn:hover {
            background-color: rgba(239, 68, 68, 0.12);
            color: #ef4444;
            transform: rotate(180deg) scale(1.2);
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);
        }
        
        .datetime-container{
            display: flex;
            gap: 20px;
        }
        
        .datetime-field,
        .date-field {
            flex: 1;
        }
        
        .datetime-field label,
        .date-field label {
            display: block;
            margin-bottom: 10px;
            font-size: 14px;
            color: #374151;
            font-weight: 500;
        }
        
        .input-with-icon {
            position: relative;
        }
        
        .input-with-icon i {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            color: #6B7280;
            z-index: 2;
        }
        
        .input-with-icon input {
            padding-left: 45px;
            width: 100%;
            height: 46px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .input-with-icon input:focus {
            border-color: #FF6A2C;
            outline: none;
            box-shadow: 0 0 0 4px rgba(255, 106, 44, 0.1), 0 4px 12px rgba(0, 0, 0, 0.1);
            transform: translateY(-2px);
        }
        
        /* Стили для селектора годов */
        .year-selector {
            margin-top: 5px;
        }
        
        .year-selector select {
            width: 100%;
            padding: 10px 14px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            background-color: white;
            color: #333;
            font-size: 14px;
            height: 42px;
        }
        
        /* Стили для контейнера сравнения в произвольном периоде */
        .comparison-section {
            margin-top: 25px;
            border-top: 2px solid #e5e7eb;
            padding-top: 20px;
        }
        
        .comparison-section h3 {
            font-size: 17px;
            margin-bottom: 20px;
            color: #333;
        }
        
        /* Скрытие кнопки График для месячного типа - УДАЛЕНО, так как теперь нужна для "По месяцам" */
        
        /* Скрытие кнопки Детальные данные для годового типа */
        .period-tab[data-period="year"].active ~ * .toggle-option[data-value="detailed"],
        [data-period-type="year"] .toggle-option[data-value="detailed"] {
            display: none !important;
        }
        
        /* Стили для детального сравнения графиков */
        .detailed-comparison-chart {
            position: relative;
            background: #fafbfc;
            border: 3px solid #e1e5e9;
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 35px;
        }
        
        .detailed-comparison-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e1e5e9;
        }
        
        .detailed-comparison-title {
            font-size: 19px;
            font-weight: 700;
            color: #2c3e50;
            margin: 0;
        }
        
        .comparison-periods-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 18px;
            margin: 20px 0;
            padding: 20px;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 12px;
            border: 2px solid #dee2e6;
        }
        
        .comparison-period-badge {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 15px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 3px 8px rgba(0,0,0,0.08);
            font-size: 13px;
            font-weight: 500;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .comparison-period-badge:hover {
            transform: translateY(-2px) scale(1.05);
            box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        }
        
        .comparison-period-color {
            width: 14px;
            height: 14px;
            border-radius: 4px;
            border: 1px solid rgba(0,0,0,0.1);
        }
        
        /* Улучшенные анимации */
        @keyframes gradientShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }

        @keyframes fadeInStagger {
            from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        @keyframes fadeIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(30px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateX(0) scale(1);
            }
        }

        @keyframes slideInFromLeft {
            from {
                opacity: 0;
                transform: translateX(-30px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateX(0) scale(1);
            }
        }

        @keyframes pulse {
            0% {
                transform: scale(1);
                opacity: 1;
            }
            50% {
                transform: scale(1.08);
                opacity: 0.8;
            }
            100% {
                transform: scale(1);
                opacity: 1;
            }
        }

        @keyframes rotate360 {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Стили для новой системы уведомлений */
        #notifications-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            width: 340px;
            max-width: 90vw;
            pointer-events: none;
        }
        
        .notification {
            pointer-events: auto;
            padding: 18px;
            border-radius: 12px;
            box-shadow: 0 6px 25px rgba(0,0,0,0.15);
            font-family: 'Montserrat', sans-serif;
            color: #fff;
            display: flex;
            align-items: flex-start;
            opacity: 0;
            transform: translateX(60px) scale(0.9);
            transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            overflow: hidden;
            position: relative;
            margin-bottom: 12px;
        }
        
        .notification.show {
            opacity: 1;
            transform: translateX(0) scale(1);
        }
        
        .notification.hide {
            opacity: 0;
            transform: translateX(60px) scale(0.9);
        }
        
        .notification-icon {
            margin-right: 15px;
            font-size: 22px;
        }
        
        .notification-content {
            flex: 1;
        }
        
        .notification-title {
            font-weight: 600;
            margin-bottom: 6px;
            font-size: 16px;
        }
        
        .notification-message {
            font-size: 14px;
            opacity: 0.9;
        }
        
        .notification-close {
            background: transparent;
            border: none;
            color: #fff;
            opacity: 0.7;
            cursor: pointer;
            font-size: 18px;
            padding: 0;
            margin-left: 12px;
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .notification-close:hover {
            opacity: 1;
            background: rgba(255, 255, 255, 0.2);
            transform: rotate(180deg) scale(1.2);
        }
        
        .notification-progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 4px;
            background-color: rgba(255, 255, 255, 0.7);
            width: 100%;
            transform-origin: left;
        }
        
        .notification.success {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }
        
        .notification.error {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }
        
        .notification.warning {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }
        
        .notification.info {
            background: linear-gradient(135deg, #FF5100 0%, #FF6A2C 100%);
        }
        
        @keyframes progressShrink {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
        }

        /* Новые анимации для уведомлений */
        @keyframes fadeInRight {
            from {
                opacity: 0;
                transform: translateX(60px) scale(0.9);
            }
            to {
                opacity: 1;
                transform: translateX(0) scale(1);
            }
        }
        
        @keyframes fadeOutRight {
            from {
                opacity: 1;
                transform: translateX(0) scale(1);
            }
            to {
                opacity: 0;
                transform: translateX(60px) scale(0.9);
            }
        }
        
        /* Адаптивные стили */
        @media (max-width: 768px) {
            .month-row,
            .year-row {
                flex-direction: column;
                gap: 10px;
            }
            
            .comparison-legend {
                flex-direction: column;
            }
            
            .datetime-container,
            .date-range-container {
                flex-direction: column;
            }
            
            .chart-legend {
                flex-direction: column;
                padding: var(--space-md);
            }
            
            .chart-wrapper {
                min-height: 450px;
            }
            
            .single-chart-container {
                height: 350px;
            }
        }
        
        @media (max-width: 576px) {
            .chart-type-selector {
                position: relative;
                top: 0;
                right: 0;
                margin-top: 12px;
                margin-bottom: 12px;
                width: 100%;
                justify-content: center;
            }
            
            .chart-wrapper {
                min-height: 350px;
            }
            
            .notification {
                max-width: calc(100vw - 40px);
            }
            
            .single-chart-container {
                height: 300px;
                padding: 18px;
            }
        }
        `;
        
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
    
    /**
     * Добавляет стили для разделенных графиков
     */
    function addSplitChartStyles() {
        if (document.getElementById('split-chart-styles')) return;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'split-chart-styles';
        
        const styles = `
        .vertical-charts-container {
            display: flex;
            flex-direction: column;
            gap: 35px;
            width: 100%;
            margin-bottom: 20px;
            position: relative;
            box-sizing: border-box;
        }
        
                .single-chart-container {
            position: relative;
            height: 420px;
            padding: 25px;
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 6px 25px rgba(0, 0, 0, 0.08);
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            overflow: hidden;
            transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            border: 2px solid #f0f0f0;
        }
        
        .single-chart-container:hover {
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
            border-color: #FF6A2C;
        }
        
        .chart-legend-container {
            margin-bottom: 25px;
            padding: 20px 25px;
            border-radius: 12px;
            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
            border: 2px solid #e5e7eb;
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 18px;
        }
        
        .chart-legend-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 15px;
            border-radius: 8px;
            background-color: rgba(255, 255, 255, 0.9);
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        
        .chart-legend-item:hover {
            transform: translateY(-2px) scale(1.05);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
        }
        
        .chart-legend-color {
            width: 18px;
            height: 18px;
            border-radius: 6px;
        }
        
        .chart-legend-label {
            font-size: 14px;
            font-family: Montserrat, sans-serif;
            color: #333;
            font-weight: 500;
        }
        
        .tooltip-number {
            font-weight: bold;
        }
        
        .positive {
            color: #10b981 !important;
        }
        
        .negative {
            color: #ef4444 !important;
        }
        
        .neutral {
            color: #6b7280 !important;
        }

        .data-point-modal {
            font-family: 'Montserrat', sans-serif;
        }
        
        .data-point-modal strong {
            color: #333;
        }
        
        .data-point-modal span {
            font-weight: 500;
        }
        `;
        
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    /**
     * Вычисляет процентную разницу между текущим и базовым значениями
     */
    function calculatePercentDiff(current, base) {
        if (!base || base === 0) return 0;
        return ((current - base) / Math.abs(base)) * 100;
    }
    
    /**
     * Форматирует процентную разницу
     */
    function formatDiffPercent(percent) {
        if (Math.abs(percent) < 0.1) return '0';
        
        const sign = percent > 0 ? '+' : '';
        return `${sign}${Math.abs(percent).toFixed(1).replace('.', ',')}`;
    }
    
    /**
     * Показывает уведомление пользователю
     */
    function showNotification(type, message, options = {}, title = '') {
        const duration = options.duration || 5000;
        
        let notificationsContainer = document.getElementById('notifications-container');
        if (!notificationsContainer) {
            notificationsContainer = document.createElement('div');
            notificationsContainer.id = 'notifications-container';
            notificationsContainer.style.position = 'fixed';
            notificationsContainer.style.top = '20px';
            notificationsContainer.style.right = '20px';
            notificationsContainer.style.zIndex = '10000';
            notificationsContainer.style.width = '340px';
            notificationsContainer.style.maxWidth = '90vw';
            document.body.appendChild(notificationsContainer);
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        let icon = '';
        switch (type) {
            case NOTIFICATION_TYPES.SUCCESS:
                icon = '<i class="fas fa-check-circle"></i>';
                break;
            case NOTIFICATION_TYPES.ERROR:
                icon = '<i class="fas fa-exclamation-circle"></i>';
                break;
            case NOTIFICATION_TYPES.WARNING:
                icon = '<i class="fas fa-exclamation-triangle"></i>';
                break;
            case NOTIFICATION_TYPES.INFO:
            default:
                icon = '<i class="fas fa-info-circle"></i>';
                break;
        }
        
        if (!title) {
            switch(type) {
                case NOTIFICATION_TYPES.SUCCESS: title = 'Успешно'; break;
                case NOTIFICATION_TYPES.ERROR: title = 'Ошибка'; break;
                case NOTIFICATION_TYPES.WARNING: title = 'Внимание'; break;
                case NOTIFICATION_TYPES.INFO: title = 'Информация'; break;
            }
        }
        
        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">&times;</button>
            <div class="notification-progress"></div>
        `;
        
        notificationsContainer.prepend(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        const progressBar = notification.querySelector('.notification-progress');
        progressBar.style.animation = `progressShrink ${duration/1000}s linear`;
        progressBar.style.animationFillMode = 'forwards';
        
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            closeNotification(notification);
        });
        
        const timeoutId = setTimeout(() => {
            closeNotification(notification);
        }, duration);
        
        notification.addEventListener('mouseenter', () => {
            progressBar.style.animationPlayState = 'paused';
            clearTimeout(timeoutId);
        });
        
        notification.addEventListener('mouseleave', () => {
            progressBar.style.animationPlayState = 'running';
            setTimeout(() => {
                closeNotification(notification);
            }, duration * (1 - parseFloat(getComputedStyle(progressBar).transform.split(',')[0].slice(7))));
        });
        
        function closeNotification(notificationElement) {
            notificationElement.classList.remove('show');
            notificationElement.classList.add('hide');
            
            setTimeout(() => {
                notificationElement.remove();
            }, 600);
        }
        
        return notification;
    }

    /**
     * Рендерит вкладки выбора периода в нужном порядке: По годам, По месяцам, Произвольный период, По часам
     */
        function renderPeriodTabs() {
        const periodTabs = document.querySelector('.period-tabs:not(.small)');
        if (!periodTabs) return;

        periodTabs.innerHTML = `
            <button class="period-tab" data-period="year">
                <i class="far fa-calendar-alt"></i> По годам
            </button>
            <button class="period-tab" data-period="month">
                <i class="far fa-calendar-alt"></i> По месяцам
            </button>
            <button class="period-tab" data-period="custom">
                <i class="fas fa-calendar-week"></i> Произвольный период
            </button>
            <button class="period-tab" data-period="hour">
                <i class="far fa-clock"></i> По часам
            </button>
        `;

        // Назначить обработчики событий для новых вкладок
        elements.periodTabs = document.querySelectorAll('.period-tab:not([data-target="omni"])');
        elements.periodTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const periodType = this.dataset.period;
                const target = this.dataset.target || 'call';
                switchPeriodType(periodType, target);
            });
        });
    }

    
    /**
     * Инициализирует интерфейс отчетов
     */
        function init() {
        addReportStyles();
        addSplitChartStyles();

        elements = cacheElements();

        renderPeriodTabs(); 
        addYearPeriodSelector();
        addCustomComparisonSection();

        setupEventListeners();
        setupReportSwitchers();
        setCurrentDates();
        initActivePeriodType();
        renderEmptyTable('custom');
    }   

    function setupReportSwitchers() {
        const reportSwitches = document.querySelectorAll('#reportTypeSwitch .toggle-option, .toggle-btn[data-type], .stk-btn-switch[data-type]');
        
        reportSwitches.forEach(btn => {
            btn.addEventListener('click', function() {
                const type = this.dataset.value || this.dataset.type;
                
                reportSwitches.forEach(button => {
                    const buttonType = button.dataset.value || button.dataset.type;
                    button.classList.toggle('active', buttonType === type);
                });
                
                switchReportType(type);
            });
        });
    }
    
    /**
     * Добавляет вкладку "По годам" в интерфейс
     */
    function addYearPeriodTab() {
        const periodTabs = document.querySelector('.period-tabs:not(.small)');
        if (!periodTabs) return;
        
        const monthTab = periodTabs.querySelector('[data-period="month"]');
        if (!monthTab) return;
        
        const yearTab = document.createElement('button');
        yearTab.className = 'period-tab';
        yearTab.setAttribute('data-period', 'year');
        yearTab.innerHTML = '<i class="fas fa-calendar-alt"></i> По годам';
        
        if (monthTab.nextSibling) {
            periodTabs.insertBefore(yearTab, monthTab.nextSibling);
        } else {
            periodTabs.appendChild(yearTab);
        }
        
        elements.periodTabs = document.querySelectorAll('.period-tab:not([data-target="omni"])');
    }
    
    /**
     * Добавляет контейнер для годового селектора
     */
        function addYearPeriodSelector() {
        const periodContainers = document.querySelector('.period-containers');
        if (!periodContainers) return;

        const monthSelector = document.getElementById('month-selector');
        if (!monthSelector) return;

        const yearSelector = document.createElement('div');
        yearSelector.id = 'year-selector';
        yearSelector.className = 'period-container';
        yearSelector.innerHTML = `
            <div class="input-group-header">
                <h3>Выберите годы для отчета</h3>
            </div>
            <div id="years-rows-container" class="years-rows-container">
                <!-- Сюда JS добавит строки с выбором года -->
            </div>
            <div class="add-btn-row">
                <button type="button" id="add-year-btn" class="add-button big-add-btn">
                    <span class="add-btn-icon">+</span>
                    <span class="add-btn-text">Добавить<br>год</span>
                </button>
            </div>
        `;

        if (monthSelector.nextSibling) {
            periodContainers.insertBefore(yearSelector, monthSelector.nextSibling);
        } else {
            periodContainers.appendChild(yearSelector);
        }

        Object.assign(elements, {
            yearSelector: document.getElementById('year-selector'),
            yearsRowsContainer: document.getElementById('years-rows-container'),
            addYearBtn: document.getElementById('add-year-btn')
        });
    }

    /**
     * Инициализирует селектор часов
     */
    function initHourSelector() {
        if (elements.startDatetime) {
            elements.startDatetime.type = 'datetime-local';
            elements.startDatetime.step = '3600'; // Шаг в 1 час
            
            // Добавляем обработчик для сброса минут в 00
            elements.startDatetime.addEventListener('change', function() {
                if (this.value) {
                    const date = new Date(this.value);
                    date.setMinutes(0);
                    date.setSeconds(0);
                    date.setMilliseconds(0);
                    
                    // Форматируем обратно в datetime-local формат
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    
                    this.value = `${year}-${month}-${day}T${hours}:00`;
                }
            });
            
            // Добавляем обработчик для input события (при ручном вводе)
            elements.startDatetime.addEventListener('input', function() {
                if (this.value && this.value.length >= 16) {
                    const parts = this.value.split('T');
                    if (parts.length === 2 && parts[1].length >= 5) {
                        const timeParts = parts[1].split(':');
                        if (timeParts.length >= 2) {
                            // Устанавливаем минуты в 00
                            this.value = `${parts[0]}T${timeParts[0]}:00`;
                        }
                    }
                }
            });
        }
        
        if (elements.endDatetime) {
            elements.endDatetime.type = 'datetime-local';
            elements.endDatetime.step = '3600'; // Шаг в 1 час
            
            // Добавляем обработчик для сброса минут в 00
            elements.endDatetime.addEventListener('change', function() {
                if (this.value) {
                    const date = new Date(this.value);
                    date.setMinutes(0);
                    date.setSeconds(0);
                    date.setMilliseconds(0);
                    
                    // Форматируем обратно в datetime-local формат
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    
                    this.value = `${year}-${month}-${day}T${hours}:00`;
                }
            });
            
            // Добавляем обработчик для input события (при ручном вводе)
            elements.endDatetime.addEventListener('input', function() {
                if (this.value && this.value.length >= 16) {
                    const parts = this.value.split('T');
                    if (parts.length === 2 && parts[1].length >= 5) {
                        const timeParts = parts[1].split(':');
                        if (timeParts.length >= 2) {
                            // Устанавливаем минуты в 00
                            this.value = `${parts[0]}T${timeParts[0]}:00`;
                        }
                    }
                }
            });
         }
          // Принудительная очистка при инициализации
        if (elements.dateComparisonContainer) {
            elements.dateComparisonContainer.innerHTML = '';
        }
        state.comparisonPeriods = [];
        setCurrentDates();
    }

    /**
     * Добавляет контейнер для месячного селектора с красивой кнопкой
     */
        function addMonthPeriodSelector() {
    // Просто обновляем ссылки на элементы, HTML уже правильный
    Object.assign(elements, {
        monthsRowsContainer: document.getElementById('months-rows-container'),
        addMonthBtn: document.getElementById('add-month-btn')
    });
}


    /**
     * Добавляет секцию для сравнений в произвольный период
     */
        function addCustomComparisonSection() {
            const customPeriod = document.getElementById('custom-period');
            if (!customPeriod) return;

            const comparisonSection = document.createElement('div');
            comparisonSection.className = 'comparison-section';
            comparisonSection.innerHTML = `
                <div class="comparison-header">
                    <h3>Сравнение с другими периодами</h3>
                </div>
                <div id="custom-comparison-container" class="comparison-periods-container">
                    <!-- JS добавит здесь элементы сравнения -->
                </div>
                <div class="add-btn-row">
                    <button type="button" id="add-custom-comparison-btn" class="add-button big-add-btn">
                        <span class="add-btn-icon">+</span>
                        <span class="add-btn-text">Добавить<br>период</span>
                    </button>
                </div>
            `;

            customPeriod.appendChild(comparisonSection);

            // Обновляем элементы
            Object.assign(elements, {
                customComparisonContainer: document.getElementById('custom-comparison-container'),
                addCustomComparisonBtn: document.getElementById('add-custom-comparison-btn')
            });

            // ВАЖНО: Принудительно применяем стили
            const addBtn = elements.addCustomComparisonBtn;
            if (addBtn) {
                // Добавляем обработчик клика
                addBtn.addEventListener('click', addCustomComparisonPeriod);
                
                // Принудительно применяем классы для анимаций
                addBtn.classList.add('big-add-btn', 'add-button');
                
                // Добавляем недостающие элементы для анимации ::before и ::after
                const style = window.getComputedStyle(addBtn, '::before');
                if (!style.content) {
                    addBtn.style.position = 'relative';
                    addBtn.style.overflow = 'hidden';
                }
            }
        }
    
    /**
     * Устанавливает все обработчики событий
     */
    function setupEventListeners() {
        if (elements.reportSwitches) {
            elements.reportSwitches.forEach(button => {
                button.addEventListener('click', function() {
                    switchReportType(this.dataset.value);
                });
            });
        }
        
        if (elements.dataSwitches) {
            elements.dataSwitches.forEach(button => {
                button.addEventListener('click', function() {
                    switchDataType(this.dataset.value);
                });
            });
        }
        
        if (elements.periodTabs) {
            elements.periodTabs.forEach(tab => {
                tab.addEventListener('click', function() {
                    const periodType = this.dataset.period;
                    const target = this.dataset.target || 'call';
                    switchPeriodType(periodType, target);
                });
            });
        }
        
        if (elements.submitBtn) {
            elements.submitBtn.addEventListener('click', loadReportData);
        }
        
        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', clearForm);
        }
        
        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', exportToExcel);
        }
        
        if (elements.toggleChartBtn) {
            elements.toggleChartBtn.addEventListener('click', toggleChart);
        }
        
        if (elements.closeChartBtn) {
            elements.closeChartBtn.addEventListener('click', hideChart);
        }
        
        if (elements.addMonthBtn) {
            elements.addMonthBtn.addEventListener('click', addMonthRow);
        }
        
        if (elements.addYearBtn) {
            elements.addYearBtn.addEventListener('click', addYearRow);
        }
        
        if (elements.addDateBtn) {
            elements.addDateBtn.addEventListener('click', addDateTimeComparisonPeriod);
        }
        
        if (elements.addCustomComparisonBtn) {
            elements.addCustomComparisonBtn.addEventListener('click', addCustomComparisonPeriod);
        }
    }
    
    /**
     * Инициализирует активный тип периода
     */
        function initActivePeriodType() {
        // Определяем активный тип периода
        let activePeriodType = 'custom'; // по умолчанию
        
        // Проверяем, есть ли уже активная вкладка
        const activeTab = document.querySelector('.period-tab.active:not([data-target="omni"])');
        if (activeTab && activeTab.dataset.period) {
            activePeriodType = activeTab.dataset.period;
        } else {
            // Если нет активной вкладки, ищем первую доступную или устанавливаем "Произвольный период"
            const firstTab = document.querySelector('.period-tab[data-period="custom"]:not([data-target="omni"])');
            if (firstTab) {
                activePeriodType = 'custom';
            }
        }
        
        // Устанавливаем активный тип в состоянии
        state.periodType = activePeriodType;
        
        // Отмечаем соответствующую кнопку как активную
        markActivePeriodButton(activePeriodType);
        
        // Показываем соответствующий селектор
        togglePeriodSelectors(activePeriodType);
    }

    /**
     * Отмечает активную кнопку периода
     */
    function markActivePeriodButton(periodType) {
        // Снимаем активность со всех кнопок периода
        const allPeriodTabs = document.querySelectorAll('.period-tab:not([data-target="omni"])');
        allPeriodTabs.forEach(tab => {
            tab.classList.remove('active');
            tab.style.transition = '';
            tab.style.transform = '';
        });
        
        // Находим и активируем нужную кнопку
        const targetTab = document.querySelector(`.period-tab[data-period="${periodType}"]:not([data-target="omni"])`);
        if (targetTab) {
            targetTab.classList.add('active');

            targetTab.classList.add('period-tab-activating');
            
            setTimeout(() => {
                targetTab.classList.remove('period-tab-activating');
            }, 400);
        } else {
            console.warn(`[UI] Не найдена кнопка для типа периода: ${periodType}`);
        }
    }
    
    /**
     * Устанавливает текущие даты в полях ввода
     */
        function setCurrentDates() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        
        const todayDate = `${year}-${month}-${day}`;
        const currentTime = `${todayDate}T${hours}:00`; // ИЗМЕНЕНО: минуты всегда 00
        
        const DATE_LIMITS = {
            MIN_DATE: '2023-01-01'
        };
        
        if (elements.startDate) {
            elements.startDate.value = todayDate;
            elements.startDate.min = DATE_LIMITS.MIN_DATE;
            elements.startDate.max = todayDate;
        }
        
        if (elements.endDate) {
            elements.endDate.value = todayDate;
            elements.endDate.min = DATE_LIMITS.MIN_DATE;
            elements.endDate.max = todayDate;
        }
        
        if (elements.startDatetime) {
            elements.startDatetime.value = currentTime;
            elements.startDatetime.min = `${DATE_LIMITS.MIN_DATE}T00:00`;
            elements.startDatetime.max = currentTime;
        }
        
        if (elements.endDatetime) {
            elements.endDatetime.value = currentTime;
            elements.endDatetime.min = `${DATE_LIMITS.MIN_DATE}T00:00`;
            elements.endDatetime.max = currentTime;
        }
    }
    
    /**
     * Переключает тип отчета (звонки/чаты)
     */
    function switchReportType(type) {
        const allSwitches = document.querySelectorAll('#reportTypeSwitch .toggle-option, .toggle-btn[data-type], .stk-btn-switch[data-type]');
        
        allSwitches.forEach(btn => {
            const btnType = btn.dataset.value || btn.dataset.type;
            btn.classList.toggle('active', btnType === type);
        });
        
        state.reportType = type;
        
        const callBlock = document.getElementById('call-block');
        const omniBlock = document.getElementById('omni-block');
        
        if (type === 'call') {
            if (callBlock) {
                callBlock.classList.add('active');
                callBlock.style.display = '';
            }
            
            if (omniBlock) {
                omniBlock.classList.remove('active');
                omniBlock.style.display = 'none';
            }
            
            if (elements.chartContainer && elements.chartContainer.classList.contains('active')) {
                hideChart();
            }
        } else if (type === 'omni') {
            if (callBlock) {
                callBlock.classList.remove('active');
                callBlock.style.display = 'none';
            }
            
            if (omniBlock) {
                omniBlock.classList.add('active');
                omniBlock.style.display = '';
            }
            
            if (typeof setupOmniBlock === 'function' || (window.ChatModule && typeof window.ChatModule.init === 'function')) {
                if (typeof setupOmniBlock === 'function') {
                    setupOmniBlock();
                } else if (window.ChatModule && typeof window.ChatModule.init === 'function') {
                    window.ChatModule.init();
                }
            }
        }
        
        const switchEvent = new CustomEvent('reportTypeSwitch', { detail: { type: type } });
        document.dispatchEvent(switchEvent);
    }
    
    /**
     * Переключает тип данных (суммарные/детальные)
     */
    function switchDataType(type) {
        if (elements.dataSwitches) {
            elements.dataSwitches.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === type);
            });
        }
        
        state.dataType = type;
        
        if (state.periodType === 'year' && type === 'detailed') {
            showNotification('warning', 'В режиме "По годам" доступны только суммарные данные');
            
            setTimeout(() => {
                elements.dataSwitches.forEach(btn => {
                    if (btn.dataset.value === 'summary') {
                        btn.click();
                    }
                });
            }, 100);
            return;
        }
        
        if (state.currentData && state.currentData.length > 0) {
        loadReportData(); // Перезагружаем данные с новым типом
    }
}
    
    /**
     * Переключает тип периода
     */
        function switchPeriodType(periodType, target) {
            if (target !== 'omni') {
            const tabSelector = '.period-tab:not([data-target="omni"])';
            document.querySelectorAll(tabSelector).forEach(tab => {
                tab.classList.toggle('active', tab.dataset.period === periodType);
            });
            
            state.periodType = periodType;
            
            // ДОБАВЛЯЕМ: Устанавливаем кольцевой график для годового периода
            if (periodType === 'year') {
                state.chartTypes.calls = 'doughnut';
            }
            
            // ИСПРАВЛЯЕМ: Более тщательная очистка при смене периода
            state.currentData = [];
            state.comparisonPeriods = [];
            state.customComparisonPeriods = [];
            
            // ДОБАВЛЯЕМ: Очистка контейнеров сравнений в DOM
            if (elements.dateComparisonContainer) {
                elements.dateComparisonContainer.innerHTML = '';
            }
            
            if (elements.customComparisonContainer) {
                elements.customComparisonContainer.innerHTML = '';
            }
            
            // ДОБАВЛЯЕМ: Сброс флагов инициализации для принудительной переинициализации
            state.initialized = {
                month: false,
                hour: false,
                custom: false,
                year: false
            };
            
            // Скрываем график при смене периода
            if (elements.chartContainer && elements.chartContainer.classList.contains('active')) {
                hideChart();
            }
            
            togglePeriodSelectors(periodType);
            
            if (periodType === 'year' && state.dataType === 'detailed') {
                showNotification('warning', 'В режиме "По годам" доступны только суммарные данные');
                
                elements.dataSwitches.forEach(btn => {
                    if (btn.dataset.value === 'summary') {
                        btn.click();
                    }
                });
            }
            
            updateButtonVisibility(periodType);
            
            // Отображаем пустую таблицу для нового типа периода
            renderEmptyTable(periodType);
            
            // ДОБАВЛЯЕМ: Принудительная очистка таблиц сравнений
            if (elements.comparisonsContainer) {
                elements.comparisonsContainer.innerHTML = '';
                elements.comparisonsContainer.style.display = 'none';
            }
            
            // ДОБАВЛЯЕМ: Показываем основную таблицу
            if (elements.dataTable) {
                elements.dataTable.closest('.table-responsive').style.display = '';
            }
        }
    }
    
    /**
     * Обновляет видимость кнопок в зависимости от типа периода
     */
    function updateButtonVisibility(periodType) {    
        const detailedDataBtn = document.querySelector('.toggle-option[data-value="detailed"]');
        if (detailedDataBtn) {
            if (periodType === 'year') {
                detailedDataBtn.style.display = 'none';
            } else {
                detailedDataBtn.style.display = '';
            }
        }
    }
    
    /**
     * Переключает селекторы периодов
     */
        function togglePeriodSelectors(periodType) {
            const periodContainers = document.querySelectorAll('.period-container');
            periodContainers.forEach(container => {
                container.classList.remove('active');
            });
            
            switch (periodType) {
                case 'month':
                    if (elements.monthSelector) {
                        elements.monthSelector.classList.add('active');
                        if (!state.initialized.month) {
                            initMonthSelector();
                            state.initialized.month = true;
                        }
                    }
                    // ДОБАВЛЯЕМ: Принудительная очистка для месячного периода
                    state.selectedMonths = [];
                    // Очищаем все строки месяцев кроме первой
                    const monthRows = document.querySelectorAll('.month-row');
                    monthRows.forEach((row, index) => {
                        if (index > 0) {
                            row.remove();
                        }
                    });
                    // Сбрасываем первую строку к текущему месяцу
                    const firstMonthRow = document.querySelector('.month-row');
                    if (firstMonthRow) {
                        const now = new Date();
                        const monthSelect = firstMonthRow.querySelector('.month-dropdown');
                        const yearSelect = firstMonthRow.querySelector('.year-dropdown');
                        
                        if (monthSelect) {
                            monthSelect.value = (now.getMonth() + 1).toString();
                        }
                        
                        if (yearSelect) {
                            const currentYear = now.getFullYear();
                            const yearToSet = currentYear >= DATE_LIMITS.MIN_YEAR ? currentYear : DATE_LIMITS.MIN_YEAR;
                            yearSelect.value = yearToSet.toString();
                        }
                        
                        if (monthSelect && yearSelect) {
                            updateAvailableMonths(monthSelect, yearSelect);
                        }
                    }
                    updateSelectedMonths();
                    break;
                    
                case 'year':
                    if (elements.yearSelector) {
                        elements.yearSelector.classList.add('active');
                        if (!state.initialized.year) {
                            initYearSelector();
                            state.initialized.year = true;
                        }
                    }
                    // ДОБАВЛЯЕМ: Принудительная очистка для годового периода
                    state.selectedYears = [];
                    // Очищаем все строки годов кроме первой
                    const yearRows = document.querySelectorAll('.year-row');
                    yearRows.forEach((row, index) => {
                        if (index > 0) {
                            row.remove();
                        }
                    });
                    // Сбрасываем первую строку к текущему году
                    const firstYearRow = document.querySelector('.year-row');
                    if (firstYearRow) {
                        const now = new Date();
                        const yearSelect = firstYearRow.querySelector('.year-dropdown');
                        
                        if (yearSelect) {
                            const currentYear = now.getFullYear();
                            const yearToSet = currentYear >= DATE_LIMITS.MIN_YEAR ? currentYear : DATE_LIMITS.MIN_YEAR;
                            yearSelect.value = yearToSet.toString();
                        }
                    }
                    updateSelectedYears();
                    break;
                    
                case 'hour':
                    if (elements.hourSelector) {
                        elements.hourSelector.classList.add('active');
                        if (!state.initialized.hour) {
                            initHourSelector();
                            state.initialized.hour = true;
                        }
                    }
                    // Принудительная очистка периодов сравнения для часов
                    state.comparisonPeriods = [];
                    if (elements.dateComparisonContainer) {
                        elements.dateComparisonContainer.innerHTML = '';
                    }
                    // ДОБАВЛЯЕМ: Сброс времени к текущему
                    setCurrentDates();
                    break;
                    
                case 'custom':
                    if (elements.customPeriod) {
                        elements.customPeriod.classList.add('active');
                        if (!state.initialized.custom) {
                            initCustomPeriodSelector();
                            state.initialized.custom = true;
                        }
                    }
                    // Принудительная очистка периодов сравнения для произвольного периода
                    state.customComparisonPeriods = [];
                    if (elements.customComparisonContainer) {
                        elements.customComparisonContainer.innerHTML = '';
                    }
                    // ДОБАВЛЯЕМ: Сброс дат к текущим
                    setCurrentDates();
                    break;
            }
            
            state.periodType = periodType;
            
            renderEmptyTable(periodType);
            updateButtonVisibility(periodType);
        }
    
    /**
     * Инициализирует селектор месяцев
     */
    function initMonthSelector() {
        //Принудительная очистка при инициализации
        const monthRows = document.querySelectorAll('.month-row');
        monthRows.forEach(row => row.remove());
        
        state.selectedMonths = [];
        
        addMonthRow();
        
        const elementsToHide = document.querySelectorAll('.selected-months-display, #months-container');
        elementsToHide.forEach(el => {
            if (el) el.style.display = 'none';
        });
    }

    /**
     * Инициализирует селектор годов
     */
    function initYearSelector() {
    //Принудительная очистка при инициализации
    const yearRows = document.querySelectorAll('.year-row');
    yearRows.forEach(row => row.remove());
    
    state.selectedYears = [];
    
    addYearRow();
}

    /**
     * Константы для ограничений дат
     */
    const DATE_LIMITS = {
        MIN_YEAR: 2023,
        MAX_YEAR: new Date().getFullYear(),
        MIN_DATE: '2023-01-01'
    };

    /**
     * Добавляет новую строку выбора месяца и года
     */
    function addMonthRow() {
        const container = elements.monthsRowsContainer;
        if (!container) return;
        
        const rowId = `month-row-${Date.now()}`;
        const rowElem = document.createElement('div');
        rowElem.className = 'month-row';
        rowElem.id = rowId;
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        rowElem.innerHTML = `
            <div class="month-select">
                <select class="month-dropdown">
                    <option value="1">Январь</option>
                    <option value="2">Февраль</option>
                    <option value="3">Март</option>
                    <option value="4">Апрель</option>
                    <option value="5">Май</option>
                    <option value="6">Июнь</option>
                    <option value="7">Июль</option>
                    <option value="8">Август</option>
                    <option value="9">Сентябрь</option>
                    <option value="10">Октябрь</option>
                    <option value="11">Ноябрь</option>
                    <option value="12">Декабрь</option>
                </select>
            </div>
            <div class="year-select">
                <select class="year-dropdown"></select>
            </div>
            <button type="button" class="remove-month-btn" title="Удалить">×</button>
        `;
        
        container.appendChild(rowElem);
        
        const monthSelect = rowElem.querySelector('.month-dropdown');
        const yearSelect = rowElem.querySelector('.year-dropdown');
        const removeBtn = rowElem.querySelector('.remove-month-btn');
        
        for (let year = currentYear; year >= DATE_LIMITS.MIN_YEAR; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }
        
        if (currentYear >= DATE_LIMITS.MIN_YEAR) {
            monthSelect.value = (currentMonth + 1).toString();
            yearSelect.value = currentYear.toString();
        } else {
            monthSelect.value = '1';
            yearSelect.value = DATE_LIMITS.MIN_YEAR.toString();
        }
        
        updateAvailableMonths(monthSelect, yearSelect);
        
        yearSelect.addEventListener('change', function() {
            updateAvailableMonths(monthSelect, yearSelect);
            updateSelectedMonths();
            checkForDuplicateMonths();
        });
        
        monthSelect.addEventListener('change', function() {
            updateSelectedMonths();
            checkForDuplicateMonths();
        });
        
        removeBtn.addEventListener('click', function() {
            const allRows = document.querySelectorAll('.month-row');
            if (allRows.length > 1) {
                rowElem.remove();
                updateSelectedMonths();
            } else {
                showNotification('warning', 'Должен быть выбран хотя бы один месяц');
            }
        });
        
        updateSelectedMonths();
    }
    
    /**
     * Проверяет и предотвращает выбор дублированных месяцев
     */
    function checkForDuplicateMonths() {
        const monthRows = document.querySelectorAll('.month-row');
        const selectedCombinations = new Set();
        
        monthRows.forEach(row => {
            const monthSelect = row.querySelector('.month-dropdown');
            const yearSelect = row.querySelector('.year-dropdown');
            
            if (monthSelect && yearSelect) {
                const month = monthSelect.value;
                const year = yearSelect.value;
                const combination = `${month}-${year}`;
                
                if (selectedCombinations.has(combination)) {
                    showNotification('warning', 'Нельзя выбрать одинаковые месяцы в одном году');
                    
                    const now = new Date();
                    monthSelect.value = (now.getMonth() + 1).toString();
                    yearSelect.value = now.getFullYear().toString();
                    updateAvailableMonths(monthSelect, yearSelect);
                    updateSelectedMonths();
                    return;
                }
                
                selectedCombinations.add(combination);
            }
        });
    }
    
    /**
     * Добавляет новую строку выбора года
     */
    function addYearRow() {
        const container = elements.yearsRowsContainer;
        if (!container) return;
        
        const rowId = `year-row-${Date.now()}`;
        const rowElem = document.createElement('div');
        rowElem.className = 'year-row';
        rowElem.id = rowId;
        
        const now = new Date();
        const currentYear = now.getFullYear();
        
        rowElem.innerHTML = `
            <div class="year-select">
                <select class="year-dropdown"></select>
            </div>
            <button type="button" class="remove-year-btn" title="Удалить">×</button>
        `;
        
        container.appendChild(rowElem);
        
        const yearSelect = rowElem.querySelector('.year-dropdown');
        const removeBtn = rowElem.querySelector('.remove-year-btn');
        
        for (let year = currentYear; year >= DATE_LIMITS.MIN_YEAR; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }
        
        if (currentYear >= DATE_LIMITS.MIN_YEAR) {
            yearSelect.value = currentYear.toString();
        } else {
            yearSelect.value = DATE_LIMITS.MIN_YEAR.toString();
        }
        
        yearSelect.addEventListener('change', function() {
            updateSelectedYears();
        });
        
        removeBtn.addEventListener('click', function() {
            const allRows = document.querySelectorAll('.year-row');
            if (allRows.length > 1) {
                rowElem.remove();
                updateSelectedYears();
            } else {
                showNotification('warning', 'Должен быть выбран хотя бы один год');
            }
        });
        
        updateSelectedYears();
    }
    
    /**
     * Обновляет доступные месяцы в зависимости от выбранного года
     */
    function updateAvailableMonths(monthSelect, yearSelect) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const selectedYear = parseInt(yearSelect.value);
        
        if (selectedYear < DATE_LIMITS.MIN_YEAR) {
            showNotification('warning', `Данные доступны только с ${DATE_LIMITS.MIN_YEAR} года`);
            yearSelect.value = DATE_LIMITS.MIN_YEAR.toString();
            return;
        }
        
        Array.from(monthSelect.options).forEach((option) => {
            const monthValue = parseInt(option.value);
            let isDisabled = false;
            
            if (selectedYear < DATE_LIMITS.MIN_YEAR) {
                isDisabled = true;
            }
            else if (selectedYear === DATE_LIMITS.MIN_YEAR) {
                isDisabled = false;
            }
            else if (selectedYear === currentYear) {
                isDisabled = monthValue > currentMonth + 1;
            }
            else if (selectedYear > currentYear) {
                isDisabled = true;
            }
            
            option.disabled = isDisabled;
            option.style.color = isDisabled ? '#b8b8b8' : '';
        });
        
        if (monthSelect.options[monthSelect.selectedIndex].disabled) {
            for (let i = 0; i < monthSelect.options.length; i++) {
                if (!monthSelect.options[i].disabled) {
                    monthSelect.selectedIndex = i;
                    break;
                }
            }
        }
    }
    
    /**
     * Обновляет список выбранных месяцев
     */
    function updateSelectedMonths() {
        state.selectedMonths = [];
        
        const monthRows = document.querySelectorAll('.month-row');
        monthRows.forEach(row => {
            const monthSelect = row.querySelector('.month-dropdown');
            const yearSelect = row.querySelector('.year-dropdown');
            
            if (monthSelect && yearSelect) {
                const month = parseInt(monthSelect.value);
                const year = parseInt(yearSelect.value);
                const monthName = monthSelect.options[monthSelect.selectedIndex].text;
                
                state.selectedMonths.push({
                    month,
                    year,
                    name: monthName
                });
            }
        });
    }
    
    /**
     * Обновляет список выбранных годов
     */
    function updateSelectedYears() {
        state.selectedYears = [];
        
        const yearRows = document.querySelectorAll('.year-row');
        yearRows.forEach(row => {
            const yearSelect = row.querySelector('.year-dropdown');
            
            if (yearSelect) {
                const year = parseInt(yearSelect.value);
                
                state.selectedYears.push({
                    year
                });
            }
        });
    }
    
    /**
     * Инициализирует селектор для произвольного периода
     */
        function initCustomPeriodSelector() {
            const customPeriod = document.getElementById('custom-period');
            if (!customPeriod) return;

            // ДОБАВЛЯЕМ: Принудительная очистка при инициализации
            if (elements.customComparisonContainer) {
                elements.customComparisonContainer.innerHTML = '';
            }

            state.customComparisonPeriods = [];

        // Находим контейнер для сравнения и добавляем кнопку
        const comparisonSection = customPeriod.querySelector('#custom-comparison-container');
        if (comparisonSection && !customPeriod.querySelector('.add-btn-row')) {
            const addBtnRow = document.createElement('div');
            addBtnRow.className = 'add-btn-row';
            addBtnRow.innerHTML = `
                <button type="button" id="add-custom-comparison-btn" class="add-button big-add-btn">
                    <span class="add-btn-icon">+</span>
                    <span class="add-btn-text">Добавить<br>период</span>
                </button>
            `;
            comparisonSection.parentNode.insertBefore(addBtnRow, comparisonSection.nextSibling);

            Object.assign(elements, {
                addCustomComparisonBtn: document.getElementById('add-custom-comparison-btn')
            });
        }

        if (elements.customComparisonContainer) {
            elements.customComparisonContainer.innerHTML = '';
        }

        state.customComparisonPeriods = [];
    
    // ДОБАВЛЯЕМ: Установка текущих дат
    setCurrentDates();
}
    
    /**
     * Добавляет период для сравнения в часовом режиме
     */
        function addDateTimeComparisonPeriod() {
        if (!elements.dateComparisonContainer) {
            console.warn('[WARNING] dateComparisonContainer не найден');
            return;
        }
        
        const periodId = `compare-${Date.now()}`;
        
        // Получаем текущую дату и время с минутами 00
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        
        const currentTime = `${year}-${month}-${day}T${hours}:00`;
        const minDateTime = `${DATE_LIMITS.MIN_DATE}T00:00`;
        
        console.log(`[UI] Добавление периода сравнения: ${periodId}`);
        
        // Создаем элемент периода
        const periodItem = document.createElement('div');
        periodItem.className = 'date-comparison-item';
        periodItem.dataset.id = periodId;
        periodItem.style.opacity = '0';
        periodItem.style.transform = 'translateX(-30px) scale(0.95)';
        
        periodItem.innerHTML = `
                <div class="comparison-header">
                    <span class="comparison-title">Выберите период для сравнения</span>
                    <button type="button" class="remove-comparison-btn" title="Удалить период" aria-label="Удалить период сравнения">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="date-range-container">
                    <div class="date-field">
                        <label for="start-dt-${periodId}">Начало периода:</label>
                        <div class="input-with-icon">
                            <i class="far fa-calendar-alt"></i>
                            <input type="datetime-local" 
                                id="start-dt-${periodId}"
                                class="form-input start-dt" 
                                value="${currentTime}" 
                                step="3600" 
                                min="${minDateTime}" 
                                max="${currentTime}"
                                aria-describedby="start-dt-help-${periodId}">
                        </div>
                    </div>
                    <div class="date-field">
                        <label for="end-dt-${periodId}">Конец периода:</label>
                        <div class="input-with-icon">
                            <i class="far fa-calendar-alt"></i>
                            <input type="datetime-local" 
                                id="end-dt-${periodId}"
                                class="form-input end-dt" 
                                value="${currentTime}" 
                                step="3600" 
                                min="${minDateTime}" 
                                max="${currentTime}"
                                aria-describedby="end-dt-help-${periodId}">
                        </div>
                    </div>
                </div>
            `;
        
        // Добавляем элемент в контейнер
        elements.dateComparisonContainer.appendChild(periodItem);
        
        // Анимация появления
        setTimeout(() => {
            periodItem.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            periodItem.style.opacity = '1';
            periodItem.style.transform = 'translateX(0) scale(1)';
        }, 10);
        
        // Получаем элементы
        const removeBtn = periodItem.querySelector('.remove-comparison-btn');
        const startDtInput = periodItem.querySelector('.start-dt');
        const endDtInput = periodItem.querySelector('.end-dt');
        const titleElement = periodItem.querySelector('.comparison-title');
        
        /**
         * Нормализует время, устанавливая минуты в 00
         */
        function normalizeDateTime(input) {
            if (!input.value) return;
            
            try {
                const date = new Date(input.value);
                
                // Проверяем валидность даты
                if (isNaN(date.getTime())) {
                    console.warn('[WARNING] Некорректная дата:', input.value);
                    return;
                }
                
                // Устанавливаем минуты, секунды и миллисекунды в 0
                date.setMinutes(0);
                date.setSeconds(0);
                date.setMilliseconds(0);
                
                // Форматируем обратно в datetime-local формат
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                
                const normalizedValue = `${year}-${month}-${day}T${hours}:00`;
                
                if (input.value !== normalizedValue) {
                    input.value = normalizedValue;
                    console.log(`[UI] Время нормализовано: ${normalizedValue}`);
                }
            } catch (error) {
                console.error('[ERROR] Ошибка при нормализации времени:', error);
            }
        }
        
        /**
         * Валидирует диапазон дат
         */
        function validateDateTimeRange() {
            if (!startDtInput.value || !endDtInput.value) return true;
            
            const startDate = new Date(startDtInput.value);
            const endDate = new Date(endDtInput.value);
            
            if (startDate >= endDate) {
                endDtInput.setCustomValidity('Конец периода должен быть позже начала');
                endDtInput.reportValidity();
                showNotification('error', 'Конец периода должен быть позже начала периода');
                return false;
            }
            
            // Сбрасываем ошибки валидации
            startDtInput.setCustomValidity('');
            endDtInput.setCustomValidity('');
            return true;
        }
        
        /**
         * Обновляет заголовок периода
         */
        function updatePeriodTitle() {
            if (!startDtInput.value || !endDtInput.value) {
                titleElement.textContent = 'Выберите период для сравнения';
                return;
            }
            
            try {
                const startDate = new Date(startDtInput.value);
                const endDate = new Date(endDtInput.value);
                
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    titleElement.textContent = 'Выберите период для сравнения';
                    return;
                }
                
                const startStr = startDate.toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const endStr = endDate.toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                titleElement.textContent = `${startStr} — ${endStr}`;
            } catch (error) {
                console.error('[ERROR] Ошибка при обновлении заголовка:', error);
                titleElement.textContent = 'Выберите период для сравнения';
            }
        }
        
        // Обработчики для начального времени
        startDtInput.addEventListener('change', function() {
            normalizeDateTime(this);
            
            if (validateDateTimeInput(this, 'Начало периода')) {
                if (validateDateTimeRange()) {
                    updatePeriodTitle();
                    updateComparisonPeriodTitles();
                }
            }
        });
        
        startDtInput.addEventListener('input', function() {
            // Нормализуем время при вводе
            if (this.value && this.value.length >= 16) {
                const parts = this.value.split('T');
                if (parts.length === 2 && parts[1].length >= 5) {
                    const timeParts = parts[1].split(':');
                    if (timeParts.length >= 2 && timeParts[1] !== '00') {
                        this.value = `${parts[0]}T${timeParts[0]}:00`;
                    }
                }
            }
        });
        
        startDtInput.addEventListener('blur', function() {
            normalizeDateTime(this);
            updatePeriodTitle();
        });
        
        // Обработчики для конечного времени
        endDtInput.addEventListener('change', function() {
            normalizeDateTime(this);
            
            if (validateDateTimeInput(this, 'Конец периода')) {
                if (validateDateTimeRange()) {
                    updatePeriodTitle();
                    updateComparisonPeriodTitles();
                }
            }
        });
        
        endDtInput.addEventListener('input', function() {
            // Нормализуем время при вводе
            if (this.value && this.value.length >= 16) {
                const parts = this.value.split('T');
                if (parts.length === 2 && parts[1].length >= 5) {
                    const timeParts = parts[1].split(':');
                    if (timeParts.length >= 2 && timeParts[1] !== '00') {
                        this.value = `${parts[0]}T${timeParts[0]}:00`;
                    }
                }
            }
        });
        
        endDtInput.addEventListener('blur', function() {
            normalizeDateTime(this);
            updatePeriodTitle();
        });
        
        // Обработчик удаления периода
        removeBtn.addEventListener('click', function() {
            // Анимация исчезновения
            periodItem.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            periodItem.style.opacity = '0';
            periodItem.style.transform = 'translateX(30px) scale(0.95)';
            
            setTimeout(() => {
                // Удаляем из состояния
                state.comparisonPeriods = state.comparisonPeriods.filter(p => p.id !== periodId);
                
                // Если больше нет периодов сравнения, возвращаемся к обычному режиму
                if (state.comparisonPeriods.length === 0) {
                    state.periodType = 'hour';
                }
                
                // Удаляем элемент из DOM
                if (periodItem.parentNode) {
                    periodItem.parentNode.removeChild(periodItem);
                }
                
                // Обновляем заголовки других периодов
                updateComparisonPeriodTitles();
                
                showNotification('info', 'Период сравнения удален', {}, 'Информация');
            }, 400);
        });
        
        // Добавляем период в состояние
        const periodData = {
            id: periodId,
            element: periodItem,
            startInput: startDtInput,
            endInput: endDtInput,
            titleElement: titleElement
        };
        
        state.comparisonPeriods.push(periodData);
        
        // Обновляем заголовки всех периодов
        updateComparisonPeriodTitles();
        
        // Устанавливаем фокус на первое поле для удобства
        setTimeout(() => {
            startDtInput.focus();
        }, 100);
        
        showNotification('success', 'Период для сравнения добавлен', {}, 'Успешно');
        
        console.log(`[UI] Период сравнения добавлен: ${periodId}`, periodData);
    }
    
    /**
     * Добавляет период для сравнения в произвольном режиме
     */
    function addCustomComparisonPeriod() {
        if (!elements.customComparisonContainer) return;
        
        const periodId = `custom-compare-${Date.now()}`;
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        const todayDate = `${year}-${month}-${day}`;
        
        const periodItem = document.createElement('div');
        periodItem.className = 'date-comparison-item';
        periodItem.dataset.id = periodId;
        
        periodItem.innerHTML = `
            <div class="comparison-header">
                <span class="comparison-title">Выберите период для сравнения</span>
                <button type="button" class="remove-comparison-btn" title="Удалить период">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="date-range-container">
                <div class="date-field">
                    <label>Начало периода:</label>
                    <div class="input-with-icon">
                        <i class="far fa-calendar-alt"></i>
                        <input type="date" class="form-input start-date" 
                            value="${todayDate}" 
                            min="${DATE_LIMITS.MIN_DATE}" max="${todayDate}">
                    </div>
                </div>
                <div class="date-field">
                    <label>Конец периода:</label>
                    <div class="input-with-icon">
                        <i class="far fa-calendar-alt"></i>
                        <input type="date" class="form-input end-date" 
                            value="${todayDate}" 
                            min="${DATE_LIMITS.MIN_DATE}" max="${todayDate}">
                    </div>
                </div>
            </div>
        `;
        
        elements.customComparisonContainer.appendChild(periodItem);
        
        const removeBtn = periodItem.querySelector('.remove-comparison-btn');
        const startDateInput = periodItem.querySelector('.start-date');
        const endDateInput = periodItem.querySelector('.end-date');
        const titleElement = periodItem.querySelector('.comparison-title');
        
        startDateInput.addEventListener('change', function() {
            validateDateInput(this, 'Дата начала');
            updateCustomComparisonTitles();
        });
        
        endDateInput.addEventListener('change', function() {
            validateDateInput(this, 'Дата окончания');
            updateCustomComparisonTitles();
        });
        
        removeBtn.addEventListener('click', function() {
            state.customComparisonPeriods = state.customComparisonPeriods.filter(p => p.id !== periodId);
            
            if (state.customComparisonPeriods.length === 0) {
                state.periodType = 'custom';
            }
            
            periodItem.remove();
            updateCustomComparisonTitles();
            showNotification('info', 'Период сравнения удален', {}, 'Информация');
        });
        
        state.customComparisonPeriods.push({
            id: periodId,
            element: periodItem,
            startInput: startDateInput,
            endInput: endDateInput,
            titleElement: titleElement
        });
        
        updateCustomComparisonTitles();
    }

        /**
     * Валидирует ввод даты
     */
    function validateDateInput(input, fieldName) {
        const selectedDate = new Date(input.value);
        const minDate = new Date(DATE_LIMITS.MIN_DATE);
        const maxDate = new Date();
        
        if (selectedDate < minDate) {
            input.setCustomValidity(`${fieldName} не может быть раньше ${DATE_LIMITS.MIN_DATE}`);
            input.reportValidity();
            showNotification('error', `${fieldName} не может быть раньше 1 января 2023 года`);
            input.value = DATE_LIMITS.MIN_DATE;
            input.setCustomValidity('');
            return false;
        }
        
        if (selectedDate > maxDate) {
            input.setCustomValidity(`${fieldName} не может быть в будущем`);
            input.reportValidity();
            showNotification('error', `${fieldName} не может быть в будущем`);
            
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            input.value = todayStr;
            input.setCustomValidity('');
            return false;
        }
        
        input.setCustomValidity('');
        return true;
    }

    /**
     * Валидирует ввод даты-времени
     */
    function validateDateTimeInput(input, fieldName) {
        const selectedDateTime = new Date(input.value);
        const minDateTime = new Date(`${DATE_LIMITS.MIN_DATE}T00:00`);
        const maxDateTime = new Date();
        
        if (selectedDateTime < minDateTime) {
            input.setCustomValidity(`${fieldName} не может быть раньше ${DATE_LIMITS.MIN_DATE}`);
            input.reportValidity();
            showNotification('error', `${fieldName} не может быть раньше 1 января 2023 года`);
            input.value = `${DATE_LIMITS.MIN_DATE}T00:00`;
            input.setCustomValidity('');
            return false;
        }
        
        if (selectedDateTime > maxDateTime) {
            input.setCustomValidity(`${fieldName} не может быть в будущем`);
            input.reportValidity();
            showNotification('error', `${fieldName} не может быть в будущем`);
            
            const now = new Date();
            const nowStr = now.toISOString().slice(0, 16);
            input.value = nowStr;
            input.setCustomValidity('');
            return false;
        }
        
        input.setCustomValidity('');
        return true;
    }
    
    /**
     * Обновляет заголовки периодов сравнения для часового режима
     */
    function updateComparisonPeriodTitles() {
        state.comparisonPeriods.forEach((period, index) => {
            const titleElement = period.element.querySelector('.comparison-title');
            if (!titleElement) return;
            
            const startInput = period.startInput;
            const endInput = period.endInput;
            
            if (startInput?.value && endInput?.value) {
                const startDate = new Date(startInput.value);
                const endDate = new Date(endInput.value);
                
                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    const startStr = startDate.toLocaleString();
                    const endStr = endDate.toLocaleString();
                    titleElement.textContent = `${startStr} — ${endStr}`;
                    return;
                }
            }
            
            titleElement.textContent = `Выберите период для сравнения`;
        });
    }
    
    /**
     * Обновляет заголовки периодов сравнения для произвольного периода
     */
    function updateCustomComparisonTitles() {
        state.customComparisonPeriods.forEach((period) => {
            const titleElement = period.element.querySelector('.comparison-title');
            if (!titleElement) return;
            
            const startInput = period.startInput;
            const endInput = period.endInput;
            
            if (startInput?.value && endInput?.value) {
                const startDate = new Date(startInput.value);
                const endDate = new Date(endInput.value);
                
                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    const startStr = startDate.toLocaleDateString();
                    const endStr = endDate.toLocaleDateString();
                    titleElement.textContent = `${startStr} — ${endStr}`;
                    return;
                }
            }
            
            titleElement.textContent = `Выберите период для сравнения`;
        });
    }
    
    /**
     * Проверяет корректность диапазона дат
     */
    function validateDateRange(startInput, endInput) {
        if (!startInput || !endInput) return false;
        
        const startDate = startInput.value ? new Date(startInput.value) : null;
        const endDate = endInput.value ? new Date(endInput.value) : null;
        
        if (startDate && endDate && startDate > endDate) {
            endInput.setCustomValidity('Дата окончания не может быть раньше даты начала');
            endInput.reportValidity();
            
            showNotification('error', 'Дата окончания не может быть раньше даты начала');
            
            return false;
        } else {
            startInput.setCustomValidity('');
            endInput.setCustomValidity('');
            return true;
        }
    }
    
    /**
     * Проверяет корректность диапазона дат-времени
     */
    function validateDateTimeRange(startInput, endInput) {
        if (!startInput || !endInput) return false;
        
        const startDateTime = startInput.value ? new Date(startInput.value) : null;
        const endDateTime = endInput.value ? new Date(endInput.value) : null;
        
        if (startDateTime && endDateTime && startDateTime > endDateTime) {
            endInput.setCustomValidity('Конец периода не может быть раньше начала');
            endInput.reportValidity();
            
            showNotification('error', 'Конец периода не может быть раньше начала');
            
            return false;
        } else {
            startInput.setCustomValidity('');
            endInput.setCustomValidity('');
        }
        
        return true;
    }
    
    /**
     * Загружает данные отчета
     */
    function loadReportData() {
        let periodType = state.periodType;
        
        const validPeriodTypes = ['month', 'year', 'hour', 'custom', 'hour-comparison', 'custom-comparison', 'year-comparison'];
        
        if (!validPeriodTypes.includes(periodType)) {
            showNotification(NOTIFICATION_TYPES.ERROR, `Обнаружен неизвестный тип периода: ${periodType}. Сброс на стандартный.`, {}, 'Ошибка');
            
            const activeTab = document.querySelector('.period-tab.active:not([data-target="omni"])');
            if (activeTab && activeTab.dataset.period) {
                periodType = activeTab.dataset.period;
                state.periodType = periodType;
            } else {
                periodType = 'custom';
                state.periodType = 'custom';
            }
        }

        if (periodType === 'custom') {
            if (!validateDateRange(elements.startDate, elements.endDate)) {
                return;
            }
        } else if (periodType === 'hour') {
            if (!validateDateTimeRange(elements.startDatetime, elements.endDatetime)) {
                return;
            }
        }
        
        showLoading();
        
        switch (periodType) {
            case 'month':
                loadMonthlyData();
                break;
            case 'year':
                loadYearlyData();
                break;
            case 'hour':
            case 'hour-comparison':
                loadHourlyData();
                break;
            case 'custom':
            case 'custom-comparison':
                loadCustomPeriodData();
                break;
            default:
                showNotification(NOTIFICATION_TYPES.ERROR, 'Не удалось определить тип периода', {}, 'Ошибка');
                hideLoading();
        }
    }
    
    /**
     * Загружает данные для месячного периода
     */
        function loadMonthlyData() {
        if (!state.selectedMonths || state.selectedMonths.length === 0) {
            showNotification('error', 'Выберите хотя бы один месяц');
            renderEmptyTable('month');
            hideLoading();
            return;
        }
        
        // ИСПРАВЛЯЕМ: отправляем точные месяцы и годы
        const uniqueMonths = [];
        const monthYearCache = new Set();
        
        state.selectedMonths.forEach(monthData => {
            const key = `${monthData.month}-${monthData.year}`;
            if (!monthYearCache.has(key)) {
                monthYearCache.add(key);
                uniqueMonths.push({
                    month: monthData.month,
                    year: monthData.year
                });
            }
        });
        
        const monthsData = JSON.stringify(uniqueMonths);
        
        const params = new URLSearchParams();
        params.append('periodType', 'month');
        params.append('isDetailed', state.dataType === 'detailed');
        params.append('monthsData', monthsData); // Отправляем точные данные
        
        fetch(`/api/table-data?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Ошибка HTTP: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    state.currentData = data.data;
                    renderTableData(data.data, 'month');
                    showNotification('success', 'Данные успешно загружены');
                } else {
                    throw new Error(data.message || 'Ошибка загрузки данных');
                }
            })
            .catch(error => {
                showNotification('error', `Ошибка загрузки данных: ${error.message}`);
                renderEmptyTable('month');
            })
            .finally(() => {
                hideLoading();
            });
    }
    
    /**
     * Загружает данные для годового периода
     */
    function loadYearlyData() {
        if (!state.selectedYears || state.selectedYears.length === 0) {
            showNotification('error', 'Выберите хотя бы один год');
            renderEmptyTable('year');
            hideLoading();
            return;
        }
        
        const uniqueYears = [...new Set(state.selectedYears.map(y => y.year))];
        
        const params = new URLSearchParams();
        params.append('periodType', 'year');
        params.append('isDetailed', false);
        params.append('years', uniqueYears.join(','));
        
        fetch(`/api/table-data?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Ошибка HTTP: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    state.currentData = data.data;
                    renderTableData(data.data, 'year');
                    showNotification('success', 'Данные успешно загружены');
                } else {
                    throw new Error(data.message || 'Ошибка загрузки данных');
                }
            })
            .catch(error => {
                showNotification('error', `Ошибка загрузки данных: ${error.message}`);
                renderEmptyTable('year');
            })
            .finally(() => {
                hideLoading();
            });
    }
    
    /**
     * Загружает данные для часового периода
     */
    function loadHourlyData() {
        const startDateTime = elements.startDatetime?.value;
        const endDateTime = elements.endDatetime?.value;
        
        if (!startDateTime || !endDateTime) {
            showNotification('error', 'Укажите начало и конец периода');
            renderEmptyTable('hour');
            hideLoading();
            return;
        }
        
        if (!validateDateTimeRange(elements.startDatetime, elements.endDatetime)) {
            hideLoading();
            return;
        }
        
        try {
            const startDT = new Date(startDateTime);
            const endDT = new Date(endDateTime);
            
            const startDate = startDateTime.split('T')[0];
            const endDate = endDateTime.split('T')[0];
            const startHour = startDT.getHours();
            const endHour = endDT.getHours();
            
            const crossesMidnight = startDate !== endDate;
            
            const hours = [];
            
            if (crossesMidnight) {
                for (let h = startHour; h <= 23; h++) {
                    hours.push(h);
                }
                for (let h = 0; h <= endHour; h++) {
                    hours.push(h);
                }
            } else {
                for (let h = startHour; h <= endHour; h++) {
                    hours.push(h);
                }
            }
            
            const validComparisonPeriods = [];
            
            for (const period of state.comparisonPeriods) {
                const startDtInput = period.startInput;
                const endDtInput = period.endInput;
                
                if (startDtInput?.value && endDtInput?.value) {
                    if (!validateDateTimeRange(startDtInput, endDtInput)) {
                        hideLoading();
                        return;
                    }
                    
                    const compStartDT = new Date(startDtInput.value);
                    const compEndDT = new Date(endDtInput.value);
                    const compStartDate = startDtInput.value.split('T')[0];
                    const compEndDate = endDtInput.value.split('T')[0];
                    const compStartHour = compStartDT.getHours();
                    const compEndHour = compEndDT.getHours();
                    
                    validComparisonPeriods.push({
                        startDate: compStartDate,
                        endDate: compEndDate,
                        startHour: compStartHour,
                        endHour: compEndHour,
                        startDateTime: compStartDT,
                        endDateTime: compEndDT,
                        crossesMidnight: compStartDate !== compEndDate
                    });
                }
            }
            
            if (validComparisonPeriods.length > 0) {
                loadHourlyComparisonData({
                    startDate, 
                    endDate, 
                    startHour, 
                    endHour, 
                    hours, 
                    crossesMidnight,
                    startDateTime: startDT,
                    endDateTime: endDT
                }, validComparisonPeriods);
                return;
            }
            
            const params = new URLSearchParams();
            params.append('periodType', 'hour');
            params.append('startDate', startDate);
            params.append('endDate', endDate);
            params.append('hours', hours.join(','));
            params.append('isDetailed', state.dataType === 'detailed');
            params.append('crossMidnight', crossesMidnight);
            
            params.append('startDateTime', startDateTime);
            params.append('endDateTime', endDateTime);
            
            fetch(`/api/table-data?${params.toString()}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Ошибка HTTP: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        state.currentData = data.data;
                        
                        state.hourRange = {
                            startHour: startHour,
                            endHour: endHour,
                            startDateTime: startDT,
                            endDateTime: endDT
                        };
                        
                        renderTableData(data.data, 'hour');
                        showNotification('success', 'Данные успешно загружены');
                    } else {
                        throw new Error(data.message || 'Ошибка загрузки данных');
                    }
                })
                .catch(error => {
                    showNotification('error', `Ошибка загрузки данных: ${error.message}`);
                    renderEmptyTable('hour');
                })
                .finally(() => {
                    hideLoading();
                });
        } catch (error) {
            showNotification('error', `Ошибка обработки запроса: ${error.message}`);
            hideLoading();
        }
    }
    
    /**
     * Загружает данные для сравнения часовых периодов
     */
    function loadHourlyComparisonData(mainPeriod, comparisonPeriods) {
        try {
            const mainParams = new URLSearchParams();
            mainParams.append('periodType', 'hour');
            mainParams.append('startDate', mainPeriod.startDate);
            mainParams.append('endDate', mainPeriod.endDate);
            mainParams.append('hours', mainPeriod.hours.join(','));
            mainParams.append('isDetailed', state.dataType === 'detailed');
            mainParams.append('crossMidnight', mainPeriod.crossesMidnight);
            
            if (mainPeriod.startDateTime && mainPeriod.endDateTime) {
                mainParams.append('startDateTime', mainPeriod.startDateTime.toISOString());
                mainParams.append('endDateTime', mainPeriod.endDateTime.toISOString());
            }
            
            const mainRequest = fetch(`/api/table-data?${mainParams.toString()}`).then(resp => resp.json());
            
            const comparisonRequests = comparisonPeriods.map((period, index) => {
                const compHours = [];
                
                if (period.crossesMidnight) {
                    for (let h = period.startHour; h <= 23; h++) {
                        compHours.push(h);
                    }
                    for (let h = 0; h <= period.endHour; h++) {
                        compHours.push(h);
                    }
                } else {
                    for (let h = period.startHour; h <= period.endHour; h++) {
                        compHours.push(h);
                    }
                }
                
                const params = new URLSearchParams();
                params.append('periodType', 'hour');
                params.append('startDate', period.startDate);
                params.append('endDate', period.endDate);
                params.append('hours', compHours.join(','));
                params.append('isDetailed', state.dataType === 'detailed');
                params.append('crossMidnight', period.crossesMidnight);
                
                if (period.startDateTime && period.endDateTime) {
                    params.append('startDateTime', period.startDateTime.toISOString());
                    params.append('endDateTime', period.endDateTime.toISOString());
                }
                
                return fetch(`/api/table-data?${params.toString()}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            const startTimeStr = period.startDateTime.toLocaleString();
                            const endTimeStr = period.endDateTime.toLocaleString();
                            
                            return {
                                data: data.data,
                                period: index + 1,
                                date: `${startTimeStr} - ${endTimeStr}`,
                                color: getComparisonColor(index),
                                isMainPeriod: false
                            };
                        } else {
                            throw new Error(data.message || 'Ошибка загрузки данных сравнения');
                        }
                    });
            });
            
            Promise.all([mainRequest, ...comparisonRequests])
                .then(results => {
                    const mainResult = results[0];
                    const comparisonResults = results.slice(1);
                    
                    if (!mainResult.success) {
                        throw new Error(mainResult.message || 'Ошибка загрузки данных основного периода');
                    }
                    
                    const mainStartTimeStr = mainPeriod.startDateTime.toLocaleString();
                    const mainEndTimeStr = mainPeriod.endDateTime.toLocaleString();
                    const mainPeriodText = `${mainStartTimeStr} - ${mainEndTimeStr}`;
                    
                    const allResults = [
                        {
                            data: mainResult.data,
                            period: 0,
                            date: mainPeriodText,
                            color: chartColors.primary,
                            isMainPeriod: true
                        },
                        ...comparisonResults
                    ];
                    
                    state.currentData = allResults;
                    state.periodType = 'hour-comparison';
                    
                    renderHourlyComparisonTables(allResults);
                    showNotification('success', 'Данные для сравнения успешно загружены');
                })
                .catch(error => {
                    showNotification('error', `Ошибка загрузки данных для сравнения: ${error.message}`);
                    renderEmptyTable('hour');
                })
                .finally(() => {
                    hideLoading();
                });
        } catch (error) {
            showNotification('error', `Ошибка обработки запроса: ${error.message}`);
            hideLoading();
        }
    }
    
    /**
     * Загружает данные для произвольного периода
     */
    function loadCustomPeriodData() {
        const startDate = elements.startDate?.value;
        const endDate = elements.endDate?.value;
        
        if (!startDate || !endDate) {
            showNotification('error', 'Укажите даты начала и окончания периода');
            renderEmptyTable('custom');
            hideLoading();
            return;
        }
        
        if (!validateDateRange(elements.startDate, elements.endDate)) {
            hideLoading();
            return;
        }
        
        const validComparisonPeriods = [];
        
        for (const period of state.customComparisonPeriods) {
            const startDateInput = period.startInput;
            const endDateInput = period.endInput;
            
            if (startDateInput?.value && endDateInput?.value) {
                if (!validateDateRange(startDateInput, endDateInput)) {
                    hideLoading();
                    return;
                }
                
                validComparisonPeriods.push({
                    startDate: startDateInput.value,
                    endDate: endDateInput.value
                });
            }
        }
        
        if (validComparisonPeriods.length > 0) {
            loadCustomComparisonData({
                startDate,
                endDate
            }, validComparisonPeriods);
            return;
        }
        
        const params = new URLSearchParams();
        params.append('periodType', 'custom');
        params.append('startDate', startDate);
        params.append('endDate', endDate);
        params.append('isDetailed', state.dataType === 'detailed');
        
        fetch(`/api/table-data?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Ошибка HTTP: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    state.currentData = data.data;
                    renderTableData(data.data, 'custom');
                    showNotification('success', 'Данные успешно загружены');
                } else {
                    throw new Error(data.message || 'Ошибка загрузки данных');
                }
            })
            .catch(error => {
                showNotification('error', `Ошибка загрузки данных: ${error.message}`);
                renderEmptyTable('custom');
            })
            .finally(() => {
                hideLoading();
            });
    }
    
    /**
     * Загружает данные для сравнения произвольных периодов
     */
    function loadCustomComparisonData(mainPeriod, comparisonPeriods) {
        try {
            const mainParams = new URLSearchParams();
            mainParams.append('periodType', 'custom');
            mainParams.append('startDate', mainPeriod.startDate);
            mainParams.append('endDate', mainPeriod.endDate);
            mainParams.append('isDetailed', state.dataType === 'detailed');
            
            const mainRequest = fetch(`/api/table-data?${mainParams.toString()}`).then(resp => resp.json());
            
            const comparisonRequests = comparisonPeriods.map((period, index) => {
                const params = new URLSearchParams();
                params.append('periodType', 'custom');
                params.append('startDate', period.startDate);
                params.append('endDate', period.endDate);
                params.append('isDetailed', state.dataType === 'detailed');
                
                return fetch(`/api/table-data?${params.toString()}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            const startDateObj = new Date(period.startDate);
                            const endDateObj = new Date(period.endDate);
                            const dateRange = `${startDateObj.toLocaleDateString()} - ${endDateObj.toLocaleDateString()}`;
                            
                            return {
                                data: data.data,
                                period: index + 1,
                                date: dateRange,
                                color: getComparisonColor(index),
                                isMainPeriod: false
                            };
                        } else {
                            throw new Error(data.message || 'Ошибка загрузки данных сравнения');
                        }
                    });
            });
            
            Promise.all([mainRequest, ...comparisonRequests])
                .then(results => {
                    const mainResult = results[0];
                    const comparisonResults = results.slice(1);
                    
                    if (!mainResult.success) {
                        throw new Error(mainResult.message || 'Ошибка загрузки данных основного периода');
                    }
                    
                    const startDateObj = new Date(mainPeriod.startDate);
                    const endDateObj = new Date(mainPeriod.endDate);
                    const mainPeriodText = `${startDateObj.toLocaleDateString()} - ${endDateObj.toLocaleDateString()}`;
                    
                    const allResults = [
                        {
                            data: mainResult.data,
                            period: 0,
                            date: mainPeriodText,
                            color: chartColors.primary,
                            isMainPeriod: true
                        },
                        ...comparisonResults
                    ];
                    
                    state.currentData = allResults;
                    state.periodType = 'custom-comparison';
                    
                    renderCustomComparisonTables(allResults);
                    showNotification('success', 'Данные для сравнения успешно загружены');
                })
                .catch(error => {
                    showNotification('error', `Ошибка загрузки данных для сравнения: ${error.message}`);
                    renderEmptyTable('custom');
                })
                .finally(() => {
                    hideLoading();
                });
        } catch (error) {
            showNotification('error', `Ошибка обработки запроса: ${error.message}`);
            hideLoading();
        }
    }
    
    /**
     * Отображает таблицу с данными
     */
        function renderTableData(data, periodType) {
        const tableBody = document.querySelector('#data-table tbody');
        if (!tableBody) return;
        
        // Обновляем заголовок таблицы
        updateTableHeader(periodType);
        
        tableBody.innerHTML = '';
        
        data.forEach(row => {
            const tr = document.createElement('tr');
            
            let slClass = '';
            if (row.sl_result !== null) {
                slClass = row.sl_result >= 80 ? 'sl-good' : 'sl-bad';
            }
            
            // Проверяем, является ли строка итоговой
            const isTotal = row.report_date === 'Итого' || 
                        (typeof row.report_date === 'string' && row.report_date.includes('Итого'));
            
            if (isTotal) {
                tr.className = 'total-row';
            }
            
            if (periodType === 'hour') {
                // Для часового периода включаем колонку часа
                tr.innerHTML = `
                    <td>${formatPeriodDate(row.report_date, periodType)}</td>
                    <td>${row.report_hour || ''}</td>
                    <td>${formatNumber(row.received_calls)}</td>
                    <td class="${slClass}">${formatValue(row.sl_result)}%</td>
                    <td>${formatSatisfactionValue(row.ics_result)}</td>
                    <td>${formatValue(row.awt_result)}</td>
                    <td>${formatValue(row.aht_result)}</td>
                `;
            } else {
                // Для остальных типов периодов стандартная структура
                tr.innerHTML = `
                    <td>${formatPeriodDate(row.report_date, periodType)}</td>
                    <td>${formatNumber(row.received_calls)}</td>
                    <td class="${slClass}">${formatValue(row.sl_result)}%</td>
                    <td>${formatSatisfactionValue(row.ics_result)}</td>
                    <td>${formatValue(row.awt_result)}</td>
                    <td>${formatValue(row.aht_result)}</td>
                `;
            }
            
            tableBody.appendChild(tr);
        });
        
        // Специальная обработка для часового периода с одной записью
        if (periodType === 'hour' && data.length === 1 && state.hourRange) {
            const hourCell = elements.dataTableBody.querySelector('tr td:nth-child(2)');
            if (hourCell && !hourCell.textContent.includes('Итого')) {
                const startTime = state.hourRange.startDateTime.toTimeString().substring(0, 5);
                const endTime = state.hourRange.endDateTime.toTimeString().substring(0, 5);
                hourCell.textContent = `с ${startTime} по ${endTime}`;
            }
        }
        
        // Специальная обработка для месячного периода с несколькими месяцами
        if (periodType === 'month' && data.length === 1 && state.selectedMonths && state.selectedMonths.length > 1) {
            const dateCell = elements.dataTableBody.querySelector('tr td:first-child');
            if (dateCell && !dateCell.textContent.includes('Итого')) {
                dateCell.textContent = "Сумма за выбранные месяцы";
            }
        }
        
        initTableSorting();
        
        if (elements.comparisonsContainer) {
            elements.comparisonsContainer.style.display = 'none';
        }
        
        if (elements.dataTable) {
            elements.dataTable.closest('.table-responsive').style.display = '';
        }
        
        if (elements.chartContainer && elements.chartContainer.classList.contains('active')) {
            showChart();
        }
    }
        
    /**
     * Отображает таблицы для сравнения часовых периодов
     */
        function renderHourlyComparisonTables(results) {
        if (!elements.comparisonsContainer) return;
        
        elements.comparisonsContainer.innerHTML = '';
        
        if (elements.dataTable) {
            elements.dataTable.closest('.table-responsive').style.display = 'none';
        }
        
        elements.comparisonsContainer.style.display = 'block';
        
        if (!results || results.length === 0) {
            elements.comparisonsContainer.innerHTML = '<div class="no-data-message">Нет данных для сравнения</div>';
            hideLoading();
            return;
        }
        
        const tablesWrapper = document.createElement('div');
        tablesWrapper.className = 'comparison-tables-wrapper';
        
        const legendContainer = document.createElement('div');
        legendContainer.className = 'comparison-legend';
        
        results.sort((a, b) => {
            if (a.isMainPeriod) return -1;
            if (b.isMainPeriod) return 1;
            return (a.period || 1) - (b.period || 1);
        });
        
        results.forEach(result => {
            const { date, color, isMainPeriod } = result;
            
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `
                <span class="legend-color" style="background-color: ${color};"></span>
                <span class="legend-label">${date}${isMainPeriod ? ' (основной период)' : ''}</span>
            `;
            
            legendContainer.appendChild(legendItem);
        });
        
        tablesWrapper.appendChild(legendContainer);
        
        results.forEach(result => {
            const { data, date, color, isMainPeriod } = result;
            
            if (!data || data.length === 0) return;
            
            const periodHeader = document.createElement('h3');
            periodHeader.className = 'comparison-table-header';
            periodHeader.style.borderLeftColor = color;
            periodHeader.textContent = isMainPeriod ? `${date} (основной период)` : date;
            
            const tableContainer = document.createElement('div');
            tableContainer.className = 'table-responsive';
            
            const table = document.createElement('table');
            table.className = 'data-table comparison-table';
            
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Дата</th>
                    <th>Час</th>
                    <th>Количество вызовов</th>
                    <th>Service Level (%)</th>
                    <th>Удовлетворенность</th>
                    <th>Время ожидания (сек)</th>
                    <th>AHT (сек)</th>
                </tr>
            `;
            
            const tbody = document.createElement('tbody');
            
            const tableData = state.dataType === 'detailed' 
                ? data.filter(row => row.report_date !== 'Итого')
                : data;
            
            tableData.forEach(row => {
                const tr = document.createElement('tr');
                
                if (row.report_date === 'Итого') {
                    tr.className = 'total-row';
                }
                
                const slClass = row.sl_result !== null 
                    ? (row.sl_result >= 80 ? 'sl-good' : 'sl-bad') 
                    : '';
                
                tr.innerHTML = `
                    <td>${formatPeriodDate(row.report_date, 'hour')}</td>
                    <td>${row.report_hour || ''}</td>
                    <td>${formatNumber(row.received_calls)}</td>
                    <td class="${slClass}">${formatValue(row.sl_result)}${row.sl_result !== null ? '%' : ''}</td>
                    <td>${formatSatisfactionValue(row.ics_result)}</td>
                    <td>${formatValue(row.awt_result)}</td>
                    <td>${formatValue(row.aht_result)}</td>
                `;
                
                tbody.appendChild(tr);
            });
            
            table.appendChild(thead);
            table.appendChild(tbody);
            tableContainer.appendChild(table);
            
            const tableWrapper = document.createElement('div');
            tableWrapper.appendChild(periodHeader);
            tableWrapper.appendChild(tableContainer);
            
            tablesWrapper.appendChild(tableWrapper);
        });
        
        elements.comparisonsContainer.appendChild(tablesWrapper);
        
        hideLoading();
        
        if (elements.chartContainer && elements.chartContainer.classList.contains('active')) {
            showChart();
        }
    }
    
    /**
     * Отображает таблицы для сравнения произвольных периодов
     */
    function renderCustomComparisonTables(results) {
        if (!elements.comparisonsContainer) return;
        
        elements.comparisonsContainer.innerHTML = '';
        
        if (elements.dataTable) {
            elements.dataTable.closest('.table-responsive').style.display = 'none';
        }
        
        elements.comparisonsContainer.style.display = 'block';
        
        if (!results || results.length === 0) {
            elements.comparisonsContainer.innerHTML = '<div class="no-data-message">Нет данных для сравнения</div>';
            hideLoading();
            return;
        }
        
        const tablesWrapper = document.createElement('div');
        tablesWrapper.className = 'comparison-tables-wrapper';
        
        const legendContainer = document.createElement('div');
        legendContainer.className = 'comparison-legend';
        
        results.sort((a, b) => {
            if (a.isMainPeriod) return -1;
            if (b.isMainPeriod) return 1;
            return (a.period || 1) - (b.period || 1);
        });
        
        results.forEach(result => {
            const { date, color, isMainPeriod } = result;
            
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `
                <span class="legend-color" style="background-color: ${color};"></span>
                <span class="legend-label">${date}${isMainPeriod ? ' (основной период)' : ''}</span>
            `;
            
            legendContainer.appendChild(legendItem);
        });
        
        tablesWrapper.appendChild(legendContainer);
        
        results.forEach(result => {
            const { data, date, color, isMainPeriod } = result;
            
            if (!data || data.length === 0) return;
            
            const periodHeader = document.createElement('h3');
            periodHeader.className = 'comparison-table-header';
            periodHeader.style.borderLeftColor = color;
            periodHeader.textContent = isMainPeriod ? `${date} (основной период)` : date;
            
            const tableContainer = document.createElement('div');
            tableContainer.className = 'table-responsive';
            
            const table = document.createElement('table');
            table.className = 'data-table comparison-table';
            
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Период</th>
                    <th>Количество вызовов</th>
                    <th>Service Level (%)</th>
                    <th>Удовлетворенность</th>
                    <th>Время ожидания (сек)</th>
                    <th>AHT (сек)</th>
                </tr>
            `;
            
            const tbody = document.createElement('tbody');
            
            const tableData = state.dataType === 'detailed' 
                ? data.filter(row => row.report_date !== 'Итого')
                : data;
            
            tableData.forEach(row => {
                const tr = document.createElement('tr');
                
                if (row.report_date === 'Итого') {
                    tr.className = 'total-row';
                }
                
                const slClass = row.sl_result !== null 
                    ? (row.sl_result >= 80 ? 'sl-good' : 'sl-bad') 
                    : '';
                
                tr.innerHTML = `
                    <td>${formatPeriodDate(row.report_date, 'custom')}</td>
                    <td>${formatNumber(row.received_calls)}</td>
                    <td class="${slClass}">${formatValue(row.sl_result)}${row.sl_result !== null ? '%' : ''}</td>
                    <td>${formatSatisfactionValue(row.ics_result)}</td>
                    <td>${formatValue(row.awt_result)}</td>
                    <td>${formatValue(row.aht_result)}</td>
                `;
                
                tbody.appendChild(tr);
            });
            
            table.appendChild(thead);
            table.appendChild(tbody);
            tableContainer.appendChild(table);
            
            const tableWrapper = document.createElement('div');
            tableWrapper.appendChild(periodHeader);
            tableWrapper.appendChild(tableContainer);
            
            tablesWrapper.appendChild(tableWrapper);
        });
        
        elements.comparisonsContainer.appendChild(tablesWrapper);
        
        hideLoading();
        
        if (elements.chartContainer && elements.chartContainer.classList.contains('active')) {
            showChart();
        }
    }
    
    /**
     * Отображает пустую таблицу
     */
    function renderEmptyTable(periodType) {
        if (!elements.dataTableBody) return;
        
        updateTableHeader(periodType);
        
        const columnCount = periodType === 'hour' ? 6 : 5;
        
        elements.dataTableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="${columnCount}">Нет данных за выбранный период</td>
            </tr>
        `;
        
        if (elements.comparisonsContainer) {
            elements.comparisonsContainer.style.display = 'none';
        }
        
        if (elements.dataTable) {
            elements.dataTable.closest('.table-responsive').style.display = '';
        }
        
        hideLoading();
    }
    
    /**
     * Обновляет заголовок таблицы в зависимости от типа периода
     */
    function updateTableHeader(periodType) {
    if (!elements.dataTable) return;
    
    const headerRow = elements.dataTable.querySelector('thead tr');
    if (!headerRow) return;
    
    // Очищаем заголовки и создаем заново
    headerRow.innerHTML = '';
    
    // Создаем заголовки в зависимости от типа периода
    if (periodType === 'hour') {
        // Для часового периода добавляем колонку "Час"
        headerRow.innerHTML = `
            <th class="sortable" data-sort="date">Дата</th>
            <th class="sortable" data-sort="hour" data-column="hour">Час</th>
            <th class="sortable" data-sort="calls">Количество вызовов</th>
            <th class="sortable" data-sort="servicelevel">Service Level (%)</th>
            <th class="sortable" data-sort="satisfaction">Удовлетворенность</th>
            <th class="sortable" data-sort="waittime">Время ожидания (сек)</th>
            <th class="sortable" data-sort="aht">AHT (сек)</th>
        `;
    } else {
        // Для остальных типов периодов стандартные заголовки
        let firstHeaderText;
        switch (periodType) {
            case 'month': firstHeaderText = 'Месяц'; break;
            case 'year': firstHeaderText = 'Год'; break;
            case 'custom': firstHeaderText = 'Период'; break;
            default: firstHeaderText = 'Дата';
        }
        
        headerRow.innerHTML = `
            <th class="sortable" data-sort="date">${firstHeaderText}</th>
            <th class="sortable" data-sort="calls">Количество вызовов</th>
            <th class="sortable" data-sort="servicelevel">Service Level (%)</th>
            <th class="sortable" data-sort="satisfaction">Удовлетворенность</th>
            <th class="sortable" data-sort="waittime">Время ожидания (сек)</th>
            <th class="sortable" data-sort="aht">AHT (сек)</th>
        `;
    }
}
    
    /**
     * Инициализирует сортировку таблицы
     */
    function initTableSorting() {
        const table = elements.dataTable;
        if (!table) return;
        
        const headerCells = table.querySelectorAll('th.sortable');
        
        headerCells.forEach(cell => {
            const newCell = cell.cloneNode(true);
            cell.parentNode.replaceChild(newCell, cell);
            
            newCell.addEventListener('click', function() {
                sortTable(this);
            });
        });
    }
    
    /**
     * Сортирует таблицу по указанному столбцу
     */
    function sortTable(headerCell) {
        if (!elements.dataTable) return;
        
        const sortDirection = headerCell.classList.contains('sorted-asc') ? 'desc' : 'asc';
        const columnIndex = Array.from(headerCell.parentNode.children).indexOf(headerCell);
        
        const tbody = elements.dataTable.querySelector('tbody');
        if (!tbody) return;
        
        const rows = Array.from(tbody.querySelectorAll('tr:not(.no-data-row)'));
        
        elements.dataTable.querySelectorAll('th').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
        });
        
        headerCell.classList.add(`sorted-${sortDirection}`);
        
        const totalRows = rows.filter(row => row.classList.contains('total-row'));
        const dataRows = rows.filter(row => !row.classList.contains('total-row'));
        
        dataRows.sort((a, b) => {
            const cellA = a.cells[columnIndex];
            const cellB = b.cells[columnIndex];
            
            if (!cellA || !cellB) return 0;
            
            let valueA, valueB;
            
            if (headerCell.dataset.sort === 'calls' || 
                headerCell.dataset.sort === 'servicelevel' || 
                headerCell.dataset.sort === 'satisfaction' || 
                headerCell.dataset.sort === 'waittime' ||
                headerCell.dataset.sort === 'aht') {
                valueA = parseFloat(cellA.textContent.replace(/[^\d.-]/g, '')) || 0;
                valueB = parseFloat(cellB.textContent.replace(/[^\d.-]/g, '')) || 0;
            }
            else if (headerCell.dataset.sort === 'date') {
                valueA = parseDate(cellA.textContent) || 0;
                valueB = parseDate(cellB.textContent) || 0;
            }
            else if (headerCell.dataset.sort === 'hour') {
                valueA = parseInt(cellA.textContent.match(/\d+/) || '0');
                valueB = parseInt(cellB.textContent.match(/\d+/) || '0');
            }
            else {
                valueA = cellA.textContent.trim().toLowerCase();
                valueB = cellB.textContent.trim().toLowerCase();
            }
            
            const factor = sortDirection === 'asc' ? 1 : -1;
            
            if (valueA < valueB) return -1 * factor;
            if (valueA > valueB) return 1 * factor;
            return 0;
        });
        
        tbody.innerHTML = '';
        
        dataRows.forEach(row => {
            tbody.appendChild(row);
        });
        
        totalRows.forEach(row => {
            tbody.appendChild(row);
        });
    }
    
    /**
     * Показывает/скрывает график
     */
    function toggleChart() {
        if (elements.chartContainer && elements.chartContainer.classList.contains('active')) {
            hideChart();
        } else {
            showChart();
        }
    }
    
    /**
     * Показывает график
     */
    function showChart() {
        if (!elements.chartContainer) {
            showNotification(NOTIFICATION_TYPES.ERROR, 'Ошибка при отображении графика: контейнер не найден');
            return;
        }
        
        elements.chartContainer.classList.add('active');
        
        let chartWrapper = elements.chartContainer.querySelector('.chart-wrapper');
        if (!chartWrapper) {
            elements.chartContainer.innerHTML = `
                <div class="chart-header">
                    <h3>Динамика показателей</h3>
                    <button type="button" id="closeChartBtn" class="close-chart-btn">×</button>
                </div>
                <div class="chart-wrapper"></div>
            `;
            chartWrapper = elements.chartContainer.querySelector('.chart-wrapper');
            
            const closeBtn = elements.chartContainer.querySelector('#closeChartBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', hideChart);
            }
        }
        
        chartWrapper.innerHTML = '<div id="vertical-charts-container" class="vertical-charts-container"></div>';
        
        if (elements.toggleChartBtn) {
            elements.toggleChartBtn.innerHTML = '<i class="fas fa-table"></i> Таблица';
            elements.toggleChartBtn.classList.add('active');
        }
        
        if (['hour-comparison', 'custom-comparison', 'year-comparison'].includes(state.periodType)) {
            // Таблицы сравнений остаются видимыми
        } else if (elements.dataTable) {
            elements.dataTable.closest('.table-responsive').style.display = 'none';
        }
        
        showChartLoading();
        
        if (!state.currentData || (Array.isArray(state.currentData) && state.currentData.length === 0)) {
            hideChartLoading();
            showChartError('Нет данных для построения графика');
            return;
        }
        
        setTimeout(() => {
            try {
                loadChartLibraries()
                    .then(() => {
                        updateChart(state.currentData, state.periodType);
                    })
                    .catch(error => {
                        hideChartLoading();
                        showChartError(`Ошибка загрузки библиотек для графика: ${error.message || 'неизвестная ошибка'}`);
                    });
            } catch (error) {
                hideChartLoading();
                showChartError(`Непредвиденная ошибка: ${error.message || 'неизвестная ошибка'}`);
            }
        }, 100);
        
        clearTimeout(window.chartLoadingTimeout);
        window.chartLoadingTimeout = setTimeout(() => {
            hideChartLoading();
            
            if (!document.querySelector('#vertical-charts-container canvas')) {
                showChartError('Превышено время ожидания загрузки графика');
            }
        }, 15000);
    }
    
    /**
     * Скрывает график
     */
        function hideChart() {
        if (!elements.chartContainer) return;
        
        elements.chartContainer.classList.remove('active');
        
        if (elements.toggleChartBtn) {
            elements.toggleChartBtn.innerHTML = '<i class="fas fa-chart-bar"></i> График';
            elements.toggleChartBtn.classList.remove('active');
        }
        
        if (elements.dataTable) {
            elements.dataTable.closest('.table-responsive').style.display = '';
        }
        
        // Уничтожаем все графики
        if (state.charts) {
            Object.keys(state.charts).forEach(chartKey => {
                if (state.charts[chartKey]) {
                    try {
                        state.charts[chartKey].destroy();
                    } catch (e) {
                        console.warn(`Ошибка при уничтожении графика ${chartKey}:`, e);
                    }
                }
            });
            state.charts = {};
        }
        
        // Устаревший график
        if (state.chart) {
            try {
                state.chart.destroy();
            } catch (e) {
                console.warn('Ошибка при уничтожении старого графика:', e);
            }
            state.chart = null;
        }
    }

    /**
     * Загружает библиотеки для графиков с альтернативными источниками в случае сбоя
     */
    function loadChartLibraries() {
        return new Promise((resolve, reject) => {
            if (typeof Chart !== 'undefined') {
                if (typeof window.ChartDataLabels !== 'undefined') {
                    if (Chart.register && !Chart.registry.plugins.get('datalabels')) {
                        try {
                            Chart.register(window.ChartDataLabels);
                        } catch (e) {
                            console.warn('Ошибка при регистрации плагина ChartDataLabels:', e);
                        }
                    }
                    
                    resolve();
                    return;
                }
                
                loadChartDataLabelsWithFallback()
                    .then(() => {
                        if (Chart.register && typeof window.ChartDataLabels !== 'undefined') {
                            try {
                                Chart.register(window.ChartDataLabels);
                            } catch (e) {
                                console.warn('Ошибка при регистрации плагина ChartDataLabels:', e);
                            }
                        }
                        resolve();
                    })
                    .catch(err => {
                        console.warn('Не удалось загрузить плагин ChartDataLabels:', err);
                        resolve();
                    });
                
                return;
            }
            
            loadChartJsWithFallback()
                .then(() => {
                    return loadChartDataLabelsWithFallback();
                })
                .then(() => {
                    if (Chart.register && typeof window.ChartDataLabels !== 'undefined') {
                        try {
                            Chart.register(window.ChartDataLabels);
                        } catch (e) {
                            console.warn('Ошибка при регистрации плагина ChartDataLabels:', e);
                        }
                    }
                    resolve();
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    /**
     * Загружает Chart.js с использованием резервных источников
     */
    function loadChartJsWithFallback() {
        return new Promise((resolve, reject) => {
            const chartJsSources = [
                'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
                'https://unpkg.com/chart.js@3.9.1/dist/chart.min.js',
                '/assets/js/vendor/chart.min.js'
            ];
            
            loadScriptWithFallback(chartJsSources, 'Chart.js')
                .then(() => {
                    if (typeof Chart === 'undefined') {
                        reject(new Error('Chart.js загружен, но объект Chart не определен'));
                    } else {
                        resolve();
                    }
                })
                .catch(reject);
        });
    }

    /**
     * Загружает плагин ChartDataLabels с использованием резервных источников
     */
    function loadChartDataLabelsWithFallback() {
        return new Promise((resolve, reject) => {
            const dataLabelsSources = [
                'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0/dist/chartjs-plugin-datalabels.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-datalabels/2.0.0/chartjs-plugin-datalabels.min.js',
                'https://unpkg.com/chartjs-plugin-datalabels@2.0.0/dist/chartjs-plugin-datalabels.min.js',
                '/assets/js/vendor/chartjs-plugin-datalabels.min.js'
            ];
            
            loadScriptWithFallback(dataLabelsSources, 'ChartDataLabels')
                .then(() => {
                    resolve();
                })
                .catch(error => {
                    console.warn('Не удалось загрузить плагин ChartDataLabels:', error);
                    resolve();
                });
        });
    }

    /**
     * Загружает скрипт с использованием резервных источников
     */
    function loadScriptWithFallback(sources, libraryName) {
        return new Promise((resolve, reject) => {
            if (!sources || sources.length === 0) {
                reject(new Error(`Нет источников для загрузки ${libraryName}`));
                return;
            }
            
            tryLoadScript(sources, 0, libraryName, resolve, reject);
        });
    }

    /**
     * Рекурсивно пробует загрузить скрипт из списка источников
     */
    function tryLoadScript(sources, index, libraryName, resolve, reject) {
        if (index >= sources.length) {
            reject(new Error(`Не удалось загрузить ${libraryName} из всех доступных источников`));
            return;
        }
        
        const url = sources[index];
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        
        script.onload = () => {
            resolve();
        };
        
        script.onerror = () => {
            tryLoadScript(sources, index + 1, libraryName, resolve, reject);
        };
        
        document.head.appendChild(script);
    }
    
    /**
     * Обновляет график с новыми данными
     */
    function updateChart(data, periodType) {
        if (!data || (Array.isArray(data) && data.length === 0)) {
            hideChartLoading();
            showChartError('Нет данных для построения графика');
            return;
        }

        if (periodType.endsWith('-comparison')) {
            if (!Array.isArray(data) || data.some(item => !item || !item.data)) {
                hideChartLoading();
                showChartError('Ошибка структуры данных для графика');
                return;
            }
        }
        
        const container = document.getElementById('vertical-charts-container');
        if (!container) {
            hideChartLoading();
            showChartError('Ошибка инициализации графика: контейнер не найден');
            return;
        }
        
        if (state.charts) {
            for (const chartId in state.charts) {
                if (state.charts[chartId]) {
                    try {
                        state.charts[chartId].destroy();
                    } catch (e) {
                        console.warn(`Ошибка при уничтожении графика ${chartId}:`, e);
                    }
                }
            }
            state.charts = {};
        }
        
        setTimeout(() => {
            try {
                if (periodType === 'hour-comparison' || periodType === 'custom-comparison' || periodType === 'year-comparison') {
                    createVerticalDetailedComparisonCharts(data);
                } else if (periodType === 'hour' && state.dataType === 'detailed') {
                    createVerticalDetailedHourlyCharts(data);
                } else if (periodType === 'custom' && state.dataType === 'detailed') {
                    createVerticalDetailedCustomCharts(data);
                } else {
                    createVerticalStandardCharts(data, periodType);
                }
            } catch (error) {
                hideChartLoading();
                showChartError(`Ошибка при создании графика: ${error.message}`);
            }
        }, 100);
    }

/**
 * Сравнительный график "Удовлетворенность" для нескольких периодов
 */
function createDetailedSatisfactionComparisonChart(periodsData) {
    const canvas = document.getElementById('satisfaction-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const chartType = state.chartTypes.satisfaction || 'line';

    // Находим максимальное количество точек среди сравниваемых периодов
    let maxDataLength = 0;
    periodsData.forEach(period => {
        if (period.data && period.data.length > maxDataLength) {
            maxDataLength = period.data.length;
        }
    });

    // Генерируем метки по дням/датам
    const labels = [];
    for (let i = 0; i < maxDataLength; i++) {
        // Берём из главного периода, если есть, иначе — первого доступного
        let label = '';
        const mainPeriod = periodsData.find(p => p.isMainPeriod) || periodsData[0];
        if (mainPeriod && mainPeriod.data[i]) {
            label = formatPeriodDate(mainPeriod.data[i].report_date, state.periodType.replace('-comparison', ''));
        } else {
            // Иначе ищем где-то ещё
            for (let p of periodsData) {
                if (p.data[i]) {
                    label = formatPeriodDate(p.data[i].report_date, state.periodType.replace('-comparison', ''));
                    break;
                }
            }
        }
        labels.push(label);
    }

    // Формируем датасеты для каждого периода
    const datasets = periodsData.map(period => {
        const data = [];
        for (let i = 0; i < maxDataLength; i++) {
            data.push(period.data[i] ? period.data[i].ics_result : null);
        }
        return {
            label: period.label,
            data,
            backgroundColor: adjustColorOpacity(period.color, 0.7),
            borderColor: period.color,
            borderWidth: 3,
            type: chartType,
            fill: false,
            tension: 0.1,
            pointRadius: 4,
            pointBackgroundColor: period.color,
        };
    });

    // Уничтожаем предыдущий график, если есть
    if (state.charts && state.charts.satisfactionChart) {
        state.charts.satisfactionChart.destroy();
    }

    state.charts.satisfactionChart = new Chart(ctx, {
        type: chartType,
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(item) {
                            const value = item.raw;
                            return `${item.dataset.label}: ${formatSatisfactionValue(value)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 5,
                    title: { display: true, text: "Удовлетворенность" },
                    ticks: {
                        callback: function(value) {
                            return formatSatisfactionValue(value);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Сравнительный график "Время ожидания" для нескольких периодов
 */
function createDetailedWaitTimeComparisonChart(periodsData) {
    const canvas = document.getElementById('wait-time-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const chartType = state.chartTypes.waitTime || 'line';

    // Находим максимальное количество точек среди сравниваемых периодов
    let maxDataLength = 0;
    periodsData.forEach(period => {
        if (period.data && period.data.length > maxDataLength) {
            maxDataLength = period.data.length;
        }
    });

    // Генерируем метки по дням/датам
    const labels = [];
    for (let i = 0; i < maxDataLength; i++) {
        let label = '';
        const mainPeriod = periodsData.find(p => p.isMainPeriod) || periodsData[0];
        if (mainPeriod && mainPeriod.data[i]) {
            label = formatPeriodDate(mainPeriod.data[i].report_date, state.periodType.replace('-comparison', ''));
        } else {
            for (let p of periodsData) {
                if (p.data[i]) {
                    label = formatPeriodDate(p.data[i].report_date, state.periodType.replace('-comparison', ''));
                    break;
                }
            }
        }
        labels.push(label);
    }

    // Формируем датасеты для каждого периода
    const datasets = periodsData.map(period => {
        const data = [];
        for (let i = 0; i < maxDataLength; i++) {
            data.push(period.data[i] ? period.data[i].awt_result : null);
        }
        return {
            label: period.label,
            data,
            backgroundColor: adjustColorOpacity(period.color, 0.7),
            borderColor: period.color,
            borderWidth: 3,
            type: chartType,
            fill: false,
            tension: 0.1,
            pointRadius: 4,
            pointBackgroundColor: period.color,
        };
    });

    // Уничтожаем предыдущий график, если есть
    if (state.charts && state.charts.waitTimeChart) {
        state.charts.waitTimeChart.destroy();
    }

    state.charts.waitTimeChart = new Chart(ctx, {
        type: chartType,
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(item) {
                            const value = item.raw;
                            return `${item.dataset.label}: ${formatValue(value)} сек`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Время ожидания (сек)" },
                    ticks: {
                        callback: function(value) {
                            return formatValue(value) + ' с';
                        }
                    }
                }
            }
        }
    });
}

    /**
     * Создает детальные графики для сравнения периодов
     */
    function createVerticalDetailedComparisonCharts(results) {
        if (!Array.isArray(results) || results.length === 0) {
            showChartError('Нет данных для графика сравнения');
            hideChartLoading();
            return;
        }
        
        setupVerticalChartContainer();
        
        results.sort((a, b) => {
            if (a.isMainPeriod) return -1;
            if (b.isMainPeriod) return 1;
            return (a.period || 1) - (b.period || 1);
        });
        
        const periodsData = [];
        
        results.forEach((result, index) => {
            const data = result.data;
            if (!data || data.length === 0) return;
            
            const filteredData = state.dataType === 'detailed' 
                ? data.filter(row => row.report_date !== 'Итого')
                : data;
            
            if (filteredData.length === 0) return;
            
            const color = getComparisonColor(index, result.isMainPeriod);
            
            // ИСПРАВЛЯЕМ: Получаем реальные даты из данных
            let realDateLabel = '';
            
            if (state.periodType.startsWith('custom')) {
                // Для произвольного периода берем первую и последнюю дату
                const sortedData = [...filteredData].sort((a, b) => {
                    const dateA = new Date(a.report_date.split('.').reverse().join('-'));
                    const dateB = new Date(b.report_date.split('.').reverse().join('-'));
                    return dateA - dateB;
                });
                
                const firstRow = sortedData[0];
                const lastRow = sortedData[sortedData.length - 1];
                
                if (firstRow && lastRow && sortedData.length > 1) {
                    const startDate = formatPeriodDate(firstRow.report_date, 'custom');
                    const endDate = formatPeriodDate(lastRow.report_date, 'custom');
                    
                    // Форматируем красиво
                    if (startDate === endDate) {
                        realDateLabel = startDate;
                    } else {
                        // Проверяем, один ли это месяц
                        const startParts = startDate.split('.');
                        const endParts = endDate.split('.');
                        
                        if (startParts.length === 3 && endParts.length === 3) {
                            if (startParts[2] === endParts[2] && startParts[1] === endParts[1]) {
                                // Один месяц
                                realDateLabel = `${startParts[0]}-${endParts[0]}.${startParts[1]}.${startParts[2]}`;
                            } else if (startParts[2] === endParts[2]) {
                                // Один год
                                realDateLabel = `${startParts[0]}.${startParts[1]}-${endParts[0]}.${endParts[1]}.${startParts[2]}`;
                            } else {
                                // Разные годы
                                realDateLabel = `${startDate} — ${endDate}`;
                            }
                        } else {
                            realDateLabel = `${startDate} — ${endDate}`;
                        }
                    }
                } else if (firstRow) {
                    realDateLabel = formatPeriodDate(firstRow.report_date, 'custom');
                }
            } else if (state.periodType.startsWith('hour')) {
                // Для часового периода
                const firstRow = filteredData[0];
                const lastRow = filteredData[filteredData.length - 1];
                
                if (firstRow && lastRow) {
                    const startDate = formatPeriodDate(firstRow.report_date, 'hour');
                    const endDate = formatPeriodDate(lastRow.report_date, 'hour');
                    const startHour = firstRow.report_hour ? firstRow.report_hour.match(/^\d+/)?.[0] : '0';
                    const endHour = lastRow.report_hour ? lastRow.report_hour.match(/^\d+/)?.[0] : '23';
                    
                    if (startDate === endDate) {
                        realDateLabel = `${startDate} (${startHour}:00-${endHour}:00)`;
                    } else {
                        realDateLabel = `${startDate} ${startHour}:00 — ${endDate} ${endHour}:00`;
                    }
                }
            } else {
                // Для остальных типов используем исходный label, но очищаем его
                realDateLabel = result.date || result.label || `Период ${result.period}`;
                
                // Убираем технические части
                realDateLabel = realDateLabel
                    .replace(' (основной период)', '')
                    .replace(' (сравнение)', '')
                    .replace(/\s*\+\s*#[A-Fa-f0-9]{6}/, ''); // Убираем цветовые коды
            }
            
            periodsData.push({
                label: realDateLabel,
                color: color,
                isMainPeriod: result.isMainPeriod,
                data: filteredData
            });
        });
        
        createComparisonLegend(periodsData);
        
        createDetailedCallsComparisonChart(periodsData);
        createDetailedServiceLevelComparisonChart(periodsData);
        createDetailedSatisfactionComparisonChart(periodsData);
        createDetailedWaitTimeComparisonChart(periodsData);       
        hideChartLoading();
    }

    /**
     * Создает детальные графики для часовых данных
     */
        function createVerticalDetailedHourlyCharts(data) {
        const chartData = data.filter(row => row.report_date !== 'Итого');
        
        if (chartData.length === 0) {
            showChartError('Нет детализированных данных для графика');
            hideChartLoading();
            return;
        }
        
        setupVerticalChartContainer();
        
        const sortedData = sortChartData(chartData, 'hour');
        
        // ИСПРАВЛЯЕМ: для детальных данных в часовом режиме НЕ показываем дату
        const labels = sortedData.map(row => {
            if (state.dataType === 'detailed') {
                return `${row.report_hour ? (row.report_hour.match(/\d+/) ? row.report_hour.match(/\d+/)[0] + ':00' : row.report_hour) : 'Час'}`;
            } else {
                const date = formatPeriodDate(row.report_date, 'hour');
                const hour = row.report_hour ? row.report_hour.match(/\d+/) : '';
                return hour ? `${date} ${hour[0]}:00` : `${date} ${row.report_hour}`;
            }
        });
        
        createCallsChart(sortedData, labels, 'hour');
        createServiceLevelChart(sortedData, labels, 'hour');
        createSatisfactionChart(sortedData, labels, 'hour');
        createWaitTimeChart(sortedData, labels, 'hour');
        createAHTChart(sortedData, labels, 'hour');
        
        hideChartLoading();
    }
    
    /**
     * Создает детальные графики для произвольного периода
     */
        function createVerticalDetailedCustomCharts(data) {
        const chartData = data.filter(row => row.report_date !== 'Итого');
        
        if (chartData.length === 0) {
            showChartError('Нет детализированных данных для графика');
            hideChartLoading();
            return;
        }
        
        setupVerticalChartContainer();
        
        const sortedData = sortChartData(chartData, 'custom');
        
        // ИСПРАВЛЯЕМ: для детальных данных в произвольном режиме показываем реальные даты
        const labels = sortedData.map(row => {
            return formatPeriodDate(row.report_date, 'custom');
        });
        
        createCallsChart(sortedData, labels, 'custom');
        createServiceLevelChart(sortedData, labels, 'custom');
        createSatisfactionChart(sortedData, labels, 'custom');
        createWaitTimeChart(sortedData, labels, 'custom');
        createAHTChart(sortedData, labels, 'custom');
        
        hideChartLoading();
    }

    /**
     * Создает детальный график количества вызовов для сравнения (GROUPED BARS)
     */
/**
 * ИСПРАВЛЕННАЯ ФУНКЦИЯ: Убираем цифры и улучшаем заголовок
 */
function createDetailedCallsComparisonChart(periodsData) {

    if (!periodsData || periodsData.length === 0) {
        console.error('Нет данных периодов для графика');
        return;
    }
    
    const canvas = document.getElementById('calls-chart');
    if (!canvas) {
        console.error('Canvas calls-chart не найден');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const chartType = state.chartTypes.calls || 'bar';
    
    // Обрабатываем данные
    const processedPeriods = [];
    let maxDataLength = 0;
    
    periodsData.forEach((period, periodIndex) => {
        if (!period.data || period.data.length === 0) return;
        
        const sortedData = sortChartData(period.data, state.periodType.replace('-comparison', ''));
        const processedItems = [];
        
        sortedData.forEach((row, rowIndex) => {
            let dateLabel = '';
            
            if (state.dataType === 'detailed') {
                if (state.periodType.startsWith('custom')) {
                    dateLabel = formatPeriodDate(row.report_date, 'custom');
                } else if (state.periodType.startsWith('hour')) {
                    const hourMatch = row.report_hour ? row.report_hour.match(/\d+/) : null;
                    const hour = hourMatch ? hourMatch[0] + ':00' : (row.report_hour || 'Час');
                    dateLabel = hour;
                } else {
                    dateLabel = formatPeriodDate(row.report_date, state.periodType.replace('-comparison', ''));
                }
            } else {
                if (state.periodType.startsWith('hour')) {
                    const date = formatPeriodDate(row.report_date, 'hour');
                    const hourMatch = row.report_hour ? row.report_hour.match(/\d+/) : null;
                    const hour = hourMatch ? hourMatch[0] + ':00' : row.report_hour;
                    dateLabel = hour ? `${date} ${hour}` : `${date} ${row.report_hour}`;
                } else {
                    dateLabel = formatPeriodDate(row.report_date, state.periodType.replace('-comparison', ''));
                }
            }
            
            processedItems.push({
                position: rowIndex,
                dateLabel: dateLabel,
                value: row.received_calls || 0,
                originalDate: row.report_date,
                originalRow: row
            });
        });
        
        maxDataLength = Math.max(maxDataLength, processedItems.length);
        
        processedPeriods.push({
            originalPeriod: period,
            label: period.label,
            color: period.color,
            isMainPeriod: period.isMainPeriod,
            processedItems: processedItems,
            periodIndex: periodIndex
        });
    });
    
    if (processedPeriods.length === 0 || maxDataLength === 0) {
        console.error('Нет валидных данных для создания графика');
        return;
    }
    
    // ФУНКЦИЯ: Форматирование компактной даты БЕЗ ЦИФР
    function formatCompactDate(dateString) {
        if (!dateString) return '';
        
        try {
            // Если дата в формате DD.MM.YYYY
            if (dateString.includes('.')) {
                const parts = dateString.split('.');
                if (parts.length === 3) {
                    const day = parts[0];
                    const month = parts[1];
                    const year = parts[2];
                    
                    // Возвращаем формат БЕЗ года: DD.MM
                    return `${day}.${month}`;
                }
            }
            
            return dateString;
        } catch (error) {
            console.warn('Ошибка форматирования даты:', error);
            return dateString;
        }
    }
    
    // СОЗДАЕМ КОМПАКТНЫЕ КОМБИНИРОВАННЫЕ МЕТКИ БЕЗ ЦИФР
    const labels = [];
    const fullLabels = []; // Полные метки для tooltip
    const mainPeriod = processedPeriods.find(p => p.isMainPeriod);
    const comparisonPeriod = processedPeriods.find(p => !p.isMainPeriod);
    
    for (let position = 0; position < maxDataLength; position++) {
        const mainDate = mainPeriod && mainPeriod.processedItems[position] 
            ? mainPeriod.processedItems[position].dateLabel 
            : `День ${position + 1}`;
            
        const compDate = comparisonPeriod && comparisonPeriod.processedItems[position] 
            ? comparisonPeriod.processedItems[position].dateLabel 
            : `День ${position + 1}`;
        
        // Компактные метки для оси X БЕЗ ГОДА
        const mainCompact = formatCompactDate(mainDate);
        const compCompact = formatCompactDate(compDate);
        
        // Полные метки для tooltip
        const fullMainDate = mainDate;
        const fullCompDate = compDate;
        
        let compactLabel = '';
        let fullLabel = '';
        
        if (mainCompact === compCompact) {
            // Если даты одинаковые (без года)
            compactLabel = mainCompact;
            fullLabel = fullMainDate;
        } else {
            // Если разные - используем компактный формат БЕЗ СИМВОЛОВ
            if (maxDataLength > 15) {
                // Для большого количества данных - только дни
                compactLabel = `${mainCompact.split('.')[0]}/${compCompact.split('.')[0]}`; // 01/01
            } else {
                // Для нормального количества - день.месяц через пробел
                compactLabel = `${mainCompact} ${compCompact}`;
            }
            
            fullLabel = `${fullMainDate} ↔ ${fullCompDate}`;
        }
        
        labels.push(compactLabel);
        fullLabels.push(fullLabel);
    }
    
    console.log(`Создано компактных меток без цифр: ${labels.length}`);
    console.log('Примеры компактных меток:', labels.slice(0, 5));
    console.log('Примеры полных меток:', fullLabels.slice(0, 5));
    
    // СОЗДАЕМ КРАСИВЫЙ ЗАГОЛОВОК
    let axisTitle = getAxisTitle(state.periodType.replace('-comparison', ''));
    
    if (mainPeriod && comparisonPeriod) {
        // Извлекаем чистые названия периодов
        const mainLabel = mainPeriod.label
            .replace(' (основной)', '')
            .replace(' (сравнение)', '')
            .trim();
        const compLabel = comparisonPeriod.label
            .replace(' (основной)', '')
            .replace(' (сравнение)', '')
            .trim();
        
        // Извлекаем годы из названий периодов
        const mainYear = mainLabel.match(/\d{4}/)?.[0] || '';
        const compYear = compLabel.match(/\d{4}/)?.[0] || '';
        
        if (mainYear && compYear && mainYear !== compYear) {
            // Красивый заголовок с годами
            axisTitle = `${axisTitle} — сравнение ${mainYear} с ${compYear}`;
        } else {
            // Красивый заголовок с полными названиями
            const mainShort = mainLabel.length > 20 ? mainLabel.substring(0, 17) + '...' : mainLabel;
            const compShort = compLabel.length > 20 ? compLabel.substring(0, 17) + '...' : compLabel;
            axisTitle = `${axisTitle} — сравнение ${mainShort} с ${compShort}`;
        }
    }
    
    // Создаем датасеты
    const datasets = [];
    
    processedPeriods.forEach((period, periodIndex) => {
        const dataArray = [];
        
        for (let position = 0; position < maxDataLength; position++) {
            const item = period.processedItems[position];
            const value = item ? item.value : 0;
            dataArray.push(value);
        }
        
        while (dataArray.length < maxDataLength) {
            dataArray.push(0);
        }
        
        const datasetLabel = period.isMainPeriod 
            ? `${period.label} (основной)` 
            : `${period.label} (сравнение)`;
        
        if (chartType === 'bar') {
            datasets.push({
                label: datasetLabel,
                data: dataArray,
                backgroundColor: adjustColorOpacity(period.color, 0.8),
                borderColor: period.color,
                borderWidth: 2,
                borderRadius: 4,
                borderSkipped: false,
                maxBarThickness: 35
            });
        } else {
            const borderDash = period.isMainPeriod ? [] : [10, 5];
            const borderWidth = period.isMainPeriod ? 4 : 3;
            
            datasets.push({
                label: datasetLabel,
                data: dataArray,
                borderColor: period.color,
                backgroundColor: 'transparent',
                borderWidth: borderWidth,
                borderDash: borderDash,
                pointBackgroundColor: period.color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: period.isMainPeriod ? 6 : 5,
                pointHoverRadius: period.isMainPeriod ? 8 : 7,
                tension: 0.1,
                fill: false
            });
        }
    });
    
    // Уничтожаем предыдущий график
    if (state.charts && state.charts.callsChart) {
        state.charts.callsChart.destroy();
        delete state.charts.callsChart;
    }
    
    // Создаем график
    state.charts = state.charts || {};
    state.charts.callsChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: chartType === 'line',
                        padding: 15,
                        font: {
                            size: 15,  // увеличить размер
                            weight: 'bold', // сделать жирным
                            family: 'Montserrat, Arial, sans-serif'
                        },
                        color: '#1a1a1a' // темный, контрастный
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 6,
                    padding: 12,
                    callbacks: {
                        title: function(tooltipItems) {
                            const position = tooltipItems[0].dataIndex;
                            const fullLabel = fullLabels[position];
                            
                            return `Позиция ${position + 1}: ${fullLabel}`;
                        },
                        label: function(tooltipItem) {
                            const value = tooltipItem.raw;
                            const position = tooltipItem.dataIndex;
                            const periodIndex = datasets.findIndex(d => d.label === tooltipItem.dataset.label);
                            
                            // Показываем реальную дату для этого периода
                            let realDate = '';
                            if (processedPeriods[periodIndex] && processedPeriods[periodIndex].processedItems[position]) {
                                realDate = processedPeriods[periodIndex].processedItems[position].dateLabel;
                            }
                            
                            return `${tooltipItem.dataset.label}: ${formatNumber(value)} вызовов (${realDate})`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: false,
                    title: {
                        display: true,
                        text: 'Количество вызовов',
                        font: {
                            weight: '600',
                            size: 12,
                            family: 'Montserrat'
                        },
                        color: '#444444'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.06)',
                        drawBorder: false
                    },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        },
                        font: {
                            size: 11,
                            family: 'Montserrat'
                        },
                        color: '#666666'
                    }
                },
                x: {
                    stacked: false,
                    title: {
                        display: true,
                        text: axisTitle, // КРАСИВЫЙ ЗАГОЛОВОК
                        font: {
                            weight: '500', // Уменьшаем жирность
                            size: 12,
                            family: 'Montserrat'
                        },
                        color: '#555555' // Мягкий цвет
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: maxDataLength > 12 ? 35 : 0, // Уменьшаем угол поворота
                        minRotation: 0,
                        autoSkip: false,
                        font: {
                            size: maxDataLength > 20 ? 9 : (maxDataLength > 15 ? 10 : 11),
                            family: 'Montserrat',
                            weight: '400' // Обычный вес шрифта
                        },
                        color: '#666666',
                        padding: 6,
                        callback: function(value, index) {
                            const label = this.getLabelForValue(value);
                            
                            // Оставляем метки как есть, без дополнительного сокращения
                            return label;
                        }
                    },
                    categoryPercentage: 0.85,
                    barPercentage: 0.9
                }
            },
            layout: {
                padding: {
                    top: 15,
                    right: 15,
                    bottom: 20,
                    left: 15
                }
            }
        }
    });
       
    return state.charts.callsChart;
}
    

    /**
     * Создает детальный график Service Level для сравнения
     */
        function createDetailedServiceLevelComparisonChart(periodsData) {
            
            if (!periodsData || periodsData.length === 0) {
                console.error('Нет данных периодов для Service Level');
                return;
            }
            
            const canvas = document.getElementById('service-level-chart');
            if (!canvas) {
                console.error('Canvas service-level-chart не найден');
                return;
            }
            
            const ctx = canvas.getContext('2d');
            const chartType = state.chartTypes.serviceLevel || 'line';
            
            
            // Обрабатываем каждый период и подготавливаем данные
            const processedPeriods = [];
            let maxDataLength = 0;
            
            periodsData.forEach((period, periodIndex) => {
                
                if (!period.data || period.data.length === 0) {
                    console.warn(`⚠️ Период ${periodIndex} не содержит данных Service Level`);
                    return;
                }
                
                // Сортируем данные периода
                const sortedData = sortChartData(period.data, state.periodType.replace('-comparison', ''));
                
                const processedItems = [];
                
                sortedData.forEach((row, rowIndex) => {
                    // Формируем метку даты в зависимости от типа периода
                    let dateLabel = '';
                    
                    if (state.dataType === 'detailed') {
                        if (state.periodType.startsWith('custom')) {
                            dateLabel = formatPeriodDate(row.report_date, 'custom');
                        } else if (state.periodType.startsWith('hour')) {
                            const hourMatch = row.report_hour ? row.report_hour.match(/\d+/) : null;
                            const hour = hourMatch ? hourMatch[0] + ':00' : (row.report_hour || 'Час');
                            dateLabel = hour;
                        } else {
                            dateLabel = formatPeriodDate(row.report_date, state.periodType.replace('-comparison', ''));
                        }
                    } else {
                        if (state.periodType.startsWith('hour')) {
                            const date = formatPeriodDate(row.report_date, 'hour');
                            const hourMatch = row.report_hour ? row.report_hour.match(/\d+/) : null;
                            const hour = hourMatch ? hourMatch[0] + ':00' : row.report_hour;
                            dateLabel = hour ? `${date} ${hour}` : `${date} ${row.report_hour}`;
                        } else {
                            dateLabel = formatPeriodDate(row.report_date, state.periodType.replace('-comparison', ''));
                        }
                    }
                    
                    // ВАЖНО: Используем sl_result для Service Level
                    const slValue = row.sl_result !== undefined && row.sl_result !== null ? parseFloat(row.sl_result) : null;
                    
                    processedItems.push({
                        position: rowIndex,
                        dateLabel: dateLabel,
                        value: slValue,
                        originalDate: row.report_date,
                        originalRow: row
                    });
                });
                
                maxDataLength = Math.max(maxDataLength, processedItems.length);
                
                processedPeriods.push({
                    originalPeriod: period,
                    label: period.label,
                    color: period.color,
                    isMainPeriod: period.isMainPeriod,
                    processedItems: processedItems,
                    periodIndex: periodIndex
                });
                
            });
            
            if (processedPeriods.length === 0 || maxDataLength === 0) {
                console.error('❌ Нет валидных данных для создания графика Service Level');
                return;
            }
            
            // Функция форматирования компактной даты БЕЗ ГОДА
            function formatCompactDate(dateString) {
                if (!dateString) return '';
                
                try {
                    // Если дата в формате DD.MM.YYYY
                    if (dateString.includes('.')) {
                        const parts = dateString.split('.');
                        if (parts.length === 3) {
                            const day = parts[0];
                            const month = parts[1];
                            // Возвращаем формат БЕЗ года: DD.MM
                            return `${day}.${month}`;
                        }
                    }
                    return dateString;
                } catch (error) {
                    console.warn('Ошибка форматирования даты:', error);
                    return dateString;
                }
            }
            
            // Определяем метки для оси X на основе самого длинного периода
            const referencePeriod = processedPeriods.reduce((longest, current) => {
                return current.processedItems.length > longest.processedItems.length ? current : longest;
            });

            
            // СОЗДАЕМ КОМПАКТНЫЕ КОМБИНИРОВАННЫЕ МЕТКИ БЕЗ ГОДА
            const labels = [];
            const fullLabels = []; // Полные метки для tooltip
            const mainPeriod = processedPeriods.find(p => p.isMainPeriod);
            const comparisonPeriod = processedPeriods.find(p => !p.isMainPeriod);
            
            for (let position = 0; position < maxDataLength; position++) {
                const mainDate = mainPeriod && mainPeriod.processedItems[position] 
                    ? mainPeriod.processedItems[position].dateLabel 
                    : `День ${position + 1}`;
                    
                const compDate = comparisonPeriod && comparisonPeriod.processedItems[position] 
                    ? comparisonPeriod.processedItems[position].dateLabel 
                    : `День ${position + 1}`;
                
                // Компактные метки для оси X БЕЗ ГОДА
                const mainCompact = formatCompactDate(mainDate);
                const compCompact = formatCompactDate(compDate);
                
                // Полные метки для tooltip
                const fullMainDate = mainDate;
                const fullCompDate = compDate;
                
                let compactLabel = '';
                let fullLabel = '';
                
                if (mainCompact === compCompact) {
                    // Если даты одинаковые (без года)
                    compactLabel = mainCompact;
                    fullLabel = fullMainDate;
                } else {
                    // Если разные - используем компактный формат БЕЗ СИМВОЛОВ
                    if (maxDataLength > 15) {
                        // Для большого количества данных - только дни
                        compactLabel = `${mainCompact.split('.')[0]}/${compCompact.split('.')[0]}`; // 01/01
                    } else {
                        // Для нормального количества - день.месяц через пробел
                        compactLabel = `${mainCompact} ${compCompact}`;
                    }
                    
                    fullLabel = `${fullMainDate} ↔ ${fullCompDate}`;
                }
                
                labels.push(compactLabel);
                fullLabels.push(fullLabel);
            }
            
            
            // Создаем заголовок оси X с названиями периодов
            const mainPeriodObj = processedPeriods.find(p => p.isMainPeriod);
            const comparisonPeriods = processedPeriods.filter(p => !p.isMainPeriod);
            
            let axisTitle = getAxisTitle(state.periodType.replace('-comparison', ''));
            
            if (mainPeriodObj && comparisonPeriods.length > 0) {
                // Извлекаем чистые названия периодов
                const mainLabel = mainPeriodObj.label
                    .replace(' (основной)', '')
                    .replace(' (сравнение)', '')
                    .trim();
                const compLabel = comparisonPeriods[0].label
                    .replace(' (основной)', '')
                    .replace(' (сравнение)', '')
                    .trim();
                
                // Извлекаем годы из названий периодов
                const mainYear = mainLabel.match(/\d{4}/)?.[0] || '';
                const compYear = compLabel.match(/\d{4}/)?.[0] || '';
                
                if (mainYear && compYear && mainYear !== compYear) {
                    // Красивый заголовок с годами
                    axisTitle = `${axisTitle} — сравнение ${mainYear} с ${compYear}`;
                } else {
                    // Красивый заголовок с полными названиями
                    const mainShort = mainLabel.length > 20 ? mainLabel.substring(0, 17) + '...' : mainLabel;
                    const compShort = compLabel.length > 20 ? compLabel.substring(0, 17) + '...' : compLabel;
                    axisTitle = `${axisTitle} — сравнение ${mainShort} с ${compShort}`;
                }
            }
            
            
            // Создаем датасеты для Chart.js
            const datasets = [];
            
            processedPeriods.forEach((period, periodIndex) => {
                
                // Формируем массив данных, сопоставляя по позиции
                const dataArray = [];
                
                for (let position = 0; position < maxDataLength; position++) {
                    const item = period.processedItems[position];
                    const value = item ? item.value : null; // null для Service Level если нет данных
                    dataArray.push(value);
                }
                
                // Дополняем null если нужно
                while (dataArray.length < maxDataLength) {
                    dataArray.push(null);
                }
                
                const nonNullValues = dataArray.filter(v => v !== null).length;
                const avgValue = nonNullValues > 0 ? 
                    (dataArray.filter(v => v !== null).reduce((sum, v) => sum + v, 0) / nonNullValues).toFixed(1) : 0;
                
                const datasetLabel = period.isMainPeriod 
                    ? `${period.label} (основной)` 
                    : `${period.label} (сравнение)`;
                
                if (chartType === 'bar') {
                    // Конфигурация для столбчатого графика Service Level
                    // Цвета столбцов в зависимости от значения SL
                    const barColors = dataArray.map(value => {
                        if (value === null) return 'rgba(200, 200, 200, 0.3)'; // Серый для отсутствующих данных
                        return value >= 80 
                            ? adjustColorOpacity(chartColors.slGood || '#27AE60', 0.8)  // Зеленый для хорошего SL
                            : adjustColorOpacity(chartColors.slBad || '#E74C3C', 0.8);   // Красный для плохого SL
                    });
                    
                    datasets.push({
                        label: datasetLabel,
                        data: dataArray,
                        backgroundColor: barColors,
                        borderColor: period.color,
                        borderWidth: 2,
                        borderRadius: 4,
                        borderSkipped: false,
                        maxBarThickness: 35,
                        minBarLength: 0,
                        yAxisID: 'y'
                    });
                } else if (chartType === 'line') {
                    // Конфигурация для линейного графика Service Level
                    const borderDash = period.isMainPeriod ? [] : [10, 5];
                    const borderWidth = period.isMainPeriod ? 4 : 3;
                    const pointRadius = period.isMainPeriod ? 6 : 5;
                    
                    datasets.push({
                        label: datasetLabel,
                        data: dataArray,
                        borderColor: period.color,
                        backgroundColor: 'transparent',
                        borderWidth: borderWidth,
                        borderDash: borderDash,
                        pointBackgroundColor: period.color,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: pointRadius,
                        pointHoverRadius: pointRadius + 2,
                        tension: 0.1,
                        fill: false,
                        spanGaps: false, // Не соединяем линиями пропуски
                        yAxisID: 'y'
                    });
                }
            });
            
            // ДОБАВЛЯЕМ НОРМАТИВНУЮ ЛИНИЮ только для линейного графика
            if (chartType === 'line') {
                datasets.push({
                    label: 'Норматив (80%)',
                    data: Array(labels.length).fill(80),
                    type: 'line',
                    borderColor: chartColors.normative || '#F39C12',
                    borderWidth: 2,
                    borderDash: [15, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    order: 0, // Рисуем первой (на заднем плане)
                    tension: 0,
                    yAxisID: 'y'
                });

            }
            
            // Проверяем общую статистику
            datasets.forEach((dataset, i) => {
                if (dataset.label !== 'Норматив (80%)') {
                    const validValues = dataset.data.filter(v => v !== null);
                    const avg = validValues.length > 0 ? (validValues.reduce((a, b) => a + b, 0) / validValues.length).toFixed(1) : 0;
                }
            });
            
            // Уничтожаем предыдущий график если существует
            if (state.charts && state.charts.serviceLevel) {
                state.charts.serviceLevel.destroy();
                delete state.charts.serviceLevel;
            }
            
            // Создаем новый график
            
            state.charts = state.charts || {};
            state.charts.serviceLevel = new Chart(ctx, {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 750,
                        easing: 'easeInOutQuart'
                    },
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        title: {
                            display: false
                        },
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                usePointStyle: false, // ВАЖНО: false для квадратиков вместо кружков
                                padding: 15,
                                font: {
                                    size: 11,
                                    family: 'Montserrat',
                                    weight: '500'
                                },
                                color: '#555555',
                                boxWidth: 12,
                                boxHeight: 12,
                                // Кастомная генерация меток для правильных цветов
                                generateLabels: function(chart) {
                                    const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                                    
                                    // Исправляем цвета для каждого элемента легенды
                                    labels.forEach((label, index) => {
                                        const dataset = chart.data.datasets[index];
                                        if (dataset) {
                                            if (dataset.borderColor) {
                                                label.fillStyle = dataset.borderColor;
                                                label.strokeStyle = dataset.borderColor;
                                            }
                                            
                                            // Для пунктирных линий показываем пунктир
                                            if (dataset.borderDash && dataset.borderDash.length > 0) {
                                                label.lineDash = dataset.borderDash;
                                                label.lineWidth = dataset.borderWidth || 2;
                                            }
                                        }
                                    });
                                    
                                    return labels;
                                }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderWidth: 1,
                            cornerRadius: 6,
                            padding: 12,
                            callbacks: {
                                title: function(tooltipItems) {
                                    const position = tooltipItems[0].dataIndex + 1;
                                    const fullLabel = fullLabels[tooltipItems[0].dataIndex];
                                    return `Позиция ${position}: ${fullLabel}`;
                                },
                                label: function(tooltipItem) {
                                    const value = tooltipItem.raw;
                                    
                                    if (value === null) {
                                        return `${tooltipItem.dataset.label}: нет данных`;
                                    }
                                    
                                    const position = tooltipItem.dataIndex;
                                    const periodIndex = datasets.findIndex(d => d.label === tooltipItem.dataset.label);
                                    
                                    // Находим реальную дату для этого периода
                                    let realDate = tooltipItem.label;
                                    
                                    if (processedPeriods[periodIndex] && 
                                        processedPeriods[periodIndex].processedItems[position]) {
                                        realDate = processedPeriods[periodIndex].processedItems[position].dateLabel;
                                    }
                                    
                                    return `${tooltipItem.dataset.label}: ${value.toFixed(1)}% (${realDate})`;
                                }
                            }
                        },
                        // КРИТИЧЕСКИ ВАЖНО: Отключаем отображение цифр на графике
                        datalabels: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            beginAtZero: true,
                            max: 100,
                            stacked: false, // КРИТИЧЕСКИ ВАЖНО для раздельного отображения
                            title: {
                                display: true,
                                text: 'Service Level (%)',
                                font: {
                                    weight: '600',
                                    size: 12,
                                    family: 'Montserrat'
                                },
                                color: '#444444'
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.06)',
                                drawBorder: false
                            },
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                },
                                font: {
                                    size: 11,
                                    family: 'Montserrat'
                                },
                                color: '#666666',
                                maxTicksLimit: 6,
                                stepSize: 20 // Шаг 20% (0%, 20%, 40%, 60%, 80%, 100%)
                            }
                        },
                        x: {
                            type: 'category',
                            stacked: false, // КРИТИЧЕСКИ ВАЖНО для раздельного отображения
                            title: {
                                display: true,
                                text: axisTitle, // Используем созданный заголовок с периодами
                                font: {
                                    weight: '500', // Мягкая жирность
                                    size: 12,
                                    family: 'Montserrat'
                                },
                                color: '#555555', // Мягкий цвет
                                padding: { top: 10 }
                            },
                            grid: {
                                display: false
                            },
                            ticks: {
                                maxRotation: maxDataLength > 12 ? 35 : 0, // Уменьшенный угол поворота
                                minRotation: 0,
                                autoSkip: false,
                                autoSkipPadding: 5,
                                font: {
                                    size: maxDataLength > 20 ? 9 : (maxDataLength > 15 ? 10 : 11),
                                    family: 'Montserrat',
                                    weight: '400' // Обычный вес шрифта
                                },
                                color: '#666666',
                                padding: 6
                            },
                            // Настройки для группировки столбцов (если bar)
                            categoryPercentage: 0.85,
                            barPercentage: 0.9
                        }
                    },
                    layout: {
                        padding: {
                            top: 15,
                            right: 15,
                            bottom: 20,
                            left: 15
                        }
                    },
                    elements: {
                        bar: {
                            borderRadius: 4,
                            borderSkipped: false
                        },
                        point: {
                            hoverRadius: 8
                        }
                    }
                }
            });
            
            // Добавляем обработчик событий для клика по графику
            canvas.onclick = function(event) {
                const points = state.charts.serviceLevel.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
                
                if (points.length) {
                    const firstPoint = points[0];
                    const label = state.charts.serviceLevel.data.labels[firstPoint.index];
                    const datasetLabel = state.charts.serviceLevel.data.datasets[firstPoint.datasetIndex].label;
                    const value = state.charts.serviceLevel.data.datasets[firstPoint.datasetIndex].data[firstPoint.index];
                    
                }
            };
            
            return state.charts.serviceLevel;
        }

        // Убеждаемся что chartColors определены
        function ensureChartColors() {
            if (typeof chartColors === 'undefined') {
                window.chartColors = {
                    primary: '#FF6B35',        // Оранжевый
                    secondary: '#4ECDC4',      // Зеленый
                    slGood: '#27AE60',         // Зеленый для хорошего SL
                    slBad: '#E74C3C',          // Красный для плохого SL
                    normative: '#F39C12'       // Оранжевый для норматива
                };
            }
        }

        // Инициализируем цвета
        ensureChartColors();

    /**
     * Создает вертикальные графики для обычных данных
     */
    function createVerticalStandardCharts(data, periodType) {
        const chartData = data.filter(row => row.report_date !== 'Итого');
        
        if (chartData.length === 0) {
            showChartError('Нет детализированных данных для графика');
            hideChartLoading();
            return;
        }
        
        setupVerticalChartContainer();
        
        const sortedData = sortChartData(chartData, periodType);
        
        const labels = sortedData.map(row => formatLabelForChart(row, periodType));
        
        createCallsChart(sortedData, labels, periodType);
        createServiceLevelChart(sortedData, labels, periodType);
        createSatisfactionChart(sortedData, labels, periodType);
        createWaitTimeChart(sortedData, labels, periodType);
        createAHTChart(sortedData, labels, periodType);
        
        hideChartLoading();
    }
    
    /**
     * Настраивает контейнер для вертикальных графиков
     */
        function setupVerticalChartContainer() {
            const container = document.getElementById('vertical-charts-container');
            if (!container) return;
            
            container.innerHTML = '';
            
            const chartIds = [
                'calls-chart', 
                'service-level-chart', 
                'satisfaction-chart', 
                'wait-time-chart',
                'aht-chart'
            ];
            
            chartIds.forEach(id => {
                const chartContainer = document.createElement('div');
                chartContainer.id = `${id}-container`;
                chartContainer.className = 'single-chart-container';
                
                const chartHeader = document.createElement('div');
                chartHeader.style.display = 'flex';
                chartHeader.style.justifyContent = 'space-between';
                chartHeader.style.alignItems = 'center';
                chartHeader.style.marginBottom = '15px';
                chartHeader.style.position = 'relative';
                
                const chartTitle = document.createElement('h4');
                chartTitle.textContent = getChartTitle(id);
                chartTitle.style.margin = '0';
                chartTitle.style.color = '#555';
                chartTitle.style.fontFamily = 'Montserrat, sans-serif';
                chartTitle.style.fontSize = '16px';
                chartTitle.style.fontWeight = 'bold';
                
                chartHeader.appendChild(chartTitle);
                
                // Добавляем селектор типа графика с правильными ограничениями
                const chartTypeSelector = document.createElement('div');
                chartTypeSelector.className = 'chart-type-selector';
                
                let chartTypes = [];
                
                // Определяем типы графиков для каждого показателя с учетом ограничений
                if (id === 'calls-chart') {
                    // Для количества вызовов - все типы кроме детальных данных в произвольном и часовом
                    if ((state.periodType === 'custom' || state.periodType === 'hour') && state.dataType === 'detailed') {
                        chartTypes = [
                            { value: 'bar', text: 'Столбчатый', icon: '<i class="fas fa-chart-bar"></i>' },
                            { value: 'line', text: 'Линейный', icon: '<i class="fas fa-chart-line"></i>' }
                        ];
                    } else {
                        chartTypes = [
                            { value: 'bar', text: 'Столбчатый', icon: '<i class="fas fa-chart-bar"></i>' },
                            { value: 'line', text: 'Линейный', icon: '<i class="fas fa-chart-line"></i>' },
                            { value: 'pie', text: 'Круговой', icon: '<i class="fas fa-chart-pie"></i>' },
                            { value: 'doughnut', text: 'Кольцевой', icon: '<i class="fas fa-circle-notch"></i>' }
                        ];
                    }
                } else if (id === 'service-level-chart') {
                    // Для SL - линейный и столбчатый
                    chartTypes = [
                        { value: 'line', text: 'Линейный', icon: '<i class="fas fa-chart-line"></i>' },
                        { value: 'bar', text: 'Столбчатый', icon: '<i class="fas fa-chart-bar"></i>' }
                    ];
                } else if (id === 'satisfaction-chart' || id === 'wait-time-chart' || id === 'aht-chart') {
                    // ИЗМЕНЯЕМ: Для удовлетворенности, времени ожидания и AHT - только линейный и столбчатый
                    chartTypes = [
                        { value: 'line', text: 'Линейный', icon: '<i class="fas fa-chart-line"></i>' },
                        { value: 'bar', text: 'Столбчатый', icon: '<i class="fas fa-chart-bar"></i>' }
                    ];
                }
                
                chartTypes.forEach(type => {
                    let isActive = false;
                    
                    // Проверяем активный тип для каждого графика
                    if (id === 'calls-chart' && type.value === state.chartTypes.calls) {
                        isActive = true;
                    } else if (id === 'service-level-chart' && type.value === (state.chartTypes.serviceLevel || 'line')) {
                        isActive = true;
                    } else if (id === 'satisfaction-chart' && type.value === (state.chartTypes.satisfaction || 'line')) {
                        isActive = true;
                    } else if (id === 'wait-time-chart' && type.value === (state.chartTypes.waitTime || 'line')) {
                        isActive = true;
                    } else if (id === 'aht-chart' && type.value === (state.chartTypes.aht || 'line')) {
                        isActive = true;
                    }
                    
                    const typeButton = document.createElement('button');
                    typeButton.type = 'button';
                    typeButton.className = `chart-type-btn ${isActive ? 'active' : ''}`;
                    typeButton.title = type.text;
                    typeButton.dataset.value = type.value;
                    typeButton.innerHTML = type.icon;
                    
                    typeButton.addEventListener('click', function() {
                        const chartType = this.dataset.value;
                        const chartId = id;
                        
                        // Убираем активный класс у всех кнопок этого селектора
                        chartTypeSelector.querySelectorAll('.chart-type-btn').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        
                        this.classList.add('active');
                        
                        // Обновляем состояние для соответствующего типа графика
                        if (chartId === 'calls-chart') {
                            state.chartTypes.calls = chartType;
                        } else if (chartId === 'service-level-chart') {
                            state.chartTypes.serviceLevel = chartType;
                        } else if (chartId === 'satisfaction-chart') {
                            state.chartTypes.satisfaction = chartType;
                        } else if (chartId === 'wait-time-chart') {
                            state.chartTypes.waitTime = chartType;
                        } else if (chartId === 'aht-chart') {
                            state.chartTypes.aht = chartType;
                        }
                        
                        // Анимированное обновление графика
                        const canvasContainer = document.getElementById(`${chartId}-container`);
                        if (canvasContainer) {
                            canvasContainer.style.transition = 'opacity 0.3s';
                            canvasContainer.style.opacity = '0.5';
                            
                            setTimeout(() => {
                                updateChart(state.currentData, state.periodType);
                                
                                setTimeout(() => {
                                    canvasContainer.style.opacity = '1';
                                }, 100);
                            }, 300);
                        }
                    });
                    
                    chartTypeSelector.appendChild(typeButton);
                });
                
                chartHeader.appendChild(chartTypeSelector);
                chartContainer.appendChild(chartHeader);
                
                const canvasWrapper = document.createElement('div');
                canvasWrapper.style.position = 'relative';
                canvasWrapper.style.width = '100%';
                canvasWrapper.style.height = 'calc(100% - 50px)';
                canvasWrapper.style.boxSizing = 'border-box';
                
                const canvas = document.createElement('canvas');
                canvas.id = id;
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                canvas.style.display = 'block';
                
                canvasWrapper.appendChild(canvas);
                chartContainer.appendChild(canvasWrapper);
                container.appendChild(chartContainer);
            });
            
            const oldLegendContainer = document.getElementById('chart-legend-container');
            if (oldLegendContainer) {
                oldLegendContainer.remove();
            }
            
            const legendContainer = document.createElement('div');
            legendContainer.id = 'chart-legend-container';
            legendContainer.className = 'chart-legend-container';
            
            if (container.parentNode) {
                container.parentNode.insertBefore(legendContainer, container);
            }
        }
    
    /**
     * Получает заголовок для графика по его ID
     */
    function getChartTitle(id) {
        switch (id) {
            case 'calls-chart': return 'Количество вызовов';
            case 'service-level-chart': return 'Service Level (%)';
            case 'satisfaction-chart': return 'Удовлетворенность';
            case 'wait-time-chart': return 'Время ожидания (сек)';
            case 'aht-chart': return 'AHT (сек)';
            default: return '';
        }
    }

    /**
     * Вычисляет оптимальную ширину столбцов в зависимости от количества данных
     */
    function calculateBarThickness(dataLength, chartType, containerWidth = null) {
        if (chartType !== 'bar') {
            return undefined; // Для не-столбчатых графиков ширина не нужна
        }
        
        // Если передана ширина контейнера, используем её, иначе берем примерную
        const availableWidth = containerWidth || 800; // Примерная ширина графика по умолчанию
        
        // Базовые настройки
        const minBarWidth = 8;    // Минимальная ширина столбца
        const maxBarWidth = 60;   // Максимальная ширина столбца
        const idealBarWidth = 25; // Идеальная ширина столбца
        const padding = 0.3;      // Отступ между столбцами (30% от ширины столбца)
        
        // Рассчитываем доступную ширину для столбцов (учитываем отступы по краям)
        const chartPadding = 40; // Отступы графика слева и справа
        const usableWidth = availableWidth - chartPadding;
        
        // Рассчитываем ширину одного столбца с учетом отступов
        const spacePerBar = usableWidth / dataLength;
        const calculatedBarWidth = spacePerBar / (1 + padding);
        
        // Применяем ограничения
        let finalBarWidth = Math.max(minBarWidth, Math.min(maxBarWidth, calculatedBarWidth));
        
        // Особые случаи для разного количества данных
        if (dataLength <= 3) {
            // Мало данных - используем стандартную ширину
            finalBarWidth = idealBarWidth;
        } else if (dataLength <= 7) {
            // Средне данных - немного уменьшаем
            finalBarWidth = Math.min(idealBarWidth, calculatedBarWidth);
        } else if (dataLength <= 15) {
            // Много данных - адаптивная ширина
            finalBarWidth = Math.max(15, calculatedBarWidth);
        } else if (dataLength <= 30) {
            // Очень много данных - тонкие столбцы
            finalBarWidth = Math.max(12, calculatedBarWidth);
        } else {
            // Критически много данных - используем flex
            return 'flex';
        }
        
        return Math.round(finalBarWidth);
    }

    /**
     * Получает ширину контейнера графика
     */
    function getChartContainerWidth(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const container = canvas.closest('.single-chart-container') || canvas.parentElement;
        if (!container) return null;
        
        return container.clientWidth || container.offsetWidth || null;
    }
    

    
    /**
     * Создает график количества вызовов
     */
        function createCallsChart(data, labels, periodType) {
        const callsData = data.map(row => row.received_calls);
        
        // Получаем тип графика из состояния
        let chartType = state.chartTypes.calls || 'doughnut';
        let isFilled = false;
        
        // Обрабатываем специальный тип "line-filled"
        if (chartType === 'line-filled') {
            chartType = 'line';
            isFilled = true;
        }
        
        // Получаем ширину контейнера и рассчитываем ширину столбцов
        const containerWidth = getChartContainerWidth('calls-chart');
        const barThickness = calculateBarThickness(labels.length, chartType, containerWidth);
        
        const config = {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Количество вызовов',
                    data: callsData,
                    backgroundColor: chartType === 'line' ? 
                        (isFilled ? adjustColorOpacity(chartColors.primary, 0.3) : adjustColorOpacity(chartColors.primary, 0.1)) : 
                        generateColorShades(chartColors.primary, callsData.length),
                    borderColor: chartType === 'line' ? chartColors.primary : 'transparent',
                    borderWidth: chartType === 'line' ? 2 : 0,
                    pointRadius: chartType === 'line' ? 4 : undefined,
                    pointBackgroundColor: chartType === 'line' ? chartColors.primary : undefined,
                    tension: chartType === 'line' ? 0.1 : undefined,
                    fill: isFilled,
                    borderRadius: chartType === 'bar' ? 4 : undefined,
                    barThickness: barThickness // ДОБАВЛЯЕМ: автоматическая ширина
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: ['pie', 'doughnut'].includes(chartType),
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            title: function(items) {
                                return `${getAxisTitle(periodType)}: ${items[0].label}`;
                            },
                            label: function(item) {
                                const value = item.raw;
                                return `Количество вызовов: ${formatNumber(value)}`;
                            }
                        }
                    },
                    datalabels: {
                        display: ['pie', 'doughnut'].includes(chartType),
                        formatter: (value) => {
                            return formatNumber(value);
                        },
                        color: '#333', // ИСПРАВЛЯЕМ: темный цвет для видимости
                        font: {
                            weight: 'bold',
                            size: 11,
                            family: 'Montserrat'
                        },
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        borderColor: 'rgba(0, 0, 0, 0.1)',
                        borderRadius: 4,
                        borderWidth: 1,
                        padding: 4
                    }
                },
                scales: ['pie', 'doughnut'].includes(chartType) ? {} : {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Количество вызовов',
                            font: {
                                weight: 'bold',
                                size: 12,
                                family: 'Montserrat'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value, index) {
                                return formatNumber(value);
                            },
                            font: {
                                size: 12,
                                family: 'Montserrat'
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: getAxisTitle(periodType),
                            font: {
                                weight: 'bold',
                                size: 12,
                                family: 'Montserrat'
                            }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            callback: function(value, index) {
                                const label = this.getLabelForValue(value);
                                if (label && label.length > 15) {
                                    return label.substring(0, 12) + '...';
                                }
                                return label;
                            },
                            maxRotation: labels.length > 10 ? 45 : 0, // ДОБАВЛЯЕМ: автоматический поворот
                            minRotation: 0,
                            autoSkip: labels.length > 20, // ДОБАВЛЯЕМ: автоматический пропуск
                            font: {
                                size: labels.length > 15 ? 10 : 11, // ДОБАВЛЯЕМ: адаптивный размер шрифта
                                family: 'Montserrat'
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 10,
                        right: 20,
                        bottom: 20,
                        left: 10
                    }
                },
                onClick: (e, elements, chart) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const value = chart.data.datasets[0].data[index];
                        const label = chart.data.labels[index];
                        
                        showDataPointDetails({
                            date: label,
                            calls: data[index].received_calls,
                            row: data[index]
                        });
                    }
                }
            }
        };
        
        const canvas = document.getElementById('calls-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            state.charts = state.charts || {};
            state.charts.callsChart = new Chart(ctx, config);
        }
    }
    
    /**
     * Создает график Service Level с нормативной линией и красными/зелеными точками
     */
        function createServiceLevelChart(data, labels, periodType) {
            const slData = data.map(row => row.sl_result);
            
            // Получаем тип графика из состояния
            const chartType = state.chartTypes.serviceLevel || 'line';
            
            // Получаем ширину контейнера и рассчитываем ширину столбцов
            const containerWidth = getChartContainerWidth('service-level-chart');
            const barThickness = calculateBarThickness(labels.length, chartType, containerWidth);
            
            const pointColors = slData.map(value => 
                value >= 80 ? chartColors.slGood : chartColors.slBad
            );
            
            const canvas = document.getElementById('service-level-chart');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            
            const maxValue = Math.max(...slData.filter(v => v !== null && !isNaN(v)));
            const suggestedMax = Math.min(100, Math.ceil(maxValue * 1.1));
            
            let config = {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Service Level (%)',
                            data: slData,
                            backgroundColor: chartType === 'line' ? 'transparent' : slData.map(value => 
                                value >= 80 ? adjustColorOpacity(chartColors.slGood, 0.8) : adjustColorOpacity(chartColors.slBad, 0.8)
                            ),
                            borderColor: chartType === 'line' ? chartColors.primary : slData.map(value => 
                                value >= 80 ? chartColors.slGood : chartColors.slBad
                            ),
                            borderWidth: chartType === 'line' ? 2 : 0,
                            pointBackgroundColor: chartType === 'line' ? pointColors : undefined,
                            pointBorderColor: chartType === 'line' ? pointColors : undefined,
                            pointRadius: chartType === 'line' ? 6 : undefined,
                            pointHoverRadius: chartType === 'line' ? 8 : undefined,
                            tension: chartType === 'line' ? 0.1 : undefined,
                            fill: false,
                            borderRadius: chartType === 'bar' ? 4 : undefined,
                            barThickness: barThickness // ДОБАВЛЯЕМ: автоматическая ширина
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: false
                        },
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                generateLabels: (chart) => {
                                    const labels = [];
                                    
                                    labels.push({
                                        text: 'Service Level (%)',
                                        fillStyle: chartType === 'bar' ? 
                                            adjustColorOpacity(chartColors.primary, 0.8) : 'transparent',
                                        strokeStyle: chartColors.primary,
                                        lineWidth: chartType === 'line' ? 2 : 0,
                                        hidden: false,
                                        index: 0
                                    });
                                    
                                    if (chartType === 'line') {
                                        labels.push({
                                            text: 'Норматив (80%)',
                                            fillStyle: 'transparent',
                                            strokeStyle: chartColors.normative,
                                            lineWidth: 2,
                                            lineDash: [5, 5],
                                            hidden: false,
                                            index: 1
                                        });
                                    }
                                    
                                    return labels;
                                }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                title: function(items) {
                                    return labels[items[0].dataIndex];
                                },
                                label: function(item) {
                                    if (item.datasetIndex === 0) {
                                        const value = item.raw;
                                        return `Service Level: ${formatValue(value)}%`;
                                    } else {
                                        return `Норматив: 80%`;
                                    }
                                },
                                afterLabel: function(item) {
                                    if (item.datasetIndex === 0) {
                                        const value = item.raw;
                                        if (value < 80) {
                                            return `⚠️ Ниже норматива на ${formatValue(80 - value)}%`;
                                        } else if (value > 80) {
                                            return `✓ Выше норматива на ${formatValue(value - 80)}%`;
                                        }
                                    }
                                    return '';
                                }
                            }
                        },
                        datalabels: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            suggestedMax: suggestedMax,
                            max: 100,
                            title: {
                                display: true,
                                text: 'Service Level (%)',
                                font: {
                                    weight: 'bold',
                                    size: 12,
                                    family: 'Montserrat'
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                                callback: function(value, index) {
                                    return value + '%';
                                },
                                font: {
                                    size: 12,
                                    family: 'Montserrat'
                                }
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: getAxisTitle(periodType),
                                font: {
                                    weight: 'bold',
                                    size: 12,
                                    family: 'Montserrat'
                                }
                            },
                            grid: {
                                display: false
                            },
                            ticks: {
                                maxRotation: labels.length > 10 ? 45 : 0, // ДОБАВЛЯЕМ: автоматический поворот
                                minRotation: 0,
                                autoSkip: labels.length > 20, // ДОБАВЛЯЕМ: автоматический пропуск
                                font: {
                                    size: labels.length > 15 ? 10 : 11, // ДОБАВЛЯЕМ: адаптивный размер шрифта
                                    family: 'Montserrat'
                                }
                            }
                        }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            right: 20,
                            bottom: 20,
                            left: 10
                        }
                    }
                }
            };

            // Добавляем нормативную линию только для линейного графика
            if (chartType === 'line') {
                config.data.datasets.push({
                    label: 'Норматив (80%)',
                    data: Array(labels.length).fill(80),
                    type: 'line',
                    borderColor: chartColors.normative,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    order: 0
                });
            }
            
            state.charts = state.charts || {};
            state.charts.serviceLevel = new Chart(ctx, config);
        }
        /**
         * Создает график удовлетворенности клиентов
         */
        function createSatisfactionChart(data, labels, periodType) {
            const canvas = document.getElementById('satisfaction-chart');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            
            // Извлекаем данные удовлетворенности с проверкой на суммарные данные
            let satisfactionData = [];
            
            if (periodType === 'month' && state.dataType === 'summary') {
                const totalRow = data.find(row => row.report_date === 'Итого');
                
                if (totalRow && totalRow.ics_result !== null && totalRow.ics_result !== undefined) {
                    satisfactionData = data
                        .filter(row => row.report_date !== 'Итого')
                        .map(() => totalRow.ics_result);
                } else {
                    satisfactionData = data
                        .filter(row => row.report_date !== 'Итого')
                        .map(row => row.ics_result);
                }
            } else if (periodType === 'year' && state.dataType === 'summary') {
                const totalRow = data.find(row => row.report_date === 'Итого');
                
                if (totalRow && totalRow.ics_result !== null && totalRow.ics_result !== undefined) {
                    satisfactionData = data
                        .filter(row => row.report_date !== 'Итого')
                        .map(() => totalRow.ics_result);
                } else {
                    satisfactionData = data
                        .filter(row => row.report_date !== 'Итого')
                        .map(row => row.ics_result);
                }
            } else {
                satisfactionData = data
                    .filter(row => row.report_date !== 'Итого')
                    .map(row => row.ics_result);
            }
            
            const validData = satisfactionData.filter(v => v !== null && v !== undefined && !isNaN(v));
            
            if (validData.length === 0) {
                console.warn('Нет данных для графика удовлетворенности');
                satisfactionData = Array(labels.length).fill(null);
            }
            
            // Получаем тип графика из состояния
            const chartType = state.chartTypes.satisfaction || 'line';
            
            // Получаем ширину контейнера и рассчитываем ширину столбцов
            const containerWidth = getChartContainerWidth('satisfaction-chart');
            const barThickness = calculateBarThickness(labels.length, chartType, containerWidth);
            
            let yAxisMin = 0;
            let yAxisMax = 5.0;
            
            if (validData.length > 0) {
                const minValue = Math.min(...validData);
                const maxValue = Math.max(...validData);
                const padding = Math.max(0.1, (maxValue - minValue) * 0.1);
                
                yAxisMin = Math.max(0, Math.floor((minValue - padding) * 100) / 100);
                yAxisMax = Math.min(5.0, Math.ceil((maxValue + padding) * 100) / 100);
            }
            
            const config = {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Удовлетворенность',
                        data: satisfactionData,
                        backgroundColor: chartType === 'line' ? 
                            adjustColorOpacity(chartColors.primary, 0.1) : 
                            adjustColorOpacity(chartColors.primary, 0.8),
                        borderColor: chartColors.primary,
                        borderWidth: chartType === 'line' ? 2 : 0,
                        pointRadius: chartType === 'line' ? 4 : undefined,
                        pointBackgroundColor: chartType === 'line' ? chartColors.primary : undefined,
                        pointBorderColor: chartType === 'line' ? '#ffffff' : undefined,
                        pointBorderWidth: chartType === 'line' ? 2 : undefined,
                        tension: chartType === 'line' ? 0.1 : undefined,
                        fill: false,
                        borderRadius: chartType === 'bar' ? 4 : undefined,
                        barThickness: barThickness, // ДОБАВЛЯЕМ: автоматическая ширина
                        spanGaps: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: false
                        },
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderWidth: 1,
                            callbacks: {
                                title: function(items) {
                                    return `${getAxisTitle(periodType)}: ${items[0].label}`;
                                },
                                label: function(item) {
                                    const value = item.raw;
                                    
                                    if (value === null || value === undefined || isNaN(value)) {
                                        return 'Удовлетворенность: Нет данных';
                                    }
                                    
                                    return `Удовлетворенность: ${formatSatisfactionValue(value)}`;
                                }
                            },
                            filter: function(tooltipItem) {
                                return true;
                            }
                        },
                        datalabels: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            min: yAxisMin,
                            max: yAxisMax,
                            ticks: {
                                stepSize: 0.01,
                                maxTicksLimit: 21,
                                callback: function(value, index) {
                                    return formatSatisfactionValue(value);
                                },
                                font: {
                                    size: 12,
                                    family: 'Montserrat'
                                }
                            },
                            title: {
                                display: true,
                                text: 'Удовлетворенность',
                                font: {
                                    weight: 'bold',
                                    size: 12,
                                    family: 'Montserrat'
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: getAxisTitle(periodType),
                                font: {
                                    weight: 'bold',
                                    size: 12,
                                    family: 'Montserrat'
                                }
                            },
                            grid: {
                                display: false
                            },
                            ticks: {
                                callback: function(value, index) {
                                    const label = this.getLabelForValue(value);
                                    if (label && label.length > 15) {
                                        return label.substring(0, 12) + '...';
                                    }
                                    return label;
                                },
                                maxRotation: labels.length > 10 ? 45 : 0, // ДОБАВЛЯЕМ: автоматический поворот
                                minRotation: 0,
                                autoSkip: labels.length > 20, // ДОБАВЛЯЕМ: автоматический пропуск
                                font: {
                                    size: labels.length > 15 ? 10 : 11, // ДОБАВЛЯЕМ: адаптивный размер шрифта
                                    family: 'Montserrat'
                                }
                            }
                        }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            right: 20,
                            bottom: 20,
                            left: 10
                        }
                    },
                    onClick: (e, elements, chart) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const value = chart.data.datasets[0].data[index];
                            const label = chart.data.labels[index];
                            
                            const filteredData = data.filter(row => row.report_date !== 'Итого');
                            const rowData = filteredData[index];
                            
                            if (rowData) {
                                showDataPointDetails({
                                    date: label,
                                    calls: rowData.received_calls,
                                    row: rowData
                                });
                            }
                        }
                    }
                }
            };
            
            if (state.charts && state.charts.satisfactionChart) {
                state.charts.satisfactionChart.destroy();
            }
            
            state.charts = state.charts || {};
            state.charts.satisfactionChart = new Chart(ctx, config);
        }

        /**
         * НОВАЯ ФУНКЦИЯ: Проверяет наличие данных удовлетворенности в массиве
         */
        function hasSatisfactionData(data) {
            if (!data || !Array.isArray(data)) {
                return false;
            }
            
            // Проверяем есть ли хотя бы одно валидное значение ics_result
            return data.some(row => {
                const value = row.ics_result;
                return value !== null && value !== undefined && !isNaN(value) && value !== '';
            });
        }

        /**
         * НОВАЯ ФУНКЦИЯ: Получает суммарное значение удовлетворенности для периода
         */
        function getSummaryValue(data, field) {
            if (!data || !Array.isArray(data)) {
                return null;
            }
            
            // Сначала ищем в строке "Итого"
            const totalRow = data.find(row => row.report_date === 'Итого');
            if (totalRow && totalRow[field] !== null && totalRow[field] !== undefined && !isNaN(totalRow[field])) {
                return totalRow[field];
            }
            
            // Если нет итоговой строки, вычисляем среднее из валидных значений
            const validValues = data
                .filter(row => row.report_date !== 'Итого')
                .map(row => row[field])
                .filter(value => value !== null && value !== undefined && !isNaN(value));
            
            if (validValues.length === 0) {
                return null;
            }
            
            // Для удовлетворенности берем среднее арифметическое
            if (field === 'ics_result') {
                return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
            }
            
            // Для остальных полей - тоже среднее
            return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
        }
    
    /**
     * Форматирует значение удовлетворенности с сотыми долями
     */
        function formatSatisfactionValue(value) {
        if (value === null || value === undefined || isNaN(value)) {
            return '-';
        }
        
        // Показываем 2 знака после запятой и заменяем точку на запятую
        return Number(value).toFixed(2).replace('.', ',');
    }

    /**
     * Создает график времени ожидания
     */
        function createWaitTimeChart(data, labels, periodType) {
            const waitTimeData = data.map(row => row.awt_result);
            
            // Получаем тип графика из состояния
            const chartType = state.chartTypes.waitTime || 'line';
            
            // Получаем ширину контейнера и рассчитываем ширину столбцов
            const containerWidth = getChartContainerWidth('wait-time-chart');
            const barThickness = calculateBarThickness(labels.length, chartType, containerWidth);
            
            const maxValue = Math.max(...waitTimeData.filter(v => v !== null && !isNaN(v)));
            const suggestedMax = Math.ceil(maxValue * 1.1);
            
            const config = {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Время ожидания (сек)',
                        data: waitTimeData,
                        backgroundColor: chartType === 'line' ? 
                            adjustColorOpacity(chartColors.primary, 0.1) : 
                            adjustColorOpacity(chartColors.primary, 0.8),
                        borderColor: chartColors.primary,
                        borderWidth: chartType === 'line' ? 2 : 0,
                        pointRadius: chartType === 'line' ? 4 : undefined,
                        pointBackgroundColor: chartType === 'line' ? chartColors.primary : undefined,
                        tension: chartType === 'line' ? 0.1 : undefined,
                        fill: false,
                        borderRadius: chartType === 'bar' ? 4 : undefined,
                        barThickness: barThickness // ДОБАВЛЯЕМ: автоматическая ширина
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: false
                        },
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                title: function(items) {
                                    return `${getAxisTitle(periodType)}: ${items[0].label}`;
                                },
                                label: function(item) {
                                    const value = item.raw;
                                    return `Время ожидания: ${formatValue(value)} сек`;
                                }
                            }
                        },
                        datalabels: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            suggestedMax: suggestedMax,
                            title: {
                                display: true,
                                text: 'Время ожидания (сек)',
                                font: {
                                    weight: 'bold',
                                    size: 12,
                                    family: 'Montserrat'
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                                callback: function(value, index) {
                                    return formatValue(value) + ' с';
                                },
                                font: {
                                    size: 12,
                                    family: 'Montserrat'
                                }
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: getAxisTitle(periodType),
                                font: {
                                    weight: 'bold',
                                    size: 12,
                                    family: 'Montserrat'
                                }
                            },
                            grid: {
                                display: false
                            },
                            ticks: {
                                callback: function(value, index) {
                                    const label = this.getLabelForValue(value);
                                    if (label && label.length > 15) {
                                        return label.substring(0, 12) + '...';
                                    }
                                    return label;
                                },
                                maxRotation: labels.length > 10 ? 45 : 0, // ДОБАВЛЯЕМ: автоматический поворот
                                minRotation: 0,
                                autoSkip: labels.length > 20, // ДОБАВЛЯЕМ: автоматический пропуск
                                font: {
                                    size: labels.length > 15 ? 10 : 11, // ДОБАВЛЯЕМ: адаптивный размер шрифта
                                    family: 'Montserrat'
                                }
                            }
                        }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            right: 20,
                            bottom: 20,
                            left: 10
                        }
                    },
                    onClick: (e, elements, chart) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const value = chart.data.datasets[0].data[index];
                            const label = chart.data.labels[index];
                            
                            showDataPointDetails({
                                date: label,
                                calls: data[index].received_calls,
                                row: data[index]
                            });
                        }
                    }
                }
            };
            
            const canvas = document.getElementById('wait-time-chart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                state.charts = state.charts || {};
                state.charts.waitTimeChart = new Chart(ctx, config);
            }
        }
            
    /**
     * Создает график AHT (Average Handling Time)
     */
    function createAHTChart(data, labels, periodType) {
        const ahtData = data.map(row => row.aht_result);
        
        // Получаем тип графика из состояния
        const chartType = state.chartTypes.aht || 'line';
        
        // Получаем ширину контейнера и рассчитываем ширину столбцов
        const containerWidth = getChartContainerWidth('aht-chart');
        const barThickness = calculateBarThickness(labels.length, chartType, containerWidth);
        
        const maxValue = Math.max(...ahtData.filter(v => v !== null && !isNaN(v)));
        const suggestedMax = Math.ceil(maxValue * 1.1);
        
        const config = {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: 'AHT (сек)',
                    data: ahtData,
                    backgroundColor: chartType === 'line' ? 
                        adjustColorOpacity(chartColors.tertiary, 0.1) : 
                        adjustColorOpacity(chartColors.tertiary, 0.8),
                    borderColor: chartColors.tertiary,
                    borderWidth: chartType === 'line' ? 2 : 0,
                    pointRadius: chartType === 'line' ? 4 : undefined,
                    pointBackgroundColor: chartType === 'line' ? chartColors.tertiary : undefined,
                    tension: chartType === 'line' ? 0.1 : undefined,
                    fill: false,
                    borderRadius: chartType === 'bar' ? 4 : undefined,
                    barThickness: barThickness
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(items) {
                                return `${getAxisTitle(periodType)}: ${items[0].label}`;
                            },
                            label: function(item) {
                                const value = item.raw;
                                return `AHT: ${formatValue(value)} сек`;
                            }
                        }
                    },
                    datalabels: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: suggestedMax,
                        title: {
                            display: true,
                            text: 'AHT (сек)',
                            font: {
                                weight: 'bold',
                                size: 12,
                                family: 'Montserrat'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value, index) {
                                return formatValue(value) + ' с';
                            },
                            font: {
                                size: 12,
                                family: 'Montserrat'
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: getAxisTitle(periodType),
                            font: {
                                weight: 'bold',
                                size: 12,
                                family: 'Montserrat'
                            }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            callback: function(value, index) {
                                const label = this.getLabelForValue(value);
                                if (label && label.length > 15) {
                                    return label.substring(0, 12) + '...';
                                }
                                return label;
                            },
                            maxRotation: labels.length > 10 ? 45 : 0,
                            minRotation: 0,
                            autoSkip: labels.length > 20,
                            font: {
                                size: labels.length > 15 ? 10 : 11,
                                family: 'Montserrat'
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 10,
                        right: 20,
                        bottom: 20,
                        left: 10
                    }
                },
                onClick: (e, elements, chart) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const value = chart.data.datasets[0].data[index];
                        const label = chart.data.labels[index];
                        
                        showDataPointDetails({
                            date: label,
                            calls: data[index].received_calls,
                            row: data[index]
                        });
                    }
                }
            }
        };
        
        const canvas = document.getElementById('aht-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            state.charts = state.charts || {};
            state.charts.ahtChart = new Chart(ctx, config);
        }
    }
            
    /**
     * Создает общую легенду для графиков сравнения
     */
    function createComparisonLegend(periods) {
        const legendContainer = document.getElementById('chart-legend-container');
        if (!legendContainer) return;
        
        legendContainer.innerHTML = '';
        
        const legendTitle = document.createElement('h4');
        legendTitle.textContent = 'Сравниваемые периоды:';
        legendTitle.style.cssText = `
            margin: 0 0 15px 0;
            font-size: 15px;
            font-weight: 600;
            color: #2c3e50;
            font-family: 'Montserrat', sans-serif;
            text-align: center;
        `;
        legendContainer.appendChild(legendTitle);
        
        const legendItems = document.createElement('div');
        legendItems.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            justify-content: center;
            align-items: center;
            padding: 8px 0;
        `;
        
        periods.forEach((period, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'chart-legend-item compact';
            legendItem.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border-radius: 20px;
                background: white;
                border: 1px solid ${period.color};
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
                transition: all 0.3s ease;
                cursor: pointer;
                font-size: 13px;
                font-family: 'Montserrat', sans-serif;
            `;
            
            const lineIndicator = document.createElement('div');
            lineIndicator.style.cssText = `
                width: 24px;
                height: 3px;
                border-radius: 2px;
                flex-shrink: 0;
            `;
            
            if (period.isMainPeriod) {
                lineIndicator.style.backgroundColor = period.color;
            } else {
                lineIndicator.style.cssText += `
                    background: repeating-linear-gradient(
                        to right,
                        ${period.color} 0px,
                        ${period.color} 6px,
                        transparent 6px,
                        transparent 10px
                    );
                `;
            }
            
            // ИСПРАВЛЯЕМ: Показываем реальные даты вместо "Основной период + цвет"
            const labelText = document.createElement('span');
            labelText.style.cssText = `
                font-weight: ${period.isMainPeriod ? '600' : '500'};
                color: #2c3e50;
                white-space: nowrap;
            `;
            
            // НОВАЯ ЛОГИКА: Извлекаем и форматируем даты из period.label
            let displayText = period.label;
            
            // Убираем лишний текст и оставляем только даты
            if (period.label.includes(' (основной период)')) {
                displayText = period.label.replace(' (основной период)', '');
            }
            if (period.label.includes(' (сравнение)')) {
                displayText = period.label.replace(' (сравнение)', '');
            }
            
            // Для часовых периодов убираем время и оставляем только дату
            if (state.periodType.startsWith('hour')) {
                // Паттерн: "20.06.2025, 14:00:00 — 20.06.2025, 16:00:00" 
                // Преобразуем в: "20.06.2025 (14:00-16:00)"
                const hourPattern = /(\d{2}\.\d{2}\.\d{4}),\s*(\d{2}):(\d{2}):\d{2}\s*—\s*(\d{2}\.\d{2}\.\d{4}),\s*(\d{2}):(\d{2}):\d{2}/;
                const hourMatch = displayText.match(hourPattern);
                
                if (hourMatch) {
                    const [, startDate, startHour, startMin, endDate, endHour, endMin] = hourMatch;
                    
                    if (startDate === endDate) {
                        // Один день
                        displayText = `${startDate} (${startHour}:${startMin}-${endHour}:${endMin})`;
                    } else {
                        // Разные дни
                        displayText = `${startDate} ${startHour}:${startMin} — ${endDate} ${endHour}:${endMin}`;
                    }
                }
            }
            
            // Для произвольного периода форматируем даты
            if (state.periodType.startsWith('custom')) {
                // Паттерн: "20.06.2025 — 22.06.2025"
                const customPattern = /(\d{1,2})\.(\d{1,2})\.(\d{4})\s*—\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/;
                const customMatch = displayText.match(customPattern);
                
                if (customMatch) {
                    const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = customMatch;
                    
                    if (startYear === endYear && startMonth === endMonth) {
                        // Один месяц
                        displayText = `${startDay}-${endDay}.${startMonth}.${startYear}`;
                    } else if (startYear === endYear) {
                        // Один год
                        displayText = `${startDay}.${startMonth}-${endDay}.${endMonth}.${startYear}`;
                    } else {
                        // Разные годы - оставляем как есть
                        displayText = `${startDay}.${startMonth}.${startYear} — ${endDay}.${endMonth}.${endYear}`;
                    }
                }
            }
            
            labelText.textContent = displayText;
            
            const statusBadge = document.createElement('span');
            statusBadge.style.cssText = `
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 8px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            `;
            
            if (period.isMainPeriod) {
                statusBadge.textContent = 'Основной';
                statusBadge.style.cssText += `
                    background: ${adjustColorOpacity(period.color, 0.2)};
                    color: ${period.color};
                `;
            } else {
                statusBadge.textContent = 'Сравнение';
                statusBadge.style.cssText += `
                    background: #f8f9fa;
                    color: #6c757d;
                `;
            }
            
            legendItem.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-1px)';
                this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
            });
            
            legendItem.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.08)';
            });
            
            legendItem.appendChild(lineIndicator);
            legendItem.appendChild(labelText);
            legendItem.appendChild(statusBadge);
            
            legendItems.appendChild(legendItem);
        });
        
        legendContainer.appendChild(legendItems);
        
        // ИЗМЕНЯЕМ: Более понятная подсказка
        const infoHint = document.createElement('div');
        infoHint.style.cssText = `
            margin-top: 10px;
            padding: 8px 12px;
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 16px;
            font-size: 11px;
            font-family: 'Montserrat', sans-serif;
            color: #6c757d;
            text-align: center;
            line-height: 1.3;
        `;
        infoHint.textContent = 'Основной период отображается сплошной линией, периоды сравнения — пунктирными линиями';
        
        legendContainer.appendChild(infoHint);
    }

    /**
     * НОВАЯ ФУНКЦИЯ: Форматирует дату для отображения в легенде
     */
    function formatDateForLegend(dateString, periodType) {
        if (!dateString || dateString === 'Итого') return dateString;
        
        try {
            // Обрабатываем диапазоны дат
            if (dateString.includes(' — ') || dateString.includes(' - ')) {
                const parts = dateString.split(/\s*[—-]\s*/);
                if (parts.length === 2) {
                    const formattedStart = formatSingleDateForLegend(parts[0], periodType);
                    const formattedEnd = formatSingleDateForLegend(parts[1], periodType);
                    
                    // Для диапазонов в одном месяце/году сокращаем
                    if (periodType === 'custom') {
                        const startParts = formattedStart.split('.');
                        const endParts = formattedEnd.split('.');
                        
                        if (startParts.length === 3 && endParts.length === 3) {
                            if (startParts[2] === endParts[2] && startParts[1] === endParts[1]) {
                                // Один месяц
                                return `${startParts[0]}-${endParts[0]}.${startParts[1]}.${startParts[2]}`;
                            } else if (startParts[2] === endParts[2]) {
                                // Один год
                                return `${startParts[0]}.${startParts[1]}-${endParts[0]}.${endParts[1]}.${startParts[2]}`;
                            }
                        }
                    }
                    
                    return `${formattedStart} — ${formattedEnd}`;
                }
            }
            
            return formatSingleDateForLegend(dateString, periodType);
        } catch (error) {
            console.warn('Ошибка форматирования даты для легенды:', error);
            return dateString;
        }
    }

    /**
     * НОВАЯ ФУНКЦИЯ: Форматирует одиночную дату для легенды
     */
    function formatSingleDateForLegend(dateString, periodType) {
        if (!dateString) return '';
        
        // Убираем время, если есть
        const cleanDate = dateString.replace(/,?\s*\d{2}:\d{2}:\d{2}/g, '');
        
        // Обрабатываем разные форматы
        if (cleanDate.includes('.')) {
            const parts = cleanDate.split('.');
            if (parts.length === 3) {
                // DD.MM.YYYY
                return cleanDate;
            }
        }
        
        return cleanDate;
    }
    
    /**
     * Получает цвет для периода сравнения
     */
    function getComparisonColor(index, isMainPeriod = false) {
        if (isMainPeriod) {
            return chartColors.primary;
        }
        
        const contrastColors = [
            chartColors.secondary,
            chartColors.tertiary,
            chartColors.quaternary,
            chartColors.quinary,
            chartColors.teal,
            chartColors.indigo,
            chartColors.pink,
            chartColors.amber,
            chartColors.lime
        ];
        
        return index < contrastColors.length 
            ? contrastColors[index]
            : generateDistinctColor(index);
    }

    /**
     * Генерирует отличительный цвет для больших индексов
     */
    function generateDistinctColor(index) {
        const goldenRatio = 0.618033988749895;
        const hue = (index * goldenRatio * 360) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }
    
    /**
     * Генерирует набор цветовых оттенков на основе базового цвета
     */
    function generateColorShades(baseColor, count) {
        let r = parseInt(baseColor.slice(1, 3), 16);
        let g = parseInt(baseColor.slice(3, 5), 16);
        let b = parseInt(baseColor.slice(5, 7), 16);
        
        const colors = [];
        
        colors.push(baseColor);
        
        if (count <= 1) return colors;
        
        const step = Math.max(1, Math.floor(200 / (count - 1)));
        
        for (let i = 1; i < count; i++) {
            r = Math.min(255, r + step);
            g = Math.min(255, g + step);
            b = Math.min(255, b + step);
            
            colors.push(`rgb(${r}, ${g}, ${b})`);
        }
        
        return colors;
    }
    
    /**
     * Сортирует данные для отображения на графике
     */
    function sortChartData(data, periodType) {
        if (!data || data.length <= 1) return data;
        
        const sortedData = [...data];
        
        switch (periodType) {
            case 'month':
                sortedData.sort((a, b) => {
                    const dateA = parseDate(a.report_date);
                    const dateB = parseDate(b.report_date);
                    
                    if (!dateA || !dateB) {
                        if (a.report_date === 'Итого') return 1;
                        if (b.report_date === 'Итого') return -1;
                        return 0;
                    }
                    
                    return dateA - dateB;
                });
                break;
                
            case 'year':
                sortedData.sort((a, b) => {
                    if (a.report_date === 'Итого') return 1;
                    if (b.report_date === 'Итого') return -1;
                    
                    const yearA = a.report_date.match(/\d{4}$/);
                    const yearB = b.report_date.match(/\d{4}$/);
                    
                    if (yearA && yearB) {
                        return parseInt(yearA[0]) - parseInt(yearB[0]);
                    }
                    
                    return 0;
                });
                break;
                
            case 'hour':
                sortedData.sort((a, b) => {
                    if (a.report_date === 'Итого') return 1;
                    if (b.report_date === 'Итого') return -1;
                    
                    const hourA = parseInt(a.report_hour?.match(/^\d+/)?.[0] || '0');
                    const hourB = parseInt(b.report_hour?.match(/^\d+/)?.[0] || '0');
                    
                    return hourA - hourB;
                });
                break;
                
            case 'custom':
            default:
                sortedData.sort((a, b) => {
                    const dateA = parseDate(a.report_date);
                    const dateB = parseDate(b.report_date);
                    
                    if (!dateA || !dateB) {
                        if (a.report_date === 'Итого') return 1;
                        if (b.report_date === 'Итого') return -1;
                        return 0;
                    }
                    
                    return dateA - dateB;
                });
                break;
        }
        
        return sortedData;
    }
    
    /**
     * Форматирует метку для графика в зависимости от типа периода
     */
    function formatLabelForChart(row, periodType) {
        switch (periodType) {
            case 'month':
                return formatPeriodDate(row.report_date, 'month');
                
            case 'year':
                return formatPeriodDate(row.report_date, 'year');
                
            case 'hour':
                if (row.report_hour) {
                    const hourMatch = row.report_hour.match(/^(\d+)/);
                    if (hourMatch) {
                        return `${hourMatch[1]}:00`;
                    }
                    return row.report_hour;
                }
                return '';
                
            case 'custom':
            default:
                return formatPeriodDate(row.report_date, 'custom');
        }
    }
    
    /**
     * Возвращает заголовок оси X в зависимости от типа периода
     */
    function getAxisTitle(periodType) {
        switch (periodType) {
            case 'month': return 'Месяц';
            case 'year': return 'Год';
            case 'hour': return 'Час';
            case 'custom': return 'Дата';
            default: return 'Период';
        }
    }
    
    /**
     * Регулирует прозрачность цвета
     */
    function adjustColorOpacity(color, opacity) {
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        } else if (color.startsWith('rgb(') || color.startsWith('rgba(')) {
            const rgbValues = color.replace(/rgba?|\(|\)/g, '').split(',');
            
            if (rgbValues.length >= 3) {
                const r = rgbValues[0].trim();
                const g = rgbValues[1].trim();
                const b = rgbValues[2].trim();
                
                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
            }
        }
        
        return color;
    }
    
    /**
     * Показывает индикатор загрузки на всей странице
     */
    function showLoading() {
        let loadingOverlay = document.getElementById('global-loading-overlay');
        
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'global-loading-overlay';
            loadingOverlay.className = 'loading-indicator';
            loadingOverlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-message">Загрузка данных...</div>
            `;
            
            loadingOverlay.style.position = 'fixed';
            loadingOverlay.style.top = '0';
            loadingOverlay.style.left = '0';
            loadingOverlay.style.width = '100%';
            loadingOverlay.style.height = '100%';
            loadingOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            loadingOverlay.style.display = 'flex';
            loadingOverlay.style.flexDirection = 'column';
            loadingOverlay.style.alignItems = 'center';
            loadingOverlay.style.justifyContent = 'center';
            loadingOverlay.style.zIndex = '9999';
            
            document.body.appendChild(loadingOverlay);
        } else {
            loadingOverlay.style.display = 'flex';
        }
    }
    
    /**
     * Скрывает индикатор загрузки
     */
    function hideLoading() {
        const loadingOverlay = document.getElementById('global-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
    
    /**
     * Показывает индикатор загрузки на графике
     */
    function showChartLoading() {
        const chartWrapper = document.querySelector('.chart-wrapper');
        if (!chartWrapper) return;
        
        let chartLoading = document.getElementById('chart-loading');
        
        if (!chartLoading) {
            chartLoading = document.createElement('div');
            chartLoading.id = 'chart-loading';
            chartLoading.className = 'chart-loading';
            chartLoading.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-message">Загрузка графика...</div>
            `;
            
            chartWrapper.appendChild(chartLoading);
        } else {
            chartLoading.style.display = 'flex';
        }
    }
    
    /**
     * Скрывает индикатор загрузки на графике
     */
    function hideChartLoading() {
        const chartLoading = document.getElementById('chart-loading');
        if (chartLoading) {
            chartLoading.style.display = 'none';
        }
    }
    
    /**
     * Показывает ошибку на графике
     */
    function showChartError(message) {
        const chartWrapper = document.querySelector('.chart-wrapper');
        if (!chartWrapper) return;
        
        let chartError = document.getElementById('chart-error');
        
        if (!chartError) {
            chartError = document.createElement('div');
            chartError.id = 'chart-error';
            chartError.className = 'chart-error';
            chartError.textContent = message;
            
            chartWrapper.appendChild(chartError);
        } else {
            chartError.textContent = message;
            chartError.style.display = 'block';
        }
    }
    
    /**
     * Показывает детальную информацию о точке на графике
     */
    function showDataPointDetails(data) {
        if (!data || !data.row) return;
        
        const row = data.row;
        
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        
        const modal = document.createElement('div');
        modal.className = 'data-point-modal';
        modal.style.backgroundColor = 'white';
        modal.style.padding = '20px';
        modal.style.borderRadius = '8px';
        modal.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
        modal.style.maxWidth = '90%';
        modal.style.width = '500px';
        modal.style.maxHeight = '90vh';
        modal.style.overflow = 'auto';
        modal.style.zIndex = '10001';
        modal.style.position = 'relative';
        
        const header = document.createElement('div');
        header.style.borderBottom = '1px solid #eee';
        header.style.marginBottom = '15px';
        header.style.paddingBottom = '10px';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        
        const title = document.createElement('h3');
        title.textContent = 'Детальная информация';
        title.style.margin = '0';
        title.style.fontSize = '18px';
        title.style.color = '#333';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.backgroundColor = 'transparent';
        closeBtn.style.border = 'none';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.padding = '0';
        closeBtn.style.lineHeight = '1';
        closeBtn.style.color = '#999';
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        const content = document.createElement('div');
        
        const dateBlock = document.createElement('p');
        dateBlock.innerHTML = `<strong>Период:</strong> <span>${data.date}</span>`;
        content.appendChild(dateBlock);
        
        const callsBlock = document.createElement('p');
        callsBlock.innerHTML = `<strong>Количество вызовов:</strong> <span>${formatNumber(row.received_calls)}</span>`;
        content.appendChild(callsBlock);
        
        const slBlock = document.createElement('p');
        const slValue = formatValue(row.sl_result);
        const slClass = row.sl_result >= 80 ? 'positive' : 'negative';
        slBlock.innerHTML = `<strong>Service Level:</strong> <span class="${slClass}">${slValue}%</span>`;
        
        if (row.sl_result < 80) {
            const slDiff = 80 - row.sl_result;
            slBlock.innerHTML += ` <span class="negative">(Ниже норматива на ${formatValue(slDiff)}%)</span>`;
        } else if (row.sl_result > 80) {
            const slDiff = row.sl_result - 80;
            slBlock.innerHTML += ` <span class="positive">(Выше норматива на ${formatValue(slDiff)}%)</span>`;
        }
        
        content.appendChild(slBlock);
        
        const satisfactionBlock = document.createElement('p');
        satisfactionBlock.innerHTML = `<strong>Удовлетворенность:</strong> <span>${formatSatisfactionValue(row.ics_result)}</span>`;
        content.appendChild(satisfactionBlock);
        
        const waitTimeBlock = document.createElement('p');
        waitTimeBlock.innerHTML = `<strong>Среднее время ожидания:</strong> <span>${formatValue(row.awt_result)} сек</span>`;
        content.appendChild(waitTimeBlock);
        
        const ahtBlock = document.createElement('p');
        ahtBlock.innerHTML = `<strong>AHT (среднее время обработки):</strong> <span>${formatValue(row.aht_result)} сек</span>`;
        content.appendChild(ahtBlock);
        
        const actions = document.createElement('div');
        actions.style.marginTop = '20px';
        actions.style.textAlign = 'right';
        
        const actionBtn = document.createElement('button');
        actionBtn.textContent = 'Закрыть';
        actionBtn.style.backgroundColor = '#FF5100';
        actionBtn.style.color = 'white';
        actionBtn.style.border = 'none';
        actionBtn.style.padding = '8px 16px';
        actionBtn.style.borderRadius = '4px';
        actionBtn.style.cursor = 'pointer';
        
        actions.appendChild(actionBtn);
        
        modal.appendChild(header);
        modal.appendChild(content);
        modal.appendChild(actions);
        
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        
        closeBtn.onclick = function() {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
        };
        
        overlay.onclick = function() {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
        };
        
        actionBtn.onclick = function() {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
        };
    }
    
    /**
     * Экспортирует данные в Excel файл
     */
    function exportToExcel() {
        if (!state.currentData || (Array.isArray(state.currentData) && state.currentData.length === 0)) {
            showNotification('warning', 'Нет данных для экспорта');
            return;
        }
        
        if (typeof XLSX === 'undefined') {
            const xlsxSources = [
                'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
                'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
                '/assets/js/vendor/xlsx.full.min.js'
            ];
            
            loadScriptWithFallback(xlsxSources, 'XLSX')
                .then(() => {
                    if (typeof XLSX !== 'undefined') {
                        performExcelExport();
                    } else {
                        throw new Error('Не удалось найти объект XLSX после загрузки библиотеки');
                    }
                })
                .catch(error => {
                    showNotification('error', `Ошибка загрузки библиотеки XLSX: ${error.message}`);
                });
        } else {
            performExcelExport();
        }
    }
    
    /**
     * Выполняет экспорт данных в Excel
     */
    function performExcelExport() {
        try {
            const wb = XLSX.utils.book_new();
            wb.Props = {
                Title: "Отчет по показателям КЦ",
                Subject: "Отчетность",
                Author: "Система отчетности",
                CreatedDate: new Date()
            };
            
            if (['hour-comparison', 'custom-comparison', 'year-comparison'].includes(state.periodType)) {
                exportComparisonData(wb);
            } else {
                exportStandardData(wb);
            }
            
            createSummarySheet(wb);
            
            const currentDate = new Date();
            const dateStr = currentDate.toISOString().slice(0, 10).replace(/-/g, '');
            const timeStr = currentDate.toTimeString().slice(0, 8).replace(/:/g, '');
            const fileName = `Отчет_КЦ_${dateStr}_${timeStr}.xlsx`;
            
            XLSX.writeFile(wb, fileName);
            showNotification('success', 'Данные успешно экспортированы в Excel');
        } catch (error) {
            showNotification('error', `Ошибка при экспорте в Excel: ${error.message}`);
        }
    }
    
    /**
     * Экспортирует стандартные данные в Excel
     */
    function exportStandardData(wb) {
        let headers = [];
        
        if (state.periodType === 'hour') {
            headers = [
                'Дата', 'Час', 'Количество вызовов', 'Service Level (%)', 
                'Удовлетворенность', 'Среднее время ожидания (сек)', 'AHT (сек)'
            ];
        } else {
            headers = [
                'Период', 'Количество вызовов', 'Service Level (%)', 
                'Удовлетворенность', 'Среднее время ожидания (сек)', 'AHT (сек)'
            ];
        }
        
        const data = [headers];
        
        state.currentData.forEach(row => {
            const rowData = [];
            
            rowData.push(formatPeriodDate(row.report_date, state.periodType));
            
            if (state.periodType === 'hour') {
                rowData.push(row.report_hour || '');
            }
            
            rowData.push(row.received_calls !== null ? row.received_calls : '');
            rowData.push(row.sl_result !== null ? row.sl_result : '');
            rowData.push(row.ics_result !== null ? row.ics_result : '');
            rowData.push(row.awt_result !== null ? row.awt_result : '');
            rowData.push(row.aht_result !== null ? row.aht_result : '');
            
            data.push(rowData);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        const columnsWidth = [
            { wch: 20 },
            { wch: state.periodType === 'hour' ? 10 : 15 },
            { wch: state.periodType === 'hour' ? 15 : 12 },
            { wch: 12 },
            { wch: 15 },
            { wch: 18 },
            { wch: 12 }
        ];
        
        if (state.periodType === 'hour') {
            columnsWidth.push({ wch: 12 });
        }
        
        ws['!cols'] = columnsWidth;
        
        const headerRange = XLSX.utils.decode_range(ws['!ref']);
        for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!ws[cellAddress]) continue;
            
            ws[cellAddress].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: "E6E6E6" } },
                alignment: { horizontal: "center" }
            };
        }
        
        const sheetName = getReportTypeName(state.periodType);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    
    /**
     * Экспортирует данные сравнения в Excel
     */
    function exportComparisonData(wb) {
        state.currentData.forEach((result, index) => {
            if (!result.data || result.data.length === 0) return;
            
            let headers = [];
            
            if (state.periodType.startsWith('hour')) {
                headers = [
                    'Дата', 'Час', 'Количество вызовов', 'Service Level (%)', 
                    'Удовлетворенность', 'Среднее время ожидания (сек)', 'AHT (сек)'
                ];
            } else {
                headers = [
                    'Период', 'Количество вызовов', 'Service Level (%)', 
                    'Удовлетворенность', 'Среднее время ожидания (сек)', 'AHT (сек)'
                ];
            }
            
            const data = [headers];
            
            const exportData = state.dataType === 'detailed' 
                ? result.data.filter(row => row.report_date !== 'Итого')
                : result.data;
            
            exportData.forEach(row => {
                const rowData = [];
                
                const periodType = state.periodType.replace('-comparison', '');
                rowData.push(formatPeriodDate(row.report_date, periodType));
                
                if (state.periodType.startsWith('hour')) {
                    rowData.push(row.report_hour || '');
                }
                
                rowData.push(row.received_calls !== null ? row.received_calls : '');
                rowData.push(row.sl_result !== null ? row.sl_result : '');
                rowData.push(row.ics_result !== null ? row.ics_result : '');
                rowData.push(row.awt_result !== null ? row.awt_result : '');
                rowData.push(row.aht_result !== null ? row.aht_result : '');
                
                data.push(rowData);
            });
            
            const ws = XLSX.utils.aoa_to_sheet(data);
            
            const columnsWidth = [
                { wch: 20 },
                { wch: state.periodType.startsWith('hour') ? 10 : 15 },
                { wch: state.periodType.startsWith('hour') ? 15 : 12 },
                { wch: 12 },
                { wch: 15 },
                { wch: 18 },
                { wch: 12 }
            ];
            
            if (state.periodType.startsWith('hour')) {
                columnsWidth.push({ wch: 12 });
            }
            
            ws['!cols'] = columnsWidth;
            
            const headerRange = XLSX.utils.decode_range(ws['!ref']);
            for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                if (!ws[cellAddress]) continue;
                
                ws[cellAddress].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "E6E6E6" } },
                    alignment: { horizontal: "center" }
                };
            }
            
            const sheetName = result.isMainPeriod 
                ? `Основной период` 
                : `Период ${result.period || index + 1}`;
            
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
    }
    
    /**
     * Создает сводный лист с общей информацией
     */
    function createSummarySheet(wb) {
        const summaryData = [
            ['Сводная информация по отчету'],
            [''],
            ['Дата создания отчета:', new Date().toLocaleDateString()],
            ['Время создания отчета:', new Date().toLocaleTimeString()],
            ['Тип отчета:', getReportTypeName(state.periodType)],
            ['Тип данных:', state.dataType === 'detailed' ? 'Детальные' : 'Суммарные'],
            ['']
        ];
        
        switch (state.periodType) {
            case 'month':
                summaryData.push(['Выбранные месяцы:']);
                state.selectedMonths.forEach(month => {
                    summaryData.push(['', `${month.name} ${month.year}`]);
                });
                break;
                
            case 'year':
                summaryData.push(['Выбранные годы:']);
                state.selectedYears.forEach(year => {
                    summaryData.push(['', `Год ${year.year}`]);
                });
                break;
                
            case 'hour':
            case 'hour-comparison':
                if (elements.startDatetime && elements.endDatetime) {
                    summaryData.push(['Период (часы):']);
                    summaryData.push(['', `С: ${elements.startDatetime.value}`]);
                    summaryData.push(['', `По: ${elements.endDatetime.value}`]);
                }
                break;
                
            case 'custom':
            case 'custom-comparison':
                if (elements.startDate && elements.endDate) {
                    summaryData.push(['Произвольный период:']);
                    summaryData.push(['', `С: ${elements.startDate.value}`]);
                    summaryData.push(['', `По: ${elements.endDate.value}`]);
                }
                break;
        }
        
        if (['hour-comparison', 'custom-comparison', 'year-comparison'].includes(state.periodType)) {
            summaryData.push(['']);
            summaryData.push(['Сравниваемые периоды:']);
            
            state.currentData.forEach((result, index) => {
                const label = result.isMainPeriod 
                    ? `${result.date} (основной период)` 
                    : result.date;
                summaryData.push(['', label]);
            });
        } else if (state.currentData && Array.isArray(state.currentData)) {
            summaryData.push(['']);
            summaryData.push(['Статистика:']);
            summaryData.push(['', `Количество записей: ${state.currentData.length}`]);
            
            const totalCalls = state.currentData
                .filter(row => row.report_date !== 'Итого')
                .reduce((sum, row) => sum + (row.received_calls || 0), 0);
            
            if (totalCalls > 0) {
                summaryData.push(['', `Общее количество вызовов: ${formatNumber(totalCalls)}`]);
            }
        }
        
        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        
        ws['!cols'] = [
            { wch: 25 },
            { wch: 30 }
        ];
        
        if (ws['A1']) {
            ws['A1'].s = {
                font: { bold: true, size: 14 },
                fill: { fgColor: { rgb: "4472C4" } },
                font: { color: { rgb: "FFFFFF" }, bold: true },
                alignment: { horizontal: "center" }
            };
        }
        
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Сводка', 0);
    }
    
    /**
     * Возвращает читаемое название типа отчета
     */
    function getReportTypeName(periodType) {
        switch (periodType) {
            case 'month': return 'По месяцам';
            case 'year': return 'По годам';
            case 'hour': return 'По часам';
            case 'custom': return 'Произвольный период';
            case 'hour-comparison': return 'Сравнение часовых периодов';
            case 'custom-comparison': return 'Сравнение произвольных периодов';
            case 'year-comparison': return 'Сравнение годовых периодов';
            default: return 'Отчет';
        }
    }
    
    /**
     * Очищает форму и сбрасывает состояние
     */
    function clearForm() {
        const activeTab = document.querySelector('.period-tab.active:not([data-target="omni"])');
        const activePeriodType = activeTab ? activeTab.dataset.period : 'custom';
        
        switch (activePeriodType) {
            case 'month':
                clearMonthForm();
                break;
            case 'year':
                clearYearForm();
                break;
            case 'hour':
                clearHourForm();
                break;
            case 'custom':
                clearCustomForm();
                break;
        }
        
        state.currentData = [];
        state.comparisonPeriods = [];
        state.customComparisonPeriods = [];
        
        renderEmptyTable(activePeriodType);
        
        if (elements.chartContainer && elements.chartContainer.classList.contains('active')) {
            hideChart();
        }
        
        showNotification('info', 'Форма очищена');
    }
    
    /**
     * Очищает форму месячного периода
     */
    function clearMonthForm() {
        const monthRows = document.querySelectorAll('.month-row');
        monthRows.forEach((row, index) => {
            if (index > 0) {
                row.remove();
            }
        });
        
        const firstRow = document.querySelector('.month-row');
        if (firstRow) {
            const now = new Date();
            const currentYear = now.getFullYear();
            const monthSelect = firstRow.querySelector('.month-dropdown');
            const yearSelect = firstRow.querySelector('.year-dropdown');
            
            if (monthSelect) {
                monthSelect.value = (now.getMonth() + 1).toString();
            }
            
            if (yearSelect) {
                const yearToSet = currentYear >= DATE_LIMITS.MIN_YEAR ? currentYear : DATE_LIMITS.MIN_YEAR;
                yearSelect.value = yearToSet.toString();
            }
            
            if (monthSelect && yearSelect) {
                updateAvailableMonths(monthSelect, yearSelect);
            }
        }
        
        updateSelectedMonths();
    }
        
    /**
     * Очищает форму годового периода
     */
    function clearYearForm() {
        const yearRows = document.querySelectorAll('.year-row');
        yearRows.forEach((row, index) => {
            if (index > 0) {
                row.remove();
            }
        });
        
        const firstRow = document.querySelector('.year-row');
        if (firstRow) {
            const now = new Date();
            const currentYear = now.getFullYear();
            const yearSelect = firstRow.querySelector('.year-dropdown');
            
            if (yearSelect) {
                const yearToSet = currentYear >= DATE_LIMITS.MIN_YEAR ? currentYear : DATE_LIMITS.MIN_YEAR;
                yearSelect.value = yearToSet.toString();
            }
        }
        
        updateSelectedYears();
    }
    
    /**
     * Очищает форму часового периода
     */
    function clearHourForm() {
        setCurrentDates();
        
        if (elements.dateComparisonContainer) {
            elements.dateComparisonContainer.innerHTML = '';
                }
        
        state.comparisonPeriods = [];
    }
    
    /**
     * Очищает форму произвольного периода
     */
    function clearCustomForm() {
        setCurrentDates();
        
        if (elements.customComparisonContainer) {
            elements.customComparisonContainer.innerHTML = '';
        }
        
        state.customComparisonPeriods = [];
    }
    
    /**
     * Проверяет, загружен ли уже скрипт по URL
     */
    function isScriptLoaded(url) {
        return Array.from(document.getElementsByTagName('script'))
            .some(script => script.src === url);
    }
    
    /**
     * Настраивает Canvas для высокого DPI
     */
    function setupCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const devicePixelRatio = window.devicePixelRatio || 1;
        const backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
                                 ctx.mozBackingStorePixelRatio ||
                                 ctx.msBackingStorePixelRatio ||
                                 ctx.oBackingStorePixelRatio ||
                                 ctx.backingStorePixelRatio || 1;
        
        const ratio = devicePixelRatio / backingStoreRatio;
        
        if (devicePixelRatio !== backingStoreRatio) {
            const oldWidth = canvas.width;
            const oldHeight = canvas.height;
            
            canvas.width = oldWidth * ratio;
            canvas.height = oldHeight * ratio;
            
            canvas.style.width = oldWidth + 'px';
            canvas.style.height = oldHeight + 'px';
            
            ctx.scale(ratio, ratio);
        }
    }
    
    // Публичный API модуля
    return {
        // Инициализирует модуль
        init: function() {
            init();
        },
        
        // Устанавливает даты для произвольного периода
        setDates: function(startDate, endDate) {
            if (elements.startDate) elements.startDate.value = startDate;
            if (elements.endDate) elements.endDate.value = endDate;
        },
        
        // Загружает данные с дополнительными параметрами
        loadData: function(params = {}) {
            Object.assign(state, params);
            loadReportData();
        },
        
        // Обновляет модуль или его части
        update: function(updateType = 'all') {
            switch (updateType) {
                case 'data':
                    loadReportData();
                    break;
                case 'chart':
                    if (elements.chartContainer && elements.chartContainer.classList.contains('active')) {
                        updateChart(state.currentData, state.periodType);
                    }
                    break;
                case 'table':
                    if (state.currentData && state.currentData.length > 0) {
                        renderTableData(state.currentData, state.periodType);
                    }
                    break;
                case 'all':
                default:
                    loadReportData();
                    break;
            }
        },
        
        // Возвращает текущее состояние модуля
        getState: function() {
            return state;
        },
        
        // Добавляет строку месяца
        addMonth: function() {
            addMonthRow();
        },
        
        // Добавляет строку года
        addYear: function() {
            addYearRow();
        },
        
        // Добавляет период для сравнения в часовом режиме
        addDateComparison: function() {
            addDateTimeComparisonPeriod();
        },
        
        // Добавляет период для сравнения в произвольном периоде
        addCustomComparison: function() {
            addCustomComparisonPeriod();
        },
        
        // Переключает отображение графика
        toggleChart: function() {
            toggleChart();
        },
        
        // Экспортирует данные в Excel
        export: function() {
            exportToExcel();
        },
        
        // Очищает форму
        clear: function() {
            clearForm();
        },
        
        // Показывает уведомление
        showNotification: function(type, message, options, title) {
            return showNotification(type, message, options, title);
        },
        
        // Переключает тип отчета
        switchReportType: function(type) {
            switchReportType(type);
        },
        
        // Переключает тип данных
        switchDataType: function(type) {
            switchDataType(type);
        },
        
        // Переключает тип периода
        switchPeriodType: function(periodType) {
            switchPeriodType(periodType, 'call');
        },
        
        // Устанавливает выбранные месяцы программно
        setSelectedMonths: function(months) {
            const monthRows = document.querySelectorAll('.month-row');
            monthRows.forEach(row => row.remove());
            
            months.forEach((monthData, index) => {
                addMonthRow();
                
                const rows = document.querySelectorAll('.month-row');
                const currentRow = rows[rows.length - 1];
                
                if (currentRow) {
                    const monthSelect = currentRow.querySelector('.month-dropdown');
                    const yearSelect = currentRow.querySelector('.year-dropdown');
                    
                    if (monthSelect) monthSelect.value = monthData.month.toString();
                    if (yearSelect) yearSelect.value = monthData.year.toString();
                }
            });
            
            updateSelectedMonths();
        },
        
        // Устанавливает выбранные годы программно
        setSelectedYears: function(years) {
            const yearRows = document.querySelectorAll('.year-row');
            yearRows.forEach(row => row.remove());
            
            years.forEach((yearData, index) => {
                addYearRow();
                
                const rows = document.querySelectorAll('.year-row');
                const currentRow = rows[rows.length - 1];
                
                if (currentRow) {
                    const yearSelect = currentRow.querySelector('.year-dropdown');
                    if (yearSelect) yearSelect.value = yearData.year.toString();
                }
            });
            
            updateSelectedYears();
        },
        
        // Получает текущие выбранные месяцы
        getSelectedMonths: function() {
            return state.selectedMonths;
        },
        
        // Получает текущие выбранные годы
        getSelectedYears: function() {
            return state.selectedYears;
        },
        
        // Получает текущие данные
        getCurrentData: function() {
            return state.currentData;
        },
        
        // Устанавливает тип графика для показателя
        setChartType: function(metric, type) {
            if (state.chartTypes.hasOwnProperty(metric)) {
                state.chartTypes[metric] = type;
                
                if (elements.chartContainer && elements.chartContainer.classList.contains('active')) {
                    updateChart(state.currentData, state.periodType);
                }
            }
        },
        
        // Получает типы графиков
        getChartTypes: function() {
            return state.chartTypes;
        },
        
        // Программно показывает график
        showChart: function() {
            showChart();
        },
        
        // Программно скрывает график
        hideChart: function() {
            hideChart();
        },
        
        // Получает элементы DOM
        getElements: function() {
            return elements;
        },
        
        // Обновляет кэш элементов
        refreshElements: function() {
            elements = cacheElements();
        },
        
        // Добавляет пользовательский обработчик событий
        addEventListener: function(event, handler) {
            document.addEventListener(`reportModule.${event}`, handler);
        },
        
        // Удаляет пользовательский обработчик событий
        removeEventListener: function(event, handler) {
            document.removeEventListener(`reportModule.${event}`, handler);
        },
        
        // Запускает пользовательское событие
        dispatchEvent: function(event, data = {}) {
            const customEvent = new CustomEvent(`reportModule.${event}`, { detail: data });
            document.dispatchEvent(customEvent);
        },
        
        // Проверяет готовность модуля
        isReady: function() {
            return elements && Object.keys(elements).length > 0;
        },
        
        // Получает версию модуля
        getVersion: function() {
            return '4.1.0'; // ОБНОВЛЕНО: новая версия с исправлениями
        },
        
        // Проверка совместимости браузера
        checkBrowserCompatibility: function() {
            const isCompatible = !!(
                window.fetch &&
                window.Promise &&
                window.Chart ||
                typeof Chart !== 'undefined'
            );
            
            if (!isCompatible) {
                showNotification('warning', 'Ваш браузер может не поддерживать все функции модуля. Рекомендуется использовать современную версию браузера.');
            }
            
            return isCompatible;
        },
        
        // Отладочная информация
        debug: {
            getState: () => state,
            getElements: () => elements,
            logChartData: () => {
                console.log('Текущие данные графиков:', state.charts);
                console.log('Состояние модуля:', state);
            },
            simulateError: (message = 'Тестовая ошибка') => {
                showNotification('error', message);
            },
            testNotifications: () => {
                setTimeout(() => showNotification('success', 'Тестовое успешное уведомление'), 100);
                setTimeout(() => showNotification('info', 'Тестовое информационное уведомление'), 600);
                setTimeout(() => showNotification('warning', 'Тестовое предупреждение'), 1100);
                setTimeout(() => showNotification('error', 'Тестовая ошибка'), 1600);
            }
        }
    };
})();

// Автоинициализация модуля при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        ReportModule.init();
    });
} else {
    // DOM уже загружен
    ReportModule.init();
}

// Экспортируем модуль в глобальную область видимости
window.ReportModule = ReportModule;

// Совместимость с CommonJS/AMD
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportModule;
}

if (typeof define === 'function' && define.amd) {
    define([], function() {
        return ReportModule;
    });
}