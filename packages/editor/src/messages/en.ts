import { app } from './en/app.ts';
import { blocks } from './en/blocks.ts';
import { canvas } from './en/canvas.ts';
import { clipboard } from './en/clipboard.ts';
import { colorPicker } from './en/colorPicker.ts';
import { diagnostics } from './en/diagnostics.ts';
import { dialogCommon } from './en/dialogs/common.ts';
import { dialogConflict } from './en/dialogs/conflict.ts';
import { dialogDelete } from './en/dialogs/delete.ts';
import { dialogPageOptions } from './en/dialogs/pageOptions.ts';
import { dialogPublish } from './en/dialogs/publish.ts';
import { dnd } from './en/dnd.ts';
import { editor } from './en/editor.ts';
import { external } from './en/external.ts';
import { insert } from './en/insert.ts';
import { inspector } from './en/inspector.ts';
import { issues } from './en/issues.ts';
import { layers } from './en/layers.ts';
import { leftPanel } from './en/leftPanel.ts';
import { list } from './en/list.ts';
import { locale } from './en/locale.ts';
import { media } from './en/media.ts';
import { menu } from './en/menu.ts';
import { patterns } from './en/patterns.ts';
import { preview } from './en/preview.ts';
import { publish } from './en/publish.ts';
import { richText } from './en/richText.ts';
import { sample } from './en/sample.ts';
import { save } from './en/save.ts';
import { shortcut } from './en/shortcut.ts';
import { statusBar } from './en/statusBar.ts';
import { structure } from './en/structure.ts';
import { style } from './en/style.ts';
import { styleField } from './en/styleField.ts';
import { styleOption } from './en/styleOption.ts';
import { styleSection } from './en/styleSection.ts';
import { toast } from './en/toast.ts';
import { toolbar } from './en/toolbar.ts';
import { translation } from './en/translation.ts';
import { ui } from './en/ui.ts';
import { values } from './en/values.ts';

export const en = {
  ...app,
  ...blocks,
  ...canvas,
  ...clipboard,
  ...colorPicker,
  ...dialogCommon,
  ...dialogConflict,
  ...dialogDelete,
  ...dialogPageOptions,
  ...dialogPublish,
  ...diagnostics,
  ...dnd,
  ...editor,
  ...external,
  ...insert,
  ...inspector,
  ...issues,
  ...layers,
  ...leftPanel,
  ...list,
  ...locale,
  ...media,
  ...menu,
  ...patterns,
  ...preview,
  ...publish,
  ...richText,
  ...sample,
  ...save,
  ...shortcut,
  ...statusBar,
  ...structure,
  ...style,
  ...styleField,
  ...styleOption,
  ...styleSection,
  ...toast,
  ...toolbar,
  ...translation,
  ...ui,
  ...values,
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Readonly<Record<MessageKey, string>>;
