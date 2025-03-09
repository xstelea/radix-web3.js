import type {
  EventsItem,
  ProgrammaticScryptoSborValue,
} from '@radixdlt/babylon-gateway-api-sdk'

export type EventEmitter = {
  entity: {
    entity_address: string
    entity_type: string
    is_global: boolean
  }
  type: string
  object_module_id: string
}

export type GetValuesFromEventInput = Parameters<typeof getValuesFromEvent>[0]

const DataKind = {
  String: 'String',
  Reference: 'Reference',
  Decimal: 'Decimal',
  ResourceAddress: 'ResourceAddress',
  Array: 'Array',
  Tuple: 'Tuple',
  NonFungibleLocalId: 'NonFungibleLocalId',
  Map: 'Map',
} as const

type DataKindTransform = {
  [K in keyof typeof DataKind]: {
    key?: string
    kind: (typeof DataKind)[K]
    transform?: (value: unknown) => unknown
  }
}
type DataKindTransformValues = DataKindTransform[keyof DataKindTransform]

export const getValuesFromEvent = (
  keys: Record<string, DataKindTransformValues>,
  event: EventsItem,
): Record<keyof typeof keys, unknown> => {
  const getEventDataFields = (
    input: ProgrammaticScryptoSborValue,
  ): ProgrammaticScryptoSborValue[] => {
    if (input.kind === 'Tuple') return input.fields
    else if (input.kind === 'Enum') return input.fields
    return []
  }

  return getEventDataFields(event.data).reduce<Record<string, unknown>>(
    (acc, field) => {
      if (
        field.field_name &&
        (field.kind === 'Array' ||
          field.kind === 'Tuple' ||
          field.kind === 'Map')
      ) {
        const key = keys[field.field_name]
        if (key?.kind === field.kind)
          acc[key.key ?? field.field_name] = key.transform
            ? key.transform(field)
            : JSON.stringify(field)
      } else if (
        field.field_name &&
        field.kind !== 'Array' &&
        field.kind !== 'Tuple' &&
        field.kind !== 'Map'
      ) {
        const key = keys[field.field_name]
        if (key?.kind === field.kind)
          acc[key.key ?? field.field_name] = field.value
      } else if (
        field.type_name &&
        field.kind !== 'Array' &&
        field.kind !== 'Tuple' &&
        field.kind !== 'Map'
      ) {
        const key = keys[field.type_name]
        if (key?.kind === field.kind)
          acc[key.key ?? field.type_name] = field.value
      }

      return acc
    },
    {},
  )
}
