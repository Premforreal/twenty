import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { msg } from '@lingui/core/macro';

import {
  CaptchaException,
  CaptchaExceptionCode,
} from 'src/engine/core-modules/captcha/captcha.exception';
import { CaptchaService } from 'src/engine/core-modules/captcha/captcha.service';
import { MetricsService } from 'src/engine/core-modules/metrics/metrics.service';
import { MetricsKeys } from 'src/engine/core-modules/metrics/types/metrics-keys.type';

@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(
    private captchaService: CaptchaService,
    private metricsService: MetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let token: string | undefined;

    // Check if this is a GraphQL context
    try {
      const ctx = GqlExecutionContext.create(context);
      const args = ctx.getArgs();

      token = args?.captchaToken;
    } catch {
      // Not a GraphQL context, try REST context
      const request = context.switchToHttp().getRequest();

      token = request?.body?.captchaToken;
    }

    const result = await this.captchaService.validate(token || '');

    if (result.success) {
      return true;
    } else {
      await this.metricsService.incrementCounter({
        key: MetricsKeys.InvalidCaptcha,
        eventId: token || '',
        ...(result.error ? { attributes: { error: result.error } } : {}),
      });

      throw new CaptchaException(
        'Invalid Captcha, please try another device',
        CaptchaExceptionCode.INVALID_CAPTCHA,
        {
          userFriendlyMessage: msg`Invalid Captcha, please try another device`,
        },
      );
    }
  }
}
