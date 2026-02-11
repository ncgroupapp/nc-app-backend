import { createApp } from '../src/main';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

let app: NestFastifyApplication;

export default async function handler(req: any, res: any) {
  if (!app) {
    app = await createApp();
    await app.init();
  }

  // Fastify needs to be ready before handling requests
  await app.getHttpAdapter().getInstance().ready();

  // Forward the request to Fastify
  app.getHttpAdapter().getInstance().server.emit('request', req, res);
}
