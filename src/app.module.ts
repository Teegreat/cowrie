import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LedgerModule } from './ledger/ledger.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';

@Module({
  imports: [LedgerModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
