const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const logger = require('../config/logger');
const { pool } = require('../config/database');
const { getAuthorizedUser } = require('../utils/auth');
const { getCurrentMoscowTime } = require('../utils/dateTime');
const { addNotification, PREDEFINED_NOTIFICATIONS } = require('../utils/notifications');

/**
 * Маршрут для проверки статуса авторизации
 */
router.get('/api/auth/status', (req, res) => {
  try {
    // Проверяем наличие пользователя в сессии
    const username = getAuthorizedUser(req);
    
    if (username) {
      logger.info(`Статус авторизации проверен: ${username} авторизован`);
      res.json({
        isAuthenticated: true,
        username: username,
        timestamp: getCurrentMoscowTime()
      });
    } else {
      logger.info('Статус авторизации проверен: пользователь не авторизован');
      // Добавляем уведомление, что нужно авторизоваться
      const responseObj = {
        isAuthenticated: false,
        timestamp: getCurrentMoscowTime()
      };
      res.json(addNotification(responseObj, PREDEFINED_NOTIFICATIONS.AUTH_REQUIRED.message, PREDEFINED_NOTIFICATIONS.AUTH_REQUIRED.type));
    }
  } catch (error) {
    logger.error('Ошибка при проверке статуса авторизации', error);
    const responseObj = {
      isAuthenticated: false,
      error: 'Ошибка сервера',
      message: 'Не удалось проверить статус авторизации',
      timestamp: getCurrentMoscowTime()
    };
    res.status(500).json(addNotification(responseObj, PREDEFINED_NOTIFICATIONS.SERVER_ERROR.message, PREDEFINED_NOTIFICATIONS.SERVER_ERROR.type));
  }
});

/**
 * Маршрут для выхода из системы
 */
router.post('/logout', (req, res) => {
  try {
    const username = req.session?.username;
    
    if (username) {
      logger.info(`Пользователь ${username} вышел из системы`);
    }
    
    // Уничтожаем сессию
    req.session.destroy(err => {
      if (err) {
        logger.error('Ошибка при уничтожении сессии', err);
      }
      
      // Очищаем куки сессии
      res.clearCookie('sessionId');
      
      // Возвращаем успешный ответ с уведомлением
      const responseObj = {
        success: true,
        message: 'Вы успешно вышли из системы',
        timestamp: getCurrentMoscowTime(),
        redirectUrl: req.body.returnPath || '/'
      };
      res.json(addNotification(responseObj, PREDEFINED_NOTIFICATIONS.LOGOUT_SUCCESS.message, PREDEFINED_NOTIFICATIONS.LOGOUT_SUCCESS.type));
    });
  } catch (error) {
    logger.error('Ошибка при выходе из системы', error);
    const responseObj = {
      success: false,
      error: 'Ошибка сервера',
      message: 'Не удалось выйти из системы',
      timestamp: getCurrentMoscowTime()
    };
    res.status(500).json(addNotification(responseObj, PREDEFINED_NOTIFICATIONS.SERVER_ERROR.message, PREDEFINED_NOTIFICATIONS.SERVER_ERROR.type));
  }
});

// Обработка логина с bcrypt для проверки пароля
router.post('/login', async (req, res) => {
  const start = Date.now();
  let client;

  try {
    const { username, password, returnPath } = req.body;

    // Проверяем наличие и формат логина и пароля
    if (!username || !password || username.length < 3 || password.length < 6) {
      const responseObj = {
        isAuthenticated: false,
        message: 'Некорректные логин или пароль'
      };
      return res.status(400).json(addNotification(responseObj, 'Некорректные логин или пароль', 'error'));
    }

    client = await pool.connect();
    // Получаем пользователя из базы данных
    const sql = 'SELECT * FROM "users" WHERE login = $1';
    const result = await client.query(sql, [username]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      // Проверяем пароль с использованием bcrypt
      let passwordMatch = false;
      try {
        passwordMatch = await bcrypt.compare(password, user.password);
      } catch (err) {
        logger.error('Ошибка проверки пароля', err);
        const responseObj = {
          isAuthenticated: false,
          message: 'Ошибка на сервере'
        };
        return res.status(500).json(addNotification(responseObj, PREDEFINED_NOTIFICATIONS.SERVER_ERROR.message, PREDEFINED_NOTIFICATIONS.SERVER_ERROR.type));
      }

      if (passwordMatch) {
        // Успешная авторизация
        logger.info(`Успешная авторизация: ${username} (${Date.now() - start}ms)`);
        
        // Инициализируем сессию, если её нет
        if (!req.session) {
          logger.warn('Сессия не инициализирована. Проверьте настройки express-session.');
        }
        
        // Сохраняем данные пользователя в сессии
        req.session.username = user.login || username;
        req.session.userId = user.id || 1;
        req.session.role = user.role || 'user';
        
        // Отправляем успешный ответ с уведомлением
        const responseObj = {
          isAuthenticated: true,
          user: {
            id: user.id || 1,
            login: user.login || username,
            role: user.role || 'user'
          },
          returnPath: returnPath || '/',
          serverTime: getCurrentMoscowTime()
        };
        return res.json(addNotification(responseObj, PREDEFINED_NOTIFICATIONS.LOGIN_SUCCESS.message, PREDEFINED_NOTIFICATIONS.LOGIN_SUCCESS.type));
      } else {
        // Неверный пароль
        logger.info(`Неудачная авторизация (неверный пароль): ${username} (${Date.now() - start}ms)`);
        const responseObj = {
          isAuthenticated: false,
          message: 'Неверный логин или пароль',
          serverTime: getCurrentMoscowTime()
        };
        return res.status(401).json(addNotification(responseObj, PREDEFINED_NOTIFICATIONS.LOGIN_FAILED.message, PREDEFINED_NOTIFICATIONS.LOGIN_FAILED.type));
      }
    } else {
      // Пользователь не найден
      logger.info(`Неудачная авторизация (пользователь не найден): ${username} (${Date.now() - start}ms)`);
      const responseObj = {
        isAuthenticated: false,
        message: 'Неверный логин или пароль',
        serverTime: getCurrentMoscowTime()
      };
      return res.status(401).json(addNotification(responseObj, PREDEFINED_NOTIFICATIONS.LOGIN_FAILED.message, PREDEFINED_NOTIFICATIONS.LOGIN_FAILED.type));
    }
  } catch (error) {
    logger.error('Ошибка обработки авторизации', error);
    const responseObj = {
      isAuthenticated: false,
      error: 'Ошибка сервера',
      message: 'Внутренняя ошибка при обработке запроса',
      serverTime: getCurrentMoscowTime()
    };
    res.status(500).json(addNotification(responseObj, PREDEFINED_NOTIFICATIONS.SERVER_ERROR.message, PREDEFINED_NOTIFICATIONS.SERVER_ERROR.type));
  } finally {
    if (client) client.release();
  }
});

module.exports = router;