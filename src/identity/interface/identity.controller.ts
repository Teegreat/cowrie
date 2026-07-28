import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case';
import { LoginUserUseCase } from '../application/use-cases/login-user.use-case';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RefreshAccessTokenUseCase } from '../application/use-cases/refresh-access-token.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { ListUsersUseCase } from '../application/use-cases/list-users.use-case';
import { GetUserByIdUseCase } from '../application/use-cases/get-user-by-id.use-case';
import { UserRole } from '../domain/user';
import { RolesGuard } from './guards/role.guard';
import { Roles } from './decorators/role.decorators';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StepUpDto } from './dto/step-up.dto';
import { StepUpUseCase } from '../application/use-cases/step-up.use.case';
import { Throttle } from '@nestjs/throttler';

@ApiTags('identity')
@Controller('identity')
export class IdentityController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly refreshAccessToken: RefreshAccessTokenUseCase,
    private readonly logoutUser: LogoutUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly getUserById: GetUserByIdUseCase,
    private readonly stepUpUseCase: StepUpUseCase,
  ) {}

  @ApiOperation({
    summary: 'Register a new user account',
    description:
      'Role always defaults to CUSTOMER, regardless of any role field sent in the request.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5/minute, not the global 10
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.registerUser.execute(dto);
  }

  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Returns a short-lived access token and a revocable refresh token. Any previous session for this user is revoked first (single-active-session policy).',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5/minute, not the global 10
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.loginUser.execute(dto);
  }

  @ApiOperation({
    summary: 'Exchange a refresh token for a new token pair',
    description:
      'The refresh token supplied is immediately revoked (rotation) — it cannot be reused, even if this call succeeds.',
  })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.refreshAccessToken.execute(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Revoke a refresh token, ending that session' })
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    await this.logoutUser.execute(dto.refreshToken);
    return { success: true };
  }

  @ApiOperation({
    summary: "Get the current user's own account info",
    description:
      'Looked up fresh from the database on every call — never trusted from the token payload.',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string; email: string; role: UserRole }) {
    return user;
  }

  @ApiOperation({ summary: 'List all registered users (admin only)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('users')
  listAllUsers() {
    return this.listUsers.execute();
  }

  @ApiOperation({
    summary: "Get a user's account info by id",
    description:
      'A customer may only fetch their own id; an admin may fetch any.',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('users/:id')
  getUser(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; email: string; role: UserRole },
  ) {
    return this.getUserById.execute({
      requestedId: id,
      requestingUser: currentUser,
    });
  }

  @ApiOperation({
    summary: 'Re-verify your password for a short-lived step-up token',
    description:
      'Required before high-risk actions like revealing a full BVN. The returned token expires in 5 minutes.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5/minute, not the global 10
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('step-up')
  stepUp(@Body() dto: StepUpDto, @CurrentUser() user: { id: string }) {
    return this.stepUpUseCase.execute(user.id, dto.password);
  }
}
