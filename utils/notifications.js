// Типы уведомлений
const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * Создает структуру уведомления
 * @param {string} message - Текст уведомления
 * @param {string} type - Тип уведомления (success, error, warning, info)
 * @param {number} [duration=5000] - Длительность отображения в миллисекундах
 * @param {string} [title=''] - Заголовок уведомления
 * @returns {Object} Объект уведомления
 */
function createNotification(message, type = NOTIFICATION_TYPES.INFO, duration = 5000, title = '') {
  return {
    message,
    type,
    duration,
    title,
    timestamp: new Date().toISOString()
  };
}

/**
 * Добавляет к ответу уведомление, чтобы фронтенд мог его отобразить
 * @param {Object} responseObj - Объект ответа, который будет отправлен клиенту
 * @param {string} message - Текст уведомления
 * @param {string} type - Тип уведомления
 * @param {number} [duration=5000] - Длительность отображения
 * @param {string} [title=''] - Заголовок уведомления
 * @returns {Object} Обновленный объект ответа
 */
function addNotification(responseObj, message, type = NOTIFICATION_TYPES.INFO, duration = 5000, title = '') {
  const notification = createNotification(message, type, duration, title);
  
  return {
    ...responseObj,
    notification
  };
}

// Предопределенные уведомления для частых случаев
const PREDEFINED_NOTIFICATIONS = {
  // Авторизация
  AUTH_REQUIRED: createNotification(
    'Пожалуйста, авторизуйтесь для доступа к дашборду', 
    NOTIFICATION_TYPES.WARNING, 
    6000,
    'Требуется авторизация'
  ),
  LOGIN_FAILED: createNotification(
    'Неправильный логин или пароль', 
    NOTIFICATION_TYPES.ERROR, 
    7000,
    'Ошибка входа'
  ),
  LOGIN_SUCCESS: createNotification(
    'Вы успешно авторизовались', 
    NOTIFICATION_TYPES.SUCCESS, 
    5000,
    'Авторизация успешна'
  ),
  LOGOUT_SUCCESS: createNotification(
    'Вы вышли из системы', 
    NOTIFICATION_TYPES.INFO, 
    5000,
    'Выход из системы'
  ),
  SESSION_EXPIRED: createNotification(
    'Ваша сессия истекла. Пожалуйста, авторизуйтесь снова', 
    NOTIFICATION_TYPES.WARNING, 
    6000,
    'Сессия истекла'
  ),
  
  // Данные
  DATA_LOADED: createNotification(
    'Данные успешно загружены!', 
    NOTIFICATION_TYPES.SUCCESS, 
    4000,
    'Загрузка данных'
  ),
  DATA_LOAD_ERROR: createNotification(
    'Ошибка загрузки данных', 
    NOTIFICATION_TYPES.ERROR, 
    7000,
    'Ошибка загрузки'
  ),
  DATA_SAVED: createNotification(
    'Данные успешно сохранены', 
    NOTIFICATION_TYPES.SUCCESS, 
    4000,
    'Сохранение данных'
  ),
  
  // Сервер
  SERVER_ERROR: createNotification(
    'Произошла ошибка на сервере. Попробуйте позже', 
    NOTIFICATION_TYPES.ERROR, 
    7000,
    'Ошибка сервера'
  ),
  CONNECTION_ERROR: createNotification(
    'Проблемы с подключением к серверу', 
    NOTIFICATION_TYPES.ERROR, 
    7000,
    'Ошибка подключения'
  ),
  DB_ERROR: createNotification(
    'Ошибка базы данных', 
    NOTIFICATION_TYPES.ERROR, 
    7000,
    'Ошибка базы данных'
  )
};

module.exports = {
  NOTIFICATION_TYPES,
  createNotification,
  addNotification,
  PREDEFINED_NOTIFICATIONS
};