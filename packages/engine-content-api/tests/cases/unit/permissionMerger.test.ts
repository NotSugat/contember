import { Acl, Model } from '@contember/schema'
import { PermissionFactory } from '../../../src/acl'
import { SchemaBuilder } from '@contember/schema-definition'
import { describe, it } from 'bun:test'
import { emptySchema } from '@contember/schema-utils'
import { assert } from '../../src/assert'

interface Test {
	acl: Acl.Schema
	roles: string[]
	result: Acl.Permissions
}

const execute = (test: Test) => {
	const model: Model.Schema = new SchemaBuilder()
		.entity('Entity1', e => e.column('lorem').column('bar'))
		.entity('Entity2', e => e.oneHasOne('xyz', r => r.target('Entity1')))
		.buildSchema()
	const merger = new PermissionFactory()
	const initialAcl = JSON.parse(JSON.stringify(test.acl))
	const result = merger.create({
		...emptySchema,
		 model,
		acl: test.acl,
	}, test.roles)
	assert.deepStrictEqual(result, test.result)
	assert.deepStrictEqual(test.acl, initialAcl)
}

describe('Permission merger', () => {

	it('merge inheritance', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {},
								operations: {
									read: {
										id: true,
									},
								},
							},
						},
					},
					role2: {
						variables: {},
						inherits: ['role1'],
						stages: '*',
						entities: {
							Entity2: {
								predicates: {},
								operations: {
									read: {
										id: true,
									},
								},
							},
						},
					},
				},
			},
			roles: ['role2'],
			result: {
				Entity1: {
					predicates: {},
					operations: {
						read: {
							id: true,
						},
					},
				},
				Entity2: {
					predicates: {},
					operations: {
						read: {
							id: true,
						},
					},
				},
			},
		})
	})

	it('merge entity operations', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {},
								operations: {
									read: {
										id: true,
									},
								},
							},
						},
					},
					role2: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {},
								operations: {
									read: {
										title: true,
									},
								},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity1: {
					predicates: {},
					operations: {
						read: {
							id: true,
							title: true,
						},
					},
				},
			},
		})
	})

	it('merge entity operations with predicates', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {},
								operations: {
									read: {
										id: true,
									},
								},
							},
						},
					},
					role2: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {
									foo: { bar: { eq: 'abc' } },
								},
								operations: {
									read: {
										title: 'foo',
									},
								},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity1: {
					predicates: {
						foo: { bar: { eq: 'abc' } },
					},
					operations: {
						read: {
							id: true,
							title: 'foo',
						},
					},
				},
			},
		})
	})

	it('merge entity operations and drops predicate', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},

						stages: '*',
						entities: {
							Entity1: {
								predicates: {},
								operations: {
									read: {
										id: true,
										title: true,
									},
								},
							},
						},
					},
					role2: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {
									foo: { bar: { eq: 'abc' } },
								},
								operations: {
									read: {
										title: 'foo',
									},
								},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity1: {
					predicates: {},
					operations: {
						read: {
							id: true,
							title: true,
						},
					},
				},
			},
		})
	})

	it('merge entity operations and merges predicates', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {
									bar: { lorem: { eq: 'ipsum' } },
								},
								operations: {
									read: {
										id: true,
										title: 'bar',
									},
								},
							},
						},
					},
					role2: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {
									foo: { bar: { eq: 'abc' } },
								},
								operations: {
									read: {
										title: 'foo',
									},
								},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity1: {
					predicates: {
						__merge__bar__foo: {
							or: [{ lorem: { eq: 'ipsum' } }, { bar: { eq: 'abc' } }],
						},
					},
					operations: {
						read: {
							id: true,
							title: '__merge__bar__foo',
						},
					},
				},
			},
		})
	})

	it('merge delete operation', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {
									bar: { lorem: { eq: 'ipsum' } },
								},
								operations: {
									delete: 'bar',
								},
							},
						},
					},
					role2: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {
									foo: { bar: { eq: 'abc' } },
								},
								operations: {
									delete: 'foo',
								},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity1: {
					predicates: {
						__merge__bar__foo: {
							or: [{ lorem: { eq: 'ipsum' } }, { bar: { eq: 'abc' } }],
						},
					},
					operations: {
						delete: '__merge__bar__foo',
					},
				},
			},
		})
	})

	it('merge predicates and resolves conflicts', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {
									foo: { lorem: { eq: 'ipsum' } },
								},
								operations: {
									read: {
										id: true,
										title: 'foo',
									},
								},
							},
						},
					},
					role2: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {
									foo: { bar: { eq: 'abc' } },
								},
								operations: {
									read: {
										content: 'foo',
									},
								},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity1: {
					predicates: {
						foo: { lorem: { eq: 'ipsum' } },
						foo_: { bar: { eq: 'abc' } },
					},
					operations: {
						read: {
							id: true,
							title: 'foo',
							content: 'foo_',
						},
					},
				},
			},
		})
	})

	it('make primary predicate union of all other fields', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						stages: '*',
						entities: {
							Entity1: {
								predicates: {
									foo: { lorem: { eq: 'ipsum' } },
									bar: { lorem: { eq: 'ipsum' } },
								},
								operations: {
									read: {
										title: 'foo',
										description: 'bar',
										content: 'bar',
									},
								},
							},
						},
					},
				},
			},
			roles: ['role1'],
			result: {
				Entity1: {
					predicates: {
						foo: { lorem: { eq: 'ipsum' } },
						bar: { lorem: { eq: 'ipsum' } },
						__merge__foo__bar: {
							or: [{ lorem: { eq: 'ipsum' } }, { lorem: { eq: 'ipsum' } }],
						},
					},
					operations: {
						read: {
							id: '__merge__foo__bar',
							title: 'foo',
							description: 'bar',
							content: 'bar',
						},
					},
				},
			},
		})
	})

	it('prefix variables', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						stages: '*',
						entities: {
							Entity2: {
								predicates: {
									foo: { xyz: { lorem: 'foo' } },
								},
								operations: {
									read: {
										title: 'foo',
									},
								},
							},
						},
					},
				},
			},
			roles: ['role1'],
			result: {
				Entity2: {
					operations: {
						read: {
							title: 'foo',
							id: 'foo',
						},
					},
					predicates: {
						foo: {
							xyz: {
								lorem: 'role1__foo',
							},
						},
					},
				},
			},
		})
	})

	it('prefix inherited variables', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {
							foo: { entityName: 'Test', type: Acl.VariableType.entity },
						},
						stages: '*',
						entities: {
							Entity2: {
								predicates: {
									foo: { xyz: { lorem: 'foo' } },
								},
								operations: {
									read: {
										title: 'foo',
									},
								},
							},
						},
					},
					role2: {
						variables: {},
						entities: {},
						inherits: ['role1'],
						stages: '*',
					},
				},
			},
			roles: ['role2'],
			result: {
				Entity2: {
					operations: {
						read: {
							title: 'foo',
							id: 'foo',
						},
					},
					predicates: {
						foo: {
							xyz: {
								lorem: 'role2__foo',
							},
						},
					},
				},
			},
		})
	})


	it('merge noRootOperations', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {},
								operations: {
									read: {
										title: true,
									},
									noRoot: ['read'],
								},
							},
						},
					},
					role2: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {},
								operations: {
									read: {
										title: true,
									},
									update: {
										title: true,
									},
									noRoot: ['read', 'update'],
								},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity2: {
					operations: {
						update: {
							id: true,
							title: true,
						},
						read: {
							id: true,
							title: true,
						},
						noRoot: ['read', 'update'],
					},
					predicates: {},
				},
			},
		})
	})


	it('merge delete #1', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {},
								operations: {
									delete: true,
									noRoot: ['delete'],
								},
							},
						},
					},
					role2: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {},
								operations: {},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity2: {
					operations: {
						delete: true,
						noRoot: ['delete'],
					},
					predicates: {},
				},
			},
		})
	})


	it('merge delete #2', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {},
								operations: {
									delete: true,
									noRoot: ['delete'],
								},
							},
						},
					},
					role2: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {},
								operations: {
									delete: true,
								},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity2: {
					operations: {
						delete: true,
					},
					predicates: {},
				},
			},
		})
	})

	it('merge delete #2', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {},
								operations: {
									delete: true,
									noRoot: ['delete'],
								},
							},
						},
					},
					role2: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {},
								operations: {},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity2: {
					operations: {
						delete: true,
						noRoot: ['delete'],
					},
					predicates: {},
				},
			},
		})
	})


	it('prefer permissions with root allowed', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {
									foo: { xyz: { lorem: { eq: 'foo' } } },
								},
								operations: {
									read: {
										title: 'foo',
									},
									noRoot: ['read'],
								},
							},
						},
					},
					role2: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {
									foo: { xyz: { lorem: { eq: 'bar' } } },
								},
								operations: {
									read: {
										title: 'foo',
									},
								},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity2: {
					operations: {
						read: {
							title: 'foo_',
							id: 'foo_',
						},
					},
					predicates: {
						foo_: {
							xyz: {
								lorem: { eq: 'bar' },
							},
						},
					},
				},
			},
		})
	})


	it('merge permissions with no root', () => {
		execute({
			acl: {
				roles: {
					role1: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {
									foo: { xyz: { lorem: { eq: 'foo' } } },
								},
								operations: {
									read: {
										title: 'foo',
									},
									noRoot: ['read'],
								},
							},
						},
					},
					role2: {
						variables: {},
						entities: {
							Entity2: {
								predicates: {
									foo: { xyz: { lorem: { eq: 'bar' } } },
								},
								operations: {
									read: {
										title: 'foo',
									},
									noRoot: ['read'],
								},
							},
						},
					},
				},
			},
			roles: ['role1', 'role2'],
			result: {
				Entity2: {
					operations: {
						noRoot: ['read'],
						read: {
							title: '__merge__foo__foo',
							id: '__merge__foo__foo',
						},
					},
					predicates: {
						__merge__foo__foo: {
							or: [
								{ xyz: { lorem: { eq: 'foo' } } },
								{ xyz: { lorem: { eq: 'bar' } } },
							],
						},
					},
				},
			},
		})
	})
})
