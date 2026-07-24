import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { UserRepository } from 'src/identity/application/ports/user-repository.port';
import { User } from 'src/identity/domain/user';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { DomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    if (!record) return null;
    return User.existing(
      record.id,
      record.email,
      record.hashedPassword,
      record.role,
    );
  }

  async create(user: User): Promise<User> {
    try {
      const created = await this.prisma.user.create({
        data: { email: user.email, hashedPassword: user.hashedPassword },
      });
      return User.existing(
        created.id,
        created.email,
        created.hashedPassword,
        created.role,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException('Email already registered');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    if (!record) return null;
    return User.existing(
      record.id,
      record.email,
      record.hashedPassword,
      record.role,
    );
  }

  async findAll(): Promise<User[]> {
    const records = await this.prisma.user.findMany();
    return records.map((r) =>
      User.existing(r.id, r.email, r.hashedPassword, r.role),
    );
  }
}
