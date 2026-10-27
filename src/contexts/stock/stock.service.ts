import { Injectable, Logger, NotFoundException, OnModuleInit, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { Product } from "../products/entities/product.entity";
import { Provider } from "../providers/entities/provider.entity";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import { StockPurchase } from "./entities/stock-purchase.entity";
import { CreateStockPurchaseDto } from "./dto/create-stock-purchase.dto";
import { UpdateStockPurchaseDto } from "./dto/update-stock-purchase.dto";
import { FilterStockDto } from "./dto/filter-stock.dto";
import { CREATE_STOCK_PURCHASES_TABLE_SQL } from "./stock-purchases.table";

export interface StockPurchaseView {
  id: number;
  productId: number;
  providerId: number | null;
  providerName: string | null;
  purchaseDate: string | null;
  orderNumber: string | null;
  quantity: number;
  unitCost: number;
  currency: string;
  notes: string | null;
  createdAt: Date;
}

export interface StockItemView {
  id: number;
  name: string;
  code: string | null;
  brand: string | null;
  model: string | null;
  image: string | null;
  stockQuantity: number;
  purchasesCount: number;
  lastPurchase: StockPurchaseView | null;
}

export interface StockSummary {
  productsInStock: number;
  unitsInStock: number;
  productsWithCost: number;
  /** Valor del stock (stock actual × costo de la última compra), agrupado por moneda. */
  valueByCurrency: Array<{ currency: string; value: number }>;
}

@Injectable()
export class StockService implements OnModuleInit {
  private readonly logger = new Logger(StockService.name);

  constructor(
    @InjectRepository(StockPurchase)
    private readonly purchaseRepository: Repository<StockPurchase>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    private readonly dataSource: DataSource,
  ) {}

  /** Creates the table if missing (idempotent), so no manual migration is needed on deploy. */
  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(CREATE_STOCK_PURCHASES_TABLE_SQL);
    } catch (error) {
      this.logger.error(
        "Could not ensure stock_purchases table",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async findInStock(filters: FilterStockDto): Promise<PaginatedResult<StockItemView>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.productRepository
      .createQueryBuilder("product")
      .select([
        "product.id",
        "product.name",
        "product.code",
        "product.brand",
        "product.model",
        "product.images",
        "product.stockQuantity",
      ])
      .where("COALESCE(product.stockQuantity, 0) > 0")
      .orderBy("product.name", "ASC")
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.search) {
      qb.andWhere(
        "(product.name ILIKE :search OR product.code ILIKE :search OR product.brand ILIKE :search OR product.model ILIKE :search OR array_to_string(product.equivalentCodes, ',') ILIKE :search)",
        { search: `%${filters.search}%` },
      );
    }

    const [products, total] = await qb.getManyAndCount();
    const purchasesByProduct = await this.purchasesByProduct(products.map(p => p.id));

    const data: StockItemView[] = products.map(product => {
      const purchases = purchasesByProduct.get(product.id) ?? [];
      return {
        id: product.id,
        name: product.name,
        code: product.code ?? null,
        brand: product.brand ?? null,
        model: product.model ?? null,
        image: product.images?.[0] ?? null,
        stockQuantity: product.stockQuantity ?? 0,
        purchasesCount: purchases.length,
        lastPurchase: purchases[0] ?? null,
      };
    });

    return { data, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
  }

  async getSummary(): Promise<StockSummary> {
    const [totals] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS "productsInStock", COALESCE(SUM("stockQuantity"), 0)::int AS "unitsInStock"
       FROM "products" WHERE COALESCE("stockQuantity", 0) > 0`,
    );
    const valueRows: Array<{ currency: string; value: string; products: number }> = await this.dataSource.query(
      `SELECT lp."currency" AS "currency", SUM(lp."unitCost" * p."stockQuantity") AS "value", COUNT(*)::int AS "products"
       FROM "products" p
       JOIN LATERAL (
         SELECT sp."currency", sp."unitCost" FROM "stock_purchases" sp
         WHERE sp."productId" = p."id"
         ORDER BY sp."purchaseDate" DESC NULLS LAST, sp."createdAt" DESC
         LIMIT 1
       ) lp ON true
       WHERE COALESCE(p."stockQuantity", 0) > 0
       GROUP BY lp."currency"
       ORDER BY lp."currency"`,
    );

    return {
      productsInStock: totals?.productsInStock ?? 0,
      unitsInStock: totals?.unitsInStock ?? 0,
      productsWithCost: valueRows.reduce((acc, row) => acc + Number(row.products), 0),
      valueByCurrency: valueRows.map(row => ({ currency: row.currency, value: Number(row.value) })),
    };
  }

  async findPurchases(productId: number): Promise<StockPurchaseView[]> {
    await this.ensureProduct(productId);
    const map = await this.purchasesByProduct([productId]);
    return map.get(productId) ?? [];
  }

  async createPurchase(productId: number, dto: CreateStockPurchaseDto): Promise<StockPurchaseView> {
    await this.ensureProduct(productId);
    const providerName = await this.resolveProviderName(dto.providerId, dto.providerName);

    const purchase = this.purchaseRepository.create({
      productId,
      providerId: dto.providerId ?? null,
      providerName,
      purchaseDate: dto.purchaseDate ?? null,
      orderNumber: dto.orderNumber?.trim() || null,
      quantity: dto.quantity,
      unitCost: dto.unitCost,
      currency: dto.currency,
      notes: dto.notes?.trim() || null,
    });
    const saved = await this.purchaseRepository.save(purchase);
    this.logger.log(`Stock purchase ${saved.id} created for product ${productId}`);
    return this.toView(saved);
  }

  async updatePurchase(id: number, dto: UpdateStockPurchaseDto): Promise<StockPurchaseView> {
    const purchase = await this.purchaseRepository.findOne({ where: { id } });
    if (!purchase) {
      throw new NotFoundException(`Compra con ID ${id} no encontrada`);
    }

    if (dto.providerId !== undefined || dto.providerName !== undefined) {
      const providerId = dto.providerId !== undefined ? dto.providerId : purchase.providerId;
      purchase.providerName = await this.resolveProviderName(providerId, dto.providerName ?? purchase.providerName);
      purchase.providerId = providerId ?? null;
    }
    if (dto.purchaseDate !== undefined) purchase.purchaseDate = dto.purchaseDate;
    if (dto.orderNumber !== undefined) purchase.orderNumber = dto.orderNumber?.trim() || null;
    if (dto.quantity !== undefined) purchase.quantity = dto.quantity;
    if (dto.unitCost !== undefined) purchase.unitCost = dto.unitCost;
    if (dto.currency !== undefined) purchase.currency = dto.currency;
    if (dto.notes !== undefined) purchase.notes = dto.notes?.trim() || null;

    return this.toView(await this.purchaseRepository.save(purchase));
  }

  async removePurchase(id: number): Promise<void> {
    const result = await this.purchaseRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Compra con ID ${id} no encontrada`);
    }
  }

  /** Purchases grouped by product, newest first (by purchase date, then creation). */
  private async purchasesByProduct(productIds: number[]): Promise<Map<number, StockPurchaseView[]>> {
    const map = new Map<number, StockPurchaseView[]>();
    if (productIds.length === 0) return map;

    const purchases = await this.purchaseRepository
      .createQueryBuilder("purchase")
      .where({ productId: In(productIds) })
      .orderBy("purchase.purchaseDate", "DESC", "NULLS LAST")
      .addOrderBy("purchase.createdAt", "DESC")
      .getMany();

    for (const purchase of purchases) {
      const list = map.get(purchase.productId) ?? [];
      list.push(this.toView(purchase));
      map.set(purchase.productId, list);
    }
    return map;
  }

  private async ensureProduct(productId: number): Promise<void> {
    const exists = await this.productRepository.exists({ where: { id: productId } });
    if (!exists) {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
    }
  }

  private async resolveProviderName(providerId?: number | null, providerName?: string | null): Promise<string> {
    if (providerId) {
      const provider = await this.providerRepository.findOne({ where: { id: providerId } });
      if (!provider) {
        throw new NotFoundException(`Proveedor con ID ${providerId} no encontrado`);
      }
      return provider.name.trim();
    }
    const name = providerName?.trim();
    if (!name) {
      throw new BadRequestException("Indicá el proveedor de la compra");
    }
    return name;
  }

  private toView(purchase: StockPurchase): StockPurchaseView {
    return {
      id: purchase.id,
      productId: purchase.productId,
      providerId: purchase.providerId ?? null,
      providerName: purchase.providerName ?? null,
      purchaseDate: purchase.purchaseDate ?? null,
      orderNumber: purchase.orderNumber ?? null,
      quantity: Number(purchase.quantity),
      unitCost: Number(purchase.unitCost),
      currency: purchase.currency,
      notes: purchase.notes ?? null,
      createdAt: purchase.createdAt,
    };
  }
}
