// ===== ОПОП ОНЛАЙН МОДУЛЬ =====

class OPOPOnlineModule {
    constructor() {
        this.currentData = null;
        this.currentPeriod = '7days';
        this.currentTab = 'general';
        this.isLoading = false;
        this.lastUpdateTime = Date.now();
        
        // Для типов обращений используем месяцы
        this.selectedMonths = [];
        this.availableMonths = [];
        
        // Экземпляры графиков
        this.charts = {
            main: null,
            pie: null,
            channelsDaily: null,
            channelsPie: null,
            topicsPie: null,
            topicsMonthly: null
        };
        
        // Кэш DOM элементов
        this.domCache = {};
        
        // Состояние модуля
        this.isInitialized = false;
        
        this.init();
    }
    
    init() {
        if (this.isInitialized) return;
        
        this.initEventListeners();
        this.updateCurrentDate();
        this.loadTodayData();
        this.startAutoUpdate();
        this.loadChartJS();
        
        // Устанавливаем начальные значения
        this.currentTab = 'general';
        this.currentPeriod = '7days';
        
        // Восстанавливаем состояние из URL (если есть)
        this.restoreFromURL();
        
        // Инициализируем фильтры периодов для текущего таба
        this.updatePeriodFilters(this.currentTab);
        
        // Загружаем исторические данные автоматически
        
        this.isInitialized = true;
        console.log('ОПОП модуль успешно инициализирован');
    }
    
    // Кэширование DOM элементов
    getDOMElement(id) {
        if (!this.domCache[id]) {
            this.domCache[id] = document.getElementById(id);
        }
        return this.domCache[id];
    }
    
    // Очистка кэша DOM элементов
    clearDOMCache() {
        this.domCache = {};
    }
    
    // Загрузка Chart.js
    loadChartJS() {
        if (typeof Chart !== 'undefined') {
            console.log('Chart.js уже загружен');
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
        script.onload = () => {
            console.log('Chart.js успешно загружен');
        };
        script.onerror = () => {
            console.error('Ошибка загрузки Chart.js');
            this.showNotification('Ошибка загрузки библиотеки графиков', 'error');
        };
        document.head.appendChild(script);
    }
    
    // Обновление текущей даты
    updateCurrentDate() {
        const now = new Date();
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        };
        
        const dateDisplay = this.getDOMElement('currentDateDisplay');
        const lastUpdateTime = this.getDOMElement('lastUpdateTime');
        
        if (dateDisplay) {
            dateDisplay.textContent = now.toLocaleDateString('ru-RU', options);
        }
        
        if (lastUpdateTime) {
            lastUpdateTime.textContent = now.toLocaleTimeString('ru-RU');
        }
        
        this.lastUpdateTime = now.getTime();
    }
    
    // Загрузка данных за сегодня
    async loadTodayData() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            this.showLoader();
            
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`/api/opop-online?date=${today}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Неизвестная ошибка сервера');
            }
            
            this.currentData = data;
            this.renderTodayCards(data);
            this.hideLoader();
            
        } catch (error) {
            console.error('Ошибка загрузки данных за сегодня:', error);
            this.showError(`Не удалось загрузить данные за сегодня: ${error.message}`);
        } finally {
            this.isLoading = false;
        }
    }
    
    // Отображение карточек с данными за сегодня
    renderTodayCards(data) {
        const todayData = data?.data?.[0] || {
            in_status_classified: 0,
            in_status_in_progress: 0,
            in_status_clarifying_information: 0,
            received: 0
        };
        
        // Обновляем карточки с анимацией
        this.animateCardUpdate('classifiedCount', todayData.in_status_classified || 0);
        this.animateCardUpdate('inProgressCount', todayData.in_status_in_progress || 0);
        this.animateCardUpdate('clarificationCount', todayData.in_status_clarifying_information || 0);
        
        // Обновляем прогресс бары и проценты
        this.updateProgressBars(todayData);
        
        // Обновляем время последнего обновления
        this.updateCurrentDate();
    }
    
    // Анимированное обновление числа в карточке
    animateCardUpdate(elementId, targetValue) {
        const element = this.getDOMElement(elementId);
        if (!element) return;
        
        const numberElement = element.querySelector('.opop-card__number');
        if (!numberElement) return;
        
        const startValue = parseInt(numberElement.textContent.replace(/\s/g, '')) || 0;
        const duration = 1500;
        const startTime = Date.now();
        
        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing функция для плавной анимации
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.round(startValue + (targetValue - startValue) * easeOut);
            
            numberElement.textContent = currentValue.toLocaleString('ru-RU');
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    // Обновление прогресс баров и процентов
    updateProgressBars(data) {
        const classified = data.in_status_classified || 0;
        const inProgress = data.in_status_in_progress || 0;
        const clarification = data.in_status_clarifying_information || 0;
        
        // Сумма всех статусов - это база для расчета процентов
        const totalStatuses = classified + inProgress + clarification;
        
        // Если нет данных, показываем 0%
        if (totalStatuses === 0) {
            this.setProgressData('classified', 0, 0);
            this.setProgressData('inProgress', 0, 0);
            this.setProgressData('clarification', 0, 0);
            return;
        }
        
        const progressData = [
            { 
                id: 'classified',
                value: classified,
                percentage: Math.round((classified / totalStatuses) * 100)
            },
            { 
                id: 'inProgress',
                value: inProgress,
                percentage: Math.round((inProgress / totalStatuses) * 100)
            },
            { 
                id: 'clarification',
                value: clarification,
                percentage: Math.round((clarification / totalStatuses) * 100)
            }
        ];
        
        progressData.forEach(item => {
            this.setProgressData(item.id, item.percentage, item.value);
        });
    }
    
    // Установка данных прогресса для карточки
    setProgressData(id, percentage, value) {
        const progressElement = this.getDOMElement(id + 'Progress');
        const percentageElement = this.getDOMElement(id + 'Percentage');
        
        if (progressElement) {
            // Добавляем задержку для красивой анимации
            setTimeout(() => {
                progressElement.style.width = `${Math.min(percentage, 100)}%`;
            }, 800);
        }
        
        if (percentageElement) {
            // Анимируем процент
            this.animatePercentage(percentageElement, percentage);
        }
    }
    
    // Анимация процентов
    animatePercentage(element, targetPercentage) {
        const duration = 1200;
        const startTime = Date.now();
        const startValue = 0;
        
        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.round(startValue + (targetPercentage - startValue) * easeOut);
            
            element.textContent = currentValue + '%';
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        setTimeout(animate, 1000); // Задержка для синхронизации с прогресс баром
    }
    
    // Инициализация обработчиков событий
    initEventListeners() {
        // Переключение табов
        document.querySelectorAll('.opop-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabType = e.currentTarget.dataset.tab;
                if (tabType && tabType !== this.currentTab) {
                    this.switchTab(tabType);
                }
            });
        });
        
        // Автообновление при изменении видимости страницы
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
    
    // Переключение табов
    switchTab(tabType) {
        if (!tabType || tabType === this.currentTab) return;
        
        // Обновляем активный таб
        document.querySelectorAll('.opop-tab').forEach(tab => {
            tab.classList.remove('opop-tab--active');
        });
        
        const activeTab = document.querySelector(`[data-tab="${tabType}"]`);
        if (activeTab) {
            activeTab.classList.add('opop-tab--active');
        }
        
        this.currentTab = tabType;
        
        // Уничтожаем предыдущие графики
        this.destroyAllCharts();
        
        // Обновляем фильтры периодов в зависимости от таба
        this.updatePeriodFilters(tabType);
        
        // Обновляем URL
        this.updateURL();
        
        // Загружаем данные
        this.loadHistoryData();
    }
    
    // Обновление фильтров периодов
    updatePeriodFilters(tabType) {
        const periodFiltersContainer = document.querySelector('.opop-period-filters');
        if (!periodFiltersContainer) return;
        
        if (tabType === 'topics') {
            // Для типов обращений показываем месяцы
            this.showMonthFilters();
        } else {
            // Для других табов показываем обычные периоды
            this.showDateFilters();
        }
    }
    
    // Показать фильтры по месяцам
    showMonthFilters() {
            const periodFiltersContainer = document.querySelector('.opop-period-filters');
            if (!periodFiltersContainer) {
                console.error('[CLIENT DEBUG] Контейнер .opop-period-filters не найден');
                return;
            }
            
            periodFiltersContainer.innerHTML = `
                <div class="opop-month-tabs" id="monthTabs">
                    <div class="opop-month-loading">
                        <div class="opop-loading-spinner"></div>
                        <span>Загрузка доступных месяцев...</span>
                    </div>
                </div>
            `;
            
            console.log('[CLIENT DEBUG] Контейнер месяцев создан, загружаем доступные месяцы...');
            
            // Добавляем небольшую задержку, чтобы DOM успел обновиться
            setTimeout(() => {
                this.loadAvailableMonths();
            }, 50);
        }
    
    // Показать обычные фильтры дат
    showDateFilters() {
        const periodFiltersContainer = document.querySelector('.opop-period-filters');
        if (!periodFiltersContainer) return;
        
        periodFiltersContainer.innerHTML = `
            <div class="opop-period-tabs">
                <button class="opop-period-tab ${this.currentPeriod === '7days' ? 'opop-period-tab--active' : ''}" data-period="7days">
                    Последние 7 дней
                </button>
                <button class="opop-period-tab ${this.currentPeriod === '30days' ? 'opop-period-tab--active' : ''}" data-period="30days">
                    Последние 30 дней
                </button>
                <button class="opop-period-tab ${this.currentPeriod === 'custom' ? 'opop-period-tab--active' : ''}" data-period="custom">
                    Произвольный период
                </button>
            </div>

            <div class="opop-custom-dates ${this.currentPeriod === 'custom' ? 'show' : ''}" id="customDatesContainer" style="display: ${this.currentPeriod === 'custom' ? 'block' : 'none'};">
                <div class="opop-date-inputs">
                    <div class="opop-date-input">
                        <label for="startDate">От:</label>
                        <input type="date" id="startDate" class="opop-date-field" value="${this.customStartDate || ''}">
                    </div>
                    <div class="opop-date-input">
                        <label for="endDate">До:</label>
                        <input type="date" id="endDate" class="opop-date-field" value="${this.customEndDate || ''}">
                    </div>
                    <button class="opop-apply-btn" id="applyCustomDates">
                        Применить
                    </button>
                </div>
            </div>
        `;
        
        // Очищаем временные переменные
        delete this.customStartDate;
        delete this.customEndDate;
        
        // Очищаем кэш и переинициализируем обработчики событий для периодов
        this.clearDOMCache();
        this.initPeriodEventListeners();
    }

    // Проверка готовности к загрузке данных
    isReadyToLoadData() {
        // Проверяем, что DOM готов
        if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
            return false;
        }
        
        // Проверяем, что контейнер существует
        const container = this.getDOMElement('chartContainer');
        return !!container;
    }
    
    // Загрузка доступных месяцев
    async loadAvailableMonths() {
        try {
            console.log('Загрузка доступных месяцев...');
            
            const response = await fetch('/api/opop-topics');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Ошибка получения данных о месяцах');
            }
            
            if (!data.data || !Array.isArray(data.data.availableMonths)) {
                throw new Error('Неверный формат данных о доступных месяцах');
            }
            
            this.availableMonths = data.data.availableMonths;
            console.log('Загружено месяцев:', this.availableMonths.length);
            
            this.renderMonthTabs();
            
            // Автоматически выбираем последние 3 месяца, если не выбрано из URL
            if (this.selectedMonths.length === 0 && this.availableMonths.length > 0) {
                // Сортируем месяцы по порядку и берем последние 3
                const sortedMonths = [...this.availableMonths].sort((a, b) => a.order - b.order);
                const lastMonths = sortedMonths.slice(-3).map(m => m.value);
                this.selectedMonths = lastMonths;
                console.log('Автоматически выбраны месяцы:', this.selectedMonths);
                
                this.updateActiveMonthTabs();
                this.loadHistoryData();
            } else if (this.selectedMonths.length > 0) {
                // Проверяем, что выбранные месяцы существуют в доступных
                const availableValues = this.availableMonths.map(m => m.value);
                const validMonths = this.selectedMonths.filter(month => availableValues.includes(month));
                
                if (validMonths.length !== this.selectedMonths.length) {
                    console.warn('Некоторые выбранные месяцы недоступны, фильтруем:', {
                        selected: this.selectedMonths,
                        valid: validMonths
                    });
                    this.selectedMonths = validMonths;
                }
                
                this.updateActiveMonthTabs();
                
                if (this.selectedMonths.length > 0) {
                    this.loadHistoryData();
                } else {
                    this.clearHistoryContainer();
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки месяцев:', error);
            const monthTabs = this.getDOMElement('monthTabs');
            if (monthTabs) {
                monthTabs.innerHTML = `
                    <div class="opop-error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <div class="opop-error-text">
                            <strong>Ошибка загрузки доступных месяцев</strong>
                            <p>${error.message}</p>
                        </div>
                        <button class="opop-retry-btn" onclick="window.opopModule?.loadAvailableMonths()">
                            <i class="fas fa-redo"></i> Повторить
                        </button>
                    </div>
                `;
            }
            this.showNotification(`Ошибка загрузки месяцев: ${error.message}`, 'error');
        }
    }
    
    // Отрисовка кнопок месяцев
    renderMonthTabs() {
        const monthTabs = this.getDOMElement('monthTabs');
        if (!monthTabs || !this.availableMonths.length) return;
        
        // Сортируем месяцы по порядку
        const sortedMonths = [...this.availableMonths].sort((a, b) => a.order - b.order);
        
        monthTabs.innerHTML = `
            <div class="opop-month-info">
                <div class="opop-month-info__text">
                    <i class="fas fa-calendar-alt"></i>
                    Выберите месяцы для анализа (доступно ${sortedMonths.length} ${this.pluralize(sortedMonths.length, 'месяц', 'месяца', 'месяцев')})
                </div>
            </div>
            <div class="opop-month-buttons">
                ${sortedMonths.map(month => `
                    <button class="opop-month-tab" data-month="${month.value}" title="Показать данные за ${month.display}">
                        ${month.display}
                    </button>
                `).join('')}
            </div>
            <div class="opop-month-multi-select">
                <button class="opop-month-select-all" title="Выбрать все доступные месяцы">
                    <i class="fas fa-check-double"></i>
                    Выбрать все
                </button>
                <button class="opop-month-clear-all" title="Очистить выбранные месяцы">
                    <i class="fas fa-times-circle"></i>
                    Очистить все
                </button>
                <div class="opop-month-selected-count">
                    Выбрано: <span id="selectedMonthCount">${this.selectedMonths.length}</span> из ${sortedMonths.length}
                </div>
            </div>
        `;
        
        // Очищаем кэш и добавляем обработчики событий для месяцев
        this.clearDOMCache();
        this.initMonthEventListeners();
        
        // Обновляем активные кнопки
        this.updateActiveMonthTabs();
    }
    
    // Инициализация обработчиков для месяцев
    initMonthEventListeners() {
        // Обработчики для кнопок месяцев
        document.querySelectorAll('.opop-month-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const month = e.currentTarget.dataset.month;
                if (month) {
                    this.toggleMonth(month);
                }
            });
        });
        
        // Обработчик для "Выбрать все"
        const selectAllBtn = document.querySelector('.opop-month-select-all');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectedMonths = this.availableMonths.map(m => m.value);
                this.updateActiveMonthTabs();
                this.updateURL();
                this.loadHistoryData();
            });
        }
        
        // Обработчик для "Очистить все"
        const clearAllBtn = document.querySelector('.opop-month-clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectedMonths = [];
                this.updateActiveMonthTabs();
                this.updateURL();
                this.clearHistoryContainer();
            });
        }
    }
    
    // Переключение выбора месяца
    toggleMonth(month) {
        if (!month) return;
        
        const index = this.selectedMonths.indexOf(month);
        if (index > -1) {
            this.selectedMonths.splice(index, 1);
        } else {
            this.selectedMonths.push(month);
        }
        
        console.log('Выбранные месяцы:', this.selectedMonths);
        
        this.updateActiveMonthTabs();
        this.updateURL();
        
        if (this.selectedMonths.length > 0) {
            this.loadHistoryData();
        } else {
            this.clearHistoryContainer();
        }
    }
    
    // Обновление активных кнопок месяцев
    updateActiveMonthTabs() {
        document.querySelectorAll('.opop-month-tab').forEach(tab => {
            const month = tab.dataset.month;
            if (this.selectedMonths.includes(month)) {
                tab.classList.add('opop-month-tab--active');
            } else {
                tab.classList.remove('opop-month-tab--active');
            }
        });
        
        // Обновляем счетчик выбранных месяцев
        const countElement = this.getDOMElement('selectedMonthCount');
        if (countElement) {
            countElement.textContent = this.selectedMonths.length;
        }
    }
    
    // Очистка контейнера истории
    clearHistoryContainer() {
        const container = this.getDOMElement('chartContainer');
        if (container) {
            // Уничтожаем графики перед очисткой
            this.destroyAllCharts();
            
            container.innerHTML = `
                <div class="opop-empty-state">
                    <div class="opop-empty-state__icon">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <div class="opop-empty-state__title">Выберите месяц для просмотра данных</div>
                    <div class="opop-empty-state__description">
                        Используйте кнопки выше для выбора одного или нескольких месяцев
                    </div>
                </div>
            `;
        }
    }
    
    // Переключение периодов (для обычных табов)
    switchPeriod(period) {
        if (!period || period === this.currentPeriod) return;
        
        // Обновляем активный период
        document.querySelectorAll('.opop-period-tab').forEach(tab => {
            tab.classList.remove('opop-period-tab--active');
        });
        
        const activeTab = document.querySelector(`[data-period="${period}"]`);
        if (activeTab) {
            activeTab.classList.add('opop-period-tab--active');
        }
        
        this.currentPeriod = period;
        
        // Показываем/скрываем кастомные даты
        const customContainer = this.getDOMElement('customDatesContainer');
        if (customContainer) {
            if (period === 'custom') {
                customContainer.style.display = 'block';
                setTimeout(() => customContainer.classList.add('show'), 10);
            } else {
                customContainer.classList.remove('show');
                setTimeout(() => customContainer.style.display = 'none', 300);
                this.updateURL();
                this.loadHistoryData();
            }
        } else if (period !== 'custom') {
            this.updateURL();
            this.loadHistoryData();
        }
    }
    
    // Применение кастомных дат
    applyCustomDates() {
        const startDate = this.getDOMElement('startDate')?.value;
        const endDate = this.getDOMElement('endDate')?.value;
        
        if (!startDate || !endDate) {
            this.showNotification('Пожалуйста, выберите начальную и конечную дату', 'warning');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            this.showNotification('Начальная дата не может быть позже конечной', 'error');
            return;
        }
        
        // Проверяем максимальный период (например, не более 3 месяцев)
        const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
        if (daysDiff > 180) {
            this.showNotification('Максимальный период для анализа - 180 дней', 'warning');
            return;
        }
        
        this.updateURL();
        this.loadHistoryData();
    }
    
    // Переинициализация обработчиков периодов
    initPeriodEventListeners() {
        document.querySelectorAll('.opop-period-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const period = e.currentTarget.dataset.period;
                if (period) {
                    this.switchPeriod(period);
                }
            });
        });
        
        const applyBtn = this.getDOMElement('applyCustomDates');
        if (applyBtn) {
            applyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.applyCustomDates();
            });
        }
        
        // Добавляем обработчики для Enter в полях дат
        const startDateInput = this.getDOMElement('startDate');
        const endDateInput = this.getDOMElement('endDate');
        
        [startDateInput, endDateInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.applyCustomDates();
                    }
                });
            }
        });
    }
    
    // Загрузка исторических данных
    async loadHistoryData() {
        // Проверяем готовность перед загрузкой
        if (!this.isReadyToLoadData()) {
            console.log('Система не готова к загрузке данных, повторяем через 200мс');
            setTimeout(() => this.loadHistoryData(), 200);
            return;
        }
        
        if (this.isLoading) {
            console.log('Загрузка уже в процессе, пропускаем запрос');
            return;
        }
        
        try {
            this.isLoading = true;
            this.showContentLoader();
            
            let url = `/api/opop-${this.currentTab}?`;
            
            if (this.currentTab === 'topics') {
                // Для типов обращений используем месяцы
                if (this.selectedMonths.length > 0) {
                    url += `months=${encodeURIComponent(this.selectedMonths.join(','))}`;
                } else {
                    // Если месяцы не выбраны, не загружаем данные
                    this.hideContentLoader();
                    this.clearHistoryContainer();
                    return;
                }
            } else {
                // Для других табов используем даты
                if (this.currentPeriod === 'custom') {
                    const startDate = this.getDOMElement('startDate')?.value;
                    const endDate = this.getDOMElement('endDate')?.value;
                    
                    if (!startDate || !endDate) {
                        this.hideContentLoader();
                        this.showNotification('Выберите начальную и конечную дату', 'warning');
                        return;
                    }
                    
                    url += `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
                } else {
                    const days = this.currentPeriod === '7days' ? 7 : 30;
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(endDate.getDate() - days);
                    
                    url += `startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`;
                }
            }
            
            console.log(`Загрузка данных: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Ошибка загрузки данных с сервера');
            }
            
            console.log(`Данные загружены для таба ${this.currentTab}:`, data);
            
            this.renderHistoryData(data);
            this.hideContentLoader();
            
        } catch (error) {
            console.error('Ошибка загрузки исторических данных:', error);
            this.showError(`Не удалось загрузить данные: ${error.message}`);
        } finally {
            this.isLoading = false;
        }
    }
    
    // Отображение исторических данных
    renderHistoryData(data) {
        const container = this.getDOMElement('chartContainer');
        if (!container) {
            console.error('Контейнер chartContainer не найден');
            return;
        }
        
        // Уничтожаем предыдущие графики
        this.destroyAllCharts();
        
        try {
            if (this.currentTab === 'general') {
                this.renderGeneralStats(container, data);
            } else if (this.currentTab === 'channels') {
                this.renderChannelsData(container, data);
            } else if (this.currentTab === 'topics') {
                this.renderTopicsData(container, data);
            } else {
                // Для других табов показываем placeholder
                this.renderPlaceholder(container, data);
            }
        } catch (error) {
            console.error('Ошибка отображения данных:', error);
            container.innerHTML = this.renderErrorState(`Ошибка отображения данных: ${error.message}`);
        }
    }
    
    // Отображение placeholder для нереализованных табов
    renderPlaceholder(container, data) {
        container.innerHTML = `
            <div class="opop-chart-placeholder">
                <div class="opop-placeholder-content">
                    <div class="opop-placeholder-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <h3>Аналитика: ${this.getTabDisplayName(this.currentTab)}</h3>
                    <div class="opop-placeholder-stats">
                        <div class="opop-placeholder-stat">
                            <span class="opop-placeholder-stat-label">Период:</span>
                            <span class="opop-placeholder-stat-value">${this.getPeriodDisplayName()}</span>
                        </div>
                        <div class="opop-placeholder-stat">
                            <span class="opop-placeholder-stat-label">Записей найдено:</span>
                            <span class="opop-placeholder-stat-value">${this.getDataLength(data)}</span>
                        </div>
                    </div>
                    <div class="opop-chart-coming-soon">
                        <div class="opop-coming-soon-icon">🚧</div>
                        <p>Интерактивные графики и детализированная аналитика</p>
                        <p>будут добавлены в следующих итерациях</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Получить количество записей в данных
    getDataLength(data) {
        if (!data || !data.data) return 0;
        
        if (Array.isArray(data.data)) {
            return data.data.length;
        }
        
        if (data.data.daily && Array.isArray(data.data.daily)) {
            return data.data.daily.length;
        }
        
        if (data.data.types && Array.isArray(data.data.types)) {
            return data.data.types.length;
        }
        
        return 0;
    }
    
    // Отображение общей статистики
    renderGeneralStats(container, data) {
        if (!data.success || !data.data) {
            container.innerHTML = this.renderErrorState('Ошибка загрузки данных общей статистики');
            return;
        }
        
        const { daily = [], totals = {} } = data.data;
        
        container.innerHTML = `
            <div class="opop-general-stats">
                <!-- Главные метрики -->
                <div class="opop-metrics-grid">
                    <div class="opop-metric-card opop-metric-card--primary">
                        <div class="opop-metric-card__icon">
                            <i class="fas fa-inbox"></i>
                        </div>
                        <div class="opop-metric-card__content">
                            <div class="opop-metric-card__value">${this.formatNumber(totals.received || 0)}</div>
                            <div class="opop-metric-card__label">Общее кол-во обращений</div>
                            <div class="opop-metric-card__trend">
                                <span class="opop-metric-card__trend-value">За ${this.getPeriodDisplayName().toLowerCase()}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="opop-metric-card opop-metric-card--success">
                        <div class="opop-metric-card__icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="opop-metric-card__content">
                            <div class="opop-metric-card__value">${this.formatNumber(totals.closed_requests || 0)}</div>
                            <div class="opop-metric-card__label">Кол-во закрытых обращений</div>
                            <div class="opop-metric-card__percentage">
                                ${this.formatPercentage(totals.closed_requests || 0, totals.received || 0, 0)} от общего
                            </div>
                        </div>
                    </div>
                    
                    <div class="opop-metric-card opop-metric-card--info">
                        <div class="opop-metric-card__icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="opop-metric-card__content">
                            <div class="opop-metric-card__value">${this.formatNumber(totals.avgProcessingTime || 0, 1)}</div>
                            <div class="opop-metric-card__label">Среднее время обработки</div>
                            <div class="opop-metric-card__unit">дней</div>
                        </div>
                    </div>
                </div>
                
                <!-- Детализация по типам закрытия -->
                <div class="opop-closure-breakdown">
                    <h3 class="opop-section-subtitle">
                        <i class="fas fa-chart-bar"></i>
                        Детализация закрытых обращений
                    </h3>
                    <div class="opop-closure-grid">
                        <div class="opop-closure-item">
                            <div class="opop-closure-item__value">${this.formatNumber(totals.closed_opop || 0)}</div>
                            <div class="opop-closure-item__label">Закрыто ОПОП</div>
                            <div class="opop-closure-item__bar">
                                <div class="opop-closure-item__bar-fill" 
                                     style="width: ${this.calculatePercentage(totals.closed_opop || 0, totals.closed_requests || 0)}%; 
                                            background: var(--opop-primary, #ff6b35);"></div>
                            </div>
                        </div>
                        
                        <div class="opop-closure-item">
                            <div class="opop-closure-item__value">${this.formatNumber(totals.closed_cpio || 0)}</div>
                            <div class="opop-closure-item__label">Закрыто ЦПИО</div>
                            <div class="opop-closure-item__bar">
                                <div class="opop-closure-item__bar-fill" 
                                     style="width: ${this.calculatePercentage(totals.closed_cpio || 0, totals.closed_requests || 0)}%; 
                                            background: var(--opop-success, #10b981);"></div>
                            </div>
                        </div>
                        
                        <div class="opop-closure-item">
                            <div class="opop-closure-item__value">${this.formatNumber(totals.closed_autoresponse || 0)}</div>
                            <div class="opop-closure-item__label">Автоответ</div>
                            <div class="opop-closure-item__bar">
                                <div class="opop-closure-item__bar-fill" 
                                     style="width: ${this.calculatePercentage(totals.closed_autoresponse || 0, totals.closed_requests || 0)}%; 
                                            background: var(--opop-warning, #f59e0b);"></div>
                            </div>
                        </div>
                        
                        <div class="opop-closure-item">
                            <div class="opop-closure-item__value">${this.formatNumber(totals.closed_kc || 0)}</div>
                            <div class="opop-closure-item__label">Закрыто КЦ</div>
                            <div class="opop-closure-item__bar">
                                <div class="opop-closure-item__bar-fill" 
                                     style="width: ${this.calculatePercentage(totals.closed_kc || 0, totals.closed_requests || 0)}%; 
                                            background: var(--opop-info, #3b82f6);"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- График динамики -->
                <div class="opop-chart-section">
                    <h3 class="opop-section-subtitle">
                        <i class="fas fa-chart-line"></i>
                        Динамика обращений и их обработки
                    </h3>
                    <div class="opop-chart-wrapper">
                        <canvas id="opopMainChart" width="400" height="200"></canvas>
                    </div>
                </div>
                
                <!-- Круговая диаграмма -->
                <div class="opop-pie-section">
                    <h3 class="opop-section-subtitle">
                        <i class="fas fa-chart-pie"></i>
                        Распределение по типам закрытия
                    </h3>
                    <div class="opop-pie-wrapper">
                        <canvas id="opopPieChart" width="300" height="300"></canvas>
                    </div>
                </div>
            </div>
        `;
        
        // Очищаем кэш DOM элементов и создаем графики с задержкой
        this.clearDOMCache();
        setTimeout(() => {
            this.createMainChart(daily);
            this.createPieChart(totals);
        }, 100);
    }
    
    // Отображение данных по источникам обращений
    renderChannelsData(container, data) {
        if (!data.success || !data.data) {
            container.innerHTML = this.renderErrorState('Ошибка загрузки данных по источникам');
            return;
        }
        
        const { daily = [], channels = [], grandTotal = 0 } = data.data;
        
        container.innerHTML = `
            <div class="opop-channels-stats">
                <!-- Компактная карточка с общей статистикой -->
                <div class="opop-channels-header">
                    <div class="opop-total-card-compact">
                        <div class="opop-total-card-compact__content">
                            <div class="opop-total-card-compact__value">${this.formatNumber(grandTotal)}</div>
                            <div class="opop-total-card-compact__label">
                                Общее количество обращений за ${this.getPeriodDisplayName().toLowerCase()}
                            </div>
                        </div>
                        <div class="opop-total-card-compact__icon">
                            <i class="fas fa-chart-area"></i>
                        </div>
                    </div>
                </div>
                
                <!-- График динамики по дням -->
                <div class="opop-channels-chart-section">
                    <h3 class="opop-channels-chart__title">
                        <i class="fas fa-chart-line"></i>
                        Динамика обращений по дням
                    </h3>
                    <div class="opop-channels-chart-wrapper">
                        <canvas id="opopChannelsDailyChart" width="400" height="200"></canvas>
                    </div>
                </div>
                
                <!-- Сетка: Источники + Круговая диаграмма -->
                <div class="opop-channels-bottom-grid">
                    <!-- Левая колонка - Топ источники -->
                    <div class="opop-channels-list">
                        <h3 class="opop-channels-list__title">
                            <i class="fas fa-list-ul"></i>
                            Источники обращений
                        </h3>
                        <div class="opop-channels-items">
                            ${channels.length > 0 ? channels.map((channel, index) => `
                                <div class="opop-channel-item" style="--channel-color: ${channel.color || '#6b7280'}">
                                    <div class="opop-channel-item__rank">${index + 1}</div>
                                    <div class="opop-channel-item__content">
                                        <div class="opop-channel-item__header">
                                            <div class="opop-channel-item__name">${channel.name || 'Неизвестный источник'}</div>
                                            <div class="opop-channel-item__percentage">
                                                <div class="opop-channel-item__percentage">
                                                    ${this.formatPercentage(channel.value || 0, grandTotal)}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="opop-channel-item__value">${this.formatNumber(channel.value || 0)}</div>
                                        <div class="opop-channel-item__bar">
                                            <div class="opop-channel-item__bar-fill" 
                                                 style="width: ${this.calculatePercentage(channel.value || 0, grandTotal)}%; 
                                                        background: ${channel.color || '#6b7280'};"></div>
                                        </div>
                                    </div>
                                </div>
                            `).join('') : '<div class="opop-no-data">Нет данных для отображения</div>'}
                        </div>
                    </div>
                    
                    <!-- Правая колонка - Круговая диаграмма -->
                    <div class="opop-channels-pie-section">
                        <h3 class="opop-channels-chart__title">
                            <i class="fas fa-chart-pie"></i>
                            Распределение по источникам
                        </h3>
                        <div class="opop-channels-pie-wrapper">
                            <canvas id="opopChannelsPieChart" width="450" height="450"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Очищаем кэш DOM элементов и создаем графики с задержкой
        this.clearDOMCache();
        setTimeout(() => {
            this.createChannelsDailyChart(daily, channels);
            this.createChannelsPieChart(channels, grandTotal);
        }, 100);
    }
    
    // Отображение данных по типам обращений
    renderTopicsData(container, data) {
        if (!data.success || !data.data) {
            container.innerHTML = this.renderErrorState('Ошибка загрузки данных по типам обращений');
            return;
        }
        
        const { types = [], monthly = [], topTopics = [], grandTotal = 0, selectedMonths = [] } = data.data;
        
        // Формируем строку выбранных месяцев
        const selectedMonthsText = selectedMonths && selectedMonths.length > 0 
            ? selectedMonths.map(m => m.display).join(', ')
            : 'Не выбрано';
        
        container.innerHTML = `
            <div class="opop-topics-stats">
                <!-- Главная карточка с общим количеством -->
                <div class="opop-topics-header">
                    <div class="opop-total-card-large">
                        <div class="opop-total-card-large__content">
                            <div class="opop-total-card-large__value">${this.formatNumber(grandTotal)}</div>
                            <div class="opop-total-card-large__label">Общее количество обращений</div>
                            <div class="opop-total-card-large__subtitle">За период: ${selectedMonthsText}</div>
                        </div>
                        <div class="opop-total-card-large__icon">
                            <i class="fas fa-chart-pie"></i>
                        </div>
                    </div>
                </div>
                
                <!-- Сетка: Круговая диаграмма + Типы обращений -->
                <div class="opop-topics-main-grid">
                    <!-- Круговая диаграмма -->
                    <div class="opop-topics-pie-section">
                        <h3 class="opop-topics-chart__title">
                            <i class="fas fa-chart-pie"></i>
                            Распределение обращений по типам
                        </h3>
                        <div class="opop-topics-pie-wrapper">
                            <canvas id="opopTopicsPieChart" width="400" height="400"></canvas>
                        </div>
                    </div>
                    
                    <!-- Список типов -->
                    <div class="opop-topics-types-section">
                        <h3 class="opop-topics-types__title">
                            <i class="fas fa-list-ul"></i>
                            Типы обращений
                        </h3>
                        <div class="opop-topics-types-list">
                            ${types.length > 0 ? types.map((type, index) => `
                                <div class="opop-topic-type-card" style="--type-color: ${type.color || this.getColorForType(type.name)}">
                                    <div class="opop-topic-type-card__header">
                                        <div class="opop-topic-type-card__rank">${index + 1}</div>
                                        <div class="opop-topic-type-card__info">
                                            <div class="opop-topic-type-card__name">${type.name || 'Неизвестный тип'}</div>
                                            <div class="opop-topic-type-card__count">${this.formatNumber(type.total || 0)}</div>
                                        </div>
                                        <div class="opop-topic-type-card__percentage">
                                            ${this.formatPercentage(type.total || 0, grandTotal)}
                                        </div>
                                    </div>
                                    <div class="opop-topic-type-card__bar">
                                        <div class="opop-topic-type-card__bar-fill" 
                                             style="width: ${this.calculatePercentage(type.total || 0, grandTotal)}%; 
                                                    background: ${type.color || this.getColorForType(type.name)};"></div>
                                    </div>
                                    <div class="opop-topic-type-card__topics">
                                        <div class="opop-topic-type-card__topics-title">Топ тем (${(type.topics || []).length}):</div>
                                        <div class="opop-topic-type-card__topics-list">
                                            ${(type.topics || []).slice(0, 3).map(topic => `
                                                <div class="opop-topic-type-card__topic">
                                                    <span class="opop-topic-type-card__topic-name">${topic.name || 'Неизвестная тема'}</span>
                                                    <span class="opop-topic-type-card__topic-count">${this.formatNumber(topic.total || 0)}</span>
                                                </div>
                                            `).join('')}
                                            ${(type.topics || []).length > 3 ? `
                                                <div class="opop-topic-type-card__more">
                                                    +${(type.topics || []).length - 3} других тем
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('') : '<div class="opop-no-data">Нет данных для отображения</div>'}
                        </div>
                    </div>
                </div>
                
                <!-- График динамики по месяцам (если выбрано несколько месяцев) -->
                ${selectedMonths && selectedMonths.length > 1 ? `
                    <div class="opop-topics-chart-section">
                        <h3 class="opop-topics-chart__title">
                            <i class="fas fa-chart-line"></i>
                            Динамика обращений по месяцам
                        </h3>
                        <div class="opop-topics-chart-wrapper">
                            <canvas id="opopTopicsMonthlyChart" width="400" height="300"></canvas>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Таблица топ тем -->
                <div class="opop-topics-table-section">
                    <h3 class="opop-topics-table__title">
                        <i class="fas fa-table"></i>
                        Топ-20 тем обращений
                    </h3>
                    <div class="opop-topics-table-wrapper">
                        <div class="opop-topics-table">
                            <div class="opop-topics-table__header">
                                <div class="opop-topics-table__cell opop-topics-table__cell--rank">#</div>
                                <div class="opop-topics-table__cell opop-topics-table__cell--type">Тип</div>
                                <div class="opop-topics-table__cell opop-topics-table__cell--topic">Тема</div>
                                <div class="opop-topics-table__cell opop-topics-table__cell--count">Количество</div>
                                <div class="opop-topics-table__cell opop-topics-table__cell--percentage">Доля</div>
                            </div>
                            <div class="opop-topics-table__body">
                                ${topTopics && topTopics.length > 0 ? topTopics.map((topic, index) => `
                                    <div class="opop-topics-table__row">
                                        <div class="opop-topics-table__cell opop-topics-table__cell--rank">
                                            <span class="opop-topics-table__rank">${index + 1}</span>
                                        </div>
                                        <div class="opop-topics-table__cell opop-topics-table__cell--type">
                                            <span class="opop-topics-table__type-badge" 
                                                  style="background: ${this.getColorForType(topic.type)};">
                                                ${topic.type || 'Неизвестный тип'}
                                            </span>
                                        </div>
                                        <div class="opop-topics-table__cell opop-topics-table__cell--topic">
                                            <span class="opop-topics-table__topic-name">${topic.topic || 'Неизвестная тема'}</span>
                                        </div>
                                        <div class="opop-topics-table__cell opop-topics-table__cell--count">
                                            <span class="opop-topics-table__count">${this.formatNumber(topic.total || 0)}</span>
                                        </div>
                                        <div class="opop-topics-table__cell opop-topics-table__cell--percentage">
                                            <div class="opop-topics-table__percentage-wrapper">
                                                <span class="opop-topics-table__percentage-text">
                                                    ${this.formatPercentage(topic.total || 0, grandTotal, 2)}
                                                </span>
                                                <div class="opop-topics-table__percentage-bar">
                                                    <div class="opop-topics-table__percentage-fill" 
                                                         style="width: ${this.calculatePercentage(topic.total || 0, grandTotal)}%; 
                                                                background: ${this.getColorForType(topic.type)};"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('') : `
                                    <div class="opop-topics-table__empty">
                                        <div class="opop-topics-table__empty-icon">
                                            <i class="fas fa-inbox"></i>
                                        </div>
                                        <div class="opop-topics-table__empty-text">Нет данных для отображения</div>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Очищаем кэш DOM элементов и создаем графики с задержкой
        this.clearDOMCache();
        setTimeout(() => {
            this.createTopicsPieChart(types, grandTotal);
            if (selectedMonths && selectedMonths.length > 1 && monthly) {
                this.createTopicsMonthlyChart(monthly, types);
            }
        }, 100);
    }
    
    // === МЕТОДЫ СОЗДАНИЯ ГРАФИКОВ ===
    
    // Создание основного графика для общих данных
    createMainChart(dailyData) {
        const ctx = this.getDOMElement('opopMainChart');
        if (!ctx || typeof Chart === 'undefined') {
            console.warn('Canvas для основного графика не найден или Chart.js не загружен');
            return;
        }
        
        // Уничтожаем предыдущий график
        if (this.charts.main) {
            this.charts.main.destroy();
            this.charts.main = null;
        }
        
        if (!Array.isArray(dailyData) || dailyData.length === 0) {
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-chart-line"></i><span>Нет данных для отображения</span></div>';
            return;
        }
        
        const labels = dailyData.map(item => this.formatDate(item.date, { day: 'numeric', month: 'short' }));
        const receivedData = dailyData.map(item => item.received || 0);
        const closedData = dailyData.map(item => item.closed_requests || 0);
        const avgTimeData = dailyData.map(item => parseFloat(item.average_request_processing_time_opop) || 0);
        
        try {
            this.charts.main = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Поступившие обращения',
                            data: receivedData,
                            borderColor: '#ff6b35',
                            backgroundColor: 'rgba(255, 107, 53, 0.1)',
                            tension: 0.4,
                            fill: true,
                            yAxisID: 'y',
                            borderWidth: 3,
                            pointRadius: 5,
                            pointHoverRadius: 8
                        },
                        {
                            label: 'Закрытые обращения',
                            data: closedData,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            tension: 0.4,
                            fill: true,
                            yAxisID: 'y',
                            borderWidth: 3,
                            pointRadius: 5,
                            pointHoverRadius: 8
                        },
                        {
                                                        label: 'Среднее время обработки (дни)',
                            data: avgTimeData,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.4,
                            fill: false,
                            borderDash: [5, 5],
                            yAxisID: 'y1',
                            borderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: { size: 12 }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            titleColor: '#374151',
                            bodyColor: '#6b7280',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 12,
                            callbacks: {
                                label: (context) => {
                                    const value = context.parsed.y;
                                    return `${context.dataset.label}: ${this.formatNumber(value)}`;
                                }
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 11 }, color: '#6b7280' }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            grid: { color: '#f3f4f6' },
                            ticks: {
                                font: { size: 11 },
                                color: '#6b7280',
                                callback: (value) => this.formatNumber(value)
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            ticks: {
                                font: { size: 11 },
                                color: '#6b7280',
                                callback: (value) => value.toFixed(1)
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Ошибка создания основного графика:', error);
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-exclamation-triangle"></i><span>Ошибка создания графика</span></div>';
        }
    }
    
    // Создание круговой диаграммы для общих данных
    createPieChart(totals) {
        const ctx = this.getDOMElement('opopPieChart');
        if (!ctx || typeof Chart === 'undefined') {
            console.warn('Canvas для круговой диаграммы не найден или Chart.js не загружен');
            return;
        }
        
        // Уничтожаем предыдущий график
        if (this.charts.pie) {
            this.charts.pie.destroy();
            this.charts.pie = null;
        }
        
        // Подготавливаем данные, исключаем нулевые значения
        const data = [
            { label: 'Закрыто ОПОП', value: totals.closed_opop || 0, color: '#ff6b35' },
            { label: 'Закрыто ЦПИО', value: totals.closed_cpio || 0, color: '#10b981' },
            { label: 'Автоответ', value: totals.closed_autoresponse || 0, color: '#f59e0b' },
            { label: 'Закрыто КЦ', value: totals.closed_kc || 0, color: '#3b82f6' }
        ].filter(item => item.value > 0);
        
        if (data.length === 0) {
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-chart-pie"></i><span>Нет данных для отображения</span></div>';
            return;
        }
        
        const total = data.reduce((sum, item) => sum + item.value, 0);
        
        try {
            this.charts.pie = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.map(item => item.label),
                    datasets: [{
                        data: data.map(item => item.value),
                        backgroundColor: data.map(item => item.color),
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        cutout: '50%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: { size: 12 },
                                generateLabels: (chart) => {
                                    const chartData = chart.data;
                                    return chartData.labels.map((label, i) => {
                                        const value = chartData.datasets[0].data[i];
                                        const percentage = this.formatPercentage(value, total);
                                        return {
                                            text: `${label} (${percentage})`,
                                            fillStyle: chartData.datasets[0].backgroundColor[i],
                                            strokeStyle: chartData.datasets[0].borderColor,
                                            lineWidth: chartData.datasets[0].borderWidth,
                                            pointStyle: 'circle',
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            titleColor: '#374151',
                            bodyColor: '#6b7280',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 12,
                            callbacks: {
                                label: (context) => {
                                    const value = context.parsed;
                                    const percentage = this.formatPercentage(value, total);
                                    return `${context.label}: ${this.formatNumber(value)} (${percentage})`;
                                }
                            }
                        }
                    },
                    animation: {
                        animateRotate: true,
                        animateScale: true,
                        duration: 1000,
                        easing: 'easeOutQuart'
                    }
                }
            });
        } catch (error) {
            console.error('Ошибка создания круговой диаграммы:', error);
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-exclamation-triangle"></i><span>Ошибка создания диаграммы</span></div>';
        }
    }
    
    // Создание графика динамики по дням для источников
    createChannelsDailyChart(dailyData, channels) {
        const ctx = this.getDOMElement('opopChannelsDailyChart');
        if (!ctx || typeof Chart === 'undefined') {
            console.warn('Canvas для графика источников не найден или Chart.js не загружен');
            return;
        }
        
        // Уничтожаем предыдущий график
        if (this.charts.channelsDaily) {
            this.charts.channelsDaily.destroy();
            this.charts.channelsDaily = null;
        }
        
        if (!Array.isArray(dailyData) || dailyData.length === 0 || !Array.isArray(channels) || channels.length === 0) {
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-chart-line"></i><span>Нет данных для отображения</span></div>';
            return;
        }
        
        const labels = dailyData.map(item => this.formatDate(item.date, { day: 'numeric', month: 'short' }));
        
        // Берем топ-5 источников для графика
        const topChannels = channels.slice(0, 5);
        
        const datasets = topChannels.map(channel => ({
            label: channel.name || 'Неизвестный источник',
            data: dailyData.map(item => item[channel.key] || 0),
            borderColor: channel.color || '#6b7280',
            backgroundColor: (channel.color || '#6b7280') + '20',
            tension: 0.4,
            fill: false,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 7
        }));
        
        try {
            this.charts.channelsDaily = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: { size: 12 }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            titleColor: '#374151',
                            bodyColor: '#6b7280',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 12,
                            callbacks: {
                                label: (context) => {
                                    const value = context.parsed.y;
                                    return `${context.dataset.label}: ${this.formatNumber(value)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 11 }, color: '#6b7280' }
                        },
                        y: {
                            grid: { color: '#f3f4f6' },
                            ticks: {
                                font: { size: 11 },
                                color: '#6b7280',
                                callback: (value) => this.formatNumber(value)
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Ошибка создания графика источников:', error);
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-exclamation-triangle"></i><span>Ошибка создания графика</span></div>';
        }
    }
    
    // Создание круговой диаграммы для источников
    createChannelsPieChart(channels, grandTotal) {
        const ctx = this.getDOMElement('opopChannelsPieChart');
        if (!ctx || typeof Chart === 'undefined') {
            console.warn('Canvas для круговой диаграммы источников не найден или Chart.js не загружен');
            return;
        }
        
        // Уничтожаем предыдущий график
        if (this.charts.channelsPie) {
            this.charts.channelsPie.destroy();
            this.charts.channelsPie = null;
        }
        
        // Берем топ-8 источников для круговой диаграммы
        const topChannels = channels.slice(0, 8).filter(channel => (channel.value || 0) > 0);
        
        if (topChannels.length === 0) {
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-chart-pie"></i><span>Нет данных для отображения</span></div>';
            return;
        }
        
        try {
            this.charts.channelsPie = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: topChannels.map(channel => channel.name || 'Неизвестный источник'),
                    datasets: [{
                        data: topChannels.map(channel => channel.value || 0),
                        backgroundColor: topChannels.map(channel => channel.color || '#6b7280'),
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        cutout: '50%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: { size: 11 },
                                generateLabels: (chart) => {
                                    const data = chart.data;
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const percentage = this.formatPercentage(value, grandTotal);
                                        return {
                                            text: `${label} (${percentage})`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor,
                                            lineWidth: data.datasets[0].borderWidth,
                                            pointStyle: 'circle',
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            titleColor: '#374151',
                            bodyColor: '#6b7280',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 12,
                            callbacks: {
                                label: (context) => {
                                    const value = context.parsed;
                                    const percentage = this.formatPercentage(value,grandTotal);
                                    return `${context.label}: ${this.formatNumber(value)} (${percentage})`;
                                }
                            }
                        }
                    },
                    animation: {
                        animateRotate: true,
                        animateScale: true,
                        duration: 1000,
                        easing: 'easeOutQuart'
                    }
                }
            });
        } catch (error) {
            console.error('Ошибка создания круговой диаграммы источников:', error);
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-exclamation-triangle"></i><span>Ошибка создания диаграммы</span></div>';
        }
    }
    
    // Создание круговой диаграммы для типов обращений
    createTopicsPieChart(types, grandTotal) {
        const ctx = this.getDOMElement('opopTopicsPieChart');
        if (!ctx || typeof Chart === 'undefined') {
            console.warn('Canvas для круговой диаграммы типов не найден или Chart.js не загружен');
            return;
        }
        
        // Уничтожаем предыдущий график
        if (this.charts.topicsPie) {
            this.charts.topicsPie.destroy();
            this.charts.topicsPie = null;
        }
        
        const data = types.filter(type => (type.total || 0) > 0);
        
        if (data.length === 0) {
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-chart-pie"></i><span>Нет данных для отображения</span></div>';
            return;
        }
        
        try {
            this.charts.topicsPie = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.map(type => type.name || 'Неизвестный тип'),
                    datasets: [{
                        data: data.map(type => type.total || 0),
                        backgroundColor: data.map(type => type.color || this.getColorForType(type.name)),
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        cutout: '55%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: { size: 14 },
                                generateLabels: (chart) => {
                                    const data = chart.data;
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const percentage = this.formatPercentage(value, grandTotal);
                                        return {
                                            text: `${label} (${percentage})`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor,
                                            lineWidth: data.datasets[0].borderWidth,
                                            pointStyle: 'circle',
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            titleColor: '#374151',
                            bodyColor: '#6b7280',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 12,
                            callbacks: {
                                label: (context) => {
                                    const value = context.parsed;
                                    const percentage = this.formatPercentage(value, grandTotal);
                                    return `${context.label}: ${this.formatNumber(value)} (${percentage})`;
                                }
                            }
                        }
                    },
                    animation: {
                        animateRotate: true,
                        animateScale: true,
                        duration: 1000,
                        easing: 'easeOutQuart'
                    }
                }
            });
        } catch (error) {
            console.error('Ошибка создания круговой диаграммы типов:', error);
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-exclamation-triangle"></i><span>Ошибка создания диаграммы</span></div>';
        }
    }
    
    // Создание графика динамики по месяцам для типов
    createTopicsMonthlyChart(monthlyData, types) {
        const ctx = this.getDOMElement('opopTopicsMonthlyChart');
        if (!ctx || typeof Chart === 'undefined') {
            console.warn('Canvas для месячного графика типов не найден или Chart.js не загружен');
            return;
        }
        
        // Уничтожаем предыдущий график
        if (this.charts.topicsMonthly) {
            this.charts.topicsMonthly.destroy();
            this.charts.topicsMonthly = null;
        }
        
        if (!Array.isArray(monthlyData) || monthlyData.length === 0 || !Array.isArray(types) || types.length === 0) {
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-chart-line"></i><span>Нет данных для отображения</span></div>';
            return;
        }
        
        const labels = monthlyData.map(item => item.monthName || 'Неизвестный месяц');
        
        const datasets = types.slice(0, 4).map(type => ({
            label: type.name || 'Неизвестный тип',
            data: monthlyData.map(item => (item.types && item.types[type.name]) || 0),
            borderColor: type.color || this.getColorForType(type.name),
            backgroundColor: (type.color || this.getColorForType(type.name)) + '20',
            tension: 0.4,
            fill: false,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8
        }));
        
        try {
            this.charts.topicsMonthly = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: { size: 12 }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            titleColor: '#374151',
                            bodyColor: '#6b7280',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 12,
                            callbacks: {
                                label: (context) => {
                                    const value = context.parsed.y;
                                    return `${context.dataset.label}: ${this.formatNumber(value)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 11 }, color: '#6b7280' }
                        },
                        y: {
                            grid: { color: '#f3f4f6' },
                            ticks: { 
                                font: { size: 11 }, 
                                color: '#6b7280',
                                callback: (value) => this.formatNumber(value)
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Ошибка создания месячного графика типов:', error);
            ctx.parentElement.innerHTML = '<div class="opop-no-data"><i class="fas fa-exclamation-triangle"></i><span>Ошибка создания графика</span></div>';
        }
    }
    
    // === УТИЛИТНЫЕ МЕТОДЫ ===
    
    // Функция для назначения цветов типам обращений
    getColorForType(type) {
        const colors = {
            'Жалоба': '#ef4444',
            'Заявка': '#f59e0b', 
            'Другое': '#10b981',
            'Консультация': '#3b82f6'
        };
        
        return colors[type] || `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
    }
    
    // Получить отображаемое название таба
    getTabDisplayName(tab) {
        const names = {
            'general': 'Общая информация',
            'channels': 'Источники обращений',
            'topics': 'Типы обращений'
        };
        return names[tab] || tab;
    }
    
    // Получить отображаемое название периода
    getPeriodDisplayName() {
        if (this.currentTab === 'topics') {
            if (this.selectedMonths.length === 0) {
                return 'Месяцы не выбраны';
            } else if (this.selectedMonths.length === 1) {
                const month = this.availableMonths.find(m => m.value === this.selectedMonths[0]);
                return month ? month.display : 'Выбранный месяц';
            } else {
                return `${this.selectedMonths.length} ${this.pluralize(this.selectedMonths.length, 'месяц', 'месяца', 'месяцев')}`;
            }
        } else {
            switch(this.currentPeriod) {
                case '7days': return 'Последние 7 дней';
                case '30days': return 'Последние 30 дней';
                case 'custom': 
                    const startDate = this.getDOMElement('startDate')?.value;
                    const endDate = this.getDOMElement('endDate')?.value;
                    if (startDate && endDate) {
                        return `${this.formatDate(startDate)} — ${this.formatDate(endDate)}`;
                    }
                    return 'Произвольный период';
                default: return this.currentPeriod;
            }
        }
    }
    
    // Утилитные функции
    formatNumber(num, decimals = 0) {
        if (typeof num !== 'number') return '0';
        if (decimals > 0) {
            return num.toFixed(decimals);
        }
        return num.toLocaleString('ru-RU');
    }
    
    formatPercentage(value, total, decimals = 1) {
        if (!total || total === 0) return '0.0%';
        const percentage = (value / total) * 100;
        return percentage.toFixed(decimals) + '%';
    }
    
    calculatePercentage(value, total) {
        if (!total || total === 0) return 0;
        return Math.min((value / total) * 100, 100); // Максимум 100%
    }
    
    formatDate(date, options = {}) {
        if (!date) return 'Неизвестная дата';
        
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        try {
            return new Date(date).toLocaleDateString('ru-RU', finalOptions);
        } catch (error) {
            console.error('Ошибка форматирования даты:', error);
            return 'Неверная дата';
        }
    }
    
    // Функция для склонения слов
    pluralize(count, one, few, many) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        
        if (mod100 >= 11 && mod100 <= 19) {
            return many;
        }
        
        if (mod10 === 1) {
            return one;
        }
        
        if (mod10 >= 2 && mod10 <= 4) {
            return few;
        }
        
        return many;
    }
    
    // Отображение ошибки
    renderErrorState(message) {
        return `
            <div class="opop-error-state">
                <div class="opop-error-state__icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="opop-error-state__title">${message}</div>
                <div class="opop-error-state__description">
                    Попробуйте обновить страницу или выбрать другой период
                </div>
                <button class="opop-error-state__retry" onclick="window.location.reload()">
                    <i class="fas fa-redo"></i>
                    Обновить страницу
                </button>
            </div>
        `;
    }
    
    // === МЕТОДЫ УВЕДОМЛЕНИЙ ===
    
    // Показать уведомление
    showNotification(message, type = 'info') {
        // Удаляем предыдущие уведомления
        document.querySelectorAll('.opop-notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `opop-notification opop-notification--${type}`;
        notification.innerHTML = `
            <div class="opop-notification__content">
                <div class="opop-notification__icon">
                    <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                </div>
                <span class="opop-notification__message">${message}</span>
                <button class="opop-notification__close">&times;</button>
            </div>
        `;
        
        // Добавляем стили для уведомлений если их еще нет
        this.ensureNotificationStyles();
        
        document.body.appendChild(notification);
        
        // Показываем уведомление
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Обработчик закрытия
        const closeBtn = notification.querySelector('.opop-notification__close');
        const closeNotification = () => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        };
        
        closeBtn.addEventListener('click', closeNotification);
        
        // Автоматическое закрытие через 5 секунд
        setTimeout(closeNotification, 5000);
    }
    
    // Получить иконку для уведомления
    getNotificationIcon(type) {
        const icons = {
            'info': 'info-circle',
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'error': 'times-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    // Убедиться, что стили уведомлений загружены
    ensureNotificationStyles() {
        if (document.querySelector('#opop-notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'opop-notification-styles';
        style.textContent = `
            .opop-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                border-left: 4px solid #3b82f6;
                transform: translateX(100%);
                transition: transform 0.3s ease-out;
                max-width: 400px;
                min-width: 300px;
            }
            
            .opop-notification--warning {
                border-left-color: #f59e0b;
            }
            
            .opop-notification--error {
                border-left-color: #ef4444;
            }
            
            .opop-notification--success {
                border-left-color: #10b981;
            }
            
            .opop-notification__content {
                display: flex;
                align-items: center;
                padding: 16px 20px;
                gap: 12px;
            }
            
            .opop-notification__icon {
                flex-shrink: 0;
                font-size: 16px;
                color: #3b82f6;
            }
            
            .opop-notification--warning .opop-notification__icon {
                color: #f59e0b;
            }
            
            .opop-notification--error .opop-notification__icon {
                color: #ef4444;
            }
            
            .opop-notification--success .opop-notification__icon {
                color: #10b981;
            }
            
            .opop-notification__message {
                flex: 1;
                font-size: 14px;
                color: #374151;
                line-height: 1.4;
            }
            
            .opop-notification__close {
                background: none;
                border: none;
                font-size: 18px;
                color: #9ca3af;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }
            
            .opop-notification__close:hover {
                background: #f3f4f6;
                color: #6b7280;
            }
            
            .opop-notification.show {
                transform: translateX(0);
            }
        `;
        document.head.appendChild(style);
    }
    
    // === МЕТОДЫ ЗАГРУЗЧИКОВ ===
    
    // Показать главный загрузчик
    showLoader() {
        const loader = this.getDOMElement('opopLoader');
        const container = this.getDOMElement('opopContainer');
        
        if (loader) loader.style.display = 'flex';
        if (container) container.style.display = 'none';
    }
    
    // Скрыть главный загрузчик
    hideLoader() {
        const loader = this.getDOMElement('opopLoader');
        const container = this.getDOMElement('opopContainer');
        
        if (loader) loader.style.display = 'none';
        if (container) container.style.display = 'block';
    }
    
    // Показать загрузчик контента
    showContentLoader() {
        const loader = this.getDOMElement('contentLoader');
        if (loader) loader.style.display = 'flex';
    }
    
    // Скрыть загрузчик контента
    hideContentLoader() {
        const loader = this.getDOMElement('contentLoader');
        if (loader) loader.style.display = 'none';
    }
    
    // Показать ошибку
    showError(message) {
        console.error(message);
        this.showNotification(message, 'error');
        this.hideLoader();
        this.hideContentLoader();
    }
    
    // === МЕТОДЫ АВТООБНОВЛЕНИЯ ===
    
    // Автоматическое обновление каждые 5 минут
    startAutoUpdate() {
        if (this.autoUpdateInterval) {
            clearInterval(this.autoUpdateInterval);
        }
        
        this.autoUpdateInterval = setInterval(() => {
            if (!document.hidden && this.isInitialized) {
                console.log('Автообновление данных за сегодня');
                this.loadTodayData();
            }
        }, 5 * 60 * 1000); // 5 минут
    }
    
    // Обработчик изменения видимости страницы
    handleVisibilityChange() {
        if (!document.hidden && this.isInitialized) {
            // Проверяем, сколько времени прошло с последнего обновления
            const now = Date.now();
            const timeSinceLastUpdate = now - this.lastUpdateTime;
            
            // Обновляем только если прошло больше 5 минут (300000 мс)
            if (timeSinceLastUpdate > 300000) {
                console.log('Обновление данных после длительного отсутствия');
                this.loadTodayData();
            }
        }
    }
    
    // === МЕТОДЫ ЭКСПОРТА ===
    
    // Метод для экспорта данных в CSV
    async exportToCSV(tabType) {
        if (!tabType) tabType = this.currentTab;
        
        try {
            this.showNotification('Подготовка данных для экспорта...', 'info');
            
            // Получаем данные для экспорта
            let url = `/api/opop-${tabType}?`;
            
            if (tabType === 'topics') {
                if (this.selectedMonths.length > 0) {
                    url += `months=${encodeURIComponent(this.selectedMonths.join(','))}`;
                } else {
                    this.showNotification('Выберите месяцы для экспорта', 'warning');
                    return;
                }
            } else {
                if (this.currentPeriod === 'custom') {
                    const startDate = this.getDOMElement('startDate')?.value;
                    const endDate = this.getDOMElement('endDate')?.value;
                    if (!startDate || !endDate) {
                        this.showNotification('Укажите даты для экспорта', 'warning');
                        return;
                    }
                    url += `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
                } else {
                    const days = this.currentPeriod === '7days' ? 7 : 30;
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(endDate.getDate() - days);
                    
                    url += `startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`;
                }
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Ошибка получения данных');
            }
            
            // Конвертируем в CSV и скачиваем
            const csv = this.convertToCSV(data.data, tabType);
            this.downloadCSV(csv, `opop_${tabType}_${new Date().toISOString().split('T')[0]}.csv`);
            
            this.showNotification('Данные успешно экспортированы!', 'success');
            
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification(`Ошибка при экспорте данных: ${error.message}`, 'error');
        }
    }
    
    // Конвертация данных в CSV формат
    convertToCSV(data, type) {
        let csv = '';
        const BOM = '\uFEFF'; // Добавляем BOM для корректного отображения кириллицы
        
        try {
            if (type === 'general') {
                csv = 'Дата,Поступило,Закрыто,Закрыто ОПОП,Закрыто ЦПИО,Автоответ,Закрыто КЦ,Среднее время обработки\n';
                if (data.daily && Array.isArray(data.daily)) {
                    data.daily.forEach(item => {
                        csv += `${item.date || ''},${item.received || 0},${item.closed_requests || 0},${item.closed_opop || 0},${item.closed_cpio || 0},${item.closed_autoresponse || 0},${item.closed_kc || 0},${item.average_request_processing_time_opop || 0}\n`;
                    });
                }
            } else if (type === 'channels') {
                csv = 'Дата,Общее количество,ФОС,Личный кабинет,ЦПИО,Мобильное приложение,ФОС ЕПГУ,Электронная почта\n';
                if (data.daily && Array.isArray(data.daily)) {
                    data.daily.forEach(item => {
                        csv += `${item.date || ''},${item.total_per_day || 0},${item.fos_total || 0},${item.personal_account_total || 0},${item.cpio_total || 0},${item.mobile_application_total || 0},${item.fos_epgu_total || 0},${item.email_total || 0}\n`;
                    });
                }
            } else if (type === 'topics') {
                csv = 'Тип,Тема,Общее количество\n';
                if (data.topTopics && Array.isArray(data.topTopics)) {
                    data.topTopics.forEach(item => {
                        // Экранируем кавычки в названии темы
                        const escapedTopic = (item.topic || '').replace(/"/g, '""');
                        const escapedType = (item.type || '').replace(/"/g, '""');
                        csv += `"${escapedType}","${escapedTopic}",${item.total || 0}\n`;
                    });
                }
            }
        } catch (error) {
            console.error('Ошибка конвертации в CSV:', error);
            throw new Error('Ошибка конвертации данных в CSV формат');
        }
        
        return BOM + csv;
    }
    
    // Скачивание CSV файла
    downloadCSV(csv, filename) {
        try {
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                throw new Error('Браузер не поддерживает скачивание файлов');
            }
        } catch (error) {
            console.error('Ошибка скачивания CSV:', error);
            throw new Error('Ошибка скачивания файла');
        }
    }
    
    // === МЕТОДЫ УПРАВЛЕНИЯ СОСТОЯНИЕМ ===
    
    // Уничтожение всех графиков при смене табов
    destroyAllCharts() {
        Object.keys(this.charts).forEach(chartKey => {
            if (this.charts[chartKey]) {
                try {
                    this.charts[chartKey].destroy();
                } catch (error) {
                    console.warn(`Ошибка уничтожения графика ${chartKey}:`, error);
                }
                this.charts[chartKey] = null;
            }
        });
    }
    
    // Метод для обновления URL без перезагрузки страницы
    updateURL() {
        try {
            const params = new URLSearchParams();
            params.set('tab', this.currentTab);
            
            if (this.currentTab === 'topics') {
                if (this.selectedMonths.length > 0) {
                    params.set('months', this.selectedMonths.join(','));
                }
            } else {
                params.set('period', this.currentPeriod);
                
                if (this.currentPeriod === 'custom') {
                    const startDate = this.getDOMElement('startDate')?.value;
                    const endDate = this.getDOMElement('endDate')?.value;
                    if (startDate) params.set('startDate', startDate);
                    if (endDate) params.set('endDate', endDate);
                }
            }
            
            const newURL = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({}, '', newURL);
        } catch (error) {
            console.error('Ошибка обновления URL:', error);
        }
    }
    
    // Восстановление состояния из URL
    restoreFromURL() {
        try {
            const params = new URLSearchParams(window.location.search);
            
            const tab = params.get('tab');
            const period = params.get('period');
            const months = params.get('months');
            const startDate = params.get('startDate');
            const endDate = params.get('endDate');
            
            // Восстанавливаем таб (по умолчанию 'general' уже установлен)
            if (tab && ['general', 'channels', 'topics'].includes(tab)) {
                this.currentTab = tab;
            }
            
            // Обновляем активный таб в интерфейсе
            document.querySelectorAll('.opop-tab').forEach(t => {
                t.classList.remove('opop-tab--active');
            });
            const currentTabElement = document.querySelector(`[data-tab="${this.currentTab}"]`);
            if (currentTabElement) {
                currentTabElement.classList.add('opop-tab--active');
            }
            
            // Восстанавливаем период для обычных табов (по умолчанию '7days' уже установлен)
            if (this.currentTab !== 'topics' && period && ['7days', '30days', 'custom'].includes(period)) {
                this.currentPeriod = period;
                
                if (period === 'custom' && startDate && endDate) {
                    // Эти значения будут установлены позже в showDateFilters
                    this.customStartDate = startDate;
                    this.customEndDate = endDate;
                }
            }
            
            // Восстанавливаем месяцы для таба типов
            if (this.currentTab === 'topics' && months) {
                this.selectedMonths = months.split(',').filter(m => m.trim());
            }
            
            console.log('Состояние восстановлено из URL:', {
                tab: this.currentTab,
                period: this.currentPeriod,
                months: this.selectedMonths
            });
        } catch (error) {
            console.error('Ошибка восстановления состояния из URL:', error);
        }
    }
    
    // === МЕТОДЫ ОЧИСТКИ ===
    
    // Очистка ресурсов при уничтожении модуля
    destroy() {
        try {
            console.log('Начинаем уничтожение ОПОП модуля...');
            
            // Останавливаем загрузку данных
            this.isLoading = false;
            this.isInitialized = false;
            
            // Уничтожаем все графики
            this.destroyAllCharts();
            
            // Удаляем обработчики событий
            document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
            
            // Очищаем интервалы
            if (this.autoUpdateInterval) {
                clearInterval(this.autoUpdateInterval);
                this.autoUpdateInterval = null;
            }
            
            // Удаляем уведомления
            document.querySelectorAll('.opop-notification').forEach(n => {
                try {
                    n.remove();
                } catch (error) {
                    console.warn('Ошибка удаления уведомления:', error);
                }
            });
            
            // Очищаем кэш DOM элементов
            this.clearDOMCache();
            
            // Очищаем данные
            this.currentData = null;
            this.availableMonths = [];
            this.selectedMonths = [];
            
            console.log('ОПОП модуль успешно уничтожен');
        } catch (error) {
            console.error('Ошибка при уничтожении ОПОП модуля:', error);
        }
    }
}

// === ИНИЦИАЛИЗАЦИЯ МОДУЛЯ ===

// Инициализация модуля при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, что мы находимся на странице ОПОП
    if (document.body.dataset.page === 'OtchetOPOP') {
        console.log('Инициализация ОПОП модуля...');
        
        // Даем небольшую задержку для полной загрузки DOM
        setTimeout(() => {
            try {
                if (!window.opopModule) {
                    window.opopModule = new OPOPOnlineModule();
                    console.log('ОПОП модуль успешно инициализирован');
                } else {
                    console.log('ОПОП модуль уже существует');
                }
            } catch (error) {
                console.error('Ошибка инициализации ОПОП модуля:', error);
            }
        }, 100);
        
        // Обработчик перед закрытием страницы
        window.addEventListener('beforeunload', () => {
            if (window.opopModule) {
                window.opopModule.destroy();
                window.opopModule = null;
            }
        });
        
        // Обработчик изменения размера окна для пересчета графиков
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (window.opopModule && window.opopModule.isInitialized) {
                    // Пересоздаем графики при изменении размера
                    const currentContainer = document.getElementById('chartContainer');
                    if (currentContainer && currentContainer.innerHTML.trim() && !currentContainer.querySelector('.opop-empty-state')) {
                        console.log('Пересоздание графиков после изменения размера окна');
                        window.opopModule.loadHistoryData();
                    }
                }
            }, 300);
        });
    }
});

// === ОБРАБОТЧИКИ ОШИБОК ===

// Обработчик ошибок JavaScript
window.addEventListener('error', (event) => {
    console.error('JavaScript Error:', event.error);
    if (window.opopModule && window.opopModule.isInitialized) {
        window.opopModule.showNotification('Произошла ошибка в работе приложения', 'error');
    }
});

// Обработчик необработанных промисов
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    if (window.opopModule && window.opopModule.isInitialized) {
        window.opopModule.showNotification('Ошибка при загрузке данных', 'error');
    }
});

// === ЭКСПОРТ МОДУЛЯ ===

// Экспорт модуля для возможного использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OPOPOnlineModule;
}

// Глобальный доступ к функциям экспорта для использования в HTML
window.exportOPOPData = function(tabType) {
    if (window.opopModule && window.opopModule.isInitialized) {
        window.opopModule.exportToCSV(tabType);
    } else {
        console.error('ОПОП модуль не инициализирован');
    }
};

console.log('ОПОП модуль загружен и готов к инициализации');  