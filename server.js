const express = require('express');
const http = require('http');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
require('dotenv').config();

// Импорт конфигураций
const { DEFAULT_PORT, DEFAULT_HOST, sessionConfig } = require('./config/server');
const logger = require('./config/logger');
const { initDatabases, closeDatabaseConnections } = require('./config/database');
const { checkFileStructure, createDefaultIndexFile } = require('./utils/fileSystem');
const { clearOldCacheEntries } = require('./utils/cache');

// Импорт промежуточного ПО
const corsMiddleware = require('./middleware/cors');
const { notFoundHandler, errorHandler, detailedRequestLogger } = require('./middleware/errorHandling');

// Импорт маршрутов
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const tableDataRoutes = require('./routes/tableData');
const exportRoutes = require('./routes/export');
const settingsRoutes = require('./routes/settings');
const logsRoutes = require('./routes/logs');
const apiRoutes = require('./routes/api');
const staticRoutes = require('./routes/static');

/**
 * ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
 */
const app = express();
const port = process.env.PORT || DEFAULT_PORT;
const host = DEFAULT_HOST;

// Инициализация HTTP-сервера
const appServer = http.createServer(app);

/**
 * НАСТРОЙКА MIDDLEWARE
 */
// Настройка trust proxy для получения правильного IP адреса
app.set('trust proxy', true);

// Настройка CORS
app.use(corsMiddleware);

// Настройка парсинга тела запроса
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка cookie-parser
app.use(cookieParser());

// Настройка сессий
app.use(session(sessionConfig));

// ВАЖНО: Детальное логирование всех запросов (заменяет старый requestLogger)
app.use(detailedRequestLogger);

// Логирование в консоль (Morgan) - оставляем для дополнительного логирования
app.use(morgan(':method :url :status :response-time ms', {
  skip: (req) => req.url.match(/\.(jpg|jpeg|png|gif|ico|svg)$/i) !== null
}));

/**
 * СТАТИЧЕСКИЕ ФАЙЛЫ
 */
// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|ico)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

/**
 * МАРШРУТЫ ПРИЛОЖЕНИЯ
 */
// Подключение всех маршрутов
app.use(authRoutes);
app.use(userRoutes);
app.use(tableDataRoutes);
app.use(exportRoutes);
app.use(settingsRoutes);
app.use(logsRoutes);
app.use(apiRoutes);
app.use(staticRoutes);

/**
 * ОБРАБОТКА ОШИБОК
 */
// Обработка 404
app.use(notFoundHandler);

// Обработка ошибок
app.use(errorHandler);

/**
 * ИНИЦИАЛИЗАЦИЯ СЕРВЕРА
 */
async function startServer() {
  try {
    // Логируем начало инициализации
    logger.info('🚀 Начало инициализации сервера', {
      timestamp: new Date().toISOString(),
      port,
      host,
      nodeEnv: process.env.NODE_ENV || 'development'
    });
    
    // Проверка и создание необходимой файловой структуры
    logger.info('📁 Проверка файловой структуры');
    checkFileStructure();
    
    // Создание индексного файла
    logger.info('📄 Создание индексного файла');
    createDefaultIndexFile();
    
    // Инициализация баз данных
    logger.info('🗄️ Инициализация баз данных');
    await initDatabases();
    
    // Настройка периодической очистки кеша
    logger.info('🧹 Настройка периодической очистки кеша');
    const cacheCleanupInterval = setInterval(clearOldCacheEntries, 15 * 60 * 1000); // Каждые 15 минут

    // Запуск сервера
    appServer.listen(port, host, () => {
      logger.info(`🌐 HTTP сервер запущен на ${host}:${port}`, {
        timestamp: new Date().toISOString(),
        port,
        host,
        processId: process.pid
      });
      
      logger.info(`📅 Дата и время запуска: ${new Date().toISOString().replace('T', ' ').split('.')[0]}`);
      logger.info('🔗 Доступные HTTP URL:');
      
      try {
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        
        for (const ifName in networkInterfaces) {
          const iface = networkInterfaces[ifName];
          for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
              logger.info(`  - http://${alias.address}:${port}`);
            }
          }
        }
        logger.info(`  - http://localhost:${port}`);
      } catch (err) {
        logger.error('❌ Ошибка при получении сетевых интерфейсов:', err);
      }
      
      // Логируем успешный запуск
      logger.warn('✅ СЕРВЕР УСПЕШНО ЗАПУЩЕН', {
        timestamp: new Date().toISOString(),
        message: 'Сервер готов к приему запросов',
        urls: [`http://${host}:${port}`, `http://localhost:${port}`],
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Обработка сигналов завершения
    setupGracefulShutdown(cacheCleanupInterval);
    
    // Обработка необработанных исключений и промисов
    setupUncaughtHandlers();
  } catch (error) {
    logger.error('❌ Критическая ошибка при запуске сервера:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
}

/**
 * Настройка корректного завершения работы сервера
 */
function setupGracefulShutdown(cacheCleanupInterval) {
  // Изящное завершение работы при получении сигналов
  process.on('SIGTERM', () => {
    logger.warn('🛑 Получен сигнал SIGTERM. Завершение работы...', {
      timestamp: new Date().toISOString(),
      signal: 'SIGTERM'
    });
    gracefulShutdown(cacheCleanupInterval);
  });

  process.on('SIGINT', () => {
    logger.warn('🛑 Получен сигнал SIGINT. Завершение работы...', {
      timestamp: new Date().toISOString(),
      signal: 'SIGINT'
    });
    gracefulShutdown(cacheCleanupInterval);
  });
}

/**
 * Корректное завершение работы сервера
 */
const gracefulShutdown = async (cacheCleanupInterval) => {  
  logger.warn('🔄 Инициировано завершение работы сервера...', {
    timestamp: new Date().toISOString(),
    processId: process.pid
  });
  
  // Остановка таймеров
  logger.info('⏹️ Остановка таймеров очистки кеша');
  clearInterval(cacheCleanupInterval);
  
  try {
    // Закрытие соединений с базами данных
    logger.info('🗄️ Закрытие соединений с базами данных');
    const dbClosed = await closeDatabaseConnections();
    
    // Закрытие HTTP-сервера
    logger.info('🌐 Закрытие HTTP-сервера');
    appServer.close(() => {
      logger.warn('✅ HTTP сервер остановлен', {
        timestamp: new Date().toISOString(),
        message: 'Сервер корректно завершил работу'
      });
      process.exit(0);
    });
  } catch (err) {
    logger.error('❌ Ошибка при корректном завершении работы:', {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
  
  // Установка таймаута на принудительное завершение
  setTimeout(() => {
    logger.error('⚠️ Принудительное завершение работы по таймауту', {
      timestamp: new Date().toISOString(),
      reason: 'Таймаут 10 секунд'
    });
    process.exit(1);
  }, 10000);
};

/**
 * Настройка обработчиков необработанных исключений
 */
function setupUncaughtHandlers() {
  // Обработка необработанных исключений
  process.on('uncaughtException', (error) => {
    logger.error('💥 Необработанное исключение:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      processId: process.pid
    });
    
    // Логируем критическую ошибку и завершаем процесс
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Обработка отклонений промисов
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('🚫 Необработанное отклонение промиса:', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: new Date().toISOString(),
      processId: process.pid
    });
  });
}

// Запуск сервера
startServer();

// Экспортируем приложение для возможности тестирования
module.exports = app;