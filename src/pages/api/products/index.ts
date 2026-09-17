import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import '@/lib/db';
import { sequelize } from '@db/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { Product } from '@db/models/Product';
import { serializeProduct } from '@/lib/productUtils';
import { createProductSchema } from '@/lib/validation';

const MAX_RESULTS = 20;

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const where = search
    ? { name: { [Op.iLike]: `%${search}%` } }
    : {};

  const products = await Product.findAll({
    where,
    order: [['name', 'ASC']],
    limit: MAX_RESULTS,
  });

  return success(res, products.map(serializeProduct));
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const body = createProductSchema.parse(req.body);
  const name = body.name.trim();

  // Если продукт/блюдо уже есть в общем каталоге — возвращаем его,
  // чтобы не плодить дубликаты с разным регистром.
  const existing = await Product.findOne({
    where: sequelize.where(
      sequelize.fn('lower', sequelize.col('name')),
      name.toLowerCase()
    ),
  });

  if (existing) {
    return success(res, serializeProduct(existing));
  }

  const product = await Product.create({
    name,
    calories: body.calories,
    protein: body.protein,
    fat: body.fat,
    carbs: body.carbs,
  });

  return success(res, serializeProduct(product), 201);
}

export default apiHandler({
  GET: withAuth(getHandler),
  POST: withAuth(postHandler),
});
