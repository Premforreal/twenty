import {
    type ExecutionContext,
    ForbiddenException,
    createParamDecorator,
} from '@nestjs/common';

import { getRequest } from 'src/utils/extract-request';

interface DecoratorOptions {
  allowUndefined?: boolean;
}

export const AuthUser = createParamDecorator(
  (options: DecoratorOptions | undefined, ctx: ExecutionContext) => {
    console.group('🎯 AuthUser decorator called');
    const request = getRequest(ctx);

    console.group('📋 Request object:', {
      hasUser: !!request.user,
      userId: request.user?.id,
      userEmail: request.user?.email,
      allowUndefined: options?.allowUndefined,
    });

    if (!options?.allowUndefined && !request.user) {
      console.group('❌ Throwing ForbiddenException - no user found');
      throw new ForbiddenException(
        "You're not authorized to do this. " +
          "Note: This endpoint requires a user and won't work with just an API key.",
      );
    }

    console.group('✅ Returning user:', request.user?.id);

    return request.user;
  },
);
