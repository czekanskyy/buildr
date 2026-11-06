import type { ComponentMeta, PropDef, RegistryManifest, SlotDef } from '@next-buildr/core';
import { plLabels } from '../messages/pl/componentLabels.ts';
import type { LabelCatalog } from './label-catalog.ts';

const catalogs: Readonly<Record<string, LabelCatalog>> = { pl: plLabels };

/** The label catalog of a UI language (`pl-PL` reads as `pl`); `undefined` for English and unknown languages. */
export function labelCatalog(locale: string): LabelCatalog | undefined {
  const base = locale.split('-', 1)[0] ?? '';
  return Object.hasOwn(catalogs, base) ? catalogs[base] : undefined;
}

const pick = <T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined =>
  record !== undefined && Object.hasOwn(record, key) ? record[key] : undefined;

function localizeProp(catalog: LabelCatalog, type: string, name: string, def: PropDef): PropDef {
  const label = pick(pick(catalog.props, type), name) ?? pick(catalog.commonProps, name);
  let next: PropDef = label === undefined ? def : { ...def, label };
  if (def.kind === 'select') {
    const known = pick(catalog.options, `${type}/${name}`) ?? pick(catalog.commonOptions, name);
    if (known !== undefined) {
      const labels: Record<string, string> = { ...(def.optionLabels ?? {}) };
      for (const option of def.options) {
        const text = pick(known, String(option));
        if (text !== undefined) labels[String(option)] = text;
        else delete labels[String(option)];
      }
      next = { ...next, optionLabels: labels } as PropDef;
    }
  }
  return next;
}

function localizeComponent(catalog: LabelCatalog, meta: ComponentMeta): ComponentMeta {
  const label = pick(catalog.components, meta.type);
  const description = pick(catalog.descriptions, meta.type);
  const props = Object.fromEntries(
    Object.entries(meta.props).map(([name, def]) => [
      name,
      localizeProp(catalog, meta.type, name, def),
    ]),
  );
  const slots =
    meta.slots === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(meta.slots).map(([name, slot]): [string, SlotDef] => {
            const text = slot.label === undefined ? undefined : pick(catalog.slots, slot.label);
            return [name, text === undefined ? slot : { ...slot, label: text }];
          }),
        );
  return {
    ...meta,
    ...(label === undefined ? {} : { label }),
    ...(description === undefined ? {} : { description }),
    props,
    ...(slots === undefined ? {} : { slots }),
  };
}

const cache = new WeakMap<RegistryManifest, Map<string, RegistryManifest>>();

/**
 * The manifest with its English display text (component, template, prop, option and slot labels)
 * replaced by the UI language's own where the catalog has one; everything else, and every id and
 * value, is untouched. A language with no catalog gets the manifest itself.
 */
export function localizeManifest(manifest: RegistryManifest, locale: string): RegistryManifest {
  const catalog = labelCatalog(locale);
  if (catalog === undefined) return manifest;
  const base = locale.split('-', 1)[0] ?? locale;
  const byLocale = cache.get(manifest) ?? new Map<string, RegistryManifest>();
  cache.set(manifest, byLocale);
  const cached = byLocale.get(base);
  if (cached !== undefined) return cached;
  const localized: RegistryManifest = {
    ...manifest,
    components: Object.fromEntries(
      Object.entries(manifest.components).map(([type, meta]) => [
        type,
        localizeComponent(catalog, meta),
      ]),
    ),
    templates: Object.fromEntries(
      Object.entries(manifest.templates).map(([id, template]) => {
        const label = pick(catalog.templates, id);
        return [id, label === undefined ? template : { ...template, label }];
      }),
    ),
  };
  byLocale.set(base, localized);
  return localized;
}
