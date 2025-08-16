// Используем IIFE для изоляции кода и предотвращения глобального загрязнения
const toast = (() => {
  'use strict';

  // Настройки по умолчанию
  const DEFAULT_OPTIONS = {
    position: 'top-right',          // Позиция уведомлений на экране
    maxVisible: 5,                  // Макс. кол-во одновременно видимых уведомлений
    defaultDuration: 5000,          // Длительность по умолчанию (мс)
    pauseOnHover: true,             // Останавливать отсчет при наведении
    newestOnTop: true,              // Новые уведомления сверху
    preventDuplicates: true,        // Предотвращать дубликаты
    escapeHtml: true,               // Экранировать HTML
    enableEffects: true,            // Расширенные визуальные эффекты
    enableSounds: false,            // Звуковые эффекты
    soundVolume: 0.5,               // Громкость (0-1)
    clickToClose: true,             // Закрывать по клику
    dragToClose: true,              // Закрывать перетаскиванием
    showProgressBar: true,          // Индикатор прогресса
    iconLibrary: 'svg',             // Тип иконок: 'svg', 'fontawesome'
    theme: 'auto',                  // Тема: 'dark', 'light', 'auto'
    autoHideAnimationDuration: 300, // Длительность анимации скрытия (мс)
    showAnimationDuration: 300,     // Длительность анимации появления (мс)
    zIndex: 2147483640,             // Базовый z-index
    reactToVisibilityChange: true,  // Реагировать на переключение вкладок
    a11yCloseLabel: 'Закрыть',      // Текст для скринридеров для кнопки закрытия
    a11yRole: 'alert',              // ARIA-роль уведомления
    restoreOnFocus: true,           // Восстанавливать таймер при возврате фокуса
    transitionOnUpdate: true,       // Анимация при обновлении содержимого
    showBadge: true,                // Показывать маркер кол-ва для свернутых уведомлений
    uniqueIdPrefix: 'toast-',       // Префикс для генерации идентификаторов
    highContrastMode: false,        // Режим высокой контрастности
    enableIntersectionObserver: true, // Использовать IntersectionObserver
    enableReducedMotion: true,      // Поддержка prefers-reduced-motion
    animateProgressBar: true,       // Анимировать прогресс-бар
    logEvents: false,               // Логирование событий уведомлений
    enableKeyboardShortcuts: true,  // Поддержка клавиатурных сокращений
    enableGestureControl: true,     // Управление жестами (на мобильных)
    enableVibration: false,         // Вибрация для важных уведомлений
    preventMultipleInstances: true, // Предотвращать создание нескольких экземпляров
  };

  // Создаем закрытые свойства с помощью замыканий
  let options = { ...DEFAULT_OPTIONS };
  let container = null;
  let queue = [];
  let visibleCount = 0;
  let notificationMap = new Map();
  let zIndexCounter = options.zIndex;
  let draggedNotification = null;
  let audioElements = {};
  let inactiveTabTime = 0;
  let isIntersectionObserverSupported = 'IntersectionObserver' in window;
  let intersectionObserver = null;
  let documentHasFocus = document.hasFocus();
  let reducedMotionActive = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pendingTimeouts = new Map();
  let instanceId = Math.random().toString(36).substring(2, 15);
  
  // Для отслеживания общего количества уведомлений
  let totalNotificationsCount = 0;
  let hiddenNotificationsCount = 0;
  
  // Элемент для отображения количества свернутых уведомлений
  let notificationBadge = null;

  /**
   * Функция для быстрого создания элементов DOM с атрибутами и дочерними элементами
   * @param {string} tag - Имя тега
   * @param {Object} attributes - Объект с атрибутами
   * @param {Array|string} children - Дочерние элементы или текст
   * @returns {HTMLElement} Созданный элемент
   */
  const createElement = (tag, attributes = {}, children = []) => {
    const element = document.createElement(tag);
    
    // Устанавливаем атрибуты
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.substring(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else {
        element[key] = value;
      }
    });
    
    // Добавляем дочерние элементы
    if (Array.isArray(children)) {
      children.forEach(child => {
        if (child instanceof Node) {
          element.appendChild(child);
        } else if (child !== null && child !== undefined) {
          element.appendChild(document.createTextNode(String(child)));
        }
      });
    } else if (children !== null && children !== undefined) {
      element.textContent = String(children);
    }
    
    return element;
  };

  /**
   * Инициализация звуковых эффектов
   */
  const initSounds = () => {
    if (!options.enableSounds) return;
    
    // Используем Web Audio API для лучшей производительности
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Создаем аудио элементы для разных типов уведомлений
    const soundTypes = {
      success: 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaGRtaS5jb20gU291bmQgRWZmZWN0FRSSE5YQhJaEQ',
      error: 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaGRtaS5jb20gU291bmQgRWZmZWN0VVVURU5TUT==',
      warning: 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaGRtaS5jb20gU291bmQgRWZmZWN0QUJDQUJDQQ==',
      info: 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaGRtaS5jb20gU291bmQgRWZmZWN0MTIzNDU2Nzg='
    };
    
    Object.entries(soundTypes).forEach(([type, src]) => {
      const audio = new Audio(src);
      audio.volume = options.soundVolume;
      audioElements[type] = audio;
    });
  };

  /**
   * Воспроизводит звук для типа уведомления
   * @param {string} type - Тип уведомления
   */
  const playSound = (type) => {
    if (!options.enableSounds) return;
    
    const audio = audioElements[type];
    if (audio) {
      // Используем promise для отслеживания ошибок
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Игнорируем ошибки воспроизведения (политика браузеров)
        if (options.logEvents) {
          console.debug('Toast: Error playing sound for notification type:', type);
        }
      });
    }
  };

  /**
   * Установка темы уведомлений
   * @param {string} theme - Тема ('dark', 'light', 'auto')
   */
  const setTheme = (theme) => {
    options.theme = theme;
    
    // Если тема 'auto', определяем по предпочтениям системы
    const effectiveTheme = theme === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme;
    
    // Добавляем класс темы к контейнеру и атрибут для CSS
    if (container) {
      container.classList.remove('theme-light', 'theme-dark');
      container.classList.add(`theme-${effectiveTheme}`);
      container.setAttribute('data-theme', effectiveTheme);
      
      // Устанавливаем атрибут на уровне document для глобальных стилей
      document.documentElement.setAttribute('data-toast-theme', effectiveTheme);
    }
    
    // Добавляем CSS переменные для темы, если они еще не добавлены
    addThemeStyles(effectiveTheme);
  };

  /**
   * Добавляет CSS стили для выбранной темы
   * @param {string} theme - Тема ('dark' или 'light')
   */
  const addThemeStyles = (theme) => {
    if (document.getElementById('notification-theme-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-theme-styles';
    
    // Определяем CSS переменные для светлой и темной темы
    // Используем современный подход с CSS переменными для легкой кастомизации
    style.textContent = `
      :root {
        --toast-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
        --toast-font-size: 14px;
        --toast-border-radius: 12px;
        --toast-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        --toast-title-font-size: 16px;
        --toast-title-font-weight: 600;
        --toast-message-line-height: 1.5;
        --toast-padding: 16px;
        --toast-progress-height: 4px;
        
        /* Цвета по типам для светлой темы */
        --toast-light-success-bg: rgba(239, 253, 244, 0.95);
        --toast-light-success-color: #0c6b44;
        --toast-light-success-border: rgba(12, 107, 68, 0.2);
        --toast-light-success-icon: #0c9d58;
        --toast-light-success-progress: rgba(12, 157, 88, 0.7);
        
        --toast-light-error-bg: rgba(254, 242, 242, 0.95);
        --toast-light-error-color: #b91c1c;
        --toast-light-error-border: rgba(185, 28, 28, 0.2);
        --toast-light-error-icon: #d32f2f;
        --toast-light-error-progress: rgba(211, 47, 47, 0.7);
        
        --toast-light-warning-bg: rgba(255, 251, 235, 0.95);
        --toast-light-warning-color: #d97706;
        --toast-light-warning-border: rgba(217, 119, 6, 0.2);
        --toast-light-warning-icon: #f59e0b;
        --toast-light-warning-progress: rgba(245, 158, 11, 0.7);
        
        --toast-light-info-bg: rgba(239, 246, 255, 0.95);
        --toast-light-info-color: #1d4ed8;
        --toast-light-info-border: rgba(29, 78, 216, 0.2);
        --toast-light-info-icon: #3b82f6;
        --toast-light-info-progress: rgba(59, 130, 246, 0.7);
        
        /* Цвета по типам для темной темы */
        --toast-dark-success-bg: rgba(10, 49, 33, 0.95);
        --toast-dark-success-color: #a7f3d0;
        --toast-dark-success-border: rgba(167, 243, 208, 0.2);
        --toast-dark-success-icon: #10b981;
        --toast-dark-success-progress: rgba(16, 185, 129, 0.7);
        
        --toast-dark-error-bg: rgba(52, 17, 16, 0.95);
        --toast-dark-error-color: #fecaca;
        --toast-dark-error-border: rgba(254, 202, 202, 0.2);
        --toast-dark-error-icon: #ef4444;
        --toast-dark-error-progress: rgba(239, 68, 68, 0.7);
        
        --toast-dark-warning-bg: rgba(59, 42, 13, 0.95);
        --toast-dark-warning-color: #fef3c7;
        --toast-dark-warning-border: rgba(254, 243, 199, 0.2);
        --toast-dark-warning-icon: #f59e0b;
        --toast-dark-warning-progress: rgba(245, 158, 11, 0.7);
        
        --toast-dark-info-bg: rgba(19, 38, 78, 0.95);
        --toast-dark-info-color: #dbeafe;
        --toast-dark-info-border: rgba(219, 234, 254, 0.2);
        --toast-dark-info-icon: #3b82f6;
        --toast-dark-info-progress: rgba(59, 130, 246, 0.7);
      }
      
      /* Контейнер для уведомлений */
      .notification-container {
        position: fixed;
        z-index: ${options.zIndex};
        max-width: 420px;
        width: auto;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 16px;
        box-sizing: border-box;
        transition: all 0.3s ease;
        font-family: var(--toast-font-family);
      }
      
      /* Позиционирование */
      .notification-container.top-right {
        top: 16px;
        right: 16px;
        align-items: flex-end;
      }
      
      .notification-container.top-left {
        top: 16px;
        left: 16px;
        align-items: flex-start;
      }
      
      .notification-container.bottom-right {
        bottom: 16px;
        right: 16px;
        align-items: flex-end;
      }
      
      .notification-container.bottom-left {
        bottom: 16px;
        left: 16px;
        align-items: flex-start;
      }
      
      .notification-container.top-center {
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        align-items: center;
      }
      
      .notification-container.bottom-center {
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        align-items: center;
      }
      
      /* Уведомление */
      .notification {
        position: relative;
        min-width: 280px;
        max-width: 100%;
        overflow: hidden;
        pointer-events: auto;
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: var(--toast-padding);
        border-radius: var(--toast-border-radius);
        box-shadow: var(--toast-shadow);
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        transition: 
          transform ${options.showAnimationDuration}ms cubic-bezier(0.19, 1, 0.22, 1),
          opacity ${options.showAnimationDuration}ms cubic-bezier(0.19, 1, 0.22, 1);
        backface-visibility: hidden;
        will-change: transform, opacity;
        font-size: var(--toast-font-size);
      }
      
      /* Состояние при появлении */
      .notification.show {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      
      /* Состояние при скрытии */
      .notification.hide {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
        pointer-events: none;
        transition: 
          transform ${options.autoHideAnimationDuration}ms cubic-bezier(0.19, 1, 0.22, 1),
          opacity ${options.autoHideAnimationDuration}ms cubic-bezier(0.19, 1, 0.22, 1);
      }
      
      /* Тематические стили для светлой темы */
      .notification-container.theme-light .notification.success {
        background-color: var(--toast-light-success-bg);
        color: var(--toast-light-success-color);
        border: 1px solid var(--toast-light-success-border);
      }
      
      .notification-container.theme-light .notification.error {
        background-color: var(--toast-light-error-bg);
        color: var(--toast-light-error-color);
        border: 1px solid var(--toast-light-error-border);
      }
      
      .notification-container.theme-light .notification.warning {
        background-color: var(--toast-light-warning-bg);
        color: var(--toast-light-warning-color);
        border: 1px solid var(--toast-light-warning-border);
      }
      
      .notification-container.theme-light .notification.info {
        background-color: var(--toast-light-info-bg);
        color: var(--toast-light-info-color);
        border: 1px solid var(--toast-light-info-border);
      }
      
      /* Тематические стили для темной темы */
      .notification-container.theme-dark .notification.success {
        background-color: var(--toast-dark-success-bg);
        color: var(--toast-dark-success-color);
        border: 1px solid var(--toast-dark-success-border);
      }
      
      .notification-container.theme-dark .notification.error {
        background-color: var(--toast-dark-error-bg);
        color: var(--toast-dark-error-color);
        border: 1px solid var(--toast-dark-error-border);
      }
      
      .notification-container.theme-dark .notification.warning {
        background-color: var(--toast-dark-warning-bg);
        color: var(--toast-dark-warning-color);
        border: 1px solid var(--toast-dark-warning-border);
      }
      
      .notification-container.theme-dark .notification.info {
        background-color: var(--toast-dark-info-bg);
        color: var(--toast-dark-info-color);
        border: 1px solid var(--toast-dark-info-border);
      }
      
      /* Иконка */
      .notification-icon {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        margin-right: 12px;
        opacity: 0.9;
      }
      
      /* Цвета иконок для разных типов и тем */
      .notification-container.theme-light .notification.success .notification-icon {
        color: var(--toast-light-success-icon);
      }
      
      .notification-container.theme-light .notification.error .notification-icon {
        color: var(--toast-light-error-icon);
      }
      
      .notification-container.theme-light .notification.warning .notification-icon {
        color: var(--toast-light-warning-icon);
      }
      
      .notification-container.theme-light .notification.info .notification-icon {
        color: var(--toast-light-info-icon);
      }
      
      .notification-container.theme-dark .notification.success .notification-icon {
        color: var(--toast-dark-success-icon);
      }
      
      .notification-container.theme-dark .notification.error .notification-icon {
        color: var(--toast-dark-error-icon);
      }
      
      .notification-container.theme-dark .notification.warning .notification-icon {
        color: var(--toast-dark-warning-icon);
      }
      
      .notification-container.theme-dark .notification.info .notification-icon {
        color: var(--toast-dark-info-icon);
      }
      
      /* Контент */
      .notification-content {
        flex-grow: 1;
        margin-right: 12px;
      }
      
      /* Заголовок */
      .notification-title {
        margin: 0 0 4px 0;
        font-size: var(--toast-title-font-size);
        font-weight: var(--toast-title-font-weight);
        line-height: 1.2;
      }
      
      /* Сообщение */
      .notification-message {
        margin: 0;
        line-height: var(--toast-message-line-height);
        word-wrap: break-word;
        overflow-wrap: break-word;
      }
      
      /* Кнопка закрытия */
      .notification-close {
        position: relative;
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
        background: transparent;
        border: none;
        padding: 0;
      }
      
      .notification-close:hover {
        opacity: 1;
      }
      
      .notification-close::before,
      .notification-close::after {
        content: '';
        position: absolute;
        width: 12px;
        height: 2px;
        background-color: currentColor;
        top: 50%;
        left: 50%;
      }
      
      .notification-close::before {
        transform: translate(-50%, -50%) rotate(45deg);
      }
      
      .notification-close::after {
        transform: translate(-50%, -50%) rotate(-45deg);
      }
      
      /* Прогресс-бар */
      .notification-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: var(--toast-progress-height);
        transform-origin: left;
      }
      
      /* Цвета прогресс-бара для разных типов и тем */
      .notification-container.theme-light .notification.success .notification-progress {
        background-color: var(--toast-light-success-progress);
      }
      
      .notification-container.theme-light .notification.error .notification-progress {
        background-color: var(--toast-light-error-progress);
      }
      
      .notification-container.theme-light .notification.warning .notification-progress {
        background-color: var(--toast-light-warning-progress);
      }
      
      .notification-container.theme-light .notification.info .notification-progress {
        background-color: var(--toast-light-info-progress);
      }
      
      .notification-container.theme-dark .notification.success .notification-progress {
        background-color: var(--toast-dark-success-progress);
      }
      
      .notification-container.theme-dark .notification.error .notification-progress {
        background-color: var(--toast-dark-error-progress);
      }
      
      .notification-container.theme-dark .notification.warning .notification-progress {
        background-color: var(--toast-dark-warning-progress);
      }
      
      .notification-container.theme-dark .notification.info .notification-progress {
        background-color: var(--toast-dark-info-progress);
      }
      
      /* Стили для состояния паузы */
      .notification.paused {
        animation-play-state: paused !important;
      }
      
      .notification.paused .notification-progress {
        animation-play-state: paused !important;
      }
      
      /* Стили для перетаскивания */
      .notification.dragging {
        transition: none !important;
        cursor: grabbing;
      }
      
      /* Анимация обновления содержимого */
      .notification.content-updated .notification-content {
        animation: content-update 0.5s ease;
      }
      
      @keyframes content-update {
        0% { opacity: 0.5; transform: scale(0.98); }
        100% { opacity: 1; transform: scale(1); }
      }
      
      /* Анимация для сброса таймера */
      .notification.reset-timer .notification-progress {
        animation-name: reset-progress !important;
        animation-duration: 0.3s !important;
        animation-timing-function: ease !important;
        animation-fill-mode: forwards !important;
      }
      
      @keyframes reset-progress {
        0% { opacity: 0.6; }
        50% { opacity: 0.3; }
        100% { opacity: 1; }
      }
      
      /* Анимация прогресса */
      @keyframes progress {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
      }
      
      /* Адаптивные стили для мобильных устройств */
      @media screen and (max-width: 480px) {
        .notification-container {
          left: 0 !important;
          right: 0 !important;
          max-width: 100% !important;
          padding: 8px !important;
          align-items: center !important;
        }
        
        .notification-container.top-center,
        .notification-container.bottom-center {
          transform: none !important;
        }
        
        .notification {
          width: 94% !important;
          max-width: 420px !important;
        }
      }
      
      /* Поддержка жестов для мобильных устройств */
      @media (hover: none) {
        .notification {
          touch-action: pan-y;
        }
      }
      
      /* Поддержка prefers-reduced-motion */
      @media (prefers-reduced-motion: reduce) {
        .notification,
        .notification.show,
        .notification.hide,
        .notification-close,
        .notification-progress {
          transition: opacity 0.1s ease !important;
          animation-duration: 0.1s !important;
        }
      }
      
      /* Режим высокой контрастности */
      @media (forced-colors: active) {
        .notification {
          border: 2px solid currentColor !important;
        }
        
        .notification-icon,
        .notification-close::before,
        .notification-close::after,
        .notification-progress {
          background-color: currentColor !important;
        }
      }
      
      /* Бейдж для количества скрытых уведомлений */
      .toast-notification-badge {
        position: fixed;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 10px;
        background-color: #f44336;
        color: white;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        z-index: ${options.zIndex + 1};
        cursor: pointer;
        transition: transform 0.2s ease;
      }
      
      .toast-notification-badge:hover {
        transform: scale(1.1);
      }
      
      .toast-notification-badge.top-right {
        top: 6px;
        right: 6px;
      }
      
      .toast-notification-badge.top-left {
        top: 6px;
        left: 6px;
      }
      
      .toast-notification-badge.bottom-right {
        bottom: 6px;
        right: 6px;
      }
      
      .toast-notification-badge.bottom-left {
        bottom: 6px;
        left: 6px;
      }
      
      /* Модальный диалог */
      .toast-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: ${options.zIndex + 2};
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
        perspective: 1200px;
      }
      
      .toast-modal-overlay.active {
        opacity: 1;
        visibility: visible;
      }
      
      .toast-modal {
        background: linear-gradient(145deg, rgba(30, 30, 50, 0.92), rgba(15, 15, 25, 0.95));
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow: auto;
        padding: 0;
        transform: scale(0.9) translateY(30px) rotateX(10deg);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .toast-modal.active {
        transform: scale(1) translateY(0) rotateX(0);
        opacity: 1;
      }
      
      .toast-modal-header {
        padding: 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .toast-modal-title {
        color: #ffffff;
        margin: 0;
        padding: 0;
        font-weight: 700;
        font-size: 20px;
        background: linear-gradient(90deg, #ffffff, #f0f0f0);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      
      .toast-modal-close {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
      }
      
      .toast-modal-close:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: rotate(90deg);
      }
      
      .toast-modal-body {
        padding: 20px;
      }
      
      .toast-modal-message {
        color: rgba(255, 255, 255, 0.9);
        font-size: 16px;
        line-height: 1.6;
        margin: 0;
      }
      
      .toast-modal-footer {
        padding: 15px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      
      .toast-modal-button {
        padding: 10px 20px;
        border-radius: 10px;
        border: none;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }
      
      .toast-modal-button.info {
        background: linear-gradient(135deg, #3B82F6, #60A5FA);
      }
      
      .toast-modal-button.success {
        background: linear-gradient(135deg, #10B981, #34D399);
      }
      
      .toast-modal-button.error {
        background: linear-gradient(135deg, #EF4444, #F87171);
      }
      
      .toast-modal-button.warning {
        background: linear-gradient(135deg, #F59E0B, #FBBF24);
      }
      
      .toast-modal-button:hover {
        transform: translateY(-3px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
      }
      
      .toast-modal-button:active {
        transform: translateY(0);
      }
      
      .toast-modal-cancel {
        background: rgba(255, 255, 255, 0.05);
      }
      
      .toast-modal-cancel:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      @media screen and (max-width: 576px) {
        .toast-modal {
          width: 95%;
        }
        
        .toast-modal-title {
          font-size: 18px;
        }
        
        .toast-modal-message {
          font-size: 14px;
        }
      }
    `;
    
    document.head.appendChild(style);
  };

  /**
   * Создает контейнер для уведомлений с учетом позиции
   * @returns {HTMLElement} Контейнер для уведомлений
   */
  const createContainer = () => {
    // Проверяем, существует ли уже контейнер с нашим instanceId
    let existingContainer = document.querySelector(`#notification-container-${instanceId}`);
    
    if (existingContainer) {
      // Обновляем класс у существующего контейнера
      existingContainer.className = `notification-container ${options.position} theme-${options.theme}`;
      return existingContainer;
    }
    
    // Создаем новый контейнер
    const newContainer = createElement('div', {
      id: `notification-container-${instanceId}`,
      className: `notification-container ${options.position} theme-${options.theme}`,
      'data-instance': instanceId,
      'aria-live': 'polite'
    });
    
    document.body.appendChild(newContainer);
    
    // Добавляем стили для позиционирования
    addPositioningStyles();
    
    // Наблюдаем за видимостью уведомлений, если поддерживается
    if (options.enableIntersectionObserver && isIntersectionObserverSupported) {
      setupIntersectionObserver(newContainer);
    }
    
    return newContainer;
  };

  /**
   * Настраивает IntersectionObserver для отслеживания видимости уведомлений
   * @param {HTMLElement} container - Контейнер уведомлений
   */
  const setupIntersectionObserver = (container) => {
    // Создаем IntersectionObserver для отслеживания уведомлений, выходящих из области видимости
    intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const notification = entry.target;
        
        // Если уведомление больше не видно, но не помечено как закрытое
        if (!entry.isIntersecting && !notification.classList.contains('hide')) {
          // Увеличиваем счетчик скрытых уведомлений
          hiddenNotificationsCount++;
          
          // Обновляем или создаем бейдж для количества скрытых уведомлений
          updateNotificationBadge();
        } else if (entry.isIntersecting && notification.dataset.wasHidden === 'true') {
          // Если уведомление снова видно
          notification.dataset.wasHidden = 'false';
          hiddenNotificationsCount = Math.max(0, hiddenNotificationsCount - 1);
          
          // Обновляем бейдж
          updateNotificationBadge();
        }
      });
    }, {
      root: null, // viewport
      threshold: 0.1 // считаем видимым, если видно хотя бы 10%
    });
  };

  /**
   * Обновляет или создает бейдж с количеством скрытых уведомлений
   */
  const updateNotificationBadge = () => {
    if (!options.showBadge || hiddenNotificationsCount <= 0) {
      // Удаляем бейдж, если он есть
      if (notificationBadge && notificationBadge.parentNode) {
        notificationBadge.parentNode.removeChild(notificationBadge);
        notificationBadge = null;
      }
      return;
    }
    
    // Создаем бейдж, если его еще нет
    if (!notificationBadge) {
      notificationBadge = createElement('div', {
        className: `toast-notification-badge ${options.position.split('-')[0]}-${options.position.split('-')[1]}`,
        onclick: () => restoreHiddenNotifications()
      }, hiddenNotificationsCount.toString());
      
      document.body.appendChild(notificationBadge);
    } else {
      // Обновляем текст и позицию
      notificationBadge.textContent = hiddenNotificationsCount.toString();
      notificationBadge.className = `toast-notification-badge ${options.position.split('-')[0]}-${options.position.split('-')[1]}`;
    }
  };

  /**
   * Восстанавливает видимость скрытых уведомлений
   */
  const restoreHiddenNotifications = () => {
    // Находим все скрытые уведомления
    const hiddenNotifications = Array.from(document.querySelectorAll('.notification[data-was-hidden="true"]'));
    
    // Восстанавливаем их видимость
    hiddenNotifications.forEach(notification => {
      notification.dataset.wasHidden = 'false';
      
      // Сбрасываем таймер, если есть
      const notificationId = notification.id;
      const timeoutId = pendingTimeouts.get(notificationId);
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        
        // Получаем оставшееся время из прогресс-бара
        const progressBar = notification.querySelector('.notification-progress');
        if (progressBar) {
          const computedStyle = window.getComputedStyle(progressBar);
          const width = parseFloat(computedStyle.width);
          const totalWidth = parseFloat(window.getComputedStyle(notification).width);
          const durationAttr = notification.getAttribute('data-duration');
          
          if (durationAttr && !isNaN(parseInt(durationAttr))) {
            const originalDuration = parseInt(durationAttr);
            const remainingTime = Math.max(500, (width / totalWidth) * originalDuration);
            
            // Устанавливаем новый таймер
            pendingTimeouts.set(notificationId, setTimeout(() => {
              closeNotification(notification);
            }, remainingTime));
            
            // Обновляем прогресс-бар
            if (options.animateProgressBar) {
              progressBar.style.animation = 'none';
              progressBar.offsetHeight; // Форсируем перерасчет стилей
              progressBar.style.animation = `progress ${remainingTime}ms linear forwards`;
            }
          }
        }
      }
    });
    
    // Сбрасываем счетчик и удаляем бейдж
    hiddenNotificationsCount = 0;
    updateNotificationBadge();
  };

  /**
   * Добавляет стили для разных позиций уведомлений
   */
  const addPositioningStyles = () => {
    // Стили добавляются сразу при создании контейнера
    // и обрабатываются в addThemeStyles
  };

  /**
   * Экранирует HTML для безопасного отображения
   * @param {string} html - Строка для экранирования
   * @returns {string} Экранированная строка
   */
  const escapeHTML = (html) => {
    if (!options.escapeHtml || !html || typeof html !== 'string') return html;
    
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  };

  /**
   * Генерирует уникальный идентификатор для уведомления
   * @returns {string} Уникальный ID
   */
  const generateUniqueId = () => {
    return `${options.uniqueIdPrefix}${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  /**
   * Создает хеш содержимого уведомления для определения дубликатов
   * @param {Object} notificationData - Данные уведомления
   * @returns {string} Хеш содержимого
   */
  const generateContentHash = ({ message, type, title }) => {
    return `${type}:${title}:${message}`;
  };

  /**
   * Показывает уведомление
   * @param {string} message - Текст уведомления
   * @param {string} type - Тип уведомления (success, error, warning, info)
   * @param {number} duration - Длительность отображения в миллисекундах
   * @param {string} title - Заголовок уведомления (необязательно)
   * @param {Object} options - Дополнительные опции для конкретного уведомления
   * @returns {Object} Объект управления уведомлением
   */
  const showNotification = (message, type = 'info', duration = options.defaultDuration, title = '', specificOptions = {}) => {
    if (!message) return null;
    
    // Объединяем глобальные и локальные опции
    const notificationOptions = { ...options, ...specificOptions };
    
    // Формируем данные уведомления
    const notificationData = { message, type, duration, title };
    
    // Проверка на дубликаты
    if (notificationOptions.preventDuplicates) {
      const contentHash = generateContentHash(notificationData);
      if (notificationMap.has(contentHash)) {
        // Обновляем существующее уведомление (например, сбрасываем таймер)
        const existingNotification = notificationMap.get(contentHash);
        if (existingNotification && existingNotification.element) {
          resetNotificationTimer(existingNotification.element, duration);
          return existingNotification;
        }
      }
    }
    
    // Добавляем заголовки для типов по умолчанию, если не указаны
    if (!title) {
      switch (type) {
        case 'success': title = 'Успешно'; break;
        case 'error': title = 'Ошибка'; break;
        case 'warning': title = 'Внимание'; break;
        case 'info': title = 'Информация'; break;
      }
    }
    
    // Проигрываем звук, если включено
    if (notificationOptions.enableSounds) {
      playSound(type);
    }
    
    // Вибрация для важных уведомлений на мобильных
    if (notificationOptions.enableVibration && 'vibrate' in navigator) {
      if (type === 'error' || type === 'warning') {
        navigator.vibrate(type === 'error' ? [200, 100, 200] : [100, 50, 100]);
      }
    }
    
    // Проверяем, можем ли показать еще одно уведомление
    if (visibleCount >= notificationOptions.maxVisible) {
      // Если нет, добавляем в очередь
      queue.push({ ...notificationData, options: notificationOptions });
      return null;
    }
    
    // Создаем элемент уведомления
    return createNotificationElement(notificationData, notificationOptions);
  };

  /**
   * Создает DOM-элемент уведомления и добавляет его на страницу
   * @param {Object} data - Данные уведомления
   * @param {Object} notificationOptions - Настройки уведомления
   * @returns {Object} Объект управления уведомлением
   */
  const createNotificationElement = ({ message, type, duration, title }, notificationOptions) => {
    // Инкрементируем счетчики
    visibleCount++;
    totalNotificationsCount++;
    
    // Создаем уникальный ID для уведомления
    const notificationId = generateUniqueId();
    
    // Определяем иконку в зависимости от типа и библиотеки
    const iconHtml = getIcon(type, notificationOptions.iconLibrary);
    
    // Используем factory-функцию для создания элементов
    const notification = createElement('div', {
      id: notificationId,
      className: `notification ${type}`,
      role: notificationOptions.a11yRole,
      'aria-live': 'assertive',
      'aria-atomic': 'true',
      'data-notification-type': type,
      'data-duration': duration,
      'data-notification-priority': type === 'error' ? 'high' : 'normal',
      style: { zIndex: zIndexCounter++ }
    });
    
    // Создаем иконку
    const iconElement = document.createElement('div');
    iconElement.className = 'notification-icon';
    iconElement.innerHTML = iconHtml;
    notification.appendChild(iconElement);
    
    // Создаем контейнер для содержимого
    const contentElement = createElement('div', { className: 'notification-content' });
    
    // Создаем заголовок и сообщение
    const titleElement = createElement('h4', { 
      className: 'notification-title',
      id: `${notificationId}-title`
    }, escapeHTML(title));
    
    const messageElement = createElement('p', { 
      className: 'notification-message',
      id: `${notificationId}-message`
    }, escapeHTML(message));
    
    contentElement.appendChild(titleElement);
    contentElement.appendChild(messageElement);
    notification.appendChild(contentElement);
    
    // Создаем кнопку закрытия
    const closeButton = createElement('button', {
      className: 'notification-close',
      'aria-label': notificationOptions.a11yCloseLabel,
      title: notificationOptions.a11yCloseLabel,
      tabIndex: 0,
      onclick: (e) => {
        e.stopPropagation();
        closeNotification(notification);
      },
      onkeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          closeNotification(notification);
        }
      }
    });
    notification.appendChild(closeButton);
    
    // Добавляем прогресс-бар, если включен
    if (notificationOptions.showProgressBar && duration !== Infinity) {
      const progressBar = createElement('div', { className: 'notification-progress' });
      notification.appendChild(progressBar);
    }
    
    // Если включены эффекты, добавляем элементы для них
    if (notificationOptions.enableEffects) {
      enhanceNotification(notification, type);
    }
    
    // Решаем, куда добавить новое уведомление в контейнере
    if (notificationOptions.newestOnTop) {
      // Добавляем в начало, если новые должны быть сверху
      container.prepend(notification);
    } else {
      // Добавляем в конец
      container.appendChild(notification);
    }
    
    // Создаем объект интерфейса для управления уведомлением
    const notificationControl = {
      element: notification,
      id: notificationId,
      type,
      close: () => closeNotification(notification),
      resetTimer: () => resetNotificationTimer(notification, duration),
      update: (newMessage, newType = type, newTitle = title) => {
        updateNotificationContent(notification, newMessage, newType, newTitle);
      }
    };
    
    // Если включена опция предотвращения дубликатов, сохраняем ссылку на уведомление
    if (notificationOptions.preventDuplicates) {
      const contentHash = generateContentHash({ message, type, title });
      notificationMap.set(contentHash, notificationControl);
    }
    
    // Наблюдаем за элементом с помощью IntersectionObserver
    if (intersectionObserver && options.enableIntersectionObserver) {
      intersectionObserver.observe(notification);
    }
    
    // Анимируем появление (после небольшой задержки для правильного рендеринга DOM)
    requestAnimationFrame(() => {
      // Небольшая задержка для корректной работы CSS-анимации
      setTimeout(() => {
        notification.classList.add('show');
        
        // Анимируем прогресс-бар
        if (duration !== Infinity && notificationOptions.showProgressBar && notificationOptions.animateProgressBar) {
          const progressBar = notification.querySelector('.notification-progress');
          if (progressBar) {
            progressBar.style.animation = `progress ${duration}ms linear forwards`;
          }
        }
      }, 10);
    });
    
    // Закрытие по клику на всё уведомление, если включена опция
    if (notificationOptions.clickToClose) {
      notification.addEventListener('click', (e) => {
        // Игнорируем клик по кнопке закрытия (уже обрабатывается отдельно)
        if (!e.target.closest('.notification-close')) {
          closeNotification(notification);
        }
      });
    }
    
    // Настраиваем перетаскивание, если включена опция
    if (notificationOptions.dragToClose) {
      setupDragToClose(notification);
    }
    
    // Автоматическое закрытие (если duration не равен Infinity)
    if (duration !== Infinity) {
      const timeoutId = setTimeout(() => {
        closeNotification(notification);
      }, duration);
      
      // Сохраняем timeoutId для возможного сброса
      pendingTimeouts.set(notificationId, timeoutId);
      
      // Остановка таймера при наведении (если включена опция)
      if (notificationOptions.pauseOnHover) {
        setupPauseOnHover(notification, duration);
      }
    }
    
    // Возвращаем объект для управления уведомлением
    return notificationControl;
  };

  /**
   * Получает HTML иконки для указанного типа
   * @param {string} type - Тип уведомления
   * @param {string} library - Библиотека иконок ('svg' или 'fontawesome')
   * @returns {string} HTML код иконки
   */
  const getIcon = (type, library = 'svg') => {
    if (library === 'fontawesome') {
      // Font Awesome иконки
      const iconClasses = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
      };
      return `<i class="notification-icon fas ${iconClasses[type] || 'fa-info-circle'}"></i>`;
    } else {
      // SVG иконки по умолчанию - улучшенные для лучшей масштабируемости
      const icons = {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
      };
      return icons[type] || icons.info;
    }
  };

  /**
   * Настраивает паузу при наведении курсора
   * @param {HTMLElement} notification - Элемент уведомления
   * @param {number} duration - Длительность отображения
   */
  const setupPauseOnHover = (notification, duration) => {
    let remainingTime = duration;
    let startTime;
    
    const notificationId = notification.id;
    const progressBar = notification.querySelector('.notification-progress');
    
    const handleMouseEnter = () => {
      const timeoutId = pendingTimeouts.get(notificationId);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Останавливаем анимацию и сохраняем текущее состояние
      if (progressBar && options.animateProgressBar) {
        progressBar.style.animationPlayState = 'paused';
      }
      
      // Запоминаем время начала паузы
      startTime = Date.now();
      
      // Добавляем класс для визуальной обратной связи
      notification.classList.add('paused');
    };
    
    const handleMouseLeave = () => {
      if (startTime) {
        // Вычисляем прошедшее время с момента наведения
        const elapsedPauseTime = Date.now() - startTime;
        
        // Если есть прогресс-бар, обрабатываем его
        if (progressBar && options.animateProgressBar) {
          // Получаем текущую ширину прогресс-бара для расчета оставшегося времени
          const computedStyle = window.getComputedStyle(progressBar);
          const width = parseFloat(computedStyle.width);
          const totalWidth = parseFloat(window.getComputedStyle(notification).width);
          
          // Рассчитываем оставшееся время на основе текущей ширины прогресс-бара
          remainingTime = Math.max(500, (width / totalWidth) * remainingTime);
          
          // Сбрасываем и запускаем новую анимацию с оставшимся временем
          progressBar.style.animation = 'none';
          progressBar.offsetHeight; // Форсируем перерасчет стилей
          progressBar.style.animation = `progress ${remainingTime}ms linear forwards`;
          progressBar.style.animationPlayState = 'running';
        }
        
        // Устанавливаем новый таймер с оставшимся временем
        pendingTimeouts.set(notificationId, setTimeout(() => {
          closeNotification(notification);
        }, remainingTime));
        
        startTime = null;
        
        // Убираем класс паузы
        notification.classList.remove('paused');
      }
    };
    
    // Используем делегирование событий для лучшей производительности
    notification.addEventListener('mouseenter', handleMouseEnter);
    notification.addEventListener('mouseleave', handleMouseLeave);
    
    // Для сенсорных устройств
    notification.addEventListener('touchstart', handleMouseEnter, { passive: true });
    notification.addEventListener('touchend', handleMouseLeave);
  };

    /**
   * Настраивает возможность перетаскивания уведомления для закрытия
   * @param {HTMLElement} notification - Элемент уведомления
   */
  const setupDragToClose = (notification) => {
    if (!options.enableGestureControl) return;
    
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let currentX = 0;
    let isDragging = false;
    const position = options.position.includes('right') ? 'right' : 'left';
    
    // Определяем, работаем ли мы с сенсорными событиями
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Событие начала касания/перетаскивания
    const handleStart = (e) => {
      // Предотвращаем одновременное перетаскивание нескольких уведомлений
      if (draggedNotification) return;
      
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      
      startX = clientX;
      startY = clientY;
      startTime = Date.now();
      isDragging = true;
      draggedNotification = notification;
      
      // Останавливаем анимацию прогресса
      const progressBar = notification.querySelector('.notification-progress');
      if (progressBar && options.animateProgressBar) {
        progressBar.style.animationPlayState = 'paused';
      }
      
      // Добавляем класс для стилей во время перетаскивания
      notification.classList.add('dragging');
      
      // Отключаем переходы для плавного перетаскивания
      notification.style.transition = 'none';
      
      // Предотвращаем скролл на мобильных при свайпе уведомления
      if (isTouchDevice) {
        document.body.style.overflow = 'hidden';
      }
      
      // Добавляем глобальные обработчики для перемещения и окончания
      if (isTouchDevice) {
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);
        document.addEventListener('touchcancel', handleEnd);
      } else {
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
      }
    };
    
    // Событие перемещения
    const handleMove = (e) => {
      if (!isDragging) return;
      
      // Предотвращаем прокрутку страницы на сенсорных устройствах
      if (e.cancelable) e.preventDefault();
      
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      
      // Вычисляем дельту по X и Y
      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      
      // Если перемещение больше по Y, чем по X, прекращаем обработку (скролл)
      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        return;
      }
      
      currentX = deltaX;
      
      // Определяем направление свайпа в зависимости от позиции уведомления
      const swipeDirection = position === 'right' ? -1 : 1;
      
      // Применяем трансформацию только если свайп в правильном направлении
      if ((swipeDirection === 1 && deltaX > 0) || (swipeDirection === -1 && deltaX < 0)) {
        // Используем requestAnimationFrame для плавной анимации
        requestAnimationFrame(() => {
          notification.style.transform = `translateX(${deltaX}px)`;
          
          // Изменяем прозрачность в зависимости от расстояния свайпа
          const opacity = Math.max(0.5, 1 - Math.abs(deltaX) / 300);
          notification.style.opacity = opacity.toString();
        });
      }
    };
    
    // Событие окончания касания/перетаскивания
    const handleEnd = () => {
      if (!isDragging) return;
      
      isDragging = false;
      draggedNotification = null;
      
      // Восстанавливаем скролл на мобильных
      if (isTouchDevice) {
        document.body.style.overflow = '';
      }
      
      // Восстанавливаем переходы для анимации
      notification.style.transition = '';
      notification.classList.remove('dragging');
      
      // Проверяем скорость свайпа и расстояние
      const swipeDuration = Date.now() - startTime;
      const swipeVelocity = Math.abs(currentX) / swipeDuration;
      const threshold = 0.2; // Порог скорости для свайпа
      const distanceThreshold = 100; // Порог расстояния для свайпа
      
      // Определяем направление свайпа в зависимости от позиции уведомления
      const swipeDirection = position === 'right' ? -1 : 1;
      const correctDirection = (swipeDirection === 1 && currentX > 0) || (swipeDirection === -1 && currentX < 0);
      
      if ((swipeVelocity > threshold && Math.abs(currentX) > 30 && correctDirection) || 
          (Math.abs(currentX) > distanceThreshold && correctDirection)) {
        // Свайп был достаточно быстрым или длинным - закрываем
        const direction = currentX > 0 ? '100%' : '-100%';
        
        // Используем Web Animation API для плавного исчезновения
        const animation = notification.animate([
          { transform: `translateX(${currentX}px)`, opacity: notification.style.opacity || '1' },
          { transform: `translateX(${direction})`, opacity: '0' }
        ], {
          duration: 300,
          easing: 'ease-out',
          fill: 'forwards'
        });
        
        animation.onfinish = () => {
          closeNotification(notification);
        };
      } else {
        // Недостаточно для закрытия - возвращаем на место с анимацией
        const animation = notification.animate([
          { transform: `translateX(${currentX}px)`, opacity: notification.style.opacity || '1' },
          { transform: 'translateX(0)', opacity: '1' }
        ], {
          duration: 300,
          easing: 'ease-out',
          fill: 'forwards'
        });
        
        animation.onfinish = () => {
          notification.style.transform = '';
          notification.style.opacity = '';
          
          // Восстанавливаем анимацию прогресса
          const progressBar = notification.querySelector('.notification-progress');
          if (progressBar && options.animateProgressBar) {
            progressBar.style.animationPlayState = 'running';
          }
        };
      }
      
      // Удаляем глобальные обработчики
      if (isTouchDevice) {
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
        document.removeEventListener('touchcancel', handleEnd);
      } else {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
      }
    };
    
    // Добавляем слушатели событий для начала перетаскивания
    if (isTouchDevice) {
      notification.addEventListener('touchstart', handleStart, { passive: true });
    } else {
      notification.addEventListener('mousedown', handleStart);
    }
  };

  /**
   * Улучшает уведомление дополнительными визуальными эффектами
   * @param {HTMLElement} notification - Элемент уведомления
   * @param {string} type - Тип уведомления
   */
  const enhanceNotification = (notification, type) => {
    // Проверяем настройки предпочтений анимации
    if (reducedMotionActive && options.enableReducedMotion) return;
    
    // Применяем улучшения в зависимости от типа уведомления
    switch (type) {
      case 'success':
        // Добавляем эффект частиц для успешных уведомлений
        const particles = createElement('div', { className: 'success-particles' });
        
        // Создаем несколько частиц
        for (let i = 0; i < 5; i++) {
          const particle = createElement('div', {
            className: 'success-particle',
            style: {
              '--x': `${Math.random() * 100 - 50}px`,
              '--y': `${Math.random() * 100 - 50}px`,
              '--delay': `${Math.random() * 0.5}s`
            }
          });
          particles.appendChild(particle);
        }
        
        notification.appendChild(particles);
        break;
        
      case 'error':
        // Добавляем эффект "дрожания" для ошибок
        notification.classList.add('shake-effect');
        break;
        
      case 'warning':
        // Добавляем пульсирующую границу для предупреждений
        notification.classList.add('pulse-border');
        break;
        
      case 'info':
        // Добавляем эффект подсветки для информационных уведомлений
        const highlight = createElement('div', { className: 'info-highlight' });
        notification.appendChild(highlight);
        break;
    }
    
    // Добавляем фоновое свечение для всех типов
    const bgGlow = createElement('div', { className: 'bg-glow' });
    notification.appendChild(bgGlow);
    
    // Добавляем эффект hover
    notification.addEventListener('mouseenter', () => {
      if (reducedMotionActive && options.enableReducedMotion) return;
      notification.style.transform = 'translateZ(5px) scale(1.02)';
    });
    
    notification.addEventListener('mouseleave', () => {
      notification.style.transform = '';
    });
  };

  /**
   * Обновляет содержимое уведомления
   * @param {HTMLElement} notification - Элемент уведомления
   * @param {string} newMessage - Новый текст
   * @param {string} newType - Новый тип
   * @param {string} newTitle - Новый заголовок
   */
  const updateNotificationContent = (notification, newMessage, newType, newTitle) => {
    if (!notification) return;
    
    // Проверяем тип
    const currentType = notification.getAttribute('data-notification-type');
    
    // Обновляем класс типа
    if (currentType !== newType) {
      notification.classList.remove(currentType);
      notification.classList.add(newType);
      notification.setAttribute('data-notification-type', newType);
      
      // Удаляем старые специфичные для типа элементы
      const oldParticles = notification.querySelector('.success-particles');
      if (oldParticles) notification.removeChild(oldParticles);
      
      const oldHighlight = notification.querySelector('.info-highlight');
      if (oldHighlight) notification.removeChild(oldHighlight);
      
      // Удаляем классы эффектов
      notification.classList.remove('shake-effect', 'pulse-border');
      
      // Обновляем иконку
      const iconElement = notification.querySelector('.notification-icon');
      if (iconElement) {
        iconElement.innerHTML = getIcon(newType, options.iconLibrary);
      }
      
      // Если включены эффекты, добавляем новые элементы для типа
      if (options.enableEffects) {
        enhanceNotification(notification, newType);
      }
      
      // Обновляем цвет прогресс-бара
      const progressBar = notification.querySelector('.notification-progress');
      if (progressBar) {
        // CSS-переменные управляют цветом в зависимости от типа
      }
    }
    
    // Обновляем заголовок
    const titleElement = notification.querySelector('.notification-title');
    if (titleElement) {
      titleElement.textContent = escapeHTML(newTitle);
    }
    
    // Обновляем сообщение
    const messageElement = notification.querySelector('.notification-message');
    if (messageElement) {
      messageElement.textContent = escapeHTML(newMessage);
    }
    
    // Добавляем анимацию обновления содержимого
    if (options.transitionOnUpdate) {
      notification.classList.add('content-updated');
      setTimeout(() => {
        notification.classList.remove('content-updated');
      }, 500);
    }
  };

  /**
   * Сбрасывает таймер для уведомления
   * @param {HTMLElement} notification - Элемент уведомления
   * @param {number} duration - Новая длительность
   */
  const resetNotificationTimer = (notification, duration = options.defaultDuration) => {
    if (!notification || duration === Infinity) return;
    
    const notificationId = notification.id;
    
    // Очищаем существующий таймер
    const existingTimeoutId = pendingTimeouts.get(notificationId);
    if (existingTimeoutId) {
      clearTimeout(existingTimeoutId);
    }
    
    // Сбрасываем и перезапускаем прогресс-бар
    if (options.animateProgressBar) {
      const progressBar = notification.querySelector('.notification-progress');
      if (progressBar) {
        progressBar.style.animation = 'none';
        progressBar.offsetHeight; // Форсируем перерасчет стилей
        progressBar.style.animation = `progress ${duration}ms linear forwards`;
      }
    }
    
    // Устанавливаем новый таймер
    pendingTimeouts.set(notificationId, setTimeout(() => {
      closeNotification(notification);
    }, duration));
    
    // Обновляем атрибут с длительностью
    notification.setAttribute('data-duration', duration.toString());
    
    // Добавляем эффект сброса
    notification.classList.add('reset-timer');
    setTimeout(() => {
      notification.classList.remove('reset-timer');
    }, 300);
  };

  /**
   * Закрывает уведомление
   * @param {HTMLElement} notification - Элемент уведомления
   * @returns {boolean} Результат операции
   */
  const closeNotification = (notification) => {
    if (!notification || notification.classList.contains('hide')) return false;
    
    const notificationId = notification.id;
    
    // Предотвращаем повторное закрытие
    notification.classList.add('hide');
    
    // Очищаем таймер
    const timeoutId = pendingTimeouts.get(notificationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      pendingTimeouts.delete(notificationId);
    }
    
    // Прекращаем наблюдение IntersectionObserver
    if (intersectionObserver && options.enableIntersectionObserver) {
      intersectionObserver.unobserve(notification);
    }
    
    // Удаляем из Map дубликатов, если там есть
    notificationMap.forEach((value, key) => {
      if (value.element === notification) {
        notificationMap.delete(key);
      }
    });
    
    // Удаляем после анимации
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
        
        // Уменьшаем счетчик видимых уведомлений
        visibleCount = Math.max(0, visibleCount - 1);
        
        // Если уведомление было отмечено как скрытое, уменьшаем счетчик
        if (notification.dataset.wasHidden === 'true') {
          hiddenNotificationsCount = Math.max(0, hiddenNotificationsCount - 1);
          updateNotificationBadge();
        }
        
        // Проверяем очередь
        processQueue();
      }
    }, options.autoHideAnimationDuration);
    
    return true;
  };

  /**
   * Обрабатывает очередь уведомлений
   */
  const processQueue = () => {
    // Если есть место для новых уведомлений и очередь не пуста
    while (visibleCount < options.maxVisible && queue.length > 0) {
      const { message, type, duration, title, options: specificOptions = {} } = queue.shift();
      showNotification(message, type, duration, title, specificOptions);
    }
  };

  /**
   * Перепозиционирует все текущие уведомления
   */
  const repositionAll = () => {
    // Обновляем класс контейнера
    if (container) {
      container.className = `notification-container ${options.position} theme-${options.theme}`;
    }
    
    // Обновляем положение бейджа, если он есть
    if (notificationBadge) {
      notificationBadge.className = `toast-notification-badge ${options.position.split('-')[0]}-${options.position.split('-')[1]}`;
    }
  };

  /**
   * Закрывает все текущие уведомления
   * @param {boolean} animated - Использовать ли анимацию закрытия
   */
  const closeAll = (animated = true) => {
    if (!container) return;
    
    const notifications = container.querySelectorAll('.notification');
    
    notifications.forEach(notification => {
      if (animated) {
        closeNotification(notification);
      } else {
        // Если нужно закрыть без анимации, удаляем мгновенно
        const notificationId = notification.id;
        const timeoutId = pendingTimeouts.get(notificationId);
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          pendingTimeouts.delete(notificationId);
        }
        
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }
    });
    
    // Если закрываем без анимации, сразу сбрасываем счетчики
    if (!animated) {
      visibleCount = 0;
      hiddenNotificationsCount = 0;
      notificationMap.clear();
      queue = [];
      
      // Удаляем бейдж, если он есть
      if (notificationBadge && notificationBadge.parentNode) {
        notificationBadge.parentNode.removeChild(notificationBadge);
        notificationBadge = null;
      }
    }
  };

  /**
   * Изменяет позицию отображения уведомлений
   * @param {string} position - Новая позиция ('top-right', 'top-left', etc.)
   */
  const setPosition = (position) => {
    options.position = position;
    repositionAll();
  };

  /**
   * Получает статистику уведомлений
   * @returns {Object} Статистика
   */
  const getStats = () => {
    return {
      visible: visibleCount,
      queued: queue.length,
      hidden: hiddenNotificationsCount,
      total: totalNotificationsCount,
      active: visibleCount + queue.length,
      pending: pendingTimeouts.size
    };
  };

  /**
   * Переключает активацию расширенных эффектов
   * @param {boolean} enabled - Включены ли эффекты
   */
  const toggleEffects = (enabled) => {
    options.enableEffects = enabled;
  };

  /**
   * Обновляет глобальные настройки
   * @param {Object} newOptions - Новые настройки
   */
  const updateOptions = (newOptions) => {
    options = { ...options, ...newOptions };
    
    // Применяем изменения, которые требуют немедленного обновления
    if ('position' in newOptions) {
      repositionAll();
    }
    
    if ('theme' in newOptions) {
      setTheme(options.theme);
    }
    
    if ('enableSounds' in newOptions && options.enableSounds) {
      initSounds();
    }
    
    if ('enableIntersectionObserver' in newOptions && options.enableIntersectionObserver && isIntersectionObserverSupported) {
      if (container) {
        setupIntersectionObserver(container);
      }
    }
  };

  /**
   * Обработчик изменения видимости страницы
   */
  const handleVisibilityChange = () => {
    if (!options.reactToVisibilityChange) return;
    
    if (document.hidden) {
      // Страница скрыта, запоминаем время
      inactiveTabTime = Date.now();
    } else {
      // Страница снова активна
      if (inactiveTabTime > 0) {
        const inactiveDuration = Date.now() - inactiveTabTime;
        
        // Если страница была неактивна более 5 секунд, обновляем таймеры
        if (inactiveDuration > 5000 && options.restoreOnFocus) {
          // Обновляем все активные таймеры
          const notifications = container ? container.querySelectorAll('.notification:not(.hide)') : [];
          
          notifications.forEach(notification => {
            const notificationId = notification.id;
            const durationAttr = notification.getAttribute('data-duration');
            
            if (durationAttr && !isNaN(parseInt(durationAttr))) {
              const originalDuration = parseInt(durationAttr);
              
              // Если это не бесконечное уведомление
              if (originalDuration !== Infinity) {
                const progressBar = notification.querySelector('.notification-progress');
                
                if (progressBar && options.animateProgressBar) {
                  // Получаем текущую ширину прогресс-бара
                  const computedStyle = window.getComputedStyle(progressBar);
                  const width = parseFloat(computedStyle.width);
                  const totalWidth = parseFloat(window.getComputedStyle(notification).width);
                  
                  // Рассчитываем оставшееся время
                  const remainingTime = Math.max(500, (width / totalWidth) * originalDuration);
                  
                  // Сбрасываем таймер
                  resetNotificationTimer(notification, remainingTime);
                }
              }
            }
          });
        }
        
        // Сбрасываем время неактивности
        inactiveTabTime = 0;
        
        // Запускаем обработку очереди, если есть ожидающие уведомления
        if (queue.length > 0) {
          processQueue();
        }
      }
    }
  };

  /**
   * Обработчик изменения фокуса страницы
   */
  const handleFocusChange = () => {
    const hasFocus = document.hasFocus();
    
    if (hasFocus !== documentHasFocus) {
      documentHasFocus = hasFocus;
      
      if (hasFocus && options.restoreOnFocus) {
        // При возврате фокуса обрабатываем очередь
        processQueue();
      }
    }
  };

  /**
   * Успешное уведомление
   * @param {string} message - Текст уведомления
   * @param {Object|number} options - Настройки или длительность
   * @param {string} title - Заголовок уведомления
   */
  const success = (message, userOptions = {}, title = 'Успешно') => {
    // Поддержка старого формата вызова (message, duration, title)
    if (typeof userOptions === 'number') {
      return showNotification(message, 'success', userOptions, title);
    }
    
    return showNotification(
      message, 
      'success', 
      userOptions.duration || options.defaultDuration, 
      userOptions.title || title,
      userOptions
    );
  };

  /**
   * Уведомление об ошибке
   * @param {string} message - Текст уведомления
   * @param {Object|number} options - Настройки или длительность
   * @param {string} title - Заголовок уведомления
   */
  const error = (message, userOptions = {}, title = 'Ошибка') => {
    // Поддержка старого формата вызова
    if (typeof userOptions === 'number') {
      return showNotification(message, 'error', userOptions, title);
    }
    
    return showNotification(
      message, 
      'error', 
      userOptions.duration || 7000, // Для ошибок увеличенное время по умолчанию
      userOptions.title || title,
      userOptions
    );
  };

  /**
   * Предупреждающее уведомление
   * @param {string} message - Текст уведомления
   * @param {Object|number} options - Настройки или длительность
   * @param {string} title - Заголовок уведомления
   */
  const warning = (message, userOptions = {}, title = 'Внимание') => {
    // Поддержка старого формата вызова
    if (typeof userOptions === 'number') {
      return showNotification(message, 'warning', userOptions, title);
    }
    
    return showNotification(
      message, 
      'warning', 
      userOptions.duration || 6000, // Среднее время для предупреждений
      userOptions.title || title,
      userOptions
    );
  };

  /**
   * Информационное уведомление
   * @param {string} message - Текст уведомления
   * @param {Object|number} options - Настройки или длительность
   * @param {string} title - Заголовок уведомления
   */
  const info = (message, userOptions = {}, title = 'Информация') => {
    // Поддержка старого формата вызова
    if (typeof userOptions === 'number') {
      return showNotification(message, 'info', userOptions, title);
    }
    
    return showNotification(
      message, 
      'info', 
      userOptions.duration || options.defaultDuration,
      userOptions.title || title,
      userOptions
    );
  };

  /**
   * Создает постоянное уведомление (без автозакрытия)
   * @param {string} message - Текст уведомления
   * @param {string} type - Тип уведомления
   * @param {string} title - Заголовок уведомления
   * @param {Object} userOptions - Дополнительные опции
   */
  const permanent = (message, type = 'info', title = '', userOptions = {}) => {
    return showNotification(
      message, 
      type, 
      Infinity, 
      title, 
      {...userOptions, showProgressBar: false}
    );
  };

  /**
   * Показывает системное уведомление
   * @param {string} message - Сообщение
   * @param {string} title - Заголовок
   * @param {Object} userOptions - Дополнительные опции
   * @returns {Promise} Промис, который разрешается после показа
   */
  const systemNotification = async (message, title, userOptions = {}) => {
    // Проверяем поддержку браузером API Notifications и разрешения
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        return createSystemNotification(title, message, userOptions);
      } else if (Notification.permission !== 'denied') {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            return createSystemNotification(title, message, userOptions);
          }
        } catch (error) {
          // Если не удалось запросить разрешение, показываем обычное уведомление
          return info(message, { title, ...userOptions });
        }
      }
    }
    
    // Если системные уведомления недоступны, используем обычные
    return info(message, { title, ...userOptions });
  };

  /**
   * Создает системное уведомление
   * @param {string} title - Заголовок
   * @param {string} message - Сообщение
   * @param {Object} userOptions - Опции
   * @returns {Notification} Объект системного уведомления
   */
  const createSystemNotification = (title, message, userOptions = {}) => {
    const { icon = '', tag = '', requireInteraction = false, onClick } = userOptions;
    
    const notification = new Notification(title, {
      body: message,
      icon,
      tag,
      requireInteraction,
      silent: !options.enableSounds
    });
    
    if (onClick && typeof onClick === 'function') {
      notification.onclick = onClick;
    }
    
    return notification;
  };

  /**
   * Обрабатывает ответ от сервера и показывает уведомление, если оно есть
   * @param {Object} response - Объект ответа от сервера
   */
  const processApiResponse = (response) => {
    if (!response) return null;
    
    // Поддержка разных форматов ответа
    const notification = response.notification || 
                        (response.data && response.data.notification) || 
                        null;
    
    if (!notification) return null;
    
    const { 
      message, 
      type = 'info', 
      duration = options.defaultDuration, 
      title = '', 
      options: specificOptions = {} 
    } = notification;
    
    if (message) {
      return showNotification(message, type, duration, title, specificOptions);
    }
    
    return null;
  };

  /**
   * Показывает модальное диалоговое окно
   * @param {Object} modalOptions - Настройки модального окна
   * @returns {Promise} Промис, который разрешается при закрытии диалога
   */
  const modal = (modalOptions = {}) => {
    const {
      title = 'Уведомление',
      message = '',
      type = 'info',
      confirmText = 'OK',
      cancelText = 'Отмена',
      showCancel = false,
      closeOnOverlayClick = true,
      onConfirm = () => {},
      onCancel = () => {},
      onClose = () => {}
    } = modalOptions;
    
    return new Promise((resolve) => {
      const modalId = `toast-modal-${Date.now()}`;
      
      // Создаем модальный оверлей
      const modalOverlay = createElement('div', {
        className: 'toast-modal-overlay',
        id: `${modalId}-overlay`
      });
      
      // Создаем модальное окно
      const modal = createElement('div', {
        className: `toast-modal ${type}`,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': `${modalId}-title`
      });
      
      // Создаем заголовок
      const modalHeader = createElement('div', { className: 'toast-modal-header' });
      const modalTitle = createElement('h3', { 
        id: `${modalId}-title`, 
        className: 'toast-modal-title' 
      }, title);
      const closeButton = createElement('button', { 
        className: 'toast-modal-close', 
        'aria-label': 'Закрыть'
      }, '×');
      
      modalHeader.appendChild(modalTitle);
      modalHeader.appendChild(closeButton);
      
      // Создаем тело
      const modalBody = createElement('div', { className: 'toast-modal-body' });
      const modalMessage = createElement('p', { className: 'toast-modal-message' }, message);
      modalBody.appendChild(modalMessage);
      
      // Создаем подвал
      const modalFooter = createElement('div', { className: 'toast-modal-footer' });
      
      // Добавляем кнопки
      if (showCancel) {
        const cancelButton = createElement('button', { 
          className: 'toast-modal-button toast-modal-cancel',
          tabIndex: 0
        }, cancelText);
        modalFooter.appendChild(cancelButton);
      }
      
      const confirmButton = createElement('button', { 
        className: `toast-modal-button toast-modal-confirm ${type}`,
        tabIndex: 0
      }, confirmText);
      
      modalFooter.appendChild(confirmButton);
      
      // Собираем модальное окно
      modal.appendChild(modalHeader);
      modal.appendChild(modalBody);
      modal.appendChild(modalFooter);
      
      // Добавляем на страницу
      modalOverlay.appendChild(modal);
      document.body.appendChild(modalOverlay);
      
      // Анимируем появление
      setTimeout(() => {
        modalOverlay.classList.add('active');
        modal.classList.add('active');
        
        // Фокусируемся на кнопке подтверждения
        confirmButton.focus();
      }, 10);
      
      // Функция закрытия модального окна
      const closeModal = (action, result) => {
        modalOverlay.classList.remove('active');
        modal.classList.remove('active');
        
        setTimeout(() => {
          document.body.removeChild(modalOverlay);
          if (action === 'confirm') onConfirm(result);
          if (action === 'cancel') onCancel(result);
          onClose();
          resolve({ action, result });
        }, 300);
      };
      
      // Обработчики кликов
      closeButton.addEventListener('click', () => closeModal('close'));
      confirmButton.addEventListener('click', () => closeModal('confirm', true));
      
      if (showCancel) {
        const cancelButton = modalFooter.querySelector('.toast-modal-cancel');
        cancelButton.addEventListener('click', () => closeModal('cancel', false));
      }
      
      // Закрытие по клику на оверлей
      if (closeOnOverlayClick) {
        modalOverlay.addEventListener('click', (e) => {
          if (e.target === modalOverlay) {
            closeModal('overlay-click');
          }
        });
      }
      
      // Обработка клавиши Escape
      const handleKeydown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeModal('escape');
          document.removeEventListener('keydown', handleKeydown);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          closeModal('confirm', true);
          document.removeEventListener('keydown', handleKeydown);
        }
      };
      
      document.addEventListener('keydown', handleKeydown);
    });
  };

  /**
   * Функция для показа уведомления с произвольными опциями
   * @param {Object} notifyOptions - Опции уведомления
   * @returns {Object} Объект управления уведомлением
   */
  const notify = (notifyOptions) => {
    const { 
      title, 
      message, 
      type = 'info', 
      duration = options.defaultDuration, 
      onClick,
      ...restOptions 
    } = notifyOptions;
    
    const notification = showNotification(message, type, duration, title, restOptions);
    
    if (onClick && notification && notification.element) {
      notification.element.style.cursor = 'pointer';
      notification.element.addEventListener('click', (e) => {
        if (!e.target.closest('.notification-close')) {
          onClick(e);
        }
      });
    }
    
    return notification;
  };

  /**
   * Показывает push-уведомление (системное уведомление)
   * @param {string} title - Заголовок
   * @param {Object} pushOptions - Опции уведомления
   * @returns {Promise} Промис, который разрешается после показа
   */
  const pushNotification = async (title, pushOptions = {}) => {
    const { 
      body = '', 
      icon = '', 
      tag = '', 
      requireInteraction = false,
      onClick
    } = pushOptions;
    
    return systemNotification(body, title, { 
      icon, 
      tag, 
      requireInteraction,
      onClick
    });
  };

  /**
   * Функция форматирования даты
   * @param {Date|string|number} date - Дата
   * @returns {string} Отформатированная дата
   */
  const formatDate = (date) => {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const pad = (num) => String(num).padStart(2, '0');
    
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  /**
   * Функция относительного форматирования времени
   * @param {Date|string|number} date - Дата
   * @returns {string} Относительное время
   */
  const timeAgo = (date) => {
    const now = new Date();
    const then = new Date(date);
    
    if (isNaN(then.getTime())) {
      return 'Invalid Date';
    }
    
    const diff = now - then;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(months / 12);
    
    if (seconds < 60) return 'только что';
    if (minutes === 1) return 'минуту назад';
    if (minutes < 5) return `${minutes} минуты назад`;
    if (minutes < 60) return `${minutes} минут назад`;
    if (hours === 1) return 'час назад';
    if (hours < 5) return `${hours} часа назад`;
    if (hours < 24) return `${hours} часов назад`;
    if (days === 1) return 'вчера';
    if (days < 7) return `${days} дней назад`;
    if (days < 30) return `${Math.floor(days / 7)} недель назад`;
    if (months === 1) return 'месяц назад';
    if (months < 12) return `${months} месяцев назад`;
    if (years === 1) return 'год назад';
    return `${years} лет назад`;
  };

  /**
   * Функция для запуска демонстрационных уведомлений
   */
  const demoNotifications = () => {
    info('Это информационное сообщение с обновленным дизайном и функциональностью', {
      duration: 5000,
      title: 'Новые уведомления 4.0'
    });
    
    setTimeout(() => {
      success('Операция успешно выполнена! Теперь уведомления поддерживают гораздо больше опций и эффектов.', {
        duration: 6000
      });
    }, 1000);
    
    setTimeout(() => {
      const warningNotification = warning('Внимание! Это предупреждение с возможностью обновления содержимого', {
        title: 'Гибкие уведомления',
        duration: 8000
      });
      
      // Демонстрация обновления уведомления
      setTimeout(() => {
        if (warningNotification) {
          warningNotification.update('Содержимое этого уведомления было обновлено!', 'warning', 'Динамическое обновление');
        }
      }, 3000);
    }, 2000);
    
    setTimeout(() => {
      error('Произошла ошибка при выполнении операции. Уведомление содержит расширенные визуальные эффекты.', {
        duration: 7000,
        title: 'Демо ошибки'
      });
    }, 3000);
    
    setTimeout(() => {
      permanent('Это постоянное уведомление, которое не закроется автоматически. Закрыть его можно вручную кнопкой или перетаскиванием.', 'info', 'Постоянное уведомление');
    }, 4000);
    
    // Демонстрация модального диалога
    setTimeout(() => {
      modal({
        title: 'Демонстрация модального диалога',
        message: 'Это модальный диалог с настраиваемыми кнопками и функциями обратного вызова.',
        type: 'info',
        confirmText: 'Принять',
        cancelText: 'Отклонить',
        showCancel: true,
        onConfirm: () => {
          success('Вы подтвердили действие!');
        },
        onCancel: () => {
          info('Вы отклонили действие');
        }
      });
    }, 5000);
  };

  // Инициализация системы уведомлений
  const init = () => {
    // Создаем контейнер для уведомлений
    container = createContainer();
    
    // Инициализируем звуки, если включены
    if (options.enableSounds) {
      initSounds();
    }
    
    // Настройка обработчиков событий жизненного цикла страницы
    if (options.reactToVisibilityChange) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocusChange);
      window.addEventListener('blur', handleFocusChange);
    }
    
    // Инициализация перехватчиков API
    setupApiInterceptors();
    
    // Отслеживание предпочтений пользователя
    setupMediaQueryListeners();
    
    // Добавляем стили для модальных окон
    addModalStyles();
    
    // Добавляем обработчики для клавиатурных сокращений
    if (options.enableKeyboardShortcuts) {
      setupKeyboardShortcuts();
    }
    
    // Логируем инициализацию, если включено
    if (options.logEvents) {
      console.log(`Toast notification system v${VERSION} initialized`);
      console.log(`Last update: ${LAST_UPDATE} by ${CURRENT_USER}`);
    }
    
    return true;
  };

  /**
   * Настройка слушателей медиа-запросов
   */
  const setupMediaQueryListeners = () => {
    // Отслеживаем предпочтения цветовой схемы
    if (options.theme === 'auto') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const theme = e.matches ? 'dark' : 'light';
        setTheme('auto'); // Обновляем тему
      });
    }
    
    // Отслеживаем предпочтения по анимации
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      reducedMotionActive = e.matches;
    });
  };

  /**
   * Добавляет стили для модальных окон
   */
  const addModalStyles = () => {
    // Стили уже добавлены в основную таблицу стилей
  };

  /**
   * Настройка клавиатурных сокращений
   */
  const setupKeyboardShortcuts = () => {
    document.addEventListener('keydown', (e) => {
      // Если нажата клавиша Escape, закрываем все уведомления
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        // Проверяем, нет ли активных модальных окон
        const activeModal = document.querySelector('.toast-modal-overlay.active');
        if (!activeModal) {
          closeAll();
        }
      }
    });
  };

  /**
   * Настройка перехватчиков API для автоматической обработки уведомлений
   */
  const setupApiInterceptors = () => {
    // Перехват для fetch API
    const originalFetch = window.fetch;
    
    window.fetch = function(...args) {
      return originalFetch.apply(this, args)
        .then(async response => {
          try {
            // Клонируем ответ, чтобы не нарушить оригинальный поток
            const clonedResponse = response.clone();
            
            // Проверяем заголовки, чтобы не пытаться обработать не-JSON ответы
            const contentType = clonedResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await clonedResponse.json();
              
              // Обрабатываем уведомление
              processApiResponse(data);
            }
          } catch (e) {
            // Игнорируем ошибки при обработке ответа
            if (options.logEvents) {
              console.debug('Toast: Error processing fetch response', e);
            }
          }
          
          return response;
        })
        .catch(error => {
          // Показываем уведомление о сетевой ошибке, если включены автоматические уведомления
          error('Ошибка сети при выполнении запроса', {
            title: 'Ошибка соединения',
            duration: 7000
          });
          throw error; // Пробрасываем ошибку дальше
        });
    };
    
    // Перехват для XMLHttpRequest
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(...args) {
      this._url = args[1];
      return originalXhrOpen.apply(this, args);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      const xhr = this;
      const originalOnReadyStateChange = xhr.onreadystatechange;
      
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              // Проверяем заголовок Content-Type
              const contentType = xhr.getResponseHeader('Content-Type');
              if (contentType && contentType.includes('application/json')) {
                const response = JSON.parse(xhr.responseText);
                processApiResponse(response);
              }
            } catch (e) {
              if (options.logEvents) {
                console.debug('Toast: Error processing XHR response', e);
              }
            }
          } else if (xhr.status >= 400) {
            // Обрабатываем ошибки HTTP
            let errorMessage = `Ошибка запроса: ${xhr.status}`;
            if (xhr.statusText) {
              errorMessage += ` - ${xhr.statusText}`;
            }
            error(errorMessage, { title: 'Ошибка HTTP' });
          }
        }
        
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.apply(this, arguments);
        }
      };
      
      return originalXhrSend.apply(this, args);
    };
    
    // Обработчики онлайн/офлайн статуса
    window.addEventListener('offline', () => {
      warning('Соединение с интернетом потеряно. Проверьте подключение к сети.', {
        duration: 0, // Бесконечное отображение
        title: 'Нет соединения'
      });
    });
    
    window.addEventListener('online', () => {
      success('Соединение с интернетом восстановлено!', {
        duration: 3000,
        title: 'Подключение восстановлено'
      });
    });
  };

  // Запускаем инициализацию
  init();

  // Возвращаем публичный API
  return {
    // Основные методы
    success,
    error,
    warning,
    info,
    permanent,
    modal,
    notify,
    
    // Методы управления
    closeAll,
    closeNotification,
    setPosition,
    setTheme,
    updateOptions,
    getStats,
    toggleEffects,
    
    // Вспомогательные методы
    formatDate,
    timeAgo,
    pushNotification,
    systemNotification,
    processApiResponse,
    
    // Демонстрация
    demoNotifications,
    
    // Метаданные
    VERSION,
    LAST_UPDATE,
    CURRENT_USER
  };
})();

// Экспортируем в глобальную область видимости
window.toast = toast;