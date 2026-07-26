import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CreateProfileUseCase } from '../application/use-cases/create-profile.use-case';
import { GetProfileUseCase } from '../application/use-cases/get-profile.use-case';
import { UpgradeToTier2UseCase } from '../application/use-cases/upgrade-to-tier2.use-case';
import { UpgradeToTier3UseCase } from '../application/use-cases/upgrade-to-tier3.use-case';
import { CreateProfileDto } from './dto/create-profile.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { UpgradeTier2Dto } from './dto/upgrade-tier2.dto';
import { UpgradeTier3Dto } from './dto/upgrade-tier3.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('profile')
@ApiBearerAuth()
@Controller('identity/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly createProfile: CreateProfileUseCase,
    private readonly getProfile: GetProfileUseCase,
    private readonly upgradeToTier2: UpgradeToTier2UseCase,
    private readonly upgradeToTier3: UpgradeToTier3UseCase,
  ) {}

  @Post()
  create(@Body() dto: CreateProfileDto, @CurrentUser() user: { id: string }) {
    return this.createProfile.execute({
      userId: user.id,
      firstName: dto.firstName,
      middleName: dto.middleName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      dateOfBirth: new Date(dto.dateOfBirth),
      bvn: dto.bvn,
    });
  }

  @Get()
  get(@CurrentUser() user: { id: string }) {
    return this.getProfile.execute(user.id);
  }

  @Patch('tier2')
  toTier2(@Body() dto: UpgradeTier2Dto, @CurrentUser() user: { id: string }) {
    return this.upgradeToTier2.execute({ userId: user.id, nin: dto.nin });
  }

  @Patch('tier3')
  toTier3(@Body() dto: UpgradeTier3Dto, @CurrentUser() user: { id: string }) {
    return this.upgradeToTier3.execute({
      userId: user.id,
      address: dto.address,
    });
  }
}
