const request = require('supertest');
const { app, close } = require('../Api.js');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

jest.mock('../db');
jest.mock('jsonwebtoken');

describe('API Tests', () => {
  let server;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterAll(async () => {
    await close(); 
    jest.restoreAllMocks();
  });

  describe('GET /api/protected', () => {
    test('should return 403 without valid token', async () => {
      const res = await request(app)
        .get('/api/protected');
      
      expect(res.statusCode).toBe(403);
    });

    test('should return 200 with valid token', async () => {
      // Мокаем данные пользователя
      query.mockResolvedValueOnce({ rows: [{ 
        id: 1, 
        name: 'testuser', 
        role: 'user',
        current_token: 'valid-token' 
      }] });
      
      // Мокаем проверку JWT
      jwt.verify.mockReturnValueOnce({ userId: 1 });

      const res = await request(app)
        .get('/api/protected')
        .set('Cookie', ['jwt=valid-token']);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/login', () => {
    test('should return 401 for invalid credentials', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/login')
        .send({ name: 'wrong', password: 'wrong' });
      
      expect(res.statusCode).toBe(401);
    });

    test('should return cookies on successful login', async () => {
      const mockUser = {
        id: 1,
        name: 'testuser',
        role: 'user',
        password: 'hashedpass'
      };

      query.mockResolvedValueOnce({ rows: [mockUser] });
      require('bcrypt').compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValueOnce('test-token');

      const res = await request(app)
        .post('/api/login')
        .send({ name: 'testuser', password: 'testpass' });

      expect(res.statusCode).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });
});