import { testMigrations } from '../../src/tests.js'
import { SQL } from '../../src/tags.js'
import { createSchema, SchemaDefinition as def } from '@contember/schema-definition'
import { describe } from 'bun:test'

namespace ViewEntityOriginalSchema {

	export class Author {
		name = def.stringColumn()
	}
}

namespace ViewEntityUpdatedSchema {
	export class Author {
		name = def.stringColumn()
		stats = def.oneHasOneInverse(AuthorStats, 'author')
	}

	@def.View('SELECT 1')
	export class AuthorStats {
		author = def.oneHasOne(Author, 'stats')
		articleCount = def.intColumn()
	}
}


describe('create view', () => testMigrations({
	original: createSchema(ViewEntityOriginalSchema),
	updated: createSchema(ViewEntityUpdatedSchema),
	diff: [
		{
			modification: 'createView',
			entity: {
				name: 'AuthorStats',
				primary: 'id',
				primaryColumn: 'id',
				unique: [],
				fields: {
					id: {
						name: 'id',
						columnName: 'id',
						nullable: false,
						type: 'Uuid',
						columnType: 'uuid',
					},
					author: {
						name: 'author',
						inversedBy: 'stats',
						nullable: true,
						type: 'OneHasOne',
						target: 'Author',
						joiningColumn: {
							columnName: 'author_id',
							onDelete: 'restrict',
						},
					},
					articleCount: {
						name: 'articleCount',
						columnName: 'article_count',
						nullable: true,
						type: 'Integer',
						columnType: 'integer',
					},
				},
				tableName: 'author_stats',
				view: {
					sql: 'SELECT 1',
				},
				eventLog: {
					enabled: true,
				},
				indexes: [],
			},
		},
		{
			modification: 'createRelationInverseSide',
			entityName: 'Author',
			relation: {
				name: 'stats',
				ownedBy: 'author',
				target: 'AuthorStats',
				type: 'OneHasOne',
				nullable: true,
			},
		},
	],
	sql: SQL`CREATE VIEW "author_stats" AS SELECT 1;`,
}))


namespace ViewAddRelationOriginalSchema {
	export class Article {
		title = def.stringColumn()
	}


	export class Category {
		name = def.stringColumn()
	}
}

namespace ViewAddRelationUpdateSchema {
	export class Article {
		title = def.stringColumn()
		category = def.manyHasOne(Category)
		stats = def.oneHasOneInverse(ArticleStats, 'article')
	}

	export class Category {
		name = def.stringColumn()
	}

	@def.View('SELECT 1')
	export class ArticleStats {
		article = def.oneHasOne(Article, 'stats')
		visitCount = def.intColumn()
	}
}


describe('create a relation and a view', () => testMigrations({
	original: createSchema(ViewAddRelationOriginalSchema), updated: createSchema(ViewAddRelationUpdateSchema), diff: [
		{
			modification: 'createRelation',
			entityName: 'Article',
			owningSide: { name: 'category', nullable: true, type: 'ManyHasOne', target: 'Category', joiningColumn: { columnName: 'category_id', onDelete: 'restrict' } },
		},
		{
			modification: 'createView',
			entity: { name: 'ArticleStats',
				primary: 'id',
				primaryColumn: 'id',
				unique: [],
				indexes: [],
				fields: { id: { name: 'id', columnName: 'id', nullable: false, type: 'Uuid', columnType: 'uuid' },
					article: { name: 'article', inversedBy: 'stats', nullable: true, type: 'OneHasOne', target: 'Article', joiningColumn: { columnName: 'article_id', onDelete: 'restrict' } },
					visitCount: { name: 'visitCount', columnName: 'visit_count', nullable: true, type: 'Integer', columnType: 'integer' } },
				tableName: 'article_stats',
				eventLog: { enabled: true },
				view: { sql: 'SELECT 1' } },
		},
		{
			modification: 'createRelationInverseSide',
			entityName: 'Article',
			relation: {
				name: 'stats',
				ownedBy: 'article',
				target: 'ArticleStats',
				type: 'OneHasOne',
				nullable: true,
			},
		},
	],
	sql: SQL`ALTER TABLE "article" ADD "category_id" uuid; 
ALTER TABLE "article" ADD FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE; 
CREATE INDEX ON "article" ("category_id"); 
CREATE VIEW "article_stats" AS SELECT 1;`,
}))

