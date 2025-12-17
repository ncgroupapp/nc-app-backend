import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { CreateImportDto } from './dto/create-import.dto';
import { UpdateImportDto } from './dto/update-import.dto';
import { Import } from './entities/import.entity';
import { Product } from '../products/entities/product.entity';
import { Licitation } from '../licitations/entities/licitation.entity';
import { Provider } from '../providers/entities/provider.entity';

@Injectable()
export class ImportsService {
  constructor(
    @InjectRepository(Import)
    private readonly importRepository: Repository<Import>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Licitation)
    private readonly licitationRepository: Repository<Licitation>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async create(createImportDto: CreateImportDto): Promise<Import> {
    const { productIds, licitationIds, providerId, ...importData } = createImportDto;

    const provider = await this.providerRepository.findOneBy({ id: providerId });
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${providerId} not found`);
    }

    const newImport = this.importRepository.create({
      ...importData,
      provider,
      status: importData.status || 'En Tránsito',
    });

    if (productIds && productIds.length > 0) {
      const products = await this.productRepository.findBy({ id: In(productIds) });
      newImport.products = products;
    }

    if (licitationIds && licitationIds.length > 0) {
      const licitations = await this.licitationRepository.findBy({ id: In(licitationIds) });
      newImport.licitations = licitations;
    }

    this.calculateCosts(newImport);

    return this.importRepository.save(newImport);
  }

  async findAll(status?: string, providerId?: number, fromDate?: string, toDate?: string): Promise<Import[]> {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (providerId) {
      where.provider = { id: providerId };
    }

    if (fromDate && toDate) {
      where.importDate = Between(fromDate, toDate);
    } else if (fromDate) {
      where.importDate = MoreThanOrEqual(fromDate);
    } else if (toDate) {
      where.importDate = LessThanOrEqual(toDate);
    }

    return this.importRepository.find({
      where,
      relations: ['provider', 'products', 'licitations'],
    });
  }

  async findOne(id: number): Promise<Import> {
    const importEntity = await this.importRepository.findOne({
      where: { id },
      relations: ['provider', 'products', 'licitations'],
    });

    if (!importEntity) {
      throw new NotFoundException(`Import with ID ${id} not found`);
    }

    return importEntity;
  }

  async update(id: number, updateImportDto: UpdateImportDto): Promise<Import> {
    const importEntity = await this.findOne(id);
    const { productIds, licitationIds, providerId, ...updateData } = updateImportDto;

    if (providerId) {
      const provider = await this.providerRepository.findOneBy({ id: providerId });
      if (!provider) {
        throw new NotFoundException(`Provider with ID ${providerId} not found`);
      }
      importEntity.provider = provider;
    }

    if (productIds) {
      const products = await this.productRepository.findBy({ id: In(productIds) });
      importEntity.products = products;
    }

    if (licitationIds) {
      const licitations = await this.licitationRepository.findBy({ id: In(licitationIds) });
      importEntity.licitations = licitations;
    }

    Object.assign(importEntity, updateData);
    this.calculateCosts(importEntity);

    return this.importRepository.save(importEntity);
  }

  async remove(id: number): Promise<void> {
    const importEntity = await this.findOne(id);
    await this.importRepository.remove(importEntity);
  }

  private calculateCosts(importEntity: Import) {
    // A. Base Costs
    // CIF = FOB + Freight + Insurance (using USD values as base)
    importEntity.cif = Number(importEntity.fobUsd) + Number(importEntity.freightUsd) + Number(importEntity.insuranceUsd);

    // B. Tributos Oficiales Exentos de IVA
    // Calculated as percentage of CIF
    const cif = importEntity.cif;
    
    importEntity.advanceVat = cif * (importEntity.advanceVatRate / 100);
    importEntity.transitGuide = cif * (importEntity.transitGuideRate / 100);
    importEntity.imaduni = cif * (importEntity.imaduniRate / 100);
    importEntity.vat = cif * (importEntity.vatRate / 100);
    importEntity.surcharge = cif * (importEntity.surchargeRate / 100);
    importEntity.consularFees = cif * (importEntity.consularFeesRate / 100);
    importEntity.tcu = cif * (importEntity.tcuRate / 100);
    importEntity.auriStamps = cif * (importEntity.auriStampsRate / 100);
    importEntity.tsa = cif * (importEntity.tsaRate / 100);
    
    // Sum of B
    importEntity.subtotalA = 
      importEntity.advanceVat +
      importEntity.transitGuide +
      importEntity.imaduni +
      importEntity.vat +
      importEntity.surcharge +
      importEntity.consularFees +
      importEntity.tcu +
      importEntity.auriStamps +
      importEntity.tsa +
      Number(importEntity.bankCharges);

    // C. Otros Pagos Exentos de IVA
    let otherPaymentsSum = 0;
    if (importEntity.otherExemptPayments) {
      for (const key in importEntity.otherExemptPayments) {
        otherPaymentsSum += Number(importEntity.otherExemptPayments[key]);
      }
    }
    importEntity.subtotalB = otherPaymentsSum;

    // D. Pagos Gravados de IVA
    // Calculated as percentage of CIF (Assumption)
    importEntity.dispatchExpenses = cif * (importEntity.dispatchExpensesRate / 100);
    importEntity.customsSurcharge = cif * (importEntity.customsSurchargeRate / 100);
    importEntity.fees = cif * (importEntity.feesRate / 100);
    importEntity.externalFreight = cif * (importEntity.externalFreightRate / 100);
    importEntity.insuranceTax = cif * (importEntity.insuranceTaxRate / 100);
    importEntity.internalFreight = cif * (importEntity.internalFreightRate / 100);

    // VAT Subject (IVA Gravados)
    // Assuming 22% VAT on the sum of D items
    const sumD = 
      importEntity.dispatchExpenses +
      importEntity.customsSurcharge +
      importEntity.fees +
      importEntity.externalFreight +
      importEntity.insuranceTax +
      importEntity.internalFreight;
    
    importEntity.vatSubject = sumD * 0.22; // Assuming 22% VAT

    importEntity.subtotalC = sumD + importEntity.vatSubject;
  }
}
