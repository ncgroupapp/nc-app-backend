import { Test, TestingModule } from '@nestjs/testing';
import { ManualsController } from './manuals.controller';
import { ManualsService } from './manuals.service';
import { vi } from 'vitest';

describe('ManualsController', () => {
  let controller: ManualsController;

  const mockManualsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManualsController],
      providers: [
        {
          provide: ManualsService,
          useValue: mockManualsService,
        },
      ],
    }).compile();

    controller = module.get<ManualsController>(ManualsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
