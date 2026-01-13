import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuotationService } from './quotation.service';
import { Quotation, QuotationItem, QuotationStatus, QuotationAwardStatus, Currency } from './entities/quotation.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('QuotationService', () => {
  let service: QuotationService;
  let quotationRepository: Repository<Quotation>;
  let quotationItemRepository: Repository<QuotationItem>;

  const mockQuotationRepository = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    remove: vi.fn(),
  };

  const mockQuotationItemRepository = {
    create: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationService,
        {
          provide: getRepositoryToken(Quotation),
          useValue: mockQuotationRepository,
        },
        {
          provide: getRepositoryToken(QuotationItem),
          useValue: mockQuotationItemRepository,
        },
      ],
    }).compile();

    service = module.get<QuotationService>(QuotationService);
    quotationRepository = module.get<Repository<Quotation>>(getRepositoryToken(Quotation));
    quotationItemRepository = module.get<Repository<QuotationItem>>(getRepositoryToken(QuotationItem));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a quotation successfully', async () => {
      const createDto = {
        quotationIdentifier: 'COT-2025-001',
        status: QuotationStatus.CREATED,
        items: [
          {

            productId: 1,
            inStock: true,
            quantity: 10,
            priceWithoutIVA: 1000,
            priceWithIVA: 1190,
            ivaPercentage: 19,
            currency: Currency.CLP,
            awardStatus: QuotationAwardStatus.PENDING,
          },
        ],
      };

      const mockQuotation = { id: 1, ...createDto };

      mockQuotationRepository.findOne.mockResolvedValue(null);
      mockQuotationItemRepository.create.mockReturnValue(createDto.items[0]);
      mockQuotationRepository.create.mockReturnValue(mockQuotation);
      mockQuotationRepository.save.mockResolvedValue(mockQuotation);

      const result = await service.create(createDto as any);

      expect(result).toEqual(mockQuotation);
      expect(mockQuotationRepository.findOne).toHaveBeenCalledWith({
        where: { quotationIdentifier: createDto.quotationIdentifier },
      });
      expect(mockQuotationRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if identifier already exists', async () => {
      const createDto = {
        quotationIdentifier: 'COT-2025-001',
        status: QuotationStatus.CREATED,
        items: [],
      };

      mockQuotationRepository.findOne.mockResolvedValue({ id: 1 });

      await expect(service.create(createDto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all quotations', async () => {
      const mockQuotations = [
        { id: 1, quotationIdentifier: 'COT-001', items: [] },
        { id: 2, quotationIdentifier: 'COT-002', items: [] },
      ];

      mockQuotationRepository.find.mockResolvedValue(mockQuotations);

      const result = await service.findAll({});

      expect(result).toEqual(mockQuotations);
      expect(mockQuotationRepository.find).toHaveBeenCalledWith({
        relations: ['items'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a quotation by id', async () => {
      const mockQuotation = { id: 1, quotationIdentifier: 'COT-001', items: [] };

      mockQuotationRepository.findOne.mockResolvedValue(mockQuotation);

      const result = await service.findOne(1);

      expect(result).toEqual(mockQuotation);
      expect(mockQuotationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['items'],
      });
    });

    it('should throw NotFoundException if quotation not found', async () => {
      mockQuotationRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTotalsByQuotation', () => {
    it('should calculate totals correctly', async () => {
      const mockQuotation = {
        id: 1,
        items: [
          {
            quantity: 10,
            priceWithoutIVA: 1000,
            priceWithIVA: 1190,
            currency: Currency.CLP,
          },
          {
            quantity: 5,
            priceWithoutIVA: 2000,
            priceWithIVA: 2380,
            currency: Currency.CLP,
          },
        ],
      };

      mockQuotationRepository.findOne.mockResolvedValue(mockQuotation);

      const result = await service.getTotalsByQuotation(1);

      expect(result.totalWithoutIVA).toBe(20000); // (10*1000) + (5*2000)
      expect(result.totalWithIVA).toBe(23800); // (10*1190) + (5*2380)
      expect(result.totalItems).toBe(2);
      expect(result.itemsByCurrency.CLP.withoutIVA).toBe(20000);
    });
  });
});
