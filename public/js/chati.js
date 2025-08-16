document.addEventListener('DOMContentLoaded', () => {
    // --- Основной модуль обработки омниканального чата ---
    const OmniChatModule = (function() {
        // Приватные переменные
        const constants = {
            CHANNELS: [
                "Мобильное приложение", "WhatsApp", "Telegram",
                "ВКонтакте", "Сайт", "Viber", "OK"
            ],
            MONTHS: [
                "Январь", "Февраль", "Март", "Апрель",
                "Май", "Июнь", "Июль", "Август",
                "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
            ],
            CSS: `
                #omniPeriodTabs {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    width: 100%;
                }
                
                #omniPeriodTabs .period-tab {
                    min-width: 180px;
                    padding: 10px 15px;
                    text-align: center;
                    font-weight: 500;
                    border-radius: 6px;
                    transition: all 0.25s ease;
                    background: #f5f5f5;
                    border: 1px solid #ddd;
                    color: #555;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    flex: 1;
                    white-space: nowrap;
                }
                
                #omniPeriodTabs .period-tab.active {
                    background: #FF5100;
                    color: white;
                    box-shadow: 0 2px 5px rgba(255, 81, 0, 0.3);
                }
                
                #omniPeriodTabs .period-tab i {
                    font-size: 16px;
                }
                
                /* Стили для кнопки + */
                .add-month-btn, .add-year-btn {
                    width: 180px;
                    min-width: 180px;
                    height: 38px;
                    border: 1px dashed #E9E9E9;
                    background: white;
                    color: #929292;
                    cursor: pointer;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    transition: all 0.2s;
                }
                
                .add-month-btn:hover, .add-year-btn:hover {
                    border-color: #aaa;
                    background-color: #f9f9f9;
                }
                
                /* Кнопки действий */
                #omni-submit-btn, #omni-export-btn, #omni-clear-btn {
                    min-width: 180px;
                    padding: 10px 20px;
                    font-size: 15px;
                    font-weight: 500;
                    text-align: center;
                    border-radius: 6px;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    height: auto;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    margin: 0 5px;
                }
                
                #omni-submit-btn {
                    background: linear-gradient(to right, #FF7300, #FF5100);
                    border: none;
                    color: white;
                }
                
                #omni-submit-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(255, 81, 0, 0.3);
                }
                
                #omni-export-btn {
                    background: white;
                    border: 1px solid #ddd;
                    color: #333;
                }
                
                #omni-export-btn:hover {
                    background: #f9f9f9;
                    border-color: #ccc;
                    transform: translateY(-1px);
                }
                
                #omni-clear-btn {
                    background: #f5f5f5;
                    border: 1px solid #ddd;
                    color: #666;
                }
                
                #omni-clear-btn:hover {
                    background: #eeeeee;
                    color: #333;
                }
                
                /* Стили для выбора периодов */
                .date-range-container {
                    padding: 15px;
                    border: 1px solid #eaeaea;
                    border-radius: 8px;
                    margin-top: 15px;
                }
                
                /* Стили для индикатора загрузки */
                .loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(255, 255, 255, 0.8);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                }
                
                .loading-spinner {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #FF5100;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 2s linear infinite;
                    margin-bottom: 10px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                /* Стили для таблиц */
                .total-row {
                    font-weight: bold;
                    background-color: #f9f9f9;
                }
                
                th.sorted-asc::after {
                    content: "↑";
                    margin-left: 5px;
                }
                
                th.sorted-desc::after {
                    content: "↓";
                    margin-left: 5px;
                }
                
                /* Стили для селекторов */
                .filter-input {
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                    margin: 0 5px;
                }
                
                /* Мобильная адаптация */
                @media (max-width: 768px) {
                    #omniPeriodTabs {
                        flex-direction: column;
                    }
                    
                    #omniPeriodTabs .period-tab {
                        min-width: auto;
                    }
                    
                    .add-month-btn, .add-year-btn {
                        width: 100%;
                    }
                    
                    #omni-submit-btn, #omni-export-btn, #omni-clear-btn {
                        width: 100%;
                        margin: 5px 0;
                    }
                }
            `
        };
        
        // Состояния модуля
        let state = {
            periodType: 'month',
            mainSort: { column: null, direction: 'asc' },
            channelsSort: { column: null, direction: 'asc' },
            mainData: [],
            channelsData: [],
            isLoading: false
        };
        
        // DOM-элементы
        let domElements = {
            omniBlock: null,
            omniForm: null,
            periodTypeSelect: null,
            periodTabs: null,
            clearBtn: null,
            submitBtn: null,
            exportBtn: null,
            dateRangeContainer: null,
            mainTable: null,
            mainTableBody: null,
            channelsTable: null,
            channelsTableBody: null,
            filterBox: null
        };

        /**
         * Инициализирует модуль
         */
        function init() {
            console.log('Инициализация модуля омниканального чата');
            
            // Добавляем стили
            addStyles();
            
            // Находим основной блок
            domElements.omniBlock = document.getElementById('omni-block');
            if (!domElements.omniBlock) {
                console.error('omni-block не найден!');
                return;
            }
            
            // Инициализируем форму и основные элементы
            initFilterBox();
            initForm();
            initPeriodSelector();
            initDateRangeContainer();
            initButtons();
            initTables();
            
            // Скрываем переключатель суммарные/детальные данные
            hideDataTypeSwitch();
            
            // Устанавливаем начальное состояние
            updatePeriodTypeState();
            
            console.log('Модуль омниканального чата инициализирован');
        }
        
        /**
         * Добавляет стили для модуля
         */
        function addStyles() {
            const styleEl = document.createElement('style');
            styleEl.textContent = constants.CSS;
            document.head.appendChild(styleEl);
        }
        
        /**
         * Инициализирует блок фильтра
         */
        function initFilterBox() {
            // Находим или создаем контейнер для фильтра
            domElements.filterBox = domElements.omniBlock.querySelector('#omni-filter-box') || 
                                   domElements.omniBlock.querySelector('.report-card');
                                   
            if (domElements.filterBox) {
                domElements.filterBox.id = 'omni-filter-box';
            }
        }
        
        /**
         * Инициализирует форму
         */
        function initForm() {
            // Проверяем наличие формы
            domElements.omniForm = domElements.omniBlock.querySelector('#omniForm');
            
            if (!domElements.omniForm) {
                domElements.omniForm = document.createElement('form');
                domElements.omniForm.id = 'omniForm';
                
                const reportCardBody = domElements.omniBlock.querySelector('.report-card-body');
                if (reportCardBody) {
                    // Сохраняем содержимое для вставки в форму
                    const content = reportCardBody.innerHTML;
                    reportCardBody.innerHTML = '';
                    domElements.omniForm.innerHTML = content;
                    reportCardBody.appendChild(domElements.omniForm);
                }
            }
            
            // Важно: предотвращаем стандартное поведение формы
            domElements.omniForm.addEventListener('submit', function(e) {
                e.preventDefault();
                loadData();
            });
            
            // Добавляем блокировку отправки формы при нажатии Enter в полях
            domElements.omniForm.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    return false;
                }
            });
        }
        
        /**
         * Инициализирует переключатель типа периода
         */
        function initPeriodSelector() {
            // Создаем контейнер для табов с использованием div, а НЕ button/a
            const tabsContainer = document.createElement('div');
            tabsContainer.id = 'omniPeriodTabs';
            tabsContainer.innerHTML = `
                <div class="period-tab active" data-period="month">
                    <i class="far fa-calendar-alt"></i> По месяцам
                </div>
                <div class="period-tab" data-period="year">
                    <i class="far fa-calendar"></i> По годам
                </div>
                <div class="period-tab" data-period="custom">
                    <i class="fas fa-calendar-week"></i> Произвольный период
                </div>
            `;
            
            // Находим место для вставки
            const periodSelector = domElements.omniBlock.querySelector('.period-selector');
            if (periodSelector) {
                const existingTabs = periodSelector.querySelector('.period-tabs');
                if (existingTabs) {
                    existingTabs.replaceWith(tabsContainer);
                } else {
                    periodSelector.insertBefore(tabsContainer, periodSelector.firstChild);
                }
                
                // Сохраняем ссылку на контейнер табов
                domElements.periodTabs = tabsContainer;
            }
            
            // Создаем скрытый select для состояния периода
            domElements.periodTypeSelect = document.createElement('select');
            domElements.periodTypeSelect.id = 'omniPeriodType';
            domElements.periodTypeSelect.style.display = 'none';
            domElements.periodTypeSelect.innerHTML = `
                <option value="month">По месяцам</option>
                <option value="year">По годам</option>
                <option value="custom">Произвольный период</option>
            `;
            domElements.omniForm.appendChild(domElements.periodTypeSelect);
            
            // Используем делегирование событий
            tabsContainer.addEventListener('click', function(e) {
                // Предотвращаем всплытие события
                e.preventDefault();
                e.stopPropagation();
                
                // Находим нажатый таб
                const target = e.target.closest('.period-tab');
                if (!target) return;
                
                const periodType = target.dataset.period;
                if (!periodType) return;
                
                // Обновляем активные табы
                tabsContainer.querySelectorAll('.period-tab').forEach(tab => {
                    tab.classList.toggle('active', tab === target);
                });
                
                // Обновляем значение select и состояние
                domElements.periodTypeSelect.value = periodType;
                state.periodType = periodType;
                
                // Обновляем UI для выбранного типа периода
                // Важно запускать через setTimeout для предотвращения досрочной отправки формы
                setTimeout(() => updatePeriodTypeState(), 0);
            });
        }
        
        /**
         * Инициализирует контейнер для диапазона дат
         */
        function initDateRangeContainer() {
            domElements.dateRangeContainer = domElements.omniBlock.querySelector('.date-range-container');
            
            if (!domElements.dateRangeContainer) {
                domElements.dateRangeContainer = document.createElement('div');
                domElements.dateRangeContainer.className = 'date-range-container';
                
                // Находим место для вставки
                const periodContainer = domElements.omniBlock.querySelector('.period-containers') || 
                                       domElements.omniBlock.querySelector('.omni-period-containers');
                
                if (periodContainer) {
                    periodContainer.appendChild(domElements.dateRangeContainer);
                } else {
                    // Создаем новый контейнер
                    const newPeriodContainer = document.createElement('div');
                    newPeriodContainer.className = 'period-containers';
                    newPeriodContainer.appendChild(domElements.dateRangeContainer);
                    
                    // Вставляем после табов
                    const periodSelector = domElements.omniBlock.querySelector('.period-selector');
                    if (periodSelector) {
                        periodSelector.appendChild(newPeriodContainer);
                    }
                }
            }
        }
        
        /**
         * Инициализирует кнопки действий
         */
        function initButtons() {
            // Находим кнопки
            domElements.submitBtn = domElements.omniBlock.querySelector('#omni-submit-btn');
            domElements.exportBtn = domElements.omniBlock.querySelector('#omni-export-btn');
            domElements.clearBtn = domElements.omniBlock.querySelector('#omni-clear-btn') || 
                                  domElements.omniBlock.querySelector('#omniClearBtn');
            
            // Правильно добавляем обработчики, предотвращая отправку формы
            if (domElements.submitBtn) {
                // Удаляем старые обработчики
                const newSubmitBtn = domElements.submitBtn.cloneNode(true);
                domElements.submitBtn.parentNode.replaceChild(newSubmitBtn, domElements.submitBtn);
                domElements.submitBtn = newSubmitBtn;
                
                // Добавляем новый обработчик
                domElements.submitBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    loadData();
                    return false;
                });
            }
            
            if (domElements.exportBtn) {
                // Удаляем старые обработчики
                const newExportBtn = domElements.exportBtn.cloneNode(true);
                domElements.exportBtn.parentNode.replaceChild(newExportBtn, domElements.exportBtn);
                domElements.exportBtn = newExportBtn;
                
                // Добавляем новый обработчик
                domElements.exportBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    exportData();
                    return false;
                });
            }
            
            if (domElements.clearBtn) {
                // Удаляем старые обработчики
                const newClearBtn = domElements.clearBtn.cloneNode(true);
                domElements.clearBtn.parentNode.replaceChild(newClearBtn, domElements.clearBtn);
                domElements.clearBtn = newClearBtn;
                
                // Добавляем новый обработчик
                domElements.clearBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    clearFilters();
                    return false;
                });
            }
        }
        
        /**
         * Инициализирует таблицы
         */
        function initTables() {
            // Основная таблица
            domElements.mainTable = domElements.omniBlock.querySelector('#omni-table-main');
            if (domElements.mainTable) {
                domElements.mainTableBody = domElements.mainTable.querySelector('tbody');
            }
            
            // Таблица каналов
            domElements.channelsTable = domElements.omniBlock.querySelector('#omni-table-channels');
            if (domElements.channelsTable) {
                domElements.channelsTableBody = domElements.channelsTable.querySelector('tbody');
            }
            
            // Добавляем обработчики сортировки
            setupTableSorting();
        }
        
        /**
         * Настраивает сортировку таблиц
         */
        function setupTableSorting() {
            if (!domElements.mainTable || !domElements.channelsTable) return;
            
            // Поля для основной таблицы
            const mainFieldMap = [
                'report_period',
                'total_chat_requests',
                'total_processed_by_bot',
                'total_processed_by_operator',
                'percent_bot',
                'percent_operator'
            ];
            
            // Добавляем обработчики для основной таблицы
            const mainHeaders = domElements.mainTable.querySelectorAll('th');
            mainHeaders.forEach((th, idx) => {
                if (idx >= mainFieldMap.length) return;
                
                // Удаляем старые обработчики
                const newTh = th.cloneNode(true);
                th.parentNode.replaceChild(newTh, th);
                
                newTh.style.cursor = 'pointer';
                newTh.addEventListener('click', () => {
                    const col = mainFieldMap[idx];
                    
                    if (state.mainSort.column === col) {
                        state.mainSort.direction = state.mainSort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        state.mainSort.column = col;
                        state.mainSort.direction = 'asc';
                    }
                    
                    // Перерисовываем таблицу с сортировкой
                    renderMainTable(state.mainData);
                    updateSortArrows(domElements.mainTable, state.mainSort, mainFieldMap);
                });
            });
            
            // Поля для таблицы каналов
            const channelsFieldMap = ['report_period', ...constants.CHANNELS];
            
            // Добавляем обработчики для таблицы каналов
            const channelsHeaders = domElements.channelsTable.querySelectorAll('th');
            channelsHeaders.forEach((th, idx) => {
                if (idx >= channelsFieldMap.length) return;
                
                // Удаляем старые обработчики
                const newTh = th.cloneNode(true);
                th.parentNode.replaceChild(newTh, th);
                
                newTh.style.cursor = 'pointer';
                newTh.addEventListener('click', () => {
                    const col = channelsFieldMap[idx];
                    
                    if (state.channelsSort.column === col) {
                        state.channelsSort.direction = state.channelsSort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        state.channelsSort.column = col;
                        state.channelsSort.direction = 'asc';
                    }
                    
                    // Перерисовываем таблицу с сортировкой
                    renderChannelsTable(state.channelsData);
                    updateSortArrows(domElements.channelsTable, state.channelsSort, channelsFieldMap);
                });
            });
        }
        
        /**
         * Обновляет стрелки сортировки в таблице
         * @param {HTMLElement} table - Таблица
         * @param {Object} sortState - Состояние сортировки
         * @param {Array} fieldMap - Карта полей
         */
        function updateSortArrows(table, sortState, fieldMap) {
            if (!table) return;
            
            const headers = table.querySelectorAll('th');
            headers.forEach((th, idx) => {
                th.classList.remove('sorted-asc', 'sorted-desc');
                
                if (sortState.column && fieldMap[idx] === sortState.column) {
                    th.classList.add(sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
                }
            });
        }
        
        /**
         * Обновляет интерфейс в зависимости от выбранного типа периода
         * Полностью перестраивает DOM-элементы для выбранного типа периода
         */
        function updatePeriodTypeState() {
            if (!domElements.dateRangeContainer) return;
            
            const periodType = state.periodType;
            
            // Очищаем существующий контент
            domElements.dateRangeContainer.innerHTML = '';
            
            // Обновляем в зависимости от типа
            switch (periodType) {
                case 'month':
                    renderMonthYearFields();
                    setFilterBoxTitle('За месяц');
                    break;
                case 'year':
                    renderYearFields();
                    setFilterBoxTitle('По годам');
                    break;
                case 'custom':
                    renderCustomRangeFields();
                    setFilterBoxTitle('Произвольный период');
                    break;
            }
        }
        
        /**
         * Устанавливает заголовок рамки фильтра
         * @param {string} title - Текст заголовка
         */
        function setFilterBoxTitle(title) {
            if (domElements.filterBox) {
                domElements.filterBox.setAttribute('data-title', title);
            }
        }
        
        /**
         * Рендерит поля для выбора месяца и года
         */
        function renderMonthYearFields() {
            const container = domElements.dateRangeContainer;
            
            // Создаем блок месяцев
            const monthField = document.createElement('div');
            monthField.className = 'date-field';
            
            // Метка "Добавить месяц"
            const addMonthLabel = document.createElement('span');
            addMonthLabel.textContent = 'Добавить месяц:';
            addMonthLabel.style.marginRight = '12px';
            
            // Кнопка "+"
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.textContent = '+';
            addBtn.className = 'add-month-btn';
            
            // Создаем контейнер для месяцев
            const monthsList = document.createElement('div');
            monthsList.id = 'omni-months-list';
            monthsList.style.marginTop = '12px';
            
            // Создаем функцию для добавления месяца
            function createMonthSelect(selectedValue) {
                const wrap = document.createElement('div');
                wrap.style.marginBottom = '8px';
                wrap.style.display = 'flex';
                wrap.style.alignItems = 'center';
                
                // Создаем селект месяца
                const select = document.createElement('select');
                select.className = 'filter-input omni-month-select';
                select.name = 'omni-month-select';
                select.style.minWidth = '200px';
                
                // Заполняем месяцами
                constants.MONTHS.forEach((name, idx) => {
                    const opt = document.createElement('option');
                    opt.value = idx + 1;
                    opt.textContent = name;
                    if (selectedValue !== undefined && selectedValue === idx + 1) {
                        opt.selected = true;
                    }
                    select.appendChild(opt);
                });
                
                // Кнопка удаления
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.textContent = '×';
                delBtn.style.marginLeft = '8px';
                delBtn.style.border = 'none';
                delBtn.style.background = 'transparent';
                delBtn.style.fontSize = '20px';
                delBtn.style.cursor = 'pointer';
                delBtn.setAttribute('aria-label', 'Удалить месяц');
                
                // Обработчик удаления
                delBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    monthsList.removeChild(wrap);
                    updateMonthRange();
                    return false;
                });
                
                // Обработчик изменения
                select.addEventListener('change', updateMonthRange);
                
                // Собираем элементы
                wrap.appendChild(select);
                wrap.appendChild(delBtn);
                
                return wrap;
            }
            
            // Обработчик добавления месяца
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Проверяем, что не выбраны все 12 месяцев
                if (monthsList.childElementCount >= 12) return false;
                
                // Проверяем на уникальность
                const selectedMonths = Array.from(monthsList.querySelectorAll('select')).map(sel => parseInt(sel.value, 10));
                if (selectedMonths.length >= 12) return false;
                
                monthsList.appendChild(createMonthSelect());
                updateMonthRange();
                
                return false;
            });
            
            // Добавляем первый месяц (текущий)
            monthsList.appendChild(createMonthSelect(new Date().getMonth() + 1));
            
            // Собираем блок месяцев
            monthField.appendChild(addMonthLabel);
            monthField.appendChild(addBtn);
            monthField.appendChild(monthsList);
            
            // Блок года
            const yearField = document.createElement('div');
            yearField.className = 'date-field';
            yearField.style.marginLeft = '35px';
            yearField.style.display = 'inline-block';
            yearField.style.verticalAlign = 'top';
            
            const yearLabel = document.createElement('label');
            yearLabel.className = 'date-label';
            yearLabel.htmlFor = 'omni-year-select';
            yearLabel.textContent = 'Год:';
            
            const yearWrap = document.createElement('div');
            yearWrap.className = 'input-wrapper';
            
            const yearSelect = document.createElement('select');
            yearSelect.className = 'filter-input';
            yearSelect.id = 'omni-year-select';
            yearSelect.name = 'omni-year-select';
            
            // Заполняем годами (текущий +2/-5)
            const thisYear = new Date().getFullYear();
            for (let y = thisYear - 5; y <= thisYear + 2; y++) {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                if (y === thisYear) opt.selected = true;
                yearSelect.appendChild(opt);
            }
            
            yearWrap.appendChild(yearSelect);
            yearField.appendChild(yearLabel);
            yearField.appendChild(yearWrap);
            
            // Вставляем блоки в контейнер
            container.appendChild(monthField);
            container.appendChild(yearField);
            
            // Создаем скрытые поля для дат
            createHiddenDateInputs();
            
            // Функция обновления скрытых полей дат
            function updateMonthRange() {
                const year = parseInt(yearSelect.value, 10);
                
                // Собираем выбранные месяцы (уникальные)
                const selectedMonths = Array.from(monthsList.querySelectorAll('select'))
                    .map(sel => parseInt(sel.value, 10))
                    .filter((val, idx, arr) => val && arr.indexOf(val) === idx)
                    .sort((a, b) => a - b);
                
                if (selectedMonths.length === 0) {
                    setHiddenDates('', '');
                    return;
                }
                
                // Вычисляем крайние даты
                const minMonth = Math.min(...selectedMonths);
                const maxMonth = Math.max(...selectedMonths);
                const monthStart = new Date(year, minMonth - 1, 1);
                const monthEnd = new Date(year, maxMonth, 0);
                
                setHiddenDates(
                    monthStart.toISOString().split('T')[0],
                    monthEnd.toISOString().split('T')[0]
                );
            }
            
            // Функция для получения выбранных месяцев
            domElements.omniForm.getSelectedMonths = function() {
                return Array.from(monthsList.querySelectorAll('select'))
                    .map(sel => parseInt(sel.value, 10))
                    .filter((val, idx, arr) => val && arr.indexOf(val) === idx)
                    .sort((a, b) => a - b);
            };
            
            // Добавляем слушатели событий
            yearSelect.addEventListener('change', updateMonthRange);
            
            updateMonthRange();
        }
        
        /**
         * Рендерит поля для выбора года
         */
        function renderYearFields() {
            const container = domElements.dateRangeContainer;
            
            // Создаем блок годов
            const yearField = document.createElement('div');
            yearField.className = 'date-field';
            
            // Метка "Добавить год"
            const addYearLabel = document.createElement('span');
            addYearLabel.textContent = 'Добавить год:';
            addYearLabel.style.marginRight = '12px';
            
            // Кнопка "+"
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.textContent = '+';
            addBtn.className = 'add-year-btn';
            
            // Создаем контейнер для годов
            const yearsList = document.createElement('div');
            yearsList.id = 'omni-years-list';
            yearsList.style.marginTop = '12px';
            
            // Функция для создания селекта года
            function createYearSelect(selectedValue) {
                const wrap = document.createElement('div');
                wrap.style.marginBottom = '8px';
                wrap.style.display = 'flex';
                wrap.style.alignItems = 'center';
                
                // Создаем селект года
                const select = document.createElement('select');
                select.className = 'filter-input omni-year-item-select';
                select.name = 'omni-year-item-select';
                select.style.minWidth = '200px';
                
                // Заполняем годами (текущий и 5 предыдущих)
                const thisYear = new Date().getFullYear();
                for (let y = thisYear; y >= thisYear - 5; y--) {
                    const opt = document.createElement('option');
                    opt.value = y;
                    opt.textContent = y;
                    if (selectedValue !== undefined && selectedValue === y) {
                        opt.selected = true;
                    }
                    select.appendChild(opt);
                }
                
                // Кнопка удаления
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.textContent = '×';
                delBtn.style.marginLeft = '8px';
                delBtn.style.border = 'none';
                delBtn.style.background = 'transparent';
                delBtn.style.fontSize = '20px';
                delBtn.style.cursor = 'pointer';
                delBtn.setAttribute('aria-label', 'Удалить год');
                
                // Обработчик удаления с предотвращением отправки формы
                delBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Проверяем, что это не последний год
                    if (yearsList.querySelectorAll('.filter-input').length > 1) {
                        yearsList.removeChild(wrap);
                        updateYearRange();
                    } else {
                        alert('Должен быть выбран хотя бы один год');
                    }
                    
                    return false;
                });
                
                // Обработчик изменения
                select.addEventListener('change', updateYearRange);
                
                // Собираем элементы
                wrap.appendChild(select);
                wrap.appendChild(delBtn);
                
                return wrap;
            }
            
            // Обработчик добавления года с предотвращением отправки формы
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                yearsList.appendChild(createYearSelect());
                updateYearRange();
                
                return false;
            });
            
            // Добавляем первый год (текущий)
            yearsList.appendChild(createYearSelect(new Date().getFullYear()));
            
            // Собираем блок годов
            yearField.appendChild(addYearLabel);
            yearField.appendChild(addBtn);
            yearField.appendChild(yearsList);
            
            // Вставляем блок в контейнер
            container.appendChild(yearField);
            
            // Создаем скрытые поля для дат и годов
            createHiddenDateInputs();
            
            let yearsInput = domElements.omniForm.querySelector('#omni-years');
            if (!yearsInput) {
                yearsInput = document.createElement('input');
                yearsInput.type = 'hidden';
                yearsInput.id = 'omni-years';
                yearsInput.name = 'omni-years';
                domElements.omniForm.appendChild(yearsInput);
            }
            
            // Функция обновления скрытых полей
            function updateYearRange() {
                // Собираем выбранные годы (уникальные)
                const selectedYears = Array.from(yearsList.querySelectorAll('select'))
                    .map(sel => parseInt(sel.value, 10))
                    .filter((val, idx, arr) => val && arr.indexOf(val) === idx)
                    .sort((a, b) => a - b);
                
                // Обновляем поле с годами
                yearsInput.value = selectedYears.join(',');
                
                // Обновляем скрытые поля дат для совместимости
                if (selectedYears.length > 0) {
                    const minYear = Math.min(...selectedYears);
                    const maxYear = Math.max(...selectedYears);
                    
                    setHiddenDates(
                        `${minYear}-01-01`,
                        `${maxYear}-12-31`
                    );
                } else {
                    setHiddenDates('', '');
                }
            }
            
            // Функция для получения выбранных годов
            domElements.omniForm.getSelectedYears = function() {
                return Array.from(yearsList.querySelectorAll('select'))
                    .map(sel => parseInt(sel.value, 10))
                    .filter((val, idx, arr) => val && arr.indexOf(val) === idx)
                    .sort((a, b) => a - b);
            };
            
            updateYearRange();
        }
        
        /**
         * Рендерит поля для произвольного периода
         */
        function renderCustomRangeFields() {
            const container = domElements.dateRangeContainer;
            
            // Создаем блоки для выбора дат
            const startField = document.createElement('div');
            startField.className = 'date-field';
            
            const startLabel = document.createElement('label');
            startLabel.className = 'date-label';
            startLabel.textContent = 'Дата начала:';
            startLabel.htmlFor = 'omni-start-date-input';
            
            const startWrap = document.createElement('div');
            startWrap.className = 'input-wrapper';
            
            const startInput = document.createElement('input');
            startInput.type = 'date';
            startInput.id = 'omni-start-date-input';
            startInput.name = 'omni-start-date-display';
            startInput.className = 'filter-input';
            
            // Устанавливаем текущую дату и дату месяц назад
            const today = new Date();
            const formattedToday = today.toISOString().split('T')[0];
            
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            const formattedMonthAgo = monthAgo.toISOString().split('T')[0];
            
            startInput.value = formattedMonthAgo;
            
            startWrap.appendChild(startInput);
            startField.appendChild(startLabel);
            startField.appendChild(startWrap);
            
            // Блок для даты окончания
            const endField = document.createElement('div');
            endField.className = 'date-field';
            
            const endLabel = document.createElement('label');
            endLabel.className = 'date-label';
            endLabel.textContent = 'Дата окончания:';
            endLabel.htmlFor = 'omni-end-date-input';
            
            const endWrap = document.createElement('div');
            endWrap.className = 'input-wrapper';
            
            const endInput = document.createElement('input');
            endInput.type = 'date';
            endInput.id = 'omni-end-date-input';
            endInput.name = 'omni-end-date-display';
            endInput.className = 'filter-input';
            endInput.value = formattedToday;
            
            endWrap.appendChild(endInput);
            endField.appendChild(endLabel);
            endField.appendChild(endWrap);
            
            // Добавляем в контейнер
            container.appendChild(startField);
            container.appendChild(endField);
            
            // Создаем скрытые поля для дат
            createHiddenDateInputs();
            
            // Обновляем скрытые поля при изменении видимых
            function updateDateRange() {
                const startDate = startInput.value;
                const endDate = endInput.value;
                
                // Проверяем корректность дат
                if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
                    alert('Дата начала не может быть позже даты окончания');
                    endInput.value = startDate;
                    setHiddenDates(startDate, startDate);
                } else {
                    setHiddenDates(startDate, endDate);
                }
            }
            
            // Добавляем обработчики
            startInput.addEventListener('change', updateDateRange);
            endInput.addEventListener('change', updateDateRange);
            
            // Инициализация скрытых полей
            updateDateRange();
        }
        
        /**
         * Создает скрытые поля для дат
         */
        function createHiddenDateInputs() {
            // Удаляем существующие скрытые поля, чтобы избежать дубликатов
            const existingStart = domElements.omniForm.querySelector('input[name="omni-start-date"][type="hidden"]');
            const existingEnd = domElements.omniForm.querySelector('input[name="omni-end-date"][type="hidden"]');
            
            if (existingStart) existingStart.remove();
            if (existingEnd) existingEnd.remove();
            
            // Создаем новые скрытые поля
            const startInput = document.createElement('input');
            startInput.type = 'hidden';
            startInput.id = 'omni-hidden-start-date';
            startInput.name = 'omni-start-date';
            domElements.omniForm.appendChild(startInput);
            
            const endInput = document.createElement('input');
            endInput.type = 'hidden';
            endInput.id = 'omni-hidden-end-date';
            endInput.name = 'omni-end-date';
            domElements.omniForm.appendChild(endInput);
        }
        
        /**
         * Устанавливает значения скрытых полей дат
         * @param {string} start - Дата начала
         * @param {string} end - Дата окончания
         */
        function setHiddenDates(start, end) {
            const startInput = domElements.omniForm.querySelector('#omni-hidden-start-date');
            const endInput = domElements.omniForm.querySelector('#omni-hidden-end-date');
            
            if (startInput && endInput) {
                startInput.value = start;
                endInput.value = end;
            }
        }
        
        /**
         * Скрывает переключатель суммарные/детальные данные
         */
        function hideDataTypeSwitch() {
            // Добавляем CSS-класс и правило для более чистого управления видимостью
            const style = document.createElement('style');
            style.textContent = `
                .omni-active #dataTypeSwitch,
                .omni-active .stk-switcher:nth-child(2) {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
            
            // Переключаем класс на body в зависимости от активного режима
            const updateOmniClass = () => {
                const omniActive = document.querySelector('.toggle-option[data-value="omni"].active, .stk-btn-switch[data-type="omni"].active');
                document.body.classList.toggle('omni-active', !!omniActive);
            };
            
            // Обновляем класс при инициализации
            updateOmniClass();
            
            // Обновляем класс при переключении режимов
            document.addEventListener('reportTypeSwitch', updateOmniClass);
        }
        
        /**
         * Загружает данные
         */
        function loadData() {
            const periodType = state.periodType;
            
            // Параметры запроса
            let startDate, endDate, year, months, years;
            
            // Получаем данные в зависимости от типа периода
            if (periodType === 'month') {
                const yearSel = document.getElementById('omni-year-select');
                year = yearSel ? yearSel.value : undefined;
                months = domElements.omniForm.getSelectedMonths ? domElements.omniForm.getSelectedMonths() : [];
                
                if (!year || !months || months.length === 0) {
                    alert('Выберите год и месяцы для отчета');
                    return;
                }
            } 
            else if (periodType === 'year') {
                years = domElements.omniForm.getSelectedYears ? domElements.omniForm.getSelectedYears() : [];
                
                if (!years || years.length === 0) {
                    alert('Выберите хотя бы один год для отчета');
                    return;
                }
            }
            else {
                // Произвольный период
                startDate = domElements.omniForm.querySelector('#omni-hidden-start-date').value;
                endDate = domElements.omniForm.querySelector('#omni-hidden-end-date').value;
                
                if (!startDate || !endDate) {
                    alert('Укажите даты начала и окончания периода');
                    return;
                }
            }
            
            // Очищаем текущие данные
            renderMainTable([]);
            renderChannelsTable([]);
            
            // Показываем индикатор загрузки
            showLoading();
            
            // Выполняем параллельные запросы
            Promise.all([
                fetchData({ 
                    tableName: 'call_chat', 
                    periodType, 
                    startDate, 
                    endDate, 
                    year, 
                    months, 
                    years 
                }),
                fetchData({ 
                    tableName: 'call_tematiks', 
                    periodType, 
                    startDate, 
                    endDate, 
                    year, 
                    months, 
                    years 
                })
            ])
            .then(([mainRes, channelsRes]) => {
                // Скрываем индикатор загрузки
                hideLoading();
                
                // Обрабатываем результаты
                if (mainRes.success && Array.isArray(mainRes.data)) {
                    state.mainData = mainRes.data;
                    renderMainTable(mainRes.data);
                } else {
                    state.mainData = [];
                    renderMainTable([]);
                    console.error('Ошибка при загрузке основных данных:', mainRes.message || 'Неизвестная ошибка');
                }
                
                if (channelsRes.success && Array.isArray(channelsRes.data)) {
                    state.channelsData = channelsRes.data;
                    renderChannelsTable(channelsRes.data);
                } else {
                    state.channelsData = [];
                    renderChannelsTable([]);
                    console.error('Ошибка при загрузке данных каналов:', channelsRes.message || 'Неизвестная ошибка');
                }
            })
            .catch(error => {
                hideLoading();
                console.error('Ошибка при загрузке данных:', error);
                alert('Произошла ошибка при загрузке данных. Пожалуйста, попробуйте еще раз.');
            });
        }
        
        /**
         * Выполняет запрос к API
         * @param {Object} params - Параметры запроса
         * @returns {Promise} - Промис с результатом запроса
         */
        async function fetchData(params) {
            const { tableName, periodType, startDate, endDate, year, months, years } = params;
            
            try {
                // Формируем параметры запроса
                const queryParams = new URLSearchParams();
                queryParams.append('tableName', tableName);
                queryParams.append('periodType', periodType);
                
                if (periodType === 'month') {
                    queryParams.append('year', year);
                    
                    let monthsArray = months;
                    if (typeof monthsArray === 'function') {
                        monthsArray = monthsArray();
                    }
                    
                    if (Array.isArray(monthsArray)) {
                        queryParams.append('months', monthsArray.join(','));
                    } else if (monthsArray) {
                        queryParams.append('months', String(monthsArray));
                    }
                } 
                else if (periodType === 'year') {
                    let yearsArray = years;
                    if (typeof yearsArray === 'function') {
                        yearsArray = yearsArray();
                    }
                    
                    if (Array.isArray(yearsArray)) {
                        queryParams.append('years', yearsArray.join(','));
                    } else if (yearsArray) {
                        queryParams.append('years', String(yearsArray));
                    }
                    
                    // Добавляем параметры для совместимости
                    if (startDate) queryParams.append('startDate', startDate);
                    if (endDate) queryParams.append('endDate', endDate);
                }
                else {
                    queryParams.append('startDate', startDate);
                    queryParams.append('endDate', endDate);
                }
                
                // Выполняем запрос
                const response = await fetch(`/api/omnikol?${queryParams.toString()}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });
                
                // Обрабатываем ответ
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                
                const data = await response.json();
                return data;
            } catch (error) {
                return {
                    success: false,
                    message: error.message || 'Ошибка при выполнении запроса'
                };
            }
        }
        
        /**
         * Рендерит основную таблицу
         * @param {Array} data - Данные для таблицы
         */
        function renderMainTable(data) {
            if (!domElements.mainTableBody) return;
            
            // Очищаем таблицу
            domElements.mainTableBody.innerHTML = '';
            
            // Проверяем наличие данных
            if (!Array.isArray(data) || data.length === 0) {
                domElements.mainTableBody.innerHTML = `
                    <tr class="empty-row">
                        <td colspan="6">Нет данных</td>
                    </tr>
                `;
                return;
            }
            
            // Сортируем данные
            const sortedData = state.mainSort.column
                ? sortData(data, state.mainSort.column, state.mainSort.direction, false)
                : sortByDate(data);
            
            // Рендерим строки
            domElements.mainTableBody.innerHTML = sortedData.map(row => `
                <tr${row.report_period === 'Итого' ? ' class="total-row"' : ''}>
                    <td>${formatDate(row.report_period) || "—"}</td>
                    <td>${formatNumber(row.total_chat_requests)}</td>
                    <td>${formatNumber(row.total_processed_by_bot)}</td>
                    <td>${formatNumber(row.total_processed_by_operator)}</td>
                    <td>${row.percent_bot !== undefined ? row.percent_bot + '%' : "—"}</td>
                    <td>${row.percent_operator !== undefined ? row.percent_operator + '%' : "—"}</td>
                </tr>
            `).join('');
        }
        
        /**
         * Рендерит таблицу каналов
         * @param {Array} data - Данные для таблицы
         */
        function renderChannelsTable(data) {
            if (!domElements.channelsTableBody) return;
            
            // Очищаем таблицу
            domElements.channelsTableBody.innerHTML = '';
            
            // Проверяем наличие данных
            if (!Array.isArray(data) || data.length === 0) {
                domElements.channelsTableBody.innerHTML = `
                    <tr class="empty-row">
                        <td colspan="8">Нет данных</td>
                    </tr>
                `;
                return;
            }
            
            // Сортируем данные
            const sortedData = state.channelsSort.column
                ? sortData(data, state.channelsSort.column, state.channelsSort.direction, true)
                : sortByDate(data);
            
            // Рендерим строки
            domElements.channelsTableBody.innerHTML = sortedData.map(row => `
                <tr${row.report_period === 'Итого' ? ' class="total-row"' : ''}>
                    <td>${formatDate(row.report_period) ?? "—"}</td>
                    ${constants.CHANNELS.map(ch => `<td>${formatNumber(row[ch])}</td>`).join('')}
                </tr>
            `).join('');
        }
        
        /**
         * Сортирует данные по указанному столбцу
         * @param {Array} data - Данные для сортировки
         * @param {string} column - Столбец для сортировки
         * @param {string} direction - Направление сортировки ('asc' или 'desc')
         * @param {boolean} isChannels - Признак таблицы каналов
         * @returns {Array} - Отсортированные данные
         */
        function sortData(data, column, direction, isChannels = false) {
            if (!column) return data;
            
            // Отделяем строку "Итого" от обычных данных
            const filtered = [...data].filter(row => row.report_period !== "Итого");
            const totalRow = data.find(row => row.report_period === "Итого");
            
            // Сортируем обычные строки
            filtered.sort((a, b) => {
                let aVal = a[column], bVal = b[column];
                
                // Специальная обработка для столбца с датой/периодом
                if (column === 'report_period') {
                    // Обработка дат YYYY-MM-DD
                    if (/^\d{4}-\d{2}-\d{2}$/.test(aVal) && /^\d{4}-\d{2}-\d{2}$/.test(bVal)) {
                        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    }
                    
                    // Обработка месяцев "Месяц YYYY"
                    if (/^[А-Яа-я]+\s+\d{4}$/.test(aVal) && /^[А-Яа-я]+\s+\d{4}$/.test(bVal)) {
                        return direction === 'asc' ? aVal.localeCompare(bVal, 'ru') : bVal.localeCompare(aVal, 'ru');
                    }
                    
                    // Обработка годов "YYYY"
                    if (/^\d{4}$/.test(aVal) && /^\d{4}$/.test(bVal)) {
                        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    }
                }
                
                // Преобразуем строковые числа в числовой формат
                let numA = typeof aVal === 'number' ? aVal : parseFloat(String(aVal).replace(/\s/g, '').replace(',', '.'));
                let numB = typeof bVal === 'number' ? bVal : parseFloat(String(bVal).replace(/\s/g, '').replace(',', '.'));
                
                // Если оба значения числа, сортируем как числа
                if (!isNaN(numA) && !isNaN(numB)) {
                    return direction === 'asc' ? numA - numB : numB - numA;
                }
                
                // Защита от null/undefined
                aVal = aVal ?? "";
                bVal = bVal ?? "";
                
                // Сортировка строк с учетом локали
                return direction === 'asc'
                    ? String(aVal).localeCompare(String(bVal), 'ru')
                    : String(bVal).localeCompare(String(aVal), 'ru');
            });
            
            // Возвращаем отсортированный массив с итоговой строкой в конце
            return totalRow ? [...filtered, totalRow] : filtered;
        }
        
        /**
         * Сортирует данные по дате (итого всегда внизу)
         * @param {Array} data - Данные для сортировки
         * @returns {Array} - Отсортированные данные
         */
        function sortByDate(data) {
            return [...data].sort((a, b) => {
                if (a.report_period === "Итого") return 1;
                if (b.report_period === "Итого") return -1;
                
                // Обработка месяцев "Месяц YYYY"
                if (/^[А-Яа-я]+\s+\d{4}$/.test(a.report_period) && /^[А-Яа-я]+\s+\d{4}$/.test(b.report_period))
                    return a.report_period.localeCompare(b.report_period, 'ru');
                
                // Обработка годов "YYYY"
                if (/^\d{4}$/.test(a.report_period) && /^\d{4}$/.test(b.report_period))
                    return a.report_period.localeCompare(b.report_period, 'ru');
                
                // Обработка дат YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}$/.test(a.report_period) && /^\d{4}-\d{2}-\d{2}$/.test(b.report_period))
                    return a.report_period.localeCompare(b.report_period);
                
                // Для остальных - сортировка по умолчанию
                return a.report_period.localeCompare(b.report_period, 'ru');
            });
        }
        
        /**
         * Форматирует дату для отображения
         * @param {string} dateStr - Строка с датой
         * @returns {string} - Отформатированная дата
         */
        function formatDate(dateStr) {
            if (!dateStr || typeof dateStr !== "string") return "—";
            if (dateStr === "Итого") return dateStr;
            
            // Форматирование месяца и года: "Месяц YYYY"
            if (/^[А-Яа-я]+\s+\d{4}$/.test(dateStr)) return dateStr;
            
            // Форматирование года: "Год YYYY"
            if (/^\d{4}$/.test(dateStr)) return `Год ${dateStr}`;
            
            // Форматирование даты: YYYY-MM-DD → DD.MM.YYYY
            const [y, m, d] = dateStr.split("-");
            if (y && m && d) return `${d}.${m}.${y}`;
            
            return dateStr;
        }
        
        /**
         * Форматирует число с разделителями
         * @param {number} n - Число для форматирования
         * @returns {string} - Отформатированное число
         */
        function formatNumber(n) {
            if (n === null || n === undefined || n === "—") return "—";
            if (isNaN(Number(n))) return n;
            return Number(n).toLocaleString('ru-RU');
        }
        
        /**
         * Экспортирует данные в Excel
         */
        function exportData() {
            alert('Функция экспорта в Excel будет доступна в следующем обновлении');
        }
        
        /**
         * Очищает фильтры и данные
         */
        function clearFilters() {
            // Сбрасываем к типу "По месяцам"
            state.periodType = 'month';
            if (domElements.periodTypeSelect) {
                domElements.periodTypeSelect.value = 'month';
            }
            
            // Обновляем активную вкладку
            if (domElements.periodTabs) {
                                domElements.periodTabs.querySelectorAll('.period-tab').forEach(tab => {
                    tab.classList.toggle('active', tab.dataset.period === 'month');
                });
            }
            
            // Обновляем UI формы
            updatePeriodTypeState();
            
            // Очищаем данные и таблицы
            state.mainData = [];
            state.channelsData = [];
            renderMainTable([]);
            renderChannelsTable([]);
        }
        
        /**
         * Показывает индикатор загрузки
         */
        function showLoading() {
            state.isLoading = true;
            
            let overlay = document.getElementById('omni-loading-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'omni-loading-overlay';
                overlay.className = 'loading-overlay';
                overlay.innerHTML = `
                    <div class="loading-spinner"></div>
                    <div class="loading-message">Загрузка данных...</div>
                `;
                document.body.appendChild(overlay);
            }
            
            overlay.style.display = 'flex';
        }
        
        /**
         * Скрывает индикатор загрузки
         */
        function hideLoading() {
            state.isLoading = false;
            
            const overlay = document.getElementById('omni-loading-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }
        
        // Публичное API
        return {
            init: init,
            loadData: loadData,
            clearFilters: clearFilters,
            exportData: exportData
        };
    })();

    // Выполняем дополнительные действия для предотвращения конфликтов с основным модулем
    (function preventFormSubmissionAndButtonConflicts() {
        // Предотвращаем конфликты между формами
        document.addEventListener('submit', function(e) {
            // Проверяем, является ли форма частью омниканального чата
            const isOmniForm = e.target.closest('#omni-block');
            if (isOmniForm) {
                // Предотвращаем стандартное поведение отправки формы
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, true); // true для перехвата события в фазе захвата
        
        // Исправление ошибки переключения между вкладками "По месяцам" и "Произвольный период"
        document.addEventListener('click', function(e) {
            // Проверяем, является ли клик по вкладке периода в омниканальном чате
            const perioTab = e.target.closest('#omniPeriodTabs .period-tab, .period-tab[data-target="omni"]');
            if (perioTab) {
                // Предотвращаем стандартное поведение и всплытие события
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, true); // true для перехвата события в фазе захвата
        
        // Предотвращаем конфликты при нажатии Enter в полях омниканального чата
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const isOmniInput = e.target.closest('#omni-block input, #omni-block select');
                if (isOmniInput) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }
        }, true); // true для перехвата события в фазе захвата
        
        // Исправление стилей кнопок после загрузки страницы
        setTimeout(() => {
            const allButtons = document.querySelectorAll('#omni-block button');
            allButtons.forEach(btn => {
                // Запрещаем отправку формы для всех кнопок без type="submit"
                if (!btn.hasAttribute('type')) {
                    btn.setAttribute('type', 'button');
                }
            });
        }, 100);
    })();

    // Инициализация модуля после полной загрузки DOM
    // Используем setTimeout для гарантированной загрузки всех DOM-элементов
    setTimeout(() => {
        OmniChatModule.init();
        
        // Отключаем стандартные обработчики событий на формах и кнопках
        document.querySelectorAll('#omni-block form').forEach(form => {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            });
        });
        
        // Создаем обертку для удобного переключения между звонками и омниканальным чатом
        window.OmniChat = OmniChatModule;
        
        console.log('Модуль омниканального чата полностью инициализирован и готов к использованию');
    }, 200);
});