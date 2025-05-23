import { describe } from 'bun:test'
import { testMigrations } from '../../src/tests'
import { createSchema, SchemaBuilder } from '@contember/schema-definition'
import { Acl, Model } from '@contember/schema'
import { SQL } from '../../src/tags'
import { SchemaDefinition as def } from '@contember/schema-definition'

describe('remove an entity', () => testMigrations({
	original: {
		model: new SchemaBuilder()
			.entity('Author', e => e.column('name', c => c.type(Model.ColumnType.String)))
			.entity('Post', e =>
				e
					.column('title', c => c.type(Model.ColumnType.String))
					.manyHasOne('author', r => r.target('Author').onDelete(Model.OnDelete.cascade)),
			)
			.buildSchema(),
	},
	updated: {
		model: new SchemaBuilder()
			.entity('Post', e => e.column('title', c => c.type(Model.ColumnType.String)))
			.buildSchema(),
	},
	diff: [
		{
			modification: 'removeEntity',
			entityName: 'Author',
		},
	],
	sql: SQL`ALTER TABLE "post" DROP "author_id"; DROP TABLE "author";`,
}))

describe('remove entity with acl', () => testMigrations({
	original: {
		model: new SchemaBuilder()
			.entity('Site', entity => entity.column('name', c => c.type(Model.ColumnType.String)))
			.entity('Post', entity => entity.column('title').manyHasOne('site', r => r.target('Site')))
			.buildSchema(),
		acl: {
			roles: {
				admin: {
					variables: {
						siteId: {
							type: Acl.VariableType.entity,
							entityName: 'Site',
						},
					},
					stages: '*',
					entities: {
						Site: {
							predicates: {},
							operations: {
								read: {
									id: true,
								},
							},
						},
						Post: {
							predicates: {
								site: { site: { id: 'siteId' } },
							},
							operations: {
								read: {
									title: 'site',
								},
							},
						},
					},
				},
			},
		},
	},
	updated: {
		model: new SchemaBuilder().entity('Post', entity => entity.column('title')).buildSchema(),
		acl: {
			roles: {
				admin: {
					variables: {},
					stages: '*',
					entities: {
						Post: {
							predicates: {
								site: {},
							},
							operations: {
								read: {
									title: 'site',
								},
							},
						},
					},
				},
			},
		},
	},
	diff: [
		{
			modification: 'removeEntity',
			entityName: 'Site',
		},
	],
	sql: SQL`ALTER TABLE "post" DROP "site_id"; DROP TABLE "site";`,
}))

namespace ViewEntityOriginalSchema {
	@def.View("SELECT null as id, 'John' AS name")
	export class Author {
		name = def.stringColumn()
	}
}
describe('remove a view', () => testMigrations({
	original: createSchema(ViewEntityOriginalSchema),
	updated: {},
	diff: [
		{
			modification: 'removeEntity',
			entityName: 'Author',
		},
	],
	sql: SQL`
	DROP VIEW "author";`,
}))


namespace EntityWithManyHasManyOriginalSchema {

	export class Book {
		title = def.stringColumn()
		tags = def.manyHasMany(Tag, 'books')
	}

	export class Tag {
		name = def.stringColumn()
		books = def.manyHasManyInverse(Book, 'tags')
	}
}
describe('remove junction table, when both entities are removed', () => testMigrations({
	original: createSchema(EntityWithManyHasManyOriginalSchema),
	updated: {},
	diff: [
		{
			modification: 'removeEntity',
			entityName: 'Book',
		},
		{
			modification: 'removeEntity',
			entityName: 'Tag',
		},
	],
	sql: SQL`DROP TABLE "book_tags";
DROP TABLE "book"; 
DROP TABLE "tag";`,
}))


namespace EntityWithManyHasManyUpdatedSchema {

	export class Tag {
		name = def.stringColumn()
	}
}
describe('remove junction table, when owning entity is removed', () => testMigrations({
	original: createSchema(EntityWithManyHasManyOriginalSchema),
	updated: createSchema(EntityWithManyHasManyUpdatedSchema),
	diff: [
		{
			modification: 'removeEntity',
			entityName: 'Book',
		},

	],
	sql: SQL`DROP TABLE "book_tags";
DROP TABLE "book";`,
}))


namespace EntityWithManyHasMany2UpdatedSchema {

	export class Book {
		title = def.stringColumn()
	}
}
describe('remove junction table, when inverse entity is removed', () => testMigrations({
	original: createSchema(EntityWithManyHasManyOriginalSchema),
	updated: createSchema(EntityWithManyHasMany2UpdatedSchema),
	diff: [
		{
			modification: 'removeEntity',
			entityName: 'Tag',
		},

	],
	sql: SQL`
DROP TABLE "book_tags";
DROP TABLE "tag";`,
}))


namespace EntityWithSelfReferencingRelationOriginalSchema {

	export class Person {
		name = def.stringColumn()
		parent = def.manyHasOne(Person, 'children')
		children = def.oneHasMany(Person, 'parent')
	}
}

describe('remove self-referencing relation', () => testMigrations({
	original: createSchema(EntityWithSelfReferencingRelationOriginalSchema),
	updated: {},
	diff: [
		{
			modification: 'removeEntity',
			entityName: 'Person',
		},
	],
	sql: SQL`ALTER TABLE "person" DROP "parent_id"; DROP TABLE "person";`,
}))
