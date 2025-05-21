const request = require('supertest');
const { app, server } = require('../Api'); 
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const mockQuery = jest.fn();
jest.mock('pg', () => {
  const mPool = {
    query: (...args) => mockQuery(...args), 
    connect: jest.fn().mockResolvedValue({
      query: (...args) => mockQuery(...args),
      release: jest.fn(),
    }),
  };
  return { Pool: jest.fn(() => mPool) };
});

const generateTestToken = (userId, name, role) => {
  return jwt.sign({ userId, name, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

describe('API Endpoints', () => {
  let agent; 
  let testUser;
  let testToken;
  let csrfToken;

  beforeAll(() => {
    agent = request.agent(app); 
    testUser = {
      id: 1,
      name: 'testuser',
      role: 'user',
      password: 'hashedpassword', 
    };
    testToken = generateTestToken(testUser.id, testUser.name, testUser.role);
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve)); 
  });

  beforeEach(() => {
    mockQuery.mockReset(); 
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('Auth Endpoints', () => {
    it('POST /api/login - success', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [testUser], rowCount: 1 }) // SELECT user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });      // UPDATE users SET current_token

      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

      const res = await agent 
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
      const csrfCookie = res.headers['set-cookie'].find(cookie => cookie.startsWith('_csrfToken='));
      if (csrfCookie) {
        csrfToken = csrfCookie.split(';')[0].split('=')[1];
      }
      bcrypt.compare.mockRestore(); 
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
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false); 

      const res = await request(app)
        .post('/api/login')
        .send({ name: 'testuser', password: 'wrongpassword' });

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toBe('Invalid credentials');
      bcrypt.compare.mockRestore();
    })});

  describe('Protected Routes', () => {
    let authenticatedAgent;
    let userCsrfToken;

    beforeAll(async () => {
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

      mockQuery.mockResolvedValueOnce({ 
         rows: [{ ...testUser, current_token: currentTokenValue }],
         rowCount: 1
      });

      const res = await authenticatedAgent.get('/api/protected');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'This is protected data');
      expect(res.body.user).toHaveProperty('name', testUser.name);
    });

    it('GET /api/protected - fail without token', async () => {
      const res = await request(app).get('/api/protected'); 
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
      mockQuery.mockReset(); 
      mockQuery
        .mockResolvedValueOnce({ rows: [testUser], rowCount: 1 }) 
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });      
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
      expect(res.body.length).toBeGreaterThanOrEqual(0); 
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