import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import { CreateStockPurchaseDto } from "./dto/create-stock-purchase.dto";
import { FilterStockDto } from "./dto/filter-stock.dto";
import { UpdateStockPurchaseDto } from "./dto/update-stock-purchase.dto";
import { StockItemView, StockPurchaseView, StockService, StockSummary } from "./stock.service";

@ApiTags("stock")
@Controller("stock")
@UseInterceptors(TransformInterceptor)
export class StockController {
  private readonly logger = new Logger(StockController.name);

  constructor(private readonly stockService: StockService) {}

  @Get()
  @ApiOperation({ summary: "Productos con stock, con su última compra (costo y proveedor)" })
  @ApiResponse({ status: 200, description: "Listado paginado de productos en stock" })
  async findInStock(@Query() filters: FilterStockDto): Promise<PaginatedResult<StockItemView>> {
    return this.stockService.findInStock(filters);
  }

  @Get("summary")
  @ApiOperation({ summary: "Totales del stock: productos, unidades y valor por moneda" })
  async getSummary(): Promise<StockSummary> {
    return this.stockService.getSummary();
  }

  @Get("products/:productId/purchases")
  @ApiOperation({ summary: "Historial de compras de un producto" })
  @ApiResponse({ status: 404, description: "Producto no encontrado" })
  async findPurchases(@Param("productId", ParseIntPipe) productId: number): Promise<StockPurchaseView[]> {
    return this.stockService.findPurchases(productId);
  }

  @Post("products/:productId/purchases")
  @ApiOperation({ summary: "Registrar una compra (costo y proveedor) para un producto" })
  @ApiResponse({ status: 201, description: "Compra registrada" })
  async createPurchase(
    @Param("productId", ParseIntPipe) productId: number,
    @Body() dto: CreateStockPurchaseDto,
  ): Promise<StockPurchaseView> {
    this.logger.log(`POST /stock/products/${productId}/purchases`);
    return this.stockService.createPurchase(productId, dto);
  }

  @Patch("purchases/:id")
  @ApiOperation({ summary: "Editar una compra" })
  async updatePurchase(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateStockPurchaseDto,
  ): Promise<StockPurchaseView> {
    return this.stockService.updatePurchase(id, dto);
  }

  @Delete("purchases/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar una compra" })
  async removePurchase(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.stockService.removePurchase(id);
  }
}
