const logger = require('../config/logger');
const { getAuthorizedUser } = require('../utils/auth');
const { getCurrentMoscowTime } = require('../utils/dateTime');

/**
 * Middleware для логирования событий авторизации
 */
const logAuthEvent = (eventType, additionalData = {}) => (req, res, next) => {
  const user = getAuthorizedUser(req);
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  const authEvent = {
    timestamp: getCurrentMoscowTime(),
    event: eventType,
    user: user ? {
      id: user.id,
      username: user.username,
      role: user.role
    } : {
      attemptedUsername: req.body?.username || req.query?.username || 'unknown'
    },
    ip: clientIP,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl || req.url,
    sessionId: req.sessionID,
    ...additionalData
  };
  
  // Логируем с соответствующим уровнем
  switch (eventType) {
    case 'LOGIN_SUCCESS':
      logger.warn('✅ УСПЕШНАЯ АВТОРИЗАЦИЯ:', authEvent);
      break;
    case 'LOGIN_FAILED':
      logger.warn('❌ НЕУДАЧНАЯ АВТОРИЗАЦИЯ:', authEvent);
      break;
    case 'LOGOUT':
      logger.warn('🚪 ВЫХОД ИЗ СИСТЕМЫ:', authEvent);
      break;
    case 'ACCESS_DENIED':
      logger.warn('🚫 ДОСТУП ЗАПРЕЩЕН:', authEvent);
      break;
    case 'SESSION_EXPIRED':
      logger.warn('⏰ СЕССИЯ ИСТЕКЛА:', authEvent);
      break;
    default:
      logger.info('🔐 СОБЫТИЕ АВТОРИЗАЦИИ:', authEvent);
  }
  
  next();
};

/**
 * Функция для логирования события авторизации без middleware
 */
const logAuthEventDirect = (eventType, req, additionalData = {}) => {
  const user = getAuthorizedUser(req);
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  const authEvent = {
    timestamp: getCurrentMoscowTime(),
    event: eventType,
    user: user ? {
      id: user.id,
      username: user.username,
      role: user.role
    } : {
      attemptedUsername: req.body?.username || req.query?.username || 'unknown'
    },
    ip: clientIP,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl || req.url,
    sessionId: req.sessionID,
    ...additionalData
  };
  
  switch (eventType) {
    case 'LOGIN_SUCCESS':
      logger.warn('✅ УСПЕШНАЯ АВТОРИЗАЦИЯ:', authEvent);
      break;
    case 'LOGIN_FAILED':
      logger.warn('❌ НЕУДАЧНАЯ АВТОРИЗАЦИЯ:', authEvent);
      break;
    case 'LOGOUT':
      logger.warn('🚪 ВЫХОД ИЗ СИСТЕМЫ:', authEvent);
      break;
    case 'ACCESS_DENIED':
      logger.warn('🚫 ДОСТУП ЗАПРЕЩЕН:', authEvent);
      break;
    case 'SESSION_EXPIRED':
      logger.warn('⏰ СЕССИЯ ИСТЕКЛА:', authEvent);
      break;
    default:
      logger.info('🔐 СОБЫТИЕ АВТОРИЗАЦИИ:', authEvent);
  }
};

module.exports = {
  logAuthEvent,
  logAuthEventDirect
};