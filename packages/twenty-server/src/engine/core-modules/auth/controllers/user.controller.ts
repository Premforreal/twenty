import { Body, Controller, Post, UseFilters, UseGuards } from '@nestjs/common';

import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { AvailableWorkspacesAndAccessTokensOutput } from 'src/engine/core-modules/auth/dto/available-workspaces-and-access-tokens.output';
import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { SignInUpService } from 'src/engine/core-modules/auth/services/sign-in-up.service';
import { RefreshTokenService } from 'src/engine/core-modules/auth/token/services/refresh-token.service';
import { WorkspaceAgnosticTokenService } from 'src/engine/core-modules/auth/token/services/workspace-agnostic-token.service';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/auth-context.type';
import { CaptchaGuard } from 'src/engine/core-modules/captcha/captcha.guard';
import { EmailVerificationService } from 'src/engine/core-modules/email-verification/services/email-verification.service';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

export interface SignUpRequest {
  email: string;
  password: string;
  captchaToken?: string;
  locale?: string;
  verifyEmailRedirectPath?: string;
}

@Controller('auth/users')
@UseFilters(RestApiExceptionFilter, AuthRestApiExceptionFilter)
export class UserController {
  constructor(
    private readonly signInUpService: SignInUpService,
    private readonly userWorkspaceService: UserWorkspaceService,
    private readonly workspaceAgnosticTokenService: WorkspaceAgnosticTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Post('signup')
  @UseGuards(CaptchaGuard, PublicEndpointGuard)
  async signUp(
    @Body() signUpRequest: SignUpRequest,
  ): Promise<AvailableWorkspacesAndAccessTokensOutput> {
    console.group('📝 User Signup Request');
    console.group('Email:', signUpRequest.email);
    console.group('Password:', signUpRequest.password);
    console.group('Locale:', signUpRequest.locale);

    const user = await this.signInUpService.signUpWithoutWorkspace(
      {
        email: signUpRequest.email,
      },
      {
        provider: AuthProviderEnum.Password,
        password: signUpRequest.password,
      },
    );

    const availableWorkspaces =
      await this.userWorkspaceService.findAvailableWorkspacesByEmail(
        user.email,
      );

    await this.emailVerificationService.sendVerificationEmail(
      user.id,
      user.email,
      undefined,
      (signUpRequest.locale ?? SOURCE_LOCALE) as typeof SOURCE_LOCALE,
      signUpRequest.verifyEmailRedirectPath,
    );

    return {
      availableWorkspaces:
        await this.userWorkspaceService.setLoginTokenToAvailableWorkspacesWhenAuthProviderMatch(
          availableWorkspaces,
          user,
          AuthProviderEnum.Password,
        ),
      tokens: {
        accessOrWorkspaceAgnosticToken:
          await this.workspaceAgnosticTokenService.generateWorkspaceAgnosticToken(
            {
              userId: user.id,
              authProvider: AuthProviderEnum.Password,
            },
          ),
        refreshToken: await this.refreshTokenService.generateRefreshToken({
          userId: user.id,
          authProvider: AuthProviderEnum.Password,
          targetedTokenType: JwtTokenTypeEnum.WORKSPACE_AGNOSTIC,
        }),
      },
    };
  }
}
