import { describe } from 'bun:test'
import { testMigrations } from '../../src/tests'
import { SchemaBuilder } from '@contember/schema-definition'
import { Model } from '@contember/schema'
import { SQL } from '../../src/tags'

describe('create enum', () => testMigrations({
	original: {
		model: new SchemaBuilder()
			.entity('Post', e => e.column('title', c => c.type(Model.ColumnType.String)))
			.buildSchema(),
	},
	updated: {
		model: new SchemaBuilder()
			.entity('Post', e =>
				e
					.column('title', c => c.type(Model.ColumnType.String))
					.column('status', c => c.type(Model.ColumnType.Enum, { enumName: 'postStatus' })),
			)
			.enum('postStatus', ['publish', 'draft'])
			.buildSchema(),
	},
	diff: [
		{
			modification: 'createEnum',
			enumName: 'postStatus',
			values: ['publish', 'draft'],
		},
		{
			modification: 'createColumn',
			entityName: 'Post',
			field: {
				columnName: 'status',
				name: 'status',
				nullable: true,
				type: Model.ColumnType.Enum,
				columnType: 'postStatus',
			},
		},
	],
	sql: SQL`CREATE DOMAIN "postStatus" AS text CONSTRAINT "poststatus_check" CHECK (VALUE IN('publish','draft'));
	ALTER TABLE "post"
		ADD "status" "postStatus";`,
}))
