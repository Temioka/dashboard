require('dotenv').config();

/**
 * КОНСТАНТЫ И НАСТРОЙКИ ПРИЛОЖЕНИЯ
 */
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_YEAR = new Date().getFullYear();
const SESSION_SECRET = process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');
const CACHE_TTL = 5 * 60 * 1000; // 5 минут для кеша

// Константы для кешей
const queryCache = new Map();

/**
 * Настройки сессий
 */
const sessionConfig = {
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'sessionId',
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax', // 'lax' работает лучше для авторизации и перенаправлений
    maxAge: 24 * 60 * 60 * 1000 // 24 часа
  }
};

module.exports = {
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_YEAR,
  SESSION_SECRET,
  CACHE_TTL,
  queryCache,
  sessionConfig
};