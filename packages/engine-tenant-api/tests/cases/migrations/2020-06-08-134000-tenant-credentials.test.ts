import migration from '../../../src/migrations/2020-06-08-134000-tenant-credentials'
import { createMigrationBuilder } from '@contember/database-migrations'
import { test, expect } from 'bun:test'

let uuidNum = 0
export const testUuid = () => '123e4567-e89b-12d3-a456-' + (uuidNum++).toString().padStart(12, '0')
test('generate sql with root token and login token', async () => {
	const builder = createMigrationBuilder()
	await migration(builder, {
		getCredentials: async () => ({
			loginTokenHash: '936a185caaa266bb9cbe981e9e05cb78cd732b0b3280eb944412bb6f8f8f07af',
			rootTokenHash: 'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2',
		}),
		providers: {
			uuid: testUuid,
		},
	})
	expect(
		builder.getSql(),
	).toEqual(
		`
			WITH identity AS (
			    INSERT INTO identity(id, parent_id, roles, description, created_at)
				VALUES ($pga$123e4567-e89b-12d3-a456-000000000000$pga$, NULL, '["login"]'::JSONB, 'Login key', now()) RETURNING id
			)
			INSERT INTO api_key (id, token_hash, type, identity_id, disabled_at, expires_at, expiration, created_at)
			SELECT $pga$123e4567-e89b-12d3-a456-000000000001$pga$, $pga$936a185caaa266bb9cbe981e9e05cb78cd732b0b3280eb944412bb6f8f8f07af$pga$, 'permanent', identity.id, NULL, NULL, NULL, now()
			FROM identity
			;

			WITH identity AS (
				INSERT INTO identity(id, parent_id, roles, description, created_at)
				VALUES (
						$pga$123e4567-e89b-12d3-a456-000000000002$pga$,
						NULL,
						'["super_admin"]'::JSONB
							|| (CASE WHEN NULL IS NOT NULL THEN '["person"]'::JSONB ELSE '[]'::JSONB END),
						'Superadmin',
						now()
					) RETURNING id
			),
			person AS (
				INSERT INTO person(id, email, password_hash, identity_id)
				SELECT $pga$123e4567-e89b-12d3-a456-000000000003$pga$, NULL, NULL, identity.id
				FROM identity
				WHERE NULL IS NOT NULL
			    RETURNING id
			),
			api_key AS (
				INSERT INTO api_key (id, token_hash, type, identity_id, disabled_at, expires_at, expiration, created_at)
				SELECT $pga$123e4567-e89b-12d3-a456-000000000004$pga$, $pga$c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2$pga$, 'permanent', identity.id, NULL, NULL, NULL, now()
				FROM identity WHERE $pga$c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2$pga$ IS NOT NULL
			    RETURNING id
			)
			SELECT * FROM person, api_key
		;
`,
	)
})

test('generate sql with both root user and token', async () => {
	const builder = createMigrationBuilder()
	await migration(builder, {
		getCredentials: async () => ({
			rootPasswordBcrypted: 'pwd-bcrypted',
			rootTokenHash: 'd96f62ea0f2f543aa7822a58114f75dbcc05bdf970fb15eb55eea836a1439e43',
			rootEmail: 'john@doe.com',
		}),
		providers: {
			uuid: testUuid,
		},
	})
	expect(
		builder.getSql(),
	).toEqual(
		`
			WITH identity AS (
				INSERT INTO identity(id, parent_id, roles, description, created_at)
				VALUES (
						$pga$123e4567-e89b-12d3-a456-000000000005$pga$,
						NULL,
						'["super_admin"]'::JSONB
							|| (CASE WHEN $pga$john@doe.com$pga$ IS NOT NULL THEN '["person"]'::JSONB ELSE '[]'::JSONB END),
						'Superadmin',
						now()
					) RETURNING id
			),
			person AS (
				INSERT INTO person(id, email, password_hash, identity_id)
				SELECT $pga$123e4567-e89b-12d3-a456-000000000006$pga$, $pga$john@doe.com$pga$, $pga$pwd-bcrypted$pga$, identity.id
				FROM identity
				WHERE $pga$john@doe.com$pga$ IS NOT NULL
			    RETURNING id
			),
			api_key AS (
				INSERT INTO api_key (id, token_hash, type, identity_id, disabled_at, expires_at, expiration, created_at)
				SELECT $pga$123e4567-e89b-12d3-a456-000000000007$pga$, $pga$d96f62ea0f2f543aa7822a58114f75dbcc05bdf970fb15eb55eea836a1439e43$pga$, 'permanent', identity.id, NULL, NULL, NULL, now()
				FROM identity WHERE $pga$d96f62ea0f2f543aa7822a58114f75dbcc05bdf970fb15eb55eea836a1439e43$pga$ IS NOT NULL
			    RETURNING id
			)
			SELECT * FROM person, api_key
		;
`,
	)
})
