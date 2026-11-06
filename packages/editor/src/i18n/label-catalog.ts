/** The shape of a language's labels for what a component manifest carries in English. */
export interface LabelCatalog {
  /** Component type id -> name. */
  readonly components: Readonly<Record<string, string>>;
  /** Component type id -> short description. */
  readonly descriptions: Readonly<Record<string, string>>;
  /** Template id -> name. */
  readonly templates: Readonly<Record<string, string>>;
  /** The manifest's English slot label -> label. */
  readonly slots: Readonly<Record<string, string>>;
  /** Prop name -> label, for every component. */
  readonly commonProps: Readonly<Record<string, string>>;
  /** Component type id -> prop name -> label; wins over `commonProps`. */
  readonly props: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Prop name -> option value -> label. */
  readonly commonOptions: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** `<type id>/<prop name>` -> option value -> label; wins over `commonOptions`. */
  readonly options: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
