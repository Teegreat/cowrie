import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'src/identity/domain/user';
import { ROLES_KEY } from '../decorators/role.decorators';
import { ForbiddenDomainException } from 'src/shared-kernel/domain-exception';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; role: UserRole };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenDomainException('Insufficient role for this action');
    }
    return true;
  }
}
