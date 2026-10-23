import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Same URLs as the Next.js routes, so Next.js can rewrite /api/<area> here unchanged.
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(config.PORT);
}
void bootstrap();
