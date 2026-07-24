import { Injectable } from '@nestjs/common';
import { UserRepository } from '../ports/user-repository.port';
import { PublicUserProfile } from 'src/identity/domain/user';

@Injectable()
export class ListUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(): Promise<PublicUserProfile[]> {
    const users = await this.userRepository.findAll();
    return users.map((u) => u.toPublicProfile());
  }
}
