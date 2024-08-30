import {
	CreateIdentityCommand,
	CreateOrUpdateProjectMembershipCommand,
	CreatePersonCommand,
	CreatePersonTokenCommand,
	SavePersonTokenCommand,
} from '../commands'
import { Providers } from '../providers'
import { PersonQuery, PersonRow } from '../queries'
import { Project, ProjectSchemaResolver } from '../type'
import { InviteErrorCode, InviteMethod } from '../../schema'
import { TenantRole } from '../authorization'
import { UserMailer } from '../mailing'
import { createAppendMembershipVariables } from './membershipUtils'
import { Response, ResponseError, ResponseOk } from '../utils/Response'
import { DatabaseContext, TokenHash } from '../utils'
import { NoPassword, PasswordPlain } from '../dtos'
import { Acl } from '@contember/schema'
import { validateEmail } from '../utils/email'
import { INVITATION_RESET_TOKEN_EXPIRATION_MINUTES } from '../consts/expirations'

export interface InviteData {
	email: string
	name?: string
	project: Project
	memberships: readonly Acl.Membership[]
	noEmail?: boolean
	password?: string
	emailVariant?: string
	method?: InviteMethod
	passwordResetTokenHash?: TokenHash
}

export class InviteManager {
	constructor(
		private readonly providers: Providers,
		private readonly mailer: UserMailer,
		private readonly projectSchemaResolver: ProjectSchemaResolver,
	) { }

	async invite(
		dbContext: DatabaseContext,
		{
			email,
			project,
			name,
			memberships,
			method,
			emailVariant,
			noEmail = false,
			password,
			passwordResetTokenHash,
		}: InviteData,
	): Promise<InviteResponse> {
		if (!validateEmail(email.trim())) {
			return new ResponseError('INVALID_EMAIL_FORMAT', 'E-mail address is not in a valid format')
		}

		return await dbContext.transaction(async trx => {
			let person: Omit<PersonRow, 'roles'> | null = await trx.queryHandler.fetch(PersonQuery.byEmail(email))
			const isNew = !person
			let generatedPassword: string | null = null
			let resetToken: string | null = null
			if (!person) {
				const identityId = await trx.commandBus.execute(new CreateIdentityCommand([TenantRole.PERSON]))

				generatedPassword = password ??
					(method === 'CREATE_PASSWORD' ? (await this.providers.randomBytes(9)).toString('base64') : null)
				const passwordWrapper = generatedPassword !== null ? new PasswordPlain(generatedPassword) : NoPassword

				person = await trx.commandBus.execute(new CreatePersonCommand({
					identityId,
					email,
					name,
					password: passwordWrapper,
				}))
				if (method === 'RESET_PASSWORD') {
					const result = await trx.commandBus.execute(CreatePersonTokenCommand.createPasswordResetRequest(person.id, await this.getInviteExpiration(project.slug)))
					resetToken = result.token
				}
				if (passwordResetTokenHash) {
					await trx.commandBus.execute(new SavePersonTokenCommand(person.id, passwordResetTokenHash, 'password_reset', await this.getInviteExpiration(project.slug)))
				}
			}
			for (const membershipUpdate of createAppendMembershipVariables(memberships)) {
				await trx.commandBus.execute(new CreateOrUpdateProjectMembershipCommand(project.id, person.identity_id, membershipUpdate))
			}
			if (!noEmail) {
				const customMailOptions = {
					projectId: project.id,
					variant: emailVariant ?? '',
				}
				if (isNew) {
					await this.mailer.sendNewUserInvitedMail(
						trx,
						{ email, project: project.name, projectSlug: project.slug, password: generatedPassword, token: resetToken },
						customMailOptions,
					)
				} else {
					await this.mailer.sendExistingUserInvitedEmail(trx, { email, project: project.name, projectSlug: project.slug }, customMailOptions)
				}
			}
			return new ResponseOk(new InviteResult(person, isNew))
		})
	}

	private async getInviteExpiration(projectSlug: string): Promise<number> {
		const schema = await this.projectSchemaResolver.getSchema(projectSlug)

		return schema?.settings.tenant?.inviteExpirationMinutes ?? INVITATION_RESET_TOKEN_EXPIRATION_MINUTES
	}
}

export type InviteResponse = Response<InviteResult, InviteErrorCode>

export class InviteResult {
	constructor(public readonly person: Omit<PersonRow, 'roles'>, public readonly isNew: boolean) { }
}
