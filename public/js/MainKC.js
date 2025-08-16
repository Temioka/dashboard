class CallCenterDashboard {
    constructor() {
        this.hourlyChart = null;
        this.lastDataTimestamp = null;
        this.refreshInterval = null;
        this.isLoading = false;
        this.requestId = null;
        this.userName = 'TemiokaKon';
        this.version = '5.1';
        
        this.fetchAndUpdateData = this.fetchAndUpdateData.bind(this);
        this.handleRefreshClick = this.handleRefreshClick.bind(this);
        
        this.init();
    }
    
    /**
     * Инициализация дашборда
     */
    init() {
        console.log(`[INFO] Инициализация дашборда КЦ v${this.version} для пользователя ${this.userName}`);
        console.log(`[INFO] Время инициализации UTC: 2025-08-01 09:22:15`);
        
        this.showMainContent();
        this.displayCurrentDate();
        this.setupEventListeners();
        this.updateWeekdayLabels();
        this.fetchAndUpdateData();
        this.startAutoRefresh();
    }
    
    showMainContent() {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.style.display = 'block';
        }
    }
    
    displayCurrentDate() {
        const dateElement = document.getElementById('currentDateDisplay');
        if (dateElement) {
            const today = new Date();
            dateElement.textContent = this.formatDateForDisplay(today);
        }
    }
    
    setupEventListeners() {
        const refreshButton = document.getElementById('refreshButton');
        if (refreshButton) {
            refreshButton.addEventListener('click', this.handleRefreshClick);
        }
    }
    
    async handleRefreshClick(event) {
        const button = event.currentTarget;
        if (this.isLoading) return;
        
        button.classList.add('loading');
        
        try {
            await this.fetchAndUpdateData();
        } finally {
            setTimeout(() => {
                button.classList.remove('loading');
            }, 500);
        }
    }
    
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(this.fetchAndUpdateData, 60 * 1000);
        console.log('[INFO] Автообновление настроено на 60 секунд');
    }
    
    /**
     * Основная функция получения данных
     */
    async fetchAndUpdateData() {
        if (this.isLoading) {
            console.log('[INFO] Запрос уже выполняется, пропускаем');
            return;
        }
        
        const startTime = performance.now();
        this.isLoading = true;
        
        try {
            this.showLoadingState();
            console.log(`[INFO] Запрос данных КЦ от ${this.userName}...`);
            
            const response = await fetch('/api/call-center/stats', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache',
                    'X-User': this.userName,
                    'X-Client-Version': this.version
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            const loadTime = (performance.now() - startTime).toFixed(0);
            
            this.requestId = result.requestId || 'unknown';
            console.log(`[INFO] Данные получены за ${loadTime}ms, requestId: ${this.requestId}, fromCache: ${result.fromCache || false}`);
            
            // Детальное логирование структуры
            console.log('[DEBUG] Структура ответа:', {
                success: result.success,
                dataLength: result.data?.length,
                hasSummary: !!result.summary,
                hasTrends: !!result.trends,
                hasWeeklyTrends: !!result.weeklyTrends,
                hasYesterdayData: !!result.yesterdayData,
                hasPreviousWeekData: !!result.previousWeekData,
                requestId: this.requestId,
                user: result.user,
                executionTime: result.executionTime
            });
            
            if (!result.success) {
                throw new Error(result.message || 'Ошибка получения данных');
            }
            
            this.lastDataTimestamp = new Date();
            this.updateLastUpdateTime();
            
            if (result.data && Array.isArray(result.data) && result.data.length > 0) {
                console.log(`[INFO] Получено ${result.data.length} записей для обработки`);
                
                const processedData = this.processApiData(result);
                
                if (processedData.hourlyData.length > 0) {
                    this.updateInterface(processedData);
                    this.showContentState();
                    return result;
                }
            }
            
            console.log('[WARN] Нет данных для отображения');
            this.showNoDataState();
            return result;
            
        } catch (error) {
            console.error(`[ERROR] Ошибка при получении данных (requestId: ${this.requestId}):`, error);
            this.showErrorState(error.message);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Обработка данных от API
     */
    processApiData(result) {
        console.log(`[DEBUG] Обработка данных от API v${this.version} (requestId: ${this.requestId})`);
        
        const hourlyData = result.data
            .filter(item => item.report_date !== 'Итого')
            .map(item => ({
                report_hour: parseInt(item.numeric_hour || item.report_hour || 0),
                report_hour_display: item.report_hour || this.formatHourRange(item.numeric_hour),
                received_calls: parseInt(item.received_calls || 0),
                // ИСПРАВЛЕНО: Ограничиваем SL максимумом 100%
                sl_value: Math.min(parseFloat(item.sl_result || 0), 100),
                awt_value: parseInt(item.awt_result || 0),
                aht_value: parseInt(item.aht_result || 0),
                ics_value: parseFloat(item.ics_result || 0)
            }))
            .sort((a, b) => a.report_hour - b.report_hour);
        
        const summaryRow = result.data.find(item => item.report_date === 'Итого');
        const summary = summaryRow || result.summary || {};
        
        console.log('[DEBUG] Обработанные данные (SL ограничен 100%):', {
            hourlyItems: hourlyData.length,
            summaryKeys: Object.keys(summary).length,
            firstHourlyItem: hourlyData[0],
            maxSL: Math.max(...hourlyData.map(h => h.sl_value), 0)
        });
        
        return {
            hourlyData,
            summary,
            trends: result.trends || {},
            weeklyTrends: result.weeklyTrends || {},
            yesterdayData: result.yesterdayData || null,
            previousWeekData: result.previousWeekData || null
        };
    }
    
    formatHourRange(hour) {
        const currentHour = parseInt(hour || 0);
        const nextHour = (currentHour + 1) % 24;
        return `с ${String(currentHour).padStart(2, '0')}:00 по ${String(nextHour).padStart(2, '0')}:00`;
    }
    
    /**
     * Обновление интерфейса
     */
    updateInterface(data) {
        try {
            console.log(`[INFO] Обновление интерфейса v${this.version} (SL макс 100%) (requestId: ${this.requestId})`);
            
            this.updateStatCards(data);
            this.updateDetailsTable(data.hourlyData);
            this.updateSimplifiedChart(data.hourlyData);
            
        } catch (error) {
            console.error(`[ERROR] Ошибка при обновлении интерфейса (requestId: ${this.requestId}):`, error);
            this.showErrorState('Ошибка при обновлении интерфейса: ' + error.message);
        }
    }
    
    /**
     * Обновление карточек статистики
     */
    updateStatCards(data) {
        const { summary, yesterdayData, previousWeekData, trends, weeklyTrends } = data;
        
        console.log(`[DEBUG] Обновление карточек статистики (requestId: ${this.requestId})`);
        
        if (!summary || Object.keys(summary).length === 0) {
            console.warn('[WARN] Отсутствуют итоговые данные');
            return;
        }
        
        const currentValues = this.calculateCurrentValues(summary);
        console.log('[DEBUG] Рассчитанные значения:', currentValues);
        
        this.updateCurrentValues(currentValues);
        this.updateYesterdayValues(yesterdayData);
        this.updatePreviousWeekValues(previousWeekData);
        this.updateTrends(trends, weeklyTrends);
        
        console.log('[INFO] Карточки статистики обновлены');
    }
    
    /**
     * Вычисление текущих значений с ограничением SL
     */
    calculateCurrentValues(summary) {
        console.log('[DEBUG] Расчет текущих значений из summary:', summary);
        
        const values = {
            calls: parseInt(summary.received_calls || 0),
            sl: 0,
            awt: 0,
            aht: 0,
            satisfaction: 0
        };
        
        // Service Level - ИСПРАВЛЕНО: ограничиваем максимумом 100%
        if (summary.sl_result !== undefined && summary.sl_result !== null) {
            values.sl = Math.min(parseFloat(summary.sl_result), 100);
        } else if (summary.znam_sl && summary.znam_sl > 0) {
            const calculatedSL = (1 - (parseInt(summary.chis_sl || 0) / parseInt(summary.znam_sl))) * 100;
            values.sl = Math.min(calculatedSL, 100);
        }
        
        // AWT
        if (summary.awt_result !== undefined && summary.awt_result !== null) {
            values.awt = parseInt(summary.awt_result);
        } else if (summary.znam_awt && summary.znam_awt > 0) {
            values.awt = Math.round(parseInt(summary.chis_awt || 0) / parseInt(summary.znam_awt));
        }
        
        // AHT
        if (summary.aht_result !== undefined && summary.aht_result !== null) {
            values.aht = parseInt(summary.aht_result);
        } else if (summary.chislitel_aht && summary.znam_aht && summary.znam_aht > 0) {
            values.aht = Math.round(parseFloat(summary.chislitel_aht) / parseInt(summary.znam_aht));
        }
        
        // ICS
        if (summary.ics_result !== undefined && summary.ics_result !== null) {
            values.satisfaction = parseFloat(summary.ics_result);
        } else if (summary.znam_ics && summary.znam_ics > 0) {
            values.satisfaction = parseFloat(summary.chis_ics || 0) / parseInt(summary.znam_ics);
        }
        
        // Проверка на NaN
        Object.keys(values).forEach(key => {
            if (isNaN(values[key])) {
                console.warn(`[WARN] NaN значение для ${key}, установлено 0`);
                values[key] = 0;
            }
        });
        
        // ДОБАВЛЕНО: Проверка корректности SL
        if (values.sl > 100) {
            console.warn(`[WARN] SL превышает 100% (${values.sl}%), ограничено до 100%`);
            values.sl = 100;
        }
        
        console.log('[DEBUG] Итоговые значения (SL ≤ 100%):', values);
        return values;
    }
    
    updateCurrentValues(values) {
        const updates = [
            { id: 'totalCallsValue', value: values.calls.toLocaleString('ru-RU') },
            { id: 'slValue', value: Math.round(values.sl) + '%' },
            { id: 'awtValue', value: values.awt + ' сек' },
            { id: 'ahtValue', value: Math.round(values.aht) + ' сек' },
            { id: 'satisfactionValue', value: values.satisfaction.toFixed(2).replace('.', ',') }
        ];
        
        updates.forEach(({ id, value }) => {
            const element = document.getElementById(id);
            if (element) {
                console.log(`[DEBUG] Обновляем ${id}: ${value}`);
                element.textContent = value;
            } else {
                console.warn(`[WARN] Элемент ${id} не найден`);
            }
        });
    }
    
    updateYesterdayValues(yesterdayData) {
        console.log('[DEBUG] Обновление вчерашних значений:', yesterdayData);
        
        if (!yesterdayData) {
            this.setElementsText(['yesterdayCalls', 'yesterdaySL', 'yesterdayAWT', 'yesterdayAHT', 'yesterdaySatisfaction'], '--');
            return;
        }
        
        // ИСПРАВЛЕНО: Ограничиваем SL максимумом 100%
        const slValue = Math.min(yesterdayData.sl_value || 0, 100);
        
        const updates = [
            { id: 'yesterdayCalls', value: (yesterdayData.received_calls || 0).toLocaleString('ru-RU') },
            { id: 'yesterdaySL', value: Math.round(slValue) + '%' },
            { id: 'yesterdayAWT', value: (yesterdayData.awt_value || 0) + ' сек' },
            { id: 'yesterdayAHT', value: (yesterdayData.aht_value || 0) + ' сек' },
            { id: 'yesterdaySatisfaction', value: (yesterdayData.ics_value || 0).toFixed(2).replace('.', ',') }
        ];
        
        updates.forEach(({ id, value }) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }
    
    updatePreviousWeekValues(previousWeekData) {
        console.log('[DEBUG] Обновление значений за прошлую неделю:', previousWeekData);
        
        if (!previousWeekData) {
            this.setElementsText(['lastWeekCalls', 'lastWeekSL', 'lastWeekAWT', 'lastWeekAHT', 'lastWeekSatisfaction'], '--');
            return;
        }
        
        // ИСПРАВЛЕНО: Ограничиваем SL максимумом 100%
        const slValue = Math.min(previousWeekData.sl_value || 0, 100);
        
        const updates = [
            { id: 'lastWeekCalls', value: (previousWeekData.received_calls || 0).toLocaleString('ru-RU') },
            { id: 'lastWeekSL', value: Math.round(slValue) + '%' },
            { id: 'lastWeekAWT', value: (previousWeekData.awt_value || 0) + ' сек' },
            { id: 'lastWeekAHT', value: (previousWeekData.aht_value || 0) + ' сек' },
            { id: 'lastWeekSatisfaction', value: (previousWeekData.ics_value || 0).toFixed(2).replace('.', ',') }
        ];
        
        updates.forEach(({ id, value }) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }
    
    setElementsText(elementIds, text) {
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = text;
            }
        });
    }
    
    /**
     * Обновление трендов с правильной логикой для AHT
     */
    updateTrends(trends, weeklyTrends) {
        console.log('[DEBUG] Обновление трендов:', { trends, weeklyTrends });
        
        // Ежедневные тренды
        if (trends) {
            this.updateChangeIndicator('callsChange', trends.calls, 'calls');
            this.updateChangeIndicator('slChange', trends.sl, 'sl');
            this.updateChangeIndicator('awtChange', trends.awt, 'awt');
            this.updateChangeIndicator('ahtChange', trends.aht, 'aht');
            this.updateChangeIndicator('satisfactionChange', trends.satisfaction, 'satisfaction');
        } else {
            this.setElementsText(['callsChange', 'slChange', 'awtChange', 'ahtChange', 'satisfactionChange'], '--');
        }
        
        // Еженедельные тренды
        if (weeklyTrends) {
            this.updateChangeIndicator('callsWeekCompare', weeklyTrends.calls, 'calls');
            this.updateChangeIndicator('slWeekCompare', weeklyTrends.sl, 'sl');
            this.updateChangeIndicator('awtWeekCompare', weeklyTrends.awt, 'awt');
            this.updateChangeIndicator('ahtWeekCompare', weeklyTrends.aht, 'aht');
            this.updateChangeIndicator('satisfactionWeekCompare', weeklyTrends.satisfaction, 'satisfaction');
        } else {
            this.setElementsText(['callsWeekCompare', 'slWeekCompare', 'awtWeekCompare', 'ahtWeekCompare', 'satisfactionWeekCompare'], '--');
        }
    }
    
    /**
     * Обновление индикатора изменения с правильной логикой для AHT
     */
    updateChangeIndicator(elementId, changeData, metricType) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`[WARN] Элемент ${elementId} не найден`);
            return;
        }
        
        if (!changeData || changeData.value === undefined || changeData.value === null) {
            element.textContent = '--';
            return;
        }
        
        const { value, isPositive } = changeData;
        const numericValue = parseFloat(value);
        const isZero = Math.abs(numericValue) < 0.01;
        
        // Нулевое изменение - желтый цвет (neutral)
        if (isZero) {
            element.innerHTML = '0,00%';
            element.className = elementId.includes('Week') ? 'cc-week-trend neutral' : 'cc-stat-change neutral';
            console.log(`[DEBUG] Индикатор ${elementId} (${metricType}): нулевое значение, цвет=neutral`);
            return;
        }
        
        // Определение цвета на основе метрики и направления
        let colorClass;
        
        switch (metricType) {
            case 'aht':
                // ДЛЯ AHT: isPositive = true (рост AHT) = плохо (красный)
                //          isPositive = false (снижение AHT) = хорошо (зеленый)
                colorClass = isPositive ? 'decrease' : 'increase';
                break;
            case 'awt':
                // ДЛЯ AWT: рост = плохо (красный), снижение = хорошо (зеленый)
                colorClass = isPositive ? 'decrease' : 'increase';
                break;
            case 'calls':
            case 'sl':
            case 'satisfaction':
            default:
                // ДЛЯ ОСТАЛЬНЫХ: рост = хорошо (зеленый), снижение = плохо (красный)
                colorClass = isPositive ? 'increase' : 'decrease';
                break;
        }
        
        const arrowIcon = isPositive ? 
            '<i class="fas fa-arrow-up"></i>' : 
            '<i class="fas fa-arrow-down"></i>';
        
        const displayValue = typeof value === 'string' && value.includes('.') ? 
            value.replace('.', ',') : value;
        
        element.innerHTML = `${arrowIcon} ${displayValue}%`;
        element.className = elementId.includes('Week') ? 
            `cc-week-trend ${colorClass}` : 
            `cc-stat-change ${colorClass}`;
        
        console.log(`[DEBUG] Индикатор ${elementId} (${metricType}): значение=${value}%, isPositive=${isPositive}, цвет=${colorClass}`);
    }
    
    /**
     * Обновление названий дней недели
     */
    updateWeekdayLabels() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        
        const weekdayNamesNominative = [
            'воскресенье', 'понедельник', 'вторник', 'среда', 
            'четверг', 'пятница', 'суббота'
        ];
        
        const weekdayNamesDative = [
            'воскресенью', 'понедельнику', 'вторнику', 'среде', 
            'четвергу', 'пятнице', 'субботе'
        ];
        
        const weekdayPreviousNominative = [
            'Прошлое', 'Прошлый', 'Прошлый', 'Прошлая', 
            'Прошлый', 'Прошлая', 'Прошлая'
        ];
        
        const weekdayPreviousDative = [
            'прошлому', 'прошлому', 'прошлому', 'прошлой', 
            'прошлому', 'прошлой', 'прошлой'
        ];
        
        document.querySelectorAll('[id^="lastWeekDayLabel-"]').forEach(element => {
            element.textContent = `${weekdayPreviousNominative[dayOfWeek]} ${weekdayNamesNominative[dayOfWeek]}`;
        });
        
        document.querySelectorAll('[data-weekday-label="true"]').forEach(element => {
            element.textContent = `К ${weekdayPreviousDative[dayOfWeek]} ${weekdayNamesDative[dayOfWeek]}`;
        });
        
        console.log(`[INFO] Обновлены метки дня недели для ${weekdayNamesNominative[dayOfWeek]}`);
    }
    
    /**
     * Обновление таблицы (SL ограничен 100%)
     */
    updateDetailsTable(hourlyData) {
        const tableBody = document.getElementById('detailsTableBody');
        if (!tableBody) {
            console.warn('[WARN] Таблица не найдена');
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (!hourlyData || hourlyData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="cc-no-data-cell">Нет данных для отображения</td>
                </tr>
            `;
            return;
        }
        
        hourlyData.forEach(hourData => {
            try {
                const row = document.createElement('tr');
                const hourDisplay = this.formatHourForTable(hourData);
                const isZeroICS = Math.abs(hourData.ics_value || 0) < 0.001;
                
                // ИСПРАВЛЕНО: Ограничиваем SL в таблице до 100%
                const slValue = Math.min(Math.round(hourData.sl_value || 0), 100);
                
                row.innerHTML = `
                    <td>${hourDisplay}</td>
                    <td>${(hourData.received_calls || 0).toLocaleString('ru-RU')}</td>
                    <td>${slValue}%</td>
                    <td>${hourData.awt_value || 0} сек</td>
                    <td>${hourData.aht_value || 0} сек</td>
                    <td class="ics-col">${isZeroICS ? '-' : (hourData.ics_value || 0).toFixed(2).replace('.', ',')}</td>
                `;
                
                tableBody.appendChild(row);
            } catch (error) {
                console.warn('[WARN] Ошибка при добавлении строки в таблицу:', error);
            }
        });
        
        console.log('[INFO] Таблица обновлена (SL ограничен 100%)');
    }
    
    formatHourForTable(hourData) {
        if (hourData.report_hour_display) {
            const match = hourData.report_hour_display.match(/с\s+(\d+)(?::\d+)?\s+по\s+(\d+)(?::\d+)?/);
            if (match) {
                const start = match[1].padStart(2, '0');
                const end = match[2].padStart(2, '0');
                return `${start}-${end}`;
            }
        }
        
        const hour = parseInt(hourData.report_hour || 0);
        const nextHour = (hour + 1) % 24;
        return `${String(hour).padStart(2, '0')}-${String(nextHour).padStart(2, '0')}`;
    }
    
    /**
     * ИСПРАВЛЕНО: Упрощенный график с максимумом SL = 100%
     */
    async updateSimplifiedChart(hourlyData) {
        try {
            const chartElement = document.getElementById('hourlyChart');
            if (!chartElement) {
                console.warn('[WARN] Элемент графика не найден');
                return;
            }
            
            if (this.hourlyChart) {
                this.hourlyChart.destroy();
                this.hourlyChart = null;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const ctx = chartElement.getContext('2d');
            ctx.clearRect(0, 0, chartElement.width, chartElement.height);
            
            if (!hourlyData || hourlyData.length === 0) {
                this.showNoDataState();
                return;
            }
            
            console.log(`[DEBUG] Создание ИСПРАВЛЕННОГО графика (SL ≤ 100%), записей: ${hourlyData.length} (requestId: ${this.requestId})`);
            
            const sortedData = [...hourlyData].sort((a, b) => a.report_hour - b.report_hour);
            
            const labels = sortedData.map(item => this.formatHourForTable(item));
            const callsData = sortedData.map(item => parseInt(item.received_calls || 0));
            // ИСПРАВЛЕНО: SL данные уже ограничены в processApiData(), но дополнительно проверяем
            const slData = sortedData.map(item => Math.min(parseFloat(item.sl_value || 0), 100));
            
            // Анализ данных
            const maxCalls = Math.max(...callsData, 0);
            const maxSL = Math.max(...slData, 0);
            
            console.log('[DEBUG] Анализ данных для графика (SL ≤ 100%):', {
                labels: labels.length,
                calls: { data: callsData.slice(0, 5), max: maxCalls },
                sl: { data: slData.slice(0, 5), max: maxSL.toFixed(1), maxAllowed: 100 }
            });
            
            // Проверяем, что SL не превышает 100%
            if (maxSL > 100) {
                console.warn(`[WARN] Обнаружен SL > 100% (${maxSL}%), данные некорректны`);
            }
            
            // Создаем градиенты
            const barGradient = ctx.createLinearGradient(0, 0, 0, 400);
            barGradient.addColorStop(0, 'rgba(255, 81, 0, 0.9)');
            barGradient.addColorStop(0.7, 'rgba(255, 81, 0, 0.65)');
            barGradient.addColorStop(1, 'rgba(255, 81, 0, 0.3)');
            
            const slGradient = ctx.createLinearGradient(0, 0, 0, 400);
            slGradient.addColorStop(0, 'rgba(23, 162, 184, 0.25)');
            slGradient.addColorStop(1, 'rgba(23, 162, 184, 0.05)');
            
            // Устанавливаем высоту
            chartElement.style.height = '450px';
            
            // ИСПРАВЛЕНО: Диапазоны осей с правильным максимумом SL
            const callsAxisMax = Math.max(Math.ceil(maxCalls * 1.15), 50);
            const slAxisMax = 100; // ЗАФИКСИРОВАНО: SL не может быть больше 100%
            
            console.log(`[DEBUG] ИСПРАВЛЕННЫЕ диапазоны осей: звонки(0-${callsAxisMax}), SL(0-${slAxisMax}%)`);
            
            this.hourlyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            type: 'bar',
                            label: ' Поступило звонков',
                            data: callsData,
                            backgroundColor: barGradient,
                            borderColor: 'rgba(255, 81, 0, 0.8)',
                            borderWidth: 1.5,
                            borderRadius: 8,
                            borderSkipped: false,
                            categoryPercentage: 0.6,
                            barPercentage: 0.85,
                            order: 1,
                            yAxisID: 'calls'
                        },
                        {
                            type: 'line',
                            label: ' Service Level (%)',
                            data: slData,
                            borderColor: '#17a2b8',
                            backgroundColor: slGradient,
                            borderWidth: 3.5,
                            fill: true,
                            tension: 0.35,
                            yAxisID: 'sl',
                            pointRadius: 5,
                            pointHoverRadius: 8,
                            pointBackgroundColor: '#fff',
                            pointBorderColor: '#17a2b8',
                            pointBorderWidth: 3,
                            spanGaps: true,
                            order: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1000,
                        easing: 'easeOutQuart'
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    elements: {
                        bar: {
                            borderWidth: 1.5
                        },
                        line: {
                            tension: 0.35
                        },
                        point: {
                            hitRadius: 12,
                            hoverRadius: 9
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            align: 'end',
                            labels: {
                                usePointStyle: true,
                                pointStyle: 'circle',
                                boxWidth: 10,
                                boxHeight: 10,
                                font: { 
                                    size: 14,
                                    weight: '600'
                                },
                                padding: 25,
                                color: '#495057'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            titleColor: '#212529',
                            bodyColor: '#495057',
                            borderColor: '#dee2e6',
                            borderWidth: 2,
                            cornerRadius: 10,
                            padding: 15,
                            boxWidth: 12,
                            usePointStyle: true,
                            titleFont: {
                                size: 14,
                                weight: '700'
                            },
                            bodyFont: {
                                size: 13,
                                weight: '500'
                            },
                            callbacks: {
                                title: function(context) {
                                    return `Период: ${context[0].label}`;
                                },
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    
                                    const value = context.parsed.y;
                                    if (value !== null && !isNaN(value)) {
                                        if (context.datasetIndex === 0) {
                                            // Столбцы - количество звонков
                                            label += Math.round(value).toLocaleString('ru-RU');
                                        } else if (context.datasetIndex === 1) {
                                            // Service Level - проценты (ограничено 100%)
                                            const slValue = Math.min(value, 100);
                                            label += slValue.toFixed(1).replace('.', ',') + '%';
                                        }
                                    } else {
                                        label += 'Нет данных';
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { 
                                display: false,
                                drawBorder: true,
                                borderColor: '#e0e0e0',
                                borderWidth: 2
                            },
                            ticks: {
                                color: '#6c757d',
                                font: { 
                                    size: 12,
                                    weight: '500'
                                },
                                maxRotation: 45,
                                minRotation: 0,
                                padding: 8
                            },
                            title: {
                                display: true,
                                text: 'Временные интервалы',
                                color: '#495057',
                                font: {
                                    size: 13,
                                    weight: '700'
                                },
                                padding: 12
                            }
                        },
                        // Ось для количества звонков (левая)
                        calls: {
                            type: 'linear',
                            position: 'left',
                            beginAtZero: true,
                            max: callsAxisMax,
                            ticks: {
                                color: '#ff5100',
                                callback: function(value) {
                                    return Math.round(value).toLocaleString('ru-RU');
                                },
                                font: { 
                                    size: 12,
                                    weight: '700'
                                },
                                padding: 8
                            },
                            grid: { 
                                color: 'rgba(255, 81, 0, 0.1)',
                                drawOnChartArea: true,
                                drawBorder: true,
                                borderColor: '#ff5100',
                                borderWidth: 3
                            },
                            title: {
                                display: true,
                                text: 'Количество звонков',
                                color: '#ff5100',
                                font: {
                                    size: 14,
                                    weight: '700'
                                },
                                padding: 15
                            }
                        },
                        // ИСПРАВЛЕНО: Ось для Service Level (правая) с максимумом 100%
                        sl: {
                            type: 'linear',
                            position: 'right',
                            beginAtZero: true,
                            max: slAxisMax, // ЗАФИКСИРОВАНО: 100%
                            min: 0,
                            ticks: {
                                color: '#17a2b8',
                                callback: function(value) {
                                    return Math.round(value) + '%';
                                },
                                font: { 
                                    size: 12,
                                    weight: '700'
                                },
                                stepSize: 20, // Шаг 20%: 0%, 20%, 40%, 60%, 80%, 100%
                                padding: 8
                            },
                            grid: { 
                                drawOnChartArea: false,
                                drawBorder: true,
                                borderColor: '#17a2b8',
                                borderWidth: 3
                            },
                            title: {
                                display: true,
                                text: 'Service Level',
                                color: '#17a2b8',
                                font: {
                                    size: 14,
                                    weight: '700'
                                },
                                padding: 15
                            }
                        }
                    },
                    layout: {
                        padding: {
                            top: 20,
                            right: 20,
                            bottom: 20,
                            left: 20
                        }
                    }
                }
            });
            
            this.showContentState();
            console.log(`[INFO] ИСПРАВЛЕННЫЙ график создан (SL ≤ 100%). Оси: звонки(0-${callsAxisMax}), SL(0-${slAxisMax}%) (requestId: ${this.requestId})`);
            
        } catch (error) {
            console.error(`[ERROR] Ошибка при создании исправленного графика (requestId: ${this.requestId}):`, error);
            this.showErrorState('Ошибка при создании графика: ' + error.message);
        }
    }
    
    /**
     * Обновление времени последнего обновления
     */
    updateLastUpdateTime() {
        const element = document.getElementById('lastUpdateTime');
        if (!element) return;
        
        const now = this.lastDataTimestamp || new Date();
        const timeString = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        element.textContent = `Обновлено: ${timeString}`;
    }
    
    // Состояния UI
    showLoadingState() {
        this.toggleUIState('loading', true);
    }
    
    showContentState() {
        this.toggleUIState('content', true);
    }
    
    showNoDataState() {
        this.toggleUIState('nodata', true);
    }
    
    showErrorState(message) {
        this.toggleUIState('error', true, message);
    }
    
    toggleUIState(state, show, message = '') {
        const loadingEl = document.getElementById('chartLoading');
        const noDataEl = document.getElementById('chartNoData');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (noDataEl) noDataEl.style.display = 'none';
        
        switch (state) {
            case 'loading':
                if (loadingEl && show) loadingEl.style.display = 'flex';
                break;
            case 'nodata':
                if (noDataEl && show) {
                    noDataEl.style.display = 'flex';
                    noDataEl.innerHTML = `
                        <i class="fas fa-chart-bar"></i>
                        <p>Нет данных для отображения</p>
                    `;
                }
                break;
            case 'error':
                if (noDataEl && show) {
                    noDataEl.style.display = 'flex';
                    noDataEl.innerHTML = `
                        <i class="fas fa-exclamation-circle" style="color: #dc3545;"></i>
                        <p>Ошибка получения данных</p>
                        <small>${message}</small>
                    `;
                }
                break;
        }
    }
    
    formatDateForDisplay(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }
    
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        if (this.hourlyChart) {
            this.hourlyChart.destroy();
            this.hourlyChart = null;
        }
        
        console.log(`[INFO] Дашборд контактного центра v${this.version} очищен (пользователь: ${this.userName})`);
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('[INFO] DOM загружен, инициализация дашборда v5.1 (SL ≤ 100%)...');
    window.callCenterDashboard = new CallCenterDashboard();
});

window.addEventListener('beforeunload', function() {
    if (window.callCenterDashboard) {
        window.callCenterDashboard.destroy();
    }
});

// Обработка ошибок
window.addEventListener('error', function(event) {
    console.error('[ERROR] Глобальная ошибка JavaScript:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('[ERROR] Необработанное отклонение промиса:', event.reason);
});