const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { pool, targetPool } = require('../config/database'); // Импортируем также targetPool
const { getCurrentMoscowTime } = require('../utils/dateTime');
const { checkAuthenticated } = require('../middleware/auth');
const { addNotification, PREDEFINED_NOTIFICATIONS } = require('../utils/notifications')

// Константы для кеширования
const CACHE_TTL = 3600000; // 1 час в миллисекундах
const ONLINE_CACHE_TTL = 120000; // 2 минута для онлайн-данных
const queryCache = new Map();

/**
 * Получение данных профиля пользователя по логину
 */
router.get('/api/user/:username', async (req, res) => {
  const start = Date.now();
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ 
        error: 'Ошибка запроса', 
        message: 'Не указано имя пользователя' 
      });
    }
    
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: 'Некорректное имя пользователя',
        message: 'Имя пользователя должно содержать только буквы, цифры и символ подчеркивания, длина от 3 до 30 символов'
      });
    }
    
    const cacheKey = `user_${username}`;
    const cachedUser = queryCache.get(cacheKey);
    if (cachedUser && (Date.now() - cachedUser.timestamp < CACHE_TTL)) {
      logger.info(`Данные пользователя ${username} получены из кеша (${Date.now() - start}ms)`);
      
      const userData = {
        ...cachedUser.data,
        currentTime: getCurrentMoscowTime(),
        lastLogin: "2025-04-02 12:43:00"
      };
      
      return res.json(userData);
    }
    
    try {
      // Пытаемся получить данные из БД
      const queryText = 'SELECT id, login, full_name, email, department, role FROM "users" WHERE login = $1';
      const result = await pool.query(queryText, [username]);
      
      if (result.rows.length > 0) {
        const userData = {
          username: result.rows[0].login,
          full_name: result.rows[0].full_name,
          email: result.rows[0].email,
          department: result.rows[0].department,
          role: result.rows[0].role,
          lastLogin: "2025-04-02 12:43:00"
        };
        
        // Сохраняем данные в кеш
        queryCache.set(cacheKey, {
          data: userData,
          timestamp: Date.now()
        });
        
        logger.info(`Данные пользователя ${username} получены из БД (${Date.now() - start}ms)`);
        return res.json(userData);
      }
    } catch (err) {
      logger.warn('Ошибка запроса к БД при получении данных пользователя:', err);
    }
    
    // Если пользователь не найден в БД или произошла ошибка, возвращаем симулированные данные
    const mockUserData = {
      username: username,
      full_name: username,
      email: `${username}@example.com`,
      department: 'Отдел разработки',
      role: 'user',
      lastLogin: "2025-04-02 12:43:00"
    };
    
    queryCache.set(cacheKey, {
      data: mockUserData,
      timestamp: Date.now()
    });
    
    logger.info(`Данные пользователя ${username} (мок) получены (${Date.now() - start}ms)`);
    res.json(mockUserData);
  } catch (err) {
    logger.error(`Ошибка получения данных пользователя`, err);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Внутренняя ошибка при получении данных пользователя'
    });
  }
});
/*==========================================================
    ОНЛАЙН ДАННЫЕ ПО СТРАНИЦЕ (Online тематики/сотрудники)
==========================================================*/
// ========================
// КОНФИГУРАЦИЯ И КОНСТАНТЫ
// ========================
const ACTIVE_LINES = ['Горячая линия', 'Вторая линия', 'Линия продаж'];
const LINES_CONDITION = ACTIVE_LINES.map(line => `scd.proekt = '${line}'`).join(' OR ');

// Система синхронизации кэша
const pendingRequests = new Map();
const UNIFIED_CACHE_TTL = 120000; // 2 минуты для всех endpoint'ов

/**
 * Функция для генерации единого ключа времени
 */
function getUnifiedTimeSlot() {
    return Math.floor(Date.now() / UNIFIED_CACHE_TTL);
}

/**
 * Универсальная функция для получения данных с защитой от race condition
 */
async function getCachedOrFetch(cacheKey, fetchFunction, requestId) {
    // Проверяем кэш
    const cachedData = queryCache.get(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp < UNIFIED_CACHE_TTL)) {
        console.log(`[INFO] ${requestId} - Данные получены из кэша`);
        return {
            ...cachedData.data,
            fromCache: true,
            cacheTime: new Date(cachedData.timestamp).toISOString(),
            requestId: requestId
        };
    }

    // Проверяем, есть ли уже выполняющийся запрос
    if (pendingRequests.has(cacheKey)) {
        console.log(`[INFO] ${requestId} - Ожидание завершения параллельного запроса`);
        try {
            const result = await pendingRequests.get(cacheKey);
            return {
                ...result,
                requestId: requestId,
                fromCache: false,
                wasPending: true
            };
        } catch (error) {
            console.log(`[WARN] ${requestId} - Ошибка при ожидании параллельного запроса, выполняем свой`);
        }
    }

    // Создаем промис для данного запроса
    const dataPromise = fetchFunction();
    pendingRequests.set(cacheKey, dataPromise);

    try {
        const result = await dataPromise;
        
        // Сохраняем в кэш
        queryCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });

        return {
            ...result,
            requestId: requestId,
            fromCache: false
        };
    } finally {
        // Удаляем из карты активных запросов
        pendingRequests.delete(cacheKey);
    }
}

// ========================
// ENDPOINT ДЛЯ ГРУПП ОПЕРАТОРОВ
// ========================
router.get('/api/managers', async (req, res) => {
    const start = Date.now();
    const requestId = `mgr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    try {
        console.log(`[INFO] ${requestId} - Запрос списка активных групп операторов (все линии) от Kondakov_AV`);
        
        const today = new Date().toISOString().split('T')[0];
        const timeSlot = getUnifiedTimeSlot();
        const cacheKey = `managers_active_multiline_${today}_${timeSlot}`;
        
        const result = await getCachedOrFetch(cacheKey, async () => {
            return await fetchManagersData(requestId, start);
        }, requestId);
        
        const message = result.data.length > 0 ? 
            `Загружено ${result.data.length} активных групп (${result.meta?.totalCallsToday || 0} звонков по всем линиям)` :
            'Нет активных групп за сегодня';
        
        res.json(addNotification(result, message, result.data.length > 0 ? 'success' : 'warning'));
        
    } catch (error) {
        console.error(`[ERROR] ${requestId} - Ошибка получения активных групп операторов:`, error);
        
        const errorData = {
            success: true,
            data: [],
            recordsCount: 0,
            timestamp: getCurrentMoscowTime(),
            executionTime: `${Date.now() - start}ms`,
            requestId: requestId,
            user: 'Kondakov_AV',
            error: true,
            errorMessage: process.env.NODE_ENV === 'development' ? error.message : 'Ошибка загрузки данных'
        };
        
        res.json(addNotification(errorData, 'Не удалось загрузить активные группы', 'error'));
    }
});

// ========================
// ENDPOINT ДЛЯ СТАТИСТИКИ СОТРУДНИКОВ
// ========================
router.get('/api/employees-stats', async (req, res) => {
    const start = Date.now();
    const requestId = `emp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    try {
        console.log(`[INFO] ${requestId} - Запрос статистики по сотрудникам (все линии) от Kondakov_AV`);
        
        const today = new Date().toISOString().split('T')[0];
        const timeSlot = getUnifiedTimeSlot();
        const cacheKey = `employees_stats_multiline_${today}_${timeSlot}`;
        
        const result = await getCachedOrFetch(cacheKey, async () => {
            return await fetchEmployeesData(requestId, start);
        }, requestId);
        
        // Убираем addNotification и возвращаем только данные
        res.json(result);
        
    } catch (error) {
        console.error(`[ERROR] ${requestId} - Ошибка получения статистики сотрудников:`, error);
        
        const errorResponse = {
            success: false,
            message: 'Ошибка получения статистики по сотрудникам',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Внутренняя ошибка сервера',
            timestamp: getCurrentMoscowTime(),
            requestId: requestId,
            user: 'Kondakov_AV'
        };
        
        // Убираем addNotification и из обработки ошибок
        res.status(500).json(errorResponse);
    }
});

// ========================
// ENDPOINT ДЛЯ ТЕМАТИК
// ========================
router.get('/api/themes-online', async (req, res) => {
    const start = Date.now();
    const requestId = `themes-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    try {
        console.log(`[INFO] ${requestId} - Запрос данных по тематикам (все линии) от Kondakov_AV`);
        
        const today = new Date().toISOString().split('T')[0];
        const timeSlot = getUnifiedTimeSlot();
        const cacheKey = `themes_online_multiline_${today}_${timeSlot}`;
        
        const result = await getCachedOrFetch(cacheKey, async () => {
            return await fetchThemesData(requestId, start);
        }, requestId);
        
        const message = result.data.length > 0 ? 
            `Загружено ${result.data.length} тематик (${result.totalCalls || 0} звонков по всем линиям, ${result.meta?.totalOperators || 0} операторов)` :
            'Нет данных по тематикам за сегодня';
        
        res.json(addNotification(result, message, result.data.length > 0 ? 'success' : 'warning'));
        
    } catch (error) {
        console.error(`[ERROR] ${requestId} - Ошибка получения тематик:`, error);
        
        const errorResponse = {
            success: false,
            message: 'Ошибка получения данных по тематикам',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Внутренняя ошибка сервера',
            timestamp: getCurrentMoscowTime(),
            requestId: requestId,
            user: 'Kondakov_AV'
        };
        
        res.status(500).json(addNotification(errorResponse, 'Не удалось загрузить тематики', 'error'));
    }
});

// ========================
// ФУНКЦИИ ПОЛУЧЕНИЯ ДАННЫХ
// ========================

/**
 * Получение данных по группам операторов
 */
async function fetchManagersData(requestId, start) {
    let client;
    
    try {
        client = await targetPool.connect();
        await client.query("SET lc_time = 'ru_RU'");
        await client.query("SET timezone = 'Europe/Moscow'");
        
        console.log(`[INFO] ${requestId} - Подключение к БД установлено для активных групп`);
        
        const managersQuery = `
            SELECT 
                COALESCE(NULLIF(TRIM(mfa.stringcontent), ''), 'Без группы') as manager_name,
                CASE 
                    WHEN mfa.stringcontent IS NOT NULL AND TRIM(mfa.stringcontent) != ''
                    THEN ABS(HASHTEXT(TRIM(mfa.stringcontent))) % 1000000
                    ELSE 0
                END as manager_id,
                COUNT(DISTINCT scd.login) as active_employees_today,
                SUM(CASE WHEN scd.final_stage = 'operator' THEN 1 ELSE 0 END) as calls_today,
                ROUND(AVG(COALESCE(scd.wrapuptime, 0))) as avg_acw,
                ROUND(AVG(COALESCE(scd.speakingtime, 0) + COALESCE(scd.wrapuptime, 0))) as avg_aht,
                COUNT(CASE WHEN scd.proekt = 'Горячая линия' AND scd.final_stage = 'operator' THEN 1 END) as hotline_calls,
                COUNT(CASE WHEN scd.proekt = 'Вторая линия' AND scd.final_stage = 'operator' THEN 1 END) as second_line_calls,
                COUNT(CASE WHEN scd.proekt = 'Линия продаж' AND scd.final_stage = 'operator' THEN 1 END) as sales_line_calls
            FROM summary_call_detail scd
            INNER JOIN mv_employee mve ON mve.login = scd.login 
            LEFT JOIN mv_flex_attribute mfa ON mfa.objuuid = mve.uuid AND mfa.identifier = 'group_name'
            WHERE 
                scd.call_date::timestamp without time zone >= CURRENT_DATE 
                AND scd.call_date::timestamp without time zone < CURRENT_DATE + INTERVAL '1 day'
                AND scd.login != '0007' 
                AND scd.final_stage = 'operator'
                AND scd.sessionid IS NOT NULL
                AND mve.title IS NOT NULL 
                AND TRIM(mve.title) != ''
            GROUP BY 
                COALESCE(NULLIF(TRIM(mfa.stringcontent), ''), 'Без группы'),
                CASE 
                    WHEN mfa.stringcontent IS NOT NULL AND TRIM(mfa.stringcontent) != ''
                    THEN ABS(HASHTEXT(TRIM(mfa.stringcontent))) % 1000000
                    ELSE 0
                END
            HAVING 
                COUNT(DISTINCT scd.login) > 0 
                AND SUM(CASE WHEN scd.final_stage = 'operator' THEN 1 ELSE 0 END) >= 1
            ORDER BY 
                calls_today DESC, 
                active_employees_today DESC, 
                manager_name ASC
        `;
        
        console.log(`[INFO] ${requestId} - Выполнение SQL запроса для активных групп операторов...`);
        
        const managersResult = await client.query(managersQuery);
        
        console.log(`[INFO] ${requestId} - Получено ${managersResult.rows.length} активных групп операторов`);
        
        const managersData = managersResult.rows
            .filter(row => row.active_employees_today > 0 && row.calls_today > 0)
            .map((row) => ({
                id: parseInt(row.manager_id) || 0,
                name: row.manager_name || 'Без группы',
                employeesCount: parseInt(row.active_employees_today) || 0,
                callsToday: parseInt(row.calls_today) || 0,
                avgAcw: parseInt(row.avg_acw) || 0,
                avgAht: parseInt(row.avg_aht) || 0,
                performance: calculateGroupPerformance(parseInt(row.calls_today), parseInt(row.active_employees_today)),
                lineStats: {
                    hotline: parseInt(row.hotline_calls) || 0,
                    secondLine: parseInt(row.second_line_calls) || 0,
                    salesLine: parseInt(row.sales_line_calls) || 0
                }
            }));
        
        managersData.sort((a, b) => {
            if (b.callsToday !== a.callsToday) {
                return b.callsToday - a.callsToday;
            }
            return b.employeesCount - a.employeesCount;
        });
        
        return {
            success: true,
            data: managersData,
            recordsCount: managersData.length,
            timestamp: getCurrentMoscowTime(),
            executionTime: `${Date.now() - start}ms`,
            user: 'Kondakov_AV',
            meta: {
                onlyActiveGroups: true,
                dateFilter: 'today',
                supportedLines: ACTIVE_LINES,
                totalActiveEmployees: managersData.reduce((sum, m) => sum + m.employeesCount, 0),
                totalCallsToday: managersData.reduce((sum, m) => sum + m.callsToday, 0),
                avgCallsPerGroup: managersData.length > 0 ? 
                    Math.round(managersData.reduce((sum, m) => sum + m.callsToday, 0) / managersData.length) : 0,
                lineDistribution: {
                    hotline: managersData.reduce((sum, m) => sum + m.lineStats.hotline, 0),
                    secondLine: managersData.reduce((sum, m) => sum + m.lineStats.secondLine, 0),
                    salesLine: managersData.reduce((sum, m) => sum + m.lineStats.salesLine, 0)
                }
            }
        };
        
    } finally {
        if (client) {
            try {
                client.release();
                console.log(`[INFO] ${requestId} - Соединение с БД освобождено (managers)`);
            } catch (releaseError) {
                console.error(`[ERROR] ${requestId} - Ошибка при освобождении соединения:`, releaseError);
            }
        }
    }
}

/**
 * Получение данных по сотрудникам
 */
async function fetchEmployeesData(requestId, start) {
    let client;
    
    try {
        client = await targetPool.connect();
        await client.query("SET lc_time = 'ru_RU'");
        await client.query("SET timezone = 'Europe/Moscow'");
        
        console.log(`[INFO] ${requestId} - Подключение к БД установлено для сотрудников`);
        
        const employeesQuery = `
            SELECT 
                COALESCE(NULLIF(TRIM(mve.title), ''), scd.login) as title, 
                scd.login,
                COUNT(scd.login) as received, 
                ROUND(SUM(COALESCE(scd.wrapuptime, 0)) / GREATEST(COUNT(scd.login), 1)) as acw, 
                ROUND(SUM(COALESCE(scd.speakingtime, 0) + COALESCE(scd.wrapuptime, 0)) / GREATEST(COUNT(scd.login), 1)) as aht,
                ROUND(
                    CASE 
                        WHEN SUM(
                            CASE 
                                WHEN scd.ques3 IS NOT NULL 
                                     AND scd.final_stage = 'operator' 
                                THEN 3 
                                ELSE 0 
                            END
                        ) > 0
                        THEN SUM(
                            CASE 
                                WHEN scd.ques3 IS NOT NULL 
                                     AND scd.final_stage = 'operator' 
                                THEN (
                                    COALESCE(scd.ques1::numeric, 0) + 
                                    COALESCE(scd.ques2::numeric, 0) + 
                                    COALESCE(scd.ques3::numeric, 0)
                                )
                                ELSE 0 
                            END
                        ) / SUM(
                            CASE 
                                WHEN scd.ques3 IS NOT NULL 
                                     AND scd.final_stage = 'operator' 
                                THEN 3 
                                ELSE 0 
                            END
                        )
                        ELSE NULL 
                    END, 2
                ) as ics_result,
                COALESCE(NULLIF(TRIM(mfa.stringcontent), ''), 'Без группы') as manager_name,
                CASE 
                    WHEN mfa.stringcontent IS NOT NULL AND TRIM(mfa.stringcontent) != ''
                    THEN ABS(HASHTEXT(TRIM(mfa.stringcontent))) % 1000000
                    ELSE 0
                END as manager_id,
                MIN(scd.call_date) as first_call_today,
                MAX(scd.call_date) as last_call_today,
                COUNT(DISTINCT CASE WHEN scd.proekt = 'Горячая линия' THEN scd.sessionid END) as hotline_calls,
                COUNT(DISTINCT CASE WHEN scd.proekt = 'Вторая линия' THEN scd.sessionid END) as second_line_calls,
                COUNT(DISTINCT CASE WHEN scd.proekt = 'Линия продаж' THEN scd.sessionid END) as sales_line_calls
            FROM 
                summary_call_detail scd 
            INNER JOIN mv_employee mve ON mve.login = scd.login 
            LEFT JOIN mv_flex_attribute mfa ON mfa.objuuid = mve.uuid AND mfa.identifier = 'group_name'
            WHERE
                scd.call_date::timestamp without time zone >= CURRENT_DATE 
                AND scd.call_date::timestamp without time zone < CURRENT_DATE + INTERVAL '1 day'
                AND scd.login != '0007' 
                AND scd.final_stage = 'operator'
                AND scd.sessionid IS NOT NULL
                AND mve.title IS NOT NULL 
                AND TRIM(mve.title) != ''
            GROUP BY 
                scd.login, mve.title, mfa.stringcontent
            HAVING 
                COUNT(scd.login) > 0
            ORDER BY 
                COUNT(scd.login) DESC, 
                COALESCE(NULLIF(TRIM(mfa.stringcontent), ''), 'Без группы') ASC
        `;
        
        const summaryQuery = `
            SELECT 
                COUNT(DISTINCT scd.login) as total_employees,
                SUM(CASE WHEN scd.final_stage = 'operator' THEN 1 ELSE 0 END) as total_received,
                ROUND(AVG(COALESCE(scd.wrapuptime, 0))) as avg_acw,
                ROUND(AVG(COALESCE(scd.speakingtime, 0) + COALESCE(scd.wrapuptime, 0))) as avg_aht,
                COUNT(DISTINCT CASE WHEN scd.proekt = 'Горячая линия' THEN scd.sessionid END) as total_hotline_calls,
                COUNT(DISTINCT CASE WHEN scd.proekt = 'Вторая линия' THEN scd.sessionid END) as total_second_line_calls,
                COUNT(DISTINCT CASE WHEN scd.proekt = 'Линия продаж' THEN scd.sessionid END) as total_sales_line_calls,
                COUNT(DISTINCT mfa.stringcontent) as active_groups_count
            FROM 
                summary_call_detail scd 
            INNER JOIN mv_employee mve ON mve.login = scd.login 
            LEFT JOIN mv_flex_attribute mfa ON mfa.objuuid = mve.uuid AND mfa.identifier = 'group_name'
            WHERE
                scd.call_date::timestamp without time zone >= CURRENT_DATE 
                AND scd.call_date::timestamp without time zone < CURRENT_DATE + INTERVAL '1 day'
                AND scd.login != '0007' 
                AND scd.final_stage = 'operator'
                AND scd.sessionid IS NOT NULL
        `;
        
        console.log(`[INFO] ${requestId} - Выполнение SQL запросов для сотрудников...`);
        
        const [employeesResult, summaryResult] = await Promise.all([
            client.query(employeesQuery),
            client.query(summaryQuery)
        ]);
        
        console.log(`[INFO] ${requestId} - Получено ${employeesResult.rows.length} активных сотрудников`);
        
        const employeesData = employeesResult.rows.map((row, index) => ({
            position: index + 1,
            title: row.title || row.login || 'Неизвестный сотрудник',
            login: row.login || '',
            received: parseInt(row.received) || 0,
            acw: parseInt(row.acw) || 0,
            aht: parseInt(row.aht) || 0,
            ics_result: (row.ics_result && row.ics_result !== 'null') ? parseFloat(row.ics_result) : null,
            manager_id: parseInt(row.manager_id) || 0,
            manager_name: row.manager_name || 'Без группы',
            workingHoursToday: calculateWorkingHours(row.first_call_today, row.last_call_today),
            performance: calculateEmployeePerformance(parseInt(row.received), parseInt(row.aht), row.ics_result),
            lineStats: {
                hotline: parseInt(row.hotline_calls) || 0,
                secondLine: parseInt(row.second_line_calls) || 0,
                salesLine: parseInt(row.sales_line_calls) || 0
            }
        }));
        
        const summary = summaryResult.rows[0] ? {
            totalEmployees: parseInt(summaryResult.rows[0].total_employees) || 0,
            totalReceived: parseInt(summaryResult.rows[0].total_received) || 0,
            avgAcw: parseInt(summaryResult.rows[0].avg_acw) || 0,
            avgAht: parseInt(summaryResult.rows[0].avg_aht) || 0,
            activeGroupsCount: parseInt(summaryResult.rows[0].active_groups_count) || 0,
            lineStats: {
                hotline: parseInt(summaryResult.rows[0].total_hotline_calls) || 0,
                secondLine: parseInt(summaryResult.rows[0].total_second_line_calls) || 0,
                salesLine: parseInt(summaryResult.rows[0].total_sales_line_calls) || 0
            }
        } : {
            totalEmployees: 0,
            totalReceived: 0,
            avgAcw: 0,
            avgAht: 0,
            activeGroupsCount: 0,
            lineStats: { hotline: 0, secondLine: 0, salesLine: 0 }
        };
        
        return {
            success: true,
            data: employeesData,
            summary: summary,
            recordsCount: employeesData.length,
            timestamp: getCurrentMoscowTime(),
            executionTime: `${Date.now() - start}ms`,
            user: 'Kondakov_AV',
            meta: {
                dateFilter: 'today',
                supportedLines: ACTIVE_LINES,
                topPerformer: employeesData[0] || null,
                averageCallsPerEmployee: employeesData.length > 0 ? 
                    Math.round(summary.totalReceived / employeesData.length) : 0,
                performanceDistribution: getPerformanceDistribution(employeesData),
                lineDistribution: {
                    hotline: summary.lineStats.hotline,
                    secondLine: summary.lineStats.secondLine,
                    salesLine: summary.lineStats.salesLine,
                    total: summary.lineStats.hotline + summary.lineStats.secondLine + summary.lineStats.salesLine
                }
            }
        };
        
    } finally {
        if (client) {
            try {
                client.release();
                console.log(`[INFO] ${requestId} - Соединение с БД освобождено (employees)`);
            } catch (releaseError) {
                console.error(`[ERROR] ${requestId} - Ошибка при освобождении соединения:`, releaseError);
            }
        }
    }
}

/**
 * Получение данных по тематикам
 */
async function fetchThemesData(requestId, start) {
    let client;
    
    try {
        client = await targetPool.connect();
        await client.query("SET lc_time = 'ru_RU'");
        await client.query("SET timezone = 'Europe/Moscow'");
        
        console.log(`[INFO] ${requestId} - Подключение к БД установлено для тематик`);
        
        const themesQuery = `
            SELECT 
                COALESCE(
                    NULLIF(TRIM(scd.rezultat2), ''), 
                    NULLIF(TRIM(scd.rezultat), ''), 
                    'Тематика не заполнена'
                ) as tematika, 
                COUNT(scd.sessionid)::numeric as kol_vo,
                ROUND(
                    COUNT(scd.sessionid)::numeric * 100.0 / 
                    SUM(COUNT(scd.sessionid)::numeric) OVER(), 2
                ) as percentage,
                COUNT(CASE WHEN scd.proekt = 'Горячая линия' THEN scd.sessionid END) as hotline_count,
                COUNT(CASE WHEN scd.proekt = 'Вторая линия' THEN scd.sessionid END) as second_line_count,
                COUNT(CASE WHEN scd.proekt = 'Линия продаж' THEN scd.sessionid END) as sales_line_count
            FROM 
                summary_call_detail scd 
            WHERE
                scd.call_date::timestamp without time zone >= CURRENT_DATE 
                AND scd.call_date::timestamp without time zone < CURRENT_DATE + INTERVAL '1 day'
                AND scd.final_stage = 'operator'
                AND scd.sessionid IS NOT NULL
            GROUP BY
                COALESCE(
                    NULLIF(TRIM(scd.rezultat2), ''), 
                    NULLIF(TRIM(scd.rezultat), ''), 
                    'Тематика не заполнена'
                )
            HAVING COUNT(scd.sessionid) > 0
            ORDER BY 
                COUNT(scd.sessionid)::numeric DESC
        `;
        
        const totalCallsQuery = `
            SELECT 
                COUNT(scd.sessionid)::numeric as total_calls,
                COUNT(DISTINCT scd.login) as total_operators,
                COUNT(DISTINCT 
                    COALESCE(
                        NULLIF(TRIM(scd.rezultat2), ''), 
                        NULLIF(TRIM(scd.rezultat), ''), 
                        'Тематика не заполнена'
                    )
                ) as unique_themes,
                COUNT(CASE WHEN scd.proekt = 'Горячая линия' THEN scd.sessionid END) as total_hotline_calls,
                COUNT(CASE WHEN scd.proekt = 'Вторая линия' THEN scd.sessionid END) as total_second_line_calls,
                COUNT(CASE WHEN scd.proekt = 'Линия продаж' THEN scd.sessionid END) as total_sales_line_calls
            FROM 
                summary_call_detail scd 
            WHERE
                scd.call_date::timestamp without time zone >= CURRENT_DATE 
                AND scd.call_date::timestamp without time zone < CURRENT_DATE + INTERVAL '1 day'
                AND scd.final_stage = 'operator'
                AND scd.sessionid IS NOT NULL
        `;
        
        console.log(`[INFO] ${requestId} - Выполнение SQL запросов для тематик...`);
        
        const [themesResult, totalResult] = await Promise.all([
            client.query(themesQuery),
            client.query(totalCallsQuery)
        ]);
        
        console.log(`[INFO] ${requestId} - Получено ${themesResult.rows.length} тематик`);
        
        const totalStats = totalResult.rows[0] || {};
        const totalCalls = parseInt(totalStats.total_calls) || 0;
        const totalOperators = parseInt(totalStats.total_operators) || 0;
        const uniqueThemes = parseInt(totalStats.unique_themes) || 0;
        
        const themesData = themesResult.rows.map((row, index) => {
            const kolVo = parseInt(row.kol_vo) || 0;
            const percentage = parseFloat(row.percentage) || 0;
            
            return {
                position: index + 1,
                tematika: row.tematika || 'Неизвестная тематика',
                kol_vo: kolVo,
                percentage: percentage,
                importance: getThemeImportanceLevel(percentage),
                lineStats: {
                    hotline: parseInt(row.hotline_count) || 0,
                    secondLine: parseInt(row.second_line_count) || 0,
                    salesLine: parseInt(row.sales_line_count) || 0
                }
            };
        });
        
        return {
            success: true,
            data: themesData,
            totalCalls: totalCalls,
            recordsCount: themesData.length,
            timestamp: getCurrentMoscowTime(),
            executionTime: `${Date.now() - start}ms`,
            user: 'Kondakov_AV',
            meta: {
                dateFilter: 'today',
                supportedLines: ACTIVE_LINES,
                totalOperators: totalOperators,
                uniqueThemes: uniqueThemes,
                topThemePercentage: themesData[0]?.percentage || 0,
                coveragePercentage: themesData.reduce((sum, theme) => sum + theme.percentage, 0),
                limit: 30,
                lineDistribution: {
                    hotline: parseInt(totalStats.total_hotline_calls) || 0,
                    secondLine: parseInt(totalStats.total_second_line_calls) || 0,
                    salesLine: parseInt(totalStats.total_sales_line_calls) || 0
                }
            }
        };
        
    } finally {
        if (client) {
            try {
                client.release();
                console.log(`[INFO] ${requestId} - Соединение с БД освобождено (themes)`);
            } catch (releaseError) {
                console.error(`[ERROR] ${requestId} - Ошибка при освобождении соединения:`, releaseError);
            }
        }
    }
}

// ========================
// УТИЛИТАРНЫЕ ФУНКЦИИ
// ========================

/**
 * Расчет производительности группы
 */
function calculateGroupPerformance(callsToday, employeesCount) {
    if (employeesCount === 0) return 'low';
    
    const callsPerEmployee = callsToday / employeesCount;
    
    if (callsPerEmployee >= 50) return 'high';
    if (callsPerEmployee >= 25) return 'medium';
    return 'low';
}

/**
 * Расчет производительности сотрудника
 */
function calculateEmployeePerformance(received, aht, icsResult) {
    let score = 0;
    
    // Баллы за количество звонков
    if (received >= 50) score += 3;
    else if (received >= 25) score += 2;
    else if (received >= 10) score += 1;
    
    // Баллы за AHT (меньше - лучше)
    if (aht <= 300) score += 2; // 5 минут
    else if (aht <= 600) score += 1; // 10 минут
    
    // Баллы за ICS
    if (icsResult !== null) {
        if (icsResult >= 4.5) score += 3;
        else if (icsResult >= 4.0) score += 2;
        else if (icsResult >= 3.5) score += 1;
    }
    
    if (score >= 7) return 'excellent';
    if (score >= 5) return 'good';
    if (score >= 3) return 'average';
    return 'needs_improvement';
}

/**
 * Расчет рабочих часов
 */
function calculateWorkingHours(firstCall, lastCall) {
    if (!firstCall || !lastCall) return 0;
    
    const start = new Date(firstCall);
    const end = new Date(lastCall);
    const diffMs = end - start;
    
    return Math.round(diffMs / (1000 * 60 * 60 * 100)) / 100;
}

/**
 * Определение уровня важности тематики
 */
function getThemeImportanceLevel(percentage) {
    if (percentage >= 20) return 'critical';
    if (percentage >= 10) return 'high';
    if (percentage >= 5) return 'medium';
    return 'low';
}

/**
 * Распределение производительности
 */
function getPerformanceDistribution(employeesData) {
    const distribution = {
        excellent: 0,
        good: 0,
        average: 0,
        needs_improvement: 0
    };
    
    employeesData.forEach(emp => {
        if (distribution.hasOwnProperty(emp.performance)) {
            distribution[emp.performance]++;
        }
    });
    
    return distribution;
}

/**
 * Форматирование статистики по линиям
 */
function formatLineStats(lineStats) {
    return {
        hotline: {
            name: 'Горячая линия',
            count: lineStats.hotline || 0,
            percentage: 0
        },
        secondLine: {
            name: 'Вторая линия', 
            count: lineStats.secondLine || 0,
            percentage: 0
        },
        salesLine: {
            name: 'Линия продаж',
            count: lineStats.salesLine || 0,
            percentage: 0
        }
    };
}

// ========================
// ФОНОВАЯ ОЧИСТКА КЭША
// ========================
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of queryCache.entries()) {
        if (now - value.timestamp > UNIFIED_CACHE_TTL * 2) {
            queryCache.delete(key);
        }
    }
}, UNIFIED_CACHE_TTL);

/*===============================================
    ОНЛАЙН ДАННЫЕ ПО СТРАНИЦЕ (КЦ ONLINE)
=================================================*/
router.get('/api/user/:username', async (req, res) => {
  const start = Date.now();
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ 
        error: 'Ошибка запроса', 
        message: 'Не указано имя пользователя' 
      });
    }
    
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: 'Некорректное имя пользователя',
        message: 'Имя пользователя должно содержать только буквы, цифры и символ подчеркивания, длина от 3 до 30 символов'
      });
    }
    
    const cacheKey = `user_${username}`;
    const cachedUser = queryCache.get(cacheKey);
    if (cachedUser && (Date.now() - cachedUser.timestamp < CACHE_TTL)) {
      logger.info(`Данные пользователя ${username} получены из кеша (${Date.now() - start}ms)`);
      
      const userData = {
        ...cachedUser.data,
        currentTime: getCurrentMoscowTime(),
        lastLogin: "2025-04-02 12:43:00"
      };
      
      return res.json(userData);
    }
    
    try {
      // Пытаемся получить данные из БД
      const queryText = 'SELECT id, login, full_name, email, department, role FROM "users" WHERE login = $1';
      const result = await pool.query(queryText, [username]);
      
      if (result.rows.length > 0) {
        const userData = {
          username: result.rows[0].login,
          full_name: result.rows[0].full_name,
          email: result.rows[0].email,
          department: result.rows[0].department,
          role: result.rows[0].role,
          lastLogin: "2025-04-02 12:43:00"
        };
        
        // Сохраняем данные в кеш
        queryCache.set(cacheKey, {
          data: userData,
          timestamp: Date.now()
        });
        
        logger.info(`Данные пользователя ${username} получены из БД (${Date.now() - start}ms)`);
        return res.json(userData);
      }
    } catch (err) {
      logger.warn('Ошибка запроса к БД при получении данных пользователя:', err);
    }
    
    // Если пользователь не найден в БД или произошла ошибка, возвращаем симулированные данные
    const mockUserData = {
      username: username,
      full_name: username,
      email: `${username}@example.com`,
      department: 'Отдел разработки',
      role: 'user',
      lastLogin: "2025-04-02 12:43:00"
    };
    
    queryCache.set(cacheKey, {
      data: mockUserData,
      timestamp: Date.now()
    });
    
    logger.info(`Данные пользователя ${username} (мок) получены (${Date.now() - start}ms)`);
    res.json(mockUserData);
  } catch (err) {
    logger.error(`Ошибка получения данных пользователя`, err);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Внутренняя ошибка при получении данных пользователя'
    });
  }
});


/*===============================================
    ОНЛАЙН ДАННЫЕ ПО СТРАНИЦЕ (КЦ ONLINE)
=================================================*/
router.get('/api/call-center/stats', async (req, res) => {
    const start = Date.now();
    const requestId = `cc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let client;
    
    try {
        // Получаем текущую дату и время для корректного сравнения периодов
        const today = new Date();
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const currentSecond = today.getSeconds();
        const formattedToday = today.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Форматируем время для SQL запроса
        const formattedHour = String(currentHour).padStart(2, '0');
        const formattedMinute = String(currentMinute).padStart(2, '0');
        const formattedSecond = String(currentSecond).padStart(2, '0');
        const formattedTime = `${formattedHour}:${formattedMinute}:${formattedSecond}`;
        
        console.log(`[INFO] ${requestId} - Запрос данных КЦ на ${formattedToday} ${formattedTime} от Kondakov_Av`);
        
        // Проверка кэша для уменьшения нагрузки на БД - обновление каждую минуту
        const cacheKey = `cc_stats_${formattedToday}_${Math.floor(Date.now() / 120000)}`;
        const cachedData = queryCache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp < ONLINE_CACHE_TTL)) {
            console.log(`[INFO] ${requestId} - Данные получены из кэша (создан ${new Date(cachedData.timestamp).toISOString()})`);
            return res.json({
                ...cachedData.data,
                fromCache: true,
                cacheTime: new Date(cachedData.timestamp).toISOString(),
                currentTime: getCurrentMoscowTime(),
                requestId: requestId,
                user: 'Kondakov_Av'
            });
        }
        
        // Используем targetPool для работы с операционной БД
        client = await targetPool.connect();
        
        // Устанавливаем локаль для правильного форматирования месяцев
        await client.query("SET lc_time = 'ru_RU'");
        
        console.log(`[INFO] ${requestId} - Подключение к БД установлено`);
        
        // SQL запрос для получения почасовых данных за сегодня
        const hourlyDataSql = `
        SELECT 
            to_date(scd.call_date::text, 'dd.mm.yyyy') AS report_date, 
            date_part('hour', scd.enqueued_time::timestamp)::int as report_hour, 
            to_char(scd.call_date::date, 'TMMonth') as report_month, 
            date_part('year', scd.call_date::date)::numeric as report_year, 
            COUNT(scd.sessionid) as received_calls, 
            SUM(scd.aht)::numeric as chislitel_aht, 
            SUM(case when scd.final_stage = 'operator' then 1 else 0 end) as znam_aht,
            Round((SUM(scd.aht)::numeric / NULLIF(SUM(case when scd.final_stage = 'operator' then 1 else 0 end), 0)))::numeric as aht_result,
            SUM(case when scd.waittime > 20 and scd.final_stage = 'operator' then 1 else 0 end)::numeric as chis_sl,
            SUM(case when scd.final_stage = 'operator' then 1 else 0 end)::numeric as znam_sl,
            Round((1 - (SUM(case when scd.waittime > 20 and scd.final_stage = 'operator' and (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr')) then 1 else 0 end)::numeric / NULLIF(SUM(case when scd.final_stage = 'operator' and (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr')) then 1 else 0 end)::numeric, 0))) * 100, 2) as sl_result,
            SUM(case when scd.final_stage = 'queue' and scd.waittime::numeric > 7 then 1 else 0 end) as lost_more_7sek,
            SUM(case when scd.final_stage = 'queue' then 1 else 0 end) as lost,
            Round(SUM(case when scd.final_stage = 'queue' and scd.waittime::numeric > 7 then 1 else 0 end)::numeric / NULLIF(COUNT(scd.sessionid)::numeric, 0) * 100, 2) as ar_result,
            SUM(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then scd.waittime else null end) as chis_awt,
            SUM(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then 1 else null end) as znam_awt,
            Round(AVG(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then scd.waittime else null end), 0) as awt_result,
            SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then (scd.ques1::numeric + scd.ques2::numeric + scd.ques3::numeric)::numeric else 0 end) as chis_ics,
            SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end) as znam_ics,
            Round(
                CASE WHEN SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end) > 0
                THEN SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then (scd.ques1::numeric + scd.ques2::numeric + scd.ques3::numeric)::numeric else 0 end) / SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end)
                ELSE 0 END, 2)::numeric as ics_result
        FROM 
            summary_call_detail as scd
        WHERE 
            scd.call_date::timestamp without time zone >= CURRENT_DATE
            AND (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR scd.proekt = 'Линия продаж' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr'))
        GROUP BY 
            scd.call_date, date_part('hour', scd.enqueued_time::timestamp)::int
        ORDER BY 
            to_date(scd.call_date::text, 'dd.mm.yyyy') asc, date_part('hour', scd.enqueued_time::timestamp)::int ASC
        `;

        // SQL запрос для получения суммарных данных за сегодня
        const dailySummarySql = `
        SELECT 
            'Итого' as report_date,
            null as report_hour,
            null as report_month,
            null as report_year,
            COUNT(scd.sessionid) as received_calls, 
            SUM(scd.aht)::numeric as chislitel_aht, 
            SUM(case when scd.final_stage = 'operator' then 1 else 0 end) as znam_aht,
            Round((SUM(scd.aht)::numeric / NULLIF(SUM(case when scd.final_stage = 'operator' then 1 else 0 end), 0)))::numeric as aht_result,
            SUM(case when scd.waittime > 20 and scd.final_stage = 'operator' then 1 else 0 end)::numeric as chis_sl,
            SUM(case when scd.final_stage = 'operator' then 1 else 0 end)::numeric as znam_sl,
            Round((1 - (SUM(case when scd.waittime > 20 and scd.final_stage = 'operator' and (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr')) then 1 else 0 end)::numeric / NULLIF(SUM(case when scd.final_stage = 'operator' and (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr')) then 1 else 0 end)::numeric, 0))) * 100, 2) as sl_result,            
            SUM(case when scd.final_stage = 'queue' and scd.waittime::numeric > 7 then 1 else 0 end) as lost_more_7sek,
            SUM(case when scd.final_stage = 'queue' then 1 else 0 end) as lost,
            Round(SUM(case when scd.final_stage = 'queue' and scd.waittime::numeric > 7 then 1 else 0 end)::numeric / NULLIF(COUNT(scd.sessionid)::numeric, 0) * 100, 2) as ar_result,
            SUM(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then scd.waittime else null end) as chis_awt,
            SUM(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then 1 else null end) as znam_awt,
            Round(AVG(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then scd.waittime else null end)) as awt_result,
            SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then (scd.ques1::numeric + scd.ques2::numeric + scd.ques3::numeric)::numeric else 0 end) as chis_ics,
            SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end) as znam_ics,
            Round(
                CASE WHEN SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end) > 0
                THEN SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then (scd.ques1::numeric + scd.ques2::numeric + scd.ques3::numeric)::numeric else 0 end) / 
                    SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end)
                ELSE 0 END, 2)::numeric as ics_result
        FROM 
            summary_call_detail as scd
        WHERE 
            scd.call_date::timestamp without time zone >= CURRENT_DATE
            AND (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR scd.proekt = 'Линия продаж' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr'))
        `;

        // ИСПРАВЛЕНО: Запрос для данных предыдущего дня с ПОЛНЫМИ данными AHT
        const yesterdaySummarySql = `
        SELECT 
            COUNT(scd.sessionid) as received_calls,
            SUM(scd.aht)::numeric as chis_aht,
            SUM(case when scd.final_stage = 'operator' then 1 else 0 end) as znam_aht,
            Round((SUM(scd.aht)::numeric / NULLIF(SUM(case when scd.final_stage = 'operator' then 1 else 0 end), 0)))::numeric as aht_result,
            SUM(case when scd.waittime > 20 and scd.final_stage = 'operator' then 1 else 0 end)::numeric as chis_sl,
            SUM(case when scd.final_stage = 'operator' then 1 else 0 end)::numeric as znam_sl,
            Round((1 - (SUM(case when scd.waittime > 20 and scd.final_stage = 'operator' and (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr')) then 1 else 0 end)::numeric / NULLIF(SUM(case when scd.final_stage = 'operator' and (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr')) then 1 else 0 end)::numeric, 0))) * 100, 2) as sl_result,
            SUM(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then LEAST(scd.waittime, 300) else null end) as chis_awt,
            SUM(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then 1 else null end) as znam_awt,
            Round(AVG(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then LEAST(scd.waittime, 300) else null end)) as awt_result,
            SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then (scd.ques1::numeric + scd.ques2::numeric + scd.ques3::numeric)::numeric else 0 end) as chis_ics,
            SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end) as znam_ics,
            Round(
                CASE WHEN SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end) > 0
                THEN SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then (scd.ques1::numeric + scd.ques2::numeric + scd.ques3::numeric)::numeric else 0 end) / 
                    SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end)
                ELSE 0 END, 2)::numeric as ics_result
        FROM 
            summary_call_detail as scd
        WHERE 
            to_date(scd.call_date::text, 'dd.mm.yyyy') = (CURRENT_DATE - INTERVAL '1 day')
            AND (
                -- Звонки до текущего часа
                date_part('hour', scd.enqueued_time::timestamp)::int < ${currentHour}
                OR
                -- Звонки в текущем часе до текущей минуты
                (date_part('hour', scd.enqueued_time::timestamp)::int = ${currentHour} 
                 AND date_part('minute', scd.enqueued_time::timestamp)::int <= ${currentMinute})
            )
            AND (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr'))
        `;
        
        //Запрос для данных того же дня на прошлой неделе с ПОЛНЫМИ данными AHT
        const lastWeekSameDaySql = `
        SELECT 
            COUNT(scd.sessionid) as received_calls,
            SUM(scd.aht)::numeric as chis_aht,
            SUM(case when scd.final_stage = 'operator' then 1 else 0 end) as znam_aht,
            Round((SUM(scd.aht)::numeric / NULLIF(SUM(case when scd.final_stage = 'operator' then 1 else 0 end), 0)))::numeric as aht_result,
            SUM(case when scd.waittime > 20 and scd.final_stage = 'operator' then 1 else 0 end)::numeric as chis_sl,
            SUM(case when scd.final_stage = 'operator' then 1 else 0 end)::numeric as znam_sl,
            Round((1 - (SUM(case when scd.waittime > 20 and scd.final_stage = 'operator' and (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr')) then 1 else 0 end)::numeric / NULLIF(SUM(case when scd.final_stage = 'operator' and (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr')) then 1 else 0 end)::numeric, 0))) * 100, 2) as sl_result,
            SUM(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then LEAST(scd.waittime, 300) else null end) as chis_awt,
            SUM(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then 1 else null end) as znam_awt,
            Round(AVG(case when scd.final_stage = 'operator' and scd.ivrtime >= 0 then LEAST(scd.waittime, 300) else null end)) as awt_result,
            SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then (scd.ques1::numeric + scd.ques2::numeric + scd.ques3::numeric)::numeric else 0 end) as chis_ics,
            SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end) as znam_ics,
            Round(
                CASE WHEN SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end) > 0
                THEN SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then (scd.ques1::numeric + scd.ques2::numeric + scd.ques3::numeric)::numeric else 0 end) / 
                    SUM(case when scd.ques3 is not null and scd.final_stage = 'operator' and proekt = 'Горячая линия' then 3 else 0 end)
                ELSE 0 END, 2)::numeric as ics_result
        FROM 
            summary_call_detail as scd
        WHERE 
            to_date(scd.call_date::text, 'dd.mm.yyyy') = (CURRENT_DATE - INTERVAL '7 days')
            AND (
                -- Звонки до текущего часа
                date_part('hour', scd.enqueued_time::timestamp)::int < ${currentHour}
                OR
                -- Звонки в текущем часе до текущей минуты
                (date_part('hour', scd.enqueued_time::timestamp)::int = ${currentHour} 
                 AND date_part('minute', scd.enqueued_time::timestamp)::int <= ${currentMinute})
            )
            AND (scd.proekt = 'Горячая линия' OR scd.proekt = 'Служба аварийных комиссаров' OR (scd.proekt = 'Вторая линия' and scd.tipknopka = 'iz_ivr'))
        `;
        
        console.log(`[INFO] ${requestId} - SQL запросы подготовлены для периода до ${currentHour}:${currentMinute}`);
        
        // Выполняем запросы последовательно
        let hourlyResult, dailySummary, yesterdaySummary, lastWeekSummary;
        
        try {
            console.log(`[INFO] ${requestId} - Выполнение запросов...`);
            hourlyResult = await client.query(hourlyDataSql);
            dailySummary = await client.query(dailySummarySql);
            yesterdaySummary = await client.query(yesterdaySummarySql);
            lastWeekSummary = await client.query(lastWeekSameDaySql);
            
            // Детальное логирование результатов
            console.log(`[INFO] ${requestId} - Результаты запросов:`);
            console.log(`  - Почасовые данные: ${hourlyResult.rows.length} записей`);
            console.log(`  - Итоговые данные: ${dailySummary.rows.length} записей`);
            console.log(`  - Вчерашние данные: ${yesterdaySummary.rows.length} записей`);
            console.log(`  - Данные прошлой недели: ${lastWeekSummary.rows.length} записей`);
            
            // Логируем основные показатели для проверки
            if (dailySummary.rows && dailySummary.rows.length > 0) {
                const todayData = dailySummary.rows[0];
                console.log(`[DEBUG] ${requestId} - Сегодняшние итоги:`, {
                    calls: todayData.received_calls,
                    aht_result: todayData.aht_result,
                    chislitel_aht: todayData.chislitel_aht,
                    znam_aht: todayData.znam_aht,
                    sl_result: todayData.sl_result,
                    awt_result: todayData.awt_result,
                    ics_result: todayData.ics_result
                });
            }
            
            if (yesterdaySummary.rows && yesterdaySummary.rows.length > 0) {
                const yData = yesterdaySummary.rows[0];
                console.log(`[DEBUG] ${requestId} - Вчерашние данные:`, {
                    calls: yData.received_calls,
                    aht_result: yData.aht_result,
                    chis_aht: yData.chis_aht,
                    znam_aht: yData.znam_aht,
                    sl_result: yData.sl_result,
                    awt_result: yData.awt_result,
                    ics_result: yData.ics_result
                });
            }
            
            if (lastWeekSummary.rows && lastWeekSummary.rows.length > 0) {
                const lwData = lastWeekSummary.rows[0];
                console.log(`[DEBUG] ${requestId} - Данные за прошлую неделю:`, {
                    calls: lwData.received_calls,
                    aht_result: lwData.aht_result,
                    chis_aht: lwData.chis_aht,
                    znam_aht: lwData.znam_aht,
                    sl_result: lwData.sl_result,
                    awt_result: lwData.awt_result,
                    ics_result: lwData.ics_result
                });
            }
            
        } catch (sqlError) {
            console.error(`[ERROR] ${requestId} - SQL ошибка:`, sqlError);
            logger.error(`[Error] SQL error in /api/call-center/stats (${requestId}): ${sqlError.message}`);
            throw sqlError;
        }

        // ИНИЦИАЛИЗАЦИЯ ТРЕНДОВ С AHT
        const trends = {
            calls: { value: '0.00', isPositive: false },
            sl: { value: '0.00', isPositive: true },
            awt: { value: '0.00', isPositive: false }, // Для AWT меньше - лучше
            aht: { value: '0.00', isPositive: true }, // Для AHT: true = рост (плохо), false = снижение (хорошо)
            satisfaction: { value: '0.00', isPositive: true }
        };
        
        const weeklyTrends = {
            calls: { value: '0.00', isPositive: false },
            sl: { value: '0.00', isPositive: true },
            awt: { value: '0.00', isPositive: false },
            aht: { value: '0.00', isPositive: true },
            satisfaction: { value: '0.00', isPositive: true }
        };
        
        // Проверка на ночное время и выходные
        const isNightTime = currentHour < 7;
        const isWeekend = (today.getDay() === 0 || today.getDay() === 6);
        
        console.log(`[INFO] ${requestId} - Расчет ежедневных трендов...`);
        
        // УЛУЧШЕННЫЙ РАСЧЕТ ЕЖЕДНЕВНЫХ ТРЕНДОВ
        if (yesterdaySummary.rows && yesterdaySummary.rows.length > 0 && 
            dailySummary.rows && dailySummary.rows.length > 0) {
            
            const currentData = dailySummary.rows[0];
            const prevData = yesterdaySummary.rows[0];
            
            console.log(`[DEBUG] ${requestId} - Исходные данные для расчета трендов:`, {
                current: {
                    calls: currentData.received_calls,
                    aht_result: currentData.aht_result,
                    sl_result: currentData.sl_result,
                    awt_result: currentData.awt_result,
                    ics_result: currentData.ics_result
                },
                previous: {
                    calls: prevData.received_calls,
                    aht_result: prevData.aht_result,
                    sl_result: prevData.sl_result,
                    awt_result: prevData.awt_result,
                    ics_result: prevData.ics_result
                }
            });
            
            // Функция для безопасного расчета тренда
            const calculateTrend = (current, previous, label, maxCap = 200, nightCap = 50) => {
                if (!previous || previous <= 0) {
                    console.log(`[DEBUG] ${requestId} - ${label}: предыдущее значение отсутствует или 0`);
                    return { value: '0.00', isPositive: true };
                }
                
                const diff = ((current - previous) / previous) * 100;
                const cap = isNightTime ? nightCap : maxCap;
                const cappedDiff = Math.min(Math.abs(diff), cap);
                
                console.log(`[DEBUG] ${requestId} - ${label}: ${current} vs ${previous} = ${diff.toFixed(2)}% (ограничено до ${cappedDiff.toFixed(2)}%)`);
                
                return {
                    value: cappedDiff.toFixed(2),
                    isPositive: diff > 0
                };
            };
            
            // Расчет трендов для звонков
            const currentCalls = parseInt(currentData.received_calls) || 0;
            const prevCalls = parseInt(prevData.received_calls) || 0;
            trends.calls = calculateTrend(currentCalls, prevCalls, 'Звонки');
            
            // Расчет трендов для SL
            const currentSL = parseFloat(currentData.sl_result) || 0;
            const prevSL = parseFloat(prevData.sl_result) || 0;
            trends.sl = calculateTrend(currentSL, prevSL, 'SL');
            
            // Расчет трендов для AWT
            const currentAWT = parseInt(currentData.awt_result) || 0;
            const prevAWT = parseInt(prevData.awt_result) || 0;
            const awtTrend = calculateTrend(currentAWT, prevAWT, 'AWT', 10000, 40);
            trends.awt = {
                value: awtTrend.value,
                isPositive: !awtTrend.isPositive // Инвертируем для AWT
            };
            
            // НОВЫЙ: Расчет трендов для AHT (БЕЗ инвертирования)
            const currentAHT = parseInt(currentData.aht_result) || 0;
            const prevAHT = parseInt(prevData.aht_result) || 0;
            trends.aht = calculateTrend(currentAHT, prevAHT, 'AHT', 200, 40);
            // НЕ инвертируем: isPositive = true означает рост AHT (плохо для фронтенда)
            
            // Расчет трендов для ICS
            const currentICS = parseFloat(currentData.ics_result) || 0;
            const prevICS = parseFloat(prevData.ics_result) || 0;
            trends.satisfaction = calculateTrend(currentICS, prevICS, 'ICS', 20, 15);
            
            console.log(`[INFO] ${requestId} - Ежедневные тренды рассчитаны:`, trends);
        } else {
            console.log(`[WARN] ${requestId} - Недостаточно данных для расчета ежедневных трендов`);
        }
        
        console.log(`[INFO] ${requestId} - Расчет еженедельных трендов...`);
        
        // УЛУЧШЕННЫЙ РАСЧЕТ ЕЖЕНЕДЕЛЬНЫХ ТРЕНДОВ
        if (lastWeekSummary.rows && lastWeekSummary.rows.length > 0 && 
            dailySummary.rows && dailySummary.rows.length > 0) {
            
            const currentData = dailySummary.rows[0];
            const weekData = lastWeekSummary.rows[0];
            
            // Функция для безопасного расчета недельного тренда
            const calculateWeeklyTrend = (current, week, label, maxCap = 500, weekendCap = 70) => {
                if (!week || week <= 0) {
                    console.log(`[DEBUG] ${requestId} - ${label} (недельный): недельное значение отсутствует или 0`);
                    return { value: '0.00', isPositive: true };
                }
                
                const diff = ((current - week) / week) * 100;
                const cap = isWeekend ? weekendCap : maxCap;
                const cappedDiff = Math.min(Math.abs(diff), cap);
                
                console.log(`[DEBUG] ${requestId} - ${label} (недельный): ${current} vs ${week} = ${diff.toFixed(2)}% (ограничено до ${cappedDiff.toFixed(2)}%)`);
                
                return {
                    value: cappedDiff.toFixed(2),
                    isPositive: diff > 0
                };
            };
            
            // Еженедельные тренды для звонков
            const currentCalls = parseInt(currentData.received_calls) || 0;
            const weekCalls = parseInt(weekData.received_calls) || 0;
            weeklyTrends.calls = calculateWeeklyTrend(currentCalls, weekCalls, 'Звонки');
            
            // Еженедельные тренды для SL
            const currentSL = parseFloat(currentData.sl_result) || 0;
            const weekSL = parseFloat(weekData.sl_result) || 0;
            weeklyTrends.sl = calculateWeeklyTrend(currentSL, weekSL, 'SL');
            
            // Еженедельные тренды для AWT
            const currentAWT = parseInt(currentData.awt_result) || 0;
            const weekAWT = parseInt(weekData.awt_result) || 0;
            const awtWeeklyTrend = calculateWeeklyTrend(currentAWT, weekAWT, 'AWT', 1500, 60);
            weeklyTrends.awt = {
                value: awtWeeklyTrend.value,
                isPositive: !awtWeeklyTrend.isPositive // Инвертируем для AWT
            };
            
            // НОВЫЙ: Еженедельные тренды для AHT (БЕЗ инвертирования)
            const currentAHT = parseInt(currentData.aht_result) || 0;
            const weekAHT = parseInt(weekData.aht_result) || 0;
            weeklyTrends.aht = calculateWeeklyTrend(currentAHT, weekAHT, 'AHT', 500, 60);
            // НЕ инвертируем: isPositive = true означает рост AHT (плохо для фронтенда)
            
            // Еженедельные тренды для ICS
            const currentICS = parseFloat(currentData.ics_result) || 0;
            const weekICS = parseFloat(weekData.ics_result) || 0;
            weeklyTrends.satisfaction = calculateWeeklyTrend(currentICS, weekICS, 'ICS', 25, 20);
            
            console.log(`[INFO] ${requestId} - Еженедельные тренды рассчитаны:`, weeklyTrends);
        } else {
            console.log(`[WARN] ${requestId} - Недостаточно данных для расчета еженедельных трендов`);
        }
        
        console.log(`[INFO] ${requestId} - Подготовка данных для ответа...`);
        
        // УЛУЧШЕННАЯ АДАПТАЦИЯ ПОЧАСОВЫХ ДАННЫХ
        const adaptedHourlyData = hourlyResult.rows.map(row => {
            const adaptedRow = {
                ...row,
                // Приводим все поля к нужным типам
                numeric_hour: parseInt(row.report_hour) || 0,
                report_hour: row.report_hour ? 
                    `с ${String(row.report_hour).padStart(2, '0')}:00 по ${String((parseInt(row.report_hour) + 1) % 24).padStart(2, '0')}:00` : null,
                received_calls: parseInt(row.received_calls) || 0,
                chislitel_aht: parseFloat(row.chislitel_aht) || 0,
                znam_aht: parseInt(row.znam_aht) || 0,
                aht_result: parseInt(row.aht_result) || 0,
                chis_sl: parseInt(row.chis_sl) || 0,
                znam_sl: parseInt(row.znam_sl) || 0,
                sl_result: parseFloat(row.sl_result) || 0,
                lost_more_7sek: parseInt(row.lost_more_7sek) || 0,
                lost: parseInt(row.lost) || 0,
                ar_result: parseFloat(row.ar_result) || 0,
                chis_awt: parseInt(row.chis_awt) || 0,
                znam_awt: parseInt(row.znam_awt) || 0,
                awt_result: parseInt(row.awt_result) || 0,
                chis_ics: parseInt(row.chis_ics) || 0,
                znam_ics: parseInt(row.znam_ics) || 0,
                ics_result: parseFloat(row.ics_result) || 0
            };
            return adaptedRow;
        });

        // УЛУЧШЕННАЯ ПОДГОТОВКА ИТОГОВЫХ ДАННЫХ С AHT
        const summary = dailySummary.rows && dailySummary.rows.length > 0 ? 
            {
                received_calls: parseInt(dailySummary.rows[0].received_calls) || 0,
                lost: parseInt(dailySummary.rows[0].lost) || 0,
                chis_sl: parseInt(dailySummary.rows[0].chis_sl) || 0,
                znam_sl: parseInt(dailySummary.rows[0].znam_sl) || 0,
                sl_result: parseFloat(dailySummary.rows[0].sl_result) || 0,
                chis_awt: parseInt(dailySummary.rows[0].chis_awt) || 0,
                znam_awt: parseInt(dailySummary.rows[0].znam_awt) || 0,
                awt_result: parseInt(dailySummary.rows[0].awt_result) || 0,
                // ИСПРАВЛЕНО: Правильные поля AHT в summary
                chislitel_aht: parseFloat(dailySummary.rows[0].chislitel_aht) || 0,
                znam_aht: parseInt(dailySummary.rows[0].znam_aht) || 0,
                aht_result: parseInt(dailySummary.rows[0].aht_result) || 0,
                chis_ics: parseInt(dailySummary.rows[0].chis_ics) || 0,
                znam_ics: parseInt(dailySummary.rows[0].znam_ics) || 0,
                ics_result: parseFloat(dailySummary.rows[0].ics_result) || 0
            } : 
            {
                received_calls: 0, lost: 0,
                chis_sl: 0, znam_sl: 0, sl_result: 0,
                chis_awt: 0, znam_awt: 0, awt_result: 0,
                chislitel_aht: 0, znam_aht: 0, aht_result: 0,
                chis_ics: 0, znam_ics: 0, ics_result: 0
            };

        console.log(`[DEBUG] ${requestId} - Итоговые данные summary подготовлены:`, summary);
            
        // УЛУЧШЕННАЯ ПОДГОТОВКА ДАННЫХ ЗА ВЧЕРАШНИЙ ДЕНЬ С AHT
        let yesterdayData = null;
        if (yesterdaySummary.rows && yesterdaySummary.rows.length > 0) {
            const ydayData = yesterdaySummary.rows[0];
            
            yesterdayData = {
                received_calls: parseInt(ydayData.received_calls) || 0,
                chis_sl: parseInt(ydayData.chis_sl) || 0,
                znam_sl: parseInt(ydayData.znam_sl) || 0,
                sl_value: parseFloat(ydayData.sl_result) || 0,
                chis_awt: parseInt(ydayData.chis_awt) || 0,
                znam_awt: parseInt(ydayData.znam_awt) || 0,
                awt_value: parseInt(ydayData.awt_result) || 0,
                // ИСПРАВЛЕНО: Правильные поля AHT для вчерашних данных
                chis_aht: parseFloat(ydayData.chis_aht) || 0,
                znam_aht: parseInt(ydayData.znam_aht) || 0,
                aht_value: parseInt(ydayData.aht_result) || 0,
                chis_ics: parseInt(ydayData.chis_ics) || 0,
                znam_ics: parseInt(ydayData.znam_ics) || 0,
                ics_value: parseFloat(ydayData.ics_result) || 0
            };
            
            console.log(`[DEBUG] ${requestId} - Вчерашние данные подготовлены:`, yesterdayData);
        } else {
            console.log(`[WARN] ${requestId} - Нет данных за вчерашний день`);
        }
            
        // УЛУЧШЕННАЯ ПОДГОТОВКА ДАННЫХ ЗА ПРОШЛУЮ НЕДЕЛЮ С AHT
        let previousWeekData = null;
        if (lastWeekSummary.rows && lastWeekSummary.rows.length > 0) {
            const weekData = lastWeekSummary.rows[0];
                
            previousWeekData = {
                received_calls: parseInt(weekData.received_calls) || 0,
                chis_sl: parseInt(weekData.chis_sl) || 0,
                znam_sl: parseInt(weekData.znam_sl) || 0,
                sl_value: parseFloat(weekData.sl_result) || 0,
                chis_awt: parseInt(weekData.chis_awt) || 0,
                znam_awt: parseInt(weekData.znam_awt) || 0,
                awt_value: parseInt(weekData.awt_result) || 0,
                // ИСПРАВЛЕНО: Правильные поля AHT для данных прошлой недели
                chis_aht: parseFloat(weekData.chis_aht) || 0,
                znam_aht: parseInt(weekData.znam_aht) || 0,
                aht_value: parseInt(weekData.aht_result) || 0,
                chis_ics: parseInt(weekData.chis_ics) || 0,
                znam_ics: parseInt(weekData.znam_ics) || 0,
                ics_value: parseFloat(weekData.ics_result) || 0
            };
            
            console.log(`[DEBUG] ${requestId} - Данные за прошлую неделю подготовлены:`, previousWeekData);
        } else {
            console.log(`[WARN] ${requestId} - Нет данных за прошлую неделю`);
        }
        
        console.log(`[INFO] ${requestId} - Формирование итогового ответа...`);
        
        // Формируем итоговый ответ со всеми данными
        const responseData = {
            success: true,
            data: adaptedHourlyData,
            timestamp: getCurrentMoscowTime(),
            executionTime: `${Date.now() - start}ms`,
            periodType: 'hour',
            selectedMonths: [],
            selectedHours: [],
            dateRange: {
                startDate: formattedToday,
                endDate: formattedToday,
                formattedRange: `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`
            },
            trends: trends,                   // Ежедневные тренды
            weeklyTrends: weeklyTrends,       // Еженедельные тренды
            summary: summary,                 // Итоговые данные за сегодня
            previousWeekData: previousWeekData, // Данные за тот же день недели назад
            yesterdayData: yesterdayData,     // Данные за вчерашний день
            requestId: requestId,             // ID запроса для отладки
            user: 'Kondakov_Av'               // Пользователь
        };
        
        // Логируем финальную структуру ответа
        console.log(`[DEBUG] ${requestId} - Структура итогового ответа:`, {
            success: responseData.success,
            dataLength: responseData.data.length,
            hasSummary: !!responseData.summary,
            hasTrends: !!responseData.trends,
            hasWeeklyTrends: !!responseData.weeklyTrends,
            hasYesterdayData: !!responseData.yesterdayData,
            hasPreviousWeekData: !!responseData.previousWeekData,
            executionTime: responseData.executionTime
        });
        
        // Сохраняем в кэш
        queryCache.set(cacheKey, {
            data: responseData,
            timestamp: Date.now()
        });
        
        console.log(`[INFO] ${requestId} - Данные сохранены в кэш с ключом: ${cacheKey}`);
        console.log(`[INFO] ${requestId} - Запрос успешно обработан за ${Date.now() - start}ms`);
        
        // Отправка ответа
        res.json(addNotification(responseData, 'Данные успешно загружены', 'success'));
        
    } catch (error) {
        // Улучшенная обработка ошибок
        console.error(`[ERROR] ${requestId} - Критическая ошибка:`, {
            message: error.message,
            stack: error.stack,
            user: 'Kondakov_Av',
            timestamp: new Date().toISOString()
        });
        
        logger.error(`[Error] Критическая ошибка в /api/call-center/stats (${requestId}): ${error.message}`, {
            error: error,
            user: 'Kondakov_Av',
            requestId: requestId
        });
           
        const errorResponse = {
            success: false,
            message: 'Ошибка получения данных контактного центра',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Внутренняя ошибка сервера',
            timestamp: getCurrentMoscowTime(),
            requestId: requestId,
            user: 'Kondakov_Av'
        };
        
        res.status(500).json(addNotification(errorResponse, 'Не удалось загрузить данные контактного центра', 'error'));
    } finally {
        // Гарантированное освобождение ресурсов
        if (client) {
            try {
                client.release();
                console.log(`[INFO] ${requestId} - Соединение с БД освобождено`);
            } catch (releaseError) {
                console.error(`[ERROR] ${requestId} - Ошибка при освобождении соединения:`, releaseError);
            }
        }
    }
});

/*===============================================
           ОТЧЕТНОСТЬ КЦ (ЗВОНКИ)
=================================================*/
router.get('/api/table-data', async (req, res) => {
    const start = Date.now();
    let client;
    
    try {
        // Получение параметров запроса
        let { startDate, endDate, periodType, months, year, years, hours, isDetailed, monthsData, groupBy, aggregateData } = req.query;
        
        // Преобразование типов данных
        isDetailed = isDetailed === 'true' || isDetailed === 'detailed';
        
        console.log(`[API] Запрос данных: ${periodType}, ${isDetailed ? 'детально' : 'суммарно'}`);
        console.log(`[API] Исходные параметры:`, { startDate, endDate, months, year, years, hours, monthsData });
        
        // Обработка параметров в зависимости от типа периода
        let processedParams = {};
        
        switch (periodType) {
            case 'month':
                processedParams = processMonthParams(months, year, monthsData);
                break;
            case 'year':
                processedParams = processYearParams(years);
                break;
            case 'hour':
                processedParams = processHourParams(req.query);
                break;
            case 'custom':
                processedParams = processCustomParams(startDate, endDate, groupBy, aggregateData);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: `Неподдерживаемый тип периода: ${periodType}`
                });
        }
        
        console.log(`[API] Обработанные параметры:`, processedParams);
        
        // Валидация параметров
        const validationError = validateParams(periodType, processedParams);
        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }
        
        // Подключение к базе данных
        client = await pool.connect();
        
        // Проверка наличия данных
        const dataCount = await checkDataExists(client, periodType, processedParams);
        console.log(`[DB] Найдено записей: ${dataCount}`);
        
        if (dataCount === 0) {
            return res.json({
                success: true,
                data: [],
                message: 'Данные за выбранный период отсутствуют',
                periodType,
                isDetailed,
                timestamp: new Date().toISOString()
            });
        }
        
        // Генерация и выполнение SQL запроса
        const [sqlQuery, params] = generateSQLQuery(periodType, processedParams, isDetailed);
        
        console.log(`[DB] Выполнение SQL запроса для ${periodType}`);
        console.log(`[DB] SQL:`, sqlQuery.substring(0, 200) + '...');
        console.log(`[DB] Параметры:`, params);
        
        const result = await client.query(sqlQuery, params);
        
        // Обработка результатов
        const processedData = processQueryResults(result.rows, isDetailed);
        
        // Отправка данных клиенту
        res.json({
            success: true,
            data: processedData,
            executionTime: `${Date.now() - start}ms`,
            timestamp: new Date().toISOString(),
            periodType,
            isDetailed,
            rowCount: processedData.length
        });
        
        console.log(`[API] Запрос обработан за ${Date.now() - start}ms, строк: ${processedData.length}`);
        
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        console.error(error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении данных',
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * Обрабатывает параметры для месячного периода
 */
function processMonthParams(months, year, monthsData) {
    let monthYearPairs = [];
    
    // Сначала пытаемся обработать monthsData (приоритет)
    if (monthsData) {
        try {
            const parsedData = JSON.parse(monthsData);
            if (Array.isArray(parsedData) && parsedData.length > 0) {
                monthYearPairs = parsedData.map(item => ({
                    month: parseInt(item.month),
                    year: parseInt(item.year)
                }));
                console.log(`[API] Использованы данные из monthsData:`, monthYearPairs);
                return { monthYearPairs };
            }
        } catch (e) {
            console.error(`[ERROR] Ошибка парсинга monthsData: ${e.message}`);
        }
    }
    
    // Fallback на старый формат
    if (months && year) {
        const monthsArray = Array.isArray(months) 
            ? months.map(Number) 
            : months.split(',').map(Number);
        
        const yearValue = parseInt(year);
        
        monthYearPairs = monthsArray.map(month => ({
            month: month,
            year: yearValue
        }));
        
        console.log(`[API] Использован старый формат месяцев:`, monthYearPairs);
    }
    
    return { monthYearPairs };
}

/**
 * Обрабатывает параметры для годового периода
 */
function processYearParams(years) {
    let selectedYears = [];
    
    if (years) {
        selectedYears = Array.isArray(years)
            ? years.map(Number)
            : years.split(',').map(Number);
    }
    
    return { selectedYears };
}

/**
 * Обрабатывает параметры для часового периода
 */
function processHourParams(queryParams) {
    const { startDate, endDate, hours, startDateTime, endDateTime, crossMidnight } = queryParams;
    
    let selectedHours = [];
    if (hours) {
        selectedHours = Array.isArray(hours) 
            ? hours.map(Number) 
            : hours.split(',').map(Number);
    }
    
    // Логируем входные параметры
    console.log(`[API] Обработка часовых параметров:`, {
        startDate, 
        endDate, 
        selectedHours, 
        startDateTime, 
        endDateTime, 
        crossMidnight
    });
    
    // Определяем пересечение полуночи
    const crossesMidnight = crossMidnight === 'true' || startDate !== endDate;
    
    return {
        startDate,
        endDate,
        selectedHours,
        startDateTime,
        endDateTime,
        crossMidnight: crossesMidnight
    };
}

/**
 * Обрабатывает параметры для произвольного периода
 */
function processCustomParams(startDate, endDate, groupBy, aggregateData) {
    return {
        startDate,
        endDate,
        groupBy: groupBy || 'none',
        aggregateData: aggregateData === 'true'
    };
}

/**
 * Валидирует параметры запроса
 */
function validateParams(periodType, params) {
    switch (periodType) {
        case 'month':
            if (!params.monthYearPairs || params.monthYearPairs.length === 0) {
                return 'Для месячного периода нужно указать месяцы и годы';
            }
            
            // Проверяем корректность значений
            const invalidMonths = params.monthYearPairs.filter(pair => 
                isNaN(pair.month) || pair.month < 1 || pair.month > 12 ||
                isNaN(pair.year) || pair.year < 1970 || pair.year > 2100
            );
            
            if (invalidMonths.length > 0) {
                return 'Некорректные значения месяцев или годов';
            }
            break;
            
        case 'year':
            if (!params.selectedYears || params.selectedYears.length === 0) {
                return 'Для годового периода нужно указать годы';
            }
            
            const invalidYears = params.selectedYears.filter(year => 
                isNaN(year) || year < 1970 || year > 2100
            );
            
            if (invalidYears.length > 0) {
                return 'Некорректные значения годов';
            }
            break;
            
        case 'custom':
            if (!params.startDate || !params.endDate) {
                return 'Необходимо указать начальную и конечную дату для произвольного периода';
            }
            break;
            
        case 'hour':
            if (!params.startDate || !params.endDate) {
                return 'Необходимо указать даты для часового периода';
            }
            break;
    }
    
    return null; // Нет ошибок
}

/**
 * Проверяет наличие данных в базе
 */
async function checkDataExists(client, periodType, params) {
    let sql, queryParams;
    
    switch (periodType) {
        case 'month':
            if (!params.monthYearPairs || params.monthYearPairs.length === 0) {
                return 0;
            }
            
            const monthConditions = params.monthYearPairs.map((pair, index) => {
                const paramOffset = index * 2 + 1;
                return `(EXTRACT(YEAR FROM report_date) = $${paramOffset}::int AND EXTRACT(MONTH FROM report_date) = $${paramOffset + 1}::int)`;
            }).join(' OR ');
            
            sql = `SELECT COUNT(*) FROM call_statistics WHERE ${monthConditions}`;
            queryParams = [];
            params.monthYearPairs.forEach(pair => {
                queryParams.push(pair.year, pair.month);
            });
            break;
            
        case 'year':
            sql = `SELECT COUNT(*) FROM call_statistics WHERE EXTRACT(YEAR FROM report_date) = ANY($1::int[])`;
            queryParams = [params.selectedYears];
            break;
            
        case 'custom':
            sql = `SELECT COUNT(*) FROM call_statistics WHERE report_date BETWEEN $1::date AND $2::date`;
            queryParams = [params.startDate, params.endDate];
            break;
            
        case 'hour':
            const { startDate, endDate, selectedHours, startDateTime, endDateTime, crossMidnight } = params;
            
            let hourCondition = '';
            let checkParams = [startDate, endDate];
            
            if (startDateTime && endDateTime) {
                const startDT = new Date(startDateTime);
                const endDT = new Date(endDateTime);
                const startHour = startDT.getHours();
                const endHour = endDT.getHours();
                
                if (crossMidnight) {
                    hourCondition = `
                        AND (
                            (report_date = $1::date AND report_hour >= $3)
                            OR 
                            (report_date = $2::date AND report_hour <= $4)
                        )
                    `;
                    checkParams = [startDate, endDate, startHour, endHour];
                } else {
                    hourCondition = `
                        AND report_date = $1::date
                        AND report_hour >= $3 
                        AND report_hour <= $4
                    `;
                    checkParams = [startDate, endDate, startHour, endHour];
                }
            } else if (selectedHours && selectedHours.length > 0) {
                if (crossMidnight) {
                    const startHour = Math.min(...selectedHours);
                    const endHour = Math.max(...selectedHours);
                    
                    hourCondition = `
                        AND (
                            (report_date = $1::date AND report_hour >= $3)
                            OR 
                            (report_date = $2::date AND report_hour <= $4)
                        )
                    `;
                    checkParams = [startDate, endDate, startHour, endHour];
                } else {
                    hourCondition = `AND report_date = $1::date AND report_hour = ANY($3::int[])`;
                    checkParams = [startDate, endDate, selectedHours];
                }
            }
            
            sql = `SELECT COUNT(*) FROM call_statistics WHERE report_date BETWEEN $1::date AND $2::date ${hourCondition}`;
            queryParams = checkParams;
            break;
            
        default:
            return 0;
    }
    
    const result = await client.query(sql, queryParams);
    return parseInt(result.rows[0].count);
}

/**
 * Генерирует SQL запрос в зависимости от типа периода
 */
function generateSQLQuery(periodType, params, isDetailed) {
    switch (periodType) {
        case 'month':
            return generateMonthQuery(params.monthYearPairs, isDetailed);
        case 'year':
            return generateYearQuery(params.selectedYears, isDetailed);
        case 'hour':
            return generateHourQuery(params, isDetailed);
        case 'custom':
            return generateCustomQuery(params, isDetailed);
        default:
            throw new Error(`Неподдерживаемый тип периода: ${periodType}`);
    }
}

/**
 * Генерирует SQL запрос для месячного периода
 */
function generateMonthQuery(monthYearPairs, isDetailed) {
    if (!monthYearPairs || monthYearPairs.length === 0) {
        throw new Error('Не указаны месяцы для запроса');
    }
    
    if (isDetailed) {
        // Детальные данные - каждый месяц отдельно + общий итог
        const monthSelects = monthYearPairs.map((pair, index) => {
            const yearParam = index * 2 + 1;
            const monthParam = index * 2 + 2;
            
            return `
            SELECT 
                to_char(make_date($${yearParam}::int, $${monthParam}::int, 1), 'TMMonth YYYY') AS report_date,
                to_char(make_date($${yearParam}::int, $${monthParam}::int, 1), 'TMMonth') AS report_month,
                $${yearParam}::int AS report_year,
                NULL AS numeric_hour,
                NULL AS report_hour,
                COALESCE(SUM(received_calls), 0) AS received_calls,
                ROUND(COALESCE((1 - SUM(chis_SL)::numeric / NULLIF(SUM(znam_sl)::numeric, 0)) * 100, 0))::integer AS sl_result,
                ROUND(COALESCE(SUM(chis_AWT)::numeric / NULLIF(SUM(znam_AWT)::numeric, 0), 0))::integer AS awt_result,
                ROUND(COALESCE(SUM(chislitel_aht)::numeric / NULLIF(SUM(znam_aht)::numeric, 0), 0))::integer AS aht_result,
                ROUND(COALESCE(SUM(chis_ICS)::numeric / NULLIF(SUM(znam_ICS)::numeric, 0), 0), 2)::numeric AS ics_result,
                FALSE AS is_total,
                make_date($${yearParam}::int, $${monthParam}::int, 1) AS sort_date
            FROM 
                call_statistics
            WHERE 
                EXTRACT(YEAR FROM report_date) = $${yearParam}::int
                AND EXTRACT(MONTH FROM report_date) = $${monthParam}::int
            `;
        });
        
        // Общий итог
        const totalConditions = monthYearPairs.map((pair, index) => {
            const yearParam = index * 2 + 1;
            const monthParam = index * 2 + 2;
            return `(EXTRACT(YEAR FROM report_date) = $${yearParam}::int AND EXTRACT(MONTH FROM report_date) = $${monthParam}::int)`;
        }).join(' OR ');
        
        const sql = `
        WITH all_data AS (
            ${monthSelects.join(' UNION ALL ')}
            
            UNION ALL
            
            SELECT 
                'Итого' AS report_date,
                NULL AS report_month,
                NULL AS report_year,
                NULL AS numeric_hour,
                NULL AS report_hour,
                COALESCE(SUM(received_calls), 0) AS received_calls,
                ROUND(COALESCE((1 - SUM(chis_SL)::numeric / NULLIF(SUM(znam_sl)::numeric, 0)) * 100, 0))::integer AS sl_result,
                ROUND(COALESCE(SUM(chis_AWT)::numeric / NULLIF(SUM(znam_AWT)::numeric, 0), 0))::integer AS awt_result,
                ROUND(COALESCE(SUM(chislitel_aht)::numeric / NULLIF(SUM(znam_aht)::numeric, 0), 0))::integer AS aht_result,
                ROUND(COALESCE(SUM(chis_ICS)::numeric / NULLIF(SUM(znam_ICS)::numeric, 0), 0), 2)::numeric AS ics_result,
                TRUE AS is_total,
                NULL AS sort_date
            FROM 
                call_statistics
            WHERE 
                ${totalConditions}
        )
        SELECT 
            report_date,
            report_month,
            report_year,
            numeric_hour,
            report_hour,
            received_calls,
            sl_result,
            awt_result,
            aht_result,
            ics_result
        FROM 
            all_data
        ORDER BY 
            is_total,
            sort_date
        `;
        
        const params = [];
        monthYearPairs.forEach(pair => {
            params.push(pair.year, pair.month);
        });
        
        return [sql, params];
        
    } else {
        // Суммарные данные - одна строка за все выбранные месяцы
        const conditions = monthYearPairs.map((pair, index) => {
            const yearParam = index * 2 + 1;
            const monthParam = index * 2 + 2;
            return `(EXTRACT(YEAR FROM report_date) = $${yearParam}::int AND EXTRACT(MONTH FROM report_date) = $${monthParam}::int)`;
        }).join(' OR ');
        
        // Формируем красивое название периода
        let periodName;
        if (monthYearPairs.length === 1) {
            const pair = monthYearPairs[0];
            periodName = `to_char(make_date(${pair.year}, ${pair.month}, 1), 'TMMonth YYYY')`;
        } else {
            // Группируем по годам
            const yearGroups = {};
            monthYearPairs.forEach(pair => {
                if (!yearGroups[pair.year]) {
                    yearGroups[pair.year] = [];
                }
                yearGroups[pair.year].push(pair.month);
            });
            
            if (Object.keys(yearGroups).length === 1) {
                const year = Object.keys(yearGroups)[0];
                const months = yearGroups[year].sort((a, b) => a - b);
                if (months.length === 12) {
                    periodName = `'Весь ${year} год'`;
                } else {
                    periodName = `'Выбранные месяцы ${year} года'`;
                }
            } else {
                periodName = `'Выбранные месяцы'`;
            }
        }
        
        const sql = `
        SELECT 
            ${periodName} AS report_date,
            'Период' AS report_month,
            NULL AS report_year,
            NULL AS numeric_hour,
            NULL AS report_hour,
            COALESCE(SUM(received_calls), 0) AS received_calls,
            ROUND(COALESCE((1 - SUM(chis_SL)::numeric / NULLIF(SUM(znam_sl)::numeric, 0)) * 100, 0))::integer AS sl_result,
            ROUND(COALESCE(SUM(chis_AWT)::numeric / NULLIF(SUM(znam_AWT)::numeric, 0), 0))::integer AS awt_result,
            ROUND(COALESCE(SUM(chislitel_aht)::numeric / NULLIF(SUM(znam_aht)::numeric, 0), 0))::integer AS aht_result,
            ROUND(COALESCE(SUM(chis_ICS)::numeric / NULLIF(SUM(znam_ICS)::numeric, 0), 0), 2)::numeric AS ics_result
        FROM 
            call_statistics
        WHERE 
            ${conditions}
        `;
        
        const params = [];
        monthYearPairs.forEach(pair => {
            params.push(pair.year, pair.month);
        });
        
        return [sql, params];
    }
}

/**
 * Генерирует SQL запрос для годового периода
 */
function generateYearQuery(selectedYears, isDetailed) {
    if (!selectedYears || selectedYears.length === 0) {
        throw new Error('Не указаны годы для запроса');
    }
    
    const params = [selectedYears];
    
    if (isDetailed) {
        const sql = `
        WITH yearly_data AS (
            SELECT 
                EXTRACT(YEAR FROM report_date)::int AS year_num,
                EXTRACT(MONTH FROM report_date)::int AS month_num,
                to_char(date_trunc('month', report_date), 'TMMonth') AS month_name,
                SUM(received_calls) AS received_calls,
                SUM(chis_SL) AS chis_sl,
                SUM(znam_sl) AS znam_sl,
                SUM(chis_AWT) AS chis_awt,
                SUM(znam_AWT) AS znam_awt,
                SUM(chislitel_aht) AS chislitel_aht,
                SUM(znam_aht) AS znam_aht,
                SUM(chis_ICS) AS chis_ics,
                SUM(znam_ICS) AS znam_ics
            FROM 
                call_statistics
            WHERE 
                EXTRACT(YEAR FROM report_date) = ANY($1::int[])
            GROUP BY 
                EXTRACT(YEAR FROM report_date),
                EXTRACT(MONTH FROM report_date),
                to_char(date_trunc('month', report_date), 'TMMonth')
        ),
        total_data AS (
            SELECT 
                EXTRACT(YEAR FROM report_date)::int AS year_num,
                'Итого' AS month_name,
                SUM(received_calls) AS received_calls,
                SUM(chis_SL) AS chis_sl,
                SUM(znam_sl) AS znam_sl,
                SUM(chis_AWT) AS chis_awt,
                SUM(znam_AWT) AS znam_awt,
                SUM(chislitel_aht) AS chislitel_aht,
                SUM(znam_aht) AS znam_aht,
                SUM(chis_ICS) AS chis_ics,
                SUM(znam_ICS) AS znam_ics
            FROM 
                call_statistics
            WHERE 
                EXTRACT(YEAR FROM report_date) = ANY($1::int[])
            GROUP BY 
                EXTRACT(YEAR FROM report_date)
        ),
        all_data AS (
            SELECT 
                year_num::text || ' - ' || month_name AS report_date,
                month_name AS report_month,
                year_num AS report_year,
                NULL AS numeric_hour,
                NULL AS report_hour,
                received_calls,
                ROUND(COALESCE((1 - chis_sl::numeric / NULLIF(znam_sl::numeric, 0)) * 100, 0))::integer AS sl_result,
                ROUND(COALESCE(chis_awt::numeric / NULLIF(znam_awt::numeric, 0), 0))::integer AS awt_result,
                ROUND(COALESCE(chislitel_aht::numeric / NULLIF(znam_aht::numeric, 0), 0))::integer AS aht_result,
                ROUND(COALESCE(chis_ics::numeric / NULLIF(znam_ics::numeric, 0), 0), 2)::numeric AS ics_result,
                FALSE AS is_total,
                month_num
            FROM 
                yearly_data

            UNION ALL

            SELECT 
                year_num || ' - ' || month_name AS report_date,
                NULL AS report_month,
                year_num AS report_year,
                NULL AS numeric_hour,
                NULL AS report_hour,
                received_calls,
                ROUND(COALESCE((1 - chis_sl::numeric / NULLIF(znam_sl::numeric, 0)) * 100, 0))::integer AS sl_result,
                ROUND(COALESCE(chis_awt::numeric / NULLIF(znam_awt::numeric, 0), 0))::integer AS awt_result,
                ROUND(COALESCE(chislitel_aht::numeric / NULLIF(znam_aht::numeric, 0), 0))::integer AS aht_result,
                ROUND(COALESCE(chis_ics::numeric / NULLIF(znam_ics::numeric, 0), 0), 2)::numeric AS ics_result,
                TRUE AS is_total,
                13 AS month_num
            FROM 
                total_data
        )
        SELECT 
            report_date,
            report_month,
            report_year,
            numeric_hour,
            report_hour,
            received_calls,
            sl_result,
            awt_result,
            aht_result,
            ics_result
        FROM 
            all_data
        ORDER BY 
            report_year, 
            month_num
        `;
        
        return [sql, params];
    } else {
        const sql = `
        WITH aggregated_data AS (
            SELECT 
                EXTRACT(YEAR FROM report_date)::int AS year_num,
                SUM(received_calls) AS received_calls,
                SUM(chis_SL) AS chis_sl,
                SUM(znam_sl) AS znam_sl,
                SUM(chis_AWT) AS chis_awt,
                SUM(znam_AWT) AS znam_awt,
                SUM(chislitel_aht) AS chislitel_aht,
                SUM(znam_aht) AS znam_aht,
                SUM(chis_ICS) AS chis_ics,
                SUM(znam_ICS) AS znam_ics
            FROM 
                call_statistics
            WHERE 
                EXTRACT(YEAR FROM report_date) = ANY($1::int[])
            GROUP BY 
                EXTRACT(YEAR FROM report_date)
        )
        SELECT 
            year_num::text AS report_date,
            NULL AS report_month,
            year_num AS report_year,
            NULL AS numeric_hour,
            NULL AS report_hour,
            received_calls,
            ROUND(COALESCE((1 - chis_sl::numeric / NULLIF(znam_sl::numeric, 0)) * 100, 0))::integer AS sl_result,
            ROUND(COALESCE(chis_awt::numeric / NULLIF(znam_awt::numeric, 0), 0))::integer AS awt_result,
            ROUND(COALESCE(chislitel_aht::numeric / NULLIF(znam_aht::numeric, 0), 0))::integer AS aht_result,
            ROUND(COALESCE(chis_ics::numeric / NULLIF(znam_ics::numeric, 0), 0), 2)::numeric AS ics_result
        FROM 
            aggregated_data
        ORDER BY
            year_num
        `;
        
        return [sql, params];
    }
}

/**
 * Генерирует SQL запрос для часового периода
 */
function generateHourQuery(params, isDetailed) {
    const { startDate, endDate, selectedHours, startDateTime, endDateTime, crossMidnight } = params;
    
    console.log(`[DB] Генерация часового запроса:`, {
        startDate, endDate, selectedHours, startDateTime, endDateTime, crossMidnight
    });
    
    let hourCondition = '';
    let queryParams = [startDate, endDate];
    
    // Определяем, пересекает ли период полночь
    const crossesMidnight = crossMidnight || startDate !== endDate;
    
    // Обработка точного времени с использованием startDateTime и endDateTime
    if (startDateTime && endDateTime) {
        console.log(`[DB] Точное время: ${startDateTime} - ${endDateTime}`);
        
        // Извлекаем часы из datetime для понимания диапазона
        const startDT = new Date(startDateTime);
        const endDT = new Date(endDateTime);
        const startHour = startDT.getHours();
        const endHour = endDT.getHours();
        
        console.log(`[DB] Диапазон часов: ${startHour} - ${endHour}`);
        
        if (crossesMidnight) {
            // ИСПРАВЛЕНО: Включаем ВСЕ промежуточные дни с полными 24 часами
            hourCondition = `
                AND (
                    (
                        report_date = $1::date 
                        AND report_hour >= $3
                    )
                    OR 
                    (
                        report_date > $1::date 
                        AND report_date < $2::date
                    )
                    OR 
                    (
                        report_date = $2::date 
                        AND report_hour <= $4
                    )
                )
            `;
            queryParams = [startDate, endDate, startHour, endHour];
        } else {
            // В пределах одного дня
            hourCondition = `
                AND report_date = $1::date
                AND report_hour >= $3 
                AND report_hour <= $4
            `;
            queryParams = [startDate, endDate, startHour, endHour];
        }
    }
    // Обработка конкретных часов без точного времени
    else if (selectedHours && selectedHours.length > 0) {
        if (crossesMidnight) {
            // ИСПРАВЛЕНО: Для пересечения полуночи с конкретными часами включаем промежуточные дни
            const startHour = Math.min(...selectedHours);
            const endHour = Math.max(...selectedHours);
            
            hourCondition = `
                AND (
                    (report_date = $1::date AND report_hour >= $3)
                    OR 
                    (report_date > $1::date AND report_date < $2::date)
                    OR 
                    (report_date = $2::date AND report_hour <= $4)
                )
            `;
            queryParams = [startDate, endDate, startHour, endHour];
        } else {
            // В пределах одного дня с конкретными часами
            hourCondition = `
                AND report_date = $1::date 
                AND report_hour = ANY($3::int[])
            `;
            queryParams = [startDate, endDate, selectedHours];
        }
    }
    // Без фильтра по часам
    else {
        // Просто диапазон дат - включаем ВСЕ часы для всех дней в диапазоне
        queryParams = [startDate, endDate];
    }
    
    // Остальная часть функции остается без изменений...
    
    // Формируем текст диапазона часов для отображения
    let hourRangeText;
    if (startDateTime && endDateTime) {
        const startTime = new Date(startDateTime).toTimeString().substring(0, 5);
        const endTime = new Date(endDateTime).toTimeString().substring(0, 5);
        hourRangeText = `с ${startTime} по ${endTime}`;
    } else if (selectedHours && selectedHours.length > 0) {
        const minHour = Math.min(...selectedHours);
        const maxHour = Math.max(...selectedHours);
        hourRangeText = `с ${String(minHour).padStart(2, '0')}:00 по ${String(maxHour + 1).padStart(2, '0')}:00`;
    } else {
        hourRangeText = 'весь период';
    }
    
    console.log(`[DB] Условие фильтрации часов: ${hourCondition.replace(/\s+/g, ' ')}`);
    console.log(`[DB] Параметры запроса:`, queryParams);
    
    if (isDetailed) {
        // Детальные данные по часам + итог
        const sql = `
        WITH hourly_data AS (
            SELECT 
                report_date,
                report_hour,
                to_timestamp(
                    to_char(report_date, 'YYYY-MM-DD') || ' ' || 
                    LPAD(report_hour::text, 2, '0') || ':00:00', 
                    'YYYY-MM-DD HH24:MI:SS'
                ) AS full_datetime,
                SUM(received_calls) AS received_calls,
                SUM(chis_SL) AS chis_sl,
                SUM(znam_sl) AS znam_sl,
                SUM(chis_AWT) AS chis_awt,
                SUM(znam_AWT) AS znam_awt,
                SUM(chislitel_aht) AS chislitel_aht,
                SUM(znam_aht) AS znam_aht,
                SUM(chis_ICS) AS chis_ics,
                SUM(znam_ICS) AS znam_ics
            FROM 
                call_statistics
            WHERE 
                report_date BETWEEN $1::date AND $2::date
                ${hourCondition}
            GROUP BY 
                report_date, report_hour
        ),
        total_data AS (
            SELECT 
                'Итого'::text AS report_date,
                NULL AS report_hour,
                NULL AS full_datetime,
                SUM(received_calls) AS received_calls,
                SUM(chis_SL) AS chis_sl,
                SUM(znam_sl) AS znam_sl,
                SUM(chis_AWT) AS chis_awt,
                SUM(znam_AWT) AS znam_awt,
                SUM(chislitel_aht) AS chislitel_aht,
                SUM(znam_aht) AS znam_aht,
                SUM(chis_ICS) AS chis_ics,
                SUM(znam_ICS) AS znam_ics
            FROM 
                call_statistics
            WHERE 
                report_date BETWEEN $1::date AND $2::date
                ${hourCondition}
        ),
        all_data AS (
            SELECT 
                TO_CHAR(report_date, 'DD.MM.YYYY') AS report_date,
                NULL AS report_month,
                NULL AS report_year,
                report_hour AS numeric_hour,
                'с ' || LPAD(report_hour::text, 2, '0') || ':00 по ' || 
                LPAD(((report_hour + 1) % 24)::text, 2, '0') || ':00' AS report_hour,
                received_calls,
                ROUND(COALESCE((1 - chis_sl::numeric / NULLIF(znam_sl::numeric, 0)) * 100, 0))::integer AS sl_result,
                ROUND(COALESCE(chis_awt::numeric / NULLIF(znam_awt::numeric, 0), 0))::integer AS awt_result,
                ROUND(COALESCE(chislitel_aht::numeric / NULLIF(znam_aht::numeric, 0), 0))::integer AS aht_result,
                ROUND(COALESCE(chis_ics::numeric / NULLIF(znam_ics::numeric, 0), 0), 2)::numeric AS ics_result,
                FALSE AS is_total,
                full_datetime AS sort_date
            FROM 
                hourly_data
                
            UNION ALL
            
            SELECT 
                report_date,
                NULL AS report_month,
                NULL AS report_year,
                NULL AS numeric_hour,
                NULL AS report_hour,
                received_calls,
                ROUND(COALESCE((1 - chis_sl::numeric / NULLIF(znam_sl::numeric, 0)) * 100, 0))::integer AS sl_result,
                ROUND(COALESCE(chis_awt::numeric / NULLIF(znam_awt::numeric, 0), 0))::integer AS awt_result,
                ROUND(COALESCE(chislitel_aht::numeric / NULLIF(znam_aht::numeric, 0), 0))::integer AS aht_result,
                ROUND(COALESCE(chis_ics::numeric / NULLIF(znam_ics::numeric, 0), 0), 2)::numeric AS ics_result,
                TRUE AS is_total,
                NULL AS sort_date
            FROM 
                total_data
        )
        SELECT 
            report_date,
            report_month,
            report_year,
            numeric_hour,
            report_hour,
            received_calls,
            sl_result,
            awt_result,
            aht_result,
            ics_result
        FROM 
            all_data
        ORDER BY 
            is_total,
            sort_date
        `;
        
        return [sql, queryParams];
    } else {
        // Суммарные данные по часам - одна строка за все часы
        const sql = `
        SELECT 
            TO_CHAR($1::date, 'DD.MM.YYYY') || 
            CASE WHEN $1::date <> $2::date THEN ' - ' || TO_CHAR($2::date, 'DD.MM.YYYY') ELSE '' END AS report_date,
            NULL AS report_month,
            EXTRACT(YEAR FROM $1::date)::numeric AS report_year,
            NULL AS numeric_hour,
            '${hourRangeText}' AS report_hour,
            COALESCE(SUM(received_calls), 0) AS received_calls,
            ROUND(COALESCE((1 - SUM(chis_SL)::numeric / NULLIF(SUM(znam_sl)::numeric, 0)) * 100, 0))::integer AS sl_result,
            ROUND(COALESCE(SUM(chis_AWT)::numeric / NULLIF(SUM(znam_AWT)::numeric, 0), 0))::integer AS awt_result,
            ROUND(COALESCE(SUM(chislitel_aht)::numeric / NULLIF(SUM(znam_aht)::numeric, 0), 0))::integer AS aht_result,
            ROUND(COALESCE(SUM(chis_ICS)::numeric / NULLIF(SUM(znam_ICS)::numeric, 0), 0), 2)::numeric AS ics_result
        FROM 
            call_statistics
        WHERE 
            report_date BETWEEN $1::date AND $2::date
            ${hourCondition}
        `;
        
        return [sql, queryParams];
    }
}

/**
 * Генерирует SQL запрос для произвольного периода
 */
function generateCustomQuery(params, isDetailed) {
    const { startDate, endDate, groupBy, aggregateData } = params;
    const queryParams = [startDate, endDate];
    
    if (isDetailed) {
        const sql = `
        WITH daily_data AS (
            SELECT 
                report_date,
                SUM(received_calls) AS received_calls,
                SUM(chis_SL) AS chis_sl,
                SUM(znam_sl) AS znam_sl,
                SUM(chis_AWT) AS chis_awt,
                SUM(znam_AWT) AS znam_awt,
                SUM(chislitel_aht) AS chislitel_aht,
                SUM(znam_aht) AS znam_aht,
                SUM(chis_ICS) AS chis_ics,
                SUM(znam_ICS) AS znam_ics
            FROM 
                call_statistics
            WHERE 
                report_date BETWEEN $1::date AND $2::date
            GROUP BY 
                report_date
        ),
        total_data AS (
            SELECT 
                'Итого'::text AS report_date,
                SUM(received_calls) AS received_calls,
                SUM(chis_SL) AS chis_sl,
                SUM(znam_sl) AS znam_sl,
                SUM(chis_AWT) AS chis_awt,
                SUM(znam_AWT) AS znam_awt,
                SUM(chislitel_aht) AS chislitel_aht,
                SUM(znam_aht) AS znam_aht,
                SUM(chis_ICS) AS chis_ics,
                SUM(znam_ICS) AS znam_ics
            FROM 
                call_statistics
            WHERE 
                report_date BETWEEN $1::date AND $2::date
        ),
        all_data AS (
            SELECT 
                TO_CHAR(report_date, 'DD.MM.YYYY') AS report_date,
                to_char(report_date, 'TMMonth') AS report_month,
                EXTRACT(YEAR FROM report_date)::numeric AS report_year,
                NULL AS numeric_hour,
                NULL AS report_hour,
                received_calls,
                ROUND(COALESCE((1 - chis_sl::numeric / NULLIF(znam_sl::numeric, 0)) * 100, 0))::integer AS sl_result,
                ROUND(COALESCE(chis_awt::numeric / NULLIF(znam_awt::numeric, 0), 0))::integer AS awt_result,
                ROUND(COALESCE(chislitel_aht::numeric / NULLIF(znam_aht::numeric, 0), 0))::integer AS aht_result,
                ROUND(COALESCE(chis_ics::numeric / NULLIF(znam_ics::numeric, 0), 0), 2)::numeric AS ics_result,
                FALSE AS is_total,
                report_date AS sort_date
            FROM 
                daily_data
            
            UNION ALL
            
            SELECT 
                report_date,
                NULL AS report_month,
                NULL AS report_year,
                NULL AS numeric_hour,
                NULL AS report_hour,
                received_calls,
                ROUND(COALESCE((1 - chis_sl::numeric / NULLIF(znam_sl::numeric, 0)) * 100, 0))::integer AS sl_result,
                ROUND(COALESCE(chis_awt::numeric / NULLIF(znam_awt::numeric, 0), 0))::integer AS awt_result,
                ROUND(COALESCE(chislitel_aht::numeric / NULLIF(znam_aht::numeric, 0), 0))::integer AS aht_result,
                ROUND(COALESCE(chis_ics::numeric / NULLIF(znam_ics::numeric, 0), 0), 2)::numeric AS ics_result,
                TRUE AS is_total,
                NULL AS sort_date
            FROM 
                total_data
        )
        SELECT 
            report_date,
            report_month,
            report_year,
            numeric_hour,
            report_hour,
            received_calls,
            sl_result,
            awt_result,
            aht_result,
            ics_result
        FROM 
            all_data
        ORDER BY 
            is_total,
            sort_date
        `;
        
        return [sql, queryParams];
    } else {
        const sql = `
        SELECT 
            'С ' || TO_CHAR($1::date, 'DD.MM.YYYY') || ' по ' || TO_CHAR($2::date, 'DD.MM.YYYY') AS report_date,
            'Период' AS report_month,
            EXTRACT(YEAR FROM $1::date)::numeric AS report_year,
            NULL AS numeric_hour,
            NULL AS report_hour,
            SUM(received_calls) AS received_calls,
            ROUND(COALESCE((1 - SUM(chis_SL)::numeric / NULLIF(SUM(znam_sl)::numeric, 0)) * 100, 0))::integer AS sl_result,
            ROUND(COALESCE(SUM(chis_AWT)::numeric / NULLIF(SUM(znam_AWT)::numeric, 0), 0))::integer AS awt_result,
            ROUND(COALESCE(SUM(chislitel_aht)::numeric / NULLIF(SUM(znam_aht)::numeric, 0), 0))::integer AS aht_result,
            ROUND(COALESCE(SUM(chis_ICS)::numeric / NULLIF(SUM(znam_ICS)::numeric, 0), 0), 2)::numeric AS ics_result
        FROM 
            call_statistics
        WHERE 
            report_date BETWEEN $1::date AND $2::date
        `;
        
        return [sql, queryParams];
    }
}

/**
 * Обрабатывает результаты запроса и вычисляет дополнительные метрики
 */
function processQueryResults(rows, isDetailed) {
    function safeRound(value, decimals = 0) {
        if (value === null || value === undefined) return value;
        
        try {
            const numValue = typeof value === 'string' ? parseFloat(value) : value;
            if (isNaN(numValue)) return value;
            
            return decimals === 0 
                ? Math.round(numValue) 
                : Number(numValue.toFixed(decimals));
        } catch (e) {
            console.warn('Warning: Error processing value:', value, e);
            return value;
        }
    }
    
    return rows.map(row => {
        // Округление числовых значений
        row.sl_result = safeRound(row.sl_result, 0);
        row.awt_result = safeRound(row.awt_result, 0);
        row.aht_result = safeRound(row.aht_result, 0);
        row.ics_result = safeRound(row.ics_result, 2);
        
        return row;
    });
}

/*===============================================
        ОТЧЕТНОСТЬ КЦ (ОМНИКОНАЛЬНЫЙ ЧАТ)
=================================================*/

router.get('/api/omni-chats', async (req, res) => {
    const start = Date.now();
    let client;

    try {
        client = await pool.connect();

        // Получение параметров запроса
        const { startDate, endDate, chatType } = req.query;
        
        // Проверка параметров
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Необходимо указать начальную и конечную даты (startDate и endDate)'
            });
        }
        
        // Формирование условия фильтрации по типу чата
        let chatTypeCondition = '';
        let params = [startDate, endDate];
        
        if (chatType && chatType !== 'all') {
            chatTypeCondition = 'AND channel = $3';
            params.push(chatType);
        }
        
        // Запрос для получения данных по чатам по дням
        const detailSql = `
            SELECT 
                TO_CHAR(chat_date, 'YYYY-MM-DD') AS date,
                SUM(total_chats) AS totalChats,
                SUM(completed_chats) AS completedChats,
                SUM(abandoned_chats) AS abandonedChats,
                ROUND(AVG(avg_duration)::numeric, 2) AS avgDuration,
                ROUND(AVG(satisfaction)::numeric, 2) AS satisfaction
            FROM 
                chat_statistics
            WHERE 
                chat_date BETWEEN $1::date AND $2::date
                ${chatTypeCondition}
            GROUP BY 
                chat_date
            ORDER BY 
                chat_date
        `;
        
        // Запрос для получения итоговых данных
        const totalSql = `
            SELECT 
                'Итого' AS date,
                SUM(total_chats) AS totalChats,
                SUM(completed_chats) AS completedChats,
                SUM(abandoned_chats) AS abandonedChats,
                ROUND(AVG(avg_duration)::numeric, 2) AS avgDuration,
                ROUND(AVG(satisfaction)::numeric, 2) AS satisfaction
            FROM 
                chat_statistics
            WHERE 
                chat_date BETWEEN $1::date AND $2::date
                ${chatTypeCondition}
        `;
        
        // Выполнение запросов
        const detailResult = await client.query(detailSql, params);
        const totalResult = await client.query(totalSql, params);
        
        // Объединение результатов
        let data = [...detailResult.rows];
        
        if (totalResult.rows.length > 0) {
            const total = totalResult.rows[0];
            total.isTotal = true;
            data.push(total);
        }
        
        // Возвращаем данные
        res.json({
            success: true,
            data,
            executionTime: `${Date.now() - start}ms`,
            timestamp: new Date().toISOString(),
            filters: {
                startDate,
                endDate,
                chatType: chatType || 'all'
            }
        });
        
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении данных о чатах',
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * API для статистики по каналам обращений
 */
router.get('/api/omnikol', async (req, res) => {
    const start = Date.now();
    let client;

    const CHANNELS = [
        { db: ['мобильное приложение'], label: 'Мобильное приложение' },
        { db: ['whatsapp', 'WhatsApp'], label: 'WhatsApp' },
        { db: ['telegram'], label: 'Telegram' },
        { db: ['вконтакте'], label: 'ВКонтакте' },
        { db: ['сайт'], label: 'Сайт' },
        { db: ['viber'], label: 'Viber' },
        { db: ['ok'], label: 'OK' }
    ];

    const PN = typeof PREDEFINED_NOTIFICATIONS === 'object'
        ? PREDEFINED_NOTIFICATIONS
        : {
            DATA_LOADED: { message: "Данные успешно загружены.", type: "success" },
            DATA_LOAD_ERROR: { message: "Ошибка загрузки данных.", type: "error" },
            NO_DATA_FOUND: { message: "Данные не найдены.", type: "info" }
        };

    try {
        client = await pool.connect();

        let { startDate, endDate, periodType, months, year, tableName } = req.query;

        // Лог входящих параметров для отладки
        console.log('[API] /api/omnikol params:', { startDate, endDate, periodType, months, year, tableName });

        if (!tableName || (tableName !== 'call_chat' && tableName !== 'call_tematiks')) {
            return res.status(400).json({
                success: false,
                message: 'Укажите корректное имя таблицы (tableName): call_chat или call_tematiks.'
            });
        }

        // --- months ---
        let selectedMonths = [];
        if (months) {
            if (typeof months === 'string') {
                selectedMonths = months.split(',').map(Number).filter(m => !isNaN(m) && m >= 1 && m <= 12);
            } else if (Array.isArray(months)) {
                selectedMonths = months.map(Number).filter(m => !isNaN(m) && m >= 1 && m <= 12);
            }
        }
        if (req.query.month && !months) {
            const singleMonth = Number(req.query.month);
            if (!isNaN(singleMonth) && singleMonth >= 1 && singleMonth <= 12) {
                selectedMonths.push(singleMonth);
            }
        }

        let detailSql = '';
        let totalSql = '';
        let params = [];
        let dateCondition = '';
        let checkDataSql = '';
        let checkParams = [];

        const dateColumn = '"Date"';

        // Создаем функцию для безопасного создания CASE выражений для pivot
        function getPivotColumns() {
            // Перебираем все каналы и создаем для них case выражения
            return CHANNELS.map(ch => {
                // Создаем условия для поиска каналов
                const channelConditions = ch.db.map(v => `LOWER(TRIM("Channel")) = '${v.toLowerCase()}'`).join(" OR ");
                
                // Формируем полное CASE выражение
                return `SUM(CASE WHEN ${channelConditions} THEN "Quantity" ELSE 0 END) AS "${ch.label}"`;
            }).join(',\n');
        }

        // --- month ---
        if (periodType === 'month') {
            if (!year || selectedMonths.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Для фильтрации по месяцам укажите год (year) и хотя бы один месяц (months).'
                });
            }
            if (!/^\d{4}$/.test(String(year))) {
                return res.status(400).json({ success: false, message: 'Некорректный формат года.' });
            }
            const RU_MONTHS = [
                "", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
                "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
            ];
            let monthNames = selectedMonths.map(m => RU_MONTHS[m]);
            
            // Создаем безопасные плейсхолдеры для SQL запроса
            const monthPlaceholders = [];
            for (let i = 0; i < monthNames.length; i++) {
                monthPlaceholders.push(`$${i + 2}`);
            }
            
            dateCondition = `"Month" IN (${monthPlaceholders.join(', ')}) AND "Year" = $1::integer`;
            params = [year, ...monthNames];
            checkParams = params;

            if (tableName === 'call_chat') {
                detailSql = `
                    WITH monthly_chat_data AS (
                        SELECT
                            MIN(${dateColumn}) AS min_date,
                            "Year",
                            "Month",
                            SUM("Chat requests") AS total_chat_requests,
                            SUM("Processed by the operator") AS total_processed_by_operator,
                            SUM("Processed by bot") AS total_processed_by_bot
                        FROM call_chat
                        WHERE ${dateCondition}
                        GROUP BY "Year", "Month"
                    )
                    SELECT
                        TO_CHAR(min_date, 'TMMonth YYYY') AS report_period,
                        total_chat_requests,
                        total_processed_by_operator,
                        total_processed_by_bot,
                        CASE WHEN total_chat_requests > 0 THEN ROUND(100.0 * total_processed_by_operator / total_chat_requests, 2) ELSE 0 END AS percent_operator,
                        CASE WHEN total_chat_requests > 0 THEN ROUND(100.0 * total_processed_by_bot / total_chat_requests, 2) ELSE 0 END AS percent_bot
                    FROM monthly_chat_data
                    ORDER BY min_date;
                `;
                totalSql = `
                    SELECT
                        'Итого' AS report_period,
                        SUM("Chat requests") AS total_chat_requests,
                        SUM("Processed by the operator") AS total_processed_by_operator,
                        SUM("Processed by bot") AS total_processed_by_bot,
                        CASE WHEN SUM("Chat requests") > 0 THEN ROUND(100.0 * SUM("Processed by the operator") / SUM("Chat requests"), 2) ELSE 0 END AS percent_operator,
                        CASE WHEN SUM("Chat requests") > 0 THEN ROUND(100.0 * SUM("Processed by bot") / SUM("Chat requests"), 2) ELSE 0 END AS percent_bot
                    FROM call_chat WHERE ${dateCondition};
                `;
                checkDataSql = `SELECT COUNT(*) FROM call_chat WHERE ${dateCondition}`;
            } else if (tableName === 'call_tematiks') {
                detailSql = `
                    SELECT
                        TO_CHAR(MIN(${dateColumn}), 'TMMonth YYYY') AS report_period,
                        ${getPivotColumns()}
                    FROM call_tematiks
                    WHERE ${dateCondition}
                    GROUP BY "Year", "Month"
                    ORDER BY MIN(${dateColumn});
                `;
                totalSql = `
                    SELECT
                        'Итого' AS report_period,
                        ${getPivotColumns()}
                    FROM call_tematiks
                    WHERE ${dateCondition};
                `;
                checkDataSql = `SELECT COUNT(*) FROM call_tematiks WHERE ${dateCondition}`;
            }
        }
        // --- custom ---
        else if (periodType === 'custom') {
            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Необходимо указать начальную и конечную дату (startDate и endDate) для произвольного периода.'
                });
            }
            const isValidDate = (dateString) =>
                /^\d{4}-\d{2}-\d{2}$/.test(dateString) && !isNaN(new Date(dateString).getTime());
            if (!isValidDate(startDate) || !isValidDate(endDate)) {
                return res.status(400).json({ success: false, message: 'Некорректный формат дат. Используйте YYYY-MM-DD.' });
            }
            if (new Date(startDate) > new Date(endDate)) {
                return res.status(400).json({ success: false, message: 'Дата начала периода не может быть позже даты окончания.' });
            }
            dateCondition = `${dateColumn} BETWEEN $1::date AND $2::date`;
            params = [startDate, endDate];
            checkParams = params;

            if (tableName === 'call_chat') {
                detailSql = `
                    SELECT
                        TO_CHAR(${dateColumn}, 'YYYY-MM-DD') AS report_period,
                        SUM("Chat requests") AS total_chat_requests,
                        SUM("Processed by the operator") AS total_processed_by_operator,
                        SUM("Processed by bot") AS total_processed_by_bot,
                        CASE WHEN SUM("Chat requests") > 0 THEN ROUND(100.0 * SUM("Processed by the operator") / SUM("Chat requests"), 2) ELSE 0 END AS percent_operator,
                        CASE WHEN SUM("Chat requests") > 0 THEN ROUND(100.0 * SUM("Processed by bot") / SUM("Chat requests"), 2) ELSE 0 END AS percent_bot
                    FROM call_chat
                    WHERE ${dateCondition}
                    GROUP BY ${dateColumn}
                    ORDER BY ${dateColumn};
                `;
                totalSql = `
                    SELECT
                        'Итого' AS report_period,
                        SUM("Chat requests") AS total_chat_requests,
                        SUM("Processed by the operator") AS total_processed_by_operator,
                        SUM("Processed by bot") AS total_processed_by_bot,
                        CASE WHEN SUM("Chat requests") > 0 THEN ROUND(100.0 * SUM("Processed by the operator") / SUM("Chat requests"), 2) ELSE 0 END AS percent_operator,
                        CASE WHEN SUM("Chat requests") > 0 THEN ROUND(100.0 * SUM("Processed by bot") / SUM("Chat requests"), 2) ELSE 0 END AS percent_bot
                    FROM call_chat
                    WHERE ${dateCondition};
                `;
                checkDataSql = `SELECT COUNT(*) FROM call_chat WHERE ${dateCondition}`;
            } else if (tableName === 'call_tematiks') {
                detailSql = `
                    SELECT
                        TO_CHAR(${dateColumn}, 'YYYY-MM-DD') AS report_period,
                        ${getPivotColumns()}
                    FROM call_tematiks
                    WHERE ${dateCondition}
                    GROUP BY ${dateColumn}
                    ORDER BY ${dateColumn};
                `;
                totalSql = `
                    SELECT
                        'Итого' AS report_period,
                        ${getPivotColumns()}
                    FROM call_tematiks
                    WHERE ${dateCondition};
                `;
                checkDataSql = `SELECT COUNT(*) FROM call_tematiks WHERE ${dateCondition}`;
            }
        } else {
            return res.status(400).json({ success: false, message: 'Некорректный тип периода. periodType должен быть month или custom.' });
        }

        // Проверка наличия данных
        const checkResult = await client.query(checkDataSql, checkParams);
        if (parseInt(checkResult.rows[0].count) === 0) {
            const responseData = {
                success: true,
                data: [],
                executionTime: `${Date.now() - start}ms`,
                timestamp: new Date().toISOString(),
                tableName,
                periodType,
                selectedMonths: periodType === 'month' ? selectedMonths : undefined,
                year: periodType === 'month' ? year : undefined,
                dateRange: periodType === 'custom' ? { startDate, endDate } : undefined,
                message: PN.NO_DATA_FOUND.message
            };
            return res.json(responseData);
        }

        // Основные SQL-запросы
        const detailResult = await client.query(detailSql, params);
        const totalResult = await client.query(totalSql, params);

        let processedData = [...detailResult.rows];
        if (totalResult.rows.length > 0) {
            const totals = totalResult.rows[0];
            const hasTotalValues = Object.keys(totals).some(key => key !== 'report_period' && totals[key] !== null && totals[key] !== 0);
            if (hasTotalValues) {
                processedData.push(totals);
            }
        }

        const responseData = {
            success: true,
            data: processedData,
            executionTime: `${Date.now() - start}ms`,
            timestamp: new Date().toISOString(),
            tableName,
            periodType,
            selectedMonths: periodType === 'month' ? selectedMonths : undefined,
            year: periodType === 'month' ? year : undefined,
            dateRange: periodType === 'custom' ? { startDate, endDate } : undefined
        };

        res.json(responseData);
        console.log(`[INFO] Данные успешно отправлены для таблицы ${tableName}. Время выполнения: ${responseData.executionTime}`);
    } catch (error) {
        let msg;
        if (error && typeof error === 'object' && 'message' in error) {
            msg = error.message;
        } else {
            msg = String(error);
        }
        console.error(`[ERROR] Ошибка: ${msg}`);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при обработке запроса данных',
            error: process.env.NODE_ENV === 'development' ? msg : undefined
        });
    } finally {
        if (client) client.release();
    }
});

/**
 * API для получения почасовой статистики звонков
 */
router.get('/api/stat_hours', async (req, res) => {
    const start = Date.now();
    let client;

    try {
        client = await pool.connect();

        // Получение параметров запроса
        const { date, startHour, endHour } = req.query;
        
        // Валидация параметров
        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Необходимо указать дату (date)'
            });
        }
        
        // Проверка формата даты
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Некорректный формат даты. Используйте YYYY-MM-DD.' 
            });
        }
        
        // Формирование условия фильтрации по часам
        let hourCondition = '';
        let params = [date];
        
        if (startHour && endHour) {
            hourCondition = 'AND hour_of_day BETWEEN $2::integer AND $3::integer';
            params.push(parseInt(startHour), parseInt(endHour));
        }
        
        // Запрос для получения почасовых данных
        const hoursSql = `
            SELECT 
                TO_CHAR(call_date, 'DD.MM.YYYY') AS call_date,
                hour_of_day,
                total_calls AS quantity,
                ROUND(service_level * 100, 1) AS service_level,
                satisfaction_rating,
                ROUND(wait_time_avg) AS wait_time
            FROM 
                call_hours_statistics
            WHERE 
                call_date = $1::date
                ${hourCondition}
            ORDER BY 
                call_date, hour_of_day
        `;
        
        // Запрос для получения итоговых данных
        const totalSql = `
            SELECT 
                'Итого' AS call_date,
                NULL AS hour_of_day,
                SUM(total_calls) AS quantity,
                ROUND(AVG(service_level) * 100, 1) AS service_level,
                ROUND(AVG(satisfaction_rating), 1) AS satisfaction_rating,
                ROUND(AVG(wait_time_avg)) AS wait_time
            FROM 
                call_hours_statistics
            WHERE 
                call_date = $1::date
                ${hourCondition}
        `;
        
        // Выполнение запросов
        const hoursResult = await client.query(hoursSql, params);
        const totalResult = await client.query(totalSql, params);
        
        // Объединение результатов и форматирование данных
        let data = hoursResult.rows.map(row => {
            // Форматирование диапазона часов
            const startHourFormatted = String(row.hour_of_day).padStart(2, '0') + ':00';
            const endHourFormatted = String((row.hour_of_day + 1) % 24).padStart(2, '0') + ':00';
            
            return {
                date: row.call_date,
                hour_range: `с ${startHourFormatted} по ${endHourFormatted}`,
                quantity: row.quantity,
                service_level: row.service_level ? row.service_level + '%' : '0.0%',
                satisfaction: parseFloat(row.satisfaction_rating).toFixed(1),
                wait_time: row.wait_time
            };
        });
        
        // Добавление итоговой строки
        if (totalResult.rows.length > 0) {
            const total = totalResult.rows[0];
            data.push({
                date: 'Итого',
                hour_range: '',
                quantity: total.quantity,
                service_level: total.service_level ? total.service_level + '%' : '0.0%',
                satisfaction: parseFloat(total.satisfaction_rating).toFixed(1),
                wait_time: total.wait_time
            });
        }
        
        // Возвращаем данные
        res.json({
            success: true,
            data,
            executionTime: `${Date.now() - start}ms`,
            timestamp: new Date().toISOString(),
            filters: {
                date,
                startHour: startHour || '0',
                endHour: endHour || '23'
            }
        });
        
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении почасовой статистики',
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});
/*===============================================
        БАЗА ДАННЫХ ПО ТЕМАТИКАМ КЦ (чаты)
=================================================*/

router.get('/api/stat_tematiks', async (req, res) => {
    const start = Date.now();
    let client;

    // Предопределенные уведомления
    const NOTIFICATIONS = {
        DATA_LOADED: { message: "Данные успешно загружены.", type: "success" },
        DATA_LOAD_ERROR: { message: "Ошибка загрузки данных.", type: "error" },
        NO_DATA_FOUND: { message: "Данные не найдены.", type: "info" }
    };

    try {
        // Получаем соединение из пула
        client = await pool.connect();

        // Получаем параметры запроса
        let { 
            startDate, endDate, periodType, months, year, dataType,
            // Новые параметры для сравнения
            comparison, 
            comparisonYear, comparisonMonth, 
            comparisonStartDate, comparisonEndDate,
            comparisonDate, comparisonStartHour, comparisonEndHour
        } = req.query;
        
        // Валидация параметров
        if (!dataType || (dataType !== 'calls' && dataType !== 'chats')) {
            return res.status(400).json({
                success: false,
                message: 'Укажите корректный тип данных (dataType): calls или chats.'
            });
        }

        if (!periodType || !['month', 'day', 'hour', 'custom'].includes(periodType)) {
            return res.status(400).json({
                success: false,
                message: 'Укажите корректный тип периода (periodType): month, day, hour или custom.'
            });
        }

        // Подготовка базовых переменных
        const tableName = 'stat_tematiks';
        const dateColumn = '"Date"';
        
        // Обработка месяцев
        let selectedMonths = [];
        if (months) {
            if (typeof months === 'string') {
                selectedMonths = months.split(',').map(Number).filter(m => !isNaN(m) && m >= 1 && m <= 12);
            } else if (Array.isArray(months)) {
                selectedMonths = months.map(Number).filter(m => !isNaN(m) && m >= 1 && m <= 12);
            }
        }
        
        // Обработка месяцев для сравнения
        let comparisonSelectedMonths = [];
        if (comparisonMonth) {
            if (typeof comparisonMonth === 'string') {
                comparisonSelectedMonths = comparisonMonth.split(',').map(Number).filter(m => !isNaN(m) && m >= 1 && m <= 12);
            } else if (Array.isArray(comparisonMonth)) {
                comparisonSelectedMonths = comparisonMonth.map(Number).filter(m => !isNaN(m) && m >= 1 && m <= 12);
            }
        }
        
        // Подготовка фильтрации по типу канала
        let channelCondition = '';
        if (dataType === 'chats') {
            channelCondition = `"channel" = 'Чат'`;
        } else if (dataType === 'calls') {
            channelCondition = `"channel" = 'Звонок'`;
        }
        
        // Результаты запросов
        let mainData = [];
        let comparisonData = [];
        
        // Подготовка SQL запросов в зависимости от типа периода
        switch (periodType) {
            case 'month':
                // Проверка обязательных параметров
                if (!year || selectedMonths.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Для фильтрации по месяцам укажите год (year) и хотя бы один месяц (months).'
                    });
                }
                
                if (!/^\d{4}$/.test(String(year))) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Некорректный формат года.' 
                    });
                }
                
                // Основной запрос для получения суммарных данных по месяцам
                const mainMonthData = await getSummaryMonthlyData(
                    client, tableName, channelCondition, year, selectedMonths
                );
                
                if (parseInt(mainMonthData.count) === 0) {
                    return res.json({
                        success: true,
                        data: [],
                        executionTime: `${Date.now() - start}ms`,
                        timestamp: getCurrentMoscowTime(),
                        message: NOTIFICATIONS.NO_DATA_FOUND.message
                    });
                }
                
                mainData = mainMonthData.data;
                
                // Добавляем запрос для сравнения, если указаны параметры
                if (comparison === 'true' && comparisonYear && comparisonSelectedMonths.length > 0) {
                    const comparisonMonthData = await getSummaryMonthlyData(
                        client, tableName, channelCondition, comparisonYear, comparisonSelectedMonths
                    );
                    
                    if (parseInt(comparisonMonthData.count) > 0) {
                        comparisonData = comparisonMonthData.data;
                    }
                }
                break;
                
            case 'day':
            case 'custom':
                // Проверка обязательных параметров
                if (!startDate || !endDate) {
                    return res.status(400).json({
                        success: false,
                        message: 'Необходимо указать начальную и конечную дату для выбранного периода.'
                    });
                }
                
                // Основной запрос для получения суммарных данных по дням
                const mainDayData = await getSummaryDateRangeData(
                    client, tableName, dateColumn, channelCondition, startDate, endDate
                );
                
                if (parseInt(mainDayData.count) === 0) {
                    return res.json({
                        success: true,
                        data: [],
                        executionTime: `${Date.now() - start}ms`,
                        timestamp: getCurrentMoscowTime(),
                        message: NOTIFICATIONS.NO_DATA_FOUND.message
                    });
                }
                
                mainData = mainDayData.data;
                
                // Добавляем запрос для сравнения, если указаны параметры
                if (comparison === 'true' && comparisonStartDate && comparisonEndDate) {
                    const comparisonDayData = await getSummaryDateRangeData(
                        client, tableName, dateColumn, channelCondition, 
                        comparisonStartDate, comparisonEndDate
                    );
                    
                    if (parseInt(comparisonDayData.count) > 0) {
                        comparisonData = comparisonDayData.data;
                    }
                }
                break;
                
            case 'hour':
                // Проверка обязательных параметров для часов
                if (!startDate) {
                    return res.status(400).json({
                        success: false,
                        message: 'Для фильтрации по часам укажите дату и диапазон часов.'
                    });
                }
                
                const startHour = req.query.startHour || 0;
                const endHour = req.query.endHour || 23;
                
                // Создаем диапазон дат с учетом часов
                const hourStartDate = `${startDate} ${String(startHour).padStart(2, '0')}:00:00`;
                const hourEndDate = `${startDate} ${String(endHour).padStart(2, '0')}:59:59`;
                
                // Основной запрос для получения суммарных данных по часам
                const mainHourData = await getSummaryDateRangeData(
                    client, tableName, dateColumn, channelCondition, hourStartDate, hourEndDate
                );
                
                if (parseInt(mainHourData.count) === 0) {
                    return res.json({
                        success: true,
                        data: [],
                        executionTime: `${Date.now() - start}ms`,
                        timestamp: getCurrentMoscowTime(),
                        message: NOTIFICATIONS.NO_DATA_FOUND.message
                    });
                }
                
                mainData = mainHourData.data;
                
                // Добавляем запрос для сравнения по часам
                if (comparison === 'true' && comparisonDate) {
                    const compStartHour = comparisonStartHour || startHour;
                    const compEndHour = comparisonEndHour || endHour;
                    
                    const compHourStartDate = `${comparisonDate} ${String(compStartHour).padStart(2, '0')}:00:00`;
                    const compHourEndDate = `${comparisonDate} ${String(compEndHour).padStart(2, '0')}:59:59`;
                    
                    const comparisonHourData = await getSummaryDateRangeData(
                        client, tableName, dateColumn, channelCondition, 
                        compHourStartDate, compHourEndDate
                    );
                    
                    if (parseInt(comparisonHourData.count) > 0) {
                        comparisonData = comparisonHourData.data;
                    }
                }
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Неизвестный тип периода.'
                });
        }
        
        // Отправляем ответ с результатами
        res.json({
            success: true,
            data: mainData,
            comparison: comparisonData,
            executionTime: `${Date.now() - start}ms`,
            timestamp: getCurrentMoscowTime(),
            tableName,
            periodType,
            dataType,
            selectedMonths,
            year,
            message: NOTIFICATIONS.DATA_LOADED.message
        });
        
    } catch (error) {
        // Обработка ошибок
        let errorMessage;
        if (error && typeof error === 'object' && 'message' in error) {
            errorMessage = error.message;
        } else {
            errorMessage = String(error);
        }
        
        console.error(`[ERROR] Ошибка при выполнении запроса: ${errorMessage}`);
        
        // В режиме разработки возвращаем подробности ошибки
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при обработке запроса данных',
            error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            timestamp: getCurrentMoscowTime()
        });
        
    } finally {
        // Освобождение соединения
        if (client) client.release();
    }
});

// Функция для получения суммарных данных за выбранные месяцы
async function getSummaryMonthlyData(client, tableName, channelCondition, year, months) {
    // Преобразование номеров месяцев в названия на русском
    const RU_MONTHS = [
        "", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];
    let monthNames = months.map(m => RU_MONTHS[m]);
    
    // Создаем параметры для запроса
    const params = [year, ...monthNames];
    
    // Создаем условия для фильтрации
    let monthCondition = '';
    if (monthNames.length === 1) {
        monthCondition = `"Month" = $2`;
    } else {
        const placeholders = monthNames.map((_, i) => `$${i + 2}`).join(', ');
        monthCondition = `"Month" IN (${placeholders})`;
    }
    
    // Создаем полное условие WHERE
    const whereClause = `
        ${channelCondition}
        AND "Year" = $1::integer
        AND ${monthCondition}
    `;
    
    // Запрос для проверки наличия данных
    const checkDataSql = `SELECT COUNT(*) FROM ${tableName} WHERE ${whereClause}`;
    const checkResult = await client.query(checkDataSql, params);
    
    // Запрос для получения суммарных данных по тематикам за весь выбранный период
    const sql = `
        SELECT
            "Subject_chat",
            SUM("Quantity") AS "Quantity"
        FROM ${tableName}
        WHERE ${whereClause}
        GROUP BY "Subject_chat"
        ORDER BY "Quantity" DESC
    `;
    
    // Если есть данные, выполняем основной запрос
    let data = [];
    if (parseInt(checkResult.rows[0].count) > 0) {
        const result = await client.query(sql, params);
        data = result.rows;
    }
    
    return {
        count: checkResult.rows[0].count,
        data: data
    };
}

// Функция для получения суммарных данных за указанный диапазон дат
async function getSummaryDateRangeData(client, tableName, dateColumn, channelCondition, startDate, endDate) {
    // Создаем параметры для запроса
    const params = [startDate, endDate];
    
    // Создаем полное условие WHERE
    const dateRangeClause = `
        ${channelCondition}
        AND ${dateColumn} BETWEEN $1::timestamp AND $2::timestamp
    `;
    
    // Запрос для проверки наличия данных
    const checkDataSql = `SELECT COUNT(*) FROM ${tableName} WHERE ${dateRangeClause}`;
    const checkResult = await client.query(checkDataSql, params);
    
    // Запрос для получения суммарных данных по тематикам за весь выбранный период
    const sql = `
        SELECT
            "Subject_chat",
            SUM("Quantity") AS "Quantity"
        FROM ${tableName}
        WHERE ${dateRangeClause}
        GROUP BY "Subject_chat"
        ORDER BY "Quantity" DESC
    `;
    
    // Если есть данные, выполняем основной запрос
    let data = [];
    if (parseInt(checkResult.rows[0].count) > 0) {
        const result = await client.query(sql, params);
        data = result.rows;
    }
    
    return {
        count: checkResult.rows[0].count,
        data: data
    };
}

/*===============================================
          ДАННЫЕ ПО СТРАНИЦЕ (ОПОП)
=================================================*/
//Запрос на получение данных с карточки

router.get('/api/opop-online', async (req, res) => {
    const start = Date.now();
    let client;
    
    try {
        client = await pool.connect();
        
        const { date, startDate, endDate } = req.query;
        
        let sql, params;
        
        if (date) {
            // Данные за конкретную дату
            sql = `
                SELECT 
                    date,
                    received,
                    closed_requests,
                    in_status_classified,
                    in_status_in_progress,
                    in_status_clarifying_information
                FROM opop_online 
                WHERE date = $1::date
                ORDER BY date DESC
            `;
            params = [date];
        } else if (startDate && endDate) {
            // Данные за период
            sql = `
                SELECT 
                    date,
                    received,
                    closed_requests,
                    in_status_classified,
                    in_status_in_progress,
                    in_status_clarifying_information
                FROM opop_online 
                WHERE date BETWEEN $1::date AND $2::date
                ORDER BY date DESC
            `;
            params = [startDate, endDate];
        } else {
            // Последние данные
            sql = `
                SELECT 
                    date,
                    received,
                    closed_requests,
                    in_status_classified,
                    in_status_in_progress,
                    in_status_clarifying_information
                FROM opop_online 
                ORDER BY date DESC 
                LIMIT 1
            `;
            params = [];
        }
        
        const result = await client.query(sql, params);
        
        res.json({
            success: true,
            data: result.rows,
            executionTime: `${Date.now() - start}ms`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении данных ОПОП',
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// API для получения общей статистики ОПОП
router.get('/api/opop-general', async (req, res) => {
    const start = Date.now();
    let client;
    
    try {
        client = await pool.connect();
        
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Необходимо указать startDate и endDate'
            });
        }
        
        // Основной запрос данных за период
        const sql = `
            SELECT 
                date,
                received,
                closed_requests,
                closed_opop,
                closed_cpio,
                closed_autoresponse,
                closed_kc,
                average_request_processing_time_opop
            FROM opop_stat 
            WHERE date BETWEEN $1::date AND $2::date
            ORDER BY date ASC
        `;
        
        const result = await client.query(sql, [startDate, endDate]);
        
        // Вычисляем агрегированные данные
        const data = result.rows;
        const totals = data.reduce((acc, row) => {
            acc.received += row.received || 0;
            acc.closed_requests += row.closed_requests || 0;
            acc.closed_opop += row.closed_opop || 0;
            acc.closed_cpio += row.closed_cpio || 0;
            acc.closed_autoresponse += row.closed_autoresponse || 0;
            acc.closed_kc += row.closed_kc || 0;
            
            // Для среднего времени берем среднее значение
            if (row.average_request_processing_time_opop) {
                acc.avgTimeSum += parseFloat(row.average_request_processing_time_opop);
                acc.avgTimeCount++;
            }
            
            return acc;
        }, {
            received: 0,
            closed_requests: 0,
            closed_opop: 0,
            closed_cpio: 0,
            closed_autoresponse: 0,
            closed_kc: 0,
            avgTimeSum: 0,
            avgTimeCount: 0
        });
        
        // Вычисляем среднее время обработки
        const avgProcessingTime = totals.avgTimeCount > 0 
            ? (totals.avgTimeSum / totals.avgTimeCount).toFixed(2)
            : 0;
        
        res.json({
            success: true,
            data: {
                daily: data,
                totals: {
                    ...totals,
                    avgProcessingTime: parseFloat(avgProcessingTime)
                }
            },
            executionTime: `${Date.now() - start}ms`,
            timestamp: new Date().toISOString(),
            period: { startDate, endDate }
        });
        
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении общей статистики ОПОП',
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

router.get('/api/opop-channels', async (req, res) => {
    const start = Date.now();
    let client;
    
    try {
        client = await pool.connect();
        
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Необходимо указать startDate и endDate'
            });
        }
        
        // Основной запрос данных за период с группировкой по дням
        const dailyDataSql = `
            SELECT 
                date as date,
                SUM(fos) as fos_total,
                SUM(personal_account) as personal_account_total,
                SUM(cpio) as cpio_total,
                SUM(mobile_application) as mobile_application_total,
                SUM(fos_epgu) as fos_epgu_total,
                SUM(email) as email_total,
                SUM(email_helpz) as email_helpz_total,
                SUM(contact_center) as contact_center_total,
                SUM(email_buskids) as email_buskids_total,
                SUM(appeals_from_gc) as appeals_from_gc_total,
                SUM(state_company) as state_company_total,
                SUM(official_letter) as official_letter_total,
                SUM(book_of_complaints_and_suggestions) as book_complaints_total,
                (SUM(fos) + SUM(personal_account) + SUM(cpio) + 
                 SUM(mobile_application) + SUM(fos_epgu) + SUM(email) + 
                 SUM(email_helpz) + SUM(contact_center) + SUM(email_buskids) + 
                 SUM(appeals_from_gc) + SUM(state_company) + SUM(official_letter) + 
                 SUM(book_of_complaints_and_suggestions)) as total_per_day
            FROM opop_channel_input 
            WHERE date BETWEEN $1::date AND $2::date
            GROUP BY date
            ORDER BY date ASC
        `;
        
        // Запрос для получения общих итогов за период
        const totalsSql = `
            SELECT 
                SUM(fos) as fos_total,
                SUM(personal_account) as personal_account_total,
                SUM(cpio) as cpio_total,
                SUM(mobile_application) as mobile_application_total,
                SUM(fos_epgu) as fos_epgu_total,
                SUM(email) as email_total,
                SUM(email_helpz) as email_helpz_total,
                SUM(contact_center) as contact_center_total,
                SUM(email_buskids) as email_buskids_total,
                SUM(appeals_from_gc) as appeals_from_gc_total,
                SUM(state_company) as state_company_total,
                SUM(official_letter) as official_letter_total,
                SUM(book_of_complaints_and_suggestions) as book_complaints_total
            FROM opop_channel_input 
            WHERE date BETWEEN $1::date AND $2::date
        `;
        
        const [dailyResult, totalsResult] = await Promise.all([
            client.query(dailyDataSql, [startDate, endDate]),
            client.query(totalsSql, [startDate, endDate])
        ]);
        
        const totalsRow = totalsResult.rows[0] || {};
        const grandTotal = Object.values(totalsRow).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
        
        // Формируем структуру данных для фронтенда
        const channelsData = [
            { name: 'ФОС', key: 'fos_total', value: parseInt(totalsRow.fos_total) || 0, color: '#ff6b35' },
            { name: 'Личный кабинет', key: 'personal_account_total', value: parseInt(totalsRow.personal_account_total) || 0, color: '#10b981' },
            { name: 'ЦПИО', key: 'cpio_total', value: parseInt(totalsRow.cpio_total) || 0, color: '#3b82f6' },
            { name: 'Мобильное приложение', key: 'mobile_application_total', value: parseInt(totalsRow.mobile_application_total) || 0, color: '#f59e0b' },
            { name: 'ФОС ЕПГУ', key: 'fos_epgu_total', value: parseInt(totalsRow.fos_epgu_total) || 0, color: '#8b5cf6' },
            { name: 'Электронная почта', key: 'email_total', value: parseInt(totalsRow.email_total) || 0, color: '#ef4444' },
            { name: 'Эл. почта helpz', key: 'email_helpz_total', value: parseInt(totalsRow.email_helpz_total) || 0, color: '#06b6d4' },
            { name: 'Контактный центр', key: 'contact_center_total', value: parseInt(totalsRow.contact_center_total) || 0, color: '#84cc16' },
            { name: 'Эл. почта buskids', key: 'email_buskids_total', value: parseInt(totalsRow.email_buskids_total) || 0, color: '#f97316' },
            { name: 'Обращения из ГК', key: 'appeals_from_gc_total', value: parseInt(totalsRow.appeals_from_gc_total) || 0, color: '#ec4899' },
            { name: 'Гос. компания', key: 'state_company_total', value: parseInt(totalsRow.state_company_total) || 0, color: '#6366f1' },
            { name: 'Официальное письмо', key: 'official_letter_total', value: parseInt(totalsRow.official_letter_total) || 0, color: '#14b8a6' },
            { name: 'Книга жалоб и предложений', key: 'book_complaints_total', value: parseInt(totalsRow.book_complaints_total) || 0, color: '#a855f7' }
        ].sort((a, b) => b.value - a.value); // Сортируем по убыванию значений
        
        res.json({
            success: true,
            data: {
                daily: dailyResult.rows,
                channels: channelsData,
                grandTotal: grandTotal,
                period: { startDate, endDate }
            },
            executionTime: `${Date.now() - start}ms`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении данных по источникам обращений',
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// API для получения статистики по типам обращений
router.get('/api/opop-topics', async (req, res) => {
    const start = Date.now();
    let client;
    try {
        client = await pool.connect();

        // 1. Получаем список всех месяцев
        const monthsResult = await client.query(`
            SELECT "Month"
            FROM opop_tematiks
            WHERE "Month" IS NOT NULL
            GROUP BY "Month"
            ORDER BY
                CASE "Month"
                    WHEN 'Январь' THEN 1
                    WHEN 'Февраль' THEN 2
                    WHEN 'Март' THEN 3
                    WHEN 'Апрель' THEN 4
                    WHEN 'Май' THEN 5
                    WHEN 'Июнь' THEN 6
                    WHEN 'Июль' THEN 7
                    WHEN 'Август' THEN 8
                    WHEN 'Сентябрь' THEN 9
                    WHEN 'Октябрь' THEN 10
                    WHEN 'Ноябрь' THEN 11
                    WHEN 'Декабрь' THEN 12
                    ELSE 13
                END
        `);
        const allMonths = monthsResult.rows.map(row => row.Month);


        // 2. Если нет параметра months — возвращаем только список месяцев
        if (!req.query.months || req.query.months === '') {
            return res.json({
                success: true,
                data: {
                    types: [],
                    monthly: [],
                    topTopics: [],
                    availableMonths: allMonths.map(formatMonthName),
                    selectedMonths: [],
                    grandTotal: 0
                }
            });
        }

        // 3. Фильтруем выбранные месяцы (с учетом регистра!)
        const requestedMonths = req.query.months.split(',').map(m => m.trim()).filter(Boolean);
        const selectedMonths = requestedMonths.filter(m => allMonths.includes(m));

        if (selectedMonths.length === 0) {
            return res.json({
                success: true,
                data: {
                    types: [],
                    monthly: [],
                    topTopics: [],
                    availableMonths: allMonths.map(formatMonthName),
                    selectedMonths: [],
                    grandTotal: 0
                }
            });
        }

        // 4. Получаем данные по выбранным месяцам
        console.log (selectedMonths);
        const dataResult = await client.query(
            `SELECT 
                "Month", 
                "Type", 
                "Topic", 
                SUM(COALESCE("Count", 0)) as count_total
             FROM opop_tematiks
             WHERE "Month" = ANY($1)
             GROUP BY "Month", "Type", "Topic"
             ORDER BY count_total DESC, "Type" ASC, "Topic" ASC`,
            [selectedMonths]
        );

        // 5. Агрегируем данные для фронта
        const typeAggregation = {};
        let grandTotal = 0;

        dataResult.rows.forEach(row => {
            const type = row.Type || 'Без типа';
            const month = row.Month;
            const topic = row.Topic || 'Без темы';
            const count = parseInt(row.count_total) || 0;

            if (!typeAggregation[type]) {
                typeAggregation[type] = {
                    name: type,
                    total: 0,
                    topics: {},
                    color: getColorForType(type),
                    monthlyData: {}
                };
                selectedMonths.forEach(m => {
                    typeAggregation[type].monthlyData[m] = 0;
                });
            }

            if (!typeAggregation[type].topics[topic]) {
                typeAggregation[type].topics[topic] = {
                    name: topic,
                    total: 0,
                    monthlyData: {}
                };
                selectedMonths.forEach(m => {
                    typeAggregation[type].topics[topic].monthlyData[m] = 0;
                });
            }

            typeAggregation[type].total += count;
            typeAggregation[type].topics[topic].total += count;
            typeAggregation[type].topics[topic].monthlyData[month] += count;
            typeAggregation[type].monthlyData[month] += count;
            grandTotal += count;
        });

        Object.values(typeAggregation).forEach(type => {
            type.topics = Object.values(type.topics).sort((a, b) => b.total - a.total);
        });
        const sortedTypes = Object.values(typeAggregation).sort((a, b) => b.total - a.total);

        // Топ тем
        const allTopics = [];
        Object.values(typeAggregation).forEach(type => {
            type.topics.forEach(topic => {
                allTopics.push({
                    topic: topic.name,
                    type: type.name,
                    total: topic.total,
                    monthlyData: topic.monthlyData
                });
            });
        });
        const topTopics = allTopics.sort((a, b) => b.total - a.total).slice(0, 20);

        // Для графика
        const monthlyChartData = selectedMonths.map(month => ({
            month,
            monthName: formatMonthNameForDisplay(month),
            types: sortedTypes.reduce((acc, type) => {
                acc[type.name] = type.monthlyData[month] || 0;
                return acc;
            }, {}),
            total: sortedTypes.reduce((sum, type) => sum + (type.monthlyData[month] || 0), 0)
        }));

        res.json({
            success: true,
            data: {
                types: sortedTypes,
                monthly: monthlyChartData,
                topTopics: topTopics,
                availableMonths: allMonths.map(formatMonthName),
                selectedMonths: selectedMonths.map(formatMonthName),
                grandTotal: grandTotal
            },
            executionTime: `${Date.now() - start}ms`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`[ERROR] OPOP Topics API Error:`, error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении данных по типам обращений',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

function formatMonthName(month) {
    const monthNames = {
        'Январь': { display: 'Январь', order: 1 },
        'Февраль': { display: 'Февраль', order: 2 },
        'Март': { display: 'Март', order: 3 },
        'Апрель': { display: 'Апрель', order: 4 },
        'Май': { display: 'Май', order: 5 },
        'Июнь': { display: 'Июнь', order: 6 },
        'Июль': { display: 'Июль', order: 7 },
        'Август': { display: 'Август', order: 8 },
        'Сентябрь': { display: 'Сентябрь', order: 9 },
        'Октябрь': { display: 'Октябрь', order: 10 },
        'Ноябрь': { display: 'Ноябрь', order: 11 },
        'Декабрь': { display: 'Декабрь', order: 12 }
    };
    if (monthNames[month]) {
        return { value: month, display: monthNames[month].display, order: monthNames[month].order };
    }
    return { value: month, display: month, order: 99 };
}

function formatMonthNameForDisplay(month) {
    return formatMonthName(month).display;
}

function getColorForType(type) {
    const colors = {
        'Жалоба': '#ef4444',
        'Заявка': '#f59e0b',
        'Другое': '#10b981',
        'Консультация': '#3b82f6'
    };
    return colors[type] || `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
}

// API для получения статистики ООДВГК
router.get('/api/oodvgk-stats', async (req, res) => {
    const start = Date.now();
    let client;
    
    try {
        console.log('[DEBUG] OODVGK Stats API called');
        
        client = await pool.connect();
        
        // Получаем данные из таблицы (берем последнюю запись)
        const dataQuery = `
            SELECT 
                date_period,
                violations_processed,
                transferred_to_kno,
                share_transferred_violations,
                issued_resolutions,
                total_amount,
                paid_amount,
                payment_share,
                created_at,
                updated_at
            FROM oodvgk_stat 
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        const dataResult = await client.query(dataQuery);
        console.log('[DEBUG] Data query returned', dataResult.rows.length, 'rows');
        
        if (dataResult.rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    statistics: [],
                    chartData: null,
                    summary: {
                        totalViolations: 0,
                        totalTransferred: 0,
                        totalResolutions: 0,
                        totalAmount: 0,
                        totalPaid: 0
                    }
                }
            });
        }
        
        const record = dataResult.rows[0];
        
        // Формируем статистику для отображения
        const statistics = [
            {
                title: 'Обработано нарушений',
                value: record.violations_processed,
                icon: 'violations',
                color: '#ef4444',
                description: 'Общее количество обработанных нарушений',
                iconText: '⚠️'
            },
            {
                title: 'Передано в КНО',
                value: record.transferred_to_kno,
                icon: 'transfer',
                color: '#f59e0b',
                description: `${record.share_transferred_violations}% от общего количества`,
                iconText: '📤'
            },
            {
                title: 'Вынесено постановлений',
                value: record.issued_resolutions,
                icon: 'resolutions',
                color: '#10b981',
                description: 'Количество вынесенных постановлений',
                iconText: '📋'
            },
            {
                title: 'Общая сумма штрафов',
                value: record.total_amount,
                icon: 'money',
                color: '#3b82f6',
                description: 'Общая сумма наложенных штрафов',
                format: 'currency',
                iconText: '💰'
            },
            {
                title: 'Оплачено штрафов',
                value: record.paid_amount,
                icon: 'paid',
                color: '#8b5cf6',
                description: `${record.payment_share}% от общей суммы`,
                format: 'currency',
                iconText: '✅'
            }
        ];
        
        // Формируем данные для графиков
        const chartData = {
            violationsChart: {
                labels: ['Обработано', 'Передано в КНО', 'Постановления'],
                data: [
                    record.violations_processed,
                    record.transferred_to_kno,
                    record.issued_resolutions
                ],
                colors: ['#ef4444', '#f59e0b', '#10b981']
            },
            paymentsChart: {
                labels: ['Неоплачено', 'Оплачено'],
                data: [
                    record.total_amount - record.paid_amount,
                    record.paid_amount
                ],
                colors: ['#e5e7eb', '#8b5cf6']
            },
            efficiencyMetrics: {
                transferRate: parseFloat(record.share_transferred_violations) || 0,
                paymentRate: parseFloat(record.payment_share) || 0,
                resolutionRate: record.transferred_to_kno > 0 
                    ? Math.round((record.issued_resolutions / record.transferred_to_kno) * 100) 
                    : 0
            }
        };
        
        const summary = {
            totalViolations: record.violations_processed,
            totalTransferred: record.transferred_to_kno,
            totalResolutions: record.issued_resolutions,
            totalAmount: record.total_amount,
            totalPaid: record.paid_amount,
            period: record.date_period
        };
        
        console.log('[DEBUG] Successfully processed data, sending response');
        
        res.json({
            success: true,
            data: {
                statistics: statistics,
                chartData: chartData,
                summary: summary,
                recordInfo: {
                    createdAt: record.created_at,
                    updatedAt: record.updated_at,
                    period: record.date_period
                }
            },
            executionTime: `${Date.now() - start}ms`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`[ERROR] OODVGK Stats API Error:`, error);
        console.error(`[ERROR] Stack trace:`, error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении статистики ООДВГК',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});


//Верификация запросы
// Главный API endpoint для получения статистики верификации
router.get('/api/verification-stats', async (req, res) => {
    const startTime = Date.now();
    let client;
    
    try {
        const { tab, period } = req.query;
        const user = req.headers['x-user'] || 'Temioka';
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        
        console.log(`📊 [${timestamp}] Запрос статистики от пользователя ${user}: вкладка=${tab}, период=${period}`);
        
        // Валидация параметров
        if (!tab) {
            return res.status(400).json({
                success: false,
                message: 'Параметр tab является обязательным',
                error: 'Отсутствует обязательный параметр tab'
            });
        }

        // Проверяем валидность вкладки
        const validTabs = ['general', 'confirmed', 'vpn'];
        if (!validTabs.includes(tab)) {
            return res.status(400).json({
                success: false,
                message: `Неизвестная вкладка: ${tab}. Доступные: ${validTabs.join(', ')}`,
                error: `Недопустимое значение параметра tab: ${tab}`
            });
        }
        
        client = await pool.connect();
        const dateRange = calculateDateRange(period);
        
        // Проверяем наличие данных за указанный период
        const hasDataCheck = await checkDataAvailability(client, dateRange, tab);
        
        let responseData = {};
        
        // Если данных нет, возвращаем пустую структуру
        if (!hasDataCheck.hasData) {
            console.log(`⚠️ [${timestamp}] Нет данных для вкладки ${tab} за период ${formatDateRange(dateRange.startDate, dateRange.endDate)}`);
            responseData = getEmptyTabData(tab, hasDataCheck.message);
        } else {
            // Данные есть, загружаем их
            switch (tab) {
                case 'general':
                    responseData = await getGeneralStatistics(client, dateRange, user);
                    break;
                case 'confirmed':
                    responseData = await getConfirmedStatistics(client, dateRange, user);
                    break;
                case 'vpn':
                    responseData = await getVpnStatistics(client, dateRange, user);
                    break;
            }
        }
        
        const executionTime = Date.now() - startTime;
        console.log(`✅ [${timestamp}] Статистика успешно получена за ${executionTime}мс`);
        
        res.json({
            success: true,
            data: responseData,
            metadata: {
                user: user,
                timestamp: timestamp,
                tab: tab,
                period: period,
                executionTime: `${executionTime}мс`,
                recordsCount: responseData.tableData?.length || 0,
                hasData: hasDataCheck.hasData,
                dataMessage: hasDataCheck.message,
                dateRange: {
                    start: dateRange.startDate.toISOString().split('T')[0],
                    end: dateRange.endDate.toISOString().split('T')[0]
                }
            }
        });
        
    } catch (error) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const executionTime = Date.now() - startTime;
        
        console.error(`❌ [${timestamp}] Ошибка API верификации (${executionTime}мс): ${error.message}`);
        
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении статистики верификации',
            error: error.message,
            metadata: {
                user: req.headers['x-user'] || 'Temioka',
                timestamp: timestamp,
                executionTime: `${executionTime}мс`,
                tab: req.query.tab || 'unknown'
            }
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Функция проверки наличия данных
async function checkDataAvailability(client, dateRange, tab) {
    const { startDate, endDate } = dateRange;
    
    try {
        let checkQuery;
        let tableName;
        
        switch (tab) {
            case 'general':
                checkQuery = `
                    SELECT 
                        COUNT(*) as record_count,
                        COALESCE(SUM(number_of_trips), 0) as total_trips,
                        COALESCE(SUM(amount_of_trips), 0) as total_amount
                    FROM verif_stat 
                    WHERE date_of_travel BETWEEN $1 AND $2
                `;
                tableName = 'verif_stat';
                break;
                
            case 'confirmed':
                checkQuery = `
                    SELECT 
                        COUNT(*) as record_count,
                        COALESCE(SUM(confirmed), 0) as total_confirmed,
                        COALESCE(SUM(total_trips_by_grn_including_vpn), 0) as total_trips
                    FROM verif_podtverzdeno 
                    WHERE date_of_travel BETWEEN $1 AND $2
                `;
                tableName = 'verif_podtverzdeno';
                break;
                
            case 'vpn':
                checkQuery = `
                    SELECT 
                        COUNT(*) as record_count,
                        COALESCE(SUM(vpn), 0) as total_vpn,
                        COALESCE(SUM(vpn_amount), 0) as total_amount
                    FROM verif_vpn 
                    WHERE date_of_travel BETWEEN $1 AND $2
                `;
                tableName = 'verif_vpn';
                break;
                
            default:
                return { hasData: false, message: `Неизвестная вкладка: ${tab}` };
        }
        
        const result = await client.query(checkQuery, [startDate, endDate]);
        const data = result.rows[0];
        
        const recordCount = parseInt(data.record_count) || 0;
        const hasRecords = recordCount > 0;
        
        // Дополнительная проверка на наличие значимых данных
        let hasSignificantData = false;
        if (tab === 'general') {
            hasSignificantData = (parseInt(data.total_trips) > 0) || (parseFloat(data.total_amount) > 0);
        } else if (tab === 'confirmed') {
            hasSignificantData = (parseInt(data.total_confirmed) > 0) || (parseInt(data.total_trips) > 0);
        } else if (tab === 'vpn') {
            hasSignificantData = (parseInt(data.total_vpn) > 0) || (parseFloat(data.total_amount) > 0);
        }
        
        if (!hasRecords) {
            return {
                hasData: false,
                message: `Нет записей в таблице ${tableName} за указанный период`
            };
        }
        
        if (!hasSignificantData) {
            return {
                hasData: false,
                message: `В таблице ${tableName} найдено ${recordCount} записей, но все значения равны нулю`
            };
        }
        
        console.log(`✅ Найдены данные в ${tableName}: записей=${recordCount}, значимые_данные=да`);
        
        return {
            hasData: true,
            message: `Найдено ${recordCount} записей с данными в таблице ${tableName}`
        };
        
    } catch (error) {
        console.error(`❌ Ошибка проверки доступности данных для ${tab}: ${error.message}`);
        return {
            hasData: false,
            message: `Ошибка при проверке данных: ${error.message}`
        };
    }
}

// Функция возврата пустых данных для вкладки
function getEmptyTabData(tab, message = 'Нет данных за указанный период') {
    const baseData = {
        tableData: [],
        monthlyData: {
            labels: ['Нет данных'],
            datasets: [{
                label: 'Нет данных за период',
                data: [0],
                backgroundColor: 'rgba(156, 163, 175, 0.5)',
                borderColor: '#9ca3af',
                borderWidth: 1
            }]
        },
        dailyData: {
            labels: ['Нет данных'],
            datasets: [{
                label: 'Нет данных за период',
                data: [0],
                borderColor: '#9ca3af',
                backgroundColor: 'rgba(156, 163, 175, 0.1)',
                fill: true
            }]
        },
        amountTrend: { labels: [''], values: [0] },
        countTrend: { labels: [''], values: [0] },
        dataMessage: message,
        isEmpty: true
    };

    switch (tab) {
        case 'general':
            return {
                ...baseData,
                totalAmount: 0,
                totalCount: 0,
                confirmedCount: 0,
                confirmationRate: 0,
                gisAmount: 0,
                confirmedTrend: { labels: [''], values: [0] },
                rateTrend: { labels: [''], values: [0] },
                confirmedAmountTrend: { labels: [''], values: [0] }
            };
            
        case 'confirmed':
            return {
                ...baseData,
                confirmedCount: 0,
                confirmedAmount: 0,
                paidCount: 0,
                paidAmount: 0,
                paidPercentage: 0,
                avgTime: 0,
                sourcesData: {
                    labels: ['Нет данных'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e5e7eb'],
                        borderWidth: 0
                    }]
                },
                percentageTrend: { labels: [''], values: [0] },
                gisTrend: { labels: [''], values: [0] },
                paidTrend: { labels: [''], values: [0] },
                timeTrend: { labels: [''], values: [0] }
            };
            
        case 'vpn':
            return {
                ...baseData,
                vpnCount: 0,
                totalVpn: 0,
                corrected: 0,
                correctedPercentage: 0,
                vpnRemoved: 0,
                vpnRemovedAmount: 0,
                totalTrend: { labels: [''], values: [0] },
                correctedTrend: { labels: [''], values: [0] },
                removedTrend: { labels: [''], values: [0] },
                removedAmountTrend: { labels: [''], values: [0] }
            };
            
        default:
            return baseData;
    }
}

// ИСПРАВЛЕННАЯ функция получения общей статистики
async function getGeneralStatistics(client, dateRange, user) {
    const { startDate, endDate } = dateRange;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
        console.log(`📈 [${timestamp}] Загрузка общей статистики за ${formatDateRange(startDate, endDate)}`);
        
        // Основной запрос для общей статистики с правильными расчетами
        const mainStatsQuery = `
            SELECT 
                COALESCE(SUM(amount_of_trips), 0) as total_amount,
                COALESCE(SUM(number_of_trips), 0) as total_count,
                COALESCE(SUM(number_of_confirmed_trips), 0) as confirmed_count,
                COALESCE(SUM(amount_of_confirmed_trips), 0) as confirmed_amount,
                COALESCE(SUM(amount_of_paid_confirmed_trips_in_gis), 0) as gis_amount,
                CASE 
                    WHEN SUM(number_of_trips) > 0 
                    THEN ROUND((SUM(number_of_confirmed_trips)::decimal / SUM(number_of_trips)::decimal * 100), 1)
                    ELSE 0 
                END as confirmation_rate
            FROM verif_stat 
            WHERE date_of_travel BETWEEN $1 AND $2
        `;

        const [mainStats, tableData, monthlyData, dailyData] = await Promise.all([
            client.query(mainStatsQuery, [startDate, endDate]),
            getGeneralTableData(client, dateRange),
            getGeneralMonthlyData(client, dateRange),
            getGeneralDailyData(client, dateRange)
        ]);
        
        const stats = mainStats.rows[0];
        
        // ИСПРАВЛЕННЫЕ значения с правильным преобразованием типов
        const totalAmount = parseFloat(stats.total_amount) || 0;
        const totalCount = parseInt(stats.total_count) || 0;
        const confirmedCount = parseInt(stats.confirmed_count) || 0;
        const confirmedAmount = parseFloat(stats.confirmed_amount) || 0;
        const gisAmount = parseFloat(stats.gis_amount) || 0;
        const confirmationRate = parseFloat(stats.confirmation_rate) || 0;
        
        console.log(`✅ [${timestamp}] Общая статистика: поездок=${totalCount}, сумма=${formatMoney(totalAmount)}, подтверждено=${confirmedCount} (${confirmationRate}%), ГИС=${formatMoney(gisAmount)}`);

        return {
            totalAmount,
            totalCount, 
            confirmedCount,
            confirmedAmount,
            confirmationRate,
            gisAmount,
            
            monthlyData,
            dailyData,
            tableData,

            // Правильные тренды для мини-графиков
            amountTrend: await generateTrendChart(client, 'general_amount', dateRange),
            countTrend: await generateTrendChart(client, 'general_count', dateRange), 
            confirmedTrend: await generateTrendChart(client, 'general_confirmed', dateRange),
            confirmedAmountTrend: await generateTrendChart(client, 'general_confirmed_amount', dateRange),
            rateTrend: await generateTrendChart(client, 'general_rate', dateRange),
            
            isEmpty: false,
            dataMessage: `Загружены данные за период ${formatDateRange(startDate, endDate)}`
        };
    } catch (error) {
        console.error(`❌ [${timestamp}] Ошибка получения общей статистики: ${error.message}`);
        throw error;
    }
}

// ИСПРАВЛЕННАЯ функция получения статистики подтвержденных поездок  
async function getConfirmedStatistics(client, dateRange, user) {
    const { startDate, endDate } = dateRange;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    try {
        console.log(`💳 [${timestamp}] Загрузка статистики подтвержденных поездок за ${formatDateRange(startDate, endDate)}`);
        
        // ИСПРАВЛЕННЫЕ запросы с правильными расчетами
        const confirmedStatsQuery = `
            SELECT 
                COALESCE(SUM(confirmed), 0) as confirmed_count,
                COALESCE(SUM(adjusted_after_confirmation), 0) as adjusted_trips,
                COALESCE(AVG(average_confirmation_time_hours), 0) as avg_time,
                COALESCE(SUM(confirmed_by_verification_department), 0) as dept_confirmed,
                COALESCE(SUM(confirmed_automatically), 0) as auto_confirmed,
                COALESCE(SUM(confirmed_by_other_employees), 0) as other_confirmed
            FROM verif_podtverzdeno 
            WHERE date_of_travel BETWEEN $1 AND $2
        `;
        
        // Получаем сумму и количество подтвержденных из verif_stat
        const confirmedFromStatQuery = `
            SELECT 
                COALESCE(SUM(amount_of_confirmed_trips), 0) as confirmed_amount,
                COALESCE(SUM(number_of_confirmed_trips), 0) as confirmed_count_stat
            FROM verif_stat 
            WHERE date_of_travel BETWEEN $1 AND $2
        `;
        
        // Получаем данные об оплаченных из verif_stat
        const paidStatsQuery = `
            SELECT 
                COALESCE(SUM(number_of_paid_confirmed_trips), 0) as paid_count,
                COALESCE(SUM(amount_of_paid_confirmed_trips), 0) as paid_amount
            FROM verif_stat 
            WHERE date_of_travel BETWEEN $1 AND $2
        `;
        
        const [confirmedStats, confirmedFromStat, paidStats, monthlyData, tableData] = await Promise.all([
            client.query(confirmedStatsQuery, [startDate, endDate]),
            client.query(confirmedFromStatQuery, [startDate, endDate]),
            client.query(paidStatsQuery, [startDate, endDate]),
            getConfirmedMonthlyData(client, dateRange),
            getConfirmedTableData(client, dateRange)
        ]);
        
        const confirmed = confirmedStats.rows[0];
        const confirmedStat = confirmedFromStat.rows[0];
        const paid = paidStats.rows[0];
        
        // ПРАВИЛЬНЫЕ расчеты с использованием данных из разных таблиц
        const confirmedCount = Math.max(
            parseInt(confirmed.confirmed_count) || 0,
            parseInt(confirmedStat.confirmed_count_stat) || 0
        );
        const confirmedAmount = parseFloat(confirmedStat.confirmed_amount) || 0;
        const paidCount = parseInt(paid.paid_count) || 0;
        const paidAmount = parseFloat(paid.paid_amount) || 0;
        const avgTime = Math.round(parseFloat(confirmed.avg_time) || 0);
        
        // ИСПРАВЛЕННЫЙ расчет процента оплаченных
        const paidPercentage = confirmedCount > 0 ? 
            Math.round((paidCount / confirmedCount * 100) * 10) / 10 : 0;
        
        console.log(`✅ [${timestamp}] Подтвержденные: кол-во=${confirmedCount}, сумма=${formatMoney(confirmedAmount)}, оплачено=${paidCount} шт. на ${formatMoney(paidAmount)} (${paidPercentage}%), время=${avgTime}ч`);
        
        return {
            confirmedCount,
            confirmedAmount,
            paidCount,
            paidAmount, 
            paidPercentage,
            avgTime,
            
            monthlyData,
            tableData,
            sourcesData: buildConfirmedSourcesData(confirmed),
            
            // Правильные тренды
            countTrend: await generateTrendChart(client, 'confirmed_count', dateRange),
            amountTrend: await generateTrendChart(client, 'confirmed_amount', dateRange),
            percentageTrend: await generateTrendChart(client, 'confirmed_percentage', dateRange),
            timeTrend: await generateTrendChart(client, 'confirmed_time', dateRange),
            
            isEmpty: false,
            dataMessage: `Загружены данные за период ${formatDateRange(startDate, endDate)}`
        };
    } catch (error) {
        console.error(`❌ [${timestamp}] Ошибка получения статистики подтвержденных: ${error.message}`);
        throw error;
    }
}

// ИСПРАВЛЕННАЯ функция получения статистики ВПН
async function getVpnStatistics(client, dateRange, user) {
    const { startDate, endDate } = dateRange;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    try {
        console.log(`🚗 [${timestamp}] Загрузка статистики ВПН за ${formatDateRange(startDate, endDate)}`);
        
        const vpnStatsQuery = `
            SELECT 
                COALESCE(SUM(vpn), 0) as vpn_count,
                COALESCE(SUM(vpn_amount), 0) as total_vpn_amount,
                COALESCE(SUM(grn_with_symbols), 0) as corrected_vpn,
                COALESCE(SUM(vpn_removed), 0) as vpn_removed_count,
                COALESCE(SUM(amount_of_deleted_vpn), 0) as vpn_removed_amount
            FROM verif_vpn 
            WHERE date_of_travel BETWEEN $1 AND $2
        `;
        
        const [vpnStats, monthlyData, tableData] = await Promise.all([
            client.query(vpnStatsQuery, [startDate, endDate]),
            getVpnMonthlyData(client, dateRange),
            getVpnTableData(client, dateRange)
        ]);
        
        const stats = vpnStats.rows[0];
        
        // ИСПРАВЛЕННЫЕ расчеты с правильной обработкой нулевых значений
        const vpnCount = parseInt(stats.vpn_count) || 0;
        const totalVpnAmount = parseFloat(stats.total_vpn_amount) || 0;
        const correctedVpn = parseInt(stats.corrected_vpn) || 0;
        const vpnRemovedCount = parseInt(stats.vpn_removed_count) || 0;
        const vpnRemovedAmount = parseFloat(stats.vpn_removed_amount) || 0;
        
        // ПРАВИЛЬНЫЙ расчет процента скорректированных
        const correctedPercentage = vpnCount > 0 ? 
            Math.round((correctedVpn / vpnCount * 100) * 10) / 10 : 0;
        
        console.log(`✅ [${timestamp}] ВПН: всего=${vpnCount} на ${formatMoney(totalVpnAmount)}, скорректировано=${correctedVpn} (${correctedPercentage}%), удалено=${vpnRemovedCount} на ${formatMoney(vpnRemovedAmount)}`);
        
        return {
            vpnCount,
            totalVpn: totalVpnAmount,
            corrected: correctedVpn,
            correctedPercentage,
            vpnRemoved: vpnRemovedCount,
            vpnRemovedAmount,
            
            monthlyData,
            tableData,
            
            // Правильные тренды
            countTrend: await generateTrendChart(client, 'vpn_count', dateRange),
            amountTrend: await generateTrendChart(client, 'vpn_amount', dateRange),
            correctedTrend: await generateTrendChart(client, 'vpn_corrected', dateRange),
            removedTrend: await generateTrendChart(client, 'vpn_removed', dateRange),
            removedAmountTrend: await generateTrendChart(client, 'vpn_removed_amount', dateRange),
            
            isEmpty: false,
            dataMessage: `Загружены данные за период ${formatDateRange(startDate, endDate)}`
        };
        
    } catch (error) {
        console.error(`❌ [${timestamp}] Ошибка получения статистики ВПН: ${error.message}`);
        throw error;
    }
}

// ИСПРАВЛЕННАЯ функция генерации трендов с обработкой отсутствующих данных
async function generateTrendChart(client, trendType, dateRange = null) {
    try {
        let query;
        let params = [];
        
        // Используем переданный диапазон или последние 7 дней
        if (dateRange) {
            const { startDate, endDate } = dateRange;
            params = [startDate, endDate];
        }
        
        const dateFilter = dateRange ? 
            'WHERE date_of_travel BETWEEN $1 AND $2' : 
            'WHERE date_of_travel >= CURRENT_DATE - INTERVAL \'7 days\'';
        
        switch (trendType) {
            // Тренды для общей статистики
            case 'general_amount':
                query = `
                    SELECT date_of_travel, COALESCE(SUM(amount_of_trips), 0) as value 
                    FROM verif_stat ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
                
            case 'general_count':
                query = `
                    SELECT date_of_travel, COALESCE(SUM(number_of_trips), 0) as value 
                    FROM verif_stat ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
                
            case 'general_confirmed':
                query = `
                    SELECT date_of_travel, COALESCE(SUM(number_of_confirmed_trips), 0) as value 
                    FROM verif_stat ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
                
            case 'general_confirmed_amount':
                query = `
                    SELECT date_of_travel, COALESCE(SUM(amount_of_confirmed_trips), 0) as value 
                    FROM verif_stat ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
                
            case 'general_rate':
                query = `
                    SELECT date_of_travel, 
                           CASE 
                               WHEN SUM(number_of_trips) > 0 
                               THEN ROUND((SUM(number_of_confirmed_trips)::decimal / SUM(number_of_trips)::decimal * 100), 1)
                               ELSE 0 
                           END as value
                    FROM verif_stat ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
            
            // Тренды для подтвержденных поездок
            case 'confirmed_count':
                query = `
                    SELECT date_of_travel, COALESCE(SUM(confirmed), 0) as value 
                    FROM verif_podtverzdeno ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
                
            case 'confirmed_amount':
                query = `
                    SELECT date_of_travel, COALESCE(SUM(amount_of_confirmed_trips), 0) as value 
                    FROM verif_stat ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
                
            case 'confirmed_percentage':
                query = `
                    SELECT date_of_travel, 
                           COALESCE(AVG(share_of_adjusted_after_confirmation * 100), 0) as value 
                    FROM verif_podtverzdeno ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
                
            case 'confirmed_time':
                query = `
                    SELECT date_of_travel, COALESCE(AVG(average_confirmation_time_hours), 0) as value 
                    FROM verif_podtverzdeno ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
            
            // Тренды для ВПН
            case 'vpn_count':
                query = `
                    SELECT date_of_travel, COALESCE(SUM(vpn), 0) as value 
                    FROM verif_vpn ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
                
            case 'vpn_amount':
                query = `
                    SELECT date_of_travel, COALESCE(SUM(vpn_amount), 0) as value 
                    FROM verif_vpn ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
                
            case 'vpn_corrected':
                query = `
                    SELECT date_of_travel, COALESCE(SUM(grn_with_symbols), 0) as value 
                    FROM verif_vpn ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
                
            case 'vpn_removed':
                query = `
                    SELECT date_of_travel, COALESCE(SUM(vpn_removed), 0) as value 
                    FROM verif_vpn ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
                
            case 'vpn_removed_amount':
                query = `
                    SELECT date_of_travel, COALESCE(SUM(amount_of_deleted_vpn), 0) as value 
                    FROM verif_vpn ${dateFilter}
                    GROUP BY date_of_travel ORDER BY date_of_travel
                `;
                break;
            
            default:
                // Возвращаем нулевые значения для неизвестных типов
                return {
                    labels: ['', '', '', '', '', '', ''],
                    values: [0, 0, 0, 0, 0, 0, 0]
                };
        }
        
        const result = await client.query(query, params);
        
        // Если нет данных, возвращаем нулевые значения  
        if (!result.rows || result.rows.length === 0) {
            console.log(`⚠️ Нет данных для тренда ${trendType}`);
            return {
                labels: ['', '', '', '', '', '', ''],
                values: [0, 0, 0, 0, 0, 0, 0]
            };
        }
        
        return {
            labels: result.rows.map(() => ''),
            values: result.rows.map(row => {
                const value = parseFloat(row.value) || 0;
                return Math.round(value * 100) / 100; // Округляем до 2 знаков после запятой
            })
        };
        
    } catch (error) {
        console.log(`⚠️ Ошибка генерации тренда ${trendType}: ${error.message}`);
        return {
            labels: ['', '', '', '', '', '', ''],
            values: [0, 0, 0, 0, 0, 0, 0]
        };
    }
}

// ИСПРАВЛЕННАЯ функция получения месячных данных для общей статистики
async function getGeneralMonthlyData(client, dateRange) {
    const { startDate, endDate } = dateRange;
    
    try {
        const query = `
            SELECT 
                EXTRACT(YEAR FROM date_of_travel) as year,
                EXTRACT(MONTH FROM date_of_travel) as month,
                COALESCE(SUM(number_of_trips), 0) as trips_count,
                COALESCE(SUM(amount_of_trips), 0) as trips_amount,
                COALESCE(SUM(number_of_confirmed_trips), 0) as confirmed_count,
                COALESCE(SUM(amount_of_confirmed_trips), 0) as confirmed_amount
            FROM verif_stat 
            WHERE date_of_travel BETWEEN $1 AND $2
            GROUP BY EXTRACT(YEAR FROM date_of_travel), EXTRACT(MONTH FROM date_of_travel)
            HAVING SUM(number_of_trips) > 0 OR SUM(amount_of_trips) > 0
            ORDER BY year, month
        `;
        
        const result = await client.query(query, [startDate, endDate]);
        
        // Если нет данных, возвращаем заглушку
        if (!result.rows || result.rows.length === 0) {
            return {
                labels: ['Нет данных'],
                datasets: [{
                    label: 'Нет данных за период',
                    data: [0],
                    backgroundColor: 'rgba(156, 163, 175, 0.5)',
                    borderColor: '#9ca3af',
                    borderWidth: 1
                }]
            };
        }
        
        const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        
        return {
            labels: result.rows.map(row => `${monthNames[row.month - 1]} ${row.year}`),
            datasets: [
                {
                    label: 'Сумма поездок',
                    data: result.rows.map(row => Math.round(parseFloat(row.trips_amount) || 0)),
                    backgroundColor: 'rgba(255, 107, 53, 0.8)',
                    borderColor: '#ff6b35',
                    borderWidth: 2,
                    borderRadius: 4
                },
                {
                    label: 'Сумма подтвержденных',
                    data: result.rows.map(row => Math.round(parseFloat(row.confirmed_amount) || 0)),
                    backgroundColor: 'rgba(255, 133, 85, 0.8)',
                    borderColor: '#ff8555',
                    borderWidth: 2,
                    borderRadius: 4
                }
            ]
        };
    } catch (error) {
        console.log(`⚠️ Ошибка получения месячных данных: ${error.message}`);
        return {
            labels: ['Ошибка'],
            datasets: [{
                label: 'Ошибка загрузки данных',
                data: [0],
                backgroundColor: 'rgba(239, 68, 68, 0.8)'
            }]
        };
    }
}

// ИСПРАВЛЕННАЯ функция получения дневных данных
async function getGeneralDailyData(client, dateRange) {
    const { startDate, endDate } = dateRange;
    
    try {
        const query = `
            SELECT 
                date_of_travel,
                COALESCE(SUM(amount_of_trips), 0) as trips_amount,
                COALESCE(SUM(number_of_trips), 0) as trips_count
            FROM verif_stat 
            WHERE date_of_travel BETWEEN $1 AND $2
            GROUP BY date_of_travel
            HAVING SUM(amount_of_trips) > 0 OR SUM(number_of_trips) > 0
            ORDER BY date_of_travel
        `;
        
        const result = await client.query(query, [startDate, endDate]);
        
        if (!result.rows || result.rows.length === 0) {
            return {
                labels: ['Нет данных'],
                datasets: [{
                    label: 'Нет данных за период',
                    data: [0],
                    borderColor: '#9ca3af',
                    backgroundColor: 'rgba(156, 163, 175, 0.1)',
                    fill: true
                }]
            };
        }
        
        return {
            labels: result.rows.map(row => 
                new Date(row.date_of_travel).toLocaleDateString('ru-RU', { 
                    day: 'numeric', 
                    month: 'short' 
                })
            ),
            datasets: [
                {
                    label: 'Ежедневная сумма поездок',
                    data: result.rows.map(row => Math.round(parseFloat(row.trips_amount) || 0)),
                    borderColor: '#ff6b35',
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: '#ff6b35',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }
            ]
        };
    } catch (error) {
        console.log(`⚠️ Ошибка получения дневных данных: ${error.message}`);
        return {
            labels: ['Ошибка'],
            datasets: [{
                label: 'Ошибка загрузки данных',
                data: [0],
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true
            }]
        };
    }
}

// ИСПРАВЛЕННАЯ функция получения данных таблицы для общей статистики
async function getGeneralTableData(client, dateRange) {
    const { startDate, endDate } = dateRange;
    
    try {
        const query = `
            SELECT 
                date_of_travel,
                COALESCE(number_of_trips, 0) as number_of_trips,
                COALESCE(amount_of_trips, 0) as amount_of_trips,
                COALESCE(number_of_confirmed_trips, 0) as number_of_confirmed_trips,
                CASE 
                    WHEN number_of_trips > 0 
                    THEN ROUND((number_of_confirmed_trips::decimal / number_of_trips::decimal * 100), 1)
                    ELSE 0 
                END as confirmation_percentage
            FROM verif_stat 
            WHERE date_of_travel BETWEEN $1 AND $2
              AND (number_of_trips > 0 OR amount_of_trips > 0)
            ORDER BY date_of_travel DESC
            LIMIT 100
        `;
        
        const result = await client.query(query, [startDate, endDate]);
        
        console.log(`📋 Получено ${result.rows.length} записей для таблицы общей статистики`);
        
        return result.rows.map((row, index) => ({
            id: `general-${index}-${Date.now()}`,
            date: new Date(row.date_of_travel).toLocaleDateString('ru-RU'),
            trips: parseInt(row.number_of_trips) || 0,
            amount: Math.round(parseFloat(row.amount_of_trips) || 0),
            confirmed: parseInt(row.number_of_confirmed_trips) || 0,
            percentage: parseFloat(row.confirmation_percentage) || 0
        }));
        
    } catch (error) {
        console.error(`❌ Ошибка получения данных таблицы общей статистики: ${error.message}`);
        return [];
    }
}

// Остальные функции (getConfirmedMonthlyData, getConfirmedTableData, buildConfirmedSourcesData, getVpnMonthlyData, getVpnTableData) 
// также нуждаются в аналогичных исправлениях...

// ИСПРАВЛЕННАЯ функция получения месячных данных для подтвержденных поездок
async function getConfirmedMonthlyData(client, dateRange) {
    const { startDate, endDate } = dateRange;
    
    try {
        const query = `
            SELECT 
                EXTRACT(YEAR FROM date_of_travel) as year,
                EXTRACT(MONTH FROM date_of_travel) as month,
                COALESCE(SUM(total_trips_by_grn_including_vpn), 0) as total_trips,
                COALESCE(SUM(confirmed), 0) as confirmed_trips,
                COALESCE(SUM(adjusted_after_confirmation), 0) as adjusted_trips
            FROM verif_podtverzdeno 
            WHERE date_of_travel BETWEEN $1 AND $2
            GROUP BY EXTRACT(YEAR FROM date_of_travel), EXTRACT(MONTH FROM date_of_travel)
            HAVING SUM(confirmed) > 0 OR SUM(total_trips_by_grn_including_vpn) > 0
            ORDER BY year, month
        `;
        
        const result = await client.query(query, [startDate, endDate]);
        
        if (!result.rows || result.rows.length === 0) {
            return {
                labels: ['Нет данных'],
                datasets: [{
                    label: 'Нет данных за период',
                    data: [0],
                    backgroundColor: 'rgba(156, 163, 175, 0.5)'
                }]
            };
        }
        
        const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        
        return {
            labels: result.rows.map(row => `${monthNames[row.month - 1]} ${row.year}`),
            datasets: [
                {
                    label: 'Всего поездок',
                    data: result.rows.map(row => parseInt(row.total_trips) || 0),
                    backgroundColor: 'rgba(255, 107, 53, 0.7)',
                    borderColor: '#ff6b35',
                    borderWidth: 2,
                    borderRadius: 4
                },
                {
                    label: 'Подтверждено',
                    data: result.rows.map(row => parseInt(row.confirmed_trips) || 0),
                    backgroundColor: 'rgba(255, 133, 85, 0.8)',
                    borderColor: '#ff8555',
                    borderWidth: 2,
                    borderRadius: 4
                }
            ]
        };
        
    } catch (error) {
        console.error(`❌ Ошибка получения месячных данных подтвержденных: ${error.message}`);
        return {
            labels: ['Ошибка'],
            datasets: [{
                label: 'Ошибка загрузки',
                data: [0],
                backgroundColor: 'rgba(239, 68, 68, 0.8)'
            }]
        };
    }
}

// Функция получения данных таблицы для подтвержденных поездок
async function getConfirmedTableData(client, dateRange) {
    const { startDate, endDate } = dateRange;
    
    try {
        const query = `
            SELECT 
                p.date_of_travel,
                COALESCE(p.total_trips_by_grn_including_vpn, 0) as total_trips,
                COALESCE(p.confirmed, 0) as confirmed_trips,
                COALESCE(s.amount_of_paid_confirmed_trips, 0) as paid_amount,
                COALESCE(p.average_confirmation_time_hours, 0) as avg_time
            FROM verif_podtverzdeno p
            LEFT JOIN verif_stat s ON p.date_of_travel = s.date_of_travel
            WHERE p.date_of_travel BETWEEN $1 AND $2
              AND (p.confirmed > 0 OR p.total_trips_by_grn_including_vpn > 0)
            ORDER BY p.date_of_travel DESC
            LIMIT 100
        `;
        
        const result = await client.query(query, [startDate, endDate]);
        
        return result.rows.map((row, index) => ({
            id: `confirmed-${index}-${Date.now()}`,
            date: new Date(row.date_of_travel).toLocaleDateString('ru-RU'),
            totalTrips: parseInt(row.total_trips) || 0,
            confirmedTrips: parseInt(row.confirmed_trips) || 0,
            paidAmount: Math.round(parseFloat(row.paid_amount) || 0),
            avgTime: Math.round(parseFloat(row.avg_time) * 10) / 10 || 0
        }));
        
    } catch (error) {
        console.error(`❌ Ошибка получения данных таблицы подтвержденных поездок: ${error.message}`);
        return [];
    }
}

// ИСПРАВЛЕННАЯ функция построения данных источников подтверждения
function buildConfirmedSourcesData(stats) {
    try {
        const deptConfirmed = parseInt(stats.dept_confirmed) || 0;
        const autoConfirmed = parseInt(stats.auto_confirmed) || 0;
        const otherConfirmed = parseInt(stats.other_confirmed) || 0;
        const total = deptConfirmed + autoConfirmed + otherConfirmed;
        
        if (total === 0) {
            return {
                labels: ['Нет данных'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#e5e7eb'],
                    borderWidth: 0
                }]
            };
        }
        
        return {
            labels: [
                `Отдел верификации (${Math.round((deptConfirmed / total) * 100)}%)`,
                `Автоматически (${Math.round((autoConfirmed / total) * 100)}%)`,
                `Другие сотрудники (${Math.round((otherConfirmed / total) * 100)}%)`
            ],
            datasets: [{
                data: [deptConfirmed, autoConfirmed, otherConfirmed],
                backgroundColor: ['#ff6b35', '#ff8555', '#10b981'],
                borderWidth: 0,
                hoverBackgroundColor: ['#e55a2b', '#e5713d', '#059669']
            }]
        };
        
    } catch (error) {
        console.log(`⚠️ Ошибка построения данных источников: ${error.message}`);
        return {
            labels: ['Ошибка'],
            datasets: [{
                data: [1],
                backgroundColor: ['#ef4444'],
                borderWidth: 0
            }]
        };
    }
}

// ИСПРАВЛЕННАЯ функция получения месячных данных для ВПН
async function getVpnMonthlyData(client, dateRange) {
    const { startDate, endDate } = dateRange;
    
    try {
        const query = `
            SELECT 
                EXTRACT(YEAR FROM date_of_travel) as year,
                EXTRACT(MONTH FROM date_of_travel) as month,
                COALESCE(SUM(vpn), 0) as vpn_count,
                COALESCE(SUM(grn_with_symbols), 0) as corrected_vpn,
                COALESCE(SUM(vpn_amount), 0) as vpn_amount
            FROM verif_vpn 
            WHERE date_of_travel BETWEEN $1 AND $2
            GROUP BY EXTRACT(YEAR FROM date_of_travel), EXTRACT(MONTH FROM date_of_travel)
            HAVING SUM(vpn) > 0 OR SUM(vpn_amount) > 0
            ORDER BY year, month
        `;
        
        const result = await client.query(query, [startDate, endDate]);
        
        if (!result.rows || result.rows.length === 0) {
            return {
                labels: ['Нет данных'],
                datasets: [{
                    label: 'Нет данных ВПН',
                    data: [0],
                    backgroundColor: 'rgba(156, 163, 175, 0.5)',
                    type: 'bar'
                }]
            };
        }
        
        const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        
        return {
            labels: result.rows.map(row => `${monthNames[row.month - 1]} ${row.year}`),
            datasets: [
                {
                    label: 'Количество ВПН',
                    data: result.rows.map(row => parseInt(row.vpn_count) || 0),
                    backgroundColor: 'rgba(255, 107, 53, 0.7)',
                    borderColor: '#ff6b35',
                    borderWidth: 2,
                    type: 'bar',
                    yAxisID: 'y'
                },
                {
                    label: 'Скорректировано',
                    data: result.rows.map(row => parseInt(row.corrected_vpn) || 0),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    type: 'line',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        };
        
    } catch (error) {
        console.error(`❌ Ошибка получения месячных данных ВПН: ${error.message}`);
        return {
            labels: ['Ошибка'],
            datasets: [{
                label: 'Ошибка загрузки',
                data: [0],
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                type: 'bar'
            }]
        };
    }
}

// Функция получения данных таблицы для ВПН
async function getVpnTableData(client, dateRange) {
    const { startDate, endDate } = dateRange;
    
    try {
        const query = `
            SELECT 
                date_of_travel,
                COALESCE(vpn, 0) as vpn_count,
                COALESCE(vpn_amount, 0) as vpn_amount,
                COALESCE(grn_with_symbols, 0) as corrected_vpn,
                COALESCE(vpn_removed, 0) as vpn_removed_count
            FROM verif_vpn 
            WHERE date_of_travel BETWEEN $1 AND $2
              AND (vpn > 0 OR vpn_amount > 0)
            ORDER BY date_of_travel DESC
            LIMIT 100
        `;
        
        const result = await client.query(query, [startDate, endDate]);
        
        return result.rows.map((row, index) => ({
            id: `vpn-${index}-${Date.now()}`,
            date: new Date(row.date_of_travel).toLocaleDateString('ru-RU'),
            trips: parseInt(row.vpn_count) || 0,
            amount: Math.round(parseFloat(row.vpn_amount) || 0),
            confirmed: parseInt(row.corrected_vpn) || 0,
            removed: parseInt(row.vpn_removed_count) || 0
        }));
        
    } catch (error) {
        console.error(`❌ Ошибка получения данных таблицы ВПН: ${error.message}`);
        return [];
    }
}

// ИСПРАВЛЕННАЯ функция расчета диапазона дат
function calculateDateRange(period) {
    const now = new Date();
    let startDate, endDate;
    
    // Устанавливаем конец дня для endDate
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    switch (period) {
        case '7':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
            break;
        case '30':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
            break;
        case '90':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0, 0);
            break;
        default:
            if (period && period.includes('_')) {
                const [start, end] = period.split('_');
                startDate = new Date(start + 'T00:00:00.000Z');
                endDate = new Date(end + 'T23:59:59.999Z');
                
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    console.log(`⚠️ Некорректный период ${period}, используется период 7 дней`);
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                }
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
            }
    }
    
    console.log(`📅 Диапазон дат: ${formatDateRange(startDate, endDate)}`);
    return { startDate, endDate };
}

// API для проверки состояния системы  
router.get('/api/verification-health', async (req, res) => {
    let client;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    try {
        client = await pool.connect();
        
        // Проверяем подключение к БД и получаем информацию о таблицах
        const healthChecks = await Promise.all([
            client.query('SELECT NOW() as current_time, version() as db_version'),
            client.query(`
                SELECT 
                    schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
                FROM pg_stat_user_tables 
                WHERE tablename IN ('verif_stat', 'verif_podtverzdeno', 'verif_vpn')
                ORDER BY tablename
            `),
            client.query(`
                SELECT 
                    table_name, 
                    (xpath('/row/c/text()', query_to_xml('SELECT COUNT(*) as c FROM ' || table_name, false, true, '')))[1]::text::int as row_count
                FROM information_schema.tables 
                WHERE table_name IN ('verif_stat', 'verif_podtverzdeno', 'verif_vpn')
                  AND table_schema = 'public'
            `)
        ]);
        
        const [basicInfo, tableStats, tableCounts] = healthChecks;
        
        console.log(`✅ [${timestamp}] Проверка работоспособности API успешна`);
        
        res.json({
            success: true,
            message: 'API верификации работает корректно',
            timestamp: timestamp,
            database: {
                status: 'подключена',
                serverTime: basicInfo.rows[0].current_time,
                version: basicInfo.rows[0].db_version.split(' ')[0]
            },
            tables: {
                stats: tableStats.rows,
                counts: tableCounts.rows
            },
            api: {
                version: '1.2.0',
                endpoints: ['/api/verification-stats', '/api/verification-health'],
                supportedTabs: ['general', 'confirmed', 'vpn'],
                supportedPeriods: ['7', '30', '90', 'custom']
            }
        });
        
    } catch (error) {
        console.error(`❌ [${timestamp}] Ошибка проверки работоспособности: ${error.message}`);
        
        res.status(500).json({
            success: false,
            message: 'API верификации недоступно',
            timestamp: timestamp,
            database: {
                status: 'отключена',
                error: error.message
            },
            api: {
                version: '1.2.0',
                status: 'error'
            }
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Вспомогательные функции форматирования
function formatDateRange(startDate, endDate) {
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    return `${start} — ${end}`;
}

function formatMoney(amount) {
    if (!amount || amount === 0) return '0₽';
    
    const num = Math.abs(amount);
    if (num >= 1000000000) {
        return `${(amount / 1000000000).toFixed(1)} млрд ₽`;
    } else if (num >= 1000000) {
        return `${(amount / 1000000).toFixed(1)} млн ₽`;
    } else if (num >= 1000) {
        return `${(amount / 1000).toFixed(1)} тыс ₽`;
    }
    return `${Math.round(amount)}₽`;
}

// Обработчики системных событий
pool.on('error', (err, client) => {
    console.error(`❌ Критическая ошибка пула БД: ${err.message}`);
    console.error('Стек ошибки:', err.stack);
    
    // Логируем дополнительную информацию для отладки
    console.error('Детали подключения:', {
        host: pool.options.host,
        port: pool.options.port,
        database: pool.options.database,
        user: pool.options.user,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingConnections: pool.waitingCount
    });
    
    process.exit(-1);
});

process.on('SIGINT', () => {
    console.log(`🛑 Получен сигнал SIGINT, корректное закрытие соединений БД...`);
    pool.end(() => {
        console.log(`✅ Пул соединений БД закрыт успешно`);
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log(`🛑 Получен сигнал SIGTERM, корректное закрытие соединений БД...`);
    pool.end(() => {
        console.log(`✅ Пул соединений БД закрыт успешно`);
        process.exit(0);
    });
});

// Обработчик необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Необработанное отклонение промиса:', reason);
    console.error('Промис:', promise);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Необработанная ошибка:', error.message);
    console.error('Стек:', error.stack);
    process.exit(1);
});

//Статистика по ДЗ 
// Главный API endpoint для получения статистики дебиторской задолженности
    router.get('/api/debet-stats', async (req, res) => {
        const startTime = Date.now();
        let client;
        
        try {
            const { tab, year } = req.query;
            const user = req.headers['x-user'] || 'Kondakov_Av';
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            
            console.log(`📊 [${timestamp}] УВДЗ запрос: ${user} -> ${tab}${year ? ` (год: ${year})` : ''}`);
            
            if (!tab) {
                throw new Error('Параметр tab является обязательным');
            }
            
            client = await pool.connect();
            
            let responseData = {};
            
            switch (tab) {
                case 'general':
                    const selectedYear = year ? parseInt(year) : null;
                    responseData = await getDebetGeneralStatistics(client, user, selectedYear);
                    break;
                case 'banks':
                    responseData = await getDebetBanksStatistics(client, user);
                    break;
                case 'categories':
                    responseData = await getDebetCategoriesStatistics(client, user);
                    break;
                case 'pre-court':
                    responseData = await getDebetPreCourtStatistics(client, user);
                    break;
                case 'court':
                    responseData = await getDebetCourtStatistics(client, user);
                    break;
                case 'personification':
                    responseData = await getDebetPersonificationStatistics(client, user);
                    break;
                case 'roads':
                    responseData = await getDebetRoadsStatistics(client, user);
                    break;
                case 'monthly':
                    responseData = await getDebetMonthlyStatistics(client, user);
                    break;
                default:
                    throw new Error(`Неизвестная вкладка: ${tab}`);
            }
            
            const executionTime = Date.now() - startTime;
            console.log(`✅ УВДЗ данные получены за ${executionTime}мс`);
            
            res.json({
                success: true,
                data: responseData,
                metadata: {
                    user: user,
                    timestamp: timestamp,
                    tab: tab,
                    year: year || null,
                    executionTime: `${executionTime}мс`,
                    recordsCount: responseData.tableData?.length || responseData.totalRecords || 0
                }
            });
            
        } catch (error) {
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            console.error(`❌ [${timestamp}] Ошибка УВДЗ API: ${error.message}`);
            
            res.status(500).json({
                success: false,
                message: 'Ошибка при получении статистики дебиторской задолженности',
                error: error.message,
                metadata: {
                    user: req.headers['x-user'] || 'Kondakov_Av',
                    timestamp: timestamp
                }
            });
        } finally {
            if (client) {
                client.release();
            }
        }
    });

async function handleCategoriesSection(year, user) {
    try {
        // Получаем данные категорий ЛС
        const [categoriesRows] = await executeQuery(`
            SELECT 
                category_name as category,
                COUNT(*) as quantity,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM debet_stats WHERE debt_amount >= 1500), 2) as percentage,
                SUM(debt_amount) as amount
            FROM debet_stats 
            WHERE debt_amount >= 1500 
            GROUP BY category_name 
            ORDER BY quantity DESC
        `);

        // Получаем данные для графика сумм
        const [amountsRows] = await executeQuery(`
            SELECT 
                category_name as category,
                SUM(debt_amount) as amount
            FROM debet_stats 
            WHERE debt_amount >= 1500 
            GROUP BY category_name 
            HAVING SUM(debt_amount) > 0
            ORDER BY amount DESC
        `);

        // Подготавливаем данные для графиков
        const courtCategoriesData = categoriesRows.map(row => ({
            category: row.category || 'Неизвестная категория',
            quantity: parseInt(row.quantity) || 0,
            percentage: parseFloat(row.percentage) || 0,
            amount: parseFloat(row.amount) || 0
        }));

        const courtAmountData = amountsRows.map(row => ({
            category: row.category || 'Неизвестная категория',
            amount: parseFloat(row.amount) || 0
        }));

        return {
            success: true,
            data: {
                tableData: categoriesRows.map(row => ({
                    category: row.category || 'Неизвестная категория',
                    quantity: parseInt(row.quantity) || 0,
                    percentage: `${parseFloat(row.percentage) || 0}%`,
                    amount: parseFloat(row.amount) || 0
                })),
                courtCategoriesData: courtCategoriesData,
                courtAmountData: courtAmountData,
                totalCategories: categoriesRows.length,
                lastUpdate: new Date()
            }
        };

    } catch (error) {
        console.error(`❌ Ошибка статистики категорий ЛС:`, error);
        return {
            success: false,
            message: `Ошибка получения данных категорий: ${error.message}`,
            data: {
                tableData: [],
                courtCategoriesData: null,
                courtAmountData: null
            }
        };
    }
}


function processTableData(tableData) {
    return tableData.map(row => {
        const processedRow = { ...row };
        
        // Обрабатываем строки с "долей"
        const channelText = (row.kanal_informirovaniya || row.parametr || '').toLowerCase();
        
        if (channelText.includes('доля')) {
            // Преобразуем десятичные дроби в проценты
            if (row.kol_vo && !isNaN(row.kol_vo) && row.kol_vo <= 1) {
                processedRow.kol_vo = `${(parseFloat(row.kol_vo) * 100).toFixed(1)}%`;
            }
            if (row.osnovnoy_dolg && !isNaN(row.osnovnoy_dolg) && row.osnovnoy_dolg <= 1) {
                processedRow.osnovnoy_dolg = `${(parseFloat(row.osnovnoy_dolg) * 100).toFixed(1)}%`;
            }
        }
        
        return processedRow;
    });
}

 //Получение статистики досудебной работы
async function getDebetPreCourtStatistics(client, user) {
    try {
        console.log(`📋 Загрузка статистики досудебной работы УВДЗ`);
        
        // Запросы для всех 4 таблиц досудебной работы
        const queries = {
            '2023': `
                SELECT 
                    kanal_informirovaniya,
                    kol_vo,
                    osnovnoy_dolg
                FROM dosudebna_rabota_2023 
                WHERE kanal_informirovaniya IS NOT NULL
                ORDER BY id
            `,
            '2024': `
                SELECT 
                    kanal_informirovaniya,
                    kol_vo,
                    osnovnoy_dolg
                FROM dosudebna_rabota_2024 
                WHERE kanal_informirovaniya IS NOT NULL
                ORDER BY id
            `,
            '2025': `
                SELECT 
                    kanal_informirovaniya,
                    kol_vo,
                    osnovnoy_dolg
                FROM dosudebna_rabota_2025 
                WHERE kanal_informirovaniya IS NOT NULL
                ORDER BY id
            `,
            '2023-2025': `
                SELECT 
                    kanal_informirovaniya,
                    kol_vo,
                    osnovnoy_dolg
                FROM dosudebna_rabota_2023_2025 
                WHERE kanal_informirovaniya IS NOT NULL
                ORDER BY id
            `
        };

        // Выполняем все запросы параллельно
        const [data2023, data2024, data2025, data2023_2025] = await Promise.all([
            client.query(queries['2023']),
            client.query(queries['2024']),
            client.query(queries['2025']),
            client.query(queries['2023-2025'])
        ]);

        console.log(`📋 Получено записей досудебной работы: 2023: ${data2023.rows.length}, 2024: ${data2024.rows.length}, 2025: ${data2025.rows.length}, 2023-2025: ${data2023_2025.rows.length}`);

        // ФУНКЦИЯ: Проверка и преобразование значения в процент
        const convertToPercentageIfNeeded = (value, fieldName, channelName) => {
            if (!value || value === null || value === undefined) {
                return value;
            }

            const originalValue = value;
            const cleanedValue = originalValue.toString().trim().replace(',', '.');
            const numValue = parseFloat(cleanedValue);

            if (!isNaN(numValue)) {
                if (numValue >= 0 && numValue <= 1) {
                    // Десятичная дробь: 0.29 → 29.0%
                    const convertedValue = `${(numValue * 100).toFixed(1)}%`;
                    console.log(`✅ ${fieldName} "${channelName}": ${originalValue} → ${convertedValue}`);
                    return convertedValue;
                } else if (numValue > 1 && numValue <= 100) {
                    // Уже проценты: 29 → 29.0%
                    const convertedValue = `${numValue.toFixed(1)}%`;
                    console.log(`✅ ${fieldName} "${channelName}": ${originalValue} → ${convertedValue} (уже проценты)`);
                    return convertedValue;
                }
            }

            return originalValue;
        };

        // ИСПРАВЛЕННАЯ ФУНКЦИЯ: Обработка процентов в обоих столбцах
        const processPreCourtData = (rows, yearLabel) => {
            console.log(`🔍 Обрабатываем данные ${yearLabel}...`);
            
            return rows.map((row, index) => {
                const processedRow = { ...row };
                
                // Проверяем, является ли это строкой с долей оплат
                const channelText = (row.kanal_informirovaniya || '').toLowerCase();
                const isPercentageRow = channelText.includes('доля');
                
                if (isPercentageRow) {
                    console.log(`🔍 ${yearLabel} строка с долей: "${row.kanal_informirovaniya}"`);
                    console.log(`   Исходные значения: kol_vo="${row.kol_vo}", osnovnoy_dolg="${row.osnovnoy_dolg}"`);
                    
                    // Обрабатываем столбец "Количество" (kol_vo)
                    if (row.kol_vo) {
                        processedRow.kol_vo = convertToPercentageIfNeeded(
                            row.kol_vo, 
                            'Количество', 
                            row.kanal_informirovaniya
                        );
                    }
                    
                    // Обрабатываем столбец "Основной долг" (osnovnoy_dolg)
                    if (row.osnovnoy_dolg) {
                        processedRow.osnovnoy_dolg = convertToPercentageIfNeeded(
                            row.osnovnoy_dolg, 
                            'Основной долг', 
                            row.kanal_informirovaniya
                        );
                    }
                    
                    console.log(`   Результат: kol_vo="${processedRow.kol_vo}", osnovnoy_dolg="${processedRow.osnovnoy_dolg}"`);
                }
                
                return processedRow;
            });
        };

        // Обрабатываем данные всех годов
        const processedData2023 = processPreCourtData(data2023.rows, '2023');
        const processedData2024 = processPreCourtData(data2024.rows, '2024');
        const processedData2025 = processPreCourtData(data2025.rows, '2025');
        const processedData2023_2025 = processPreCourtData(data2023_2025.rows, '2023-2025');

        // Показываем итоговые результаты для строк с долей
        console.log(`📊 Финальные результаты обработки строк с долей:`);
        const showPercentageResults = (data, label) => {
            const percentageRows = data.filter(row => 
                (row.kanal_informirovaniya || '').toLowerCase().includes('доля')
            );
            
            percentageRows.forEach(row => {
                console.log(`${label}: "${row.kanal_informirovaniya}" → kol_vo: ${row.kol_vo}, osnovnoy_dolg: ${row.osnovnoy_dolg}`);
            });
        };

        showPercentageResults(processedData2023, '2023');
        showPercentageResults(processedData2024, '2024');
        showPercentageResults(processedData2025, '2025');
        showPercentageResults(processedData2023_2025, '2023-2025');

        return {
            tablesData: {
                '2023': processedData2023,
                '2024': processedData2024,
                '2025': processedData2025,
                '2023-2025': processedData2023_2025
            },
            totalRecords: processedData2023.length + processedData2024.length + processedData2025.length + processedData2023_2025.length,
            lastUpdate: new Date().toISOString().split('T')[0]
        };
    } catch (error) {
        console.error(`❌ Ошибка статистики досудебной работы: ${error.message}`);
        throw error;
    }
}
   

//Получение статистики по категориям ЛС (старый court)
async function getDebetCategoriesStatistics(client, user) {
    try {
        console.log(`📋 Загрузка статистики категорий ЛС УВДЗ`);
        
        const categoriesQuery = `
            SELECT 
                category,
                quantity,
                percentage,
                amount
            FROM debet_court_cases 
            WHERE LOWER(category) != 'общий итог' 
                AND LOWER(category) != 'итого'
                AND LOWER(category) != 'всего'
                AND category IS NOT NULL
            ORDER BY amount DESC NULLS LAST
        `;

        const categoriesResult = await client.query(categoriesQuery);
        const categoriesData = categoriesResult.rows;

        console.log(`📋 Получено ${categoriesData.length} записей по категориям ЛС (без итогов)`);

        return {
            categoriesCount: categoriesData.length,
            courtCategoriesData: categoriesData, // ИСПРАВЛЕНО: убрали функцию
            courtAmountData: categoriesData,     // ИСПРАВЛЕНО: убрали функцию
            tableData: categoriesData.map((row, index) => ({
                id: `categories-${index}-${Date.now()}`,
                category: row.category || 'Неизвестно',
                quantity: parseInt(row.quantity) || 0,
                percentage: `${parseFloat(row.percentage) || 0}%`,
                amount: parseFloat(row.amount) || 0
            }))
        };
    } catch (error) {
        console.error(`❌ Ошибка статистики категорий ЛС: ${error.message}`);
        throw error;
    }
}


// Функция получения общей статистики с поддержкой фильтрации по году
async function getDebetGeneralStatistics(client, user, year = null) {
    try {
        console.log(`📈 Загрузка общей статистики УВДЗ${year ? ` за ${year} год` : ''}`);
        
        let periodsQuery = `
            SELECT 
                period_month,
                year,
                count_total,
                dz_amount,
                increase_amount,
                payment_amount
            FROM debet_periods 
            WHERE LOWER(period_month) != 'общий итог' 
                AND LOWER(period_month) != 'итого'
                AND LOWER(period_month) != 'всего'
                AND period_month IS NOT NULL
        `;
        
        if (year) {
            periodsQuery += ` AND year = $1`;
        }
        
        periodsQuery += `
            ORDER BY year DESC, 
                CASE 
                    WHEN period_month ~ '^[0-9]+$' THEN CAST(period_month AS INTEGER)
                    WHEN period_month = 'Январь' THEN 1
                    WHEN period_month = 'Февраль' THEN 2
                    WHEN period_month = 'Март' THEN 3
                    WHEN period_month = 'Апрель' THEN 4
                    WHEN period_month = 'Май' THEN 5
                    WHEN period_month = 'Июнь' THEN 6
                    WHEN period_month = 'Июль' THEN 7
                    WHEN period_month = 'Август' THEN 8
                    WHEN period_month = 'Сентябрь' THEN 9
                    WHEN period_month = 'Октябрь' THEN 10
                    WHEN period_month = 'Ноябрь' THEN 11
                    WHEN period_month = 'Декабрь' THEN 12
                    ELSE 0
                END DESC
        `;

        const paymentStatusQuery = `
            SELECT 
                category,
                quantity,
                percentage,
                amount
            FROM debet_trip_payment_status 
            WHERE LOWER(category) != 'общий итог' 
                AND LOWER(category) != 'итого'
                AND LOWER(category) != 'всего'
                AND category IS NOT NULL
            ORDER BY amount DESC NULLS LAST
        `;

        const [periodsStats, paymentStats] = await Promise.all([
            year ? client.query(periodsQuery, [year]) : client.query(periodsQuery),
            client.query(paymentStatusQuery)
        ]);

        console.log(`📈 Получено ${periodsStats.rows.length} записей по периодам${year ? ` за ${year} год` : ''} (без итогов)`);

        const availableYearsQuery = `
            SELECT DISTINCT year 
            FROM debet_periods 
            WHERE year IS NOT NULL 
                AND LOWER(period_month) != 'общий итог' 
                AND LOWER(period_month) != 'итого'
                AND LOWER(period_month) != 'всего'
            ORDER BY year DESC
        `;
        
        const availableYearsResult = await client.query(availableYearsQuery);
        const availableYears = availableYearsResult.rows.map(row => parseInt(row.year));

        return {
            debtDynamicsData: buildDebtDynamicsChartData(periodsStats.rows),
            increasePaymentData: buildIncreaseAndPaymentChartData(periodsStats.rows),
            paymentStatusChartData: buildPaymentStatusChartData(paymentStats.rows),
            tableData: buildGeneralTableData(periodsStats.rows),
            periodsCount: periodsStats.rows.length,
            selectedYear: year,
            availableYears: availableYears,
            lastUpdatePeriod: periodsStats.rows[0] ? `${periodsStats.rows[0].period_month}/${periodsStats.rows[0].year}` : 'N/A'
        };
    } catch (error) {
        console.error(`❌ Ошибка общей статистики УВДЗ: ${error.message}`);
        throw error;
    }
}

// Функция получения статистики по банкам
async function getDebetBanksStatistics(client, user) {
    try {
        console.log(`🏦 Загрузка статистики по банкам УВДЗ`);
        
        const banksQuery = `
            SELECT 
                bank_name,
                received_count,
                received_amount,
                sent_count,
                sent_amount,
                count_percentage,
                amount_percentage
            FROM debet_banks 
            WHERE LOWER(bank_name) != 'общий итог' 
                AND LOWER(bank_name) != 'итого'
                AND LOWER(bank_name) != 'всего'
                AND bank_name IS NOT NULL
            ORDER BY received_amount DESC NULLS LAST
        `;

        const banksResult = await client.query(banksQuery);
        const banksData = banksResult.rows;

        console.log(`🏦 Получено ${banksData.length} записей по банкам (без итогов)`);

        return {
            banksCount: banksData.length,
            banksComparisonData: buildBanksComparisonChartData(banksData),
            tableData: buildBanksTableData(banksData)
        };
    } catch (error) {
        console.error(`❌ Ошибка статистики банков: ${error.message}`);
        throw error;
    }
}

// ОБНОВЛЕННАЯ ФУНКЦИЯ: Получение статистики судебной работы
async function getDebetCourtStatistics(client, user) {
    try {
        console.log(`⚖️ Загрузка статистики судебной работы УВДЗ`);
        
        // Запросы для всех 4 таблиц судебной работы
        const queries = {
            '2023': `
                SELECT 
                    parametr,
                    kol_vo,
                    osnovnoy_dolg,
                    neustoyka_i_gp
                FROM sudebna_rabota_2023 
                WHERE parametr IS NOT NULL
                ORDER BY id
            `,
            '2024': `
                SELECT 
                    parametr,
                    kol_vo,
                    osnovnoy_dolg,
                    neustoyka_i_gp
                FROM sudebna_rabota_2024 
                WHERE parametr IS NOT NULL
                ORDER BY id
            `,
            '2025': `
                SELECT 
                    parametr,
                    kol_vo,
                    osnovnoy_dolg,
                    neustoyka_i_gp
                FROM sudebna_rabota_2025 
                WHERE parametr IS NOT NULL
                ORDER BY id
            `,
            '2023-2025': `
                SELECT 
                    parametr,
                    kol_vo,
                    osnovnoy_dolg,
                    neustoyka_i_gp
                FROM sudebna_rabota_2023_2025 
                WHERE parametr IS NOT NULL
                ORDER BY id
            `
        };

        // Выполняем все запросы параллельно
        const [data2023, data2024, data2025, data2023_2025] = await Promise.all([
            client.query(queries['2023']),
            client.query(queries['2024']),
            client.query(queries['2025']),
            client.query(queries['2023-2025'])
        ]);

        console.log(`⚖️ Получено записей: 2023: ${data2023.rows.length}, 2024: ${data2024.rows.length}, 2025: ${data2025.rows.length}, 2023-2025: ${data2023_2025.rows.length}`);

        return {
            tablesData: {
                '2023': data2023.rows,
                '2024': data2024.rows,
                '2025': data2025.rows,
                '2023-2025': data2023_2025.rows
            },
            totalRecords: data2023.rows.length + data2024.rows.length + data2025.rows.length + data2023_2025.rows.length,
            lastUpdate: new Date().toISOString().split('T')[0]
        };
    } catch (error) {
        console.error(`❌ Ошибка статистики судебной работы: ${error.message}`);
        throw error;
    }
}

// НОВАЯ ФУНКЦИЯ: Построение табличных данных для категорий ЛС
function buildCategoriesTableData(data) {
    return data.map((row, index) => ({
        id: `categories-${index}-${Date.now()}`,
        category: row.category || 'Неизвестно',
        quantity: parseInt(row.quantity) || 0,
        percentage: parseFloat(row.percentage) || 0,
        amount: parseFloat(row.amount) || 0
    }));
}

// Функция получения статистики персонификации
async function getDebetPersonificationStatistics(client, user) {
    try {
        console.log(`👤 Загрузка статистики персонификации поездок УВДЗ`);
        
        const personificationQuery = `
            SELECT 
                status_category,
                debt_range,
                trips_0_12_debt,
                trips_13_24_debt,
                trips_25_36_debt,
                trips_over_36_debt
            FROM debet_personification_trips 
            WHERE LOWER(status_category) != 'общий итог' 
                AND LOWER(status_category) != 'итого'
                AND LOWER(status_category) != 'всего'
                AND status_category IS NOT NULL
            ORDER BY (trips_0_12_debt + trips_13_24_debt + trips_25_36_debt + trips_over_36_debt) DESC NULLS LAST
        `;

        const personificationResult = await client.query(personificationQuery);
        const personificationData = personificationResult.rows;

        console.log(`👤 Получено ${personificationData.length} записей по персонификации (без итогов)`);

        return {
            categoriesCount: personificationData.length,
            statusCategoriesData: buildStatusCategoriesDebtChartData(personificationData),
            debtRangesData: buildDebtRangesDebtChartData(personificationData),
            tableData: buildPersonificationDebtTableData(personificationData)
        };
    } catch (error) {
        console.error(`❌ Ошибка статистики персонификации: ${error.message}`);
        throw error;
    }
}

// Функция получения статистики по участкам дорог (пустая)
async function getDebetRoadsStatistics(client, user) {
    try {
        console.log(`🛣️ Участки дорог - пустые данные (данные перенесены в monthly)`);
        
        return {
            roadsCount: 0,
            roadsSummaryData: null,
            sectionTypesData: null,
            tableData: [],
            message: 'Данные перенесены в раздел "Проезды с минусовым балансом"'
        };
    } catch (error) {
        console.error(`❌ Ошибка пустых данных дорог: ${error.message}`);
        throw error;
    }
}

// Функция получения месячной статистики с данными из дорог
async function getDebetMonthlyStatistics(client, user) {
    try {
        console.log(`📅 Загрузка месячной статистики + данных по дорогам УВДЗ`);
        
        const monthlyQuery = `
            SELECT 
                period,
                year,
                month,
                barrier_quantity,
                barrier_system_share,
                barrier_debt,
                free_flow_quantity,
                free_flow_system_share,
                free_flow_debt,
                total_debt
            FROM debet_monthly_statistics 
            WHERE LOWER(period) != 'общий итог' 
                AND LOWER(period) != 'итого'
                AND LOWER(period) != 'всего'
                AND LOWER(month) != 'общий итог' 
                AND LOWER(month) != 'итого'
                AND LOWER(month) != 'всего'
                AND period IS NOT NULL
                AND month IS NOT NULL
            ORDER BY year DESC, 
                CASE month 
                    WHEN 'Январь' THEN 1
                    WHEN 'Февраль' THEN 2
                    WHEN 'Март' THEN 3
                    WHEN 'Апрель' THEN 4
                    WHEN 'Май' THEN 5
                    WHEN 'Июнь' THEN 6
                    WHEN 'Июль' THEN 7
                    WHEN 'Август' THEN 8
                    WHEN 'Сентябрь' THEN 9
                    WHEN 'Октябрь' THEN 10
                    WHEN 'Ноябрь' THEN 11
                    WHEN 'Декабрь' THEN 12
                    ELSE 0
                END DESC
        `;

        const roadsQuery = `
            SELECT 
                trip_year,
                section_type,
                road_name,
                quantity,
                total_debt,
                paid_other_period,
                paid_other_period_share,
                unpaid_amount,
                unpaid_share
            FROM debet_road_sections_statistics 
            WHERE LOWER(road_name) != 'общий итог' 
                AND LOWER(road_name) != 'итого'
                AND LOWER(road_name) != 'всего'
                AND road_name IS NOT NULL
            ORDER BY trip_year DESC, total_debt DESC NULLS LAST
        `;

        const [monthlyResult, roadsResult] = await Promise.all([
            client.query(monthlyQuery),
            client.query(roadsQuery)
        ]);

        const monthlyData = monthlyResult.rows;
        const roadsData = roadsResult.rows;

        console.log(`📅 Получено ${monthlyData.length} месячных записей и ${roadsData.length} записей по дорогам`);

        return {
            periodsCount: monthlyData.length,
            roadsCount: roadsData.length,
            
            monthlyQuantityAndDebtData: buildMonthlyQuantityAndDebtChartData(monthlyData),
            systemsComparisonData: buildSystemsComparisonChartData(monthlyData),
            roadsSummaryData: buildRoadsSummaryChartData(roadsData),
            sectionTypesData: buildSectionTypesChartData(roadsData),
            
            tableData: buildRoadsTableData(roadsData),
            
            monthlyRawData: monthlyData,
            roadsRawData: roadsData
        };
    } catch (error) {
        console.error(`❌ Ошибка месячной статистики с дорогами: ${error.message}`);
        throw error;
    }
}

// ФУНКЦИИ ПОСТРОЕНИЯ ГРАФИКОВ

function buildDebtDynamicsChartData(periodsData) {
    if (!periodsData || periodsData.length === 0) {
        return { labels: ['Нет данных'], datasets: [{ label: 'Нет данных', data: [0], backgroundColor: '#e0e0e0' }] };
    }
    
    const getMonthName = (monthStr) => {
        if (!monthStr) return 'Н/Д';
        if (!isNaN(monthStr)) {
            const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                               'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
            return monthNames[parseInt(monthStr) - 1] || 'Н/Д';
        }
        return monthStr;
    };

    const sortedData = [...periodsData].sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        if (yearA !== yearB) return yearA - yearB;
        
        const getMonthNum = (monthStr) => {
            if (!isNaN(monthStr)) return parseInt(monthStr);
            const monthMap = {
                'Январь': 1, 'Февраль': 2, 'Март': 3, 'Апрель': 4,
                'Май': 5, 'Июнь': 6, 'Июль': 7, 'Август': 8,
                'Сентябрь': 9, 'Октябрь': 10, 'Ноябрь': 11, 'Декабрь': 12
            };
            return monthMap[monthStr] || 0;
        };
        
        return getMonthNum(a.period_month) - getMonthNum(b.period_month);
    });

    return {
        labels: sortedData.map(row => `${getMonthName(row.period_month)} ${row.year || 'Н/Д'}`),
        datasets: [
            {
                label: 'ДЗ',
                type: 'bar',
                data: sortedData.map(row => parseFloat(row.dz_amount) || 0),
                backgroundColor: 'rgba(108, 117, 125, 0.8)',
                borderColor: '#6c757d',
                borderWidth: 1,
                yAxisID: 'y'
            },
            {
                label: 'Кол-во',
                type: 'line',
                data: sortedData.map(row => parseInt(row.count_total) || 0),
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#dc3545',
                pointBorderColor: '#dc3545',
                pointBorderWidth: 2,
                pointRadius: 5,
                yAxisID: 'y1',
                tension: 0.4
            }
        ]
    };
}

function buildIncreaseAndPaymentChartData(periodsData) {
    if (!periodsData || periodsData.length === 0) {
        return { labels: ['Нет данных'], datasets: [{ label: 'Нет данных', data: [0], backgroundColor: '#e0e0e0' }] };
    }
    
    const getMonthName = (monthStr) => {
        if (!monthStr) return 'Н/Д';
        if (!isNaN(monthStr)) {
            const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                               'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
            return monthNames[parseInt(monthStr) - 1] || 'Н/Д';
        }
        return monthStr;
    };

    const sortedData = [...periodsData].sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        if (yearA !== yearB) return yearA - yearB;
        
        const getMonthNum = (monthStr) => {
            if (!isNaN(monthStr)) return parseInt(monthStr);
            const monthMap = {
                'Январь': 1, 'Февраль': 2, 'Март': 3, 'Апрель': 4,
                'Май': 5, 'Июнь': 6, 'Июль': 7, 'Август': 8,
                'Сентябрь': 9, 'Октябрь': 10, 'Ноябрь': 11, 'Декабрь': 12
            };
            return monthMap[monthStr] || 0;
        };
        
        return getMonthNum(a.period_month) - getMonthNum(b.period_month);
    });

    return {
        labels: sortedData.map(row => `${getMonthName(row.period_month)} ${row.year || 'Н/Д'}`),
        datasets: [
            {
                label: 'Прирост',
                data: sortedData.map(row => parseFloat(row.increase_amount) || 0),
                backgroundColor: 'rgba(255, 193, 7, 0.8)',
                borderColor: '#ffc107',
                borderWidth: 1
            },
            {
                label: 'Оплата',
                data: sortedData.map(row => parseFloat(row.payment_amount) || 0),
                backgroundColor: 'rgba(40, 167, 69, 0.8)',
                borderColor: '#28a745',
                borderWidth: 1
            }
        ]
    };
}

function buildPaymentStatusChartData(data) {
    const validData = data.filter(row => row.category && !isNaN(parseFloat(row.amount)));
    if (validData.length === 0) {
        return { labels: ['Нет данных'], datasets: [{ data: [1], backgroundColor: ['#e0e0e0'] }] };
    }
    
    return {
        labels: validData.map(row => row.category || 'Неизвестно'),
        datasets: [{
            data: validData.map(row => parseFloat(row.amount) || 0),
            backgroundColor: ['#ff6b35', '#f7931e', '#28a745', '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14', '#20c997'],
            borderWidth: 0
        }]
    };
}

// ФУНКЦИИ ДЛЯ МЕСЯЧНОЙ СТАТИСТИКИ
function buildMonthlyQuantityAndDebtChartData(monthlyData) {
    if (!monthlyData || monthlyData.length === 0) {
        return { labels: ['Нет данных'], datasets: [{ label: 'Нет данных', data: [0], backgroundColor: '#e0e0e0' }] };
    }

    const sortedData = [...monthlyData].sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        if (yearA !== yearB) return yearA - yearB;
        
        const getMonthNum = (monthStr) => {
            const monthMap = {
                'Январь': 1, 'Февраль': 2, 'Март': 3, 'Апрель': 4,
                'Май': 5, 'Июнь': 6, 'Июль': 7, 'Август': 8,
                'Сентябрь': 9, 'Октябрь': 10, 'Ноябрь': 11, 'Декабрь': 12
            };
            return monthMap[monthStr] || 0;
        };
        
        return getMonthNum(a.month) - getMonthNum(b.month);
    });

    return {
        labels: sortedData.map(row => `${row.month || 'Н/Д'} ${row.year || 'Н/Д'}`),
        datasets: [
            {
                label: 'Количество',
                type: 'bar',
                data: sortedData.map(row => (parseInt(row.barrier_quantity) || 0) + (parseInt(row.free_flow_quantity) || 0)),
                backgroundColor: 'rgba(108, 117, 125, 0.8)',
                borderColor: '#6c757d',
                borderWidth: 1,
                yAxisID: 'y1'
            },
            {
                label: 'Дебиторская задолженность',
                type: 'line',
                data: sortedData.map(row => parseFloat(row.total_debt) || 0),
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#dc3545',
                pointBorderColor: '#dc3545',
                pointBorderWidth: 2,
                pointRadius: 5,
                yAxisID: 'y',
                tension: 0.4
            }
        ]
    };
}

function buildSystemsComparisonChartData(monthlyData) {
    const totalBarrier = monthlyData.reduce((sum, row) => sum + parseFloat(row.barrier_debt || 0), 0);
    const totalFreeFlow = monthlyData.reduce((sum, row) => sum + parseFloat(row.free_flow_debt || 0), 0);
    
    if (totalBarrier === 0 && totalFreeFlow === 0) {
        return { labels: ['Нет данных'], datasets: [{ data: [1], backgroundColor: ['#e0e0e0'] }] };
    }
    
    return {
        labels: ['Барьерная система', 'Свободный поток'],
        datasets: [{
            data: [totalBarrier, totalFreeFlow],
            backgroundColor: ['#ff6b35', '#f7931e'],
            borderWidth: 0
        }]
    };
}

function buildRoadsSummaryChartData(roadsData) {
    if (!roadsData || roadsData.length === 0) {
        return null;
    }

    const roadGroups = {};
    roadsData.forEach(row => {
        const roadName = row.road_name || 'Неизвестно';
        if (!roadGroups[roadName]) {
            roadGroups[roadName] = { paidAmount: 0, unpaidAmount: 0 };
        }
        roadGroups[roadName].paidAmount += parseFloat(row.paid_other_period || 0);
        roadGroups[roadName].unpaidAmount += parseFloat(row.unpaid_amount || 0);
    });

    if (Object.keys(roadGroups).length === 0) {
        return null;
    }

    return {
        labels: Object.keys(roadGroups),
        datasets: [
            {
                label: 'Оплачено',
                data: Object.values(roadGroups).map(group => group.paidAmount),
                backgroundColor: 'rgba(40, 167, 69, 0.8)',
                borderColor: '#28a745',
                borderWidth: 2
            },
            {
                label: 'Не оплачено',
                data: Object.values(roadGroups).map(group => group.unpaidAmount),
                backgroundColor: 'rgba(220, 53, 69, 0.8)',
                borderColor: '#dc3545',
                borderWidth: 2
            }
        ]
    };
}

function buildSectionTypesChartData(roadsData) {
    if (!roadsData || roadsData.length === 0) {
        return null;
    }

    const typeGroups = {};
    roadsData.forEach(row => {
        const sectionType = row.section_type || 'Неизвестно';
        if (!typeGroups[sectionType]) {
            typeGroups[sectionType] = 0;
        }
        typeGroups[sectionType] += parseFloat(row.total_debt || 0);
    });
    
    if (Object.keys(typeGroups).length === 0) {
        return null;
    }
    
    return {
        labels: Object.keys(typeGroups),
        datasets: [{
            data: Object.values(typeGroups),
            backgroundColor: Object.keys(typeGroups).map((_, index) => `hsl(${25 + index * 60}, 70%, 60%)`),
            borderWidth: 0
        }]
    };
}

// ФУНКЦИИ ДЛЯ БАНКОВ
function buildBanksComparisonChartData(data) {
    const validData = data.filter(row => row.bank_name);
    if (validData.length === 0) {
        return { labels: ['Нет данных'], datasets: [{ label: 'Нет данных', data: [0], backgroundColor: ['#e0e0e0'] }] };
    }
    
    return {
        labels: validData.map(row => row.bank_name || 'Неизвестно'),
        datasets: [
            {
                label: 'Получено (сумма)',
                data: validData.map(row => parseFloat(row.received_amount) || 0),
                backgroundColor: 'rgba(255, 107, 53, 0.8)',
                borderColor: '#ff6b35'
            },
            {
                label: 'Отправлено (сумма)',
                data: validData.map(row => parseFloat(row.sent_amount) || 0),
                backgroundColor: 'rgba(247, 147, 30, 0.8)',
                borderColor: '#f7931e'
            }
        ]
    };
}

// ФУНКЦИИ ДЛЯ ПЕРСОНИФИКАЦИИ
function buildStatusCategoriesDebtChartData(data) {
    const statusGroups = {};
    data.forEach(row => {
        const category = row.status_category || 'Неизвестно';
        if (!statusGroups[category]) {
            statusGroups[category] = 0;
        }
        const totalDebt = (parseFloat(row.trips_0_12_debt || 0) + 
                          parseFloat(row.trips_13_24_debt || 0) + 
                          parseFloat(row.trips_25_36_debt || 0) + 
                          parseFloat(row.trips_over_36_debt || 0));
        statusGroups[category] += totalDebt;
    });
    
    if (Object.keys(statusGroups).length === 0) {
        return { labels: ['Нет данных'], datasets: [{ data: [1], backgroundColor: ['#e0e0e0'] }] };
    }
    
    return {
        labels: Object.keys(statusGroups),
        datasets: [{
            label: 'Задолженность по статусам (₽)',
            data: Object.values(statusGroups),
            backgroundColor: Object.keys(statusGroups).map((_, index) => `hsl(${25 + index * 45}, 70%, 60%)`),
            borderWidth: 0
        }]
    };
}

function buildDebtRangesDebtChartData(data) {
    const rangeGroups = {};
    data.forEach(row => {
        const range = row.debt_range || 'Неизвестно';
        if (!rangeGroups[range]) {
            rangeGroups[range] = 0;
        }
        const totalDebt = (parseFloat(row.trips_0_12_debt || 0) + 
                          parseFloat(row.trips_13_24_debt || 0) + 
                          parseFloat(row.trips_25_36_debt || 0) + 
                          parseFloat(row.trips_over_36_debt || 0));
        rangeGroups[range] += totalDebt;
    });
    
    if (Object.keys(rangeGroups).length === 0) {
        return { labels: ['Нет данных'], datasets: [{ data: [0], backgroundColor: ['#e0e0e0'] }] };
    }
    
    return {
        labels: Object.keys(rangeGroups),
        datasets: [{
            label: 'Задолженность по диапазонам (₽)',
            data: Object.values(rangeGroups),
            backgroundColor: 'rgba(255, 107, 53, 0.8)',
            borderColor: '#ff6b35',
            borderWidth: 2
        }]
    };
}

// ФУНКЦИИ ПОСТРОЕНИЯ ТАБЛИЦ

function buildGeneralTableData(data) {
    const getFullMonthName = (monthStr) => {
        if (!monthStr) return 'Неизвестно';
        
        if (!isNaN(monthStr)) {
            const monthNum = parseInt(monthStr);
            const monthNames = [
                'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
            ];
            return monthNames[monthNum - 1] || 'Неизвестно';
        }
        
        if (['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'].includes(monthStr)) {
            return monthStr;
        }
        
        const shortToFullMap = {
            'Янв': 'Январь', 'Фев': 'Февраль', 'Мар': 'Март', 'Апр': 'Апрель',
            'Май': 'Май', 'Июн': 'Июнь', 'Июл': 'Июль', 'Авг': 'Август',
            'Сен': 'Сентябрь', 'Окт': 'Октябрь', 'Ноя': 'Ноябрь', 'Дек': 'Декабрь'
        };
        
        return shortToFullMap[monthStr] || monthStr;
    };
    
    return data.map((row, index) => {
        const debt = parseFloat(row.dz_amount) || 0;
        const payment = parseFloat(row.payment_amount) || 0;
        const increase = parseFloat(row.increase_amount) || 0;
        const dynamics = increase - payment;
        
        const fullMonthName = getFullMonthName(row.period_month);
        
        return {
            id: `general-${index}-${Date.now()}`,
            period: `${fullMonthName} ${row.year || 'Н/Д'}`,
            count: parseInt(row.count_total) || 0,
            debt: debt,
            payment: payment,
            increase: increase,
            dynamics: dynamics,
            dynamicsIsNegative: dynamics < 0,
            dynamicsFormatted: formatDynamics(dynamics)
        };
    });
}

function buildBanksTableData(data) {
    return data.map((row, index) => ({
        id: `bank-${index}-${Date.now()}`,
        bankName: row.bank_name || 'Неизвестно',
        receivedCount: parseInt(row.received_count) || 0,
        receivedAmount: parseFloat(row.received_amount) || 0,
        sentCount: parseInt(row.sent_count) || 0,
        sentAmount: parseFloat(row.sent_amount) || 0,
        countPercentage: parseFloat(row.count_percentage) || 0,
        amountPercentage: parseFloat(row.amount_percentage) || 0
    }));
}


function buildPersonificationDebtTableData(data) {
    const statusOrder = [
        'Персонифицировано в ЦПИО',
        'Персонифицирован самостоятельно', 
        'Не персонифицирован'
    ];
    
    const rangeOrder = [
        '1-500',
        '500-1500',
        '1500-5000',
        'Более 5000'
    ];
    
    const sortedData = [...data].sort((a, b) => {
        const statusA = a.status_category || '';
        const statusB = b.status_category || '';
        const rangeA = a.debt_range || '';
        const rangeB = b.debt_range || '';
        
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
    
    return sortedData.map((row, index) => ({
        id: `person-${index}-${Date.now()}`,
        statusCategory: row.status_category || 'Неизвестно',
        debtRange: row.debt_range || 'Неизвестно',
        debt0_12: parseFloat(row.trips_0_12_debt) || 0,
        debt13_24: parseFloat(row.trips_13_24_debt) || 0,
        debt25_36: parseFloat(row.trips_25_36_debt) || 0,
        debtOver36: parseFloat(row.trips_over_36_debt) || 0,
        totalDebt: (parseFloat(row.trips_0_12_debt) || 0) + 
                  (parseFloat(row.trips_13_24_debt) || 0) + 
                  (parseFloat(row.trips_25_36_debt) || 0) + 
                  (parseFloat(row.trips_over_36_debt) || 0)
    }));
}

function buildRoadsTableData(data) {
    return data.map((row, index) => ({
        id: `road-${index}-${Date.now()}`,
        year: parseInt(row.trip_year) || 0,
        sectionType: row.section_type || 'Неизвестно',
        roadName: row.road_name || 'Неизвестно',
        quantity: parseInt(row.quantity) || 0,
        totalDebt: parseFloat(row.total_debt) || 0,
        paidOtherPeriod: parseFloat(row.paid_other_period) || 0,
        paidShare: parseFloat(row.paid_other_period_share) || 0,
        unpaidAmount: parseFloat(row.unpaid_amount) || 0,
        unpaidShare: parseFloat(row.unpaid_share) || 0
    }));
}

function formatDynamics(dynamics) {
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

// API для проверки состояния системы УВДЗ
router.get('/api/debet-health', async (req, res) => {
    let client;
    
    try {
        client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as db_version');
        
        console.log(`✅ УВДЗ API работает корректно`);
        
        res.json({
            success: true,
            message: 'API дебиторской задолженности работает корректно',
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            database: 'подключена',
            serverTime: result.rows[0].current_time,
            dbVersion: result.rows[0].db_version.split(' ')[0]
        });
        
    } catch (error) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        console.error(`❌ [${timestamp}] Ошибка УВДЗ API: ${error.message}`);
        
        res.status(500).json({
            success: false,
            message: 'API дебиторской задолженности недоступно',
            timestamp: timestamp,
            database: 'отключена',
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;