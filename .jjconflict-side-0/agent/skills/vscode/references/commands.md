# VS Code Commands Reference

## Editor Commands

### Cursor Movement

| Command        | Description                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cursorMove`   | Move cursor with options: `to` (left/right/up/down/wrappedLineStart/etc), `by` (line/character/wrappedLine), `value` (count), `select` (boolean) |
| `cursorHome`   | Go to beginning of line                                                                                                                          |
| `cursorEnd`    | Go to end of line                                                                                                                                |
| `cursorTop`    | Go to beginning of file                                                                                                                          |
| `cursorBottom` | Go to end of file                                                                                                                                |
| `cursorUndo`   | Undo last cursor operation                                                                                                                       |

### Text Editing

| Command                              | Description                 |
| ------------------------------------ | --------------------------- |
| `editor.action.clipboardCutAction`   | Cut line (empty selection)  |
| `editor.action.clipboardCopyAction`  | Copy line (empty selection) |
| `editor.action.clipboardPasteAction` | Paste                       |
| `editor.action.deleteLines`          | Delete line                 |
| `editor.action.insertLineAfter`      | Insert line below           |
| `editor.action.insertLineBefore`     | Insert line above           |
| `editor.action.moveLinesDownAction`  | Move line down              |
| `editor.action.moveLinesUpAction`    | Move line up                |
| `editor.action.copyLinesDownAction`  | Copy line down              |
| `editor.action.copyLinesUpAction`    | Copy line up                |
| `editor.action.indentLines`          | Indent line                 |
| `editor.action.outdentLines`         | Outdent line                |

### Transform Case

| Command                               | Description             |
| ------------------------------------- | ----------------------- |
| `editor.action.transformToUppercase`  | Transform to UPPERCASE  |
| `editor.action.transformToLowercase`  | Transform to lowercase  |
| `editor.action.transformToTitleCase`  | Transform to Title Case |
| `editor.action.transformToCamelCase`  | Transform to camelCase  |
| `editor.action.transformToPascalCase` | Transform to PascalCase |
| `editor.action.transformToSnakeCase`  | Transform to snake_case |
| `editor.action.transformToKebabCase`  | Transform to kebab-case |

### Selection

| Command                                             | Description                                 |
| --------------------------------------------------- | ------------------------------------------- |
| `editor.action.smartSelect.expand`                  | Expand selection                            |
| `editor.action.smartSelect.shrink`                  | Shrink selection                            |
| `editor.action.selectHighlights`                    | Select all occurrences of current selection |
| `editor.action.changeAll`                           | Select all occurrences of current word      |
| `expandLineSelection`                               | Select current line                         |
| `editor.action.insertCursorBelow`                   | Insert cursor below                         |
| `editor.action.insertCursorAbove`                   | Insert cursor above                         |
| `editor.action.insertCursorAtEndOfEachLineSelected` | Insert cursor at end of each line           |

### Multi-Cursor

| Command                                      | Description                            |
| -------------------------------------------- | -------------------------------------- |
| `editor.action.addSelectionToNextFindMatch`  | Add selection to next find match       |
| `editor.action.moveSelectionToNextFindMatch` | Move last selection to next find match |

### Comments

| Command                           | Description          |
| --------------------------------- | -------------------- |
| `editor.action.commentLine`       | Toggle line comment  |
| `editor.action.blockComment`      | Toggle block comment |
| `editor.action.addCommentLine`    | Add line comment     |
| `editor.action.removeCommentLine` | Remove line comment  |

### Folding

| Command                    | Description           |
| -------------------------- | --------------------- |
| `editor.fold`              | Fold region           |
| `editor.unfold`            | Unfold region         |
| `editor.toggleFold`        | Toggle fold region    |
| `editor.foldRecursively`   | Fold all subregions   |
| `editor.unfoldRecursively` | Unfold all subregions |
| `editor.foldAll`           | Fold all regions      |
| `editor.unfoldAll`         | Unfold all regions    |

### Find/Replace

| Command                                 | Description                          |
| --------------------------------------- | ------------------------------------ |
| `actions.find`                          | Find in file                         |
| `editor.action.startFindReplaceAction`  | Replace in file                      |
| `workbench.action.findInFiles`          | Find in files                        |
| `workbench.action.replaceInFiles`       | Replace in files                     |
| `editor.action.nextMatchFindAction`     | Find next                            |
| `editor.action.previousMatchFindAction` | Find previous                        |
| `editor.action.selectAllMatches`        | Select all occurrences of find match |

### Bracket Navigation

| Command                       | Description              |
| ----------------------------- | ------------------------ |
| `editor.action.jumpToBracket` | Jump to matching bracket |

## Navigation Commands

| Command                               | Description             |
| ------------------------------------- | ----------------------- |
| `workbench.action.quickOpen`          | Quick open / Go to file |
| `workbench.action.gotoSymbol`         | Go to symbol            |
| `workbench.action.gotoLine`           | Go to line              |
| `workbench.action.showAllSymbols`     | Show all symbols        |
| `editor.action.revealDefinition`      | Go to definition        |
| `editor.action.peekDefinition`        | Peek definition         |
| `editor.action.revealDefinitionAside` | Open definition to side |
| `editor.action.goToReferences`        | Go to references        |
| `editor.action.rename`                | Rename symbol           |
| `editor.action.triggerSuggest`        | Trigger suggest         |
| `editor.action.triggerParameterHints` | Trigger parameter hints |
| `workbench.action.navigateBack`       | Go back                 |
| `workbench.action.navigateForward`    | Go forward              |
| `editor.action.marker.nextInFiles`    | Go to next error        |
| `editor.action.marker.prevInFiles`    | Go to previous error    |

## Workbench Commands

| Command                                    | Description             |
| ------------------------------------------ | ----------------------- |
| `workbench.action.files.newUntitledFile`   | New file                |
| `workbench.action.files.openFile`          | Open file               |
| `workbench.action.files.save`              | Save                    |
| `workbench.action.files.saveAs`            | Save as                 |
| `workbench.action.files.saveAll`           | Save all                |
| `workbench.action.closeActiveEditor`       | Close editor            |
| `workbench.action.closeAllEditors`         | Close all editors       |
| `workbench.action.reopenClosedEditor`      | Reopen closed editor    |
| `workbench.action.splitEditor`             | Split editor            |
| `workbench.action.toggleSidebarVisibility` | Toggle sidebar          |
| `workbench.action.toggleFullScreen`        | Toggle full screen      |
| `workbench.action.toggleZenMode`           | Toggle zen mode         |
| `workbench.action.terminal.toggleTerminal` | Toggle terminal         |
| `workbench.action.openSettings`            | Open settings           |
| `workbench.action.openGlobalKeybindings`   | Open keyboard shortcuts |
| `workbench.action.selectTheme`             | Select color theme      |

## Debug Commands

| Command                                | Description           |
| -------------------------------------- | --------------------- |
| `editor.debug.action.toggleBreakpoint` | Toggle breakpoint     |
| `workbench.action.debug.start`         | Start debugging       |
| `workbench.action.debug.continue`      | Continue              |
| `workbench.action.debug.run`           | Run without debugging |
| `workbench.action.debug.pause`         | Pause                 |
| `workbench.action.debug.stepInto`      | Step into             |
| `workbench.action.debug.stepOver`      | Step over             |
| `workbench.action.debug.stepOut`       | Step out              |
| `workbench.action.debug.stop`          | Stop debugging        |

## Quick Fix & Code Actions

| Command                         | Description      |
| ------------------------------- | ---------------- |
| `editor.action.quickFix`        | Quick fix        |
| `editor.action.sourceAction`    | Source action    |
| `editor.action.organizeImports` | Organize imports |
| `editor.action.formatDocument`  | Format document  |
| `editor.action.formatSelection` | Format selection |
