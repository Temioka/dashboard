// Определение apiService
window.apiService = {
    get: async function(url) {
      try {
        const response = await fetch(url, {
          credentials: 'same-origin', // Включаем отправку куки для сессии
          headers: {
            'Accept': 'application/json'
          }
        });
        return response;
      } catch (error) {
        console.error('GET-запрос завершился с ошибкой:', error);
        throw error;
      }
    },
    post: async function(url, data) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'same-origin', // Включаем отправку куки для сессии
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        // Обрабатываем ответ для уведомлений
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const jsonData = await response.json();
            
            // Проверяем, есть ли уведомление в ответе
            if (jsonData._notification) {
              showNotification(jsonData._notification.message, jsonData._notification.type);
            }
            
            // Создаем новый Response для дальнейшей обработки
            const newResponse = new Response(JSON.stringify(jsonData), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
            
            return newResponse;
          }
        } catch (jsonError) {
          console.warn('Ошибка парсинга JSON ответа:', jsonError);
        }
        
        return response;
      } catch (error) {
        console.error('POST-запрос завершился с ошибкой:', error);
        throw error;
      }
    },
    delete: async function(url) {
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          credentials: 'same-origin' // Включаем отправку куки для сессии
        });
        return response;
      } catch (error) {
        console.error('DELETE-запрос завершился с ошибкой:', error);
        throw error;
      }
    }
};

// Функция для обновления виджета времени
function updateTimeWidget() {
    const timeWidget = document.querySelector('.time-widget-center img');
    if (timeWidget) {
        // Добавляем случайный параметр для предотвращения кеширования
        const timestamp = new Date().getTime();
        const baseUrl = 'https://www.timeserver.ru/widget/586911/time?theme=dark';
        
        // Обновляем src изображения с новым timestamp
        timeWidget.src = `${baseUrl}&t=${timestamp}`;
    }
}

// Функция для инициализации автообновления
function initTimeWidgetAutoRefresh() {
    // Обновляем виджет каждую минуту (60000 миллисекунд)
    setInterval(updateTimeWidget, 10000);
    
    // Также обновляем при загрузке страницы
    updateTimeWidget();
}

// Запускаем автообновление после загрузки DOM
document.addEventListener('DOMContentLoaded', initTimeWidgetAutoRefresh);

// Дополнительно: обновляем при возвращении на вкладку
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        updateTimeWidget();
    }
});
  
// Определение showNotification
function showNotification(message, type = 'info') {
  if (!message) return;
  
  // Находим или создаем контейнер для уведомлений
  let container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  
  // Создаем новое уведомление
  const notificationElement = document.createElement('div');
  notificationElement.className = `notification ${type}`;
  
  // Добавляем содержимое уведомления
  notificationElement.innerHTML = `
    <div class="notification-content">${message}</div>
    <span class="notification-close">&times;</span>
  `;
  
  // Добавляем в контейнер
  container.appendChild(notificationElement);
  
  // Добавляем обработчик для закрытия уведомления
  const closeBtn = notificationElement.querySelector('.notification-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      notificationElement.classList.add('fade-out');
      setTimeout(() => {
        if (notificationElement.parentNode) {
          notificationElement.parentNode.removeChild(notificationElement);
        }
      }, 500);
    });
  }
  
  // Автоматически закрываем через 5 секунд
  setTimeout(() => {
    notificationElement.classList.add('fade-out');
    setTimeout(() => {
      if (notificationElement.parentNode) {
        notificationElement.parentNode.removeChild(notificationElement);
      }
    }, 500);
  }, 5000);
}

window.showNotification = showNotification;

document.addEventListener('DOMContentLoaded', () => {
    // Константы
    const API_BASE = '';
    const CURRENT_DATE = new Date();
    const MONTHS = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];
    
    // Добавляем стили для уведомлений
    const notificationStyles = `
    `;
    
    // Вставляем стили на страницу
    const styleElement = document.createElement('style');
    styleElement.textContent = notificationStyles;
    document.head.appendChild(styleElement);
    
    // Кэш DOM элементов, используем существующие элементы
    const DOM = {
        loginBtn: document.getElementById('loginBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        loginModal: document.getElementById('loginModal'),
        closeModal: document.getElementById('closeModal'),
        loginForm: document.getElementById('loginForm'),
        mainContent: document.getElementById('mainContent'),
        notification: document.getElementById('notification'),
        dropdownToggles: document.querySelectorAll('.dropdown-toggle'),
        sidebarLinks: document.querySelectorAll('.nav a:not(#loginBtn)'),
        overlay: document.getElementById('overlay'),
        currentPage: document.body.getAttribute('data-page'),
        returnPathInput: document.getElementById('returnPath') || document.createElement('input'),
        loginSubmitBtn: document.querySelector('.btn-login')
    };
    
    // Если элемент для сохранения пути возврата не существует, создадим его
    if (!document.getElementById('returnPath')) {
        DOM.returnPathInput.id = 'returnPath';
        DOM.returnPathInput.type = 'hidden';
        document.body.appendChild(DOM.returnPathInput);
    }

    // Утилиты
    const Utils = {
        getCurrentDateTime() {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ` +
                   `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        },
        
        formatDate(dateStr) {
            if (!dateStr) return '';
            try {
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? dateStr : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
            } catch (error) {
                console.error('Ошибка форматирования даты:', error);
                return dateStr;
            }
        },
        
        truncateLabel(label, maxLength = 25) {
            return typeof label === 'string' && label.length > maxLength 
                ? label.substring(0, maxLength - 3) + '...' 
                : label;
        },
        
        checkElements(elements) {
            for (const [name, element] of Object.entries(elements)) {
                if (!element) {
                    console.error(`Элемент ${name} не найден`);
                    return false;
                }
            }
            return true;
        },
        
        animateCounter(element, target) {
            if (!element) return;
            
            const startValue = parseInt(element.textContent) || 0;
            const duration = 1000;
            const stepTime = 20;
            const totalSteps = duration / stepTime;
            let currentStep = 0;
            
            const stepValue = (target - startValue) / totalSteps;
            
            const interval = setInterval(() => {
                currentStep++;
                const value = startValue + Math.floor(stepValue * currentStep);
                element.textContent = target % 1 !== 0 && currentStep === totalSteps 
                    ? target.toFixed(1) : value;
                
                if (currentStep >= totalSteps) {
                    element.textContent = target % 1 !== 0 ? target.toFixed(1) : target;
                    clearInterval(interval);
                }
            }, stepTime);
        },
        
        // Получаем текущий URL-путь для восстановления после авторизации
        getCurrentPath() {
            return window.location.pathname + window.location.search;
        },
        
        // Сохраняем путь для возврата
        saveReturnPath() {
            const currentPath = this.getCurrentPath();
            localStorage.setItem('returnPath', currentPath);
            DOM.returnPathInput.value = currentPath;
        }
    };

    // Управление авторизацией
    const Auth = {
        isAuthenticated: false,
        
        async checkAuthStatus() {
            try {
                const response = await apiService.get(`${API_BASE}/api/auth/status`);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    this.isAuthenticated = data.isAuthenticated;
                    
                    if (data.isAuthenticated) {
                        localStorage.setItem('isAuthenticated', 'true');
                        localStorage.setItem('username', data.username || '');
                        return true;
                    } else {
                        localStorage.removeItem('isAuthenticated');
                        localStorage.removeItem('username');
                        return false;
                    }
                } else {
                    console.warn('Ошибка проверки статуса авторизации:', response.status);
                    
                    // При ошибке используем локальное состояние
                    this.isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
                    return this.isAuthenticated;
                }
            } catch (error) {
                console.error('Ошибка проверки статуса авторизации:', error);
                
                // При ошибке соединения с сервером используем локальную информацию
                this.isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
                return this.isAuthenticated;
            }
        },
        
        async loadUserData(username) {
            try {
                const userResponse = await apiService.get(`${API_BASE}/api/user/${username}`);
                
                if (!userResponse.ok) {
                    throw new Error(`Ошибка при получении данных пользователя: ${userResponse.status}`);
                }
                
                const userData = await userResponse.json();
                localStorage.setItem('userData', JSON.stringify(userData));
                return userData;
            } catch (error) {
                console.error('Ошибка загрузки данных пользователя:', error);
                
                // Используем минимальные данные при ошибке
                const username = localStorage.getItem('username') || 'user';
                const mockUserData = {
                    username: username,
                    full_name: username
                };
                
                localStorage.setItem('userData', JSON.stringify(mockUserData));
                return mockUserData;
            }
        },
        
        async login(username, password) {
            if (!username || !password) {
                showNotification('Пожалуйста, заполните все поля', 'error');
                return false;
            }
        
            try {
                const response = await apiService.post(`${API_BASE}/login`, { 
                    username, 
                    password,
                    returnPath: DOM.returnPathInput.value || Utils.getCurrentPath()
                });
        
                if (response.ok) {
                    try {
                        const data = await response.json();
                        
                        if (data.isAuthenticated) {
                            localStorage.setItem('isAuthenticated', 'true');
                            localStorage.setItem('username', username);
                            this.isAuthenticated = true;
                            
                            // Загружаем данные пользователя
                            await this.loadUserData(username);
                            return true;
                        } else {
                            showNotification(data.message || 'Неверный логин или пароль', 'error');
                            return false;
                        }
                    } catch (jsonError) {
                        console.error('Ошибка обработки JSON:', jsonError);
                        showNotification('Ошибка обработки ответа', 'error');
                        return false;
                    }
                } else {
                    // Обработка ошибки от сервера
                    if (response.status === 401) {
                        showNotification('Неверный логин или пароль', 'error');
                    } else {
                        showNotification('Ошибка авторизации', 'error');
                    }
                    return false;
                }
            } catch (error) {
                console.error('Ошибка при входе в систему:', error);
                showNotification('Ошибка при входе в систему', 'error');
                return false;
            }
        },
        
        async logout() {
            // Сохраняем текущий путь для возврата после логина
            Utils.saveReturnPath();
            
            try {
                // Очищаем локальное хранилище
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('userData');
                localStorage.removeItem('username');
                this.isAuthenticated = false;
                
                // Отправляем запрос на сервер
                const response = await apiService.post(`${API_BASE}/logout`, {
                    returnPath: Utils.getCurrentPath()
                });
                
                // Показываем уведомление
                showNotification('Вы вышли из системы', 'info');
                
                // Перезагружаем страницу
                setTimeout(() => window.location.reload(), 500);
                
            } catch (error) {
                console.error('Ошибка при выходе из системы:', error);
                
                // Очищаем хранилище в любом случае
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('userData');
                this.isAuthenticated = false;
                
                // Перезагружаем страницу
                setTimeout(() => window.location.reload(), 500);
            }
        }
    };

    // Управление UI
    const UI = {
        async update() {
            // Проверяем, существуют ли нужные элементы DOM
            if (!document.body) return;
            
            // Обновляем статус авторизации
            const isLoggedIn = await Auth.checkAuthStatus();
            console.log('Обновление интерфейса. Авторизован:', isLoggedIn);
            
            // Обновляем видимость основного контента
            if (DOM.mainContent) {
                DOM.mainContent.classList.toggle('show', isLoggedIn);
                DOM.mainContent.style.display = isLoggedIn ? 'block' : 'none';
            }
            
            // Обновляем видимость кнопок входа/выхода
            if (DOM.loginBtn) DOM.loginBtn.style.display = isLoggedIn ? 'none' : 'inline-block';
            if (DOM.logoutBtn) DOM.logoutBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
            
            // Обновляем состояние боковых ссылок
            this.toggleSidebarLinks(isLoggedIn);
            
            // Обновляем данные профиля, если пользователь авторизован
            if (isLoggedIn) {
                // Загружаем данные пользователя
                const username = localStorage.getItem('username');
                if (username) {
                    await Auth.loadUserData(username);
                }
                
                this.updateProfileData();
                
                // Инициализируем специфичные для страницы модули
                const actualPage = DOM.currentPage || this.determinePageFromURL();
                this.initPageSpecificModules(actualPage);
            } else {
                // Показываем форму входа только если мы на странице, требующей авторизации
                if (!this.isPublicPage()) {
                    // Сохраняем текущий путь
                    Utils.saveReturnPath();
                    
                    // Открываем модальное окно
                    this.openAuthModal();
                    
                    // Показываем сообщение о необходимости авторизации
                    showNotification('Пожалуйста, авторизуйтесь для доступа к этому разделу', 'info');
                }
            }
        },
        
        async initPageSpecificModules(page) {
            // Инициализируем модули с небольшой задержкой
            await new Promise(resolve => setTimeout(resolve, 50));
            
            switch (page) {
                case 'statistics':
                    if (typeof window.Charts !== 'undefined' && window.Charts.initialize) {
                        await window.Charts.initialize();
                        showNotification('Данные статистики загружены', 'success');
                    }
                    break;
                case 'verification':
                    if (typeof window.VerificationTable !== 'undefined' && window.VerificationTable.initialize) {
                        await window.VerificationTable.initialize();
                        showNotification('Данные верификации загружены', 'success');
                    }
                    break;
                case 'dashboard':
                    if (typeof window.Dashboard !== 'undefined' && window.Dashboard.initialize) {
                        await window.Dashboard.initialize();
                        showNotification('Данные дашборда загружены', 'success');
                    }
                    break;
            }
        },
        
        determinePageFromURL() {
            const path = window.location.pathname.toLowerCase();
            if (path.includes('verification') || path.endsWith('verification.html')) return 'verification';
            if (path.includes('statistics') || path.endsWith('statistics.html')) return 'statistics';
            if (path.includes('dashboard') || path.endsWith('dashboard.html')) return 'dashboard';
            return 'main';
        },
        
        isPublicPage() {
            const path = window.location.pathname.toLowerCase();
            return path === '/' || 
                path === '/index.html' || 
                path.includes('login') || 
                path.includes('about') || 
                path.includes('contact');
        },
        
        toggleSidebarLinks(enable) {
            if (!DOM.sidebarLinks?.length) return;
            
            DOM.sidebarLinks.forEach(link => {
                link.classList.toggle('disabled', !enable);
                
                // Удаляем старый обработчик 
                link.removeEventListener('click', this.notifyToLogin);
                
                // Добавляем новый обработчик, если не авторизован
                if (!enable) {
                    link.addEventListener('click', this.notifyToLogin);
                }
            });
        },
        
        notifyToLogin(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Сохраняем путь для возврата
            Utils.saveReturnPath();
            
            // Показываем уведомление и форму входа
            showNotification('Пожалуйста, авторизуйтесь для доступа к этому разделу', 'warning');
            UI.openAuthModal();
        },
        
        updateProfileData() {
            const storedUserData = localStorage.getItem('userData');
            
            if (storedUserData) {
                try {
                    const userData = JSON.parse(storedUserData);
                    
                    // Обновляем поля профиля
                    const elements = {
                        full_name: document.getElementById('full_name'),
                        email: document.getElementById('email'),
                        department: document.getElementById('department'),
                        username: document.getElementById('profile-username')
                    };
                    
                    for (const [id, element] of Object.entries(elements)) {
                        if (element) element.textContent = userData[id] || 'Неизвестно';
                    }
                    
                    // Обновляем данные пользователя в шапке
                    this.updateHeaderUserInfo(userData);
                } catch (error) {
                    console.error('Ошибка парсинга userData:', error);
                }
            }
        },
        
        updateHeaderUserInfo(userData) {
            // Обновляем данные в шапке
            const headerUserInfo = document.querySelector('.user-info, .header-user-info');
            
            if (headerUserInfo) {
                headerUserInfo.innerHTML = `
                    <div class="user-name">${userData.full_name || userData.username || ''}</div>
                    <div class="user-role">${userData.department || userData.role || ''}</div>
                `;
            }
            
            // Обновляем системное инфо, если оно есть
            const systemInfo = document.querySelector('.system-info');
            if (systemInfo) {
                const timeElement = systemInfo.querySelector('.info-item span:first-child');
                if (timeElement) {
                    timeElement.textContent = Utils.getCurrentDateTime();
                }
                
                const userElement = systemInfo.querySelector('.info-item.user-info span');
                if (userElement) {
                    userElement.textContent = userData.username || '';
                }
            }
        },
        
        openAuthModal() {
            if (!DOM.loginModal || !DOM.overlay) return;
            
            // Сохраняем путь возврата
            Utils.saveReturnPath();
            
            // Сбрасываем форму
            DOM.loginForm?.reset();
            
            // Показываем модальное окно
            DOM.overlay.classList.add('active');
            document.body.classList.add('modal-open');
            DOM.loginModal.style.display = 'block';
            DOM.loginModal.setAttribute('aria-hidden', 'false');
            
            // Устанавливаем фокус на поле логина
            const usernameInput = document.getElementById('username');
            if (usernameInput) {
                setTimeout(() => usernameInput.focus(), 100);
            }
        },
        
        closeAuthModal() {
            if (!DOM.loginModal || !DOM.overlay) return;
            
            DOM.overlay.classList.remove('active');
            document.body.classList.remove('modal-open');
            DOM.loginModal.style.display = 'none';
            DOM.loginModal.setAttribute('aria-hidden', 'true');
            
            DOM.loginForm?.reset();
        },
        
        showLoginLoading() {
            if (DOM.loginSubmitBtn) {
                DOM.loginSubmitBtn.disabled = true;
                DOM.loginSubmitBtn.classList.add('loading');
                DOM.loginSubmitBtn.dataset.originalText = DOM.loginSubmitBtn.textContent;
                DOM.loginSubmitBtn.textContent = 'Выполняется вход...';
            }
        },
        
        hideLoginLoading() {
            if (DOM.loginSubmitBtn) {
                DOM.loginSubmitBtn.disabled = false;
                DOM.loginSubmitBtn.classList.remove('loading');
                if (DOM.loginSubmitBtn.dataset.originalText) {
                    DOM.loginSubmitBtn.textContent = DOM.loginSubmitBtn.dataset.originalText;
                } else {
                    DOM.loginSubmitBtn.textContent = 'Войти';
                }
            }
        }
    };

    // Инициализация приложения
    async function initApp() {
        console.log('Инициализация приложения');
        
        // Обновляем интерфейс и проверяем авторизацию
        await UI.update();
        
        // Обработчики событий
        
        // Форма входа
        if (DOM.loginForm) {
            DOM.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                UI.showLoginLoading();
                
                const username = document.getElementById('username')?.value;
                const password = document.getElementById('password')?.value;
                
                try {
                    if (await Auth.login(username, password)) {
                        UI.closeAuthModal();
                        await UI.update();
                        
                        // Проверяем путь возврата
                        const returnPath = localStorage.getItem('returnPath');
                        if (returnPath && returnPath !== window.location.pathname) {
                            window.location.href = returnPath;
                        }
                    }
                } finally {
                    UI.hideLoginLoading();
                }
            });
        }
        
        // Кнопка выхода
        if (DOM.logoutBtn) {
            DOM.logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await Auth.logout();
            });
        }
        
        // Открытие формы входа
        if (DOM.loginBtn) {
            DOM.loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                UI.openAuthModal();
            });
        }
        
        // Закрытие формы входа
        if (DOM.closeModal) {
            DOM.closeModal.addEventListener('click', (e) => {
                e.preventDefault();
                UI.closeAuthModal();
            });
        }
        
        // Клавиша Escape для закрытия модального окна
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && DOM.overlay?.classList.contains('active')) {
                UI.closeAuthModal();
            }
        });
        
        // Клик по оверлею для закрытия модального окна
        DOM.overlay?.addEventListener('click', function(e) {
            if (e.target === DOM.overlay) {
                UI.closeAuthModal();
            }
        });
        
        // Обработчики выпадающих меню
        DOM.dropdownToggles.forEach(toggle => {
            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                if (this.classList.contains('disabled')) return;
                
                const dropdownMenu = this.nextElementSibling;
                if (!dropdownMenu) return;
                
                // Закрываем все другие меню
                DOM.dropdownToggles.forEach(otherToggle => {
                    if (otherToggle !== this && otherToggle.nextElementSibling) {
                        otherToggle.nextElementSibling.classList.remove('active');
                    }
                });
                
                // Переключаем текущее меню
                dropdownMenu.classList.toggle('active');
            });
        });
        
        // Закрытие выпадающих меню при клике вне
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.dropdown-toggle') && !e.target.closest('.dropdown-menu')) {
                document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                    menu.classList.remove('active');
                });
            }
        });
        
        // Перехват кликов по ссылкам для проверки авторизации
        document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            
            if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                const href = link.getAttribute('href');
                
                if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('javascript:')) {
                    return;
                }
                
                // Проверяем, требует ли страница авторизации
                const isPublicPage = href === '/' || 
                                    href === '/index.html' || 
                                    href.includes('login') || 
                                    href.includes('about') || 
                                    href.includes('contact');
                
                // Если страница защищена и пользователь не авторизован
                if (!isPublicPage && !Auth.isAuthenticated) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    localStorage.setItem('returnPath', href);
                    DOM.returnPathInput.value = href;
                    
                    showNotification('Пожалуйста, авторизуйтесь для доступа к этому разделу', 'warning');
                    UI.openAuthModal();
                }
            }
        });
    }

    // Запускаем приложение
    initApp();
});