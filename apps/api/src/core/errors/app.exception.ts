// 09-code-conventions §2.1
import { HttpException } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@djaber/shared';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    public readonly params: Record<string, string | number> = {},
    public readonly fields: Record<string, string> = {},
    /** provider message, per-item errors, `{ changedBy, changedAt, current }` on CONFLICT */
    public readonly details?: unknown,
    status: number = ERROR_CODES[code].status || 400,
  ) {
    super({ code, params, fields, details }, status);
  }
}

export const notFound = () => new AppException('NOT_FOUND');
export const forbidden = () => new AppException('FORBIDDEN');
export const conflict = (details?: unknown) => new AppException('CONFLICT', {}, {}, details);
export const validationError = (fields: Record<string, string>) =>
  new AppException('VALIDATION_ERROR', {}, fields);
