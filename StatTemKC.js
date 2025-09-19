document.addEventListener('DOMContentLoaded', function() {
    // ===== КОНСТАНТЫ И КОНФИГУРАЦИЯ =====
    const CONFIG = {
        API_ENDPOINT: '/api/stat_tematiks',
        MONTH_NAMES: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                     'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
        CHART_COLORS: [
            '#ff7300', '#5b8ff9', '#5ad8a6', '#5e7092', '#f6bd16', 
            '#6dc8ec', '#e8684a', '#9270ca', '#ff9e4d', '#269a99'
        ],
        DATE_FORMAT: 'd.m.Y',
        DEFAULT_START_YEAR: 2023,
        TIME_ZONE_OFFSET: 3, // МСК = UTC+3
        EXPORT_SCALE_FACTOR: 4, // Повышенное качество для экспорта графиков
        AUTH_API_ENDPOINT: '/api/auth/status', // Эндпоинт для получения информации о пользователе
        AUTH_CHECK_INTERVAL: 5 * 60 * 1000 // Интервал обновления данных о пользователе (5 минут)
    };
    
    // Данные о текущем пользователе и времени
    let userSessionData = {
        username: 'Неизвестный пользователь',
        timestamp: new Date().toISOString(),
        lastUpdated: 0
    };
    
    // ===== DOM ЭЛЕМЕНТЫ =====
    const elements = {};
    
    // ===== СОСТОЯНИЕ ПРИЛОЖЕНИЯ =====
    const state = {
        dataType: 'calls',        // calls / chats
        periodType: 'month',      // month / day / hour / custom
        viewType: 'table',        // table / chart
        chartType: 'doughnut',    // doughnut / bar / line / pie
        topFilter: 'all',         // all / top10 / top5 / top3
        comparisonEnabled: false, // Включено ли сравнение
        
        // Параметры периодов
        selectedYear: new Date().getFullYear(),
        selectedMonth: new Date().getMonth() + 1,
        
        dayStartDate: new Date(new Date().setDate(new Date().getDate() - 7)), // неделя назад
        dayEndDate: new Date(),
        
        hourDate: new Date(),     // Дата для часового фильтра
        hourStartHour: 0,         // Начальный час
        hourEndHour: 23,          // Конечный час
        
        customStartDate: new Date(new Date().setMonth(new Date().getMonth() - 1)), // месяц назад
        customEndDate: new Date(),
        
        // Параметры для сравнения
        comparisonYear: new Date().getFullYear(),
        comparisonMonth: new Date().getMonth(),
        comparisonDayStartDate: new Date(new Date().setDate(new Date().getDate() - 14)), // 2 недели назад
        comparisonDayEndDate: new Date(new Date().setDate(new Date().getDate() - 8)),   // неделю назад
        comparisonHourDate: new Date(new Date().setDate(new Date().getDate() - 1)),     // вчера
        comparisonCustomStartDate: new Date(new Date().setMonth(new Date().getMonth() - 2)), // 2 месяца назад
        comparisonCustomEndDate: new Date(new Date().setMonth(new Date().getMonth() - 1)), // месяц назад
        
        // Другие параметры состояния
        rawData: [],              // Исходные данные с сервера
        comparisonData: [],       // Данные для сравнения
        processedData: {},        // Обработанные данные
        processedComparisonData: {}, // Обработанные данные сравнения
        periodTotals: {},         // Суммы по периодам
        comparisonPeriodTotals: {}, // Суммы по периодам для сравнения
        chartInstance: null,      // Экземпляр графика
        datepickers: {},          // Экземпляры календарей
        sortColumn: 'Quantity',   // Столбец сортировки (по умолчанию сортируем по количеству)
        sortDirection: 'desc',    // Направление сортировки (по убыванию)
        isLoading: false,         // Флаг загрузки
        isExporting: false        // Флаг экспорта
    };
    
    // ===== ИНИЦИАЛИЗАЦИЯ =====
    async function init() {
        console.log('[StatTemKC] Инициализация компонента...');
        
        try {
            // Получаем актуальные данные о пользователе и времени
            await updateUserAndTimeInfo();
            
            // Находим элементы DOM
            findElements();
            
            // Создаем структуру интерфейса
            setupUI();
            
            // Загружаем зависимости
            await loadDependencies();
            
            // Инициализация календарей
            setupDatepickers();
            
            // Установка обработчиков событий
            setupEventHandlers();
            
            // Обновление интерфейса
            updateUI();
            
            console.log('[StatTemKC] Инициализация завершена успешно');
        } catch (error) {
            console.error('[StatTemKC] Ошибка инициализации:', error);
            showNotificationError('Ошибка инициализации компонента');
        }
    }
    
    // ===== ПОЛУЧЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ И ВРЕМЕНИ =====
    async function fetchCurrentUserAndTime() {
        // Если данные были получены недавно, используем кэшированные данные
        const now = Date.now();
        if (now - userSessionData.lastUpdated < CONFIG.AUTH_CHECK_INTERVAL) {
            return userSessionData;
        }
        
        try {
            console.log('[StatTemKC] Получаем данные о пользователе и времени...');
            const response = await fetch(CONFIG.AUTH_API_ENDPOINT);
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Обновляем данные
            userSessionData = {
                username: data.username || getCurrentUserFallback(),
                timestamp: data.timestamp || new Date().toISOString(),
                isAuthenticated: data.isAuthenticated,
                lastUpdated: now
            };
            
            console.log('[StatTemKC] Данные о пользователе получены:', userSessionData.username);
            return userSessionData;
        } catch (error) {
            console.warn('[StatTemKC] Ошибка получения данных пользователя:', error);
            
            // Используем резервные методы
            userSessionData = {
                username: getCurrentUserFallback(),
                timestamp: getCurrentMoscowTimeFallback(),
                isAuthenticated: isUserAuthenticatedFallback(),
                lastUpdated: now
            };
            
            return userSessionData;
        }
    }
    
    // ===== ОБНОВЛЕНИЕ ДАННЫХ О ПОЛЬЗОВАТЕЛЕ И ВРЕМЕНИ =====
    async function updateUserAndTimeInfo() {
        const data = await fetchCurrentUserAndTime();
        
        // Добавляем полученные данные в CONFIG
        CONFIG.CURRENT_DATE_TIME = data.timestamp;
        CONFIG.CURRENT_USER = data.username;
        CONFIG.CURRENT_DATE_TIME_MSK = convertToMoscowtime(data.timestamp);
        
        console.log('[StatTemKC] Данные обновлены:', {
            user: CONFIG.CURRENT_USER,
            time: CONFIG.CURRENT_DATE_TIME_MSK
        });
    }
    
    // ===== РЕЗЕРВНОЕ ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЯ =====
    function getCurrentUserFallback() {
        // Пробуем разные методы получения пользователя
        if (window.currentUser && window.currentUser.login) {
            return window.currentUser.login;
        } 
        
        if (window.USER_DATA && window.USER_DATA.username) {
            return window.USER_DATA.username;
        }
        
        if (window.session && window.session.user) {
            return window.session.user;
        }
        
        // Попытка получить из локального хранилища или cookies
        const savedUser = localStorage.getItem('currentUser') || 
                        getCookieValue('currentUser') || 
                        getCookieValue('user_login');
        
        if (savedUser) {
            return savedUser;
        }
        
        return "Неизвестный пользователь";
    }
    
    // ===== РЕЗЕРВНОЕ ПОЛУЧЕНИЕ СТАТУСА АВТОРИЗАЦИИ =====
    function isUserAuthenticatedFallback() {
        if (window.currentUser && window.currentUser.login) {
            return true;
        } 
        
        if (window.USER_DATA && window.USER_DATA.username) {
            return true;
        }
        
        if (window.session && window.session.user) {
            return true;
        }
        
        // Проверяем куки авторизации
        if (getCookieValue('sessionId') || getCookieValue('authToken')) {
            return true;
        }
        
        return false;
    }
    
    // ===== РЕЗЕРВНОЕ ПОЛУЧЕНИЕ МОСКОВСКОГО ВРЕМЕНИ =====
    function getCurrentMoscowTimeFallback() {
        const now = new Date();
        const utcTime = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000);
        const mskTime = new Date(utcTime.getTime() + (CONFIG.TIME_ZONE_OFFSET * 60 * 60 * 1000));
        
        return mskTime.toISOString().replace('T', ' ').substr(0, 19);
    }
    
    // ===== ПОЛУЧЕНИЕ ЗНАЧЕНИЯ ИЗ COOKIE =====
    function getCookieValue(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }
    
    // ===== ПРЕОБРАЗОВАНИЕ ВРЕМЕНИ В МСК =====
    function convertToMoscowtime(utcTime) {
        if (!utcTime) return '';
        
        try {
            const [datePart, timePart] = utcTime.split(' ');
            if (!datePart || !timePart) return utcTime;
            
            const [year, month, day] = datePart.split('-');
            const [hour, minute, second] = timePart.split(':');
            
            const utcDate = new Date(Date.UTC(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hour),
                parseInt(minute),
                parseInt(second)
            ));
            
            // Добавляем смещение МСК (UTC+3)
            const mskDate = new Date(utcDate.getTime() + (CONFIG.TIME_ZONE_OFFSET * 60 * 60 * 1000));
            
            const mskYear = mskDate.getUTCFullYear();
            const mskMonth = String(mskDate.getUTCMonth() + 1).padStart(2, '0');
            const mskDay = String(mskDate.getUTCDate()).padStart(2, '0');
            const mskHour = String(mskDate.getUTCHours()).padStart(2, '0');
            const mskMinute = String(mskDate.getUTCMinutes()).padStart(2, '0');
            const mskSecond = String(mskDate.getUTCSeconds()).padStart(2, '0');
            
            return `${mskYear}-${mskMonth}-${mskDay} ${mskHour}:${mskMinute}:${mskSecond}`;
        } catch (e) {
            console.warn('[StatTemKC] Ошибка преобразования времени:', e);
            return utcTime;
        }
    }
    
    // ===== ПОИСК ЭЛЕМЕНТОВ DOM =====
    function findElements() {
        // Контейнеры
        elements.container = document.querySelector('.stk-content-box');
        elements.filterBlock = document.querySelector('.stk-filter-block');
        elements.dataBlock = document.querySelector('.stk-data-block');
        
        // Переключатели
        elements.typeButtons = document.querySelectorAll('.stk-btn-switch');
        elements.filterButtons = document.querySelectorAll('.stk-filter-btn');
        elements.viewButtons = document.querySelectorAll('.stk-view-btn');
        elements.topButtons = document.querySelectorAll('.stk-top-btn');
        elements.chartButtons = document.querySelectorAll('.stk-chart-btn');
        
        // Контейнеры данных
        elements.tableContainer = document.getElementById('stk-table-container');
        elements.chartContainer = document.getElementById('stk-chart-container');
        elements.chartLegend = document.getElementById('stk-chart-legend');
        elements.chartTypes = document.querySelector('.stk-chart-types');
        
        // Кнопки действий
        elements.showBtn = document.getElementById('stk-show-btn');
        elements.exportBtn = document.getElementById('stk-export-btn');
        elements.clearBtn = document.getElementById('stk-clear-btn');
        elements.downloadBtn = document.getElementById('stk-download-btn');
        elements.fullscreenBtn = document.getElementById('stk-fullscreen-btn');
        elements.refreshBtn = document.getElementById('stk-refresh-btn');
        
        // Прочие элементы
        elements.tableBody = document.getElementById('stk-table-body');
        elements.totalRecords = document.getElementById('stk-total-records');
        elements.titleTypeLabel = document.getElementById('stk-type-label');
        elements.titlePeriodLabel = document.getElementById('stk-period-label');
        elements.tableHeader = document.getElementById('stk-table-header');
        elements.emptyState = document.querySelector('.stk-empty-state');
        
        // Фильтр для часов может быть скрытым
        elements.hourFilterBtn = document.querySelector('.stk-filter-btn[data-period="hour"]');
        
        // Контейнеры периодов будем создавать динамически
        elements.periodContainers = {};
        
        console.log('[StatTemKC] DOM элементы найдены');
    }
    
    // ===== НАСТРОЙКА UI =====
    function setupUI() {
        // Создаем контейнеры для периодов
        ['month', 'day', 'hour', 'custom'].forEach(period => {
            let container = document.getElementById(`stk-${period}-container`);
            
            if (!container && elements.filterBlock) {
                container = document.createElement('div');
                container.id = `stk-${period}-container`;
                container.className = 'stk-period-selector';
                container.style.display = 'none';
                elements.filterBlock.appendChild(container);
            }
            
            elements.periodContainers[period] = container;
        });
        
        // Инициализируем интерфейсы периодов
        setupMonthSelector();
        setupDaySelector();
        setupHourSelector();
        setupCustomSelector();
        
        // Создаем пустое состояние, если оно отсутствует
        setupEmptyState();
        
        // Создаем индикатор загрузки
        if (!document.getElementById('stk-loading-overlay')) {
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'stk-loading-overlay';
            loadingOverlay.className = 'stk-loading-overlay';
            loadingOverlay.style.display = 'none';
            
            const spinner = document.createElement('div');
            spinner.className = 'stk-spinner';
            loadingOverlay.appendChild(spinner);
            
            if (elements.dataBlock) {
                elements.dataBlock.appendChild(loadingOverlay);
            }
        }
        
        // Скрываем фильтр часов для чатов
        if (elements.hourFilterBtn) {
            elements.hourFilterBtn.style.display = state.dataType === 'calls' ? '' : 'none';
        }
        
        // Центрируем контейнер для графика
        if (elements.chartContainer) {
            elements.chartContainer.style.display = 'flex';
            elements.chartContainer.style.justifyContent = 'center';
            elements.chartContainer.style.alignItems = 'center';
            elements.chartContainer.style.height = '400px';
            elements.chartContainer.style.position = 'relative';
        }
        
        console.log('[StatTemKC] UI настроен');
    }
    
    // ===== НАСТРОЙКА СЕЛЕКТОРА МЕСЯЦЕВ =====
    function setupMonthSelector() {
        const container = elements.periodContainers.month;
        if (!container) return;
        
        container.innerHTML = '';
        
        // Селекторы месяца и года в строку
        const selectorsContainer = document.createElement('div');
        selectorsContainer.className = 'stk-date-range-container';
        
        // Селектор года
        const yearWrapper = document.createElement('div');
        yearWrapper.className = 'stk-selector-wrapper';
        
        const yearLabel = document.createElement('label');
        yearLabel.className = 'stk-selector-label';
        yearLabel.htmlFor = 'stk-year-select';
        yearLabel.textContent = 'Год:';
        
        const yearSelect = document.createElement('select');
        yearSelect.id = 'stk-year-select';
        yearSelect.className = 'stk-select';
        
        // Заполняем годы от настраиваемого года до текущего 
        const currentYear = new Date().getFullYear();
        for (let year = CONFIG.DEFAULT_START_YEAR; year <= currentYear + 0; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === state.selectedYear) option.selected = true;
            yearSelect.appendChild(option);
        }
        
        yearSelect.onchange = function() {
            const selectedYear = parseInt(this.value);
            state.selectedYear = selectedYear;
            
            // При изменении года обновляем доступность месяцев
            updateMonthSelectOptions(monthSelect, selectedYear);
        };
        
        yearWrapper.appendChild(yearLabel);
        yearWrapper.appendChild(yearSelect);
        
        // Селектор месяца
        const monthWrapper = document.createElement('div');
        monthWrapper.className = 'stk-selector-wrapper';
        
        const monthLabel = document.createElement('label');
        monthLabel.className = 'stk-selector-label';
        monthLabel.htmlFor = 'stk-month-select';
        monthLabel.textContent = 'Месяц:';
        
        const monthSelect = document.createElement('select');
        monthSelect.id = 'stk-month-select';
        monthSelect.className = 'stk-select';
        
        // Обновляем доступность месяцев
        updateMonthSelectOptions(monthSelect, state.selectedYear);
        
        monthSelect.onchange = function() {
            state.selectedMonth = parseInt(this.value);
        };
        
        monthWrapper.appendChild(monthLabel);
        monthWrapper.appendChild(monthSelect);
        
        // Собираем всё вместе
        selectorsContainer.appendChild(yearWrapper);
        selectorsContainer.appendChild(monthWrapper);
        container.appendChild(selectorsContainer);
        
        // Добавляем переключатель сравнения
        addComparisonToggle(container, 'month');
    }
    
    // ===== ОБНОВЛЕНИЕ ОПЦИЙ МЕСЯЦЕВ =====
    function updateMonthSelectOptions(monthSelect, selectedYear) {
        // Сохраняем текущий выбранный месяц, если он есть
        const currentSelectedMonth = monthSelect.value ? parseInt(monthSelect.value) : state.selectedMonth;
        
        // Очищаем текущие опции
        monthSelect.innerHTML = '';
        
        // Получаем текущий год и месяц
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // JavaScript месяцы от 0 до 11
        
        // Заполняем месяцы
        CONFIG.MONTH_NAMES.forEach((month, index) => {
            const monthNumber = index + 1;
            const option = document.createElement('option');
            option.value = monthNumber;
            option.textContent = month;
            
            // Отключаем будущие месяцы для текущего года
            if (selectedYear === currentYear && monthNumber > currentMonth) {
                option.disabled = true;
                option.style.color = '#aaa';
                option.title = 'Этот месяц еще не наступил';
            }
            
            // Выбираем месяц
            if (monthNumber === currentSelectedMonth) {
                // Если выбранный месяц отключен (будущий), выбираем текущий
                if (option.disabled) {
                    option.selected = false;
                    state.selectedMonth = currentMonth;
                } else {
                    option.selected = true;
                }
            } else if (selectedYear === currentYear && monthNumber === currentMonth && 
                       (currentSelectedMonth > currentMonth || !monthSelect.value)) {
                // Если нет выбранного месяца или он отключен (будущий), выбираем текущий
                option.selected = true;
                state.selectedMonth = currentMonth;
            }
            
            monthSelect.appendChild(option);
        });
        
        // Убедимся, что выбран допустимый месяц
        if (!monthSelect.value) {
            // Если ни один месяц не выбран, выбираем первый доступный
            const firstEnabled = monthSelect.querySelector('option:not([disabled])');
            if (firstEnabled) {
                firstEnabled.selected = true;
                state.selectedMonth = parseInt(firstEnabled.value);
            }
        }
    }
    
    // ===== НАСТРОЙКА СЕЛЕКТОРА ДНЕЙ =====
    function setupDaySelector() {
        const container = elements.periodContainers.day;
        if (!container) return;
        
        container.innerHTML = '';
        
        // Заголовок
        const title = document.createElement('h3');
        title.className = 'stk-period-title';
        title.textContent = 'Выберите диапазон дат:';
        container.appendChild(title);
        
        // Контейнер для выбора дат (в одну строку)
        const datesContainer = document.createElement('div');
        datesContainer.className = 'stk-date-range-container';
        
        // Начальная дата
        const startDateWrapper = document.createElement('div');
        startDateWrapper.className = 'stk-selector-wrapper';
        
        const startDateLabel = document.createElement('label');
        startDateLabel.className = 'stk-selector-label';
        startDateLabel.htmlFor = 'stk-day-start-input';
        startDateLabel.textContent = 'С:';
        
        const startDateInput = document.createElement('input');
        startDateInput.type = 'text';
        startDateInput.id = 'stk-day-start-input';
        startDateInput.className = 'stk-date-input';
        startDateInput.placeholder = 'Начальная дата';
        startDateInput.readOnly = true;
        
        startDateWrapper.appendChild(startDateLabel);
        startDateWrapper.appendChild(startDateInput);
        
        // Конечная дата
        const endDateWrapper = document.createElement('div');
        endDateWrapper.className = 'stk-selector-wrapper';
        
        const endDateLabel = document.createElement('label');
        endDateLabel.className = 'stk-selector-label';
        endDateLabel.htmlFor = 'stk-day-end-input';
        endDateLabel.textContent = 'По:';
        
        const endDateInput = document.createElement('input');
        endDateInput.type = 'text';
        endDateInput.id = 'stk-day-end-input';
        endDateInput.className = 'stk-date-input';
        endDateInput.placeholder = 'Конечная дата';
        endDateInput.readOnly = true;
        
        endDateWrapper.appendChild(endDateLabel);
        endDateWrapper.appendChild(endDateInput);
        
        datesContainer.appendChild(startDateWrapper);
        datesContainer.appendChild(endDateWrapper);
        container.appendChild(datesContainer);
        
        // Добавляем переключатель сравнения
        addComparisonToggle(container, 'day');
    }
    
    // ===== НАСТРОЙКА СЕЛЕКТОРА ЧАСОВ =====
    function setupHourSelector() {
        const container = elements.periodContainers.hour;
        if (!container) return;
        
        container.innerHTML = '';
        
        // Заголовок
        const title = document.createElement('h3');
        title.className = 'stk-period-title';
        title.textContent = 'Выберите дату и диапазон часов:';
        container.appendChild(title);
        
        // Контейнер для выбора даты
        const dateContainer = document.createElement('div');
        dateContainer.className = 'stk-date-range-container';
        
        // Поле выбора даты
        const dateWrapper = document.createElement('div');
        dateWrapper.className = 'stk-selector-wrapper';
        
        const dateLabel = document.createElement('label');
        dateLabel.className = 'stk-selector-label';
        dateLabel.htmlFor = 'stk-hour-date-input';
        dateLabel.textContent = 'Дата:';
        
        const dateInput = document.createElement('input');
        dateInput.type = 'text';
        dateInput.id = 'stk-hour-date-input';
        dateInput.className = 'stk-date-input';
        dateInput.placeholder = 'Выберите дату';
        dateInput.readOnly = true;
        
        dateWrapper.appendChild(dateLabel);
        dateWrapper.appendChild(dateInput);
        dateContainer.appendChild(dateWrapper);
        container.appendChild(dateContainer);
        
        // Контейнер для выбора часов (в одну строку)
        const hoursContainer = document.createElement('div');
        hoursContainer.className = 'stk-date-range-container';
        
        // Начальный час
        const startHourWrapper = document.createElement('div');
        startHourWrapper.className = 'stk-selector-wrapper';
        
        const startHourLabel = document.createElement('label');
        startHourLabel.className = 'stk-selector-label';
        startHourLabel.htmlFor = 'stk-hour-start-select';
        startHourLabel.textContent = 'С часа:';
        
        const startHourSelect = document.createElement('select');
        startHourSelect.id = 'stk-hour-start-select';
        startHourSelect.className = 'stk-select';
        
        // Конечный час
        const endHourWrapper = document.createElement('div');
        endHourWrapper.className = 'stk-selector-wrapper';
        
        const endHourLabel = document.createElement('label');
        endHourLabel.className = 'stk-selector-label';
        endHourLabel.htmlFor = 'stk-hour-end-select';
        endHourLabel.textContent = 'По час:';
        
        const endHourSelect = document.createElement('select');
        endHourSelect.id = 'stk-hour-end-select';
        endHourSelect.className = 'stk-select';
        
        // Заполняем опции для часов
        for (let i = 0; i < 24; i++) {
            const startOption = document.createElement('option');
            startOption.value = i;
            startOption.textContent = `${String(i).padStart(2, '0')}:00`;
            startHourSelect.appendChild(startOption);
            
            const endOption = document.createElement('option');
            endOption.value = i;
            endOption.textContent = `${String(i).padStart(2, '0')}:00`;
            endHourSelect.appendChild(endOption);
        }
        
        // По умолчанию выбираем последний час для конечного селектора
        endHourSelect.value = '23';
        
        startHourSelect.onchange = function() {
            state.hourStartHour = parseInt(this.value);
            
            // Проверяем корректность диапазона
            if (state.hourEndHour < state.hourStartHour) {
                endHourSelect.value = this.value;
                state.hourEndHour = state.hourStartHour;
            }
        };
        
        endHourSelect.onchange = function() {
            state.hourEndHour = parseInt(this.value);
            
            // Проверяем корректность диапазона
            if (state.hourStartHour > state.hourEndHour) {
                startHourSelect.value = this.value;
                state.hourStartHour = state.hourEndHour;
            }
        };
        
        startHourWrapper.appendChild(startHourLabel);
        startHourWrapper.appendChild(startHourSelect);
        endHourWrapper.appendChild(endHourLabel);
        endHourWrapper.appendChild(endHourSelect);
        
        hoursContainer.appendChild(startHourWrapper);
        hoursContainer.appendChild(endHourWrapper);
        container.appendChild(hoursContainer);
        
        // Добавляем переключатель сравнения
        addComparisonToggle(container, 'hour');
    }
    
    // ===== НАСТРОЙКА СЕЛЕКТОРА ПРОИЗВОЛЬНОГО ПЕРИОДА =====
    function setupCustomSelector() {
        const container = elements.periodContainers.custom;
        if (!container) return;
        
        container.innerHTML = '';
        
        // Заголовок
        const title = document.createElement('h3');
        title.className = 'stk-period-title';
        title.textContent = 'Выберите произвольный период:';
        container.appendChild(title);
        
        // Контейнер для выбора дат (в одну строку)
        const datesContainer = document.createElement('div');
        datesContainer.className = 'stk-date-range-container';
        
        // Начальная дата
        const startDateWrapper = document.createElement('div');
        startDateWrapper.className = 'stk-selector-wrapper';
        
        const startDateLabel = document.createElement('label');
        startDateLabel.className = 'stk-selector-label';
        startDateLabel.htmlFor = 'stk-custom-start-input';
        startDateLabel.textContent = 'С:';
        
        const startDateInput = document.createElement('input');
        startDateInput.type = 'text';
        startDateInput.id = 'stk-custom-start-input';
        startDateInput.className = 'stk-date-input';
        startDateInput.placeholder = 'Начальная дата';
        startDateInput.readOnly = true;
        
        startDateWrapper.appendChild(startDateLabel);
        startDateWrapper.appendChild(startDateInput);
        
        // Конечная дата
        const endDateWrapper = document.createElement('div');
        endDateWrapper.className = 'stk-selector-wrapper';
        
        const endDateLabel = document.createElement('label');
        endDateLabel.className = 'stk-selector-label';
        endDateLabel.htmlFor = 'stk-custom-end-input';
        endDateLabel.textContent = 'По:';
        
        const endDateInput = document.createElement('input');
        endDateInput.type = 'text';
        endDateInput.id = 'stk-custom-end-input';
        endDateInput.className = 'stk-date-input';
        endDateInput.placeholder = 'Конечная дата';
        endDateInput.readOnly = true;
        
        endDateWrapper.appendChild(endDateLabel);
        endDateWrapper.appendChild(endDateInput);
        
        datesContainer.appendChild(startDateWrapper);
        datesContainer.appendChild(endDateWrapper);
        container.appendChild(datesContainer);
        
        // Добавляем переключатель сравнения
        addComparisonToggle(container, 'custom');
    }
    
    // ===== ДОБАВЛЕНИЕ ПЕРЕКЛЮЧАТЕЛЯ СРАВНЕНИЯ =====
    function addComparisonToggle(container, periodType) {
        // Создаем переключатель сравнения
        const comparisonToggle = document.createElement('button');
        comparisonToggle.className = 'stk-comparison-toggle';
        comparisonToggle.innerHTML = '<i class="fas fa-chart-line"></i> Включить сравнение';
        comparisonToggle.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            state.comparisonEnabled = !state.comparisonEnabled;
            this.classList.toggle('active', state.comparisonEnabled);
            comparisonContainer.classList.toggle('active', state.comparisonEnabled);
            this.innerHTML = state.comparisonEnabled ? 
                '<i class="fas fa-chart-line"></i> Отключить сравнение' : 
                '<i class="fas fa-chart-line"></i> Включить сравнение';
        };
        
        container.appendChild(comparisonToggle);
        
        // Создаем контейнер для настроек сравнения
        const comparisonContainer = document.createElement('div');
        comparisonContainer.className = 'stk-comparison-container';
        
        const comparisonTitle = document.createElement('div');
        comparisonTitle.className = 'stk-comparison-title';
        comparisonTitle.textContent = 'Настройки сравнения';
        comparisonContainer.appendChild(comparisonTitle);
        
        // Добавляем элементы сравнения в зависимости от типа периода
        switch(periodType) {
            case 'month':
                setupMonthComparison(comparisonContainer);
                break;
            case 'day':
                setupDayComparison(comparisonContainer);
                break;
            case 'hour':
                setupHourComparison(comparisonContainer);
                break;
            case 'custom':
                setupCustomComparison(comparisonContainer);
                break;
        }
        
        container.appendChild(comparisonContainer);
    }
    
    // ===== НАСТРОЙКА СРАВНЕНИЯ ДЛЯ МЕСЯЦА =====
    function setupMonthComparison(container) {
        // Селекторы месяца и года для сравнения (в одну строку)
        const selectorsContainer = document.createElement('div');
        selectorsContainer.className = 'stk-date-range-container';
        
        // Селектор года
        const yearWrapper = document.createElement('div');
        yearWrapper.className = 'stk-selector-wrapper';
        
        const yearLabel = document.createElement('label');
        yearLabel.className = 'stk-selector-label';
        yearLabel.htmlFor = 'stk-comparison-year-select';
        yearLabel.textContent = 'Год для сравнения:';
        
        const yearSelect = document.createElement('select');
        yearSelect.id = 'stk-comparison-year-select';
        yearSelect.className = 'stk-select';
        
        // Заполняем годы
        const currentYear = new Date().getFullYear();
        for (let year = CONFIG.DEFAULT_START_YEAR; year <= currentYear + 0; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === state.comparisonYear) option.selected = true;
            yearSelect.appendChild(option);
        }
        
        yearSelect.onchange = function() {
            const selectedYear = parseInt(this.value);
            state.comparisonYear = selectedYear;
            
            // При изменении года обновляем доступность месяцев для сравнения
            updateMonthSelectOptions(monthSelect, selectedYear);
        };
        
        yearWrapper.appendChild(yearLabel);
        yearWrapper.appendChild(yearSelect);
        
        // Селектор месяца
        const monthWrapper = document.createElement('div');
        monthWrapper.className = 'stk-selector-wrapper';
        
        const monthLabel = document.createElement('label');
        monthLabel.className = 'stk-selector-label';
        monthLabel.htmlFor = 'stk-comparison-month-select';
        monthLabel.textContent = 'Месяц для сравнения:';
        
        const monthSelect = document.createElement('select');
        monthSelect.id = 'stk-comparison-month-select';
        monthSelect.className = 'stk-select';
        
        // Обновляем доступность месяцев для сравнения
        updateMonthSelectOptions(monthSelect, state.comparisonYear);
        
        monthSelect.onchange = function() {
            state.comparisonMonth = parseInt(this.value);
        };
        
        monthWrapper.appendChild(monthLabel);
        monthWrapper.appendChild(monthSelect);
        
        // Собираем всё вместе
        selectorsContainer.appendChild(yearWrapper);
        selectorsContainer.appendChild(monthWrapper);
        container.appendChild(selectorsContainer);
    }
    
    // ===== НАСТРОЙКА СРАВНЕНИЯ ДЛЯ ДНЕЙ =====
    function setupDayComparison(container) {
        // Контейнер для выбора дат сравнения (в одну строку)
        const datesContainer = document.createElement('div');
        datesContainer.className = 'stk-date-range-container';
        
        // Начальная дата
        const startDateWrapper = document.createElement('div');
        startDateWrapper.className = 'stk-selector-wrapper';
        
        const startDateLabel = document.createElement('label');
        startDateLabel.className = 'stk-selector-label';
        startDateLabel.htmlFor = 'stk-comparison-day-start-input';
        startDateLabel.textContent = 'С (для сравнения):';
        
        const startDateInput = document.createElement('input');
        startDateInput.type = 'text';
        startDateInput.id = 'stk-comparison-day-start-input';
        startDateInput.className = 'stk-date-input';
        startDateInput.placeholder = 'Начальная дата';
        startDateInput.readOnly = true;
        
        startDateWrapper.appendChild(startDateLabel);
        startDateWrapper.appendChild(startDateInput);
        
        // Конечная дата
        const endDateWrapper = document.createElement('div');
        endDateWrapper.className = 'stk-selector-wrapper';
        
        const endDateLabel = document.createElement('label');
        endDateLabel.className = 'stk-selector-label';
        endDateLabel.htmlFor = 'stk-comparison-day-end-input';
        endDateLabel.textContent = 'По (для сравнения):';
        
        const endDateInput = document.createElement('input');
        endDateInput.type = 'text';
        endDateInput.id = 'stk-comparison-day-end-input';
        endDateInput.className = 'stk-date-input';
        endDateInput.placeholder = 'Конечная дата';
        endDateInput.readOnly = true;
        
        endDateWrapper.appendChild(endDateLabel);
        endDateWrapper.appendChild(endDateInput);
        
        datesContainer.appendChild(startDateWrapper);
        datesContainer.appendChild(endDateWrapper);
        container.appendChild(datesContainer);
    }
    
    // ===== НАСТРОЙКА СРАВНЕНИЯ ДЛЯ ЧАСОВ =====
    function setupHourComparison(container) {
        // Контейнер для выбора даты сравнения
        const dateContainer = document.createElement('div');
        dateContainer.className = 'stk-date-range-container';
        
        // Поле выбора даты
        const dateWrapper = document.createElement('div');
        dateWrapper.className = 'stk-selector-wrapper';
        
        const dateLabel = document.createElement('label');
        dateLabel.className = 'stk-selector-label';
        dateLabel.htmlFor = 'stk-comparison-hour-date-input';
        dateLabel.textContent = 'Дата для сравнения:';
        
        const dateInput = document.createElement('input');
        dateInput.type = 'text';
        dateInput.id = 'stk-comparison-hour-date-input';
        dateInput.className = 'stk-date-input';
        dateInput.placeholder = 'Выберите дату';
        dateInput.readOnly = true;
        
        dateWrapper.appendChild(dateLabel);
        dateWrapper.appendChild(dateInput);
        dateContainer.appendChild(dateWrapper);
        container.appendChild(dateContainer);
        
        // Примечание о том, что будет использоваться тот же диапазон часов
        const noteContainer = document.createElement('div');
        noteContainer.style.margin = '10px 0';
        noteContainer.style.fontSize = '13px';
        noteContainer.style.color = '#666';
        noteContainer.textContent = 'Примечание: Будет использоваться тот же диапазон часов, что и для основного периода';
        
        container.appendChild(noteContainer);
    }
    
    // ===== НАСТРОЙКА СРАВНЕНИЯ ДЛЯ ПРОИЗВОЛЬНОГО ПЕРИОДА =====
    function setupCustomComparison(container) {
        // Контейнер для выбора дат сравнения (в одну строку)
        const datesContainer = document.createElement('div');
        datesContainer.className = 'stk-date-range-container';
        
        // Начальная дата
        const startDateWrapper = document.createElement('div');
        startDateWrapper.className = 'stk-selector-wrapper';
        
        const startDateLabel = document.createElement('label');
        startDateLabel.className = 'stk-selector-label';
        startDateLabel.htmlFor = 'stk-comparison-custom-start-input';
        startDateLabel.textContent = 'С (для сравнения):';
        
        const startDateInput = document.createElement('input');
        startDateInput.type = 'text';
        startDateInput.id = 'stk-comparison-custom-start-input';
        startDateInput.className = 'stk-date-input';
        startDateInput.placeholder = 'Начальная дата';
        startDateInput.readOnly = true;
        
        startDateWrapper.appendChild(startDateLabel);
        startDateWrapper.appendChild(startDateInput);
        
        // Конечная дата
        const endDateWrapper = document.createElement('div');
        endDateWrapper.className = 'stk-selector-wrapper';
        
        const endDateLabel = document.createElement('label');
        endDateLabel.className = 'stk-selector-label';
        endDateLabel.htmlFor = 'stk-comparison-custom-end-input';
        endDateLabel.textContent = 'По (для сравнения):';
        
        const endDateInput = document.createElement('input');
        endDateInput.type = 'text';
        endDateInput.id = 'stk-comparison-custom-end-input';
        endDateInput.className = 'stk-date-input';
        endDateInput.placeholder = 'Конечная дата';
        endDateInput.readOnly = true;
        
        endDateWrapper.appendChild(endDateLabel);
        endDateWrapper.appendChild(endDateInput);
        
        datesContainer.appendChild(startDateWrapper);
        datesContainer.appendChild(endDateWrapper);
        container.appendChild(datesContainer);
    }
    
    // ===== НАСТРОЙКА ПУСТОГО СОСТОЯНИЯ =====
    function setupEmptyState() {
        if (elements.tableContainer && !document.querySelector('.stk-empty-state')) {
            const emptyState = document.createElement('div');
            emptyState.className = 'stk-empty-state';
            emptyState.style.display = 'none';
            
            const emptyIcon = document.createElement('div');
            emptyIcon.className = 'stk-empty-icon';
            emptyIcon.innerHTML = '<i class="fas fa-search"></i>';
            
            const emptyText = document.createElement('div');
            emptyText.className = 'stk-empty-text';
            emptyText.innerHTML = 'Нет данных для отображения.<br>Выберите период и нажмите "Вывести данные"';
            
            const emptyBtn = document.createElement('button');
            emptyBtn.className = 'stk-empty-btn';
            emptyBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Загрузить данные';
            emptyBtn.onclick = loadData;
            
            emptyState.appendChild(emptyIcon);
            emptyState.appendChild(emptyText);
            emptyState.appendChild(emptyBtn);
            
            elements.tableContainer.appendChild(emptyState);
            elements.emptyState = emptyState;
        }
    }
    
    // ===== ЗАГРУЗКА ЗАВИСИМОСТЕЙ =====
    function loadDependencies() {
        const promises = [];
        
        // Загружаем Chart.js
        if (typeof Chart === 'undefined') {
            promises.push(loadScript('https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'));
        }
        
        // Загружаем Flatpickr
        if (typeof flatpickr === 'undefined') {
            promises.push(
                loadScript('https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js')
                    .then(() => loadScript('https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/l10n/ru.js'))
                    .then(() => loadCSS('https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css'))
            );
        }
        
        // Загружаем Font Awesome для иконок, если не загружен
        if (!document.querySelector('link[href*="fontawesome"]')) {
            promises.push(loadCSS('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css'));
        }
        
        return Promise.all(promises);
    }
    
    // Загрузка JS-скрипта
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Не удалось загрузить скрипт: ${src}`));
            document.head.appendChild(script);
        });
    }
    
    // Загрузка CSS-файла
    function loadCSS(href) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = () => reject(new Error(`Не удалось загрузить CSS: ${href}`));
            document.head.appendChild(link);
        });
    }
    
    // ===== ИНИЦИАЛИЗАЦИЯ КАЛЕНДАРЕЙ =====
    function setupDatepickers() {
        if (typeof flatpickr === 'undefined') {
            console.error('[StatTemKC] Flatpickr не загружен');
            return;
        }
        
        // Определяем общие настройки для всех календарей
        const commonConfig = {
            dateFormat: CONFIG.DATE_FORMAT,
            locale: 'ru',
            disableMobile: true,
            allowInput: false,
            // Важные настройки для корректного отображения
            appendTo: document.body, // Важно: прикрепляем к body для правильного z-index
            position: 'below', // Открывать календарь вниз
            static: false, // Значение false для динамического позиционирования
            zIndex: 9999 // Высокий z-index для отображения поверх других элементов
        };
        
        try {
            // Календарь начальной даты (дни)
            const dayStartInput = document.getElementById('stk-day-start-input');
            if (dayStartInput) {
                state.datepickers.dayStart = flatpickr(dayStartInput, {
                    ...commonConfig,
                    defaultDate: state.dayStartDate,
                    maxDate: 'today',
                    onChange: function(selectedDates) {
                        if (selectedDates.length > 0) {
                            state.dayStartDate = selectedDates[0];
                            
                            // Обновляем минимальную дату конечного календаря
                            if (state.datepickers.dayEnd) {
                                state.datepickers.dayEnd.set('minDate', selectedDates[0]);
                                
                                // Если конечная дата меньше начальной, обновляем конечную
                                if (state.dayEndDate < state.dayStartDate) {
                                    state.dayEndDate = new Date(state.dayStartDate);
                                    state.datepickers.dayEnd.setDate(state.dayEndDate);
                                }
                            }
                        }
                    }
                });
            }
            
            // Календарь конечной даты (дни)
            const dayEndInput = document.getElementById('stk-day-end-input');
            if (dayEndInput) {
                state.datepickers.dayEnd = flatpickr(dayEndInput, {
                    ...commonConfig,
                    defaultDate: state.dayEndDate,
                    maxDate: 'today',
                    minDate: state.dayStartDate,
                    onChange: function(selectedDates) {
                        if (selectedDates.length > 0) {
                            state.dayEndDate = selectedDates[0];
                        }
                    }
                });
            }
            
            // Календарь для часов
            const hourDateInput = document.getElementById('stk-hour-date-input');
            if (hourDateInput) {
                state.datepickers.hourDate = flatpickr(hourDateInput, {
                    ...commonConfig,
                    defaultDate: state.hourDate,
                    maxDate: 'today',
                    onChange: function(selectedDates) {
                        if (selectedDates.length > 0) {
                            state.hourDate = selectedDates[0];
                        }
                    }
                });
            }
            
            // Календарь начальной даты (произвольный период)
            const customStartInput = document.getElementById('stk-custom-start-input');
            if (customStartInput) {
                state.datepickers.customStart = flatpickr(customStartInput, {
                    ...commonConfig,
                    defaultDate: state.customStartDate,
                    maxDate: 'today',
                    onChange: function(selectedDates) {
                        if (selectedDates.length > 0) {
                            state.customStartDate = selectedDates[0];
                            
                            // Обновляем минимальную дату конечного календаря
                            if (state.datepickers.customEnd) {
                                state.datepickers.customEnd.set('minDate', selectedDates[0]);
                                
                                // Если конечная дата меньше начальной, обновляем конечную
                                if (state.customEndDate < state.customStartDate) {
                                    state.customEndDate = new Date(state.customStartDate);
                                    state.datepickers.customEnd.setDate(state.customEndDate);
                                }
                            }
                        }
                    }
                });
            }
            
            // Календарь конечной даты (произвольный период)
            const customEndInput = document.getElementById('stk-custom-end-input');
            if (customEndInput) {
                state.datepickers.customEnd = flatpickr(customEndInput, {
                    ...commonConfig,
                    defaultDate: state.customEndDate,
                    maxDate: 'today',
                    minDate: state.customStartDate,
                    onChange: function(selectedDates) {
                        if (selectedDates.length > 0) {
                            state.customEndDate = selectedDates[0];
                        }
                    }
                });
            }
            
            // Календари для сравнения
            setupComparisonDatepickers(commonConfig);
            
            console.log('[StatTemKC] Календари инициализированы');
        } catch (error) {
            console.error('[StatTemKC] Ошибка инициализации календарей:', error);
        }
    }
    
    // ===== ИНИЦИАЛИЗАЦИЯ КАЛЕНДАРЕЙ ДЛЯ СРАВНЕНИЯ =====
    function setupComparisonDatepickers(commonConfig) {
        // Календарь для сравнения дней (начальная дата)
        const comparisonDayStartInput = document.getElementById('stk-comparison-day-start-input');
        if (comparisonDayStartInput) {
            state.datepickers.comparisonDayStart = flatpickr(comparisonDayStartInput, {
                ...commonConfig,
                defaultDate: state.comparisonDayStartDate,
                maxDate: 'today',
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        state.comparisonDayStartDate = selectedDates[0];
                        
                        if (state.datepickers.comparisonDayEnd) {
                            state.datepickers.comparisonDayEnd.set('minDate', selectedDates[0]);
                            
                            if (state.comparisonDayEndDate < state.comparisonDayStartDate) {
                                state.comparisonDayEndDate = new Date(state.comparisonDayStartDate);
                                state.datepickers.comparisonDayEnd.setDate(state.comparisonDayEndDate);
                            }
                        }
                    }
                }
            });
        }
        
        // Календарь для сравнения дней (конечная дата)
        const comparisonDayEndInput = document.getElementById('stk-comparison-day-end-input');
        if (comparisonDayEndInput) {
            state.datepickers.comparisonDayEnd = flatpickr(comparisonDayEndInput, {
                ...commonConfig,
                defaultDate: state.comparisonDayEndDate,
                maxDate: 'today',
                minDate: state.comparisonDayStartDate,
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        state.comparisonDayEndDate = selectedDates[0];
                    }
                }
            });
        }
        
        // Календарь для сравнения часов
        const comparisonHourDateInput = document.getElementById('stk-comparison-hour-date-input');
        if (comparisonHourDateInput) {
            state.datepickers.comparisonHourDate = flatpickr(comparisonHourDateInput, {
                ...commonConfig,
                defaultDate: state.comparisonHourDate,
                maxDate: 'today',
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        state.comparisonHourDate = selectedDates[0];
                    }
                }
            });
        }
        
        // Календарь для сравнения произвольного периода (начальная дата)
        const comparisonCustomStartInput = document.getElementById('stk-comparison-custom-start-input');
        if (comparisonCustomStartInput) {
            state.datepickers.comparisonCustomStart = flatpickr(comparisonCustomStartInput, {
                ...commonConfig,
                defaultDate: state.comparisonCustomStartDate,
                maxDate: 'today',
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        state.comparisonCustomStartDate = selectedDates[0];
                        
                        if (state.datepickers.comparisonCustomEnd) {
                            state.datepickers.comparisonCustomEnd.set('minDate', selectedDates[0]);
                            
                            if (state.comparisonCustomEndDate < state.comparisonCustomStartDate) {
                                state.comparisonCustomEndDate = new Date(state.comparisonCustomStartDate);
                                state.datepickers.comparisonCustomEnd.setDate(state.comparisonCustomEndDate);
                            }
                        }
                    }
                }
            });
        }
        
        // Календарь для сравнения произвольного периода (конечная дата)
        const comparisonCustomEndInput = document.getElementById('stk-comparison-custom-end-input');
        if (comparisonCustomEndInput) {
            state.datepickers.comparisonCustomEnd = flatpickr(comparisonCustomEndInput, {
                ...commonConfig,
                defaultDate: state.comparisonCustomEndDate,
                maxDate: 'today',
                minDate: state.comparisonCustomStartDate,
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        state.comparisonCustomEndDate = selectedDates[0];
                    }
                }
            });
        }
    }
    
    // ===== УСТАНОВКА ОБРАБОТЧИКОВ СОБЫТИЙ =====
    function setupEventHandlers() {
        // Кнопки типа данных (Звонки/Чаты)
        if (elements.typeButtons && elements.typeButtons.length) {
            elements.typeButtons.forEach(btn => {
                // Удаляем старый обработчик, если он был
                const oldHandler = btn._clickHandler;
                if (oldHandler) {
                    btn.removeEventListener('click', oldHandler);
                }
                
                // Создаем и сохраняем новый обработчик
                const newHandler = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                                        const type = this.dataset.type;
                    if (type !== state.dataType) {
                        state.dataType = type;
                        
                        // Визуальное обновление кнопок
                        elements.typeButtons.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        
                        // Показываем/скрываем фильтр часов
                        if (elements.hourFilterBtn) {
                            elements.hourFilterBtn.style.display = type === 'calls' ? '' : 'none';
                        }
                        
                        // Если выбраны чаты и активен фильтр часов, переключаемся на месяц
                        if (type === 'chats' && state.periodType === 'hour') {
                            state.periodType = 'month';
                            elements.filterButtons.forEach(b => {
                                b.classList.toggle('active', b.dataset.period === 'month');
                            });
                        }
                        
                        updateUI();
                    }
                };
                
                // Сохраняем обработчик для возможности последующего удаления
                btn._clickHandler = newHandler;
                btn.addEventListener('click', newHandler);
            });
        }

        // Кнопки периодов (Месяц/День/Час/Произвольный)
        if (elements.filterButtons && elements.filterButtons.length) {
            elements.filterButtons.forEach(btn => {
                // Удаляем старый обработчик, если он был
                const oldHandler = btn._clickHandler;
                if (oldHandler) {
                    btn.removeEventListener('click', oldHandler);
                }
                
                // Создаем и сохраняем новый обработчик
                const newHandler = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const period = this.dataset.period;
                    if (period !== state.periodType) {
                        state.periodType = period;
                        
                        // Визуальное обновление кнопок
                        elements.filterButtons.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        
                        updateUI();
                    }
                };
                
                // Сохраняем обработчик для возможности последующего удаления
                btn._clickHandler = newHandler;
                btn.addEventListener('click', newHandler);
            });
        }

        // Кнопки вида (Таблица/График)
        if (elements.viewButtons && elements.viewButtons.length) {
            elements.viewButtons.forEach(btn => {
                // Удаляем старый обработчик, если он был
                const oldHandler = btn._clickHandler;
                if (oldHandler) {
                    btn.removeEventListener('click', oldHandler);
                }
                
                // Создаем и сохраняем новый обработчик
                const newHandler = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const view = this.dataset.view;
                    if (view !== state.viewType) {
                        state.viewType = view;
                        
                        // Визуальное обновление кнопок
                        elements.viewButtons.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        
                        updateUI();
                        
                        if (view === 'chart' && state.rawData.length > 0) {
                            createChart();
                        }
                    }
                };
                
                // Сохраняем обработчик для возможности последующего удаления
                btn._clickHandler = newHandler;
                btn.addEventListener('click', newHandler);
            });
        }

        // Обработчики для кнопок топ-N
        setupTopButtons();
        
        // Обработчики для кнопок типа графика
        setupChartButtons();
        
        // Кнопка "Вывести данные"
        if (elements.showBtn) {
            const oldHandler = elements.showBtn._clickHandler;
            if (oldHandler) {
                elements.showBtn.removeEventListener('click', oldHandler);
            }
            
            const newHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                addButtonEffect(this);
                loadData();
            };
            
            elements.showBtn._clickHandler = newHandler;
            elements.showBtn.addEventListener('click', newHandler);
        }
        
        // Кнопка "Экспорт в Excel"
        if (elements.exportBtn) {
            const oldHandler = elements.exportBtn._clickHandler;
            if (oldHandler) {
                elements.exportBtn.removeEventListener('click', oldHandler);
            }
            
            const newHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                addButtonEffect(this);
                exportToExcel();
            };
            
            elements.exportBtn._clickHandler = newHandler;
            elements.exportBtn.addEventListener('click', newHandler);
        }
        
        // Кнопка "Очистить"
        if (elements.clearBtn) {
            const oldHandler = elements.clearBtn._clickHandler;
            if (oldHandler) {
                elements.clearBtn.removeEventListener('click', oldHandler);
            }
            
            const newHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                addButtonEffect(this);
                clearFilters();
            };
            
            elements.clearBtn._clickHandler = newHandler;
            elements.clearBtn.addEventListener('click', newHandler);
        }
        
        // Кнопка "Скачать график"
        if (elements.downloadBtn) {
            const oldHandler = elements.downloadBtn._clickHandler;
            if (oldHandler) {
                elements.downloadBtn.removeEventListener('click', oldHandler);
            }
            
            const newHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                addButtonEffect(this);
                downloadChart();
            };
            
            elements.downloadBtn._clickHandler = newHandler;
            elements.downloadBtn.addEventListener('click', newHandler);
        }
        
        // Кнопка "Обновить"
        if (elements.refreshBtn) {
            const oldHandler = elements.refreshBtn._clickHandler;
            if (oldHandler) {
                elements.refreshBtn.removeEventListener('click', oldHandler);
            }
            
            const newHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.add('rotate-animation');
                setTimeout(() => {
                    this.classList.remove('rotate-animation');
                    loadData();
                }, 500);
            };
            
            elements.refreshBtn._clickHandler = newHandler;
            elements.refreshBtn.addEventListener('click', newHandler);
        }
        
        // Кнопка "Полноэкранный режим"
        if (elements.fullscreenBtn) {
            const oldHandler = elements.fullscreenBtn._clickHandler;
            if (oldHandler) {
                elements.fullscreenBtn.removeEventListener('click', oldHandler);
            }
            
            const newHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleFullscreen();
            };
            
            elements.fullscreenBtn._clickHandler = newHandler;
            elements.fullscreenBtn.addEventListener('click', newHandler);
        }
        
        // Обработчик сортировки в заголовке таблицы
        if (elements.tableHeader) {
            const oldHandler = elements.tableHeader._clickHandler;
            if (oldHandler) {
                elements.tableHeader.removeEventListener('click', oldHandler);
            }
            
            const newHandler = function(e) {
                const th = e.target.closest('th');
                if (!th) return;
                
                let column = null;
                
                if (th.classList.contains('stk-th-period')) {
                    column = 'report_period';
                } else if (th.classList.contains('stk-th-topic')) {
                    column = 'Subject_chat';
                } else if (th.classList.contains('stk-th-count')) {
                    column = 'Quantity';
                } else {
                    return; // Не сортируем по процентам
                }
                
                // Меняем направление сортировки или устанавливаем новый столбец
                if (state.sortColumn === column) {
                    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sortColumn = column;
                    state.sortDirection = 'desc'; // По умолчанию сортировка по убыванию
                }
                
                // Если есть данные, перерисовываем таблицу
                if (state.rawData.length > 0) {
                    displayTableData();
                }
            };
            
            elements.tableHeader._clickHandler = newHandler;
            elements.tableHeader.addEventListener('click', newHandler);
        }
        
        // Обработчик изменения размера окна для графиков
        const resizeHandler = debounce(() => {
            if (state.chartInstance) {
                state.chartInstance.resize();
            }
        }, 250);
        
        window.removeEventListener('resize', window._stkResizeHandler);
        window._stkResizeHandler = resizeHandler;
        window.addEventListener('resize', resizeHandler);
        
        // Обработчик для закрытия календарей при клике вне их
        const documentClickHandler = function(e) {
            if (!e.target.closest('.flatpickr-calendar') && !e.target.classList.contains('stk-date-input')) {
                Object.values(state.datepickers).forEach(picker => {
                    if (picker && picker.close) picker.close();
                });
            }
        };
        
        document.removeEventListener('click', window._stkDocumentClickHandler);
        window._stkDocumentClickHandler = documentClickHandler;
        document.addEventListener('click', documentClickHandler);
        
        // Обработчик для периодического обновления информации о пользователе
        const userInfoUpdateHandler = setInterval(async () => {
            await updateUserAndTimeInfo();
        }, CONFIG.AUTH_CHECK_INTERVAL);
        
        // Сохраняем интервал для последующей очистки
        window._stkUserInfoInterval = userInfoUpdateHandler;
        
        console.log('[StatTemKC] Обработчики событий установлены');
    }
    
    // ===== НАСТРОЙКА КНОПОК ТОП-N =====
    function setupTopButtons() {
        if (!elements.topButtons || !elements.topButtons.length) return;
        
        console.log('[StatTemKC] Настройка кнопок топ-N...');
        
        elements.topButtons.forEach(btn => {
            // Удаляем старые обработчики, если они были
            const oldHandler = btn._clickHandler;
            if (oldHandler) {
                btn.removeEventListener('click', oldHandler);
            }
            
            // Создаем новый обработчик для каждой кнопки
            const newHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Получаем значение топ из атрибута напрямую
                const topValue = this.getAttribute('data-top');
                
                console.log(`[StatTemKC] Клик на кнопке топ: ${topValue}`);
                
                if (topValue !== state.topFilter) {
                    // Сохраняем выбранный фильтр в состоянии
                    state.topFilter = topValue;
                    
                    // Снимаем выделение со всех кнопок
                    elements.topButtons.forEach(b => b.classList.remove('active'));
                    
                    // Активируем только нажатую кнопку
                    this.classList.add('active');
                    
                    // Обновляем отображение, если есть данные
                    if (state.rawData.length > 0) {
                        displayData();
                    }
                }
            };
            
            // Сохраняем новый обработчик и добавляем слушатель
            btn._clickHandler = newHandler;
            btn.addEventListener('click', newHandler);
        });
    }

    // ===== НАСТРОЙКА КНОПОК ТИПА ГРАФИКА =====
    function setupChartButtons() {
        if (!elements.chartButtons || !elements.chartButtons.length) return;
        
        console.log('[StatTemKC] Настройка кнопок типов графика...');
        
        elements.chartButtons.forEach(btn => {
            // Удаляем старые обработчики, если они были
            const oldHandler = btn._clickHandler;
            if (oldHandler) {
                btn.removeEventListener('click', oldHandler);
            }
            
            // Создаем новый обработчик для каждой кнопки
            const newHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Получаем тип графика из атрибута напрямую
                const chartType = this.getAttribute('data-chart');
                
                console.log(`[StatTemKC] Клик на типе графика: ${chartType}`);
                
                if (chartType !== state.chartType) {
                    // Сохраняем выбранный тип
                    state.chartType = chartType;
                    
                    // Снимаем выделение со всех кнопок
                    elements.chartButtons.forEach(b => b.classList.remove('active'));
                    
                    // Активируем только нажатую кнопку
                    this.classList.add('active');
                    
                    if (state.rawData.length > 0 && state.viewType === 'chart') {
                        createChart();
                    }
                }
            };
            
            // Сохраняем новый обработчик и добавляем слушатель
            btn._clickHandler = newHandler;
            btn.addEventListener('click', newHandler);
        });
    }
    
    // Функция для добавления эффекта нажатия на кнопку
    function addButtonEffect(button) {
        button.classList.add('stk-btn-active');
        setTimeout(() => {
            button.classList.remove('stk-btn-active');
        }, 200);
    }
    
    // Функция debounce для предотвращения частого выполнения
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    // ===== ОБНОВЛЕНИЕ UI =====
    function updateUI() {
        // Обновляем активные кнопки
        if (elements.typeButtons) {
            elements.typeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === state.dataType);
            });
        }
        
        if (elements.filterButtons) {
            elements.filterButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.period === state.periodType);
            });
        }
        
        if (elements.viewButtons) {
            elements.viewButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === state.viewType);
            });
        }
        
        if (elements.topButtons) {
            elements.topButtons.forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-top') === state.topFilter);
            });
        }
        
        if (elements.chartButtons) {
            elements.chartButtons.forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-chart') === state.chartType);
            });
        }
        
        // Показываем/скрываем контейнеры периодов
        if (elements.periodContainers) {
            Object.keys(elements.periodContainers).forEach(period => {
                const container = elements.periodContainers[period];
                if (container) {
                    container.style.display = period === state.periodType ? 'flex' : 'none';
                }
            });
        }
        
        // Обновляем видимость контейнеров данных
        if (elements.tableContainer) {
            elements.tableContainer.style.display = state.viewType === 'table' ? 'block' : 'none';
        }
        
        if (elements.chartContainer) {
            elements.chartContainer.style.display = state.viewType === 'chart' ? 'flex' : 'none';
        }
        
        if (elements.chartTypes) {
            elements.chartTypes.style.display = state.viewType === 'chart' ? 'flex' : 'none';
        }
        
        if (elements.chartLegend) {
            elements.chartLegend.style.display = state.viewType === 'chart' ? 'flex' : 'none';
        }
        
        if (elements.downloadBtn) {
            elements.downloadBtn.style.display = state.viewType === 'chart' ? 'inline-flex' : 'none';
        }
        
        // Обновляем заголовки
        if (elements.titleTypeLabel) {
            elements.titleTypeLabel.textContent = state.dataType === 'calls' ? 'Звонки' : 'Чаты';
        }
        
        if (elements.titlePeriodLabel) {
            const periodLabels = {
                'month': 'По месяцам',
                'day': 'По дням',
                'hour': 'По часам',
                'custom': 'Произвольный период'
            };
            
            elements.titlePeriodLabel.textContent = periodLabels[state.periodType] || '';
        }
        
        // Показываем/скрываем фильтр часов для чатов
        if (elements.hourFilterBtn) {
            elements.hourFilterBtn.style.display = state.dataType === 'calls' ? '' : 'none';
        }
    }
    
    // ===== ЗАГРУЗКА ДАННЫХ =====
    async function loadData() {
        // Проверяем валидность периода
        if (!validatePeriod()) {
            showNotificationWarning('Выберите корректный период для получения данных');
            return;
        }
        
        // Обновляем информацию о пользователе и времени
        await updateUserAndTimeInfo();
        
        // Показываем индикатор загрузки
        setLoading(true);
        
        // Формируем параметры запроса
        const params = new URLSearchParams();
        params.append('dataType', state.dataType);
        params.append('periodType', state.periodType);
        params.append('tableName', 'stat_tematiks');
        
        // Добавляем параметры в зависимости от типа периода
        switch (state.periodType) {
            case 'month':
                params.append('year', state.selectedYear);
                params.append('months', state.selectedMonth);
                break;
                
            case 'day':
                params.append('startDate', formatDate(state.dayStartDate));
                params.append('endDate', formatDate(state.dayEndDate));
                break;
                
            case 'hour':
                // Преобразуем числа в строки для фильтра по часам
                params.append('date', formatDate(state.hourDate));
                params.append('startHour', String(state.hourStartHour));
                params.append('endHour', String(state.hourEndHour));
                
                // Добавляем специальный режим для часов и звонков
                if (state.dataType === 'calls') {
                    params.append('hourMode', 'true');
                }
                break;
                
            case 'custom':
                params.append('startDate', formatDate(state.customStartDate));
                params.append('endDate', formatDate(state.customEndDate));
                break;
        }
        
        // Если включено сравнение, добавляем параметры для сравнения
        if (state.comparisonEnabled) {
            params.append('comparison', 'true');
            
            switch (state.periodType) {
                case 'month':
                    params.append('comparisonYear', state.comparisonYear);
                    params.append('comparisonMonth', state.comparisonMonth);
                    break;
                    
                case 'day':
                    params.append('comparisonStartDate', formatDate(state.comparisonDayStartDate));
                    params.append('comparisonEndDate', formatDate(state.comparisonDayEndDate));
                    break;
                    
                case 'hour':
                    params.append('comparisonDate', formatDate(state.comparisonHourDate));
                    // Используем те же часы для сравнения и тот же режим
                    params.append('comparisonStartHour', String(state.hourStartHour));
                    params.append('comparisonEndHour', String(state.hourEndHour));
                    if (state.dataType === 'calls') {
                        params.append('comparisonHourMode', 'true');
                    }
                    break;
                    
                case 'custom':
                    params.append('comparisonStartDate', formatDate(state.comparisonCustomStartDate));
                    params.append('comparisonEndDate', formatDate(state.comparisonCustomEndDate));
                    break;
            }
        }
        
        try {
            // Отправляем запрос
            const response = await fetch(`${CONFIG.API_ENDPOINT}?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            
            const responseData = await response.json();
            
            if (responseData.success) {
                if (responseData.data && responseData.data.length > 0) {
                    // Фильтруем итоговые строки
                    state.rawData = responseData.data.filter(item => item.report_period !== 'Итого');
                    
                    // Если есть данные для сравнения
                    if (responseData.comparison && responseData.comparison.length > 0) {
                        state.comparisonData = responseData.comparison.filter(item => item.report_period !== 'Итого');
                    } else {
                        state.comparisonData = [];
                    }
                    
                    // Обрабатываем данные
                    processData();
                    
                    // Отображаем данные
                    displayData();
                    
                    // Отправляем системное уведомление об успехе
                    window.PREDEFINED_NOTIFICATIONS?.DATA_LOADED ? 
                        showSystemNotification('DATA_LOADED') : 
                        showNotificationSuccess('Данные успешно загружены');
                } else {
                    // Проверяем специальный случай для фильтра по часам
                    if (state.periodType === 'hour' && state.dataType === 'calls') {
                        console.warn('[StatTemKC] Нет данных для фильтра по часам');
                        showEmptyState();
                        showNotificationInfo('Нет данных для выбранного периода по часам');
                    } else {
                        showEmptyState();
                        showNotificationInfo('Нет данных для выбранного периода');
                    }
                }
            } else {
                // Особая обработка для ошибок фильтра по часам
                if (state.periodType === 'hour' && state.dataType === 'calls' && 
                    responseData.message && responseData.message.includes('hour')) {
                    throw new Error('Ошибка при загрузке данных по часам. Проверьте формат даты и диапазон часов.');
                } else {
                    throw new Error(responseData.message || 'Ошибка загрузки данных');
                }
            }
        } catch (error) {
            console.error('[StatTemKC] Ошибка загрузки данных:', error);
            showEmptyState();
            window.PREDEFINED_NOTIFICATIONS?.DATA_LOAD_ERROR ? 
                showSystemNotification('DATA_LOAD_ERROR') : 
                showNotificationError(`Ошибка загрузки данных: ${error.message}`);
        } finally {
            // Скрываем индикатор загрузки
            setLoading(false);
        }
    }
    
    // ===== ОТОБРАЖЕНИЕ ЗАГРУЗКИ =====
    function setLoading(isLoading) {
        state.isLoading = isLoading;
        
        // Обновляем состояние UI
        const loadingOverlay = document.getElementById('stk-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = isLoading ? 'flex' : 'none';
        }
    }
    
    // ===== ВАЛИДАЦИЯ ПЕРИОДА =====
    function validatePeriod() {
        switch (state.periodType) {
            case 'month':
                return state.selectedYear && state.selectedMonth;
                
            case 'day':
                return state.dayStartDate && state.dayEndDate;
                
            case 'hour':
                return state.hourDate && 
                       (typeof state.hourStartHour === 'number') && 
                       (typeof state.hourEndHour === 'number');
                
            case 'custom':
                return state.customStartDate && state.customEndDate;
                
            default:
                return false;
        }
    }
    
    // ===== ОБРАБОТКА ДАННЫХ =====
    function processData() {
        // Создаем структуру для хранения обработанных данных
        state.processedData = {};
        state.periodTotals = {};
        
        // Обрабатываем основные данные
        state.rawData.forEach(item => {
            const period = item.report_period;
            const subject = item.Subject_chat;
            const quantity = parseInt(item.Quantity) || 0;
            
            // Инициализируем объекты для периода
            if (!state.processedData[period]) {
                state.processedData[period] = {};
            }
            
            if (!state.periodTotals[period]) {
                state.periodTotals[period] = 0;
            }
            
            // Добавляем данные по тематике
            state.processedData[period][subject] = quantity;
            
            // Обновляем общую сумму по периоду
            state.periodTotals[period] += quantity;
        });
        
        // Если есть данные для сравнения
        if (state.comparisonEnabled && state.comparisonData.length > 0) {
            state.processedComparisonData = {};
            state.comparisonPeriodTotals = {};
            
            state.comparisonData.forEach(item => {
                const period = item.report_period;
                const subject = item.Subject_chat;
                const quantity = parseInt(item.Quantity) || 0;
                
                // Инициализируем объекты для периода сравнения
                if (!state.processedComparisonData[period]) {
                    state.processedComparisonData[period] = {};
                }
                
                if (!state.comparisonPeriodTotals[period]) {
                    state.comparisonPeriodTotals[period] = 0;
                }
                
                // Добавляем данные по тематике для сравнения
                state.processedComparisonData[period][subject] = quantity;
                
                // Обновляем общую сумму по периоду для сравнения
                state.comparisonPeriodTotals[period] += quantity;
            });
        }
    }
    
    // ===== ОТОБРАЖЕНИЕ ДАННЫХ =====
    function displayData() {
        if (state.rawData.length === 0) {
            showEmptyState();
            return;
        }
        
        // Скрываем пустое состояние
        if (elements.emptyState) {
            elements.emptyState.style.display = 'none';
        }
        
        // Отображаем данные в зависимости от выбранного вида
        if (state.viewType === 'table') {
            displayTableData();
        } else if (state.viewType === 'chart') {
            createChart();
        }
    }
    
    // ===== ОТОБРАЖЕНИЕ ПУСТОГО СОСТОЯНИЯ =====
    function showEmptyState() {
        if (elements.emptyState) {
            elements.emptyState.style.display = 'flex';
        }
        
        // Очищаем таблицу
        if (elements.tableBody) {
            elements.tableBody.innerHTML = '';
        }
        
        // Обновляем счетчик записей
        if (elements.totalRecords) {
            elements.totalRecords.textContent = '0';
        }
        
        // Уничтожаем график, если он есть
        if (state.chartInstance) {
            state.chartInstance.destroy();
            state.chartInstance = null;
        }
        
        // Очищаем легенду графика
        if (elements.chartLegend) {
            elements.chartLegend.innerHTML = '';
        }
    }
    
    // ===== ОТОБРАЖЕНИЕ ТАБЛИЦЫ =====
    function displayTableData() {
        if (!elements.tableBody) return;
        
        // Очищаем таблицу
        elements.tableBody.innerHTML = '';
        
        // Создаем массив записей для отображения
        let displayRows = [];
        
        // Собираем данные из обработанной структуры
        Object.keys(state.processedData).forEach(period => {
            Object.keys(state.processedData[period]).forEach(subject => {
                const quantity = state.processedData[period][subject];
                const totalForPeriod = state.periodTotals[period];
                
                // Рассчитываем процент от общего количества в периоде
                const percent = totalForPeriod > 0 ? (quantity / totalForPeriod * 100) : 0;
                
                // Находим данные для сравнения, если они доступны
                let comparisonQuantity = null;
                let comparisonPercent = null;
                let change = null;
                
                if (state.comparisonEnabled && state.processedComparisonData) {
                    // Находим соответствующий период сравнения
                    const comparisonPeriod = findMatchingComparisonPeriod(period);
                    if (comparisonPeriod && state.processedComparisonData[comparisonPeriod]) {
                        comparisonQuantity = state.processedComparisonData[comparisonPeriod][subject] || 0;
                        const totalForComparisonPeriod = state.comparisonPeriodTotals[comparisonPeriod] || 0;
                        comparisonPercent = totalForComparisonPeriod > 0 ? (comparisonQuantity / totalForComparisonPeriod * 100) : 0;
                        
                        // Рассчитываем изменение в процентах
                        if (comparisonQuantity > 0) {
                            change = ((quantity - comparisonQuantity) / comparisonQuantity) * 100;
                        }
                    }
                }
                
                displayRows.push({
                    period,
                    subject,
                    quantity,
                    percent,
                    comparisonQuantity,
                    comparisonPercent,
                    change
                });
            });
        });
        
        // Сохраняем общее количество записей до фильтрации
        const totalRowsBeforeFilter = displayRows.length;
        
        // Применяем фильтр Top N, если выбран
        if (state.topFilter && state.topFilter !== 'all') {
            console.log(`[StatTemKC] Применяем топ фильтр: ${state.topFilter}`);
            
            // Извлекаем цифру из Top N (например, "top10" -> 10)
            const match = state.topFilter.match(/\d+/);
            if (match) {
                const topN = parseInt(match[0]);
                console.log(`[StatTemKC] Топ N = ${topN}`);
                
                if (!isNaN(topN) && topN > 0) {
                    const periodsData = {};
                    
                    // Группируем данные по периодам
                    displayRows.forEach(row => {
                        if (!periodsData[row.period]) {
                            periodsData[row.period] = [];
                        }
                        periodsData[row.period].push(row);
                    });
                    
                    // Для каждого периода отбираем топ N записей
                    const filteredRows = [];
                    Object.keys(periodsData).forEach(period => {
                        const periodRows = periodsData[period];
                        // Сортируем записи по количеству внутри периода
                        periodRows.sort((a, b) => b.quantity - a.quantity);
                        // Отбираем только топ N
                        filteredRows.push(...periodRows.slice(0, topN));
                    });
                    
                    // Заменяем отображаемые данные на отфильтрованные
                    displayRows = filteredRows;
                    console.log(`[StatTemKC] Отфильтровано до ${displayRows.length} записей`);
                }
            }
        }
        
        // Обновляем счетчик записей
        if (elements.totalRecords) {
            elements.totalRecords.textContent = displayRows.length;
        }
        
        // Сортировка данных по указанному столбцу
        if (!state.sortColumn) {
            // По умолчанию сортируем по количеству (от большего к меньшему)
            state.sortColumn = 'Quantity';
            state.sortDirection = 'desc';
        }
        
        const columnMapping = {
            'report_period': 'period',
            'Subject_chat': 'subject',
            'Quantity': 'quantity'
        };
        
        const sortField = columnMapping[state.sortColumn] || 'quantity';
        
        displayRows.sort((a, b) => {
            if (sortField === 'quantity') {
                return state.sortDirection === 'asc' ? 
                    a.quantity - b.quantity : 
                    b.quantity - a.quantity;
            } else {
                const valA = String(a[sortField]).toLowerCase();
                const valB = String(b[sortField]).toLowerCase();
                
                return state.sortDirection === 'asc' ? 
                    valA.localeCompare(valB, 'ru') : 
                    valB.localeCompare(valA, 'ru');
            }
        });
        
        // Добавляем строки в таблицу
        displayRows.forEach((row, index) => {
            const tr = document.createElement('tr');
            
            // Период (форматируем дату, если это дата)
            const tdPeriod = document.createElement('td');
            tdPeriod.textContent = formatPeriodForDisplay(row.period);
            tr.appendChild(tdPeriod);
            
            // Тематика
            const tdTopic = document.createElement('td');
            tdTopic.textContent = row.subject;
            tr.appendChild(tdTopic);
            
            // Количество
            const tdCount = document.createElement('td');
            tdCount.textContent = new Intl.NumberFormat('ru-RU').format(row.quantity);
            tr.appendChild(tdCount);
            
            // Процент
            const tdPercent = document.createElement('td');
            tdPercent.textContent = `${row.percent.toFixed(2).replace('.', ',')}%`;
            tr.appendChild(tdPercent);
            
            // Если включено сравнение, добавляем колонки для сравнения
            if (state.comparisonEnabled && row.comparisonQuantity !== null) {
                // Количество для сравнения
                const tdCompCount = document.createElement('td');
                tdCompCount.textContent = new Intl.NumberFormat('ru-RU').format(row.comparisonQuantity);
                tr.appendChild(tdCompCount);
                
                // Процент для сравнения
                const tdCompPercent = document.createElement('td');
                tdCompPercent.textContent = `${(row.comparisonPercent || 0).toFixed(2).replace('.', ',')}%`;
                tr.appendChild(tdCompPercent);
                
                // Изменение
                const tdChange = document.createElement('td');
                if (row.change !== null) {
                    const changeValue = row.change.toFixed(2).replace('.', ',');
                    const changeClass = row.change > 0 ? 'positive-change' : (row.change < 0 ? 'negative-change' : '');
                    
                    tdChange.innerHTML = `<span class="${changeClass}">${changeValue}%</span>`;
                    
                    // Добавляем иконку для визуального отображения
                    if (row.change > 0) {
                        tdChange.innerHTML += ' <i class="fas fa-arrow-up" style="color: green;"></i>';
                    } else if (row.change < 0) {
                        tdChange.innerHTML += ' <i class="fas fa-arrow-down" style="color: red;"></i>';
                    }
                } else {
                    tdChange.textContent = '-';
                }
                tr.appendChild(tdChange);
            }
            
            // Анимация появления
            tr.style.opacity = 0;
            setTimeout(() => {
                tr.style.transition = 'opacity 0.3s ease';
                tr.style.opacity = 1;
            }, 30 * index);
            
            elements.tableBody.appendChild(tr);
        });
        
        // Обновляем заголовок таблицы с индикаторами сортировки
        updateTableHeader();
    }
    
    // ===== ПОИСК СООТВЕТСТВУЮЩЕГО ПЕРИОДА ДЛЯ СРАВНЕНИЯ =====
    function findMatchingComparisonPeriod(period) {
        // В зависимости от типа периода, ищем соответствующий период для сравнения
        switch(state.periodType) {
            case 'month':
                // Обычно это тот же месяц, но другого года
                return period;
                
            case 'day':
            case 'hour':
            case 'custom':
                // Для дат и произвольных периодов используется прямое соответствие
                // через индексы в массиве периодов
                const mainPeriods = Object.keys(state.processedData);
                const comparisonPeriods = Object.keys(state.processedComparisonData);
                
                const periodIndex = mainPeriods.indexOf(period);
                if (periodIndex !== -1 && periodIndex < comparisonPeriods.length) {
                    return comparisonPeriods[periodIndex];
                }
                return null;
                
            default:
                return null;
        }
    }
    
    // ===== ФОРМАТИРОВАНИЕ ПЕРИОДА ДЛЯ ОТОБРАЖЕНИЯ =====
    function formatPeriodForDisplay(period) {
        // Проверяем, является ли период датой в формате YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
            // Преобразуем в формат DD.MM.YYYY
            const parts = period.split('-');
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        
        return period;
    }
    
    // ===== ОБНОВЛЕНИЕ ЗАГОЛОВКА ТАБЛИЦЫ =====
    function updateTableHeader() {
        if (!elements.tableHeader) return;
        
        // Сначала удаляем классы сортировки
        const headers = elements.tableHeader.querySelectorAll('th');
        headers.forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
        });
        
        // Затем добавляем индикатор сортировки к активному заголовку
        if (state.sortColumn) {
            let targetHeader;
            
            if (state.sortColumn === 'report_period') {
                targetHeader = elements.tableHeader.querySelector('.stk-th-period');
            } else if (state.sortColumn === 'Subject_chat') {
                targetHeader = elements.tableHeader.querySelector('.stk-th-topic');
            } else if (state.sortColumn === 'Quantity') {
                targetHeader = elements.tableHeader.querySelector('.stk-th-count');
            }
            
            if (targetHeader) {
                targetHeader.classList.add(`sorted-${state.sortDirection}`);
            }
        }
        
        // Добавляем или убираем колонки сравнения в заголовке
        const comparisonHeaders = elements.tableHeader.querySelectorAll('.stk-th-comparison');
        
        // Если включено сравнение, но колонок нет
        if (state.comparisonEnabled && comparisonHeaders.length === 0) {
            const row = elements.tableHeader.querySelector('tr');
            if (row) {
                // Количество для сравнения
                const thCompCount = document.createElement('th');
                thCompCount.className = 'stk-th-comparison stk-th-comp-count';
                thCompCount.textContent = 'Кол-во (сравнение)';
                row.appendChild(thCompCount);
                
                // Процент для сравнения
                const thCompPercent = document.createElement('th');
                thCompPercent.className = 'stk-th-comparison stk-th-comp-percent';
                thCompPercent.textContent = 'Доля % (сравнение)';
                row.appendChild(thCompPercent);
                
                // Изменение
                const thChange = document.createElement('th');
                thChange.className = 'stk-th-comparison stk-th-change';
                thChange.textContent = 'Изменение';
                row.appendChild(thChange);
            }
        }
        // Если сравнение выключено, но колонки есть
        else if (!state.comparisonEnabled && comparisonHeaders.length > 0) {
            comparisonHeaders.forEach(header => {
                header.remove();
            });
        }
    }

    // Конфигурация для графиков
        const CHART_CONFIG = {
            colors: {
                primary: [
                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
                    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
                ],
                comparison: [
                    '#FF8E8E', '#6ED4CC', '#67C3D9', '#A8D4C4', '#FFE6B8',
                    '#E4B3E4', '#A9DDD0', '#F9E085', '#C7A3D1', '#97CCE8',
                    '#FAD083', '#95E6B8', '#F4A5A5', '#97CCE8', '#DFC8E7'
                ],
                gradients: {
                    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    warning: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                    info: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            responsive: true
};
    
    // ===== СОЗДАНИЕ ГРАФИКА =====
    function createChart() {
        if (typeof Chart === 'undefined') {
            loadScript('https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js')
                .then(createChart)
                .catch(error => {
                    showNotificationError('Не удалось загрузить библиотеку графиков');
                    console.error('[StatTemKC] Ошибка загрузки Chart.js:', error);
                });
            return;
        }
        
        const chartCanvas = document.getElementById('stk-chart');
        if (!chartCanvas) return;
        
        // Уничтожаем предыдущий график, если он есть
        if (state.chartInstance) {
            state.chartInstance.destroy();
        }
        
        // Настройка canvas для лучшей визуализации
        const ctx = chartCanvas.getContext('2d');
        const devicePixelRatio = window.devicePixelRatio || 1;
        
        // Устанавливаем размеры для лучшего отображения
        const containerWidth = elements.chartContainer ? elements.chartContainer.clientWidth : 800;
        const containerHeight = elements.chartContainer ? elements.chartContainer.clientHeight : 400;
        
        // Настройка размеров с учетом плотности пикселей
        chartCanvas.width = containerWidth * devicePixelRatio;
        chartCanvas.height = containerHeight * devicePixelRatio;
        chartCanvas.style.width = `${containerWidth}px`;
        chartCanvas.style.height = `${containerHeight}px`;
        ctx.scale(devicePixelRatio, devicePixelRatio);
        
        // Подготовка данных для графика
        const chartData = prepareChartData();
        
        // Конфигурация графика с учетом всех требований
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 20,
                    right: 25,
                    bottom: 10,
                    left: 40
                }
            },
            plugins: {
                legend: {
                    display: false // Скрываем встроенную легенду, используем свою
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#333',
                    bodyColor: '#333',
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 4,
                    displayColors: true,
                    callbacks: {
                        // Улучшенная функция подсказок с обработкой исключений
                        label: function(context) {
                            // Получаем метку (название тематики)
                            const label = context.label || '';
                            let value;
                            
                            // Корректно извлекаем значение в зависимости от типа графика
                            if (state.chartType === 'pie' || state.chartType === 'doughnut') {
                                value = context.raw;
                            } else if (state.chartType === 'bar' || state.chartType === 'line') {
                                value = context.parsed.y;
                            } else {
                                value = context.raw;
                            }
                            
                            // Убеждаемся, что значение - число
                            value = isNaN(parseFloat(value)) ? 0 : parseFloat(value);
                            const formattedValue = new Intl.NumberFormat('ru-RU').format(value);
                            
                            // Безопасный расчет процентов
                            let percentText = '';
                            try {
                                // Нормализуем и суммируем все данные для расчета процента
                                const total = context.chart.data.datasets[context.datasetIndex].data.reduce((sum, val) => {
                                    // Преобразуем каждое значение в число или 0
                                    const numVal = (typeof val === 'object' && val !== null) 
                                        ? (val.y || val.v || 0) 
                                        : (isNaN(parseFloat(val)) ? 0 : parseFloat(val));
                                    return sum + numVal;
                                }, 0);
                                
                                // Вычисляем процент только если сумма > 0
                                const percent = (total > 0) ? ((value / total) * 100).toFixed(2).replace('.', ',') : '0,00';
                                percentText = ` (${percent}%)`;
                            } catch (e) {
                                console.warn('[StatTemKC] Ошибка расчета процентов:', e);
                                percentText = '';
                            }
                            
                            return `${label}: ${formattedValue}${percentText}`;
                        }
                    }
                },
                title: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: true, // Показываем ось X
                    grid: {
                        display: true, // Сетка по X
                        color: 'rgba(0, 0, 0, 0.1)',
                        lineWidth: 0.5,
                        drawBorder: true,
                        drawOnChartArea: true,
                        drawTicks: false
                    },
                    ticks: {
                        display: false, // Убираем подписи внизу
                        color: 'rgba(0, 0, 0, 0.6)'
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)',
                        lineWidth: 0.5,
                        drawBorder: true,
                        drawOnChartArea: true,
                        drawTicks: true
                    },
                    ticks: {
                        display: true, // Оставляем числа по Y
                        padding: 10,
                        color: 'rgba(0, 0, 0, 0.6)',
                        font: {
                            size: 11,
                            family: 'Arial'
                        },
                        // Форматирование чисел для удобочитаемости
                        callback: function(value) {
                            return new Intl.NumberFormat('ru-RU', { 
                                notation: 'compact',
                                compactDisplay: 'short' 
                            }).format(value);
                        }
                    }
                }
            }
        };
        
        // Настройки для разных типов графиков
        if (state.chartType === 'pie' || state.chartType === 'doughnut') {
            // Для круговых и кольцевых диаграмм скрываем оси и сетку
            chartOptions.scales.x.display = false;
            chartOptions.scales.y.display = false;
            chartOptions.scales.x.grid.display = false;
            chartOptions.scales.y.grid.display = false;
        } else if (state.chartType === 'line') {
            // Для линейных графиков настраиваем линии и точки
            chartData.datasets.forEach(dataset => {
                dataset.tension = 0.3; // Слегка сглаживаем линии
                dataset.pointRadius = 4; // Размер точек
                dataset.pointHoverRadius = 6; // Размер точек при наведении
                dataset.fill = false; // Не заполнять область под линией
            });
        } else if (state.chartType === 'bar') {
            // Для столбчатых диаграмм настраиваем столбцы
            chartOptions.datasets = {
                bar: {
                    borderWidth: 1,
                    borderRadius: 4,
                    maxBarThickness: 50
                }
            };
        }
        
        // Создаем новый экземпляр графика
        state.chartInstance = new Chart(ctx, {
            type: state.chartType,
            data: chartData,
            options: chartOptions
        });
        
        // Обновляем легенду графика
        updateChartLegend(chartData);
        
        console.log(`[StatTemKC] График типа '${state.chartType}' успешно создан`);
    }
    
    // ===== ПОДГОТОВКА ДАННЫХ ДЛЯ ГРАФИКА =====
    function prepareChartData() {
        // Объединяем данные по всем периодам
        let combinedData = {};
        let combinedComparisonData = {};
        
        // Обработка основных данных
        Object.keys(state.processedData).forEach(period => {
            Object.keys(state.processedData[period]).forEach(subject => {
                if (!combinedData[subject]) {
                    combinedData[subject] = 0;
                }
                combinedData[subject] += state.processedData[period][subject];
            });
        });
        
        // Обработка данных сравнения, если включено
        if (state.comparisonEnabled && state.processedComparisonData) {
            Object.keys(state.processedComparisonData).forEach(period => {
                Object.keys(state.processedComparisonData[period]).forEach(subject => {
                    if (!combinedComparisonData[subject]) {
                        combinedComparisonData[subject] = 0;
                    }
                    combinedComparisonData[subject] += state.processedComparisonData[period][subject];
                });
            });
        }
        
        // Преобразуем в массивы для графика
        let labels = Object.keys(combinedData);
        let data = Object.values(combinedData);
        let comparisonData = [];
        
        // Добавляем данные для сравнения, если включено
        if (state.comparisonEnabled && Object.keys(combinedComparisonData).length > 0) {
            comparisonData = labels.map(subject => combinedComparisonData[subject] || 0);
        }
        
        // Применение фильтра Top N
        if (state.topFilter && state.topFilter !== 'all' && labels.length > 3) {
            const match = state.topFilter.match(/\d+/);
            if (match) {
                const topN = parseInt(match[0]);
                
                if (!isNaN(topN) && topN > 0) {
                    // Сортировка данных по значению (от большего к меньшему)
                    const sortedItems = labels.map((label, index) => ({
                        label,
                        value: data[index],
                        comparisonValue: state.comparisonEnabled ? comparisonData[index] : 0
                    })).sort((a, b) => b.value - a.value);
                    
                    // Выбираем только топовые элементы, БЕЗ категории "Прочие"
                    const topItems = sortedItems.slice(0, topN);
                    
                    // Обновляем массивы только с топовыми элементами
                    labels = topItems.map(item => item.label);
                    data = topItems.map(item => item.value);
                    
                    if (state.comparisonEnabled) {
                        comparisonData = topItems.map(item => item.comparisonValue);
                    }
                }
            }
        }
        
        // Генерируем цвета с улучшенной контрастностью
        const colors = generateChartColors(labels.length);
        const comparisonColors = colors.map(color => adjustColor(color, -20)); // Темнее для сравнения
        
        // Формируем наборы данных
        const datasets = [{
            label: 'Текущий период',
            data,
            backgroundColor: colors,
            borderColor: colors.map(color => adjustColor(color, -10)),
            borderWidth: 1,
            hoverOffset: 5 // Выделение сегмента при наведении
        }];
        
        // Добавляем данные сравнения, если включено и есть данные
        if (state.comparisonEnabled && comparisonData.length > 0) {
            // Для круговых/кольцевых диаграмм создаем полукруги
            if (state.chartType === 'pie' || state.chartType === 'doughnut') {
                datasets[0].circumference = 180; // полукруг
                datasets[0].rotation = 270; // верхняя половина
                
                datasets.push({
                    label: 'Период сравнения',
                    data: comparisonData,
                    backgroundColor: comparisonColors,
                    borderColor: comparisonColors.map(color => adjustColor(color, -10)),
                    borderWidth: 1,
                    circumference: 180, // полукруг
                    rotation: 90, // нижняя половина
                    hoverOffset: 5
                });
            }
            // Для столбчатых/линейных диаграмм добавляем второй набор
            else {
                datasets.push({
                    label: 'Период сравнения',
                    data: comparisonData,
                    backgroundColor: comparisonColors,
                    borderColor: comparisonColors.map(color => adjustColor(color, -10)),
                    borderWidth: 1
                });
            }
        }
        
        return {
            labels,
            datasets
        };
    }
    
    // ===== ОБНОВЛЕНИЕ ЛЕГЕНДЫ ГРАФИКА =====
    function updateChartLegend(chartData) {
        if (!elements.chartLegend) return;
        
        // Очищаем легенду
        elements.chartLegend.innerHTML = '';
        
        const itemCount = chartData.labels ? chartData.labels.length : 0;
        
        // Добавляем класс при большом количестве элементов
        if (itemCount > 15) {
            elements.chartLegend.classList.add('stk-many-items');
        } else {
            elements.chartLegend.classList.remove('stk-many-items');
        }
        
        // Вычисляем общую сумму для процентов
        let totalValue = 0;
        
        if (chartData.datasets && chartData.datasets[0]) {
            totalValue = chartData.datasets[0].data.reduce((sum, val) => sum + (Number(val) || 0), 0);
        }
        
        // Создаем заголовок с кнопкой сворачивания/разворачивания
        const legendHeader = document.createElement('div');
        legendHeader.className = 'stk-legend-header';
        
        const titleElement = document.createElement('span');
        titleElement.className = 'stk-legend-title';
        titleElement.textContent = 'Легенда';
        
        const infoElement = document.createElement('span');
        infoElement.className = 'stk-legend-info';
        infoElement.textContent = `${itemCount} элементов`;
        
        const collapseBtn = document.createElement('span');
        collapseBtn.className = 'stk-legend-collapse-btn';
        collapseBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        collapseBtn.title = 'Свернуть/развернуть легенду';
        collapseBtn.onclick = function() {
            elements.chartLegend.classList.toggle('collapsed');
            this.innerHTML = elements.chartLegend.classList.contains('collapsed') ? 
                '<i class="fas fa-chevron-down"></i>' : 
                '<i class="fas fa-chevron-up"></i>';
        };
        
        legendHeader.appendChild(titleElement);
        legendHeader.appendChild(infoElement);
        legendHeader.appendChild(collapseBtn);
        elements.chartLegend.appendChild(legendHeader);
        
        // Контейнер для элементов легенды
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'stk-legend-items-container';
        elements.chartLegend.appendChild(itemsContainer);
        
        // Функция для компактного форматирования чисел
        const formatNumber = (num) => {
            if (!num && num !== 0) return '-';
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num;
        };
        
        // Создаем элементы легенды с анимацией задержки
        if (chartData.labels && chartData.datasets && chartData.datasets[0]) {
            chartData.labels.forEach((label, index) => {
                // Установка задержки анимации для плавного появления
                const delay = Math.min(index * 10, 300); // Максимум 300мс задержки
                
                // Значение и процент для основных данных
                const value = chartData.datasets[0].data[index] || 0;
                const percent = totalValue > 0 ? ((value / totalValue) * 100) : 0;
                
                // Определяем, нужно ли отображать процент для очень малых значений
                const percentDisplay = percent < 0.1 ? '<0.1%' : percent.toFixed(1) + '%';
                
                                // Создаем элемент легенды
                const item = document.createElement('div');
                item.className = 'stk-legend-item';
                item.dataset.index = index;
                item.style.animationDelay = `${delay}ms`;
                
                // Цветовой маркер
                const color = document.createElement('span');
                color.className = 'stk-legend-color';
                color.style.backgroundColor = chartData.datasets[0].backgroundColor[index] || '#ccc';
                
                // Текст с полным названием в подсказке
                const text = document.createElement('span');
                text.className = 'stk-legend-text';
                text.title = label; // Полный текст в тултипе
                text.textContent = label;
                
                // Значение и процент
                const valueElement = document.createElement('span');
                valueElement.className = 'stk-legend-value';
                valueElement.innerHTML = `${formatNumber(value)} <small>${percentDisplay}</small>`;
                
                // Собираем элемент легенды
                item.appendChild(color);
                item.appendChild(text);
                item.appendChild(valueElement);
                
                // Добавляем сравнительные данные, если они есть
                if (chartData.datasets.length > 1 && state.comparisonEnabled) {
                    const comparisonValue = chartData.datasets[1].data[index] || 0;
                    
                    if (comparisonValue > 0) {
                        const compValueElement = document.createElement('span');
                        compValueElement.className = 'stk-legend-comparison-value';
                        compValueElement.textContent = formatNumber(comparisonValue);
                        
                        // Расчет изменения в процентах
                        if (comparisonValue > 0) {
                            const change = ((value - comparisonValue) / comparisonValue) * 100;
                            const changeElement = document.createElement('span');
                            changeElement.className = 'stk-legend-change';
                            
                            const changeClass = change > 0 ? 'positive-change' : 
                                              (change < 0 ? 'negative-change' : '');
                                              
                            const changeIcon = change > 0 ? '↑' : (change < 0 ? '↓' : '');
                            
                            changeElement.innerHTML = 
                                `<span class="${changeClass}">${Math.abs(change).toFixed(1)}% ${changeIcon}</span>`;
                                
                            item.appendChild(changeElement);
                        }
                    }
                }
                
                // Обработчик клика для переключения видимости элемента
                item.addEventListener('click', () => {
                    toggleChartDataset(index);
                });
                
                // Добавляем элемент в контейнер
                itemsContainer.appendChild(item);
            });
        }
        
        // Итоговая информация
        if (totalValue > 0) {
            const totalContainer = document.createElement('div');
            totalContainer.className = 'stk-legend-total';
            
            const totalText = document.createElement('span');
            totalText.className = 'stk-legend-total-text';
            totalText.textContent = 'Всего: ';
            
            const totalValueElement = document.createElement('span');
            totalValueElement.className = 'stk-legend-total-value';
            totalValueElement.textContent = formatNumber(totalValue);
            
            totalContainer.appendChild(totalText);
            totalContainer.appendChild(totalValueElement);
            
            // Добавляем итоговое значение для сравнения, если оно есть
            if (state.comparisonEnabled && chartData.datasets && chartData.datasets.length > 1) {
                const compTotalValue = chartData.datasets[1].data.reduce(
                    (sum, val) => sum + (Number(val) || 0), 0
                );
                
                if (compTotalValue > 0) {
                    const compTotalElement = document.createElement('span');
                    compTotalElement.className = 'stk-legend-total-comparison';
                    compTotalElement.textContent = `Сравнение: ${formatNumber(compTotalValue)}`;
                    
                    totalContainer.appendChild(compTotalElement);
                }
            }
            
            elements.chartLegend.appendChild(totalContainer);
        }
    }
    
    // ===== ПЕРЕКЛЮЧЕНИЕ ВИДИМОСТИ ЭЛЕМЕНТА ГРАФИКА =====
    function toggleChartDataset(index) {
        if (!state.chartInstance) return;
        
        // Переключаем видимость во всех наборах данных
        state.chartInstance.data.datasets.forEach(dataset => {
            const meta = state.chartInstance.getDatasetMeta(
                state.chartInstance.data.datasets.indexOf(dataset)
            );
            
            if (meta && meta.data && meta.data[index]) {
                meta.data[index].hidden = !meta.data[index].hidden;
            }
        });
        
        // Обновляем стиль элемента легенды
        const legendItem = document.querySelector(`.stk-legend-item[data-index="${index}"]`);
        if (legendItem) {
            const isHidden = state.chartInstance.getDatasetMeta(0).data[index].hidden;
            legendItem.classList.toggle('inactive', isHidden);
        }
        
        // Обновляем график
        state.chartInstance.update();
    }
    
    // ===== ГЕНЕРАЦИЯ ЦВЕТОВ ДЛЯ ГРАФИКА =====
    function generateChartColors(count) {
        // Если базовых цветов достаточно
        if (count <= CONFIG.CHART_COLORS.length) {
            return CONFIG.CHART_COLORS.slice(0, count);
        }
        
        // Иначе генерируем дополнительные цвета с помощью золотого сечения
        const colors = [...CONFIG.CHART_COLORS];
        
        for (let i = CONFIG.CHART_COLORS.length; i < count; i++) {
            const hue = (i * 137.5) % 360; // Золотое сечение для распределения цветов
            const saturation = 65 + Math.sin(i) * 10; // Вариация насыщенности
            const lightness = 55 + Math.cos(i) * 5; // Вариация яркости
            colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        }
        
        return colors;
    }
    
    // ===== ИЗМЕНЕНИЕ ЯРКОСТИ ЦВЕТА =====
    function adjustColor(color, percent) {
        if (typeof color !== 'string') return color;
        
        if (color.startsWith('#')) {
            // Для HEX формата
            const hex = color.substring(1);
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            
            // Изменяем яркость
            const adjustR = Math.max(0, Math.min(255, Math.round(r * (1 + percent / 100))));
            const adjustG = Math.max(0, Math.min(255, Math.round(g * (1 + percent / 100))));
            const adjustB = Math.max(0, Math.min(255, Math.round(b * (1 + percent / 100))));
            
            return `#${adjustR.toString(16).padStart(2, '0')}${adjustG.toString(16).padStart(2, '0')}${adjustB.toString(16).padStart(2, '0')}`;
        } else if (color.startsWith('rgb')) {
            // Для RGB формата
            const rgb = color.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const r = parseInt(rgb[0]);
                const g = parseInt(rgb[1]);
                const b = parseInt(rgb[2]);
                
                const adjustR = Math.max(0, Math.min(255, Math.round(r * (1 + percent / 100))));
                const adjustG = Math.max(0, Math.min(255, Math.round(g * (1 + percent / 100))));
                const adjustB = Math.max(0, Math.min(255, Math.round(b * (1 + percent / 100))));
                
                return `rgb(${adjustR}, ${adjustG}, ${adjustB})`;
            }
        } else if (color.startsWith('hsl')) {
            // Для HSL формата - меняем только яркость (L)
            const hsl = color.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/i);
            if (hsl && hsl.length >= 4) {
                const h = parseInt(hsl[1]);
                const s = parseInt(hsl[2]);
                const l = parseInt(hsl[3]);
                
                const adjustL = Math.max(0, Math.min(100, l + percent / 2));
                
                return `hsl(${h}, ${s}%, ${adjustL}%)`;
            }
        }
        
        return color; // Возвращаем исходный цвет, если формат не распознан
    }
    
    // ===== ЭКСПОРТ В EXCEL =====
    async function exportToExcel() {
        if (state.rawData.length === 0) {
            showNotificationWarning('Нет данных для экспорта');
            return;
        }
        
        // Обновляем информацию о пользователе и времени
        await updateUserAndTimeInfo();
        
        // Проверяем наличие библиотеки XLSX
        if (typeof XLSX === 'undefined') {
            showNotificationInfo('Подготовка к экспорту...');
            
            try {
                await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
                exportToExcel();
            } catch (error) {
                showNotificationError('Не удалось загрузить модуль экспорта');
            }
                
            return;
        }
        
        try {
            state.isExporting = true;
            
            // Показываем индикатор загрузки
            setLoading(true);
            
            // 1. Создаем новую рабочую книгу
            const workbook = XLSX.utils.book_new();
            
            // 2. Создаем рабочий лист (начинаем сразу с данных, без шапки)
            const tableData = [];
            
            // Добавляем ЗАГОЛОВКИ СТОЛБЦОВ
            const headers = ['Период', 'Тематика', 'Количество', 'Доля %'];
            
            // Если включено сравнение, добавляем столбцы для сравнения
            if (state.comparisonEnabled && state.comparisonData.length > 0) {
                headers.push('Количество (сравнение)', 'Доля % (сравнение)', 'Изменение');
            }
            
            tableData.push(headers);
            
            // Добавляем ДАННЫЕ
            Object.keys(state.processedData).forEach(period => {
                Object.keys(state.processedData[period]).forEach(subject => {
                    const quantity = state.processedData[period][subject];
                    const totalForPeriod = state.periodTotals[period] || 0;
                    
                    // Рассчитываем процент от общего количества в периоде
                    const percent = totalForPeriod > 0 ? 
                        (quantity / totalForPeriod * 100).toFixed(2) + '%' : '0.00%';
                    
                    // Преобразуем период в формат ДД.ММ.ГГГГ для отображения
                    const formattedPeriod = formatPeriodForDisplay(period);
                    
                    const row = [
                        formattedPeriod,
                        subject,
                        quantity,
                        percent
                    ];
                    
                    // Если включено сравнение, добавляем столбцы для сравнения
                    if (state.comparisonEnabled && state.comparisonData.length > 0) {
                        // Находим соответствующий период сравнения
                        const comparisonPeriod = findMatchingComparisonPeriod(period);
                        
                        if (comparisonPeriod && 
                            state.processedComparisonData[comparisonPeriod] && 
                            state.processedComparisonData[comparisonPeriod][subject] !== undefined) {
                            
                            const comparisonQuantity = state.processedComparisonData[comparisonPeriod][subject];
                            const totalForComparisonPeriod = state.comparisonPeriodTotals[comparisonPeriod] || 0;
                            
                            const comparisonPercent = totalForComparisonPeriod > 0 ? 
                                (comparisonQuantity / totalForComparisonPeriod * 100).toFixed(2) + '%' : '0.00%';
                            
                            // Рассчитываем изменение
                            let change = '';
                            if (comparisonQuantity > 0) {
                                change = ((quantity - comparisonQuantity) / comparisonQuantity * 100).toFixed(2) + '%';
                            } else {
                                change = '-';
                            }
                            
                            row.push(comparisonQuantity, comparisonPercent, change);
                        } else {
                            row.push('', '', '');
                        }
                    }
                    
                    tableData.push(row);
                });
            });
            
            // Применяем фильтр Top N, если выбран
            let finalTableData = [...tableData];
            if (state.topFilter && state.topFilter !== 'all' && tableData.length > 2) {
                // Извлекаем цифру из Top N (например, "top10" -> 10)
                const match = state.topFilter.match(/\d+/);
                if (match) {
                    const topN = parseInt(match[0]);
                    if (!isNaN(topN) && topN > 0) {
                        const periodsData = {};
                        const header = tableData[0]; // Заголовки столбцов
                        
                        // Группируем данные по периодам (пропускаем заголовки)
                        tableData.slice(1).forEach(row => {
                            if (!periodsData[row[0]]) { // row[0] - период
                                periodsData[row[0]] = [];
                            }
                            periodsData[row[0]].push(row);
                        });
                        
                        // Для каждого периода отбираем топ N записей
                        finalTableData = [header]; // Начинаем с заголовков
                        Object.keys(periodsData).forEach(period => {
                            const periodRows = periodsData[period];
                            // Сортируем записи по количеству (индекс 2)
                            periodRows.sort((a, b) => b[2] - a[2]);
                            // Отбираем только топ N
                            finalTableData.push(...periodRows.slice(0, topN));
                        });
                    }
                }
            }
            
            // Создаем лист с данными - сразу с первой строки
            const worksheet = XLSX.utils.aoa_to_sheet(finalTableData);
            
            // Стилизуем только заголовки столбцов таблицы
            try {
                // Стиль для заголовка таблицы (первая строка)
                for (let i = 0; i < finalTableData[0].length; i++) {
                    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i }); // Первая строка (индекс 0)
                    if (!worksheet[cellRef]) worksheet[cellRef] = {};
                    
                    worksheet[cellRef].s = {
                        font: { bold: true },
                        fill: { fgColor: { rgb: "E6F0D8" } }, // Светло-зеленый
                        alignment: { horizontal: "center", vertical: "center" }
                    };
                }
            } catch (styleError) {
                console.warn('[StatTemKC] Ошибка при применении стилей:', styleError);
            }
            
            // Добавляем лист в книгу
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Статистика');
            
            // Формируем имя файла с датой и временем
            const dateStr = formatDateTimeForFile(new Date());
            const typeStr = state.dataType === 'calls' ? 'звонки' : 'чаты';
            const fileName = `Статистика_тематик_КЦ_${typeStr}_${dateStr}.xlsx`;
            
            // Экспортируем файл с небольшой задержкой
            setTimeout(() => {
                XLSX.writeFile(workbook, fileName);
                setLoading(false);
                state.isExporting = false;
                showNotificationSuccess('Данные успешно экспортированы в Excel');
            }, 500);
            
        } catch (error) {
            console.error('[StatTemKC] Ошибка при экспорте в Excel:', error);
            setLoading(false);
            state.isExporting = false;
            showNotificationError(`Ошибка при экспорте: ${error.message}`);
        }
    }
    
    // ===== СКАЧИВАНИЕ ГРАФИКА =====
    async function downloadChart() {
        if (!state.chartInstance) {
            showNotificationWarning('Нет графика для скачивания');
            return;
        }
        
        // Обновляем информацию о пользователе и времени
        await updateUserAndTimeInfo();
        
        try {
            const canvas = state.chartInstance.canvas;
            if (!canvas) {
                throw new Error('Холст графика не найден');
            }
            
            // Показываем индикатор загрузки
            setLoading(true);
            
            // Создаем временный холст с повышенным качеством для экспорта
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            // Используем значительно больший масштаб для высокого качества
            const scale = CONFIG.EXPORT_SCALE_FACTOR || 4;
            tempCanvas.width = canvas.width * scale;
            tempCanvas.height = canvas.height * scale;
            
            // Заполняем белым фоном
            tempCtx.fillStyle = 'white';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Масштабируем контекст
            tempCtx.scale(scale, scale);
            
            // Включаем сглаживание для лучшего качества
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';
            
            // Копируем исходный график
            tempCtx.drawImage(canvas, 0, 0);
            
            // Добавляем водяной знак с информацией
            const currentDateTime = getCurrentDateTime();
            const currentUser = getCurrentUsername();
            
            tempCtx.font = '11px Arial';
            tempCtx.fillStyle = 'rgba(0,0,0,0.5)';
            tempCtx.textAlign = 'left';
            tempCtx.fillText(`Статистика тематик КЦ • ${state.dataType === 'calls' ? 'Звонки' : 'Чаты'} • ${getPeriodDescription()} • ${currentDateTime}`, 10, canvas.height - 20);
            
            tempCtx.textAlign = 'right';
            tempCtx.fillText(`${currentUser} • ${CONFIG.CURRENT_DATE_TIME_MSK || ''}`, canvas.width - 10, canvas.height - 20);
            
            // Формируем имя файла
            const dateStr = formatDateTimeForFile(new Date());
            const typeStr = state.dataType === 'calls' ? 'звонки' : 'чаты';
            const fileName = `График_тематик_КЦ_${typeStr}_${dateStr}.png`;
            
            // Экспортируем с небольшой задержкой для корректной отрисовки
            setTimeout(() => {
                // Максимальное качество PNG
                const imageURL = tempCanvas.toDataURL('image/png', 1.0);
                
                const link = document.createElement('a');
                link.href = imageURL;
                link.download = fileName;
                link.click();
                
                setLoading(false);
                showNotificationSuccess('График успешно сохранен в высоком качестве');
            }, 300);
            
        } catch (error) {
            console.error('[StatTemKC] Ошибка при скачивании графика:', error);
            setLoading(false);
            showNotificationError(`Ошибка при скачивании графика: ${error.message}`);
        }
    }
    
    // ===== ОЧИСТКА ФИЛЬТРОВ =====
    function clearFilters() {
        // Сбрасываем период на текущий месяц и год
        const today = new Date();
        
        // Сбрасываем состояние
        state.selectedYear = today.getFullYear();
        state.selectedMonth = today.getMonth() + 1;
        
        state.dayStartDate = new Date(today.setDate(today.getDate() - 7)); // неделю назад
        state.dayEndDate = new Date();
        
        state.hourDate = new Date();
        state.hourStartHour = 0;
        state.hourEndHour = 23;
        
        state.customStartDate = new Date(new Date().setMonth(new Date().getMonth() - 1)); // месяц назад
        state.customEndDate = new Date();
        
        state.rawData = [];
        state.comparisonData = [];
        state.processedData = {};
        state.processedComparisonData = {};
        state.periodTotals = {};
        state.comparisonPeriodTotals = {};
        state.sortColumn = 'Quantity'; // Сохраняем дефолтную сортировку по количеству
        state.sortDirection = 'desc'; // По убыванию
        state.comparisonEnabled = false;
        
        // Сбрасываем селекторы
        resetSelectors();
        
        // Показываем пустое состояние
        showEmptyState();
        
        // Обновляем UI
        updateUI();
        
        // Показываем уведомление
        showNotificationInfo('Фильтры успешно очищены');
    }
    
    // ===== СБРОС СЕЛЕКТОРОВ =====
    function resetSelectors() {
        // Сбрасываем селектор года
        const yearSelect = document.getElementById('stk-year-select');
        if (yearSelect) {
            yearSelect.value = state.selectedYear;
            
            // Обновляем доступность месяцев
            const monthSelect = document.getElementById('stk-month-select');
            if (monthSelect) {
                updateMonthSelectOptions(monthSelect, state.selectedYear);
            }
        }
        
        // Обновляем выбранные даты в календарях
        try {
            // Обновляем календарь дней
            if (state.datepickers.dayStart) {
                state.datepickers.dayStart.setDate(state.dayStartDate);
            }
            
            if (state.datepickers.dayEnd) {
                state.datepickers.dayEnd.setDate(state.dayEndDate);
            }
            
            // Обновляем календарь часов
            if (state.datepickers.hourDate) {
                state.datepickers.hourDate.setDate(state.hourDate);
            }
            
            // Обновляем календарь произвольного периода
            if (state.datepickers.customStart) {
                state.datepickers.customStart.setDate(state.customStartDate);
            }
            
            if (state.datepickers.customEnd) {
                state.datepickers.customEnd.setDate(state.customEndDate);
            }
            
            // Сбрасываем часовые селекторы
            const hourStartSelect = document.getElementById('stk-hour-start-select');
            if (hourStartSelect) {
                hourStartSelect.value = 0;
            }
            
            const hourEndSelect = document.getElementById('stk-hour-end-select');
            if (hourEndSelect) {
                hourEndSelect.value = 23;
            }
        } catch (e) {
            console.warn('[StatTemKC] Ошибка при сбросе календарей:', e);
        }
        
        // Сбрасываем фильтр топ N на "все"
        state.topFilter = 'all';
        if (elements.topButtons) {
            elements.topButtons.forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-top') === 'all');
            });
        }
        
        // Сбрасываем сравнение
        const comparisonToggles = document.querySelectorAll('.stk-comparison-toggle');
        const comparisonContainers = document.querySelectorAll('.stk-comparison-container');
        
        comparisonToggles.forEach(toggle => {
            toggle.classList.remove('active');
            toggle.innerHTML = '<i class="fas fa-chart-line"></i> Включить сравнение';
        });
        
        comparisonContainers.forEach(container => {
            container.classList.remove('active');
        });
    }
    
    // ===== ПЕРЕКЛЮЧЕНИЕ ПОЛНОЭКРАННОГО РЕЖИМА =====
    function toggleFullscreen() {
        if (!elements.dataBlock) return;
        
        if (!document.fullscreenElement) {
            // Входим в полноэкранный режим
            if (elements.dataBlock.requestFullscreen) {
                elements.dataBlock.requestFullscreen();
            } else if (elements.dataBlock.mozRequestFullScreen) {
                elements.dataBlock.mozRequestFullScreen();
            } else if (elements.dataBlock.webkitRequestFullscreen) {
                elements.dataBlock.webkitRequestFullscreen();
            } else if (elements.dataBlock.msRequestFullscreen) {
                elements.dataBlock.msRequestFullscreen();
            }
            
            // Обновляем кнопку
            if (elements.fullscreenBtn) {
                elements.fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
                elements.fullscreenBtn.title = 'Выйти из полноэкранного режима';
            }
        } else {
            // Выходим из полноэкранного режима
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            
            // Обновляем кнопку
            if (elements.fullscreenBtn) {
                elements.fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
                elements.fullscreenBtn.title = 'Полноэкранный режим';
            }
        }
    }
    
    // ===== ФУНКЦИИ ДЛЯ ПОЛУЧЕНИЯ ПОЛЬЗОВАТЕЛЯ И ВРЕМЕНИ =====
    // Получение текущего пользователя
    function getCurrentUsername() {
        // Используем значения, полученные от API или резервные варианты
        return CONFIG.CURRENT_USER || 'Temioka';
    }
    
    // Получение текущего МСК времени
    function getCurrentDateTime() {
        // Используем значения, полученные от API или генерируем на лету
        return CONFIG.CURRENT_DATE_TIME_MSK || 
               convertToMoscowtime(new Date().toISOString());
    }
    
    // ===== УВЕДОМЛЕНИЯ =====
    // Используем существующую систему уведомлений на сайте
    function showNotificationSuccess(message) {
        if (window.createNotification) {
            const notification = window.createNotification(message, 'success');
            if (window.pushNotification) {
                window.pushNotification(notification);
            }
        } else {
            console.log(`[StatTemKC] Успех: ${message}`);
        }
    }
    
    function showNotificationError(message) {
        if (window.createNotification) {
            const notification = window.createNotification(message, 'error');
            if (window.pushNotification) {
                window.pushNotification(notification);
            }
        } else {
            console.error(`[StatTemKC] Ошибка: ${message}`);
        }
    }
    
    function showNotificationWarning(message) {
        if (window.createNotification) {
            const notification = window.createNotification(message, 'warning');
            if (window.pushNotification) {
                window.pushNotification(notification);
            }
        } else {
            console.warn(`[StatTemKC] Предупреждение: ${message}`);
        }
    }
    
    function showNotificationInfo(message) {
        if (window.createNotification) {
            const notification = window.createNotification(message, 'info');
            if (window.pushNotification) {
                window.pushNotification(notification);
            }
        } else {
            console.info(`[StatTemKC] Информация: ${message}`);
        }
    }
    
    // Показ системных уведомлений из предопределенных типов
    function showSystemNotification(notificationType) {
        if (window.PREDEFINED_NOTIFICATIONS && window.PREDEFINED_NOTIFICATIONS[notificationType] && window.pushNotification) {
            window.pushNotification(window.PREDEFINED_NOTIFICATIONS[notificationType]);
        } else {
            console.log(`[StatTemKC] Системное уведомление: ${notificationType}`);
        }
    }
    
    // ===== ФОРМАТИРОВАНИЕ ДАТЫ =====
    function formatDate(date) {
        if (!date || !(date instanceof Date) || isNaN(date)) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }
    
    // ===== ФОРМАТИРОВАНИЕ ДАТЫ И ВРЕМЕНИ ДЛЯ ИМЕНИ ФАЙЛА =====
    function formatDateTimeForFile(date) {
        if (!date || !(date instanceof Date) || isNaN(date)) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    }
    
    // ===== ФОРМАТИРОВАНИЕ ДАТЫ ДЛЯ ОТОБРАЖЕНИЯ =====
    function formatDisplayDate(date) {
        if (!date || !(date instanceof Date) || isNaN(date)) return '';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}.${month}.${year}`;
    }
    
    // ===== ПОЛУЧЕНИЕ ОПИСАНИЯ ПЕРИОДА =====
    function getPeriodDescription() {
        switch (state.periodType) {
            case 'month':
                return `${CONFIG.MONTH_NAMES[state.selectedMonth - 1]} ${state.selectedYear}`;
            case 'day':
                return state.dayStartDate && state.dayEndDate ? 
                    `с ${formatDisplayDate(state.dayStartDate)} по ${formatDisplayDate(state.dayEndDate)}` :
                    'Не указан';
            case 'hour':
                return state.hourDate ? 
                    `${formatDisplayDate(state.hourDate)} с ${String(state.hourStartHour).padStart(2, '0')}:00 по ${String(state.hourEndHour).padStart(2, '0')}:00` :
                    'Не указан';
            case 'custom':
                return state.customStartDate && state.customEndDate ? 
                    `с ${formatDisplayDate(state.customStartDate)} по ${formatDisplayDate(state.customEndDate)}` :
                    'Не указан';
            default:
                return 'Не указан';
        }
    }
    
    // ===== ЭКСПОРТ ОТЛАДОЧНЫХ ФУНКЦИЙ =====
    window.stkDebug = {
        getState: () => ({ ...state }),
        getElements: () => ({ ...elements }),
        loadData: loadData,
        exportToExcel: exportToExcel,
        downloadChart: downloadChart,
        clearFilters: clearFilters,
        reloadDatepickers: setupDatepickers,
        updateUserInfo: updateUserAndTimeInfo,
        createChart: createChart,
        currentDateTimeMSK: getCurrentDateTime,
        currentUser: getCurrentUsername
    };
    
    // ===== ОБРАБОТКА СТИЛЕЙ ДЛЯ ЦЕНТРИРОВАНИЯ ГРАФИКА =====
    function applyChartCenteringStyles() {
        // Создаем стиль для центрирования графика, если его еще нет
        if (!document.getElementById('stk-chart-centering-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'stk-chart-centering-styles';
            styleElement.textContent = `
                .stk-chart-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 400px;
                    width: 100%;
                    position: relative;
                }
                #stk-chart {
                    max-width: 100%;
                    max-height: 100%;
                }
                .stk-chart-wrapper {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 100%;
                    height: 100%;
                }
            `;
            document.head.appendChild(styleElement);
        }
        
        // Добавляем обертку для графика, если ее нет
        if (elements.chartContainer && !document.querySelector('.stk-chart-wrapper')) {
            const chartCanvas = document.getElementById('stk-chart');
            if (chartCanvas) {
                const wrapper = document.createElement('div');
                wrapper.className = 'stk-chart-wrapper';
                
                // Перемещаем canvas в обертку
                chartCanvas.parentElement.insertBefore(wrapper, chartCanvas);
                wrapper.appendChild(chartCanvas);
                
                elements.chartWrapper = wrapper;
            }
        }
    }
    
    // ===== РЕГИСТРАЦИЯ ОБРАБОТЧИКА СОБЫТИЙ ДЛЯ ОЧИСТКИ ПРИ ВЫГРУЗКЕ =====
    function registerCleanupHandlers() {
        // Очищаем обработчики при выгрузке страницы
        window.addEventListener('beforeunload', function() {
            // Удаляем обработчики событий
            if (window._stkResizeHandler) {
                window.removeEventListener('resize', window._stkResizeHandler);
            }
            
            if (window._stkDocumentClickHandler) {
                document.removeEventListener('click', window._stkDocumentClickHandler);
            }
            
            // Остановка интервала обновления данных пользователя
            if (window._stkUserInfoInterval) {
                clearInterval(window._stkUserInfoInterval);
            }
            
            // Уничтожаем график
            if (state.chartInstance) {
                state.chartInstance.destroy();
                state.chartInstance = null;
            }
            
            // Уничтожаем календари
            Object.values(state.datepickers).forEach(picker => {
                if (picker && picker.destroy) {
                    picker.destroy();
                }
            });
        });
    }
    
    // ===== ПРИМЕНЯЕМ СТИЛИ ДЛЯ ЦЕНТРИРОВАНИЯ ГРАФИКА =====
    applyChartCenteringStyles();
    
    // ===== РЕГИСТРИРУЕМ ОБРАБОТЧИКИ ДЛЯ ОЧИСТКИ =====
    registerCleanupHandlers();
    
    // ===== ЗАПУСКАЕМ ИНИЦИАЛИЗАЦИЮ =====
    init();
});