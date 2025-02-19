import { GraphQLBoolean, GraphQLEnumType, GraphQLFloat, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLScalarType, GraphQLString } from 'graphql'
import { Model } from '@contember/schema'
import { EnumsProvider } from './EnumsProvider'
import { CustomTypesProvider } from './CustomTypesProvider'
import { ImplementationException } from '../exception'
import { singletonFactory } from '../utils'

type ScalarType = Exclude<Model.ColumnType, Model.ColumnType.Enum>

export type ColumnGraphQLType = GraphQLScalarType | GraphQLEnumType | GraphQLList<GraphQLNonNull<GraphQLScalarType | GraphQLEnumType>>

export class ColumnTypeResolver {
	private schema: Model.Schema
	private enumsProvider: EnumsProvider

	private readonly aliasedTypes = singletonFactory<{ scalar: GraphQLScalarType; base: ScalarType }, string, ScalarType>(
		this.createAliasedType.bind(this),
	)

	constructor(
		schema: Model.Schema,
		enumsProvider: EnumsProvider,
		private readonly customTypeProvider: CustomTypesProvider,
	) {
		this.schema = schema
		this.enumsProvider = enumsProvider
	}

	private createAliasedType(name: string, baseType: ScalarType): { scalar: GraphQLScalarType; base: ScalarType } {
		const baseGraphqlType = this.getScalarType(baseType)
		return {
			scalar: new GraphQLScalarType({
				...baseGraphqlType.toConfig(),
				name,
				description: null,
			}),
			base: baseType,
		}
	}

	public getType(column: Model.AnyColumn): [type: ColumnGraphQLType, baseType: GraphQLScalarType | GraphQLEnumType] {
		const baseType = this.getBaseType(column)
		return [
			column.list ? new GraphQLList(new GraphQLNonNull(baseType)) : baseType,
			baseType,
		]
	}

	private getBaseType(column: Model.AnyColumn): GraphQLScalarType | GraphQLEnumType {
		if (column.typeAlias) {
			if (column.type === Model.ColumnType.Enum) {
				throw new Error('GraphQL type alias cannot be specified for enum type')
			}
			const { scalar, base } = this.aliasedTypes(column.typeAlias, column.type)
			if (base !== column.type) {
				throw new Error('GraphQL type alias with different base type found')
			}
			return scalar
		}
		return this.resolveType(column)
	}

	private resolveType(column: Model.AnyColumn): GraphQLScalarType | GraphQLEnumType {
		switch (column.type) {
			case Model.ColumnType.Enum:
				if (this.enumsProvider.hasEnum(column.columnType)) {
					return this.enumsProvider.getEnum(column.columnType)
				}
				throw new Error(`Undefined enum ${column.columnType}`)
			default:
				return this.getScalarType(column.type)
		}
	}

	private getScalarType(type: ScalarType): GraphQLScalarType {
		switch (type) {
			case Model.ColumnType.Int:
				return GraphQLInt
			case Model.ColumnType.String:
				return GraphQLString
			case Model.ColumnType.Uuid:
				return this.customTypeProvider.uuidType
			case Model.ColumnType.Double:
				return GraphQLFloat
			case Model.ColumnType.Bool:
				return GraphQLBoolean
			case Model.ColumnType.DateTime:
				return this.customTypeProvider.dateTimeType
			case Model.ColumnType.Date:
				return this.customTypeProvider.dateType
			case Model.ColumnType.Json:
				return this.customTypeProvider.jsonType
			default:
				(({}: never): never => {
					throw new ImplementationException('Invalid column type')
				})(type)
		}
	}
}
