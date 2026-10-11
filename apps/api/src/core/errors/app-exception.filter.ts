// 09-code-conventions §2.1 — wire format: { error: { code, message, params, fields, details, ref } }
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { AppException } from './app.exception';
import { I18nService } from '../i18n/i18n.service';

const fieldsOf = (err: ZodError) => {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.') || '_';
    // messages written by the shared validators are already `validation.*` keys
    fields[path] ??= issue.message.startsWith('validation.') ? issue.message : 'validation.invalid';
  }
  return fields;
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger(AppExceptionFilter.name);
  constructor(private readonly i18n: I18nService) {}

  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    const locale: string = req.locale ?? 'fr';
    const ref: string = req.id ?? 'unknown';
    const body = (
      code: string,
      params: Record<string, string | number>,
      fields: Record<string, string>,
      details: unknown,
    ) => ({
      error: {
        code,
        message: this.i18n.t(locale, `error.${code}`, { ...params, ref }),
        params,
        fields,
        details: details ?? null,
        ref,
      },
    });

    if (err instanceof AppException) {
      if (err.code === 'RATE_LIMITED' && err.params.retryAfter) {
        res.setHeader('Retry-After', String(err.params.retryAfter));
      }
      return res.status(err.getStatus()).json(body(err.code, err.params, err.fields, err.details));
    }
    if (err instanceof ZodValidationException) {
      return res.status(422).json(body('VALIDATION_ERROR', {}, fieldsOf(err.getZodError()), null));
    }
    if (err instanceof ZodError) {
      return res.status(422).json(body('VALIDATION_ERROR', {}, fieldsOf(err), null));
    }
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const code =
        status === 401
          ? 'UNAUTHORIZED'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : status === 413
                ? 'UPLOAD_TOO_LARGE'
                : status === 429
                  ? 'RATE_LIMITED'
                  : 'BAD_REQUEST';
      return res.status(status).json(body(code, {}, {}, null));
    }
    this.log.error({ ref, err: err instanceof Error ? { message: err.message, stack: err.stack } : err }, 'unhandled');
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body('INTERNAL', {}, {}, null));
  }
}
