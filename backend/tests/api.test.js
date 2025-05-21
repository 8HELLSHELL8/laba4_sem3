const request = require('supertest');
const app = require('../app'); 

describe('API Tests', () => {
  test('GET /api/protected should return protected data', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Cookie', ['jwt=valid-token']);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('This is protected data');
  });
});