/**
 * Получение имени авторизованного пользователя
 * @param {Request} req - Объект запроса Express
 * @returns {string|null} Имя авторизованного пользователя или null
 */
function getAuthorizedUser(req) {
  if (!req) return null;
  
  const sessionUser = req.session?.username;
  const sessionLoginUser = req.session?.user?.login;
  const headerUser = req.headers?.['x-user'];
  
  return sessionUser || sessionLoginUser || headerUser || null;
}

/**
 * Фильтрация меню на основе прав доступа
 * @param {Array} items - Элементы меню
 * @param {Request} req - Объект запроса Express
 * @returns {Array} Отфильтрованные элементы меню
 */
const filterMenuByPermissions = (items, req) => {
  const userRole = req.session?.role || 'user';
  
  return items
    .filter(item => {
      if (!item.requiresAuth) return true;
      
      if (item.requiresRole && !item.requiresRole.includes(userRole)) {
        return false;
      }
      
      if (item.submenu) {
        item.submenu = item.submenu.filter(subItem => {
          if (!subItem.requiresAuth) return true;
          
          if (subItem.requiresRole && !subItem.requiresRole.includes(userRole)) {
            return false;
          }
          
          return true;
        });
      }
      
      return true;
    })
    .sort((a, b) => a.order - b.order);
};

module.exports = {
  getAuthorizedUser,
  filterMenuByPermissions
};