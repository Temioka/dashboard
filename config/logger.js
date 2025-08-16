const fs = require('fs');
const path = require('path');
const { getCurrentMoscowTime } = require('../utils/dateTime');
const { getAuthorizedUser } = require('../utils/auth');

// Настройка системы логирования
const logger = {
  logDirectory: path.join(__dirname, '..', 'logs'),
  
  // Создание директории для логов, если она не существует
  init() {
    if (!fs.existsSync(this.logDirectory)) {
      try {
        fs.mkdirSync(this.logDirectory, { recursive: true });
        console.log(`Создана директория для логов: ${this.logDirectory}`);
      } catch (err) {
        console.error(`Не удалось создать директорию для логов: ${err.message}`);
      }
    }
    return this;
  },

  // Форматирование сообщения лога
  formatMessage(level, message, context = null) {
    const timestamp = getCurrentMoscowTime();
    const user = context?.user || 'system';
    const baseMessage = `[${timestamp}] [${level.toUpperCase()}] [${user}] ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      return `${baseMessage}\nКонтекст: ${JSON.stringify(context, null, 2)}`;
    }
    
    return baseMessage;
  },

  // Запись лога в файл
  writeToFile(level, message, data = null) {
    try {
      const logFile = path.join(this.logDirectory, `${new Date().toISOString().split('T')[0]}.log`);
      const formattedMessage = this.formatMessage(level, message, data);
      const logEntry = `${formattedMessage}\n${'='.repeat(80)}\n`;
      
      fs.appendFileSync(logFile, logEntry);
    } catch (err) {
      console.error(`Ошибка записи в лог-файл: ${err.message}`);
    }
  },

  // Методы логирования разных уровней
  info(message, data = null) {
    const formattedMessage = this.formatMessage('INFO', message, data);
    console.log(formattedMessage);
    this.writeToFile('INFO', message, data);
  },

  warn(message, data = null) {
    const formattedMessage = this.formatMessage('WARN', message, data);
    console.warn(formattedMessage);
    this.writeToFile('WARN', message, data);
  },

  error(message, error = null) {
    const errorData = error?.stack ? { error: error.message, stack: error.stack } : error;
    const formattedMessage = this.formatMessage('ERROR', message, errorData);
    console.error(formattedMessage);
    this.writeToFile('ERROR', message, errorData);
  },

  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = this.formatMessage('DEBUG', message, data);
      console.debug(formattedMessage);
      this.writeToFile('DEBUG', message, data);
    }
  },

  access(req, res, time) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;
    const userAgent = req.headers['user-agent'] || '-';
    const user = getAuthorizedUser(req);
    const username = user ? user.username : 'anonymous';
    
    const message = `${ip} - ${username} "${method} ${url}" ${status} ${time}ms "${userAgent}"`;
    this.writeToFile('ACCESS', message, {
      ip,
      user: user ? {
        id: user.id,
        username: user.username,
        role: user.role
      } : null,
      method,
      url,
      status,
      responseTime: `${time}ms`,
      userAgent
    });
  }
};

// Инициализируем логгер
logger.init();

module.exports = logger;