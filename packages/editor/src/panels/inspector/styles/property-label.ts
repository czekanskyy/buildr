import type { StylePropertyDef } from '@next-buildr/core';
import type { MessageKey, Translate } from '../../../messages/index.tsx';

export const propertyLabel = (def: StylePropertyDef, t: Translate): string =>
  t(`style.property.${def.group}.${def.name}` as MessageKey);
