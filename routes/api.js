const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { checkDbHealth } = require('../config/database');
const { getAuthorizedUser } = require('../utils/auth');

/**
 * Маршрут для проверки состояния сервера
 */
router.get('/api/health', async (req, res) => {
  try {
    const systemInfo = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      nodejsVersion: process.version,
      memory: process.memoryUsage(),
      currentUser: getAuthorizedUser(req)
    };
    
    const dbStatus = await checkDbHealth();
    
    res.json({
      status: 'ok',
      system: systemInfo,
      database: dbStatus
    });
  } catch (error) {
    logger.error('Ошибка при проверке состояния сервера', error);
    res.status(503).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;