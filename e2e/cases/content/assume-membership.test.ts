import { test } from 'bun:test'
import { createTester, gql } from '../../src/tester'
import { createSchema, SchemaDefinition as def } from '@contember/schema-definition'

namespace TagModel {
	export class Tag {
		label = def.stringColumn()
	}
}


test('Content API: assume membership', async () => {
	const tester = await createTester(createSchema(TagModel, schema => {
		return {
			...schema,
			acl: {
				roles: {
					test: {
						entities: {},
						variables: {},
						content: {
							assumeMembership: {
								admin: {},
							},
						},
					},
				},
			},
		}
	}))

	const email = `john+${Date.now()}@doe.com`
	const identityId = await tester.tenant.signUp(email)
	const authKey = await tester.tenant.signIn(email)
	await tester.tenant.addProjectMember(identityId, tester.projectSlug, { role: 'test', variables: [] })

	await tester(
		gql`
			query {
				listTag {
					id
				}
			}
		`,
		{ authorizationToken: authKey },
	)
		.expect(400)


	await tester(
		gql`
			query {
				listTag {
					id
				}
			}
		`,
		{ authorizationToken: authKey },
	)
		.set('X-Contember-assume-membership', JSON.stringify({ memberships: [{ role: 'admin', variables: [] }] }))
		.expect({ data: { listTag: [] } })
		.expect(200)
})
