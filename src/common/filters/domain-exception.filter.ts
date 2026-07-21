import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '../../shared-kernel/domain-exception';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // A domain rule violation is a client error (they sent something
    // that violates a business invariant), so it maps to 400 — never
    // 500, which would incorrectly suggest a server bug.
    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: exception.name,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
