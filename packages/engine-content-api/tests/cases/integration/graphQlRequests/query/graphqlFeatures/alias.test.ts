import { test } from 'bun:test'
import { execute } from '../../../../../src/test'
import { SchemaBuilder } from '@contember/schema-definition'
import { Model } from '@contember/schema'
import { GQL, SQL } from '../../../../../src/tags'
import { testUuid } from '../../../../../src/testUuid'

test('Field alias', async () => {
	await execute({
		schema: new SchemaBuilder()
			.entity('Post', entity => entity.column('title', column => column.type(Model.ColumnType.String)))
			.buildSchema(),
		query: GQL`
        query {
          getPost(by: {id: "${testUuid(1)}"}) {
            heading: title
          }
        }`,
		executes: [
			{
				sql: SQL`select
                       "root_"."title" as "root_heading",
                       "root_"."id" as "root_id"
                     from "public"."post" as "root_"
                     where "root_"."id" = ?`,
				response: { rows: [{ root_heading: 'Hello' }] },
				parameters: [testUuid(1)],
			},
		],
		return: {
			data: {
				getPost: {
					heading: 'Hello',
				},
			},
		},
	})
})

test('aliases', async () => {
	await execute({
		schema: new SchemaBuilder()
			.entity('Author', e => e.column('name', c => c.type(Model.ColumnType.String)))
			.buildSchema(),
		permissions: {
			Author: {
				predicates: {
					name_eq: {
						name: { eq: 'John' },
					},
				},
				operations: {
					read: {
						id: true,
						name: true,
					},
					update: {
						name: 'name_eq',
					},
				},
			},
		},
		query: GQL`
        query {
          listAuthor {
            idx: id
            name1: name
	          name2: name
	          meta: _meta {
		          name1: name {
		          	readable1: readable
		          	readable2: readable
		          	updatable1: updatable
	          	}
	          }
          }
        }`,
		executes: [
			{
				sql: SQL`SELECT
							 "root_"."id" AS "root_idx",
							 "root_"."name" AS "root_name1",
							 "root_"."name" AS "root_name2",
							 "root_"."name" = ? AS "root___predicate_name_eq",
							 "root_"."id" AS "root_id"
						 FROM "public"."author" AS "root_"`,
				parameters: ['John'],
				response: {
					rows: [
						{
							root_id: testUuid(1),
							root_idx: testUuid(1),
							root_name1: 'John',
							root_name2: 'John',
							root___predicate_name_eq: true,
						},
					],
				},
			},
		],
		return: {
			data: {
				listAuthor: [
					{
						idx: testUuid(1),
						meta: {
							name1: {
								readable1: true,
								readable2: true,
								updatable1: true,
							},
						},
						name1: 'John',
						name2: 'John',
					},
				],
			},
		},
	})
})

