import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get<string>("DB_HOST", "localhost"),
        port: configService.get<number>("DB_PORT", 5432),
        username: configService.get<string>("DB_USERNAME", "postgres"),
        password: configService.get<string>("DB_PASSWORD", "postgres"),
        database: configService.get<string>("DB_NAME", "nc_app"),
        entities: [__dirname + "/../../**/*.entity{.ts,.js}"],
        synchronize: configService.get<boolean>("DB_SYNCHRONIZE", false),
        logging: configService.get<boolean>("DB_LOGGING", false),
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}

