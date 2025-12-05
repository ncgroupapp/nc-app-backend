import { Test, TestingModule } from '@nestjs/testing';
import { ManualsService } from './manuals.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Manual } from './entities/manual.entity';
import { vi } from 'vitest';

describe('ManualsService', () => {
  let service: ManualsService;

  const mockRepository = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOneBy: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManualsService,
        {
          provide: getRepositoryToken(Manual),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ManualsService>(ManualsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
