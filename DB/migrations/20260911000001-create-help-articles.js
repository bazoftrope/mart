'use strict';

/**
 * Раздел «Правила и помощь»: статьи с публичным чтением и
 * редактированием только из админки. Таблица отдельная — по
 * соглашению о миграциях (после книги тренировок схему меняем
 * только новыми файлами).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('help_articles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      section: {
        type: Sequelize.ENUM('rules', 'faq', 'guide'),
        allowNull: false,
        defaultValue: 'rules',
      },
      audience: {
        type: Sequelize.ENUM('all', 'participant', 'mentor', 'admin'),
        allowNull: false,
        defaultValue: 'all',
      },
      position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_published: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex('help_articles', ['slug'], { unique: true });
    await queryInterface.addIndex('help_articles', ['section', 'audience']);
    await queryInterface.addIndex('help_articles', ['is_published', 'position']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('help_articles');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_help_articles_section";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_help_articles_audience";'
    );
  },
};
