import { Test } from '@nestjs/testing';
import { CategoriesService } from './categories.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CategoryType } from '../generated/prisma/enums.js';

describe('CategoriesService', () => {
  let service: CategoriesService;
  const prisma = {
    category: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CategoriesService);
  });

  describe('findAll', () => {
    it('devuelve las categorías paginadas', async () => {
      const categorias = [
        { id: 'c1', name: 'Ocio', type: 'EXPENSE', color: null, isArchived: false },
      ];
      prisma.category.findMany.mockResolvedValue(categorias);
      prisma.category.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { name: 'asc' },
      });
      expect(prisma.category.count).toHaveBeenCalledOnce();
      expect(result).toEqual({ data: categorias, total: 1, page: 1, limit: 20 });
    });
  });

  describe('create', () => {
    it('crea una categoría con los datos del DTO', async () => {
      const dto = { name: 'Viajes', type: CategoryType.EXPENSE, color: '#0ea5e9' };
      const creada = { id: 'c2', ...dto, isArchived: false };
      prisma.category.create.mockResolvedValue(creada);

      const result = await service.create(dto);

      expect(prisma.category.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual(creada);
    });
  });

  describe('findOne', () => {
    it('devuelve la categoría indicada', async () => {
      const categoria = {
        id: 'c1',
        name: 'Ocio',
        type: CategoryType.EXPENSE,
        color: null,
        isArchived: false,
      };
      prisma.category.findUniqueOrThrow.mockResolvedValue(categoria);

      const result = await service.findOne('c1');

      expect(prisma.category.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'c1' },
      });
      expect(result).toEqual(categoria);
    });
  });

  describe('update', () => {
    it('actualiza la categoría con los datos del DTO', async () => {
      const dto = { name: 'Ocio y tiempo libre', color: '#a855f7' };
      const actualizada = {
        id: 'c1',
        name: 'Ocio y tiempo libre',
        type: CategoryType.EXPENSE,
        color: '#a855f7',
        isArchived: false,
      };
      prisma.category.update.mockResolvedValue(actualizada);

      const result = await service.update('c1', dto);

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: dto,
      });
      expect(result).toEqual(actualizada);
    });
  });

  describe('archive', () => {
    it('archiva la categoría', async () => {
      const archivada = {
        id: 'c1',
        name: 'Ocio',
        type: CategoryType.EXPENSE,
        color: null,
        isArchived: true,
      };
      prisma.category.update.mockResolvedValue(archivada);

      const result = await service.archive('c1');

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { isArchived: true },
      });
      expect(result).toEqual(archivada);
    });
  });

  describe('restore', () => {
    it('desarchiva la categoría', async () => {
      const restaurada = {
        id: 'c1',
        name: 'Ocio',
        type: CategoryType.EXPENSE,
        color: null,
        isArchived: false,
      };
      prisma.category.update.mockResolvedValue(restaurada);

      const result = await service.restore('c1');

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { isArchived: false },
      });
      expect(result).toEqual(restaurada);
    });
  });
});