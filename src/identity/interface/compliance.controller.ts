import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/role.guard';
import { Roles } from './decorators/role.decorators';
import { ListComplianceCaseUseCase } from '../application/use-cases/list-compliance-case.use-case';
import { ResolveComplianceCaseDto } from './dto/resolve-compliance-case.dto';
import { ResolveComplianceCaseUseCase } from '../application/use-cases/resolve-complaince-case.use-case';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('compliance')
@ApiBearerAuth()
@Controller('identity/compliance-cases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ComplainceController {
  constructor(
    private readonly listCases: ListComplianceCaseUseCase,
    private readonly resolveCase: ResolveComplianceCaseUseCase,
  ) {}

  @Get()
  list() {
    return this.listCases.execute();
  }

  @Patch(':id/resolve')
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveComplianceCaseDto,
    @CurrentUser() admin: { id: string },
  ) {
    await this.resolveCase.execute(id, dto.notes, dto.disposition, admin.id);
    return { success: true };
  }
}
