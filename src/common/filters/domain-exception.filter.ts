import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  DomainException,
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../../shared-kernel/domain-exception';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const statusCode = this.resolveStatusCode(exception);

    response.status(statusCode).json({
      statusCode,
      error: exception.name,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private resolveStatusCode(exception: DomainException): number {
    if (exception instanceof ForbiddenDomainException)
      return HttpStatus.FORBIDDEN;
    if (exception instanceof NotFoundDomainException)
      return HttpStatus.NOT_FOUND;
    return HttpStatus.BAD_REQUEST;
  }
}
