import { Model } from '@contember/schema'
import { assertNever } from '../utils'

export const resolveDefaultColumnType = (type: Exclude<Model.ColumnType, Model.ColumnType.Enum>): string => {
	switch (type) {
		case Model.ColumnType.Int:
			return 'integer'
		case Model.ColumnType.Double:
			return 'double precision'
		case Model.ColumnType.String:
			return 'text'
		case Model.ColumnType.Uuid:
			return 'uuid'
		case Model.ColumnType.Bool:
			return 'boolean'
		case Model.ColumnType.DateTime:
			return 'timestamptz'
		case Model.ColumnType.Date:
			return 'date'
		case Model.ColumnType.Time:
			return 'time'
		case Model.ColumnType.Json:
			return 'jsonb'
		default:
			return assertNever(type)
	}
}
