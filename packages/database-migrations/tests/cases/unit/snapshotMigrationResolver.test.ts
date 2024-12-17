import { expect, describe, test } from 'bun:test'
import { SnapshotMigrationResolver, Migration } from '../../../src'

describe('snapshot migration resolver', () => {
	test('use snapshot with latest migration timestamp', () => {
		const snapshotRunner = () => null
		const resolver = new SnapshotMigrationResolver(snapshotRunner, {
			'2023-07-26-105000-xx': () => null,
			'2023-07-26-105500-yy': () => null,
		})

		expect(resolver.resolveMigrations({ runMigrations: [] })).toStrictEqual([
			new Migration('2023-07-26-105500-snapshot', snapshotRunner),
		])
	})

	test('use snapshot with latest base migration timestamp', () => {
		const snapshotRunner = () => null
		const resolver = new SnapshotMigrationResolver(snapshotRunner, {
			'2023-07-26-105000-xx': () => null,
			'2023-07-26-105500-yy': () => null,
		}, 'snapshot', {
			'2023-07-26-105000-xx': () => null,
			'2023-07-26-105700-yy': () => null,
		})

		expect(resolver.resolveMigrations({ runMigrations: [] })).toStrictEqual([
			new Migration('2023-07-26-105700-snapshot', snapshotRunner),
		])
	})

	test('do not use snapshot if some migrations are executed, but not a snapshot', () => {
		const snapshotRunner = () => null
		const yyRunner = () => null
		const xxRunner = () => null
		const resolver = new SnapshotMigrationResolver(snapshotRunner, {
			'2023-07-26-105000-xx': xxRunner,
			'2023-07-26-105500-yy': yyRunner,
		})

		expect(resolver.resolveMigrations({ runMigrations: [{ name: '2023-07-26-105000-xx', group: null }] })).toStrictEqual([
			new Migration('2023-07-26-105000-xx', xxRunner),
			new Migration('2023-07-26-105500-yy', yyRunner),
		])
	})


	test('merge snapshot with new migrations', () => {
		const snapshotRunner = () => null
		const yyRunner = () => null
		const xxRunner = () => null
		const zzRunner = () => null
		const resolver = new SnapshotMigrationResolver(snapshotRunner, {
			'2023-07-26-105000-xx': xxRunner,
			'2023-07-26-105500-yy': yyRunner,
			'2023-07-26-105700-zz': zzRunner,
		})

		expect(resolver.resolveMigrations({ runMigrations: [{ name: '2023-07-26-105000-snapshot', group: null }] })).toStrictEqual([
			new Migration('2023-07-26-105000-snapshot', snapshotRunner),
			new Migration('2023-07-26-105500-yy', yyRunner),
			new Migration('2023-07-26-105700-zz', zzRunner),
		])
	})
})
