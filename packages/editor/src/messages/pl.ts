import type { Messages } from './en.ts';
import { app } from './pl/app.ts';
import { blocks } from './pl/blocks.ts';
import { canvas } from './pl/canvas.ts';
import { clipboard } from './pl/clipboard.ts';
import { colorPicker } from './pl/colorPicker.ts';
import { diagnostics } from './pl/diagnostics.ts';
import { dialogCommon } from './pl/dialogs/common.ts';
import { dialogConflict } from './pl/dialogs/conflict.ts';
import { dialogDelete } from './pl/dialogs/delete.ts';
import { dialogPageOptions } from './pl/dialogs/pageOptions.ts';
import { dialogPublish } from './pl/dialogs/publish.ts';
import { dnd } from './pl/dnd.ts';
import { editor } from './pl/editor.ts';
import { external } from './pl/external.ts';
import { insert } from './pl/insert.ts';
import { inspector } from './pl/inspector.ts';
import { issues } from './pl/issues.ts';
import { layers } from './pl/layers.ts';
import { leftPanel } from './pl/leftPanel.ts';
import { list } from './pl/list.ts';
import { locale } from './pl/locale.ts';
import { media } from './pl/media.ts';
import { menu } from './pl/menu.ts';
import { patterns } from './pl/patterns.ts';
import { preview } from './pl/preview.ts';
import { publish } from './pl/publish.ts';
import { richText } from './pl/richText.ts';
import { sample } from './pl/sample.ts';
import { save } from './pl/save.ts';
import { shortcut } from './pl/shortcut.ts';
import { statusBar } from './pl/statusBar.ts';
import { structure } from './pl/structure.ts';
import { style } from './pl/style.ts';
import { styleField } from './pl/styleField.ts';
import { styleOption } from './pl/styleOption.ts';
import { styleSection } from './pl/styleSection.ts';
import { toast } from './pl/toast.ts';
import { toolbar } from './pl/toolbar.ts';
import { translation } from './pl/translation.ts';
import { ui } from './pl/ui.ts';
import { values } from './pl/values.ts';

export const pl: Messages = {
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
};
