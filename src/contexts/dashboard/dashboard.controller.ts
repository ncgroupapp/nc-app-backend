import { Controller, Get, UseInterceptors } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";
import { DashboardOverview, DashboardOverviewService } from "./dashboard-overview.service";
import { DashboardAlerts, DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("dashboard")
@UseInterceptors(TransformInterceptor)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly overviewService: DashboardOverviewService,
  ) {}

  @Get("overview")
  @ApiOperation({ summary: "Resumen del dashboard: facturación, licitaciones, margen, solicitudes y certificados RUPE" })
  getOverview(): Promise<DashboardOverview> {
    return this.overviewService.getOverview();
  }

  @Get("alerts")
  @ApiOperation({ summary: "Alertas del día: compras que cierran hoy, productos sin oferta, cotizaciones sin finalizar y certificados por vencer" })
  getAlerts(): Promise<DashboardAlerts> {
    return this.dashboardService.getAlerts();
  }
}
