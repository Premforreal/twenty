import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { type Observable } from 'rxjs';

@Injectable()
export class UserAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    console.group('🛡️ UserAuthGuard.canActivate called');

    try {
      // Try GraphQL context first
      const ctx = GqlExecutionContext.create(context);
      const request = ctx.getContext().req;

      console.group('🛡️ GraphQL context detected');
      console.group('request.user exists:', !!request.user);
      console.group('request.user value:', request.user);

      const result = request.user !== undefined;

      console.group('🛡️ Guard result (GraphQL):', result);

      return result;
    } catch {
      // Fall back to REST context
      console.group('⚠️ GraphQL context failed, trying REST context');

      const request = context.switchToHttp().getRequest();

      console.group('request.user exists:', !!request.user);
      console.group('request.user value:', request.user);

      const result = request.user !== undefined;

      console.group('🛡️ Guard result (REST):', result);

      return result;
    }
  }
}
