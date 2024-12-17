import { describe } from 'bun:test'
import { testMigrations } from '../../src/tests'
import { SchemaBuilder } from '@contember/schema-definition'
import { Model } from '@contember/schema'
import { SQL } from '../../src/tags'

describe('update relation order by', () => testMigrations({
	original: {
		model: new SchemaBuilder()
			.entity('Menu', e =>
				e.oneHasMany('items', r =>
					r
						.ownedBy('menu')
						.target('MenuItem', e => e.column('heading').column('order', c => c.type(Model.ColumnType.Int))),
				),
			)
			.buildSchema(),
	},
	updated: {
		model: new SchemaBuilder()
			.entity('Menu', e =>
				e.oneHasMany('items', r =>
					r
						.ownedBy('menu')
						.orderBy('order')
						.target('MenuItem', e => e.column('heading').column('order', c => c.type(Model.ColumnType.Int))),
				),
			)
			.buildSchema(),
	},
	diff: [
		{
			modification: 'updateRelationOrderBy',
			entityName: 'Menu',
			fieldName: 'items',
			orderBy: [
				{
					path: ['order'],
					direction: 'asc',
				},
			],
		},
	],
	sql: SQL``,
}))
