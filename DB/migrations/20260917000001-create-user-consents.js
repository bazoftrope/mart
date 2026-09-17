'use strict';

/**
 * Согласия пользователей на обработку персональных данных (152-ФЗ).
 *
 * Отдельный файл — по соглашению о миграциях: новые изменения схемы
 * оформляем новыми файлами. Таблица хранит доказательство согласия:
 * вид, версию текста, дату, IP и User-Agent. Отзыв не удаляет строку,
 * а проставляет revoked_at.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_consents', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
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
      type: {
        type: Sequelize.ENUM('general', 'health'),
        allowNull: false,
      },
      document_version: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      granted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ip: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.STRING(512),
        allowNull: true,
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

    // Один актуальный документ на каждый вид согласия у пользователя.
    await queryInterface.addIndex('user_consents', ['user_id', 'type'], {
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_consents');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_user_consents_type";'
    );
  },
};
