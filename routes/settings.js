const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { getAuthorizedUser } = require('../utils/auth');
const { getCurrentMoscowTime } = require('../utils/dateTime');
const { filterMenuByPermissions } = require('../utils/auth');
const { clearAllCache } = require('../utils/cache');
const { checkAuthenticated, checkRole } = require('../middleware/auth');

/**
 * Маршрут для получения настроек
 */
router.get('/api/settings/general', async (req, res) => {
  try {
    const settings = {
      siteName: 'My Application',
      adminEmail: 'admin@example.com',
      itemsPerPage: 20,
      maintenanceMode: false,
      version: '1.0.0'
    };
    res.json(settings);
  } catch (error) {
    logger.error('Ошибка получения общих настроек', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить общие настройки'
    });
  }
});

/**
 * Маршрут для настройки меню на основе прав пользователя
 */
router.get('/api/menu', (req, res) => {
  const menuItems = [
    {
      id: 'dashboard',
      title: 'Дашборд',
      icon: 'dashboard',
      url: '/dashboard.html',
      order: 1,
      requiresAuth: true
    },
    {
      id: 'verification',
      title: 'Верификация',
      icon: 'check_circle',
      url: '/verification.html',
      order: 2,
      requiresAuth: true
    },
    {
      id: 'statistics',
      title: 'Статистика',
      icon: 'bar_chart',
      url: '/statistics.html',
      order: 3,
      requiresAuth: true
    },
    {
      id: 'reports',
      title: 'Отчеты',
      icon: 'assignment',
      order: 4,
      requiresAuth: true,
      submenu: [
        {
          id: 'monthly-report',
          title: 'Ежемесячный отчет',
          url: '/reports/monthly.html',
          requiresAuth: true
        },
        {
          id: 'quarterly-report',
          title: 'Квартальный отчет',
          url: '/reports/quarterly.html',
          requiresAuth: true
        },
        {
          id: 'annual-report',
          title: 'Годовой отчет',
          url: '/reports/annual.html',
          requiresAuth: true,
          requiresRole: ['admin', 'manager']
        }
      ]
    },
    {
      id: 'settings',
      title: 'Настройки',
      icon: 'settings',
      url: '/settings.html',
      order: 5,
      requiresAuth: true,
      requiresRole: ['admin']
    },
    {
      id: 'users',
      title: 'Пользователи',
      icon: 'people',
      url: '/users.html',
      order: 6,
      requiresAuth: true,
      requiresRole: ['admin']
    },
    {
      id: 'help',
      title: 'Помощь',
      icon: 'help',
      url: '/help.html',
      order: 7,
      requiresAuth: false
    }
  ];
  
  const filteredMenu = filterMenuByPermissions(menuItems, req);
  
  res.json({
    menu: filteredMenu,
    currentUser: getAuthorizedUser(req),
    timestamp: getCurrentMoscowTime()
  });
});

/**
 * Очистка кеша
 */
router.get('/api/cache/clear', checkAuthenticated, checkRole(['admin']), (req, res) => {
  const count = clearAllCache();
  
  res.json({ 
    success: true, 
    message: `Кеш очищен (${count} элементов)`,
    timestamp: getCurrentMoscowTime(),
    user: getAuthorizedUser(req)
  });
});

module.exports = router;