import type { NextApiRequest, NextApiResponse } from 'next';
import { Op, type WhereOptions } from 'sequelize';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAdmin } from '@/lib/middleware';
import { Product } from '@db/models/Product';
import { createProductSchema } from '@/lib/validation';
import { serializeProduct } from '@/lib/productUtils';
import { Conflict } from '@/lib/errors';
import { sequelize } from '@db/db';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const search =
    typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Number.parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT
    )
  );

  const where: WhereOptions = search ? { name: { [Op.iLike]: `%${search}%` } } : {};

  const { rows, count } = await Product.findAndCountAll({
    where,
    order: [['name', 'ASC']],
    limit,
    offset: (page - 1) * limit,
  });

  return success(res, {
    items: rows.map(serializeProduct),
    total: count,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  });
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const body = createProductSchema.parse(req.body);
  const name = body.name.trim();

  const existing = await Product.findOne({
    where: sequelize.where(
      sequelize.fn('lower', sequelize.col('name')),
      name.toLowerCase()
    ),
  });
  if (existing) {
    throw new Conflict('Продукт с таким названием уже есть в каталоге');
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
  GET: withAdmin(getHandler),
  POST: withAdmin(postHandler),
});
