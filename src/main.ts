// Setup global polyfills before importing any NestJS modules
import "./setup-globals";

import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import fastifyCors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "@/app/app.module";
import { TransformInterceptor } from "@/contexts/shared/interceptors/transform.interceptor";
import { AllExceptionsFilter } from "@/contexts/shared/filters/all-exceptions.filter";

export async function createApp() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(multipart);

  const configService = app.get(ConfigService);

  const front_url = configService.get<string>(
    "FRONT_URL",
    "https://nc-app-kappa.vercel.app",
  );


  // Configuración CORS
  await app
    .getHttpAdapter()
    .getInstance()
    .register(fastifyCors, {
      origin: [
        "http://localhost:3001",
        "http://localhost:4200",
        "http://localhost:4201",
        "http://localhost:8100",
        "http://127.0.0.1:55376",
        front_url
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
      credentials: true,
    });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle("Corna App")
    .setDescription("The Corna App API description")
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("corna")
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, documentFactory);

  return app;
}

async function bootstrap() {
  const app = await createApp();
  const configService = app.get(ConfigService);
  const port = configService.get<string>("PORT", "3000");

  await app.listen(port, "0.0.0.0");

  const logger = app.get(Logger);
  logger.log(`App is ready and listening on port ${port} 🚀`);
}

if (require.main === module) {
  bootstrap().catch(handleError);
}

function handleError(error: unknown) {
  // eslint-disable-next-line no-console
  console.error(error);
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
}

process.on("uncaughtException", handleError);
