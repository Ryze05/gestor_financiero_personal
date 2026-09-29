import { Test } from '@nestjs/testing';
import { ExchangeRateController } from './exchange-rate.controller.js';
import { ExchangeRateService } from './exchange-rate.service.js';
import { Prisma } from '../generated/prisma/client.js';

describe('ExchangeRateController', () => {
  let controller: ExchangeRateController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ExchangeRateController],
      providers: [
        {
          provide: ExchangeRateService,
          useValue: {
            getRate: vi
              .fn()
              .mockResolvedValue(new Prisma.Decimal('0.9195')),
          },
        },
      ],
    }).compile();

    controller = module.get(ExchangeRateController);
  });

  it('devuelve la tasa en formato string', async () => {
    const result = await controller.get({
      from: 'USD',
      to: 'EUR',
    } as never);

    expect(result).toEqual({
      from: 'USD',
      to: 'EUR',
      rate: '0.9195',
    });
  });
});