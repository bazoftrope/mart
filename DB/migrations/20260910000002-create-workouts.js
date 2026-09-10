'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Книга тренировок — аналог книги рецептов. В отличие от рецептов
    // (их таблицы дописаны прямо в уже применённую миграцию
    // 20260905000001), здесь отдельный файл: на момент добавления
    // тренировок база уже содержала данные, и повторный прогон
    // старой миграции невозможен.
    await queryInterface.createTable('workouts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      exercises: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      execution: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('workouts', ['created_at']);
    await queryInterface.addIndex('workouts', ['title']);

    await queryInterface.createTable('workout_favorites', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      workout_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'workouts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('workout_favorites', ['workout_id', 'user_id'], {
      unique: true,
    });
    await queryInterface.addIndex('workout_favorites', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workout_favorites');
    await queryInterface.dropTable('workouts');
  },
};
