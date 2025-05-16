// generate-hash.js
const bcrypt = require('bcrypt');
const saltRounds = 10;

async function generateHash(password) {
  if (!password) {
    console.error('Пожалуйста, укажите пароль в качестве аргумента командной строки.');
    console.log('Пример: node generate-hash.js mysecretpassword');
    return;
  }
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log(`Пароль: ${password}`);
    console.log(`Хеш: ${hash}`);
  } catch (err) {
    console.error('Ошибка при хешировании пароля:', err);
  }
}

const passwordToHash = process.argv[2]; // Получаем пароль из аргументов командной строки
generateHash(passwordToHash);