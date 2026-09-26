import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma-exception.filter.js';
import { Prisma } from '../../generated/prisma/client.js';

const makeError = (code: string) =>
  ({ code }) as unknown as Prisma.PrismaClientKnownRequestError;

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let status: ReturnType<typeof vi.fn>;
  let json: ReturnType<typeof vi.fn>;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    json = vi.fn();
    status = vi.fn(() => ({ json }));
    const response = { status, json };
    host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;
  });

  it('P2025 (no encontrado) → 404', () => {
    filter.catch(makeError('P2025'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      error: 'Recurso no encontrado.',
    });
  });

  it('P2002 (duplicado) → 409', () => {
    filter.catch(makeError('P2002'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      error: 'El recurso ya existe.',
    });
  });

  it('otro código de Prisma → 500', () => {
    filter.catch(makeError('P9999'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Error interno del servidor.',
    });
  });
});