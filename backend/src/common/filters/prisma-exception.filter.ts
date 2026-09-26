import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message } = mapPrismaError(exception.code);

    response.status(status).json({ statusCode: status, error: message });
  }
}

function mapPrismaError(code: string) {
  switch (code) {
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, message: 'Recurso no encontrado.' };
    case 'P2002':
      return { status: HttpStatus.CONFLICT, message: 'El recurso ya existe.' };
    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno del servidor.',
      };
  }
}