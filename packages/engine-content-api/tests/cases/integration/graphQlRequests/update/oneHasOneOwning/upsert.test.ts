import { test } from 'bun:test'
import { execute, sqlTransaction } from '../../../../../src/test'
import { GQL, SQL } from '../../../../../src/tags'
import { testUuid } from '../../../../../src/testUuid'
import { siteSettingSchema } from './schema'

test('upsert - exists', async () => {
	await execute({
		schema: siteSettingSchema,
		query: GQL`mutation {
        updateSite(
            by: {id: "${testUuid(2)}"},
            data: {setting: {upsert: {update: {url: "http://mangoweb.cz"}, create: {url: "http://mgw.cz"}}}}
          ) {
          ok
        }
      }`,
		executes: [
			...sqlTransaction([
				{
					sql: SQL`select "root_"."id" from "public"."site" as "root_" where "root_"."id" = ?`,
					parameters: [testUuid(2)],
					response: { rows: [{ id: testUuid(2) }] },
				},
				{
					sql: SQL`select "root_"."setting_id"
                       from "public"."site" as "root_"
                       where "root_"."id" = ?`,
					parameters: [testUuid(2)],
					response: {
						rows: [{ setting_id: testUuid(1) }],
					},
				},
				{
					sql: SQL`with "newData_" as (select ? :: text as "url", "root_"."url" as "url_old__", "root_"."id"  from "public"."site_setting" as "root_"  where "root_"."id" = ?) 
						update  "public"."site_setting" set  "url" =  "newData_"."url"   from "newData_"  where "site_setting"."id" = "newData_"."id"  returning "url_old__"`,
					parameters: ['http://mangoweb.cz', testUuid(1)],
					response: { rows: [{ url_old__: 'xxx' }] },
				},
			]),
		],
		return: {
			data: {
				updateSite: {
					ok: true,
				},
			},
		},
	})
})
test('upsert - not exists', async () => {
	await execute({
		schema: siteSettingSchema,
		query: GQL`mutation {
        updateSite(
            by: {id: "${testUuid(2)}"},
            data: {setting: {upsert: {update: {url: "http://mangoweb.cz"}, create: {url: "http://mgw.cz"}}}}
          ) {
          ok
        }
      }`,
		executes: [
			...sqlTransaction([
				{
					sql: SQL`select "root_"."id" from "public"."site" as "root_" where "root_"."id" = ?`,
					parameters: [testUuid(2)],
					response: { rows: [{ id: testUuid(2) }] },
				},
				{
					sql: SQL`select "root_"."setting_id"
                       from "public"."site" as "root_"
                       where "root_"."id" = ?`,
					parameters: [testUuid(2)],
					response: {
						rows: [],
					},
				},
				{
					sql: SQL`with "root_" as
							(select ? :: uuid as "id", ? :: text as "url")
							insert into "public"."site_setting" ("id", "url")
							select "root_"."id", "root_"."url"
              from "root_"
							returning "id"`,
					parameters: [testUuid(1), 'http://mgw.cz'],
					response: { rows: [{ id: testUuid(1) }] },
				},
				{
					sql: SQL`with "newData_" as (select ? :: uuid as "setting_id", "root_"."setting_id" as "setting_id_old__", "root_"."id", "root_"."name"  from "public"."site" as "root_"  where "root_"."id" = ?) 
						update  "public"."site" set  "setting_id" =  "newData_"."setting_id"   from "newData_"  where "site"."id" = "newData_"."id"  returning "setting_id_old__"`,
					parameters: [testUuid(1), testUuid(2)],
					response: { rows: [{ setting_id_old__: null }] },
				},
			]),
		],
		return: {
			data: {
				updateSite: {
					ok: true,
				},
			},
		},
	})
})

