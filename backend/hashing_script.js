const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

// Создаем подключение к базе данных
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Функция для хеширования пароля
const hashPassword = async (plainPassword) => {
  const saltRounds = 10; // Количество раундов хеширования
  return await bcrypt.hash(plainPassword, saltRounds);
};

// Основная функция для обновления паролей
const updatePasswords = async () => {
  try {
    // Получаем всех пользователей
    const { rows } = await pool.query('SELECT id, password FROM users');
    console.log(`Found ${rows.length} users to update.`);

    // Проходим по каждому пользователю
    for (const user of rows) {
      const { id, password } = user;

      // Хешируем пароль
      const hashedPassword = await hashPassword(password);

      // Обновляем запись в базе данных
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
      console.log(`Updated password for user ID: ${id}`);
    }

    console.log('All passwords have been updated successfully.');
  } catch (err) {
    console.error('Error updating passwords:', err.message);
  } finally {
    // Закрываем подключение к базе данных
    await pool.end();
  }
};

// Запускаем скрипт
updatePasswords();