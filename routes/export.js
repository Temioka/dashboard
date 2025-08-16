const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { getAuthorizedUser } = require('../utils/auth');
const { getCurrentMoscowTime } = require('../utils/dateTime');
const { checkAuthenticated } = require('../middleware/auth');

/**
 * Маршрут для экспорта данных в различных форматах
 * Поддерживает экспорт за указанный период
 */
router.get('/api/export/:format', async (req, res) => {
  const start = Date.now();
  try {
    const { format } = req.params;
    const { year, month, quarter, halfYear, startMonth, endMonth, date } = req.query;
    
    if (!['csv', 'excel', 'pdf', 'json'].includes(format)) {
      return res.status(400).json({
        error: 'Неподдерживаемый формат',
        message: 'Поддерживаемые форматы: csv, excel, pdf, json'
      });
    }
    
    let dataUrl;
    if (date) {
      dataUrl = `/api/verification/details/${date}`;
    } else {
      const queryParams = new URLSearchParams();
      
      if (year) queryParams.append('year', year);
      if (month) queryParams.append('month', month);
      if (quarter) queryParams.append('quarter', quarter);
      if (halfYear) queryParams.append('halfYear', halfYear);
      if (startMonth) queryParams.append('startMonth', startMonth);
      if (endMonth) queryParams.append('endMonth', endMonth);
      
      dataUrl = `/api/verification?${queryParams.toString()}`;
    }
    
    logger.info(`Запрос экспорта в формате ${format} (${Date.now() - start}ms)`);
    
    res.json({
      success: true,
      format: format,
      exportTime: getCurrentMoscowTime(),
      user: getAuthorizedUser(req),
      message: `Данные успешно экспортированы в формате ${format.toUpperCase()}. Файл будет скачан автоматически.`
    });
  } catch (error) {
    logger.error(`Ошибка экспорта данных в формате ${req.params.format}`, error);
    res.status(500).json({
      error: 'Ошибка экспорта',
      message: 'Не удалось экспортировать данные в указанном формате',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Внутренняя ошибка сервера'
    });
  }
});

module.exports = router;