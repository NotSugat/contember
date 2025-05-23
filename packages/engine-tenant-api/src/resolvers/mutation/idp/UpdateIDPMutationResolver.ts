import { MutationResolvers, MutationUpdateIdpArgs, UpdateIdpResponse } from '../../../schema'
import { PermissionActions } from '../../../model'
import { IDPManager } from '../../../model/service/idp/IDPManager'
import { createErrorResponse } from '../../errorUtils'
import { TenantResolverContext } from '../../TenantResolverContext'

export class UpdateIDPMutationResolver implements MutationResolvers {
	constructor(private readonly idpManager: IDPManager) {
	}

	async updateIDP(parent: any, args: MutationUpdateIdpArgs, context: TenantResolverContext): Promise<UpdateIdpResponse> {
		await context.requireAccess({
			action: PermissionActions.IDP_UPDATE,
			message: 'You are not allowed to update IDP',
		})
		const result = await this.idpManager.updateIDP(context.db, args.identityProvider, {
			configuration: args.configuration as any,
			type: args.type ?? undefined,
			options: {
				autoSignUp: args.options?.autoSignUp ?? undefined,
				exclusive: args.options?.exclusive ?? undefined,
				initReturnsConfig: args.options?.initReturnsConfig ?? undefined,
			},
		}, args.mergeConfiguration ?? false)
		if (!result.ok) {
			return createErrorResponse(result.error, result.errorMessage)
		}

		return { ok: true }
	}
}
