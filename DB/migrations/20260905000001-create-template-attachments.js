'use strict';

const crypto = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('template_attachments', {
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
      template_day_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'template_days',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      scope: {
        type: Sequelize.ENUM('intro', 'day'),
        allowNull: false,
      },
      kind: {
        type: Sequelize.ENUM('audio', 'video', 'file'),
        allowNull: false,
      },
      url: {
        type: Sequelize.STRING(2048),
        allowNull: false,
      },
      file_name: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      mime_type: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      size_bytes: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      pair_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('template_attachments', ['template_id', 'scope', 'position']);
    await queryInterface.addIndex('template_attachments', ['template_day_id', 'pair_id'], {
      name: 'template_attachments_template_day_id_pair_id',
    });

    await queryInterface.addColumn('marathon_templates', 'intro_text', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Перенос существующих audio/video с template_days в template_attachments.
    const [dayRows] = await queryInterface.sequelize.query(
      `SELECT id, template_id, audio_url, video_id
       FROM template_days
       WHERE audio_url IS NOT NULL OR video_id IS NOT NULL`
    );

    const rows = [];
    for (const day of dayRows) {
      if (day.audio_url) {
        rows.push({
          id: crypto.randomUUID(),
          template_id: day.template_id,
          template_day_id: day.id,
          scope: 'day',
          kind: 'audio',
          url: day.audio_url,
          file_name: null,
          mime_type: null,
          size_bytes: null,
          position: 0,
          created_at: new Date(),
        });
      }
      if (day.video_id) {
        rows.push({
          id: crypto.randomUUID(),
          template_id: day.template_id,
          template_day_id: day.id,
          scope: 'day',
          kind: 'video',
          url: day.video_id,
          file_name: null,
          mime_type: null,
          size_bytes: null,
          position: day.audio_url ? 1 : 0,
          created_at: new Date(),
        });
      }
    }

    if (rows.length) {
      await queryInterface.bulkInsert('template_attachments', rows);
    }

    await queryInterface.removeColumn('template_days', 'audio_url');
    await queryInterface.removeColumn('template_days', 'video_id');

    // --- Книга рецептов ---
    // Добавлено позже правкой этой же миграции: пока в БД нет прод-данных
    // и пользователей, новые файлы миграций не создаём, чтобы не плодить файлы.
    await queryInterface.createTable('recipes', {
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
      ingredients: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      steps: {
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

    await queryInterface.addIndex('recipes', ['created_at']);
    await queryInterface.addIndex('recipes', ['title']);

    await queryInterface.createTable('recipe_favorites', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      recipe_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'recipes',
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

    await queryInterface.addIndex('recipe_favorites', ['recipe_id', 'user_id'], {
      unique: true,
    });
    await queryInterface.addIndex('recipe_favorites', ['user_id']);
  },

  async down(queryInterface, Sequelize) {
    // Книга рецептов (обратный порядок к up).
    await queryInterface.dropTable('recipe_favorites');
    await queryInterface.dropTable('recipes');

    await queryInterface.addColumn('template_days', 'audio_url', {
      type: Sequelize.STRING(2048),
      allowNull: true,
    });
    await queryInterface.addColumn('template_days', 'video_id', {
      type: Sequelize.STRING(256),
      allowNull: true,
    });

    const [audioRows] = await queryInterface.sequelize.query(
      `SELECT template_day_id, url
       FROM template_attachments
       WHERE kind = 'audio' AND scope = 'day'
       ORDER BY position ASC`
    );
    const audioByDay = new Map();
    for (const row of audioRows) {
      if (!audioByDay.has(row.template_day_id)) {
        audioByDay.set(row.template_day_id, row.url);
      }
    }

    const [videoRows] = await queryInterface.sequelize.query(
      `SELECT template_day_id, url
       FROM template_attachments
       WHERE kind = 'video' AND scope = 'day'
       ORDER BY position ASC`
    );
    const videoByDay = new Map();
    for (const row of videoRows) {
      if (!videoByDay.has(row.template_day_id)) {
        videoByDay.set(row.template_day_id, row.url);
      }
    }

    for (const [dayId, url] of audioByDay) {
      await queryInterface.sequelize.query(
        'UPDATE template_days SET audio_url = :url WHERE id = :id',
        { replacements: { url, id: dayId } }
      );
    }
    for (const [dayId, url] of videoByDay) {
      await queryInterface.sequelize.query(
        'UPDATE template_days SET video_id = :url WHERE id = :id',
        { replacements: { url, id: dayId } }
      );
    }

    await queryInterface.removeColumn('marathon_templates', 'intro_text');

    await queryInterface.dropTable('template_attachments');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_template_attachments_scope";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_template_attachments_kind";'
    );
  },
};
