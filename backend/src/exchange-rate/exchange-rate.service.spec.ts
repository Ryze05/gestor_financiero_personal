import { BadGatewayException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { Currency } from '../generated/prisma/enums.js';
import { ExchangeRateService } from './exchange-rate.service.js';

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;
  const fetchMock = vi.fn();

  const jsonResponse = (body: unknown, ok = true) =>
    ({ ok, json: async () => body }) as Response;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);

    const module = await Test.createTestingModule({
      providers: [
        ExchangeRateService,
        { provide: ConfigService, useValue: { get: vi.fn() } },
      ],
    }).compile();

    service = module.get(ExchangeRateService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getRate', () => {
    it('devuelve la tasa como Decimal si la API responde', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          base: 'USD',
          date: '2026-09-25',
          rates: { EUR: 0.9195 },
        }),
      );

      const rate = await service.getRate(Currency.USD, Currency.EUR);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.frankfurter.app/latest?from=USD&to=EUR',
      );
      expect(rate).toBeInstanceOf(Prisma.Decimal);
      expect(rate.toString()).toBe('0.9195');
    });

    it('usa la URL base configurada en FX_API_URL', async () => {
      const module = await Test.createTestingModule({
        providers: [
          ExchangeRateService,
          {
            provide: ConfigService,
            useValue: { get: vi.fn().mockReturnValue('https://fx.example.test') },
          },
        ],
      }).compile();
      const custom = module.get(ExchangeRateService);
      fetchMock.mockResolvedValue(jsonResponse({ rates: { EUR: 0.9 } }));

      await custom.getRate(Currency.USD, Currency.EUR);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://fx.example.test/latest?from=USD&to=EUR',
      );
    });

    it('lanza BadGatewayException si la red falla', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      await expect(
        service.getRate(Currency.USD, Currency.EUR),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('lanza BadGatewayException si la API responde con error HTTP', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, false));

      await expect(
        service.getRate(Currency.USD, Currency.EUR),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('lanza BadGatewayException si el body no es JSON válido', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('invalid json');
        },
      } as Response);

      await expect(
        service.getRate(Currency.USD, Currency.EUR),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('lanza BadGatewayException si falta la moneda destino', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ base: 'USD', rates: {} }));

      await expect(
        service.getRate(Currency.USD, Currency.EUR),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('lanza BadGatewayException si la tasa no es positiva', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ base: 'USD', rates: { EUR: 0 } }),
      );

      await expect(
        service.getRate(Currency.USD, Currency.EUR),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('convert', () => {
    it('multiplica y redondea a 2 decimales (half-up)', () => {
      const result = service.convert(
        new Prisma.Decimal('23.4'),
        new Prisma.Decimal('0.9195'),
      );
      expect(result.toString()).toBe('21.52');
    });

    it('redondea al alza en el punto medio', () => {
      const result = service.convert(
        new Prisma.Decimal('1.005'),
        new Prisma.Decimal('1'),
      );
      expect(result.toString()).toBe('1.01');
    });

    it('trunca cuando la tercera cifra es menor que 5', () => {
      const result = service.convert(
        new Prisma.Decimal('1.004'),
        new Prisma.Decimal('1'),
      );
      expect(result.toString()).toBe('1');
    });
  });
});