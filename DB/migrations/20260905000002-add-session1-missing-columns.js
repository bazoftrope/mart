'use strict';

/**
 * Дополняет уже развёрнутые БД колонками, добавленными в «Сессии 1»
 * (флаги дней замеров, тренировки и давление).
 *
 * На свежей БД эти колонки уже создаются предыдущими миграциями из рабочей
 * ветки, поэтому миграция проверяет information_schema и ничего не делает,
 * если колонка существует.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    async function tableColumns(tableName) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = :tableName`,
        { replacements: { tableName } }
      );
      return new Set(rows.map((row) => row.column_name));
    }

    const templateDayColumns = await tableColumns('template_days');
    if (!templateDayColumns.has('is_measurement_day')) {
      await queryInterface.addColumn('template_days', 'is_measurement_day', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!templateDayColumns.has('is_training_day')) {
      await queryInterface.addColumn('template_days', 'is_training_day', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!templateDayColumns.has('is_rest_day')) {
      await queryInterface.addColumn('template_days', 'is_rest_day', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!templateDayColumns.has('is_healthy_eating_day')) {
      await queryInterface.addColumn('template_days', 'is_healthy_eating_day', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    const dailyReportColumns = await tableColumns('daily_reports');
    if (!dailyReportColumns.has('training_done')) {
      await queryInterface.addColumn('daily_reports', 'training_done', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: null,
      });
    }

    const pulseReadingColumns = await tableColumns('pulse_readings');
    if (!pulseReadingColumns.has('systolic')) {
      await queryInterface.addColumn('pulse_readings', 'systolic', {
        type: Sequelize.SMALLINT,
        allowNull: true,
        defaultValue: null,
      });
    }
    if (!pulseReadingColumns.has('diastolic')) {
      await queryInterface.addColumn('pulse_readings', 'diastolic', {
        type: Sequelize.SMALLINT,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down() {
    // На свежих БД колонки созданы более ранними миграциями; здесь не удаляем.
  },
};
