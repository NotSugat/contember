import { MutationResolvers, MutationUpdateProjectArgs, UpdateProjectResponse } from '../../../schema'
import { TenantResolverContext } from '../../TenantResolverContext'
import { PermissionActions, ProjectManager } from '../../../model'
import { createProjectNotFoundResponse } from '../../errorUtils'
import { Merger } from '@contember/config-loader'

export class UpdateProjectMutationResolver implements MutationResolvers {
	constructor(private readonly projectManager: ProjectManager) {}

	async updateProject(
		parent: any,
		args: MutationUpdateProjectArgs,
		context: TenantResolverContext,
	): Promise<UpdateProjectResponse> {
		const project = await this.projectManager.getProjectBySlug(context.db, args.projectSlug)
		await context.requireAccess({
			scope: await context.permissionContext.createProjectScope(project),
			action: PermissionActions.PROJECT_UPDATE,
			message: 'You are not allowed to update a project',
		})
		if (!project) {
			return createProjectNotFoundResponse('PROJECT_NOT_FOUND', args.projectSlug)
		}
		await this.projectManager.updateProject(context.db, project.id, {
			name: args.name || undefined,
			config: args.config !== undefined ? Merger.merge(args.mergeConfig ? project.config : {}, args.config as any) : undefined,
		})
		return { ok: true }
	}
}
