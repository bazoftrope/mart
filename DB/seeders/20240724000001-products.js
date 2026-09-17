'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('products', [
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Яйцо куриное', calories: 157, protein: 13, fat: 11, carbs: 1 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Курица грудка', calories: 165, protein: 31, fat: 3.6, carbs: 0 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Гречневая каша', calories: 132, protein: 5, fat: 1, carbs: 27 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Рис белый', calories: 130, protein: 2.7, fat: 0.3, carbs: 28 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Овсянка', calories: 68, protein: 2.4, fat: 1.4, carbs: 12 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Яблоко', calories: 52, protein: 0.3, fat: 0.2, carbs: 14 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Банан', calories: 89, protein: 1.1, fat: 0.3, carbs: 23 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Молоко 2,5%', calories: 54, protein: 3, fat: 2.5, carbs: 5 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Творог 5%', calories: 120, protein: 17, fat: 5, carbs: 3 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Огурец', calories: 15, protein: 0.8, fat: 0.1, carbs: 2.8 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Помидор', calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Масло подсолнечное', calories: 884, protein: 0, fat: 100, carbs: 0 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Хлеб белый', calories: 265, protein: 8, fat: 3, carbs: 50 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Говядина', calories: 187, protein: 26, fat: 10, carbs: 0 },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Картофель', calories: 77, protein: 2, fat: 0.4, carbs: 17 },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('products', null, {});
  },
};
