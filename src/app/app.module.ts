import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { HealthModule } from "@/app/health/health.module";

import { DatabaseModule } from "@/shared/database/database.module";
import { LoggerModule } from "@/shared/logger/logger.module";

import { UserModule } from "@/contexts/users/user.module";
import { ProductsModule } from "../contexts/products/products.module";
import { ProvidersModule } from "../contexts/providers/providers.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    LoggerModule,
    HealthModule,
    UserModule,
    ProductsModule,
    ProvidersModule,
  ],
})
export class AppModule {}
