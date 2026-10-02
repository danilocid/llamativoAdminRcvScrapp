import {
  Catch,
  HttpException,
  ArgumentsHost,
  HttpStatus,
  NotFoundException,
  Logger,
  ExceptionFilter,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException, NotFoundException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: any | NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let message: string;
    if (exception instanceof HttpException) {
      const exceptionResponse: any = exception.getResponse();
      status =
        exceptionResponse.code ||
        exceptionResponse.statusCode ||
        exceptionResponse.status ||
        500;
      message = exceptionResponse.message || 'Error interno del servidor';
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Error interno del servidor';
    }
    if (Array.isArray(message)) {
      message = message[0];
    }
    this.logger.error(`[${status}] ${message}`);
    response.status(status).json({
      serverResponseMessage: message,
      serverResponseCode: status,
      data: null,
    });
  }
}
