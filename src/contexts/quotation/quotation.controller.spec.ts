import { Test, TestingModule } from '@nestjs/testing';
import { QuotationController } from './quotation.controller';
import { QuotationService } from './quotation.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationStatus, QuotationAwardStatus, Currency } from './entities/quotation.entity';

describe('QuotationController', () => {
  let controller: QuotationController;
  let service: QuotationService;

  const mockQuotationService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    findByIdentifier: vi.fn(),
    findByStatus: vi.fn(),
    findByClient: vi.fn(),
    getTotalsByQuotation: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuotationController],
      providers: [
        {
          provide: QuotationService,
          useValue: mockQuotationService,
        },
      ],
    }).compile();

    controller = module.get<QuotationController>(QuotationController);
    service = module.get<QuotationService>(QuotationService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a quotation', async () => {
      const createDto: CreateQuotationDto = {
        quotationIdentifier: 'COT-2025-001',
        status: QuotationStatus.CREATED,
        items: [
          {
            productName: 'Test Product',
            sku: 'SKU-001',
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

      const expectedResult = { id: 1, ...createDto };
      mockQuotationService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);

      expect(result).toEqual(expectedResult);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return all quotations when no filters provided', async () => {
      const expectedResult = [
        { id: 1, quotationIdentifier: 'COT-001' },
        { id: 2, quotationIdentifier: 'COT-002' },
      ];
      mockQuotationService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalled();
    });

    it('should filter by status when provided', async () => {
      const expectedResult = [{ id: 1, quotationIdentifier: 'COT-001', status: 'creada' }];
      mockQuotationService.findByStatus.mockResolvedValue(expectedResult);

      const result = await controller.findAll('creada');

      expect(result).toEqual(expectedResult);
      expect(service.findByStatus).toHaveBeenCalledWith('creada');
    });

    it('should filter by clientId when provided', async () => {
      const expectedResult = [{ id: 1, quotationIdentifier: 'COT-001', clientId: 1 }];
      mockQuotationService.findByClient.mockResolvedValue(expectedResult);

      const result = await controller.findAll(undefined, '1');

      expect(result).toEqual(expectedResult);
      expect(service.findByClient).toHaveBeenCalledWith(1);
    });
  });

  describe('findOne', () => {
    it('should return a quotation by id', async () => {
      const expectedResult = { id: 1, quotationIdentifier: 'COT-001' };
      mockQuotationService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne('1');

      expect(result).toEqual(expectedResult);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('findByIdentifier', () => {
    it('should return a quotation by identifier', async () => {
      const expectedResult = { id: 1, quotationIdentifier: 'COT-2025-001' };
      mockQuotationService.findByIdentifier.mockResolvedValue(expectedResult);

      const result = await controller.findByIdentifier('COT-2025-001');

      expect(result).toEqual(expectedResult);
      expect(service.findByIdentifier).toHaveBeenCalledWith('COT-2025-001');
    });
  });

  describe('getTotals', () => {
    it('should return totals for a quotation', async () => {
      const expectedResult = {
        totalWithoutIVA: 10000,
        totalWithIVA: 11900,
        totalItems: 1,
        itemsByCurrency: { CLP: { withoutIVA: 10000, withIVA: 11900 } },
      };
      mockQuotationService.getTotalsByQuotation.mockResolvedValue(expectedResult);

      const result = await controller.getTotals('1');

      expect(result).toEqual(expectedResult);
      expect(service.getTotalsByQuotation).toHaveBeenCalledWith(1);
    });
  });

  describe('update', () => {
    it('should update a quotation', async () => {
      const updateDto: UpdateQuotationDto = {
        status: QuotationStatus.FINALIZED,
      };
      const expectedResult = { id: 1, ...updateDto };
      mockQuotationService.update.mockResolvedValue(expectedResult);

      const result = await controller.update('1', updateDto);

      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('remove', () => {
    it('should remove a quotation', async () => {
      mockQuotationService.remove.mockResolvedValue(undefined);

      await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
