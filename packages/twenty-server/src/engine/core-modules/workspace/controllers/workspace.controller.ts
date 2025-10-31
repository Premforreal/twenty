import { Controller, Post, UseFilters, UseGuards } from '@nestjs/common';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceCreationService } from 'src/engine/core-modules/workspace/services/workspace-creation.service';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';

export interface CreateWorkspaceResponse {
  workspace: {
    id: string;
    workspaceUrls: {
      subdomainUrl: string;
      customUrl: string | null;
    };
  };
  user: {
    id: string;
    email: string;
  };
}

@Controller('rest/workspaces')
@UseFilters(RestApiExceptionFilter, AuthRestApiExceptionFilter)
export class WorkspaceController {
  constructor(
    private readonly workspaceCreationService: WorkspaceCreationService,
  ) {}

  @Post()
  @UseGuards(UserAuthGuard)
  async createWorkspace(
    @AuthUser() user: UserEntity,
  ): Promise<CreateWorkspaceResponse> {
    console.group('🚀 WORKSPACE CONTROLLER: Method called!');
    console.group('👤 User from token:', user?.id, user?.email);

    console.group('🏗️ Creating workspace for user:', user.id);

    const { user: updatedUser, workspace } =
      await this.workspaceCreationService.createWorkspaceForUser(user);

    console.group('✅ Workspace created:', workspace.id);
    console.group('👤 User in response:', updatedUser.id, updatedUser.email);

    return {
      workspace: {
        id: workspace.id,
        workspaceUrls: {
          subdomainUrl: `http://${workspace.subdomain}.localhost:3001`,
          customUrl: workspace.customDomain
            ? `https://${workspace.customDomain}`
            : null,
        },
      },
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
      },
    };
  }
}
