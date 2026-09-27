import { Test } from '@nestjs/testing';
import { HealthService } from './health.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('HealthService', () => {
  let service: HealthService;
  const prisma = { $queryRaw: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(HealthService);
  });

  it('devuelve ok cuando la base de datos responde', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.check();

    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('finanzas-personales');
    expect(result.database).toBe('up');
    expect(typeof result.timestamp).toBe('string');
  });

  it('propaga el error si la base de datos falla', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));

    await expect(service.check()).rejects.toThrow('db down');
  });
});