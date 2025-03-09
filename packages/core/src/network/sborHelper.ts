import type {
  ProgrammaticScryptoSborValue,
  ProgrammaticScryptoSborValueMapEntry,
} from '@radixdlt/babylon-gateway-api-sdk'

const getEnumFields = (
  data: ProgrammaticScryptoSborValue,
): ProgrammaticScryptoSborValue[] | undefined => {
  if (data.kind === 'Enum') return data.fields
  return undefined
}

const getMapEntries = (
  data: ProgrammaticScryptoSborValue,
): ProgrammaticScryptoSborValueMapEntry[] | undefined => {
  if (data.kind === 'Map') return data.entries
  return undefined
}

const getTupleFields = (
  data: ProgrammaticScryptoSborValue,
): ProgrammaticScryptoSborValue[] | undefined => {
  if (data.kind === 'Tuple') return data.fields
  return
}

const getArrayElements = (
  data: ProgrammaticScryptoSborValue,
): ProgrammaticScryptoSborValue[] | undefined => {
  if (data.kind === 'Array') return data.elements
  return
}

const getStringFieldValue = (
  data: ProgrammaticScryptoSborValue,
): string | undefined => {
  if (data.kind === 'String') return data.value
  return
}

const getDecimalFieldValue = (
  data: ProgrammaticScryptoSborValue,
): string | undefined => {
  if (data.kind === 'Decimal') return data.value
  return
}

const getReferenceFieldValue = (
  data: ProgrammaticScryptoSborValue,
): string | undefined => {
  if (data.kind === 'Reference') return data.value
  return
}

export const SborHelper = {
  getEnumFields,
  getMapEntries,
  getTupleFields,
  getArrayElements,
  getStringFieldValue,
  getDecimalFieldValue,
  getReferenceFieldValue,
} as const
