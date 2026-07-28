import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenDomainException } from 'src/shared-kernel/domain-exception';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers['x-step-up-token'];

    if (!token || Array.isArray(token)) {
      throw new ForbiddenDomainException(
        'This action requires step-up verification',
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        type: string;
        sub: string;
      }>(token);
      // Not just "is this a valid JWT" — must be a step-up token AND
      // belong to the same user already authenticated on this request.
      if (payload.type !== 'step-up' || payload.sub !== request.user?.id) {
        throw new Error('mismatch');
      }
      return true;
    } catch {
      throw new ForbiddenDomainException(
        'Step-up verification expired or invalid — please re-authenticate',
      );
    }
  }
}
