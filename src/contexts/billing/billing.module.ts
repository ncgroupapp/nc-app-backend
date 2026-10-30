import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { BillingDocument } from "./entities/billing-document.entity";

@Module({
  imports: [TypeOrmModule.forFeature([BillingDocument])],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
