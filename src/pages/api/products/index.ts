import type { NextApiRequest, NextApiResponse } from 'next';
import { Op, type WhereOptions } from 'sequelize';
import '@/lib/db';
import { sequelize } from '@db/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { Product } from '@db/models/Product';
import { serializeProduct } from '@/lib/productUtils';
import { createProductSchema } from '@/lib/validation';

const MAX_RESULTS = 20;
const MAX_SEARCH_LENGTH = 100;

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const search =
    typeof req.query.search === 'string'
      ? req.query.search.trim().slice(0, MAX_SEARCH_LENGTH)
      : '';

  if (!search) {
    const products = await Product.findAll({
      order: [['name', 'ASC']],
      limit: MAX_RESULTS,
    });
    return success(res, products.map(serializeProduct));
  }

  // Релевантность: сначала совпадения с начала названия, затем — вхождения
  // в середину. Иначе при большом каталоге популярное («Сыр» на запрос «сыр»)
  // могло не попасть в первые 20 строк, отсортированных по алфавиту.
  const startsWith: WhereOptions = { name: { [Op.iLike]: `${search}%` } };

  const prefixMatches = await Product.findAll({
    where: startsWith,
    order: [['name', 'ASC']],
    limit: MAX_RESULTS,
  });

  if (prefixMatches.length >= MAX_RESULTS) {
    return success(res, prefixMatches.map(serializeProduct));
  }

  const containsOnly: WhereOptions = {
    name: {
      [Op.iLike]: `%${search}%`,
      [Op.notILike]: `${search}%`,
    },
  };

  const restMatches = await Product.findAll({
    where: containsOnly,
    order: [['name', 'ASC']],
    limit: MAX_RESULTS - prefixMatches.length,
  });

  return success(
    res,
    [...prefixMatches, ...restMatches].map(serializeProduct)
  );
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
