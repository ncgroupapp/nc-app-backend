import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LicitationsService } from '../../../src/contexts/licitations/licitations.service';
import { Licitation } from '../../../src/contexts/licitations/entities/licitation.entity';
import { LicitationProduct } from '../../../src/contexts/licitations/entities/licitation-product.entity';
import { Client } from '../../../src/contexts/clients/entities/client.entity';
import { Product } from '../../../src/contexts/products/entities/product.entity';
import { Quotation } from '../../../src/contexts/quotation/entities/quotation.entity';
import { Repository } from 'typeorm';

describe('LicitationsService', () => {
  let service: LicitationsService;
  let licitationRepository: Repository<Licitation>;

  const mockQueryBuilder = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
  };

  const mockLicitationRepository = {
    createQueryBuilder: vi.fn(() => mockQueryBuilder),
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicitationsService,
        {
          provide: getRepositoryToken(Licitation),
          useValue: mockLicitationRepository,
        },
        {
          provide: getRepositoryToken(LicitationProduct),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Client),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Product),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Quotation),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LicitationsService>(LicitationsService);
    licitationRepository = module.get<Repository<Licitation>>(getRepositoryToken(Licitation));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll with product code search', () => {
    it('should include product code in the search filters', async () => {
      const search = 'PR-001';
      await service.findAll({ search });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('product.code ILIKE :search'),
        expect.any(Object)
      );
    });
  });
});
