import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { HealthModule } from "@/app/health/health.module";

import { DatabaseModule } from "@/shared/database/database.module";
import { LoggerModule } from "@/shared/logger/logger.module";

import { UserModule } from "@/contexts/users/user.module";
import { AuthModule } from "@/contexts/auth/auth.module";
import { ProductsModule } from "../contexts/products/products.module";
import { ProvidersModule } from "../contexts/providers/providers.module";
import { ClientsModule } from "../contexts/clients/clients.module";
import { OffersModule } from "../contexts/offers/offers.module";
import { QuotationModule } from "../contexts/quotation/quotation.module";
import { LicitationsModule } from "../contexts/licitations/licitations.module";
import { AdjudicationsModule } from "../contexts/adjudications/adjudications.module";
import { DeliveriesModule } from "../contexts/deliveries/deliveries.module";
import { ImportsModule } from "../contexts/imports/imports.module";
import { ManualsModule } from "../contexts/manuals/manuals.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    LoggerModule,
    HealthModule,
    UserModule,
    AuthModule,
    ProductsModule,
    ProvidersModule,
    ClientsModule,
    OffersModule,
    QuotationModule,
    LicitationsModule,
    AdjudicationsModule,
    DeliveriesModule,
    ImportsModule,
    ManualsModule,
  ],
})
export class AppModule {}
