'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('template_days', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'marathon_templates',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      day_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      text_content: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      is_measurement_day: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_training_day: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_rest_day: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_healthy_eating_day: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      audio_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      video_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('template_days', ['template_id', 'day_number'], {
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('template_days');
  },
};
