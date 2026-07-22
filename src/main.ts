import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips any property not declared on the DTO
      forbidNonWhitelisted: true, // rejects the request instead of silently stripping — catches a client trying to sneak in an extra field
      transform: true, // turns the raw JSON body into a real CheckMoneyDto instance, so @IsInt() etc. run against actual typed values
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
