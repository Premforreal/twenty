import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { type ApiKeyEntity } from 'src/engine/core-modules/api-key/api-key.entity';
import { ApiKeyService } from 'src/engine/core-modules/api-key/api-key.service';
import { CreateApiKeyInput } from 'src/engine/core-modules/api-key/dtos/create-api-key.dto';
import { UpdateApiKeyInput } from 'src/engine/core-modules/api-key/dtos/update-api-key.dto';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { RoleService } from 'src/engine/metadata-modules/role/role.service';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';

/**
 * rest/apiKeys is deprecated, use rest/metadata/apiKeys instead
 * rest/apiKeys will be removed in the future
 */
@Controller(['rest/apiKeys', 'rest/metadata/apiKeys'])
@UseFilters(RestApiExceptionFilter)
export class ApiKeyController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly roleService: RoleService,
    private readonly userRoleService: UserRoleService,
    private readonly userWorkspaceService: UserWorkspaceService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
  async findAll(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<ApiKeyEntity[]> {
    return this.apiKeyService.findActiveByWorkspaceId(workspace.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
  async findOne(
    @Param('id') id: string,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<ApiKeyEntity | null> {
    return this.apiKeyService.findById(id, workspace.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
  async create(
    @Body() createApiKeyDto: CreateApiKeyInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<ApiKeyEntity> {
    return this.apiKeyService.create({
      name: createApiKeyDto.name,
      expiresAt: new Date(createApiKeyDto.expiresAt),
      revokedAt: createApiKeyDto.revokedAt
        ? new Date(createApiKeyDto.revokedAt)
        : undefined,
      workspaceId: workspace.id,
      roleId: createApiKeyDto.roleId,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateApiKeyDto: UpdateApiKeyInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<ApiKeyEntity | null> {
    const updateData: QueryDeepPartialEntity<ApiKeyEntity> = {};

    if (updateApiKeyDto.name !== undefined)
      updateData.name = updateApiKeyDto.name;
    if (updateApiKeyDto.expiresAt !== undefined)
      updateData.expiresAt = new Date(updateApiKeyDto.expiresAt);
    if (updateApiKeyDto.revokedAt !== undefined) {
      updateData.revokedAt = updateApiKeyDto.revokedAt
        ? new Date(updateApiKeyDto.revokedAt)
        : undefined;
    }

    return this.apiKeyService.update(id, workspace.id, updateData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
  async remove(
    @Param('id') id: string,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<ApiKeyEntity | null> {
    return this.apiKeyService.revoke(id, workspace.id);
  }

  /**
   * Create API key for a workspace using workspace-agnostic token
   * Used during initial workspace setup
   */
  @Post('for-workspace/:workspaceId')
  @UseGuards(UserAuthGuard)
  async createForWorkspace(
    @AuthUser() user: UserEntity,
    @Param('workspaceId') workspaceId: string,
    @Body() body: { name?: string; expiresInDays?: number } = {},
  ) {
    console.log('🔑 Creating API key for workspace:', workspaceId);
    console.log('👤 User ID:', user.id);

    // Wait for user-workspace relationship to be created
    let userWorkspace = null;
    let userWorkspaceRetries = 0;
    const maxUserWorkspaceRetries = 20;
    const userWorkspaceDelayMs = 500;

    while (!userWorkspace && userWorkspaceRetries < maxUserWorkspaceRetries) {
      userWorkspace = await this.userWorkspaceService.checkUserWorkspaceExists(
        user.id,
        workspaceId,
      );

      console.log(
        `🔍 Retry ${userWorkspaceRetries + 1}/${maxUserWorkspaceRetries}: User-workspace found: ${!!userWorkspace}`,
      );

      if (!userWorkspace) {
        await new Promise((resolve) =>
          setTimeout(resolve, userWorkspaceDelayMs),
        );
        userWorkspaceRetries++;
      }
    }

    if (!userWorkspace) {
      throw new Error(
        `User-workspace relationship not found after ${maxUserWorkspaceRetries} retries`,
      );
    }

    console.log('✅ Found user-workspace relationship:', userWorkspace.id);

    // Wait for workspace initialization and retry fetching roles
    let adminRole = null;
    let retries = 0;
    const maxRetries = 60; // Increase to 60 retries (30 seconds total)
    const delayMs = 500;

    while (!adminRole && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const roles = await this.roleService.getWorkspaceRoles(workspaceId);

      adminRole = roles.find((r) => r.label === 'Admin');
      retries++;
    }

    if (!adminRole) {
      throw new Error(
        `Admin role not found for workspace after ${maxRetries} retries`,
      );
    }

    console.log('✅ Found Admin role:', adminRole.id);

    // Get or ensure user-workspace relationship exists
    console.log('🔍 Checking user-workspace relationship...');
    const finalUserWorkspace =
      await this.userWorkspaceService.checkUserWorkspaceExists(
        user.id,
        workspaceId,
      );

    console.log('📋 User-workspace result:', finalUserWorkspace);

    if (!finalUserWorkspace) {
      throw new Error('User is not a member of this workspace');
    }

    // Assign admin role to user if they don't have one
    await this.userRoleService.assignRoleToUserWorkspace({
      workspaceId,
      userWorkspaceId: finalUserWorkspace.id,
      roleId: adminRole.id,
    });

    // Set expiration (default 100 years)
    const expiresInDays = body.expiresInDays || 36500;
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create the API key
    const apiKey = await this.apiKeyService.create({
      name: body.name || 'API Key',
      expiresAt,
      workspaceId,
      roleId: adminRole.id,
    });

    // Generate the token
    const tokenData = await this.apiKeyService.generateApiKeyToken(
      workspaceId,
      apiKey.id,
      expiresAt,
    );

    if (!tokenData) {
      throw new Error('Failed to generate API key token');
    }

    return {
      id: apiKey.id,
      name: apiKey.name,
      token: tokenData.token,
      expiresAt: apiKey.expiresAt.toISOString(),
    };
  }
}
