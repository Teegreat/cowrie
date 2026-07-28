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
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { StepUpGuard } from './guards/step-up.guard';
import { RevealBvnUseCase } from '../application/use-cases/reveal-bvn.use-case';

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
    private readonly revealBvn: RevealBvnUseCase,
  ) {}

  @ApiOperation({
    summary: 'Create your KYC profile (Tier 1)',
    description:
      'Screens the submitted name/DOB against a sanctions/PEP gateway before creating the profile. Requires a BVN.',
  })
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

  @ApiOperation({
    summary: 'Get your own KYC profile',
    description: 'BVN and NIN are returned masked.',
  })
  @Get()
  get(@CurrentUser() user: { id: string }) {
    return this.getProfile.execute(user.id);
  }

  @ApiOperation({ summary: 'Upgrade to Tier 2 by submitting a NIN' })
  @Patch('tier2')
  toTier2(@Body() dto: UpgradeTier2Dto, @CurrentUser() user: { id: string }) {
    return this.upgradeToTier2.execute({ userId: user.id, nin: dto.nin });
  }

  @ApiOperation({
    summary: 'Upgrade to Tier 3 by submitting a proof of address',
    description:
      'Only allowed from Tier 2 — Tier 3 cannot be reached directly from Tier 1.',
  })
  @Patch('tier3')
  toTier3(@Body() dto: UpgradeTier3Dto, @CurrentUser() user: { id: string }) {
    return this.upgradeToTier3.execute({
      userId: user.id,
      address: dto.address,
    });
  }

  @ApiOperation({
    summary: 'Reveal your full, unmasked BVN',
    description:
      'Requires step-up verification in addition to normal authentication.',
  })
  @ApiHeader({
    name: 'X-Step-Up-Token',
    description:
      'A step-up token obtained from POST /identity/step-up, valid for 5 minutes.',
    required: true,
  })
  @UseGuards(JwtAuthGuard, StepUpGuard)
  @Get('bvn/reveal')
  bvnReveal(@CurrentUser() user: { id: string }) {
    return this.revealBvn.execute(user.id);
  }
}
