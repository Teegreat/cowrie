import { Global, Module } from '@nestjs/common';
import { TransactionManager } from './transaction-manager.port';
import { PrismaTransactionManager } from './prisma-transaction-manager';

// @Global() so every feature module can inject TransactionManager without
// re-importing this module, the same way PrismaService is available everywhere.
@Global()
@Module({
  providers: [
    { provide: TransactionManager, useClass: PrismaTransactionManager },
  ],
  exports: [TransactionManager],
})
export class TransactionModule {}
