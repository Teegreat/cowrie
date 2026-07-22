import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({
      adapter,
      // Event-based logging (rather than the simpler array-of-strings
      // form) gives us duration per query, not just the SQL text —
      // duration is what actually tells you whether an index helped.
      log: [{ level: 'query', emit: 'event' }],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.$on('query' as never, (event: { query: string; duration: number }) => {
      this.logger.debug(`${event.duration}ms ${event.query}`);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
