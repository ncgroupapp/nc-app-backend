import { Test, TestingModule } from '@nestjs/testing';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

describe('ImportsController', () => {
  let controller: ImportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [ImportsService],
    }).compile();

    controller = module.get<ImportsController>(ImportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
