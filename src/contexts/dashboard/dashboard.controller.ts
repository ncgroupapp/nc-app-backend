import { Controller, Get, UseInterceptors } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";
import { DashboardAlerts, DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("dashboard")
@UseInterceptors(TransformInterceptor)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("alerts")
  @ApiOperation({ summary: "Alertas del día: compras que cierran hoy, productos sin oferta y cotizaciones sin finalizar" })
  getAlerts(): Promise<DashboardAlerts> {
    return this.dashboardService.getAlerts();
  }
}
