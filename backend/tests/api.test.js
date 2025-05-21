const request = require('supertest');
const { app, server } = require('../Api'); 
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Мокируем модуль 'pg'
const mockQuery = jest.fn();
jest.mock('pg', () => {
  const mPool = {
    query: (...args) => mockQuery(...args), 
    connect: jest.fn().mockResolvedValue({
      query: (...args) => mockQuery(...args),
      release: jest.fn(),
    }),
    // Добавьте другие методы, если ваше приложение их использует напрямую
  };
  return { Pool: jest.fn(() => mPool) };
});

// Хелпер для генерации JWT токена для тестов
const generateTestToken = (userId, name, role) => {
  return jwt.sign({ userId, name, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

describe('API Endpoints', () => {
  let agent; // Для сохранения cookie между запросами
  let testUser;
  let testToken;
  let csrfToken;

  beforeAll(() => {
    agent = request.agent(app); // Создаем agent для автоматической обработки cookie
    testUser = {
      id: 1,
      name: 'testuser',
      role: 'user',
      password: 'hashedpassword', // Предположим, что это хешированный пароль
    };
    // Токен, который будет в базе данных (current_token)
    testToken = generateTestToken(testUser.id, testUser.name, testUser.role);
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve)); // Закрываем сервер после всех тестов
    // Или просто server.close(); если close() не возвращает Promise или не принимает callback
    // await close(); // Если вы экспортировали функцию close, которая корректно закрывает сервер
  });

  beforeEach(() => {
    mockQuery.mockReset(); // Сбрасываем мок перед каждым тестом
    // Настройка мока по умолчанию (можно переопределить в каждом тесте)
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('Auth Endpoints', () => {
    it('POST /api/login - success', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [testUser], rowCount: 1 }) // SELECT user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });      // UPDATE users SET current_token

      // Мокируем bcrypt.compare для успешного сравнения паролей
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

      const res = await agent // Используем agent
        .post('/api/login')
        .send({ name: 'testuser', password: 'password123' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.user).toHaveProperty('name', 'testuser');
      expect(res.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/jwt=/),
          expect.stringMatching(/_csrfToken=/),
        ])
      );
      // Сохраняем CSRF токен из cookie для последующих запросов
      const csrfCookie = res.headers['set-cookie'].find(cookie => cookie.startsWith('_csrfToken='));
      if (csrfCookie) {
        csrfToken = csrfCookie.split(';')[0].split('=')[1];
      }
      bcrypt.compare.mockRestore(); // Восстанавливаем оригинальную функцию
    });

    it('POST /api/login - invalid credentials (user not found)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT user - no user found

      const res = await request(app)
        .post('/api/login')
        .send({ name: 'wronguser', password: 'password123' });

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('POST /api/login - invalid credentials (wrong password)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [testUser], rowCount: 1 }); // SELECT user

      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false); // Пароль не совпадает

      const res = await request(app)
        .post('/api/login')
        .send({ name: 'testuser', password: 'wrongpassword' });

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toBe('Invalid credentials');
      bcrypt.compare.mockRestore();
    });

    it('POST /api/logout - success', async () => {
      // Для logout сначала нужен логин (или вручную установленные cookie)
      // Предположим, пользователь уже залогинен из предыдущего теста с agent
      // или мы можем симулировать это:

      // 1. Симулируем, что токен валиден и есть в базе
      mockQuery
        .mockResolvedValueOnce({ // Для authenticateToken (SELECT user by id and current_token)
          rows: [{ ...testUser, current_token: agent.jar.getCookie('jwt', { path: '/' })?.value }],
          rowCount: 1
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // Для UPDATE users SET current_token = NULL

      const res = await agent // Используем agent с сохраненными cookie
        .post('/api/logout')
        .set('x-csrf-token', csrfToken); // Добавляем CSRF токен в заголовок

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toBe('Logged out successfully');
      expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^jwt=;.*Expires=Thu, 01 Jan 1970 00:00:00 GMT/),
        expect.stringMatching(/^_csrfToken=;.*Expires=Thu, 01 Jan 1970 00:00:00 GMT/),
      ])
      );
    });
  });

  describe('Protected Routes', () => {
    let authenticatedAgent;
    let userCsrfToken;

    beforeAll(async () => {
      // Логинимся один раз для получения валидных cookie для этой группы тестов
      authenticatedAgent = request.agent(app);
      mockQuery
        .mockResolvedValueOnce({ rows: [testUser], rowCount: 1 }) // SELECT user for login
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });      // UPDATE users SET current_token
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

      const loginRes = await authenticatedAgent
        .post('/api/login')
        .send({ name: 'testuser', password: 'password123' });

      const csrfCookie = loginRes.headers['set-cookie'].find(cookie => cookie.startsWith('_csrfToken='));
      if (csrfCookie) {
        userCsrfToken = csrfCookie.split(';')[0].split('=')[1];
      }
      bcrypt.compare.mockRestore();
    });


    it('GET /api/protected - success with valid token', async () => {
      const loggedInJwtCookie = authenticatedAgent.jar.getCookie('jwt', { path: '/' });
      const currentTokenValue = loggedInJwtCookie ? loggedInJwtCookie.value : null;

      mockQuery.mockResolvedValueOnce({ // Для authenticateToken (SELECT user by id and current_token)
         rows: [{ ...testUser, current_token: currentTokenValue }],
         rowCount: 1
      });

      const res = await authenticatedAgent.get('/api/protected');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'This is protected data');
      expect(res.body.user).toHaveProperty('name', testUser.name);
    });

    it('GET /api/protected - fail without token', async () => {
      const res = await request(app).get('/api/protected'); // Новый запрос без cookie
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('Items API (CRUD)', () => {
    let authenticatedAgentItems;
    let itemsCsrfToken;
    const testItem = { id: 1, name: 'Laptop', type: 'Electronics', location: 'Office A1', status: 'In Use' };
    const deviceType = { id: 1, name: 'Electronics' };
    const location = { id: 1, name: 'Office A1' };
    const deviceStatus = { id: 1, name: 'In Use' };

    beforeAll(async () => {
      authenticatedAgentItems = request.agent(app);
      mockQuery.mockReset(); // Сброс перед этой серией
      mockQuery
        .mockResolvedValueOnce({ rows: [testUser], rowCount: 1 }) // login - select user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });      // login - update token
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

      const loginRes = await authenticatedAgentItems
        .post('/api/login')
        .send({ name: 'testuser', password: 'password123' });

      const csrfCookie = loginRes.headers['set-cookie'].find(cookie => cookie.startsWith('_csrfToken='));
      if (csrfCookie) {
        itemsCsrfToken = csrfCookie.split(';')[0].split('=')[1];
      }
      bcrypt.compare.mockRestore();
    });

    it('POST /api/items - create new item successfully', async () => {
      const newItemData = { name: 'New Device', location: 'Office B2', type: 'Gadget', status: 'Available' };
      const loggedInJwtCookie = authenticatedAgentItems.jar.getCookie('jwt', { path: '/' });
      const currentTokenValue = loggedInJwtCookie ? loggedInJwtCookie.value : null;

      mockQuery
        .mockResolvedValueOnce({ // authenticateToken - DB check
           rows: [{ ...testUser, current_token: currentTokenValue }],
           rowCount: 1
        })
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Gadget' }], rowCount: 1 })       // SELECT device_types
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Office B2' }], rowCount: 1 })    // SELECT locations
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Available' }], rowCount: 1 })  // SELECT device_statuses
        .mockResolvedValueOnce({ rows: [{ id: 100, ...newItemData }], rowCount: 1 });   // INSERT into devices

      const res = await authenticatedAgentItems
        .post('/api/items')
        .set('x-csrf-token', itemsCsrfToken)
        .send(newItemData);

      expect(res.statusCode).toEqual(201);
      expect(res.body.message).toBe('Device added successfully');
      expect(res.body.device).toHaveProperty('name', newItemData.name);
    });

    it('GET /api/items - fetch all items', async () => {
      const loggedInJwtCookie = authenticatedAgentItems.jar.getCookie('jwt', { path: '/' });
      const currentTokenValue = loggedInJwtCookie ? loggedInJwtCookie.value : null;
      mockQuery
        .mockResolvedValueOnce({ // authenticateToken
           rows: [{ ...testUser, current_token: currentTokenValue }],
           rowCount: 1
        })
        .mockResolvedValueOnce({ // SELECT devices JOIN ...
          rows: [testItem],
          rowCount: 1
        });

      const res = await authenticatedAgentItems.get('/api/items');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(0); // Может быть 0, если ничего не добавлено
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('name', testItem.name);
      }
    });

    it('GET /api/items/:id - fetch single item by ID', async () => {
      const loggedInJwtCookie = authenticatedAgentItems.jar.getCookie('jwt', { path: '/' });
      const currentTokenValue = loggedInJwtCookie ? loggedInJwtCookie.value : null;
      mockQuery
        .mockResolvedValueOnce({ // authenticateToken
           rows: [{ ...testUser, current_token: currentTokenValue }],
           rowCount: 1
        })
        .mockResolvedValueOnce({ // SELECT device by ID
          rows: [testItem],
          rowCount: 1
        });

      const res = await authenticatedAgentItems.get(`/api/items/${testItem.id}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('name', testItem.name);
    });

    it('PUT /api/items/:id - update an item', async () => {
      const updatedData = { name: 'Updated Laptop', location: 'Office C3' };
      const loggedInJwtCookie = authenticatedAgentItems.jar.getCookie('jwt', { path: '/' });
      const currentTokenValue = loggedInJwtCookie ? loggedInJwtCookie.value : null;

      mockQuery
        .mockResolvedValueOnce({ // authenticateToken
           rows: [{ ...testUser, current_token: currentTokenValue }],
           rowCount: 1
        })
        .mockResolvedValueOnce({ rows: [{ id: 3, name: 'Office C3' }], rowCount: 1 }) // SELECT locations
        .mockResolvedValueOnce({ // UPDATE devices RETURNING *
          rows: [{ ...testItem, ...updatedData, location_id: 3 }],
          rowCount: 1
        });

      const res = await authenticatedAgentItems
        .put(`/api/items/${testItem.id}`)
        .set('x-csrf-token', itemsCsrfToken)
        .send(updatedData);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toBe('Device updated successfully');
      expect(res.body.device).toHaveProperty('name', updatedData.name);
    });

    it('DELETE /api/items/:id - delete an item', async () => {
      const loggedInJwtCookie = authenticatedAgentItems.jar.getCookie('jwt', { path: '/' });
      const currentTokenValue = loggedInJwtCookie ? loggedInJwtCookie.value : null;
      mockQuery
        .mockResolvedValueOnce({ // authenticateToken
           rows: [{ ...testUser, current_token: currentTokenValue }],
           rowCount: 1
        })
        .mockResolvedValueOnce({ rowCount: 1 }); // DELETE from devices

      const res = await authenticatedAgentItems
        .delete(`/api/items/${testItem.id}`)
        .set('x-csrf-token', itemsCsrfToken);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toBe('Device deleted successfully');
    });

    it('POST /api/items - fail create item if type not found', async () => {
      const newItemData = { name: 'New Device', location: 'Office B2', type: 'UnknownType', status: 'Available' };
      const loggedInJwtCookie = authenticatedAgentItems.jar.getCookie('jwt', { path: '/' });
      const currentTokenValue = loggedInJwtCookie ? loggedInJwtCookie.value : null;

      mockQuery
        .mockResolvedValueOnce({ // authenticateToken
           rows: [{ ...testUser, current_token: currentTokenValue }],
           rowCount: 1
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT device_types - type not found

      const res = await authenticatedAgentItems
        .post('/api/items')
        .set('x-csrf-token', itemsCsrfToken)
        .send(newItemData);

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe('Device type "UnknownType" not found.');
    });
  });
});