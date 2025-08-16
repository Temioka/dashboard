const { queryCache, CACHE_TTL } = require('../config/server');
const logger = require('../config/logger');

/**
 * Функция для очистки устаревших записей в кеше
 */
function clearOldCacheEntries() {
  const now = Date.now();
  let removedCount = 0;
  
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      queryCache.delete(key);
      removedCount++;
    }
  }
  
  if (removedCount > 0) {
    logger.debug(`Очищено ${removedCount} устаревших записей в кеше`);
  }
}

/**
 * Очистка всего кеша
 */
function clearAllCache() {
  const count = queryCache.size;
  queryCache.clear();
  logger.info(`Кеш очищен (${count} элементов)`);
  return count;
}

module.exports = {
  clearOldCacheEntries,
  clearAllCache
};