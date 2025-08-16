const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const logger = require('../config/logger');

/**
 * Обработка статических файлов
 */
router.get('/images/Avtodor.png', (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', 'images', 'Avtodor.png');
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.warn(`Основной логотип не найден: ${filePath}`);
      
      const fallbackPath = path.join(__dirname, '..', 'public', 'images', 'logo-fallback.png');
      
      if (fs.existsSync(fallbackPath)) {
        res.sendFile(fallbackPath);
      } else {
        res.status(404).send('Логотип не найден');
      }
      return;
    }
    
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  });
});

router.get('/images/logo-fallback.png', (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', 'images', 'logo-fallback.png');
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      try {
        const placeholderText = 'FALLBACK LOGO PLACEHOLDER';
        fs.writeFileSync(filePath, placeholderText);
        logger.info(`Создан fallback-логотип: ${filePath}`);
      } catch (err) {
        logger.error('Ошибка создания fallback-логотипа:', err);
        return res.status(500).send('Ошибка создания логотипа');
      }
    }
    
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  });
});

router.get('/css/style.css', (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', 'css', 'style.css');
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.error(`Файл ${filePath} не найден`);
      return res.status(404).send('CSS файл не найден');
    }
    
    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(filePath);
  });
});

router.get('/js/script.js', (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', 'js', 'script.js');
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.error(`Файл ${filePath} не найден`);
      return res.status(404).send('JavaScript файл не найден');
    }
    
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(filePath);
  });
});

router.get('/js/animated-background.js', (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', 'js', 'animated-background.js');
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.error(`Файл ${filePath} не найден`);
      return res.status(404).send('JavaScript файл не найден');
    }
    
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(filePath);
  });
});

module.exports = router;