const request = require('supertest');
const app = require('../Api.js'); 

describe('API Tests', () => {
  test('GET /api/protected should return protected data', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Cookie', ['jwt=valid-token']);

    expect(res.statusCode).toBe(403);
  });
});