import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { ProfitabilityModule } from "../profitability/profitability.module";
import { DashboardOverviewService } from "./dashboard-overview.service";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [ProfitabilityModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardOverviewService],
})
export class DashboardModule {}
