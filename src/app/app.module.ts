import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
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

import { AuthMiddleware } from "@/src/contexts/auth/middlewares/auth.middleware";
import { LoggerMiddleware } from "@/shared/logger/logger.middleware";
import { CorrelationIdMiddleware } from "@/shared/middlewares/correlation-id.middleware";

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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): any {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: "auth/login", method: RequestMethod.POST },
        { path: "auth/login", method: RequestMethod.OPTIONS },
        { path: "api", method: RequestMethod.GET },
        { path: "api/(.*)", method: RequestMethod.GET },
      )
      .forRoutes("*");

    consumer.apply(LoggerMiddleware).forRoutes("*");
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
