import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAdmin } from '@/lib/middleware';
import { Product } from '@db/models/Product';
import { ReportLine } from '@db/models';
import { createProductSchema } from '@/lib/validation';
import { serializeProduct } from '@/lib/productUtils';
import { Conflict, NotFound } from '@/lib/errors';
import { sequelize } from '@db/db';

function parseId(req: NextApiRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) {
    throw new NotFound('Product not found');
  }
  return id;
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = parseId(req);

  const product = await Product.findByPk(id);
  if (!product) {
    throw new NotFound('Product not found');
  }

  return success(res, serializeProduct(product));
}

async function putHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = parseId(req);

  const product = await Product.findByPk(id);
  if (!product) {
    throw new NotFound('Product not found');
  }

  const body = createProductSchema.parse(req.body);
  const name = body.name.trim();

  const existing = await Product.findOne({
    where: sequelize.where(
      sequelize.fn('lower', sequelize.col('name')),
      name.toLowerCase()
    ),
  });
  if (existing && existing.id !== product.id) {
    throw new Conflict('Продукт с таким названием уже есть в каталоге');
  }

  product.name = name;
  product.calories = body.calories;
  product.protein = body.protein;
  product.fat = body.fat;
  product.carbs = body.carbs;
  await product.save();

  return success(res, serializeProduct(product));
}

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = parseId(req);

  const product = await Product.findByPk(id);
  if (!product) {
    throw new NotFound('Product not found');
  }

  const usedCount = await ReportLine.count({ where: { productId: id } });
  if (usedCount > 0) {
    throw new Conflict(
      'Продукт уже используется в отчётах, удаление сделает отчёты неполными'
    );
  }

  await product.destroy();

  return success(res, { id });
}

export default apiHandler({
  GET: withAdmin(getHandler),
  PUT: withAdmin(putHandler),
  DELETE: withAdmin(deleteHandler),
});
