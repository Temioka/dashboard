const cors = require('cors');

// Настройка CORS
const corsOptions = {
  origin: function(origin, callback) {
    // Разрешаем запросы без origin и из всех источников в режиме разработки
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  exposedHeaders: ['Content-Type', 'Content-Length', 'X-Total-Trips', 'X-Avg-Trips', 'X-Generated-At']
};

module.exports = cors(corsOptions);