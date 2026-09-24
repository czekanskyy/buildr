/** One SVG shape: its tag and attributes, as they appear in the source icon. */
export type IconShape = readonly [tag: string, attributes: Readonly<Record<string, string>>];
export type IconNode = readonly IconShape[];
