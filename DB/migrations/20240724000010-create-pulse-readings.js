'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pulse_readings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      report_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'daily_reports',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      measured_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      pulse: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      systolic: {
        type: Sequelize.SMALLINT,
        allowNull: true,
        defaultValue: null,
      },
      diastolic: {
        type: Sequelize.SMALLINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    await queryInterface.addIndex('pulse_readings', ['report_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pulse_readings');
  },
};
