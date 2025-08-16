const logger = require('../config/logger');
const { getAuthorizedUser } = require('../utils/auth');
const { addNotification, PREDEFINED_NOTIFICATIONS } = require('../utils/notifications');
const { logAuthEventDirect } = require('./authLogger');

/**
 * Промежуточное ПО для проверки авторизации пользователя
 */
const checkAuthenticated = (req, res, next) => {
  const user = getAuthorizedUser(req);
  
  if (user) {
    return next();
  }
  
  // Логируем попытку доступа без авторизации
  logAuthEventDirect('ACCESS_DENIED', req, {
    reason: 'not_authenticated',
    attemptedResource: req.originalUrl || req.url
  });
  
  const responseObj = {
    error: 'Требуется авторизация',
    message: 'Для доступа к этому ресурсу требуется авторизация',
    redirectUrl: '/login.html'
  };
  
  res.status(401).json(addNotification(
    responseObj,
    PREDEFINED_NOTIFICATIONS.AUTH_REQUIRED.message,
    PREDEFINED_NOTIFICATIONS.AUTH_REQUIRED.type
  ));
};

/**
 * Промежуточное ПО для проверки роли пользователя
 */
const checkRole = (roles = []) => (req, res, next) => {
  const user = getAuthorizedUser(req);
  const userRole = req.session?.role || 'guest';
  
  if (!roles.includes(userRole)) {
    // Логируем попытку доступа с недостаточными правами
    logAuthEventDirect('ACCESS_DENIED', req, {
      reason: 'insufficient_permissions',
      requiredRoles: roles,
      userRole: userRole,
      username: user?.username || 'unknown',
      attemptedResource: req.originalUrl || req.url
    });
    
    const responseObj = {
      error: 'Доступ запрещен',
      message: 'У вас нет прав для доступа к этому ресурсу'
    };
    
    return res.status(403).json(addNotification(
      responseObj,
      'У вас нет необходимых прав для этого действия',
      'error'
    ));
  }
  
  next();
};

module.exports = {
  checkAuthenticated,
  checkRole
};