import { SqlUpdateInputProcessor } from './SqlUpdateInputProcessor'
import { UpdateInputVisitor } from '../../inputProcessing'
import { Input, Model } from '@contember/schema'
import { PredicateFactory } from '../../acl'
import { UpdateBuilderFactory } from './UpdateBuilderFactory'
import { Mapper } from '../Mapper'
import { acceptEveryFieldVisitor } from '@contember/schema-utils'
import {
	collectResults,
	MutationNoResultError,
	MutationNothingToDo,
	MutationResultList,
	MutationUpdateOk,
	NothingToDoReason,
	RowValues,
} from '../Result'
import { UpdateBuilder } from './UpdateBuilder'
import { rowDataToFieldValues } from '../ColumnValue'
import { DatabaseMetadata } from '@contember/database'

export class Updater {
	constructor(
		private readonly schema: Model.Schema,
		private readonly schemaDatabaseMetadata: DatabaseMetadata,
		private readonly predicateFactory: PredicateFactory,
		private readonly updateBuilderFactory: UpdateBuilderFactory,
	) {}

	public async update(
		mapper: Mapper,
		entity: Model.Entity,
		primaryValue: Input.PrimaryValue,
		data: Input.UpdateDataInput,
		filter?: Input.OptionalWhere,
	): Promise<MutationResultList> {
		const updateBuilder = this.updateBuilderFactory.create(entity, primaryValue)

		const predicateFields = Object.keys(data)
		updateBuilder.addPredicates(predicateFields)
		if (filter && Object.keys(filter).length > 0) {
			updateBuilder.addOldWhere(filter)
		}

		const updateVisitor = new SqlUpdateInputProcessor(primaryValue, data, updateBuilder, mapper)
		const visitor = new UpdateInputVisitor<MutationResultList>(updateVisitor, this.schema, data)
		const promises = acceptEveryFieldVisitor<Promise<MutationResultList[]>>(this.schema, entity, visitor)

		const okResultFactory = (values: RowValues) => new MutationUpdateOk([], entity, primaryValue, data, values)
		const mutationResultPromise = Updater.executeUpdate(updateBuilder, mapper, okResultFactory)
		const otherPromises = Object.values(promises)
		if (otherPromises.length === 0) {
			return await mutationResultPromise
		} else {
			return await collectResults(this.schema, this.schemaDatabaseMetadata, mutationResultPromise, otherPromises)
		}
	}

	public async updateCb(
		mapper: Mapper,
		entity: Model.Entity,
		primaryValue: Input.PrimaryValue,
		builderCb: (builder: UpdateBuilder) => void,
	): Promise<MutationResultList> {
		const updateBuilder = this.updateBuilderFactory.create(entity, primaryValue)

		const okResultFactory = (values: RowValues) => new MutationUpdateOk([], entity, primaryValue, {}, values)
		builderCb(updateBuilder)

		return Updater.executeUpdate(updateBuilder, mapper, okResultFactory)
	}

	private static async executeUpdate(
		updateBuilder: UpdateBuilder,
		mapper: Mapper,
		okResultFactory: (values: RowValues) => MutationUpdateOk,
	): Promise<MutationResultList> {
		const result = await updateBuilder.execute(mapper)
		if (result.aborted) {
			return [new MutationNothingToDo([], NothingToDoReason.aborted)]
		}
		if (!result.executed) {
			return [new MutationNothingToDo([], NothingToDoReason.noData)]
		}
		if (result.affectedRows !== 1) {
			return [new MutationNoResultError([])]
		}
		return [okResultFactory(rowDataToFieldValues(result.values))]
	}
}
