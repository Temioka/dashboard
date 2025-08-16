/**
 * Получение актуальной даты и времени в формате YYYY-MM-DD HH:MM:SS по МСК
 * @returns {string} Текущая дата и время
 */
function getCurrentMoscowTime() {
  const now = new Date();
  const moscowTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  
  const year = moscowTime.getUTCFullYear();
  const month = String(moscowTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(moscowTime.getUTCDate()).padStart(2, '0');
  const hours = String(moscowTime.getUTCHours()).padStart(2, '0');
  const minutes = String(moscowTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(moscowTime.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Вспомогательная функция для генерации меток месяцев
 * @param {number} count - Количество месяцев
 * @returns {Array} - Массив названий месяцев
 */
function generateMonthLabels(count) {
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  
  const today = new Date();
  const currentMonth = today.getMonth();
  
  const result = [];
  for (let i = count - 1; i >= 0; i--) {
    const monthIndex = (currentMonth - i + 12) % 12;
    result.push(months[monthIndex]);
  }
  
  return result;
}

module.exports = {
  getCurrentMoscowTime,
  generateMonthLabels
};