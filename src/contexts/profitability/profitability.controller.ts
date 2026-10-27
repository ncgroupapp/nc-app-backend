import { Body, Controller, Get, Logger, Put, Query, UseInterceptors } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";
import { FilterProfitabilityDto } from "./dto/filter-profitability.dto";
import { UpdateProfitabilitySettingsDto } from "./dto/update-profitability-settings.dto";
import { ProfitabilityReport, ProfitabilityService, ProfitabilitySettings } from "./profitability.service";

@ApiTags("profitability")
@Controller("profitability")
@UseInterceptors(TransformInterceptor)
export class ProfitabilityController {
  private readonly logger = new Logger(ProfitabilityController.name);

  constructor(private readonly profitabilityService: ProfitabilityService) {}

  @Get()
  @ApiOperation({ summary: "Rentabilidad por licitación (costo = oferta elegida en la cotización), en USD" })
  async getReport(@Query() filters: FilterProfitabilityDto): Promise<ProfitabilityReport> {
    return this.profitabilityService.getReport(filters);
  }

  @Get("settings")
  @ApiOperation({ summary: "Tipo de cambio fijo y margen mínimo" })
  async getSettings(): Promise<ProfitabilitySettings> {
    return this.profitabilityService.getSettings();
  }

  @Put("settings")
  @ApiOperation({ summary: "Actualizar tipo de cambio y margen mínimo" })
  async updateSettings(@Body() dto: UpdateProfitabilitySettingsDto): Promise<ProfitabilitySettings> {
    this.logger.log(`PUT /profitability/settings rate=${dto.exchangeRate} min=${dto.minMargin}`);
    return this.profitabilityService.updateSettings(dto);
  }
}
