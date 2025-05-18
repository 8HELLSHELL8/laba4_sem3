const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = 5000;

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables. Please check your .env file.');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});


app.use(cors({
  origin: ['http://frontend:80', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query:', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('Error executing query:', err.message);
    throw err;
  }
}


const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  return await bcrypt.hash(plainPassword, saltRounds);
};

const comparePassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

const authenticateToken = async (req, res, next) => {
  const token = req.cookies?.jwt;

  if (!token) {
    console.log('authenticateToken: No token found in cookies.');
    return res.sendStatus(401); // Unauthorized
  }

  try {
    const decodedPayload = jwt.verify(token, process.env.JWT_SECRET);
    console.log('authenticateToken: JWT verification successful. Decoded payload:', decodedPayload);

    const { rows } = await query('SELECT * FROM users WHERE id = $1 AND current_token = $2', [decodedPayload.userId, token]);
    if (rows.length === 0) {
      console.log('authenticateToken: Token verified but not found in active server tokens for the correct user, or user ID mismatch.');
      return res.sendStatus(403); // Forbidden
    }

    console.log('authenticateToken: Token is active and valid for user:', decodedPayload.name);

    req.user = {
      id: decodedPayload.userId,
      name: decodedPayload.name,
      role: decodedPayload.role
    };

    next();
  } catch (err) {
    console.log('authenticateToken: JWT verification failed:', err.message);
    if (err.name === 'TokenExpiredError') {
      console.log('authenticateToken: Token expired.');
    }
    return res.sendStatus(403); // Forbidden
  }
};


const verifyCsrfToken = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const csrfTokenFromCookie = req.cookies?._csrfToken;
  const csrfTokenFromHeader = req.headers['x-csrf-token'];

  if (!csrfTokenFromCookie || !csrfTokenFromHeader) {
    console.warn('CSRF Verification: Missing CSRF token in cookie or header.');
    return res.status(403).json({ message: 'CSRF token missing or invalid.' });
  }

  if (csrfTokenFromCookie !== csrfTokenFromHeader) {
    console.warn('CSRF Verification: CSRF token mismatch.');
    return res.status(403).json({ message: 'CSRF token mismatch.' });
  }

  console.log('CSRF token verified successfully.');
  next();
};


app.post('/api/login', async (req, res) => {
  const { name, password } = req.body;
  try {
    const { rows } = await query('SELECT id, name, role, password FROM users WHERE name = $1', [name]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('User data from database during login:', user);
    
    const updateQuery = `
      UPDATE users 
      SET 
        current_token = $1,
        last_login = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    
    const tokenPayload = {
      userId: user.id,
      name: user.name,
      role: user.role,
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    await query(updateQuery, [token, user.id]);

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('_csrfToken', csrfToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:  60 * 60 * 1000,
    });
    
    console.log('Login successful, JWT and CSRF token cookies set.');
    res.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('login: Error during login:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/logout', authenticateToken, verifyCsrfToken, async (req, res) => {
  const token = req.cookies?.jwt;
  console.log('logout: Attempting logout.');

  try {
    if (token) {
      console.log(`logout: JWT found ${token.slice(0, 10)}... Attempting to remove from DB.`);
      await query('UPDATE users SET current_token = NULL WHERE current_token = $1', [token]);
    } else {
      console.log('logout: No JWT found in cookies during logout.');
    }

    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    res.clearCookie('_csrfToken', { 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    console.log('logout: JWT and CSRF cookies cleared.');

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('logout: Error during logout:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/protected', authenticateToken, (req, res) => {
  console.log('Decoded token payload:', req.user);
  res.json({
    message: 'This is protected data',
    user: req.user
  });
});

app.post('/api/items', authenticateToken, verifyCsrfToken, async (req, res) => {
  const { name, location, type, status } = req.body;

  if (!name || !location || !type || !status) {
    console.error('Invalid input data:', req.body);
    return res.status(400).json({ message: 'All fields are required: name, location, type, and status.' });
  }

  try {
    const typeResult = await pool.query('SELECT id FROM device_types WHERE name = $1', [type]);
    if (typeResult.rows.length === 0) {
      return res.status(400).json({ message: `Device type "${type}" not found.` });
    }
    const typeId = typeResult.rows[0].id;

    const locationResult = await pool.query('SELECT id FROM locations WHERE name = $1', [location]);
    if (locationResult.rows.length === 0) {
      return res.status(400).json({ message: `Location "${location}" not found.` });
    }
    const locationId = locationResult.rows[0].id;

    const statusResult = await pool.query('SELECT id FROM device_statuses WHERE name = $1', [status]);
    if (statusResult.rows.length === 0) {
      return res.status(400).json({ message: `Device status "${status}" not found.` });
    }
    const statusId = statusResult.rows[0].id;

    const insertResult = await pool.query(
      'INSERT INTO devices (name, type, location_id, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, typeId, locationId, statusId]
    );

    console.log('New device added:', insertResult.rows[0]);

    res.status(201).json({
      message: 'Device added successfully',
      device: insertResult.rows[0],
    });
  } catch (err) {
    console.error('Error adding device:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/items', authenticateToken, async (req, res) => { 
  try {
    const { rows } = await query(`
      SELECT d.id, d.name, dt.name AS type, l.name AS location, ds.name AS status
      FROM devices d
      JOIN device_types dt ON d.type = dt.id
      JOIN locations l ON d.location_id = l.id
      JOIN device_statuses ds ON d.status = ds.id
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching items:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/items/:id', authenticateToken, async (req, res) => { 
  const { id } = req.params;

  try {
    const { rows } = await pool.query(`
      SELECT d.id, d.name, dt.name AS type, l.name AS location, ds.name AS status
      FROM devices d
      JOIN device_types dt ON d.type = dt.id
      JOIN locations l ON d.location_id = l.id
      JOIN device_statuses ds ON d.status = ds.id
      WHERE d.id = $1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: `Device with ID ${id} not found.` });
    }

    console.log('Fetched device details:', rows[0]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching device details:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/items/:id', authenticateToken, verifyCsrfToken, async (req, res) => {
  const { id } = req.params;
  const { name, location } = req.body; 

  if (!name || !location) {
    console.error('Invalid input data for update:', req.body);
    return res.status(400).json({ message: 'Fields name and location are required for update.' });
  }

  try {
    const locationResult = await pool.query('SELECT id FROM locations WHERE name = $1', [location]);
    if (locationResult.rows.length === 0) {
      return res.status(400).json({ message: `Location "${location}" not found.` });
    }
    const locationId = locationResult.rows[0].id;

    const updateResult = await pool.query(
      'UPDATE devices SET name = $1, location_id = $2 WHERE id = $3 RETURNING *',
      [name, locationId, id]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ message: `Device with ID ${id} not found.` });
    }

    console.log('Updated device details:', updateResult.rows[0]);
    res.json({
      message: 'Device updated successfully',
      device: updateResult.rows[0], 
    });
  } catch (err) {
    console.error('Error updating device:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/items/:id', authenticateToken, verifyCsrfToken, async (req, res) => {
  const { id } = req.params;

  try {
    const deleteResult = await pool.query('DELETE FROM devices WHERE id = $1', [id]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: `Device with ID ${id} not found.` });
    }

    console.log(`Deleted device with ID ${id}`);
    res.json({ message: 'Device deleted successfully' });
  } catch (err) {
    console.error('Error deleting device:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.listen(port, () => {
  console.log(`HTTP Server is running on http://localhost:${port}`);
});
