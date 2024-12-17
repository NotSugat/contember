import { executeTenantTest } from '../../../src/testTenant'
import { SQL } from '../../../src/tags'
import { testUuid } from '../../../src/testUuid'
import { selectMembershipsSql } from './sql/selectMembershipsSql'
import { getPersonByEmailSql } from './sql/getPersonByEmailSql'
import { test } from 'bun:test'
import { getIdentityProjectsSql } from './sql/getIdentityProjectsSql'
import { createSessionTokenMutation } from './gql/createSessionToken'
import { createSessionKeySql } from './sql/createSessionKeySql'

test('create session key', async () => {
	const email = 'john@doe.com'
	const identityId = testUuid(2)
	const personId = testUuid(7)
	const projectId = testUuid(10)
	const apiKeyId = testUuid(1)
	await executeTenantTest({
		query: createSessionTokenMutation({ email }, { withData: true }),
		executes: [
			getPersonByEmailSql({ email, response: { personId, identityId, password: 'aaa', roles: [] } }),
			createSessionKeySql({ apiKeyId: apiKeyId, identityId: identityId }),
			getIdentityProjectsSql({ identityId: identityId, projectId: projectId }),
			selectMembershipsSql({
				identityId: identityId,
				projectId,
				membershipsResponse: [{ role: 'editor', variables: [{ name: 'locale', values: ['cs'] }] }],
			}),
			{
				sql: SQL`SELECT "id",
						         "email",
						         "identity_id"
					         FROM "tenant"."person"
					         WHERE "id" = ?`,
				parameters: [personId],
				response: { rows: [{ id: personId, email: email }] },
			},
			{
				sql: SQL`SELECT "project"."id",
						         "project"."name",
						         "project"."slug",
						         "project"."config"
					         FROM "tenant"."project"
						              INNER JOIN "tenant"."project_member" AS "project_member" ON "project_member"."project_id" = "project"."id"
					         WHERE "project_member"."identity_id" = ?`,
				parameters: [identityId],
				response: { rows: [{ id: projectId, name: 'foo' }] },
			},
		],
		return: {
			data: {
				createSessionToken: {
					ok: true,
					error: null,
					result: {
						person: {
							id: personId,
							identity: {
								projects: [
									{
										project: {
											slug: 'foo',
										},
										memberships: [
											{
												role: 'editor',
											},
										],
									},
								],
							},
						},
						token: '0000000000000000000000000000000000000000',
					},
				},
			},
		},
	})
})

