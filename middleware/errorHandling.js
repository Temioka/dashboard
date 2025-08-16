const logger = require('../config/logger');
const { getAuthorizedUser } = require('../utils/auth');
const { getCurrentMoscowTime } = require('../utils/dateTime');
const { addNotification, PREDEFINED_NOTIFICATIONS } = require('../utils/notifications');

/**
 * Промежуточное ПО для обработки 404 ошибок
 */
const notFoundHandler = (req, res, next) => {
  const user = getAuthorizedUser(req);
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  logger.warn(`404 Не найден маршрут: ${req.method} ${req.url}`, {
    user: user ? user.username : 'anonymous',
    ip: clientIP,
    userAgent: req.get('User-Agent'),
    timestamp: getCurrentMoscowTime()
  });
  
  res.status(404).json({
    error: 'Ресурс не найден',
    message: `Запрошенный путь '${req.url}' не существует на сервере`,
    timestamp: getCurrentMoscowTime(),
    user: user
  });
};

/**
 * Промежуточное ПО для обработки ошибок
 */
const errorHandler = (err, req, res, next) => {
  const user = getAuthorizedUser(req);
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  logger.error(`Ошибка при обработке запроса: ${req.method} ${req.url}`, {
    error: err.message,
    stack: err.stack,
    user: user ? user.username : 'anonymous',
    ip: clientIP,
    userAgent: req.get('User-Agent'),
    timestamp: getCurrentMoscowTime()
  });
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Внутренняя ошибка сервера';
  
  const responseObj = {
    error: statusCode === 500 ? 'Внутренняя ошибка сервера' : message,
    message: process.env.NODE_ENV !== 'production' ? message : 'Произошла ошибка при обработке запроса',
    timestamp: getCurrentMoscowTime(),
    user: user
  };
  
  res.status(statusCode).json(addNotification(
    responseObj,
    PREDEFINED_NOTIFICATIONS.SERVER_ERROR.message,
    PREDEFINED_NOTIFICATIONS.SERVER_ERROR.type
  ));
};

/**
 * Детальное логирование всех запросов с информацией о пользователях
 */
const detailedRequestLogger = (req, res, next) => {
  const start = Date.now();
  const user = getAuthorizedUser(req);
  const clientIP = req.ip || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                   'unknown';
  
  // Определяем тип запроса
  const isApiRequest = req.originalUrl?.startsWith('/api/');
  const isAdminAction = req.originalUrl?.includes('/logs') || 
                       req.originalUrl?.includes('/admin');
  const isCriticalAction = req.method === 'POST' || 
                          req.method === 'PUT' || 
                          req.method === 'DELETE';
  const isStaticFile = req.originalUrl?.match(/\.(jpg|jpeg|png|gif|ico|svg|css|js|map)$/i);

  // Логируем входящий запрос (кроме статических файлов)
  if (!isStaticFile) {
    const requestInfo = {
      timestamp: getCurrentMoscowTime(),
      method: req.method,
      url: req.originalUrl || req.url,
      ip: clientIP,
      userAgent: req.get('User-Agent') || 'unknown',
      user: user ? {
        id: user.id,
        username: user.username,
        role: user.role
      } : 'anonymous',
      headers: {
        'content-type': req.get('Content-Type'),
        'accept': req.get('Accept'),
        'referer': req.get('Referer'),
        'authorization': req.get('Authorization') ? 'Bearer [HIDDEN]' : undefined
      },
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      body: req.method !== 'GET' && req.body ? 
            (req.body.password ? { ...req.body, password: '[HIDDEN]' } : req.body) : 
            undefined
    };

    // Разные уровни логирования в зависимости от типа запроса
    if (isAdminAction) {
      logger.warn('🔐 АДМИН ДЕЙСТВИЕ - Входящий запрос:', requestInfo);
    } else if (isCriticalAction) {
      logger.warn('⚠️ КРИТИЧНОЕ ДЕЙСТВИЕ - Входящий запрос:', requestInfo);
    } else if (isApiRequest) {
      logger.info('📡 API ЗАПРОС - Входящий запрос:', requestInfo);
    } else {
      logger.info('🌐 WEB ЗАПРОС - Входящий запрос:', requestInfo);
    }

    // Если это аутентифицированный пользователь и важное действие
    if (user && (isAdminAction || isCriticalAction)) {
      logger.warn('👤 ВАЖНОЕ ДЕЙСТВИЕ ПОЛЬЗОВАТЕЛЯ:', {
        timestamp: getCurrentMoscowTime(),
        action: `${req.method} ${req.originalUrl || req.url}`,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        },
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        details: {
          params: req.params,
          query: req.query,
          body: req.body && req.method !== 'GET' ? 
                (req.body.password ? { ...req.body, password: '[СКРЫТО]' } : req.body) : 
                undefined
        }
      });
    }
  }

  // Перехватываем ответ для логирования
  const originalSend = res.send;
  const originalJson = res.json;
  const originalStatus = res.status;
  
  // Перехватываем установку статуса для логирования проблем безопасности
  res.status = function(code) {
    // Логируем попытки несанкционированного доступа
    if (code === 401 || code === 403) {
      const securityEvent = {
        timestamp: getCurrentMoscowTime(),
        event: code === 401 ? 'НЕАВТОРИЗОВАННЫЙ_ДОСТУП' : 'ЗАПРЕЩЕННЫЙ_ДОСТУП',
        ip: clientIP,
        url: req.originalUrl || req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        user: user ? user.username : 'anonymous',
        headers: {
          authorization: req.get('Authorization') ? 'Bearer [ПРИСУТСТВУЕТ]' : 'ОТСУТСТВУЕТ',
          referer: req.get('Referer')
        }
      };
      
      logger.warn('🚨 ПРОБЛЕМА БЕЗОПАСНОСТИ:', securityEvent);
    }
    
    return originalStatus.call(this, code);
  };

  // Функция для логирования ответа
  const logResponse = (data) => {
    const duration = Date.now() - start;
    
    // Не логируем ответы на статические файлы (кроме ошибок)
    if (isStaticFile && res.statusCode < 400) {
      return;
    }
    
    const responseInfo = {
      timestamp: getCurrentMoscowTime(),
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      user: user ? user.username : 'anonymous',
      ip: clientIP,
      responseSize: data ? `${Buffer.byteLength(JSON.stringify(data), 'utf8')} bytes` : 'unknown'
    };

    const logMessage = `${req.method} ${req.originalUrl || req.url} - ${res.statusCode} (${duration}ms)`;
    
    if (res.statusCode >= 500) {
      logger.error('❌ ОШИБКА СЕРВЕРА - Ответ:', { ...responseInfo, logMessage });
    } else if (res.statusCode >= 400) {
      logger.warn('⚠️ ОШИБКА КЛИЕНТА - Ответ:', { ...responseInfo, logMessage });
    } else if (isAdminAction) {
      logger.warn('✅ АДМИН УСПЕХ - Ответ:', { ...responseInfo, logMessage });
    } else if (isCriticalAction) {
      logger.info('✅ КРИТИЧНОЕ УСПЕХ - Ответ:', { ...responseInfo, logMessage });
    } else if (!isStaticFile) {
      logger.info('✅ УСПЕХ - Ответ:', { ...responseInfo, logMessage });
    }
  };

  // Перехватываем res.send
  res.send = function(data) {
    logResponse(data);
    return originalSend.call(this, data);
  };

  // Перехватываем res.json
  res.json = function(data) {
    logResponse(data);
    return originalJson.call(this, data);
  };
  
  // Функция, выполняемая после завершения запроса (для совместимости со старым кодом)
  res.on('finish', () => {
    const time = Date.now() - start;
    
    // Не логируем запросы к статическим файлам (кроме ошибок)
    if (isStaticFile && res.statusCode < 400) {
      return;
    }
    
    logger.access(req, res, time);
  });
  
  next();
};

/**
 * Настройка промежуточного ПО для логирования запросов (старая версия для совместимости)
 */
const requestLogger = detailedRequestLogger;

module.exports = {
  notFoundHandler,
  errorHandler,
  requestLogger,
  detailedRequestLogger,
  detailedRequestLogger: requestLogger
};