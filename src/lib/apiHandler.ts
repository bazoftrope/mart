import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { ZodError } from 'zod';
import { AppError } from './errors';

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: string;
  message: string;
  issues?: Record<string, string>;
};

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

function formatZodError(error: ZodError): Record<string, string> {
  const issues: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root';
    issues[path] = issue.message;
  }
  return issues;
}

function setCorsHeaders(res: NextApiResponse): void {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
}

export function apiHandler(
  methods: Record<string, NextApiHandler>
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    try {
      const handler = methods[req.method || ''];
      if (!handler) {
        res.setHeader('Allow', Object.keys(methods).join(', '));
        return res.status(405).json({
          success: false,
          error: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} not allowed`,
        });
      }

      return await handler(req, res);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.status).json({
          success: false,
          error: error.code,
          message: error.message,
        });
      }

      if (error instanceof ZodError) {
        const issues = formatZodError(error);
        const details = Object.entries(issues)
          .map(([path, message]) => (path === 'root' ? message : `${path}: ${message}`))
          .join('; ');

        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: details ? `Ошибка валидации: ${details}` : 'Ошибка валидации',
          issues,
        });
      }

      console.error('API error:', error);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  };
}

export function success<T>(
  res: NextApiResponse,
  data: T,
  status = 200
): void {
  res.status(status).json({ success: true, data });
}

export function error(
  res: NextApiResponse,
  status: number,
  code: string,
  message: string
): void {
  res.status(status).json({ success: false, error: code, message });
}
