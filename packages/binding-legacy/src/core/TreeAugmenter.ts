import {
	ClientGeneratedUuid,
	HasOneRelationMarker,
	ReceivedDataTree,
	RuntimeId,
	ServerId,
	UnpersistedEntityDummyId,
} from '@contember/binding-common'
import { BindingError } from '@contember/binding-common'
import type { MarkerTreeRoot } from '@contember/binding-common'
import type { EntityId, PlaceholderName, TreeRootId } from '@contember/binding-common'
import { assertNever } from '@contember/binding-common'
import { EventManager } from './EventManager'
import { OperationsHelpers } from './operations/OperationsHelpers'
import { EntityListState, EntityRealmState, EntityRealmStateStub, getEntityMarker, RootStateNode } from './state'
import type { StateInitializer } from './StateInitializer'
import type { TreeStore } from './TreeStore'
import { SubMutationOperation } from './MutationGenerator'
import { EntityListPersistedData } from '../accessorTree'

export class TreeAugmenter {
	public constructor(
		private readonly eventManager: EventManager,
		private readonly stateInitializer: StateInitializer,
		private readonly treeStore: TreeStore,
		private readonly skipStateUpdateAfterPersist: boolean = false,
	) {}

	public extendPersistedData(newPersistedData: ReceivedDataTree, markerTree: MarkerTreeRoot) {
		// TODO this doesn't yet handle updates for entities whose persisted data just gets magically changed without notice.
		this.treeStore.mergeInQueryResponse(newPersistedData, markerTree)
	}

	public extendTreeStates(newTreeId: TreeRootId | undefined, newMarkerTree: MarkerTreeRoot): void {
		const subTreeStates: Map<PlaceholderName, RootStateNode> = new Map()

		this.treeStore.markerTrees.set(newTreeId, newMarkerTree)
		this.treeStore.subTreeStatesByRoot.set(newTreeId, subTreeStates)

		for (const [placeholderName, newSubTreeMarker] of newMarkerTree.subTrees) {
			const newState = this.stateInitializer.initializeSubTree(newSubTreeMarker)
			subTreeStates.set(placeholderName, newState)
		}
	}

	public updatePersistedData(response: ReceivedDataTree, operations: SubMutationOperation[]) {
		this.treeStore.mergeInMutationResponse(response, operations)
		if (this.skipStateUpdateAfterPersist) {
			return
		}
		this.eventManager.syncTransaction(() => {
			for (const rootStates of this.treeStore.subTreeStatesByRoot.values()) {
				// for (const rootPlaceholder in response) {
				// 	const rootState = rootStates.get(rootPlaceholder)
				//
				// 	if (rootState === undefined) {
				// 		continue
				// 	}
				// TODO the above would be better, only refreshing roots which participated in the mutation. However, due to
				// 	how mutations are currently generated, we cannot assume that only roots present in the response need
				// 	refreshed. So we just refresh all.
				for (const [rootPlaceholder, rootState] of rootStates) {
					const rootData = this.treeStore.subTreePersistedData.get(rootPlaceholder)

					if (rootState.type === 'entityList') {
						if (!(rootData instanceof Set)) {
							continue // This should never happen.
						}
						this.updateEntityListPersistedData(rootState, rootData)
					} else if (rootState.type === 'entityRealm') {
						if (rootData !== undefined && !(rootData instanceof ServerId)) {
							continue // This should never happen.
						}
						this.updateRealmIdIfNecessary(rootState, rootData)
						this.updateEntityRealmPersistedData(rootState)
					} else {
						return assertNever(rootState)
					}
				}
			}
		})
	}

	public resetCreatingSubTrees() {
		for (const rootStates of this.treeStore.subTreeStatesByRoot.values()) {
			for (const [rootPlaceholder, rootState] of rootStates) {
				if (rootState.type === 'entityList') {
					if (rootState.blueprint.parent !== undefined) {
						throw new BindingError('Entity list root should not have a parent.')
					}
					if (!rootState.blueprint.marker.parameters.isCreating) {
						continue
					}

					this.treeStore.subTreePersistedData.delete(rootPlaceholder)
					const changesCount = rootState.unpersistedChangesCount

					// Just emptying the list. But the list itself can stay.
					for (const childState of rootState.children.values()) {
						this.treeStore.disposeOfRealm(childState)
					}
					rootState.accessor = undefined
					rootState.children.clear()
					rootState.childrenWithPendingUpdates?.clear()
					rootState.errors = undefined
					rootState.plannedRemovals?.clear()

					this.eventManager.registerJustUpdated(
						rootState,
						changesCount ? -1 * changesCount : EventManager.NO_CHANGES_DIFFERENCE,
					)
				} else if (rootState.type === 'entityRealm') {
					if (rootState.blueprint.parent !== undefined) {
						throw new BindingError('Entity realm root should not have a parent.')
					}
					if (!rootState.blueprint.marker.parameters.isCreating) {
						continue
					}
					const presentListeners = rootState.eventListeners
					this.treeStore.disposeOfRealm(rootState)

					// It's crucial to delete the persisted data before we re-initialize so that we get a fresh, new entity.
					this.treeStore.subTreePersistedData.delete(rootPlaceholder)
					const newRootState = this.stateInitializer.initializeSubTree(rootState.blueprint.marker)

					// We preserve the previous listeners but purge some of them.
					newRootState.eventListeners = presentListeners
					OperationsHelpers.purgeStaleListenersAfterIdChange(newRootState as EntityRealmState)

					rootStates.set(rootPlaceholder, newRootState)

					this.eventManager.registerJustUpdated(newRootState, EventManager.NO_CHANGES_DIFFERENCE)
				} else {
					assertNever(rootState)
				}
			}
		}
	}

	private updateRealmIdIfNecessary(
		realm: EntityRealmState | EntityRealmStateStub,
		newId: ServerId | undefined | null,
	) {
		const currentId = realm.entity.id
		let idToChangeTo: RuntimeId | undefined = undefined

		if (currentId instanceof ServerId) {
			if (newId === undefined || newId === null) {
				idToChangeTo = new UnpersistedEntityDummyId()
			} else if (currentId.value !== newId.value) {
				idToChangeTo = newId
			}
		} else if (currentId instanceof ClientGeneratedUuid) {
			idToChangeTo = newId ?? new UnpersistedEntityDummyId()
		} else if (currentId instanceof UnpersistedEntityDummyId) {
			if (newId) {
				idToChangeTo = newId
			}
		} else {
			return assertNever(currentId)
		}
		if (idToChangeTo) {
			OperationsHelpers.changeRealmId(this.treeStore, this.eventManager, this.stateInitializer, realm, idToChangeTo)
		}
	}

	private updateEntityRealmPersistedData(realm: EntityRealmState) {
		const realmId = realm.entity.id
		const persistedData = realmId.existsOnServer ? this.treeStore.persistedEntityData.get(realmId.uniqueValue) : undefined

		for (const [placeholderName, child] of realm.children) {
			const childData = persistedData?.get(placeholderName)?.value

			switch (child.type) {
				case 'field': {
					if (childData instanceof ServerId || childData instanceof Set) {
						throw new BindingError()
					}

					if (child.persistedValue !== childData) {
						const shouldChangeBothValues = (child.persistedValue ?? null) === child.value

						child.persistedValue = childData
						if (shouldChangeBothValues) {
							child.value = childData ?? null
						}
						this.eventManager.registerJustUpdated(child, EventManager.NO_CHANGES_DIFFERENCE)
					}
					break
				}
				case 'entityRealm':
				case 'entityRealmStub': {
					if (!(childData instanceof ServerId) && childData !== undefined && childData !== null) {
						throw new BindingError()
					}
					this.updateRealmIdIfNecessary(child, childData)
					if (child.type === 'entityRealm') {
						this.updateEntityRealmPersistedData(child)
					}
					break
				}
				case 'entityList': {
					if (childData !== undefined && !(childData instanceof Set)) {
						throw new BindingError()
					}
					this.updateEntityListPersistedData(child, childData ?? new Set()) // TODO!!
					break
				}
				default: {
					return assertNever(child)
				}
			}
		}
	}

	private updateEntityListPersistedData(state: EntityListState, newPersistedIds: EntityListPersistedData) {
		const persistedWithoutState = new Set<EntityId>()

		for (const persistedId of newPersistedIds) {
			if (!state.children.has(persistedId)) {
				persistedWithoutState.add(persistedId)
			}
		}
		for (const [stateId, child] of state.children) {
			const childRuntimeId = child.entity.id
			if (!newPersistedIds.has(stateId)) {
				if (
					// It's a uuid but it's not among the persisted so either it got deleted/disconnected or the client-side
					// id generation didn't quite pan out.
					childRuntimeId instanceof ServerId ||
					childRuntimeId instanceof ClientGeneratedUuid ||
					// No persisted entity id to allocate to this so that's a goodbye.
					persistedWithoutState.size === 0 ||
					// not a persisted entity
					child.type === 'entityRealmStub' ||
					// We couldn't find a matching persisted entity
					!this.tryAssignIdToMatching(child, persistedWithoutState)
				) {
					state.getAccessor().disconnectEntity(child.getAccessor())
					continue
				}
			} else if (childRuntimeId instanceof ClientGeneratedUuid) {
				OperationsHelpers.changeRealmId(
					this.treeStore,
					this.eventManager,
					this.stateInitializer,
					child,
					new ServerId(childRuntimeId.value, child.entity.entityName),
				)
			}
			if (child.type === 'entityRealm') {
				this.updateEntityRealmPersistedData(child)
			}
		}
		for (const unclaimedPersistedId of persistedWithoutState) {
			this.stateInitializer.initializeEntityRealm(new ServerId(unclaimedPersistedId, state.entityName), state.entityName, {
				type: 'listEntity',
				parent: state,
			})
		}
		// All that remains now is the order.
		state.children.changeKeyOrder(newPersistedIds)
	}

	private tryAssignIdToMatching(realm: EntityRealmState, ids: Set<EntityId>) {
		for (const candidateId of ids) {
			if (this.isEntityMatching(realm, candidateId)) {
				OperationsHelpers.changeRealmId(
					this.treeStore,
					this.eventManager,
					this.stateInitializer,
					realm,
					new ServerId(candidateId, realm.entity.entityName),
				)
				ids.delete(candidateId)
				return true
			}
		}
		return false
	}

	private isEntityMatching(realm: EntityRealmState, id: EntityId) {
		const uniqueId = ServerId.formatUniqueValue(id, realm.entity.entityName)
		const persistedData = this.treeStore.persistedEntityData.get(uniqueId)
		const pathBack = this.treeStore.getPathBackToParent(realm)
		for (const [placeholderName, child] of realm.children) {
			const childData = persistedData?.get(placeholderName)?.value

			switch (child.type) {
				case 'field': {
					if (childData instanceof ServerId || childData instanceof Set) {
						throw new BindingError()
					}
					const value = child.value ?? child.fieldMarker.defaultValue ?? null
					if (value !== null && childData !== value) {
						return false
					}
					break
				}
				case 'entityRealm':
				case 'entityRealmStub': {
					if (!(childData instanceof ServerId) && childData !== undefined && childData !== null) {
						throw new BindingError()
					}
					if (child.entity.id.existsOnServer || child.entity.id instanceof ClientGeneratedUuid) {
						if (child.entity.id.value !== childData?.value) {
							return false
						}
					} else if (childData) {
						const marker = getEntityMarker(child)
						if (!(marker instanceof HasOneRelationMarker)) {
							throw new BindingError()
						}
						if (pathBack?.fieldBackToParent === marker.parameters.field) {
							continue
						}
						if (child.type !== 'entityRealm' || !this.isEntityMatching(child, childData.value)) {
							return false
						}
					} else if (child.type === 'entityRealmStub') {
						break
					} else {
						if (!this.isEmptyEntity(child)) {
							return false
						}
					}
					break
				}
				case 'entityList': {
					if (childData !== undefined && !(childData instanceof Set)) {
						throw new BindingError()
					}
					if (!childData){
						break
					}
					if (childData?.size !== child.children.size) {
						return false
					}
					const remainingIds = new Set(childData)

					// first check items with known ids
					for (const childItem of child.children.values()) {
						if ((childItem.entity.id.existsOnServer || childItem.entity.id instanceof ClientGeneratedUuid)) {
							if (!childData.has(childItem.entity.id.value)) {
								return false
							}
							remainingIds.delete(childItem.entity.id.value)
						}
					}

					// then check items with unknown ids
					for (const childItem of child.children.values()) {
						if (!(childItem.entity.id.existsOnServer || childItem.entity.id instanceof ClientGeneratedUuid) && childItem.type === 'entityRealm') {
							let hasMatch = false
							for (const id of remainingIds) {
								if (this.isEntityMatching(childItem, id)) {
									remainingIds.delete(id)
									hasMatch = true
									break
								}
							}
							if (!hasMatch) {
								return false
							}
						}
					}

					if (remainingIds.size !== 0) {
						return false
					}
					break
				}
				default: {
					return assertNever(child)
				}
			}
		}
		return true
	}

	private isEmptyEntity(entity: EntityRealmState) {
		const pathBack = this.treeStore.getPathBackToParent(entity)
		for (const [placeholderName, child] of entity.children) {
			if (child.type === 'field') {
				if (child.fieldMarker.isNonbearing) {
					continue
				}
				if ((child.value !== null || child.fieldMarker.defaultValue !== null)) {
					return false
				}
			} else if (child.type === 'entityRealm') {
				const marker = getEntityMarker(child)
				const isNonBearing = marker.parameters.isNonbearing
				if (isNonBearing) {
					continue
				}

				if (!(marker instanceof HasOneRelationMarker)) {
					throw new BindingError()
				}
				if (pathBack?.fieldBackToParent === marker.parameters.field) {
					continue
				}
				if (!this.isEmptyEntity(child)) {
					return false
				}
			} else if (child.type === 'entityList') {
				if (child.blueprint.marker.parameters.isNonbearing) {
					continue
				}
				for (const childItem of child.children.values()) {
					if (childItem.type === 'entityRealm' && !this.isEmptyEntity(childItem)) {
						return false
					}
				}
			}
		}
		return true
	}
}
