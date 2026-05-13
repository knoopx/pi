import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createBookmarkPromptComponent } from "./component";
import { setBookmarkToChange } from "../../jj/bookmarks";

export const promptAndSetBookmark = (
  pi: ExtensionAPI,
): ((ctx: ExtensionContext, changeId: string) => Promise<string | null>) => {
  return async (
    ctx: ExtensionContext,
    changeId: string,
  ): Promise<string | null> => {
    if (!ctx.hasUI) return null;
    const bookmarkName = await ctx.ui.custom<string | null>(
      (tui, _theme, _keybindings, done) => {
        return createBookmarkPromptComponent({
          pi,
          tui,
          theme: _theme,
          done,
          cwd: ctx.cwd,
        });
      },
      {
        overlay: true,
        overlayOptions: {
          width: "56%",
          minWidth: 48,
          maxHeight: 12,
          anchor: "center",
        },
      },
    );

    if (bookmarkName === null) return null;

    await setBookmarkToChange(pi, ctx.cwd, bookmarkName, changeId);
    return bookmarkName;
  };
};
