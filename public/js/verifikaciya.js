class VerificationDashboard {
    constructor() {
        // Основные параметры
        this.currentTab = 'general';
        this.currentPeriod = '7';
        this.user = 'Temioka';
        this.timestamp = this.getCurrentTimestamp();
        
        // Коллекции для управления
        this.charts = new Map();
        this.miniCharts = new Map();
        this.pendingCharts = new Map();
        this.data = new Map();
        
        // Конфигурация
        this.config = {
            colors: {
                primary: '#ff6b35',
                secondary: '#ff8555', 
                success: '#10b981',
                warning: '#f59e0b',
                danger: '#ef4444',
                neutral: '#6b7280'
            },
            animation: {
                duration: 1500,
                easing: 'easeInOutCubic'
            }
        };
        
        this.initialize();
        this.applyTableStyles();
    }
    
    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ
    // ==========================================
    
    async initialize() {
        try {
            this.setupEventListeners();
            this.startTimeDisplay();
            await this.loadInitialData();
        } catch (error) {
            this.showNotification('Ошибка инициализации дашборда', 'error');
        }
    }
    
    applyTableStyles() {
        // Добавляем стили для выравнивания таблиц
        const tableStyles = document.createElement('style');
        tableStyles.textContent = `
            .verif-data-table {
                width: 100%;
                border-collapse: collapse;
                font-family: 'Montserrat', sans-serif;
            }
            
            .verif-data-table th,
            .verif-data-table td {
                text-align: center !important;
                vertical-align: middle !important;
                padding: 12px 8px !important;
                border: 1px solid #e5e7eb !important;
                width: auto !important;
            }
            
            .verif-data-table th {
                background-color: #f9fafb !important;
                font-weight: 600 !important;
                color: #374151 !important;
                font-size: 13px !important;
            }
            
            .verif-data-table td {
                font-size: 14px !important;
                color: #1f2937 !important;
                background-color: white !important;
            }
            
            .verif-data-table tbody tr:nth-child(even) td {
                background-color: #f9fafb !important;
            }
            
            .verif-data-table tbody tr:hover td {
                background-color: rgba(255, 107, 53, 0.05) !important;
            }
            
            /* Равная ширина колонок для общей таблицы */
            .verif-data-table th:nth-child(1),
            .verif-data-table td:nth-child(1) { width: 20% !important; }
            .verif-data-table th:nth-child(2),
            .verif-data-table td:nth-child(2) { width: 20% !important; }
            .verif-data-table th:nth-child(3),
            .verif-data-table td:nth-child(3) { width: 20% !important; }
            .verif-data-table th:nth-child(4),
            .verif-data-table td:nth-child(4) { width: 20% !important; }
            .verif-data-table th:nth-child(5),
            .verif-data-table td:nth-child(5) { width: 20% !important; }
            
            /* Анимации для уведомлений */
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(tableStyles);
    }
    
    setupEventListeners() {
        // Переключение вкладок
        document.querySelectorAll('.verif-nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                if (tabName !== this.currentTab) {
                    this.switchTab(tabName);
                }
            });
        });
        
        // Периоды
        document.querySelectorAll('.verif-period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const period = e.currentTarget.dataset.period;
                this.changePeriod(period);
            });
        });
        
        // Пользовательский период
        const applyBtn = document.getElementById('verif-apply-custom');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyCustomDateRange());
        }
        
        // Поиск в таблицах
        document.querySelectorAll('.verif-table-search').forEach(input => {
            input.addEventListener('input', (e) => {
                this.searchInTable(e.target.value);
            });
        });
        
        // Изменение размера окна
        window.addEventListener('resize', this.debounce(() => {
            this.resizeAllCharts();
        }, 250));
    }
    
    startTimeDisplay() {
        this.updateTimeDisplay();
        this.timeDisplayInterval = setInterval(() => {
            this.updateTimeDisplay();
        }, 1000);
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
    // УПРАВЛЕНИЕ ВКЛАДКАМИ
    // ==========================================
    
    async switchTab(tabName) {
        if (this.currentTab === tabName) return;
        
        this.updateActiveTab(tabName);
        this.currentTab = tabName;
        
        await this.waitFor(100);
        await this.loadTabData(tabName);
        
        setTimeout(() => this.createPendingCharts(), 300);
    }
    
    updateActiveTab(tabName) {
        // Обновление вкладок
        document.querySelectorAll('.verif-nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        
        // Обновление панелей
        document.querySelectorAll('.verif-panel-orange').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`panel-${tabName}`)?.classList.add('active');
    }
    
    // ==========================================
    // УПРАВЛЕНИЕ ПЕРИОДАМИ
    // ==========================================
    
    async changePeriod(period) {
        // Обновление кнопок
        document.querySelectorAll('.verif-period-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-period="${period}"]`)?.classList.add('active');
        
        // Управление пользовательским периодом
        const customSection = document.getElementById('verif-custom-period');
        if (customSection) {
            if (period === 'custom') {
                customSection.style.display = 'block';
                return;
            } else {
                customSection.style.display = 'none';
            }
        }
        
        this.currentPeriod = period;
        await this.loadTabData(this.currentTab);
    }
    
    async applyCustomDateRange() {
        const fromInput = document.getElementById('verif-date-from');
        const toInput = document.getElementById('verif-date-to');
        
        if (!fromInput || !toInput) return;
        
        const fromDate = fromInput.value;
        const toDate = toInput.value;
        
        if (!fromDate || !toDate) {
            this.showNotification('Укажите начальную и конечную даты', 'warning');
            return;
        }
        
        if (new Date(fromDate) > new Date(toDate)) {
            this.showNotification('Начальная дата не может быть позже конечной', 'warning');
            return;
        }
        
        this.currentPeriod = `${fromDate}_${toDate}`;
        await this.loadTabData(this.currentTab);
    }
    
    // ==========================================
    // ЗАГРУЗКА ДАННЫХ
    // ==========================================
    
    async loadTabData(tabName) {
        this.showLoading(tabName, true);
        
        try {
            const url = `/api/verification-stats?tab=${tabName}&period=${this.currentPeriod}`;
            const headers = {
                'Content-Type': 'application/json',
                'X-User': this.user,
                'X-Timestamp': this.timestamp
            };
            
            const response = await fetch(url, { headers });
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${result.message || 'Ошибка сервера'}`);
            }
            
            if (result.success && result.data) {
                this.data.set(tabName, result.data);
                await this.updateTabContent(tabName, result.data);
                this.showNotification('Данные обновлены', 'success');
            } else {
                throw new Error(result.message || 'Некорректный ответ сервера');
            }
        } catch (error) {
            this.showNotification(`Ошибка загрузки: ${error.message}`, 'error');
            this.handleLoadingError(tabName);
        } finally {
            this.showLoading(tabName, false);
        }
    }
    
    showLoading(tabName, show) {
        const selectors = [
            `#${tabName}-monthly-loading`,
            `#${tabName}-daily-loading`,
            `#${tabName}-sources-loading`, 
            `#${tabName}-table-loading`
        ];
        
        selectors.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = show ? 'flex' : 'none';
            }
        });
    }
    
    handleLoadingError(tabName) {
        const errorData = {
            totalCount: 0,
            totalAmount: 0,
            confirmedCount: 0,
            monthlyData: { labels: ['Нет данных'], datasets: [{ data: [0], backgroundColor: '#e5e7eb' }] },
            tableData: []
        };
        this.updateTabContent(tabName, errorData);
    }
    
    // ==========================================
    // ОБНОВЛЕНИЕ КОНТЕНТА
    // ==========================================
    
    async updateTabContent(tabName, data) {
        const handlers = {
            'general': (data) => this.updateGeneralTab(data),
            'confirmed': (data) => this.updateConfirmedTab(data), 
            'vpn': (data) => this.updateVpnTab(data)
        };
        
        const handler = handlers[tabName];
        if (handler) {
            try {
                await handler(data);
            } catch (error) {
                this.showNotification('Ошибка обновления контента', 'error');
            }
        }
    }
    
    async updateGeneralTab(data) {
        // Правильные расчеты для общей статистики
        const totalCount = data.totalCount || 0;
        const totalAmount = data.totalAmount || 0;
        const confirmedCount = data.confirmedCount || 0;
        const gisAmount = data.gisAmount || 0;
        
        // Рассчитываем проценты корректно
        const confirmationRate = totalCount > 0 ? this.calculatePercentage(confirmedCount, totalCount) : 0;
        const paidPercentage = totalAmount > 0 ? this.calculatePercentage(gisAmount, totalAmount) : 0;
        
        // Анимация счетчиков
        await Promise.all([
            this.animateCounter('total-trips-count', totalCount),
            this.animateCounter('total-trips-amount', totalAmount, 'currency'),
            this.animateCounter('confirmed-trips-count', confirmedCount),
            this.animateCounter('confirmation-rate', confirmationRate, 'percent'),
            this.animateCounter('gis-amount', gisAmount, 'currency'),
            this.animateCounter('paid-percentage', paidPercentage, 'percent')
        ]);
        
        // Мини-графики
        this.updateMiniChart('summary-chart-1', data.countTrend);
        this.updateMiniChart('summary-chart-2', data.amountTrend);
        this.updateMiniChart('summary-chart-3', data.confirmedTrend);
        this.updateMiniChart('summary-chart-4', data.rateTrend);
        this.updateMiniChart('summary-chart-5', data.amountTrend);
        this.updateMiniChart('summary-chart-6', data.rateTrend);
        
        // Основные графики
        await this.waitFor(300);
        if (data.monthlyData) {
            this.createChart('general-monthly-chart', data.monthlyData, 'bar');
        }
        if (data.dailyData) {
            this.createChart('general-structure-chart', data.dailyData, 'line');
        }
        
        // Таблица
        if (data.tableData) {
            this.updateTable('general-data-table', data.tableData, 'general');
        }
    }
    
    async updateConfirmedTab(data) {
        // Правильные расчеты для подтвержденных поездок
        const confirmedCount = data.confirmedCount || 0;
        const confirmedAmount = data.confirmedAmount || 0;
        const paidCount = data.paidCount || 0;                    // КОЛИЧЕСТВО оплаченных
        const paidAmount = data.paidAmount || 0;                  // СУММА оплаченных
        const avgTime = data.avgTime || 0;
        
        // Правильный расчет процента: количество от количества
        const paidPercentage = confirmedCount > 0 ? this.calculatePercentage(paidCount, confirmedCount) : 0;
        
        // Анимация счетчиков с корректными значениями
        await Promise.all([
            this.animateCounter('confirmed-count', confirmedCount),
            this.animateCounter('confirmed-amount', confirmedAmount, 'currency'),
            this.animateCounter('confirmed-paid-count', paidCount),           // КОЛИЧЕСТВО, не сумма!
            this.animateCounter('confirmed-paid-amount', paidAmount, 'currency'),
            this.animateCounter('confirmed-percentage', paidPercentage, 'percent'),
            this.animateCounter('confirmed-avg-time', avgTime, 'hours')
        ]);
        
        // Мини-графики
        this.updateMiniChart('confirmed-chart-1', data.countTrend);
        this.updateMiniChart('confirmed-chart-2', data.amountTrend);
        this.updateMiniChart('confirmed-chart-3', data.paidTrend);
        this.updateMiniChart('confirmed-chart-4', data.paidTrend);
        this.updateMiniChart('confirmed-chart-5', data.percentageTrend);
        this.updateMiniChart('confirmed-chart-6', data.timeTrend);
        
        // Основные графики
        if (data.monthlyData) {
            this.createChart('confirmed-monthly-chart', data.monthlyData, 'bar');
        }
        if (data.sourcesData) {
            this.createChart('confirmed-sources-chart', data.sourcesData, 'doughnut');
        }
        
        // Таблица
        if (data.tableData) {
            this.updateTable('confirmed-data-table', data.tableData, 'confirmed');
        }
    }
    
    async updateVpnTab(data) {
        // Правильные расчеты для ВПН
        const vpnCount = data.vpnCount || 0;
        const totalVpn = data.totalVpn || 0;
        const corrected = data.corrected || 0;
        const vpnRemoved = data.vpnRemoved || 0;
        const vpnRemovedAmount = data.vpnRemovedAmount || 0;
        
        // Правильный расчет процента скорректированных
        const correctedPercentage = vpnCount > 0 ? this.calculatePercentage(corrected, vpnCount) : 0;
        
        // Анимация счетчиков
        await Promise.all([
            this.animateCounter('vpn-count', vpnCount),
            this.animateCounter('vpn-total', totalVpn, 'currency'),
            this.animateCounter('vpn-corrected', corrected),
            this.animateCounter('vpn-corrected-percentage', correctedPercentage, 'percent'),
            this.animateCounter('vpn-removed', vpnRemoved),
            this.animateCounter('vpn-removed-amount', vpnRemovedAmount, 'currency')
        ]);
        
        // Мини-графики
        this.updateMiniChart('vpn-chart-count', data.countTrend);
        this.updateMiniChart('vpn-chart-1', data.totalTrend);
        this.updateMiniChart('vpn-chart-2', data.correctedTrend);
        this.updateMiniChart('vpn-chart-3', data.correctedTrend);
        this.updateMiniChart('vpn-chart-4', data.removedTrend);
        this.updateMiniChart('vpn-chart-5', data.removedAmountTrend);
        
        // Основной график
        if (data.monthlyData) {
            this.createChart('vpn-monthly-chart', data.monthlyData, 'mixed');
        }
        
        // Таблица
        if (data.tableData) {
            this.updateTable('vpn-data-table', data.tableData, 'vpn');
        }
    }
    
    // ==========================================
    // РАБОТА С ГРАФИКАМИ
    // ==========================================
    
    createChart(canvasId, chartData, chartType) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;
        
        if (!chartData || !chartData.labels || !chartData.datasets) return;
        
        // Проверка видимости
        if (canvas.offsetParent === null) {
            this.pendingCharts.set(canvasId, { data: chartData, type: chartType });
            return;
        }
        
        // Уничтожение существующего
        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
            this.charts.delete(canvasId);
        }
        
        try {
            const config = this.buildChartConfig(chartType, chartData);
            const chart = new Chart(canvas, config);
            this.charts.set(canvasId, chart);
            this.pendingCharts.delete(canvasId);
        } catch (error) {
            // Игнорируем ошибки создания графиков
        }
    }
    
    buildChartConfig(chartType, chartData) {
        const baseConfig = {
            type: chartType === 'mixed' ? 'bar' : chartType,
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: { size: 12, family: 'Montserrat' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: this.config.colors.primary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y || context.parsed;
                                return `${label}: ${this.formatNumber(value)}`;
                            }
                        }
                    }
                },
                animation: this.config.animation
            }
        };
        
        // Настройки осей
        if (!['doughnut', 'pie'].includes(chartType)) {
            baseConfig.options.scales = this.buildScalesConfig(chartType, chartData);
        }
        
        // Специальные настройки для mixed
        if (chartType === 'mixed') {
            baseConfig.options.interaction = {
                mode: 'index',
                intersect: false
            };
        }
        
        return baseConfig;
    }
    
    buildScalesConfig(chartType, chartData) {
        const baseScales = {
            x: {
                grid: { display: false },
                ticks: { 
                    font: { size: 11, family: 'Montserrat' },
                    maxRotation: 45
                }
            },
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: {
                    font: { size: 11, family: 'Montserrat' },
                    callback: (value) => this.formatAxisValue(value)
                }
            }
        };
        
        // Дополнительная ось для mixed
        if (chartType === 'mixed' && chartData.datasets.some(d => d.yAxisID === 'y1')) {
            baseScales.y1 = {
                type: 'linear',
                display: true,
                position: 'right',
                beginAtZero: true,
                grid: { drawOnChartArea: false },
                ticks: {
                    font: { size: 11, family: 'Montserrat' },
                    callback: (value) => this.formatAxisValue(value)
                }
            };
        }
        
        return baseScales;
    }
    
    updateMiniChart(canvasId, chartData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        if (this.miniCharts.has(canvasId)) {
            this.miniCharts.get(canvasId).destroy();
        }
        
        const data = chartData || this.getDefaultTrendData();
        
        const config = {
            type: 'line',
            data: {
                labels: data.labels || ['', '', '', '', '', '', ''],
                datasets: [{
                    data: data.values || [0, 0, 0, 0, 0, 0, 0],
                    borderColor: this.config.colors.primary,
                    backgroundColor: `${this.config.colors.primary}20`,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { display: false } },
                animation: { duration: 1000, easing: 'easeInOutCubic' }
            }
        };
        
        try {
            this.miniCharts.set(canvasId, new Chart(canvas, config));
        } catch (error) {
            // Игнорируем ошибки мини-графиков
        }
    }
    
    createPendingCharts() {
        this.pendingCharts.forEach((chartInfo, canvasId) => {
            const canvas = document.getElementById(canvasId);
            if (canvas && canvas.offsetParent !== null) {
                this.createChart(canvasId, chartInfo.data, chartInfo.type);
            }
        });
    }
    
    resizeAllCharts() {
        [...this.charts.values(), ...this.miniCharts.values()].forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                try {
                    chart.resize();
                } catch (error) {
                    // Игнорируем ошибки изменения размера
                }
            }
        });
    }
    
    // ==========================================
    // РАБОТА С ТАБЛИЦАМИ
    // ==========================================
    
    updateTable(tableId, tableData, tableType) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!tableData || tableData.length === 0) {
            this.showEmptyTableMessage(tbody, tableType);
            return;
        }
        
        this.populateTable(tbody, tableData, tableType);
        this.updateTableCounter(table, tableData.length);
    }
    
    showEmptyTableMessage(tbody, tableType) {
        const emptyRow = document.createElement('tr');
        const colspan = this.getTableColumnCount(tableType);
        emptyRow.innerHTML = `
            <td colspan="${colspan}" style="text-align: center; padding: 2rem; color: #6b7280;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24" style="opacity: 0.3;">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <span>Нет данных для отображения</span>
                </div>
            </td>
        `;
        tbody.appendChild(emptyRow);
    }
    
    populateTable(tbody, tableData, tableType) {
        tableData.forEach((row, index) => {
            const tableRow = document.createElement('tr');
            tableRow.style.opacity = '0';
            tableRow.style.transform = 'translateY(20px)';
            
            tableRow.innerHTML = this.generateTableRowContent(row, tableType);
            tbody.appendChild(tableRow);
            
            // Анимация появления
            const delay = Math.min(index * 50, 1000);
            setTimeout(() => {
                tableRow.style.transition = 'all 0.3s ease-out';
                tableRow.style.opacity = '1';
                tableRow.style.transform = 'translateY(0)';
            }, delay);
        });
    }
    
    generateTableRowContent(row, tableType) {
        switch (tableType) {
            case 'general':
                return `
                    <td>${row.date || '-'}</td>
                    <td>${this.formatNumber(row.trips || 0)}</td>
                    <td>${this.formatCurrency(row.amount || 0)}</td>
                    <td>${this.formatNumber(row.confirmed || 0)}</td>
                    <td>${this.formatPercentage(row.percentage || 0)}</td>
                `;
            
            case 'confirmed':
                return `
                    <td>${row.date || '-'}</td>
                    <td>${this.formatNumber(row.totalTrips || 0)}</td>
                    <td>${this.formatNumber(row.confirmedTrips || 0)}</td>
                    <td>${this.formatNumber(row.adjustedTrips || 0)}</td>
                    <td>${this.formatHours(row.avgTime || 0)}</td>
                `;
            
            case 'vpn':
                return `
                    <td>${row.date || '-'}</td>
                    <td>${this.formatNumber(row.trips || 0)}</td>
                    <td>${this.formatCurrency(row.amount || 0)}</td>
                    <td>${this.formatNumber(row.confirmed || 0)}</td>
                    <td>${this.formatNumber(row.removed || 0)}</td>
                `;
            
            default:
                return '<td colspan="5">Неизвестный тип таблицы</td>';
        }
    }
    
    getTableColumnCount(tableType) {
        switch (tableType) {
            case 'general': return 5;
            case 'confirmed': return 5;
            case 'vpn': return 5;
            default: return 5;
        }
    }
    
    updateTableCounter(table, count) {
        const header = table.closest('.verif-data-table-section')?.querySelector('.verif-table-title');
        if (header) {
            const existingCounter = header.querySelector('.record-count');
            if (existingCounter) existingCounter.remove();
            
            const counter = document.createElement('span');
            counter.className = 'record-count';
            counter.style.cssText = 'margin-left: 10px; font-size: 0.9em; color: #6b7280; font-weight: normal;';
            counter.textContent = `(${count} записей)`;
            header.appendChild(counter);
        }
    }
    
    searchInTable(searchTerm) {
        const table = document.querySelector('.verif-data-table');
        if (!table) return;
        
        const rows = table.querySelectorAll('tbody tr');
        const term = searchTerm.toLowerCase().trim();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const shouldShow = !term || text.includes(term);
            
            row.style.display = shouldShow ? '' : 'none';
            row.style.backgroundColor = shouldShow && term ? 'rgba(255, 107, 53, 0.1)' : '';
        });
    }
    
    // ==========================================
    // АНИМАЦИЯ СЧЕТЧИКОВ
    // ==========================================
    
    async animateCounter(elementId, targetValue, format = 'number') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const startValue = 0;
        const duration = 2000;
        const startTime = performance.now();
        
        return new Promise(resolve => {
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3);
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
                return this.formatPercentage(value);
            case 'hours':
                return this.formatHours(value);
            default:
                return this.formatNumber(value);
        }
    }
    
    // ==========================================
    // УТИЛИТЫ И ФОРМАТИРОВАНИЕ
    // ==========================================
    
    calculatePercentage(value, total) {
        if (!total || total === 0) return 0;
        return Math.round((value / total) * 100 * 10) / 10; // Округление до 1 знака
    }
    
    formatNumber(number) {
        if (typeof number !== 'number' || isNaN(number)) return '0';
        
        if (number >= 1000000000) {
            return (number / 1000000000).toFixed(1) + ' млрд';
        } else if (number >= 1000000) {
            return (number / 1000000).toFixed(1) + ' млн';
        } else if (number >= 1000) {
            return (number / 1000).toFixed(1) + ' тыс.';
        }
        return number.toLocaleString('ru-RU');
    }
    
    formatCurrency(number) {
        return this.formatNumber(number) + ' ₽';
    }
    
    formatPercentage(number) {
        if (typeof number !== 'number' || isNaN(number)) return '0%';
        return number.toFixed(1) + '%';
    }
    
    formatHours(number) {
        if (typeof number !== 'number' || isNaN(number)) return '0ч';
        return number.toFixed(1) + 'ч';
    }
    
    formatAxisValue(value) {
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
        return value.toString();
    }
    
    getCurrentTimestamp() {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }
    
    getDefaultTrendData() {
        return {
            labels: ['', '', '', '', '', '', ''],
            values: [0, 0, 0, 0, 0, 0, 0]
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
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // ==========================================
    // УВЕДОМЛЕНИЯ
    // ==========================================
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            max-width: 400px;
            font-family: Montserrat, sans-serif;
            font-size: 14px;
            animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300);
            }
        }, 5000);
    }
    
    getNotificationColor(type) {
        switch (type) {
            case 'success': return this.config.colors.success;
            case 'warning': return this.config.colors.warning;
            case 'error': return this.config.colors.danger;
            default: return this.config.colors.primary;
        }
    }
    
    // ==========================================
    // ОЧИСТКА
    // ==========================================
    
    cleanup() {
        if (this.timeDisplayInterval) {
            clearInterval(this.timeDisplayInterval);
            this.timeDisplayInterval = null;
        }
        
        [...this.charts.values(), ...this.miniCharts.values()].forEach(chart => {
            try {
                chart.destroy();
            } catch (error) {
                // Игнорируем ошибки очистки
            }
        });
        
        this.charts.clear();
        this.miniCharts.clear();
        this.pendingCharts.clear();
        this.data.clear();
    }
}

// ==========================================
// ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ
// ==========================================

// Настройка Chart.js
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = 'Montserrat, sans-serif';
    Chart.defaults.color = '#6b7280';
    Chart.defaults.borderColor = '#e5e7eb';
    Chart.defaults.backgroundColor = 'rgba(255, 107, 53, 0.1)';
    Chart.defaults.animation = {
        duration: 1500,
        easing: 'easeInOutCubic'
    };
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.verificationDashboard = new VerificationDashboard();
    } catch (error) {
        // Критическая ошибка
    }
});

// Очистка при выгрузке
window.addEventListener('beforeunload', () => {
    if (window.verificationDashboard) {
        window.verificationDashboard.cleanup();
    }
});

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VerificationDashboard };
}