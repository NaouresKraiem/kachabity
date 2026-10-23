import {
  ArgumentsHost,
  BadRequestException,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
  PipeTransform,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Request, Response } from 'express';
import { map } from 'rxjs';
import { z } from 'zod';
import { knownDbError } from '@shared/erp/db-messages';

// Port of lib/erp/api.ts: same response shapes, so the admin screens don't change.
// { success: true, data } on success, { success: false, error, code? } on failure.

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler) {
    return next
      .handle()
      .pipe(map((data: unknown) => ({ success: true, data })));
  }
}

/** A refusal to send back as is, with an optional machine-readable code. */
export class ApiError extends HttpException {
  constructor(
    message: string,
    status = 400,
    public readonly code?: string,
  ) {
    super(message, status);
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Api');

  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const send = (status: number, message: string, code?: string) =>
      response
        .status(status)
        .json({ success: false, error: message, ...(code ? { code } : {}) });

    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return send(
        400,
        issue
          ? `${issue.path.join('.') || 'data'}: ${issue.message}`
          : 'Invalid data',
        'INVALID',
      );
    }
    if (error instanceof ApiError)
      return send(error.getStatus(), error.message, error.code);
    if (error instanceof HttpException)
      return send(error.getStatus(), error.message);
    const known = knownDbError(error);
    if (known) return send(known.status, known.message, known.code);

    const request = http.getRequest<Request>();
    this.logger.error(
      `${request.method} ${request.path}`,
      error instanceof Error ? error.stack : error,
    );
    // Only the route, never the body or customer details.
    Sentry.captureException(error, {
      tags: { route: request.path, method: request.method },
    });
    return send(500, 'Something went wrong. Please try again.');
  }
}

/** Validates a body or query with a zod schema: `@Body(new Zod(schema)) body: z.infer<typeof schema>`. */
export class Zod<T extends z.ZodType> implements PipeTransform<
  unknown,
  z.infer<T>
> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    if (value === undefined) throw new BadRequestException('Invalid JSON body');
    return this.schema.parse(value);
  }
}

/** Ids from `?ids=a,b,c` (bulk actions) or `?id=a`, like lib/request-ids.ts. */
export function idsFrom(query: { id?: unknown; ids?: unknown }): string[] {
  const raw =
    typeof query.ids === 'string'
      ? query.ids
      : typeof query.id === 'string'
        ? query.id
        : '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
