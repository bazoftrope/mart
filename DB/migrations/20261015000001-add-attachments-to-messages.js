'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Фото в чате: JSONB-массив вложений сообщения.
    // Формат элемента: { url, fileName, mimeType, sizeBytes } —
    // совпадает с ответом POST /api/uploads/image.
    await queryInterface.addColumn('messages', 'attachments', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('messages', 'attachments');
  },
};
