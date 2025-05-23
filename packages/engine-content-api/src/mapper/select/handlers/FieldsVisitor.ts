import { Acl, Input, Model, Settings } from '@contember/schema'
import { Mapper } from '../../Mapper'
import { RelationFetcher } from '../RelationFetcher'
import { SelectExecutionHandlerContext } from '../SelectExecutionHandler'
import { PredicateFactory } from '../../../acl'
import { Literal, wrapIdentifier } from '@contember/database'
import { ColumnValueGetter } from '../SelectHydrator'
import { Providers } from '@contember/schema-utils'
import { getColumnName } from '@contember/schema-utils'
import { viewComputedId } from '../../../utils/viewComputedId'

export class FieldsVisitor implements Model.RelationByTypeVisitor<void>, Model.ColumnVisitor<void> {
	constructor(
		private readonly schema: Model.Schema,
		private readonly relationFetcher: RelationFetcher,
		private readonly predicateFactory: PredicateFactory,
		private readonly mapper: Mapper,
		private readonly executionContext: SelectExecutionHandlerContext,
		private readonly relationPath: Model.AnyRelationContext[],
		private readonly settings: Settings.ContentSettings,
		private readonly providers: Providers,
	) {}

	visitColumn({ entity, column }: Model.ColumnContext): void {
		const columnPath = this.executionContext.path
		const tablePath = columnPath.back()
		const tableAlias = tablePath.alias
		const columnAlias = columnPath.alias

		let selectFrom = wrapIdentifier(tableAlias) + '.' + wrapIdentifier(column.columnName)
		if (column.type === Model.ColumnType.Date && this.settings.shortDateResponse) {
			selectFrom += '::text'
		}
		if (column.type === Model.ColumnType.DateTime && this.settings.fullDateTimeResponse) {
			selectFrom += '::text'
		}
		if (column.type === Model.ColumnType.Enum && column.list) {
			selectFrom += '::text[]'
		}

		let columnValueGetter: ColumnValueGetter | undefined = undefined
		if (entity.view && column.name === entity.primary && column.type === Model.ColumnType.Uuid) {
			if (entity.view.idSource) {
				const aliases: string[] = []
				for (const source of entity.view.idSource) {
					const columnName = getColumnName(this.schema, entity, source)
					const idSrcPath = columnPath.for(source + '__id_src')
					aliases.push(idSrcPath.alias)
					this.executionContext.addColumn({
						query: qb => qb.select([tableAlias, columnName], idSrcPath.alias),
					})
				}

				columnValueGetter = row => {
					return viewComputedId(aliases.map(it => row[it]?.toString() || ''))
				}
			} else {
				columnValueGetter = row => {
					return row[columnAlias] ?? (this.providers.uuid({ version: this.settings.uuidVersion }))
				}

			}
		}

		this.executionContext.addColumn({
			query: qb => qb.select(new Literal(selectFrom), columnAlias),
			predicate: this.getRequiredPredicate(entity, column),
			valueGetter: columnValueGetter,
		})
	}

	public visitManyHasManyInverse(relationContext: Model.ManyHasManyInverseContext): void {
		const field = this.executionContext.objectNode
		if (!field) {
			throw new Error()
		}
		this.executionContext.addData({
			field: relationContext.entity.primary,
			dataProvider: async ids =>
				this.relationFetcher.fetchManyHasManyGroups({
					mapper: this.mapper,
					field: field,
					relationContext,
					relationPath: this.relationPath,
					ids: ids,
				}),
			defaultValue: [],
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	public visitManyHasManyOwning(relationContext: Model.ManyHasManyOwningContext): void {
		const field = this.executionContext.objectNode
		if (!field) {
			throw new Error()
		}

		this.executionContext.addData({
			field: relationContext.entity.primary,
			dataProvider: async ids =>
				this.relationFetcher.fetchManyHasManyGroups({
					mapper: this.mapper,
					field: field,
					relationContext,
					relationPath: this.relationPath,
					ids: ids,
				}),
			defaultValue: [],
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	public visitOneHasMany(relationContext: Model.OneHasManyContext): void {
		const field = this.executionContext.objectNode
		if (!field) {
			throw new Error()
		}

		this.executionContext.addData({
			field: relationContext.entity.primary,
			dataProvider: async ids =>
				this.relationFetcher.fetchOneHasManyGroups({
					mapper: this.mapper,
					objectNode: field,
					relationContext,
					relationPath: this.relationPath,
					ids: ids,
				}),
			defaultValue: [],
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	public visitOneHasOneInverse(relationContext: Model.OneHasOneInverseContext): void {
		const { entity, targetRelation, targetEntity } = relationContext
		this.executionContext.addData({
			field: entity.primary,
			dataProvider: async ids => {
				const idsWhere: Input.Where = {
					[targetRelation.name]: {
						[entity.primary]: {
							in: ids,
						},
					},
				}
				const field = this.executionContext.objectNode
				if (!field) {
					throw new Error()
				}
				const where: Input.Where = {
					and: [idsWhere, field.args.filter].filter((it): it is Input.Where => it !== undefined),
				}
				const objectWithWhere = field.withArg('filter', where)

				return this.mapper.selectAssoc(targetEntity, objectWithWhere, [
					...this.relationPath,
					relationContext,
				], targetRelation.name)
			},
			defaultValue: null,
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	public visitOneHasOneOwning(relationContext: Model.OneHasOneOwningContext): void {
		const { relation, targetEntity } = relationContext
		this.executionContext.addData({
			field: relation.name,
			dataProvider: async ids => {
				const idsWhere: Input.Where = {
					[targetEntity.primary]: {
						in: ids,
					},
				}
				const objectNode = this.executionContext.objectNode
				if (!objectNode) {
					throw new Error()
				}
				const where: Input.Where = {
					and: [idsWhere, objectNode.args.filter].filter((it): it is Input.Where => it !== undefined),
				}
				const objectWithWhere = objectNode.withArg('filter', where)

				return this.mapper.selectAssoc(targetEntity, objectWithWhere, [
					...this.relationPath,
					relationContext,
				], targetEntity.primary)
			},
			defaultValue: null,
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	public visitManyHasOne(relationContext: Model.ManyHasOneContext): void {
		const { relation, targetEntity } = relationContext
		this.executionContext.addData({
			field: relation.name,
			dataProvider: async ids => {
				const idsWhere: Input.Where = {
					[targetEntity.primary]: {
						in: ids,
					},
				}
				const objectNode = this.executionContext.objectNode
				if (!objectNode) {
					throw new Error()
				}
				const where: Input.Where = {
					and: [idsWhere, objectNode.args.filter].filter((it): it is Input.Where => it !== undefined),
				}
				const objectWithWhere = objectNode.withArg('filter', where)

				return this.mapper.selectAssoc(targetEntity, objectWithWhere, [
					...this.relationPath,
					relationContext,
				], targetEntity.primary)
			},
			defaultValue: null,
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	private getRequiredPredicate(entity: Model.Entity, field: Model.AnyField): Acl.Predicate | undefined {
		const fieldPredicate = this.predicateFactory.getFieldPredicate(entity, Acl.Operation.read, field.name)
		return fieldPredicate.isSameAsPrimary ? undefined : fieldPredicate.predicate
	}
}
