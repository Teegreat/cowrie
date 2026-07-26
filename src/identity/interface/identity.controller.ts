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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

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
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.registerUser.execute(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.loginUser.execute(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.refreshAccessToken.execute(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    await this.logoutUser.execute(dto.refreshToken);
    return { success: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string; email: string; role: UserRole }) {
    return user;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('users')
  listAllUsers() {
    return this.listUsers.execute();
  }

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
}
