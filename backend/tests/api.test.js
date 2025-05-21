const request = require('supertest');
const { app, server } = require('../Api.js'); 

describe('API Tests', () => {
  afterAll(() => {
    server.close(); 
  });

  test('GET /api/protected should return 403 without valid token', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Cookie', ['jwt=invalid-token']);

    expect(res.statusCode).toBe(403);
  });
});