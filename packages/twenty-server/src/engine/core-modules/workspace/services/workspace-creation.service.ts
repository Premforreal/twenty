import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { Repository } from 'typeorm';
import { v4 } from 'uuid';

import { SubdomainManagerService } from 'src/engine/core-modules/domain/subdomain-manager/services/subdomain-manager.service';
import { OnboardingService } from 'src/engine/core-modules/onboarding/onboarding.service';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceManagerService } from 'src/engine/workspace-manager/workspace-manager.service';

@Injectable()
export class WorkspaceCreationService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly subdomainManagerService: SubdomainManagerService,
    private readonly userWorkspaceService: UserWorkspaceService,
    private readonly onboardingService: OnboardingService,
    private readonly workspaceManagerService: WorkspaceManagerService,
  ) {}

  async createWorkspaceForUser(user: UserEntity): Promise<{
    user: UserEntity;
    workspace: WorkspaceEntity;
  }> {
    // Generate subdomain based on user's email
    const subdomain = await this.subdomainManagerService.generateSubdomain({
      userEmail: user.email,
    });

    // Create workspace
    const workspaceToCreate = this.workspaceRepository.create({
      subdomain,
      displayName: '',
      inviteHash: v4(),
      activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
      logo: undefined, // Could be enhanced to fetch company logo
    });

    const workspace = await this.workspaceRepository.save(workspaceToCreate);

    console.group('📝 Creating user-workspace relationship');
    console.group(`   User ID: ${user.id}`);
    console.group(`   Workspace ID: ${workspace.id}`);

    // Create user-workspace relationship
    const userWorkspace = await this.userWorkspaceService.create({
      userId: user.id,
      workspaceId: workspace.id,
      isExistingUser: true,
      pictureUrl: undefined,
    });

    console.group(`✅ User-workspace created: ${userWorkspace.id}`);

    // Verify it was actually saved
    const verification =
      await this.userWorkspaceService.checkUserWorkspaceExists(
        user.id,
        workspace.id,
      );

    console.group(
      `🔍 Verification query result: ${verification ? verification.id : 'NOT FOUND'}`,
    );
    console.groupEnd();
    console.groupEnd();
    console.groupEnd();
    console.groupEnd();
    console.groupEnd();

    // Set up onboarding
    await this.onboardingService.setOnboardingInviteTeamPending({
      workspaceId: workspace.id,
      value: true,
    });

    // Trigger workspace initialization (creates roles, metadata, etc.)
    // This runs in the background and doesn't block the response
    this.workspaceManagerService
      .init({ workspaceId: workspace.id, userId: user.id })
      .catch(() => {
        // Silent fail - workspace will be initialized on first access
      });

    return { user, workspace };
  }
}
