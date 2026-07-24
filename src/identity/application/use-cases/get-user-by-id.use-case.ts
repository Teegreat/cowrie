import { Injectable } from '@nestjs/common';
import { UserRepository } from '../ports/user-repository.port';
import { PublicUserProfile, UserRole } from 'src/identity/domain/user';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
} from 'src/shared-kernel/domain-exception';

@Injectable()
export class GetUserByIdUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: {
    requestedId: string;
    requestingUser: { id: string; role: UserRole };
  }): Promise<PublicUserProfile> {
    const isSelf = input.requestedId === input.requestingUser.id;
    const isAdmin = input.requestingUser.role === 'ADMIN';

    if (!isSelf && !isAdmin) {
      throw new ForbiddenDomainException('You can only view your own profile');
    }

    const user = await this.userRepository.findById(input.requestedId);
    if (!user) {
      throw new NotFoundDomainException('User not found');
    }
    return user.toPublicProfile();
  }
}
