class UvdzDashboard {
    constructor() {
        this.config = {
            currentSection: 'general',
            selectedYear: new Date().getFullYear(),
            selectedGeneralYear: null,
            autoRefreshInterval: 300000,
            user: 'Temioka'
        };

        this.state = {
            charts: {},
            expandedChart: null,
            data: {},
            isLoading: false,
            lastUpdate: null,
            currentTime: new Date()
        };

        this.init();
    }

    async init() {
        try {
            this.setupEventListeners();
            this.initializeCurrentTime();
            this.startTimeUpdater();
            await this.loadInitialData();
            this.startAutoRefresh();
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.showError('Ошибка инициализации дашборда');
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.uvdz-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.dataset.section;
                if (section) {
                    this.switchSection(section);
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        window.addEventListener('resize', this.debounce(() => {
            this.handleWindowResize();
        }, 250));
    }

    handleWindowResize() {
        Object.values(this.state.charts).forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    }

    initializeCurrentTime() {
        this.state.currentTime = new Date();
        this.updateCurrentDateDisplay();
    }

    startTimeUpdater() {
        setInterval(() => {
            this.state.currentTime = new Date(this.state.currentTime.getTime() + 60000);
            this.updateCurrentDateDisplay();
        }, 60000);
    }

    updateCurrentDateDisplay() {
        const element = document.getElementById('uvdzCurrentDate');
        if (!element) return;

        const moscowTime = new Date(this.state.currentTime.getTime() + (3 * 60 * 60 * 1000));
        const dateString = this.formatDate(moscowTime, 'dd.mm.yyyy');
        const timeString = this.formatTime(moscowTime);
        
        element.innerHTML = `
            <span class="uvdz-date-time">
                <i class="fas fa-calendar-day"></i>
                ${dateString}, ${timeString}
            </span>
        `;
    }

    async switchSection(section) {
        const validSections = [
            'general', 'banks', 'categories', 
            'pre-court', 'court', 'personification', 
            'roads', 'monthly'
        ];

        if (!validSections.includes(section)) {
            return;
        }

        this.updateActiveTab(section);
        this.config.currentSection = section;
        
        if (section !== 'monthly') {
            this.config.selectedYear = new Date().getFullYear();
        }
        if (section !== 'general') {
            this.config.selectedGeneralYear = null;
        }

        await this.loadSectionData();
    }

    updateActiveTab(section) {
        document.querySelectorAll('.uvdz-tab').forEach(tab => {
            tab.classList.remove('uvdz-tab-active');
        });
        
        const activeTab = document.querySelector(`[data-section="${section}"]`);
        if (activeTab) {
            activeTab.classList.add('uvdz-tab-active');
        }
    }

    async changeYear(year) {
        this.config.selectedYear = parseInt(year);
        
        document.querySelectorAll('.uvdz-year-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const targetBtn = document.querySelector(`[data-year="${year}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
        
        if (this.config.currentSection === 'monthly') {
            await this.renderMonthlySection();
        }
    }

    async changeGeneralYear(year) {
        this.config.selectedGeneralYear = year === 'all' ? null : parseInt(year);
        
        document.querySelectorAll('.uvdz-general-year-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const targetButton = year === 'all' ? 
            document.querySelector('.uvdz-general-year-btn[data-year="all"]') :
            document.querySelector(`.uvdz-general-year-btn[data-year="${year}"]`);
        
        if (targetButton) {
            targetButton.classList.add('active');
        }
        
        await this.loadSectionData();
    }

    async loadInitialData() {
        await this.loadSectionData();
    }

    async loadSectionData() {
        if (this.state.isLoading) {
            return;
        }

        try {
            this.state.isLoading = true;
            this.showLoadingState();
            
            const url = this.buildApiUrl();
            
            const response = await this.fetchWithTimeout(url, {
                headers: {
                    'x-user': this.config.user,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.state.data = result.data || {};
                this.state.lastUpdate = new Date();
                
                await this.renderCurrentSection();
            } else {
                throw new Error(result.message || 'Неизвестная ошибка сервера');
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.showError(`Ошибка загрузки данных: ${error.message}`);
        } finally {
            this.state.isLoading = false;
        }
    }

    buildApiUrl() {
        let url = `/api/debet-stats?tab=${this.config.currentSection}`;
        
        if (this.config.currentSection === 'monthly' && this.config.selectedYear) {
            url += `&year=${this.config.selectedYear}`;
        } else if (this.config.currentSection === 'general' && this.config.selectedGeneralYear) {
            url += `&year=${this.config.selectedGeneralYear}`;
        }
        
        return url;
    }

    async fetchWithTimeout(url, options = {}, timeout = 30000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Превышено время ожидания запроса');
            }
            throw error;
        }
    }

    showLoadingState() {
        const sections = ['uvdzChartsSection', 'uvdzTablesSection'];
        
        sections.forEach(sectionId => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.innerHTML = this.createLoadingTemplate();
            }
        });
        
        const metricsGrid = document.getElementById('uvdzMetricsGrid');
        if (metricsGrid) {
            metricsGrid.style.display = 'none';
        }
    }

    createLoadingTemplate() {
        return `
            <div class="uvdz-modern-loading">
                <div class="uvdz-loading-spinner">
                    <div class="uvdz-spinner-ring"></div>
                    <div class="uvdz-spinner-ring"></div>
                    <div class="uvdz-spinner-ring"></div>
                </div>
                <div class="uvdz-loading-text">
                    <h3>Загрузка данных...</h3>
                    <p>Получение актуальной информации по дебиторской задолженности</p>
                </div>
            </div>
        `;
    }

    showError(message) {
        const errorTemplate = this.createErrorTemplate(message);
        
        const sections = ['uvdzChartsSection', 'uvdzTablesSection'];
        sections.forEach(sectionId => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.innerHTML = errorTemplate;
            }
        });
        
        const metricsGrid = document.getElementById('uvdzMetricsGrid');
        if (metricsGrid) {
            metricsGrid.style.display = 'none';
        }
    }

    createErrorTemplate(message) {
        return `
            <div class="uvdz-error">
                <div class="uvdz-empty-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="uvdz-empty-content">
                    <h3>Ошибка загрузки данных</h3>
                    <p>${message}</p>
                    <button onclick="uvdzDashboardInstance.refreshData()" class="uvdz-retry-btn">
                        <i class="fas fa-redo"></i>
                        <span>Попробовать снова</span>
                    </button>
                </div>
            </div>
        `;
    }

    async renderCurrentSection() {
        switch (this.config.currentSection) {
            case 'general':
                await this.renderGeneralSection();
                break;
            case 'monthly':
                await this.renderMonthlySection();
                break;
            case 'court':
                await this.renderCourtSection();
                break;
            case 'pre-court':
                await this.renderPreCourtSection();
                break;
            default:
                await this.renderDefaultSection();
                break;
        }
    }

    async renderGeneralSection() {
        const chartsSection = document.getElementById('uvdzChartsSection');
        const tablesSection = document.getElementById('uvdzTablesSection');
        
        if (!chartsSection || !tablesSection) return;

        if (this.state.data.availableYears?.length > 0) {
            chartsSection.innerHTML = this.createYearSelectorTemplate();
        }

        const charts = this.getChartsForSection();
        if (charts.length > 0) {
            const chartsHtml = this.createChartsTemplate(charts);
            chartsSection.innerHTML += chartsHtml;
            
            setTimeout(() => {
                charts.forEach((chart, index) => {
                    setTimeout(() => {
                        this.createChart(chart.id, chart.data, chart.type);
                    }, index * 200);
                });
            }, 100);
        }

        await this.renderGeneralTables(tablesSection);
    }

    async renderGeneralTables(tablesSection) {
        if (!this.state.data.tableData?.length) {
            tablesSection.innerHTML = this.createEmptyStateTemplate('Нет данных для отображения');
            return;
        }

        const tableConfig = this.getTableConfigForSection();
        const tableHtml = this.createModernTableTemplate(
            tableConfig.title,
            tableConfig.columns,
            this.state.data.tableData,
            'general'
        );

        tablesSection.innerHTML = tableHtml;

        if (this.state.data.paymentStatusChartData && this.isValidChartData(this.state.data.paymentStatusChartData)) {
            const esrpChart = this.createESRPChartTemplate();
            tablesSection.innerHTML += esrpChart;
            
            setTimeout(() => {
                this.createChart('payment-status', this.state.data.paymentStatusChartData, 'doughnut');
            }, 300);
        }
    }

    async renderMonthlySection() {
        const chartsSection = document.getElementById('uvdzChartsSection');
        const tablesSection = document.getElementById('uvdzTablesSection');
        
        if (!chartsSection || !tablesSection) return;

        chartsSection.innerHTML = this.createYearSelectorTemplate(true);

        if (this.state.data && Object.keys(this.state.data).length > 0) {
            const charts = this.getMonthlyCharts();
            if (charts.length > 0) {
                const chartsHtml = this.createChartsTemplate(charts);
                chartsSection.innerHTML += chartsHtml;
                
                setTimeout(() => {
                    charts.forEach((chart, index) => {
                        setTimeout(() => {
                            this.createChart(chart.id, chart.data, chart.type);
                        }, index * 200);
                    });
                }, 100);
            }
        }

        await this.renderMonthlyTables(tablesSection);
    }

    async renderMonthlyTables(tablesSection) {
        if (!this.state.data.tableData?.length) {
            tablesSection.innerHTML = this.createEmptyStateTemplate(
                'Нет данных по проездам с минусовым балансом'
            );
            return;
        }

        const tableConfig = this.getTableConfigForSection();
        const sortedData = this.sortRoadsTableData([...this.state.data.tableData]);
        
        const tableHtml = this.createModernTableTemplate(
            tableConfig.title,
            tableConfig.columns,
            sortedData,
            'monthly'
        );

        tablesSection.innerHTML = tableHtml;
    }

        async renderCourtSection() {
        const chartsSection = document.getElementById('uvdzChartsSection');
        const tablesSection = document.getElementById('uvdzTablesSection');
        
        if (!chartsSection || !tablesSection) return;

        chartsSection.innerHTML = this.createInfoSectionTemplate('court');
        await this.renderSpecialTables('court', tablesSection);
    }

    async renderPreCourtSection() {
        const chartsSection = document.getElementById('uvdzChartsSection');
        const tablesSection = document.getElementById('uvdzTablesSection');
        
        if (!chartsSection || !tablesSection) return;

        chartsSection.innerHTML = this.createInfoSectionTemplate('pre-court');
        await this.renderSpecialTables('pre-court', tablesSection);
    }

    async renderSpecialTables(sectionType, tablesSection) {
        if (!this.state.data.tablesData) {
            tablesSection.innerHTML = this.createEmptyStateTemplate(
                `Нет данных по ${sectionType === 'pre-court' ? 'досудебной' : 'судебной'} работе`
            );
            return;
        }

        const tablesHtml = Object.entries(this.state.data.tablesData)
            .map(([year, tableData], index) => {
                if (!tableData?.length) return '';
                
                return this.createSpecialTableTemplate(
                    year, 
                    tableData, 
                    sectionType, 
                    index
                );
            })
            .filter(html => html)
            .join('');

        tablesSection.innerHTML = tablesHtml || this.createEmptyStateTemplate(
            `Нет данных по ${sectionType === 'pre-court' ? 'досудебной' : 'судебной'} работе`
        );
    }

    async renderDefaultSection() {
        const chartsSection = document.getElementById('uvdzChartsSection');
        const tablesSection = document.getElementById('uvdzTablesSection');
        
        if (!chartsSection || !tablesSection) return;

        const charts = this.getChartsForSection();
        if (charts.length > 0) {
            chartsSection.innerHTML = this.createChartsTemplate(charts);
            
            setTimeout(() => {
                charts.forEach((chart, index) => {
                    setTimeout(() => {
                        this.createChart(chart.id, chart.data, chart.type);
                    }, index * 200);
                });
            }, 100);
        } else {
            chartsSection.innerHTML = this.createEmptyStateTemplate('Нет графиков для отображения');
        }

        await this.renderDefaultTables(tablesSection);
    }

    async renderDefaultTables(tablesSection) {
        if (this.config.currentSection === 'roads') {
            tablesSection.innerHTML = this.createRoadsRedirectTemplate();
            return;
        }

        if (!this.state.data.tableData?.length) {
            tablesSection.innerHTML = this.createEmptyStateTemplate('Нет данных для отображения');
            return;
        }

        const tableConfig = this.getTableConfigForSection();
        let sortedData = [...this.state.data.tableData];
        
        if (this.config.currentSection === 'personification') {
            sortedData = this.sortPersonificationTableData(sortedData);
        }

        const tableHtml = this.createModernTableTemplate(
            tableConfig.title,
            tableConfig.columns,
            sortedData,
            this.config.currentSection
        );

        tablesSection.innerHTML = tableHtml;
        
        // Применяем стили после создания таблицы
        setTimeout(() => this.applyTableStyling(), 100);
    }

    createYearSelectorTemplate(isMonthly = false) {
        if (isMonthly) {
            const years = [2023, 2024, 2025];
            return `
                <div class="uvdz-modern-year-selector">
                    <div class="uvdz-year-header">
                        <h3 class="uvdz-year-title">
                            <i class="fas fa-calendar-alt"></i>
                            Выберите год для анализа
                        </h3>
                    </div>
                    <div class="uvdz-year-buttons">
                        ${years.map(year => `
                            <button class="uvdz-year-btn ${this.config.selectedYear === year ? 'active' : ''}" 
                                    data-year="${year}"
                                    onclick="uvdzDashboardInstance.changeYear(${year})">
                                <span class="uvdz-year-number">${year}</span>
                                <span class="uvdz-year-label">год</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (!this.state.data.availableYears?.length) return '';

        return `
            <div class="uvdz-modern-year-selector">
                <div class="uvdz-year-header">
                    <h3 class="uvdz-year-title">
                        <i class="fas fa-filter"></i>
                        Фильтр по годам
                    </h3>
                </div>
                <div class="uvdz-year-buttons">
                    <button class="uvdz-year-btn uvdz-general-year-btn ${!this.config.selectedGeneralYear ? 'active' : ''}" 
                            data-year="all" 
                            onclick="uvdzDashboardInstance.changeGeneralYear('all')">
                        <span class="uvdz-year-number">Все</span>
                        <span class="uvdz-year-label">годы</span>
                    </button>
                    ${this.state.data.availableYears.map(year => `
                        <button class="uvdz-year-btn uvdz-general-year-btn ${this.config.selectedGeneralYear === year ? 'active' : ''}" 
                                data-year="${year}"
                                onclick="uvdzDashboardInstance.changeGeneralYear(${year})">
                            <span class="uvdz-year-number">${year}</span>
                            <span class="uvdz-year-label">год</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    createChartsTemplate(charts) {
        return `
            <div class="uvdz-modern-charts-grid">
                ${charts.map(chart => `
                    <div class="uvdz-modern-chart-card" data-chart-id="${chart.id}">
                        <div class="uvdz-chart-header">
                            <div class="uvdz-chart-title-section">
                                <h3 class="uvdz-chart-title">${chart.title}</h3>
                                <div class="uvdz-chart-meta">
                                    <span class="uvdz-chart-type">${this.getChartTypeLabel(chart.type)}</span>
                                </div>
                            </div>
                            <div class="uvdz-chart-actions">
                                <button class="uvdz-chart-expand-btn" 
                                        title="Развернуть график" 
                                        onclick="uvdzDashboardInstance.expandChart('${chart.id}')">
                                    <i class="fas fa-expand-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div class="uvdz-chart-body">
                            <canvas class="uvdz-chart-canvas" id="uvdz-chart-${chart.id}"></canvas>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    createModernTableTemplate(title, columns, data, section) {
        const hasInfo = section === 'monthly';
        
        return `
            <div class="uvdz-modern-table-card" data-section="${section}">
                <div class="uvdz-table-header">
                    <div class="uvdz-table-header-content">
                        <div class="uvdz-table-icon">
                            <i class="${this.getSectionIcon(section)}"></i>
                        </div>
                        <div class="uvdz-table-title-section">
                            <h3 class="uvdz-table-title">${title}</h3>
                            ${hasInfo ? `
                            ` : ''}
                        </div>
                    </div>
                    <div class="uvdz-table-stats">
                        <div class="uvdz-stat-item">
                            <span class="uvdz-stat-number">${data.length}</span>
                            <span class="uvdz-stat-label">записей</span>
                        </div>
                    </div>
                </div>
                <div class="uvdz-table-body">
                    <div class="uvdz-table-scroll">
                        <table class="uvdz-modern-table" data-section="${section}">
                            <thead>
                                <tr class="uvdz-table-header-row">
                                    ${columns.map(col => `
                                        <th class="uvdz-table-th ${this.isMainColumn(col.key) ? 'uvdz-th-main' : 'uvdz-th-center'}">
                                            <div class="uvdz-th-content">
                                                <i class="${this.getColumnIcon(col.key)}"></i>
                                                <span>${col.title}</span>
                                            </div>
                                        </th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${data.map((row, index) => `
                                    <tr class="uvdz-table-row" data-index="${index}">
                                        ${columns.map((col, colIndex) => {
                                            let additionalClass = '';
                                            
                                            // Для банков - красные цифры в столбце "Подано на сумму"
                                            if (section === 'banks' && col.key === 'receivedAmount') {
                                                additionalClass = 'uvdz-bank-received-amount';
                                            }
                                            
                                            // Для персонификации - красные цифры в столбцах долгов
                                            if (section === 'personification' && 
                                                ['debt0_12', 'debt13_24', 'debt25_36', 'debtOver36'].includes(col.key)) {
                                                additionalClass = 'uvdz-debt-amount';
                                            }
                                            
                                            return `
                                                <td class="uvdz-table-td ${this.isMainColumn(col.key) ? 'uvdz-td-main' : 'uvdz-td-center'} ${additionalClass}">
                                                    ${this.formatTableCell(row[col.key], col.type, col.key, row)}
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    createSpecialTableTemplate(year, tableData, sectionType, index) {
        const title = year === '2023-2025' ? 
            `Информация по ${sectionType === 'pre-court' ? 'досудебной' : 'судебной'} работе 2023-2025` : 
            `Информация по ${sectionType === 'pre-court' ? 'досудебной' : 'судебной'} работе ${year}`;
        
        const isSummary = year === '2023-2025';
        const columns = sectionType === 'pre-court' ? 
            this.getPreCourtColumns() : 
            this.getCourtColumns();

        return `
            <div class="uvdz-special-table-card ${isSummary ? 'uvdz-summary-table' : ''}" 
                 data-year="${year}" 
                 data-section="${sectionType}"
                 data-index="${index}">
                <div class="uvdz-table-header">
                    <div class="uvdz-table-header-content">
                        <div class="uvdz-table-icon">
                            <i class="${sectionType === 'pre-court' ? 'fas fa-file-contract' : 'fas fa-balance-scale'}"></i>
                        </div>
                        <div class="uvdz-table-title-section">
                            <h3 class="uvdz-table-title">${title}</h3>
                            <span class="uvdz-year-badge">${year}</span>
                        </div>
                    </div>
                    ${isSummary ? '<div class="uvdz-summary-badge">ИТОГО</div>' : ''}
                    <div class="uvdz-table-stats">
                        <div class="uvdz-stat-item">
                            <span class="uvdz-stat-number">${tableData.length}</span>
                            <span class="uvdz-stat-label">записей</span>
                        </div>
                    </div>
                </div>
                <div class="uvdz-table-body">
                    <div class="uvdz-table-scroll">
                        <table class="uvdz-modern-table">
                            <thead>
                                <tr class="uvdz-table-header-row">
                                    ${columns.map(col => `
                                        <th class="uvdz-table-th ${col.main ? 'uvdz-th-main' : 'uvdz-th-center'}">
                                            <div class="uvdz-th-content">
                                                <i class="${col.icon}"></i>
                                                <span>${col.title}</span>
                                            </div>
                                        </th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${tableData.map((row, rowIndex) => {
                                    const rowType = sectionType === 'pre-court' ? 
                                        this.getPreCourtRowType(row.kanal_informirovaniya) :
                                        this.getCourtRowType(row.parametr);
                                    
                                    return `
                                        <tr class="uvdz-table-row uvdz-${rowType}-row" data-index="${rowIndex}">
                                            ${columns.map(col => `
                                                <td class="uvdz-table-td ${col.main ? 'uvdz-td-main' : 'uvdz-td-center'}">
                                                    ${this.formatSpecialTableCell(row[col.key], col.type, rowType)}
                                                </td>
                                            `).join('')}
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    createInfoSectionTemplate(sectionType) {
        const isPreCourt = sectionType === 'pre-court';
        const title = isPreCourt ? 'Досудебная работа' : 'Судебная работа';
        const description = `Детальная статистика по ${isPreCourt ? 'досудебной' : 'судебной'} работе за 2023, 2024, 2025 годы и общие итоги`;
        const icon = isPreCourt ? 'fas fa-file-contract' : 'fas fa-balance-scale';

        return `
            <div class="uvdz-info-section ${isPreCourt ? 'uvdz-pre-court-info' : 'uvdz-court-info'}">
                <div class="uvdz-info-header">
                    <div class="uvdz-info-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="uvdz-info-content">
                        <h2 class="uvdz-info-title">${title}</h2>
                        <p class="uvdz-info-description">${description}</p>
                    </div>
                </div>
                <div class="uvdz-info-stats">
                    ${this.state.data.totalRecords ? `
                        <div class="uvdz-info-stat">
                            <div class="uvdz-stat-number">${this.formatNumber(this.state.data.totalRecords)}</div>
                            <div class="uvdz-stat-label">всего записей в системе</div>
                        </div>
                    ` : ''}
                    <div class="uvdz-info-stat">
                        <div class="uvdz-stat-number">4</div>
                        <div class="uvdz-stat-label">таблицы аналитических данных</div>
                    </div>
                    ${this.state.data.lastUpdate ? `
                        <div class="uvdz-info-stat">
                            <div class="uvdz-stat-number">${this.formatDate(new Date(this.state.data.lastUpdate), 'dd.mm.yyyy')}</div>
                            <div class="uvdz-stat-label">последнее обновление данных</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    createEmptyStateTemplate(message) {
        return `
            <div class="uvdz-empty-state">
                <div class="uvdz-empty-icon">
                    <i class="fas fa-inbox"></i>
                </div>
                <div class="uvdz-empty-content">
                    <h3>Нет данных</h3>
                    <p>${message}</p>
                </div>
            </div>
        `;
    }

    createRoadsRedirectTemplate() {
        return `
            <div class="uvdz-redirect-card">
                <div class="uvdz-empty-icon">
                    <i class="fas fa-route"></i>
                </div>
                <div class="uvdz-empty-content">
                    <h3>Данный раздел в разработке !</h3>
                    <button onclick="uvdzDashboardInstance.switchSection('monthly')" class="uvdz-empty-action-btn">
                        <i class="fas fa-calendar-alt"></i>
                        <span>Перейти к проездам</span>
                    </button>
                </div>
            </div>
        `;
    }

    createESRPChartTemplate() {
        return `
            <div class="uvdz-modern-chart-card uvdz-esrp-chart" data-chart-id="payment-status">
                <div class="uvdz-chart-header">
                    <div class="uvdz-chart-title-section">
                        <h3 class="uvdz-chart-title">Действие пользователей ЭСРП после корректировки на М-4 в Июле 2024</h3>
                        <div class="uvdz-chart-meta">
                            <span class="uvdz-chart-type">Круговая диаграмма</span>
                        </div>
                    </div>
                    <div class="uvdz-chart-actions">
                        <button class="uvdz-chart-expand-btn" 
                                title="Развернуть график" 
                                onclick="uvdzDashboardInstance.expandChart('payment-status')">
                            <i class="fas fa-expand-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="uvdz-chart-body">
                    <canvas class="uvdz-chart-canvas" id="uvdz-chart-payment-status"></canvas>
                </div>
            </div>
        `;
    }

    formatTableCell(value, type, key, row) {
        // Специальная обработка динамики в общей информации
        if (key === 'dynamics' && row) {
            const dynamics = parseFloat(value) || 0;
            const cssClass = dynamics >= 0 ? 'uvdz-dynamics-positive' : 'uvdz-dynamics-negative';
            const formattedValue = row.dynamicsFormatted || this.formatDynamics(dynamics);
            
            return `<span class="${cssClass}">${formattedValue}</span>`;
        }

        if (this.isMainColumn(key)) {
            return `
                <div class="uvdz-cell-content">
                    <div class="uvdz-cell-icon">
                        <i class="fas fa-circle"></i>
                    </div>
                    <span class="uvdz-cell-text">${this.formatTableValue(value, type)}</span>
                </div>
            `;
        }

        const cellClass = type === 'money' ? 'money' : 
                         type === 'percentage' ? 'percent' : 'number';
        
        return `
            <div class="uvdz-${cellClass}-cell">
                ${this.formatTableValue(value, type)}
            </div>
        `;
    }

    formatSpecialTableCell(value, type, rowType) {
        if (!value || value === 'NULL' || value === null || value === undefined) {
            return '<span class="uvdz-empty-value">—</span>';
        }
        if (value === '-') {
            return '<span class="uvdz-dash-value">—</span>';
        }

        if (type === 'main') {
            const icon = this.getRowIcon(rowType, value);
            return `
                <div class="uvdz-cell-content">
                    <div class="uvdz-cell-icon">
                        <i class="${icon}"></i>
                    </div>
                    <span class="uvdz-cell-text">${value}</span>
                </div>
            `;
        }

        if (type === 'money') {
            if (!isNaN(value) && parseInt(value) > 0) {
                return `<span class="uvdz-money-value">${this.formatMoney(value)}</span>`;
            }
            return `<span class="uvdz-text-value">${value}</span>`;
        }

        if (type === 'number') {
            if (typeof value === 'string' && value.includes('%')) {
                return `<span class="uvdz-percent-value">${value}</span>`;
            }
            if (!isNaN(value) && parseInt(value) > 0) {
                return `<span class="uvdz-number-value">${this.formatNumber(value)}</span>`;
            }
            return `<span class="uvdz-text-value">${value}</span>`;
        }

        return `<span class="uvdz-text-value">${value}</span>`;
    }

    getRowIcon(rowType, text) {
        if (rowType === 'main' || rowType === 'court-main') {
            if (text?.includes('Email')) return 'fas fa-envelope';
            if (text?.includes('ВК')) return 'fab fa-vk';
            if (text?.includes('Претензия')) return 'fas fa-file-invoice';
            if (text?.includes('Подано в суд')) return 'fas fa-gavel';
            if (text?.includes('Самостоятельная')) return 'fas fa-user-check';
            if (text?.includes('Направлено')) return 'fas fa-paper-plane';
            if (text?.includes('Поступило')) return 'fas fa-coins';
            return 'fas fa-star';
        }
        if (rowType === 'percent') return 'fas fa-percent';
        if (rowType === 'total') return 'fas fa-calculator';
        return 'fas fa-circle';
    }

    getChartsForSection() {
        const data = this.state.data;
        
        switch (this.config.currentSection) {
            case 'general':
                return [
                    {
                        id: 'debt-dynamics',
                        title: this.config.selectedGeneralYear ? 
                            `Дебиторская задолженность (${this.config.selectedGeneralYear} год)` : 
                            'Дебиторская задолженность',
                        type: 'bar',
                        data: data.debtDynamicsData
                    },
                    {
                        id: 'increase-payment',
                        title: this.config.selectedGeneralYear ? 
                            `Прирост и оплата ДЗ по месяцам (${this.config.selectedGeneralYear} год)` : 
                            'Прирост и оплата ДЗ по месяцам',
                        type: 'bar',
                        data: data.increasePaymentData
                    }
                ].filter(chart => chart.data && this.isValidChartData(chart.data));

            case 'banks':
                return [
                    {
                        id: 'banks-comparison',
                        title: 'Сравнение операций по банкам',
                        type: 'bar',
                        data: data.banksComparisonData
                    }
                ].filter(chart => chart.data && this.isValidChartData(chart.data));

            case 'categories':
                return [
                    {
                        id: 'court-categories',
                        title: 'Количество ЛС по категориям с долгом от 1500 рублей',
                        type: 'pie',
                        data: data.courtCategoriesData
                    },
                    {
                        id: 'court-amounts',
                        title: 'Сумма ДЗ по категориям ЛС с долгом от 1500 рублей',
                        type: 'bar',
                        data: data.courtAmountData
                    }
                ].filter(chart => chart.data && this.isValidChartData(chart.data));

            case 'personification':
                return [
                    {
                        id: 'status-categories',
                        title: 'Статусы категорий персонификации',
                        type: 'pie',
                        data: data.statusCategoriesData
                    },
                    {
                        id: 'debt-ranges',
                        title: 'Диапазоны задолженности персонификации',
                        type: 'bar',
                        data: data.debtRangesData
                    }
                ].filter(chart => chart.data && this.isValidChartData(chart.data));

            default:
                return [];
        }
    }

    getMonthlyCharts() {
        if (!this.state.data || Object.keys(this.state.data).length === 0) {
            return [];
        }

        return [
            {
                id: 'monthly-quantity-debt',
                title: `Количество и ДЗ по проездам с минусовым балансом на ЭСРП (${this.config.selectedYear})`,
                type: 'bar',
                data: this.filterAndBuildMonthlyChart(this.state.data.monthlyQuantityAndDebtData)
            },
            {
                id: 'systems-comparison',
                title: `ДЗ по типу систем по проездам с минусовым балансом на ЭСРП (${this.config.selectedYear})`,
                type: 'doughnut',
                data: this.state.data.systemsComparisonData
            },
            {
                id: 'roads-summary',
                title: `Сводка по участкам дорог`,
                type: 'bar',
                data: this.state.data.roadsSummaryData
            },
            {
                id: 'section-types',
                title: `Типы участков дорог`,
                type: 'pie',
                data: this.state.data.sectionTypesData
            }
        ].filter(chart => chart.data && this.isValidChartData(chart.data));
    }

    filterAndBuildMonthlyChart(chartData) {
        if (!chartData?.labels || !chartData?.datasets) {
            return null;
        }

        const filteredIndices = [];
        chartData.labels.forEach((label, index) => {
            if (label.includes(this.config.selectedYear.toString())) {
                filteredIndices.push(index);
            }
        });

        if (filteredIndices.length === 0) {
            return null;
        }

        return {
            labels: filteredIndices.map(i => chartData.labels[i]),
            datasets: chartData.datasets.map(dataset => ({
                ...dataset,
                data: filteredIndices.map(i => dataset.data[i])
            }))
        };
    }

    createChart(chartId, chartData, chartType) {
        const ctx = document.getElementById(`uvdz-chart-${chartId}`);
        if (!ctx || !chartData || !this.isValidChartData(chartData)) {
            return;
        }

        if (this.state.charts[chartId]) {
            this.state.charts[chartId].destroy();
            delete this.state.charts[chartId];
        }

        try {
            const chartConfig = {
                type: chartType,
                data: chartData,
                options: this.getChartOptions(chartType, chartId)
            };

            this.state.charts[chartId] = new Chart(ctx, chartConfig);
        } catch (error) {
            console.error('Ошибка создания графика:', error);
        }
    }

    getChartOptions(chartType, chartId) {
        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: '#ff6b35',
                    borderWidth: 1,
                    cornerRadius: 6,
                    padding: 10,
                    callbacks: {
                        label: (context) => {
                            const label = context.dataset.label || '';
                            const value = context.parsed?.y !== undefined ? context.parsed.y : context.parsed;
                            return this.formatTooltipValue(label, value, chartId);
                        }
                    }
                }
            }
        };

        if (chartType === 'pie' || chartType === 'doughnut') {
            return baseOptions;
        }

        return {
            ...baseOptions,
            scales: this.getChartScales(chartType, chartId)
        };
    }

    getChartScales(chartType, chartId) {
        const baseScales = {
            y: {
                beginAtZero: true,
                position: 'left',
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    borderColor: 'rgba(0, 0, 0, 0.2)'
                },
                ticks: {
                    callback: (value) => this.formatAxisValue(value)
                }
            },
            x: {
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                    borderColor: 'rgba(0, 0, 0, 0.2)'
                }
            }
        };

        if (chartId === 'debt-dynamics' || chartId === 'monthly-quantity-debt') {
            baseScales.y1 = {
                type: 'linear',
                display: true,
                position: 'right',
                grid: {
                    drawOnChartArea: false,
                },
                ticks: {
                    callback: (value) => this.formatNumber(value)
                }
            };
        }

        return baseScales;
    }

    expandChart(chartId) {
        const chartContainer = document.querySelector(`[data-chart-id="${chartId}"]`);
        if (!chartContainer) return;

        const chart = this.state.charts[chartId];
        if (!chart) return;

        this.closeModal();

        const modal = this.createModalElement(chartId, chartContainer);
        document.body.appendChild(modal);
        document.body.classList.add('modal-open');
        
        requestAnimationFrame(() => {
            modal.classList.add('uvdz-modal-active');
            
            setTimeout(() => {
                this.createExpandedChart(chartId, chart);
            }, 300);
        });
    }

    createModalElement(chartId, chartContainer) {
        const modal = document.createElement('div');
        modal.className = 'uvdz-chart-modal';
        modal.id = 'uvdz-modal-' + chartId;
        
        const chartTitle = chartContainer.querySelector('.uvdz-chart-title').textContent;
        
        modal.innerHTML = `
            <div class="uvdz-modal-overlay" onclick="uvdzDashboardInstance.closeModal()"></div>
            <div class="uvdz-modal-content">
                <div class="uvdz-modal-header">
                    <h3 class="uvdz-modal-title">${chartTitle}</h3>
                    <div class="uvdz-modal-controls">
                        <button class="uvdz-modal-btn uvdz-download-btn" 
                                onclick="uvdzDashboardInstance.downloadChart('${chartId}', 'png')"
                                title="Скачать PNG">
                            <i class="fas fa-download"></i>
                            <span>PNG</span>
                        </button>
                        <button class="uvdz-modal-btn uvdz-close-btn" 
                                onclick="uvdzDashboardInstance.closeModal()"
                                title="Закрыть">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="uvdz-modal-body">
                    <canvas id="uvdz-expanded-chart-${chartId}"></canvas>
                </div>
            </div>
        `;

        return modal;
    }

    createExpandedChart(chartId, originalChart) {
        const expandedCanvas = document.getElementById(`uvdz-expanded-chart-${chartId}`);
        if (!expandedCanvas) return;

        const chartData = JSON.parse(JSON.stringify(originalChart.config.data));
        const chartType = originalChart.config.type;

        try {
            if (this.state.expandedChart) {
                this.state.expandedChart.destroy();
                this.state.expandedChart = null;
            }

            const expandedOptions = {
                ...this.getChartOptions(chartType, chartId),
                maintainAspectRatio: false,
                plugins: {
                    ...this.getChartOptions(chartType, chartId).plugins,
                    legend: {
                        ...this.getChartOptions(chartType, chartId).plugins.legend,
                        labels: {
                            ...this.getChartOptions(chartType, chartId).plugins.legend.labels,
                            font: { size: 14 }
                        }
                    }
                }
            };

            this.state.expandedChart = new Chart(expandedCanvas, {
                type: chartType,
                data: chartData,
                options: expandedOptions
            });
        } catch (error) {
            console.error('Ошибка создания расширенного графика:', error);
            const modalBody = document.querySelector('.uvdz-modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <div class="uvdz-error">
                        <div class="uvdz-empty-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="uvdz-empty-content">
                            <h3>Ошибка отображения графика</h3>
                            <p>Не удалось отобразить график в модальном окне</p>
                        </div>
                    </div>
                `;
            }
        }
    }

    downloadChart(chartId, format) {
        const chart = this.state.expandedChart || this.state.charts[chartId];
        if (!chart) return;

        const chartTitle = document.querySelector(`[data-chart-id="${chartId}"] .uvdz-chart-title`).textContent;
        const fileName = `${chartTitle.replace(/[^a-zA-Z0-9а-яА-Я\s]/g, '_')}_${this.formatDate(new Date(), 'yyyy-mm-dd')}`;

        if (format === 'png') {
            const link = document.createElement('a');
            link.download = `${fileName}.png`;
            link.href = chart.toBase64Image('image/png', 1.0);
            link.click();
        }
    }

    closeModal() {
        const modal = document.querySelector('.uvdz-chart-modal');
        if (!modal) return;

        if (this.state.expandedChart) {
            this.state.expandedChart.destroy();
            this.state.expandedChart = null;
        }

        modal.classList.remove('uvdz-modal-active');
        document.body.classList.remove('modal-open');

        setTimeout(() => {
            if (modal && modal.parentNode) {
                document.body.removeChild(modal);
            }
        }, 300);
    }

    async refreshData() {
        await this.loadSectionData();
    }

    startAutoRefresh() {
        setInterval(async () => {
            if (!document.hidden && !this.state.isLoading) {
                await this.loadSectionData();
            }
        }, this.config.autoRefreshInterval);
    }

    // Применение стилей к таблицам
    applyTableStyling() {
        // ОБЩАЯ ИНФОРМАЦИЯ - красная задолженность (3-й столбец)
        document.querySelectorAll('.uvdz-modern-table[data-section="general"] .uvdz-table-td:nth-child(3)').forEach(cell => {
            cell.style.color = '#dc3545';
            cell.style.fontWeight = '700';
            const moneyCell = cell.querySelector('.uvdz-money-cell');
            if (moneyCell) {
                moneyCell.style.background = 'rgba(220, 53, 69, 0.1)';
                moneyCell.style.border = '1px solid rgba(220, 53, 69, 0.2)';
                moneyCell.style.color = '#dc3545';
            }
        });

        // Красные цифры в банках (столбец "Подано на сумму")
        document.querySelectorAll('.uvdz-modern-table[data-section="banks"] .uvdz-table-td:nth-child(3)').forEach(cell => {
            cell.style.color = '#dc3545';
            cell.style.fontWeight = '700';
            const moneyCell = cell.querySelector('.uvdz-money-cell');
            if (moneyCell) {
                moneyCell.style.background = 'rgba(220, 53, 69, 0.1)';
                moneyCell.style.border = '1px solid rgba(220, 53, 69, 0.2)';
                moneyCell.style.color = '#dc3545';
            }
        });
        
        // КАТЕГОРИИ ЛС - красная сумма задолженности (теперь 3-й столбец)
        document.querySelectorAll('.uvdz-modern-table[data-section="categories"] .uvdz-table-td:nth-child(3)').forEach(cell => {
            cell.style.color = '#dc3545';
            cell.style.fontWeight = '700';
            const moneyCell = cell.querySelector('.uvdz-money-cell');
            if (moneyCell) {
                moneyCell.style.background = 'rgba(220, 53, 69, 0.1)';
                moneyCell.style.border = '1px solid rgba(220, 53, 69, 0.2)';
                moneyCell.style.color = '#dc3545';
            }
        });
        
        // Красные цифры в персонификации (столбцы долгов)
        document.querySelectorAll('.uvdz-modern-table[data-section="personification"] .uvdz-table-td:nth-child(n+3):nth-child(-n+6)').forEach(cell => {
            cell.style.color = '#dc3545';
            cell.style.fontWeight = '700';
            const moneyCell = cell.querySelector('.uvdz-money-cell');
            if (moneyCell) {
                moneyCell.style.background = 'rgba(220, 53, 69, 0.1)';
                moneyCell.style.border = '1px solid rgba(220, 53, 69, 0.2)';
                moneyCell.style.color = '#dc3545';
            }
        });
        
        // Красные цифры в проездах (столбец "Не оплачено")
        document.querySelectorAll('.uvdz-modern-table[data-section="monthly"] .uvdz-table-td:nth-child(5)').forEach(cell => {
            cell.style.color = '#dc3545';
            cell.style.fontWeight = '700';
            const moneyCell = cell.querySelector('.uvdz-money-cell');
            if (moneyCell) {
                moneyCell.style.background = 'rgba(220, 53, 69, 0.1)';
                moneyCell.style.border = '1px solid rgba(220, 53, 69, 0.2)';
                moneyCell.style.color = '#dc3545';
            }
        });
        
        // УБИРАЕМ все цвета из досудебной работы
        document.querySelectorAll('.uvdz-special-table-card[data-section="pre-court"] .uvdz-money-cell, .uvdz-special-table-card[data-section="pre-court"] .uvdz-number-cell, .uvdz-special-table-card[data-section="pre-court"] .uvdz-percent-cell').forEach(cell => {
            cell.style.background = 'rgba(100, 116, 139, 0.1)';
            cell.style.border = '1px solid rgba(100, 116, 139, 0.2)';
            cell.style.color = 'var(--uvdz-text-primary)';
            cell.style.fontWeight = '600';
        });
    }

    // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====

    getTableConfigForSection() {
        const configs = {
            general: {
                title: 'Детальная информация по периодам',
                columns: [
                    { key: 'period', title: 'Период', type: 'text' },
                    { key: 'count', title: 'Количество', type: 'number' },
                    { key: 'debt', title: 'Задолженность', type: 'money' },
                    { key: 'payment', title: 'Оплата', type: 'money' },
                    { key: 'increase', title: 'Прирост', type: 'money' },
                    { key: 'dynamics', title: 'Динамика', type: 'money' }
                ]
            },
            banks: {
                title: 'Статистика по банкам',
                columns: [
                    { key: 'bankName', title: 'Банк', type: 'text' },
                    { key: 'receivedCount', title: 'Подано кол-во', type: 'number' },
                    { key: 'receivedAmount', title: 'Подано на сумму', type: 'money' },
                    { key: 'sentCount', title: 'Взыскано кол-во', type: 'number' },
                    { key: 'sentAmount', title: 'Взыскано на сумму', type: 'money' },
                    { key: 'countPercentage', title: 'Доля от кол-ва', type: 'percentage' },
                    { key: 'amountPercentage', title: 'Доля от суммы', type: 'percentage' }
                ]
            },
            categories: {
                title: 'Категории ЛС с долгом от 1500 рублей',
                columns: [
                    { key: 'category', title: 'Категория', type: 'text' },
                    { key: 'quantity', title: 'Количество ЛС', type: 'number' },
                    { key: 'amount', title: 'Сумма задолженности', type: 'money' }, // ПЕРЕМЕСТИЛИ НА 3-Е МЕСТО
                    { key: 'percentage', title: 'Доля', type: 'percentage' }        // ПЕРЕМЕСТИЛИ НА 4-Е МЕСТО И ПЕРЕИМЕНОВАЛИ
                ]
            },
            personification: {
                title: 'Персонификация поездок по задолженности',
                columns: [
                    { key: 'statusCategory', title: 'Статус персонификации', type: 'text' },
                    { key: 'debtRange', title: 'Диапазон долга', type: 'text' },
                    { key: 'debt0_12', title: 'Долг 0-12 мес', type: 'money' },
                    { key: 'debt13_24', title: 'Долг 13-24 мес', type: 'money' },
                    { key: 'debt25_36', title: 'Долг 25-36 мес', type: 'money' },
                    { key: 'debtOver36', title: 'Долг >36 мес', type: 'money' }
                ]
            },
            monthly: {
                title: 'Проезды с минусовым балансом на ЭСРП',
                columns: [
                    { key: 'roadName', title: 'Дорога', type: 'text' },
                    { key: 'sectionType', title: 'Тип участка', type: 'text' },
                    { key: 'year', title: 'Год', type: 'number' },
                    { key: 'quantity', title: 'Кол-во', type: 'number' },
                    { key: 'unpaidAmount', title: 'Не оплачено', type: 'money' },
                    { key: 'paidOtherPeriod', title: 'Оплачено', type: 'money' },
                    { key: 'paidShare', title: '% оплачено', type: 'percentage' }
                ]
            }
        };

        return configs[this.config.currentSection] || {
            title: 'Нет данных',
            columns: [{ key: 'message', title: 'Сообщение', type: 'text' }]
        };
    }

    getPreCourtColumns() {
        return [
            { key: 'kanal_informirovaniya', title: 'Канал информирования', icon: 'fas fa-broadcast-tower', main: true, type: 'main' },
            { key: 'kol_vo', title: 'Кол-во', icon: 'fas fa-calculator', main: false, type: 'number' },
            { key: 'osnovnoy_dolg', title: 'Основной долг', icon: 'fas fa-ruble-sign', main: false, type: 'money' }
        ];
    }

    getCourtColumns() {
        return [
            { key: 'parametr', title: 'Параметр', icon: 'fas fa-list-ul', main: true, type: 'main' },
            { key: 'kol_vo', title: 'Кол-во', icon: 'fas fa-calculator', main: false, type: 'number' },
            { key: 'osnovnoy_dolg', title: 'Основной долг', icon: 'fas fa-ruble-sign', main: false, type: 'money' },
            { key: 'neustoyka_i_gp', title: 'Неустойка и ГП', icon: 'fas fa-percent', main: false, type: 'money' }
        ];
    }

    getPreCourtRowType(kanalInformirovaniya) {
    if (!kanalInformirovaniya) return 'regular';
    
    // Оранжевые строки
    const mainChannels = ['Email', 'ВК', 'Претензия'];
    if (mainChannels.some(channel => kanalInformirovaniya.includes(channel))) {
        return 'main';
    }

    // Оранжевые итоговые строки
    const totalRows = ['Отправлено всего', 'Получено всего'];
    if (totalRows.some(total => kanalInformirovaniya.includes(total))) {
        return 'total';
    }
    
    return 'regular';
}

    getCourtRowType(parametr) {
        if (!parametr) return 'regular';
        
        // Оранжевые строки для судебной работы
        const mainParams = [
            'Подано в суд', 
            'Самостоятельная оплата пользователем', 
            'Направлено на принудительное исполнение в банки',
            'Поступило по итогам принудительного исполнения'
        ];
        
        if (mainParams.some(param => parametr.includes(param))) {
            return 'court-main';
        }
        
        return 'regular';
    }

    getSectionIcon(section) {
        const icons = {
            'general': 'fas fa-chart-line',
            'banks': 'fas fa-university',
            'categories': 'fas fa-tags',
            'personification': 'fas fa-user-check',
            'monthly': 'fas fa-calendar-alt',
            'pre-court': 'fas fa-file-contract',
            'court': 'fas fa-balance-scale'
        };
        return icons[section] || 'fas fa-table';
    }

    getColumnIcon(key) {
        const icons = {
            'period': 'fas fa-calendar',
            'count': 'fas fa-calculator',
            'debt': 'fas fa-ruble-sign',
            'payment': 'fas fa-credit-card',
            'increase': 'fas fa-arrow-up',
            'dynamics': 'fas fa-exchange-alt',
            'bankName': 'fas fa-university',
            'category': 'fas fa-tag',
            'statusCategory': 'fas fa-user-tag',
            'debtRange': 'fas fa-layer-group',
            'roadName': 'fas fa-road',
            'sectionType': 'fas fa-map-signs',
            'year': 'fas fa-calendar-alt',
            'quantity': 'fas fa-calculator',
            'unpaidAmount': 'fas fa-exclamation-triangle',
            'paidOtherPeriod': 'fas fa-check-circle',
            'paidShare': 'fas fa-percentage'
        };
        return icons[key] || 'fas fa-circle';
    }

    isMainColumn(key) {
        const mainColumns = [
            'period', 'bankName', 'category', 
            'statusCategory', 'roadName', 'debtRange'
        ];
        return mainColumns.includes(key);
    }

    getChartTypeLabel(type) {
        const types = {
            'bar': 'Столбчатая диаграмма',
            'line': 'Линейный график',
            'pie': 'Круговая диаграмма',
            'doughnut': 'Кольцевая диаграмма'
        };
        return types[type] || 'График';
    }

    sortPersonificationTableData(tableData) {
        const statusOrder = [
            'Персонифицировано в ЦПИО',
            'Персонифицирован самостоятельно', 
            'Не персонифицирован'
        ];
        
        const rangeOrder = [
            '1-500', '500-1500', '1500-5000', 'Более 5000'
        ];
        
        return tableData.sort((a, b) => {
            const statusA = a.statusCategory || a.status_category || '';
            const statusB = b.statusCategory || b.status_category || '';
            const rangeA = a.debtRange || a.debt_range || '';
            const rangeB = b.debtRange || b.debt_range || '';
            
            const statusIndexA = statusOrder.indexOf(statusA);
            const statusIndexB = statusOrder.indexOf(statusB);
            
            if (statusIndexA !== statusIndexB) {
                if (statusIndexA === -1) return 1;
                if (statusIndexB === -1) return -1;
                return statusIndexA - statusIndexB;
            }
            
            const rangeIndexA = rangeOrder.indexOf(rangeA);
            const rangeIndexB = rangeOrder.indexOf(rangeB);
            
            if (rangeIndexA === -1) return 1;
            if (rangeIndexB === -1) return -1;
            return rangeIndexA - rangeIndexB;
        });
    }

    sortRoadsTableData(tableData) {
        return tableData.sort((a, b) => {
            const yearA = parseInt(a.year) || 0;
            const yearB = parseInt(b.year) || 0;
            
            if (yearA !== yearB) {
                return yearB - yearA;
            }
            
            const sectionA = (a.sectionType || '').toString().toLowerCase().trim();
            const sectionB = (b.sectionType || '').toString().toLowerCase().trim();
            
            if (sectionA !== sectionB) {
                return sectionA.localeCompare(sectionB, 'ru', { 
                    numeric: true,
                    sensitivity: 'base'
                });
            }
            
            const unpaidA = parseFloat(a.unpaidAmount) || 0;
            const unpaidB = parseFloat(b.unpaidAmount) || 0;
            
            return unpaidB - unpaidA;
        });
    }

    isValidChartData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        
        if (!data.labels || !Array.isArray(data.labels) || data.labels.length === 0) {
            return false;
        }
        
        if (!data.datasets || !Array.isArray(data.datasets) || data.datasets.length === 0) {
            return false;
        }
        
        return data.datasets.some(dataset => {
            if (!dataset.data || !Array.isArray(dataset.data)) {
                return false;
            }
            
            return dataset.data.some(value => {
                const numValue = parseFloat(value);
                return !isNaN(numValue) && numValue !== 0;
            });
        });
    }

    formatTableValue(value, type) {
        if (value === null || value === undefined) {
            return '—';
        }
        
        switch (type) {
            case 'money':
                return this.formatMoney(value);
            case 'number':
                return this.formatNumber(value);
            case 'percentage':
                return `${this.formatPercent(value)}%`;
            case 'text':
            default:
                return String(value || '—');
        }
    }

    formatMoney(amount) {
        const num = parseFloat(amount);
        if (!num || isNaN(num) || num === 0) return '0 ₽';
        
        const absNum = Math.abs(num);
        let formatted = '';
        
        if (absNum >= 1000000000) {
            formatted = `${(absNum / 1000000000).toFixed(1)} млрд ₽`;
        } else if (absNum >= 1000000) {
            formatted = `${(absNum / 1000000).toFixed(1)} млн ₽`;
        } else if (absNum >= 1000) {
            formatted = `${(absNum / 1000).toFixed(1)} тыс ₽`;
        } else {
            formatted = `${Math.round(absNum)} ₽`;
        }
        
        return num < 0 ? `-${formatted}` : formatted;
    }

    formatNumber(num) {
        const number = parseInt(num);
        if (!number || isNaN(number)) return '0';
        return new Intl.NumberFormat('ru-RU').format(number);
    }

    formatPercent(percent) {
        const num = parseFloat(percent);
        if (!num || isNaN(num)) return '0.0';
        return num.toFixed(1);
    }

    formatDynamics(dynamics) {
        if (!dynamics || dynamics === 0) return '0₽';
        
        const absValue = Math.abs(dynamics);
        let formatted = '';
        
        if (absValue >= 1000000000) {
            formatted = `${(absValue / 1000000000).toFixed(1)} млрд ₽`;
        } else if (absValue >= 1000000) {
            formatted = `${(absValue / 1000000).toFixed(1)} млн ₽`;
        } else if (absValue >= 1000) {
            formatted = `${(absValue / 1000).toFixed(1)} тыс ₽`;
        } else {
            formatted = `${Math.round(absValue)}₽`;
        }
        
        return dynamics < 0 ? `-${formatted}` : formatted;
    }

    formatTooltipValue(label, value, chartId) {
        if (typeof value === 'number') {
            if (value > 1000000) {
                return `${label}: ${this.formatMoney(value)}`;
            } else if (chartId.includes('percentage') || chartId.includes('rate')) {
                return `${label}: ${this.formatPercent(value)}%`;
            } else {
                return `${label}: ${this.formatNumber(value)}`;
            }
        }
        return `${label}: ${value || 'Нет данных'}`;
    }

    formatAxisValue(value) {
        if (typeof value === 'number') {
            if (value > 1000000) {
                return this.formatMoney(value);
            }
            return this.formatNumber(value);
        }
        return value;
    }

    formatDate(date, format = 'dd.mm.yyyy') {
        if (!date) return '';
        
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        
        switch (format) {
            case 'dd.mm.yyyy':
                return `${day}.${month}.${year}`;
            case 'yyyy-mm-dd':
                return `${year}-${month}-${day}`;
            default:
                return `${day}.${month}.${year}`;
        }
    }

    formatTime(date) {
        if (!date) return '';
        
        const d = new Date(date);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        return `${hours}:${minutes}`;
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

    destroy() {
        Object.values(this.state.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.state.charts = {};
        
        if (this.state.expandedChart) {
            this.state.expandedChart.destroy();
            this.state.expandedChart = null;
        }
        
        this.closeModal();
    }
}

// ===== ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ =====
let uvdzDashboardInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (uvdzDashboardInstance) {
            uvdzDashboardInstance.destroy();
            uvdzDashboardInstance = null;
        }
        
        uvdzDashboardInstance = new UvdzDashboard();
        window.uvdzDashboardInstance = uvdzDashboardInstance;
        
    } catch (error) {
        console.error('Критическая ошибка инициализации:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'uvdz-error';
        errorMessage.innerHTML = `
            <div class="uvdz-empty-content">
                <h2>Критическая ошибка</h2>
                <p>Не удалось инициализировать дашборд УВДЗ</p>
                <button onclick="location.reload()" class="uvdz-empty-action-btn">
                    Перезагрузить страницу
                </button>
            </div>
        `;
        document.body.appendChild(errorMessage);
    }
});

window.addEventListener('beforeunload', () => {
    if (uvdzDashboardInstance) {
        uvdzDashboardInstance.destroy();
        uvdzDashboardInstance = null;
    }
});