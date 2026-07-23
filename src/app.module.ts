import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LedgerModule } from './ledger/ledger.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { IdentityModule } from './identity/identity.module';

@Module({
  imports: [LedgerModule, PrismaModule, IdentityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
