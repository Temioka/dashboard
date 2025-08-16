const { Pool } = require('pg');
const logger = require('./logger');
require('dotenv').config();

// Настройки основной базы данных
const dbConfig = {
  user: process.env.DB_USER || '',
  host: process.env.DB_HOST || '',
  database: process.env.DB_NAME || '',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Создание пула соединений для основной базы данных
const pool = new Pool(dbConfig);
pool.on('connect', () => {
  logger.info('Новое подключение к базе данных создано');
});

pool.on('error', (err, client) => {
  logger.error('Ошибка в неиспользуемом клиенте', err);
});

// Настройки второй базы данных
const targetDbConfig = {
  user: process.env.TARGET_DB_USER || '',
  host: process.env.TARGET_DB_HOST || '',
  database: process.env.TARGET_DB_NAME || '',
  password: process.env.TARGET_DB_PASSWORD || '',
  port: process.env.TARGET_DB_PORT || 5432,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Создание пула соединений для второй базы данных
const targetPool = new Pool(targetDbConfig);
targetPool.on('connect', () => {
  logger.info('Новое подключение ко второй базе данных создано');
});

targetPool.on('error', (err, client) => {
  logger.error('Ошибка во второй базе данных', err);
});

// Инициализация подключений к базам данных
const initDatabases = async () => {
  try {
    await pool.query('SELECT NOW()');
    logger.info('✅ Успешное подключение к основной базе данных');
  } catch (err) {
    logger.error('❌ Ошибка подключения к базе данных:', err);
    logger.warn('Сервер будет запущен в демо-режиме без базы данных');
  }

  try {
    await targetPool.query('SELECT NOW()');
    logger.info('✅ Успешное подключение к базе данных Noumen');
  } catch (err) {
    logger.error('❌ Ошибка подключения ко второй базе данных:', err);
    logger.warn('Сервер будет запущен в демо-режиме без второй базы данных');
  }
};

// Middleware для проверки подключения к БД
const checkDbConnection = async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    next();
  } catch (err) {
    logger.warn('База данных недоступна');
    res.status(500).json({ error: 'База данных недоступна' });
  }
};

// Проверка состояния базы данных
const checkDbHealth = async () => {
  try {
    const startTime = Date.now();
    const result = await pool.query('SELECT NOW() as time');
    const dbTime = result.rows[0].time;
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'connected',
      responseTime: `${responseTime}ms`,
      serverTime: dbTime
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message
    };
  }
};

// Корректное завершение соединений с базами данных
const closeDatabaseConnections = async () => {
  logger.info('Закрываем соединения с базой данных...');
  
  try {
    await Promise.all([
      pool.end().catch(err => logger.error('Ошибка закрытия основного пула:', err)),
      targetPool.end().catch(err => logger.error('Ошибка закрытия целевого пула:', err))
    ]);
    logger.info('Соединения с базой данных закрыты');
    return true;
  } catch (err) {
    logger.error('Ошибка при закрытии соединений с базой данных:', err);
    return false;
  }
};

module.exports = {
  pool,
  targetPool,
  initDatabases,
  checkDbConnection,
  checkDbHealth,
  closeDatabaseConnections
};