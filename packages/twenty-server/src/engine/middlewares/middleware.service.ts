import { Injectable } from '@nestjs/common';

import { type Request, type Response } from 'express';
import { type APP_LOCALES, SOURCE_LOCALE } from 'twenty-shared/translations';
import { isDefined } from 'twenty-shared/utils';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { WorkspaceAgnosticTokenService } from 'src/engine/core-modules/auth/token/services/workspace-agnostic-token.service';
import {
  type AuthContext,
  JwtTokenTypeEnum,
} from 'src/engine/core-modules/auth/types/auth-context.type';
import { getAuthExceptionRestStatus } from 'src/engine/core-modules/auth/utils/get-auth-exception-rest-status.util';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { ErrorCode } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { WorkspaceMetadataCacheService } from 'src/engine/metadata-modules/workspace-metadata-cache/services/workspace-metadata-cache.service';
import { INTERNAL_SERVER_ERROR } from 'src/engine/middlewares/constants/default-error-message.constant';
import {
  handleException,
  handleExceptionAndConvertToGraphQLError,
} from 'src/engine/utils/global-exception-handler.util';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { type CustomException } from 'src/utils/custom-exception';

@Injectable()
export class MiddlewareService {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly workspaceAgnosticTokenService: WorkspaceAgnosticTokenService,
    private readonly workspaceStorageCacheService: WorkspaceCacheStorageService,
    private readonly workspaceMetadataCacheService: WorkspaceMetadataCacheService,
    private readonly dataSourceService: DataSourceService,
    private readonly exceptionHandlerService: ExceptionHandlerService,
    private readonly jwtWrapperService: JwtWrapperService,
  ) {}

  public isTokenPresent(request: Request): boolean {
    const token = this.jwtWrapperService.extractJwtFromRequest()(request);

    return !!token;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public writeRestResponseOnExceptionCaught(res: Response, error: any) {
    const statusCode = this.getStatus(error);

    // capture and handle custom exceptions
    handleException({
      exception: error as CustomException,
      exceptionHandlerService: this.exceptionHandlerService,
      statusCode,
    });

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.write(
      JSON.stringify({
        statusCode,
        messages: [error?.message || INTERNAL_SERVER_ERROR],
        error: error?.code || ErrorCode.INTERNAL_SERVER_ERROR,
      }),
    );

    res.end();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public writeGraphqlResponseOnExceptionCaught(res: Response, error: any) {
    let errors;

    if (error instanceof AuthException) {
      try {
        const authFilter = new AuthGraphqlApiExceptionFilter();

        authFilter.catch(error);
      } catch (transformedError) {
        errors = [transformedError];
      }
    } else {
      errors = [
        handleExceptionAndConvertToGraphQLError(
          error as Error,
          this.exceptionHandlerService,
        ),
      ];
    }

    const statusCode = 200;

    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
    });

    res.write(
      JSON.stringify({
        errors,
      }),
    );

    res.end();
  }

  public async hydrateRestRequest(request: Request) {
    console.log('🔍 Hydrating REST request for path:', request.path);
    console.log(
      '🔍 Request headers:',
      request.headers.authorization
        ? 'Authorization header present'
        : 'No authorization header',
    );

    const token = this.jwtWrapperService.extractJwtFromRequest()(request);

    console.log(
      '🔍 Extracted token:',
      token ? 'Token present' : 'No token extracted',
    );

    if (!token) {
      console.log('❌ No token found, throwing auth exception');
      throw new AuthException(
        'Missing authentication token',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    // Try to decode the token to determine its type
    let decodedToken;

    try {
      decodedToken = this.jwtWrapperService.decode(token);
      console.log('✅ Token decoded successfully, type:', decodedToken.type);
    } catch {
      console.log('❌ Token decode failed');
      throw new AuthException(
        'Invalid token format',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    let data: AuthContext;

    // Try workspace-agnostic token validation first
    if (decodedToken.type === JwtTokenTypeEnum.WORKSPACE_AGNOSTIC) {
      console.log('🔄 Trying workspace-agnostic token validation');
      try {
        data = await this.workspaceAgnosticTokenService.validateToken(token);
        console.log(
          '✅ Workspace-agnostic token validated, user:',
          data.user?.id,
        );
      } catch {
        console.log(
          '⚠️ Workspace-agnostic validation failed, trying access token validation',
        );
        data = await this.accessTokenService.validateToken(token);
        console.log('✅ Access token validated, user:', data.user?.id);
      }
    } else {
      console.log(
        '🔄 Token type is not workspace-agnostic, using access token validation',
      );
      // For access tokens or other types, use access token service
      data = await this.accessTokenService.validateToken(token);
      console.log('✅ Access token validated, user:', data.user?.id);
    }

    console.log('🔄 Setting up workspace metadata');
    const metadataVersion = data.workspace
      ? await this.workspaceStorageCacheService.getMetadataVersion(
          data.workspace.id,
        )
      : undefined;

    if (metadataVersion === undefined && isDefined(data.workspace)) {
      await this.workspaceMetadataCacheService.recomputeMetadataCache({
        workspaceId: data.workspace.id,
      });
      throw new Error('Metadata cache version not found');
    }

    // Skip data source check for workspace creation (when no workspace exists yet)
    if (data.workspace) {
      console.log('🔄 Checking data sources for workspace:', data.workspace.id);
      const dataSourcesMetadata =
        await this.dataSourceService.getDataSourcesMetadataFromWorkspaceId(
          data.workspace.id,
        );

      if (!dataSourcesMetadata || dataSourcesMetadata.length === 0) {
        console.log('❌ No data sources found for workspace');
        throw new Error('No data sources found');
      }
      console.log('✅ Data sources found');
    } else {
      console.log('ℹ️ No workspace in token (expected for workspace creation)');
    }

    console.log('🔄 Binding data to request object');
    this.bindDataToRequestObject(data, request, metadataVersion);
    console.log('✅ Request hydration complete, user set:', !!request.user);
  }

  public async hydrateGraphqlRequest(request: Request) {
    if (!this.isTokenPresent(request)) {
      request.locale =
        (request.headers['x-locale'] as keyof typeof APP_LOCALES) ??
        SOURCE_LOCALE;

      return;
    }

    const data = await this.accessTokenService.validateTokenByRequest(request);
    const metadataVersion = data.workspace
      ? await this.workspaceStorageCacheService.getMetadataVersion(
          data.workspace.id,
        )
      : undefined;

    this.bindDataToRequestObject(data, request, metadataVersion);
  }

  private hasErrorStatus(error: unknown): error is { status: number } {
    return isDefined((error as { status: number })?.status);
  }

  private bindDataToRequestObject(
    data: AuthContext,
    request: Request,
    metadataVersion: number | undefined,
  ) {
    request.user = data.user;
    request.apiKey = data.apiKey;
    request.userWorkspace = data.userWorkspace;
    request.workspace = data.workspace;
    request.workspaceId = data.workspace?.id;
    request.workspaceMetadataVersion = metadataVersion;
    request.workspaceMemberId = data.workspaceMemberId;
    request.userWorkspaceId = data.userWorkspaceId;
    request.authProvider = data.authProvider;
    request.impersonationContext = data.impersonationContext;

    request.locale =
      data.userWorkspace?.locale ??
      (request.headers['x-locale'] as keyof typeof APP_LOCALES) ??
      SOURCE_LOCALE;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getStatus(error: any): number {
    if (this.hasErrorStatus(error)) {
      return error.status;
    }

    if (error instanceof AuthException) {
      return getAuthExceptionRestStatus(error);
    }

    return 500;
  }
}
