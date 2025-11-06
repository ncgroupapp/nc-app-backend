import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { HealthModule } from "@/app/health/health.module";

import { DatabaseModule } from "@/shared/database/database.module";
import { LoggerModule } from "@/shared/logger/logger.module";

import { UserModule } from "@/contexts/users/user.module";
import { ProductsModule } from "../contexts/products/products.module";
import { ProvidersModule } from "../contexts/providers/providers.module";
import { ClientsModule } from "../contexts/clients/clients.module";
import { OffersModule } from "../contexts/offers/offers.module";
import { LicitationsModule } from "../contexts/licitations/licitations.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    LoggerModule,
    HealthModule,
    UserModule,
    ProductsModule,
    ProvidersModule,
    ClientsModule,
    OffersModule,
    LicitationsModule,
  ],
})
export class AppModule {}
