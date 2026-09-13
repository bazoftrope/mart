'use strict';

const bcrypt = require('bcrypt');

const PASSWORD = '12345678';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 10);

const ACCOUNTS = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    email: 'irina.mentor@test.ru',
    role: 'mentor',
    name: 'Ирина (ментор)',
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    email: 'irina@test.ru',
    role: 'participant',
    name: 'Ирина',
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    email: 'vova.mentor@test.ru',
    role: 'mentor',
    name: 'Вова (ментор)',
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    email: 'vova@test.ru',
    role: 'participant',
    name: 'Вова',
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Проверяем какие email уже есть — сидер идемпотентный
    const existingRows = await queryInterface.sequelize.query(
      `SELECT email FROM users WHERE email IN (:emails)`,
      {
        replacements: { emails: ACCOUNTS.map((a) => a.email) },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );
    const existingEmails = new Set(existingRows.map((r) => r.email.toLowerCase()));

    const toInsert = ACCOUNTS.filter((a) => !existingEmails.has(a.email.toLowerCase())).map((a) => ({
      id: a.id,
      email: a.email.toLowerCase(),
      password_hash: PASSWORD_HASH,
      role: a.role,
      name: a.name,
      timezone: 'Europe/Moscow',
      sex: null,
      height_cm: null,
      weight_kg: null,
      age: null,
      created_at: now,
      updated_at: now,
    }));

    if (toInsert.length === 0) {
      console.log('[seed] dev personal accounts already exist, skipping');
      return;
    }

    await queryInterface.bulkInsert('users', toInsert);
    console.log(`[seed] dev personal accounts created: ${toInsert.map((u) => `${u.email} (${u.role})`).join(', ')} | password: ${PASSWORD}`);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      'users',
      { email: { [Sequelize.Op.in]: ACCOUNTS.map((a) => a.email.toLowerCase()) } },
      {}
    );
  },
};
