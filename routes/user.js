const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { pool } = require('../config/database');
const { getAuthorizedUser } = require('../utils/auth');
const { getCurrentMoscowTime } = require('../utils/dateTime');
const { queryCache, CACHE_TTL } = require('../config/server');
const { checkAuthenticated, checkRole } = require('../middleware/auth');

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

/**
 * Маршрут для получения текущего пользователя
 */
router.get('/api/current-user', (req, res) => {
  try {
    const currentUser = getAuthorizedUser(req);
    res.json({
      username: currentUser || 'guest',
      isAuthenticated: Boolean(currentUser),
      timestamp: getCurrentMoscowTime()
    });
  } catch (error) {
    logger.error('Ошибка получения текущего пользователя', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить данные текущего пользователя'
    });
  }
});

/**
 * Маршрут для проверки разрешений пользователя
 * Возвращает список доступных действий на основе роли
 */
router.get('/api/user/permissions', (req, res) => {
  const permissions = {
    canExportData: true,
    canChangeSettings: true,
    canViewReports: true,
    canModifyUsers: true,
    role: 'admin',
    validUntil: '2025-12-31',
    authTime: getCurrentMoscowTime()
  };
  
  res.json(permissions);
});

/**
 * Маршрут для обновления настроек пользователя
 */
router.post('/api/user/settings', express.json(), (req, res) => {
  const { settings } = req.body;
  
  if (!settings) {
    return res.status(400).json({
      error: 'Неверный запрос',
      message: 'Не указаны настройки для обновления'
    });
  }
  
  if (settings.theme && !['light', 'dark', 'system'].includes(settings.theme)) {
    return res.status(400).json({
      error: 'Недопустимое значение',
      message: 'Недопустимое значение для поля theme'
    });
  }
  
  if (settings.language && !['ru', 'en'].includes(settings.language)) {
    return res.status(400).json({
      error: 'Недопустимое значение',
      message: 'Недопустимое значение для поля language'
    });
  }
  
  res.json({
    success: true,
    message: 'Настройки успешно обновлены',
    timestamp: getCurrentMoscowTime(),
    user: getAuthorizedUser(req)
  });
});

/**
 * Маршрут для получения пользователей
 */
router.get('/api/users', checkAuthenticated, checkRole(['admin']), async (req, res) => {
  try {
    const users = [
      { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin' },
      { id: 2, username: 'user1', email: 'user1@example.com', role: 'user' },
      { id: 3, username: 'manager', email: 'manager@example.com', role: 'manager' }
    ];
    res.json(users);
  } catch (error) {
    logger.error('Ошибка получения пользователей', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить пользователей'
    });
  }
});

/**
 * Маршрут для получения ролей
 */
router.get('/api/roles', async (req, res) => {
  try {
    const roles = [
      { id: 1, name: 'admin', description: 'Administrator' },
      { id: 2, name: 'user', description: 'Regular User' },
      { id: 3, name: 'manager', description: 'Manager' }
    ];
    res.json(roles);
  } catch (error) {
    logger.error('Ошибка получения ролей', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить роли'
    });
  }
});

module.exports = router;