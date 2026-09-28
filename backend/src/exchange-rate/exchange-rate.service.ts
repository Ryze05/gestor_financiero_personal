import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { Currency } from '../generated/prisma/enums.js';

@Injectable()
export class ExchangeRateService {
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      config.get<string>('FX_API_URL') ?? 'https://api.frankfurter.app';
  }

  async getRate(from: Currency, to: Currency): Promise<Prisma.Decimal> {
    const url = `${this.baseUrl}/latest?from=${from}&to=${to}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new BadGatewayException(
        'El servicio de tipos de cambio no está disponible.',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        'El servicio de tipos de cambio no está disponible.',
      );
    }

    let body: { rates?: Record<string, number> };
    try {
      body = (await response.json()) as { rates?: Record<string, number> };
    } catch {
      throw new BadGatewayException(
        'El servicio de tipos de cambio no está disponible.',
      );
    }

    const rate = body?.rates?.[to];
    if (typeof rate !== 'number' || rate <= 0) {
      throw new BadGatewayException(
        'No se pudo obtener la tasa de conversión.',
      );
    }

    return new Prisma.Decimal(rate);
  }

  convert(amount: Prisma.Decimal, rate: Prisma.Decimal): Prisma.Decimal {
    return amount.times(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }
}