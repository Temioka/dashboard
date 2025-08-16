const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

/**
 * Проверка файловой структуры
 */
function checkFileStructure() {
  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    logger.info(`Создаем директорию public: ${publicDir}`);
    try {
      fs.mkdirSync(publicDir, { recursive: true });
    } catch (err) {
      logger.error(`Ошибка создания директории public:`, err);
    }
  }

  ['css', 'js', 'images'].forEach(dir => {
    const dirPath = path.join(publicDir, dir);
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`Создана директория ${dir}`);
      } catch (err) {
        logger.error(`Ошибка создания директории ${dir}:`, err);
      }
    }
  });
  
  createFallbackLogo();
}

/**
 * Создание fallback-логотипа
 */
function createFallbackLogo() {
  const fallbackPath = path.join(__dirname, '..', 'public', 'images', 'logo-fallback.png');
  const mainLogoPath = path.join(__dirname, '..', 'public', 'images', 'Avtodor.png');
  
  if (!fs.existsSync(fallbackPath)) {
    logger.info('Создание файла резервного логотипа...');
    try {
      const placeholderText = 'FALLBACK LOGO PLACEHOLDER';
      fs.writeFileSync(fallbackPath, placeholderText);
      logger.info(`Fallback-логотип создан: ${fallbackPath}`);
    } catch (err) {
      logger.error(`Ошибка создания fallback-логотипа:`, err);
    }
  }
  
  if (!fs.existsSync(mainLogoPath)) {
    logger.info('Основной логотип не найден. Создаем временную заглушку...');
    try {
      if (fs.existsSync(fallbackPath)) {
        fs.copyFileSync(fallbackPath, mainLogoPath);
      } else {
        const placeholderText = 'MAIN LOGO PLACEHOLDER';
        fs.writeFileSync(mainLogoPath, placeholderText);
      }
      logger.info(`Временный основной логотип создан: ${mainLogoPath}`);
    } catch (err) {
      logger.error(`Ошибка создания основного логотипа:`, err);
    }
  }
}

/**
 * Создаем файл index.html если его нет
 */
const createDefaultIndexFile = () => {
  const { getAuthorizedUser } = require('./auth');
  const { getCurrentMoscowTime } = require('./dateTime');
  
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  
  if (!fs.existsSync(path.join(__dirname, '..', 'public'))) {
    try {
      fs.mkdirSync(path.join(__dirname, '..', 'public'), { recursive: true });
      logger.info('Создана директория public');
    } catch (error) {
      logger.error('Ошибка создания директории public', error);
      return;
    }
  }
  
  if (!fs.existsSync(indexPath)) {
    const indexHtml = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Добро пожаловать</title>
        <link rel="stylesheet" href="/css/style.css">
      </head>
      <body>
        <h1>Добро пожаловать на наш сервер!</h1>
        <p>Сервер работает и готов принимать запросы.</p>
        <div id="current-system-info" style="margin-top: 20px; color: #666;">
          Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): ${new Date().toISOString().replace('T', ' ').split('.')[0]}
          <br>
          Current User's Login: ${getAuthorizedUser({ session: {}, headers: {} }) || 'Guest'}
        </div>
      </body>
      </html>
    `;
    
    try {
      fs.writeFileSync(indexPath, indexHtml);
      logger.info('Создан файл index.html по умолчанию');
    } catch (error) {
      logger.error('Ошибка создания файла index.html', error);
    }
  }
};

module.exports = {
  checkFileStructure,
  createFallbackLogo,
  createDefaultIndexFile
};