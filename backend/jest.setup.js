// jest.setup.js
process.env.JWT_SECRET = '0264e62945a769dc0204fea2452b5d31d7986b4d8e656c1b116eb8eb8cd44906';
process.env.NODE_ENV = 'test';
// Установите другие переменные окружения, если они необходимы для тестов
// process.env.DB_HOST = 'test_db_host';
// ... и т.д. (хотя мы будем мокировать DB)