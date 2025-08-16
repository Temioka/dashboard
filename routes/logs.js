const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const router = express.Router();
const logger = require('../config/logger');
const { getAuthorizedUser } = require('../utils/auth');
const { getCurrentMoscowTime } = require('../utils/dateTime');
const { checkAuthenticated, checkRole } = require('../middleware/auth');

// Константы
const LOG_FILE_EXTENSION = '.log';
const DEFAULT_PAGINATION = {
  limit: 100,
  page: 1,
  maxLimit: 1000
};

// Функция для детального логирования действий с логами
const logUserAction = (action, user, req, additionalData = {}) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  logger.warn('📊 ДОСТУП К ЛОГАМ:', {
    timestamp: getCurrentMoscowTime(),
    action,
    user: {
      id: user?.id,
      username: user?.username,
      role: user?.role
    },
    ip: clientIP,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl,
    sessionInfo: {
      sessionId: req.sessionID,
      isAuthenticated: true
    },
    ...additionalData
  });
};

// Утилиты для работы с логами
class LogService {
  /**
   * Проверяет валидность имени лог-файла
   * @param {string} filename - имя файла
   * @returns {boolean}
   */
  static isValidLogFilename(filename) {
    return typeof filename === 'string' && 
           !filename.includes('..') && 
           filename.endsWith(LOG_FILE_EXTENSION) &&
           !/[<>:"|?*\x00-\x1f]/.test(filename);
  }

  /**
   * Получает информацию о лог-файле
   * @param {string} filepath - путь к файлу
   * @param {string} filename - имя файла
   * @returns {Promise<Object>}
   */
  static async getFileInfo(filepath, filename) {
    try {
      const stats = await fs.stat(filepath);
      return {
        name: filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isAccessible: true
      };
    } catch (error) {
      logger.warn(`Не удалось получить информацию о файле ${filename}:`, error.message);
      return null;
    }
  }

  /**
   * Сортирует лог-файлы по дате (новые первыми)
   * @param {string} a - имя первого файла
   * @param {string} b - имя второго файла
   * @returns {number}
   */
  static sortLogFilesByDate(a, b) {
    try {
      const dateA = new Date(a.split('.')[0]);
      const dateB = new Date(b.split('.')[0]);
      return dateB - dateA;
    } catch (error) {
      // Если не удается парсить дату, сортируем по алфавиту
      return b.localeCompare(a);
    }
  }

  /**
   * Валидирует и нормализует параметры пагинации
   * @param {Object} query - query параметры запроса
   * @returns {Object}
   */
  static validatePaginationParams(query) {
    const limit = Math.min(
      Math.max(parseInt(query.limit, 10) || DEFAULT_PAGINATION.limit, 1),
      DEFAULT_PAGINATION.maxLimit
    );
    const page = Math.max(parseInt(query.page, 10) || DEFAULT_PAGINATION.page, 1);
    
    return { limit, page };
  }

  /**
   * Создает стандартный ответ API
   * @param {Object} req - объект запроса
   * @param {Object} data - данные ответа
   * @returns {Object}
   */
  static createApiResponse(req, data) {
    return {
      ...data,
      meta: {
        currentTime: getCurrentMoscowTime(),
        currentUser: getAuthorizedUser(req),
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Создает стандартный ответ об ошибке
   * @param {Object} req - объект запроса
   * @param {string} error - тип ошибки
   * @param {string} message - сообщение об ошибке
   * @param {Object} details - дополнительные детали
   * @returns {Object}
   */
  static createErrorResponse(req, error, message, details = {}) {
    return this.createApiResponse(req, {
      error,
      message,
      ...details
    });
  }
}

/**
 * Маршрут для получения списка доступных логов (только для администраторов)
 */
router.get('/api/logs', checkAuthenticated, checkRole(['admin']), async (req, res) => {
  const user = getAuthorizedUser(req);
  
  // Детальное логирование доступа к списку логов
  logUserAction('ПРОСМОТР_СПИСКА_ЛОГОВ', user, req, {
    requestedAt: getCurrentMoscowTime(),
    accessLevel: 'ADMIN_ONLY'
  });
  
  try {
    // Проверяем существование директории логов
    if (!fsSync.existsSync(logger.logDirectory)) {
      logger.error(`Директория логов не найдена: ${logger.logDirectory}`, {
        user: user?.username,
        ip: req.ip || req.connection.remoteAddress,
        action: 'ACCESS_LOGS_DIRECTORY'
      });
      return res.status(500).json(
        LogService.createErrorResponse(req, 'Directory not found', 'Директория логов не найдена')
      );
    }

    // Читаем содержимое директории
    const files = await fs.readdir(logger.logDirectory);
    
    // Фильтруем и сортируем лог-файлы
    const logFileNames = files
      .filter(file => file.endsWith(LOG_FILE_EXTENSION))
      .sort(LogService.sortLogFilesByDate);

    // Получаем информацию о каждом файле
    const logFilesInfo = await Promise.allSettled(
      logFileNames.map(filename => 
        LogService.getFileInfo(path.join(logger.logDirectory, filename), filename)
      )
    );

    // Фильтруем успешно обработанные файлы
    const logFiles = logFilesInfo
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    const response = LogService.createApiResponse(req, {
      logs: logFiles,
      totalCount: logFiles.length
    });

    res.json(response);
    
    // Логируем успешное обращение
    logger.info(`Пользователь ${user?.username || 'unknown'} успешно получил список логов`, {
      user: user?.username,
      ip: req.ip || req.connection.remoteAddress,
      filesCount: logFiles.length,
      action: 'GET_LOGS_LIST_SUCCESS'
    });
    
  } catch (error) {
    logger.error('Ошибка получения списка лог-файлов:', {
      error: error.message,
      stack: error.stack,
      user: user?.username,
      ip: req.ip || req.connection.remoteAddress,
      action: 'GET_LOGS_LIST_ERROR'
    });
    res.status(500).json(
      LogService.createErrorResponse(
        req, 
        'Internal server error', 
        'Не удалось получить список лог-файлов',
        { errorCode: 'LOG_LIST_ERROR' }
      )
    );
  }
});

/**
 * Маршрут для получения содержимого лог-файла (только для администраторов)
 */
router.get('/api/logs/:filename', checkAuthenticated, checkRole(['admin']), async (req, res) => {
  const user = getAuthorizedUser(req);
  const { filename } = req.params;
  const { limit, page } = LogService.validatePaginationParams(req.query);
  
  // Детальное логирование просмотра конкретного файла
  logUserAction('ПРОСМОТР_ЛОГ_ФАЙЛА', user, req, {
    filename,
    page,
    limit,
    requestedAt: getCurrentMoscowTime(),
    accessLevel: 'ADMIN_ONLY',
    potentialSensitiveData: true
  });
  
  try {
    // Валидация имени файла
    if (!LogService.isValidLogFilename(filename)) {
      logger.warn('Попытка доступа к недопустимому лог-файлу:', {
        filename,
        user: user?.username,
        ip: req.ip || req.connection.remoteAddress,
        action: 'INVALID_FILENAME_ACCESS'
      });
      
      return res.status(400).json(
        LogService.createErrorResponse(
          req,
          'Invalid filename',
          'Указано недопустимое имя лог-файла',
          { 
            filename,
            errorCode: 'INVALID_FILENAME' 
          }
        )
      );
    }

    const logFilePath = path.join(logger.logDirectory, filename);
    
    // Проверяем существование файла
    try {
      await fs.access(logFilePath, fsSync.constants.F_OK);
    } catch (accessError) {
      logger.warn('Попытка доступа к несуществующему лог-файлу:', {
        filename,
        user: user?.username,
        ip: req.ip || req.connection.remoteAddress,
        action: 'FILE_NOT_FOUND_ACCESS'
      });
      
      return res.status(404).json(
        LogService.createErrorResponse(
          req,
          'File not found',
          `Лог-файл ${filename} не найден`,
          { 
            filename,
            errorCode: 'FILE_NOT_FOUND' 
          }
        )
      );
    }

    // Читаем содержимое файла
    const content = await fs.readFile(logFilePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Вычисляем пагинацию
    const totalLines = lines.length;
    const totalPages = Math.ceil(totalLines / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pageLines = lines.slice(startIndex, endIndex);

    const response = LogService.createApiResponse(req, {
      filename,
      content: pageLines,
      pagination: {
        page,
        limit,
        totalLines,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

    res.json(response);
    
    // Логируем успешное обращение к файлу
    logger.warn(`Пользователь ${user?.username || 'unknown'} получил доступ к лог-файлу: ${filename}`, {
      filename,
      page,
      limit,
      totalLines,
      linesReturned: pageLines.length,
      user: user?.username,
      ip: req.ip || req.connection.remoteAddress,
      action: 'GET_LOG_FILE_SUCCESS',
      securityLevel: 'HIGH'
    });
    
  } catch (error) {
    logger.error(`Ошибка чтения лог-файла ${filename}:`, {
      filename,
      error: error.message,
      stack: error.stack,
      user: user?.username,
      ip: req.ip || req.connection.remoteAddress,
      action: 'GET_LOG_FILE_ERROR'
    });
    
    res.status(500).json(
      LogService.createErrorResponse(
        req,
        'File read error',
        'Не удалось прочитать содержимое лог-файла',
        { 
          filename,
          errorCode: 'FILE_READ_ERROR' 
        }
      )
    );
  }
});

module.exports = router;