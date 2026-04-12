# Helix Keymap Reference

## Normal Mode

### Movement

| Key          | Description             | Command                     |
| ------------ | ----------------------- | --------------------------- |
| `h`, `Left`  | Move left               | `move_char_left`            |
| `j`, `Down`  | Move down               | `move_visual_line_down`     |
| `k`, `Up`    | Move up                 | `move_visual_line_up`       |
| `l`, `Right` | Move right              | `move_char_right`           |
| `w`          | Next word start         | `move_next_word_start`      |
| `b`          | Previous word start     | `move_prev_word_start`      |
| `e`          | Next word end           | `move_next_word_end`        |
| `W`          | Next WORD start         | `move_next_long_word_start` |
| `B`          | Previous WORD start     | `move_prev_long_word_start` |
| `E`          | Next WORD end           | `move_next_long_word_end`   |
| `t`<char>    | Find till next char     | `find_till_char`            |
| `f`<char>    | Find next char          | `find_next_char`            |
| `T`<char>    | Find till previous char | `till_prev_char`            |
| `F`<char>    | Find previous char      | `find_prev_char`            |
| `G`<n>       | Go to line n            | `goto_line`                 |
| `Alt-.`      | Repeat last motion      | `repeat_last_motion`        |
| `Home`       | Line start              | `goto_line_start`           |
| `End`        | Line end                | `goto_line_end`             |
| `Ctrl-b`     | Page up                 | `page_up`                   |
| `Ctrl-f`     | Page down               | `page_down`                 |
| `Ctrl-u`     | Half page up            | `page_cursor_half_up`       |
| `Ctrl-d`     | Half page down          | `page_cursor_half_down`     |
| `Ctrl-i`     | Jump forward            | `jump_forward`              |
| `Ctrl-o`     | Jump backward           | `jump_backward`             |
| `Ctrl-s`     | Save to jumplist        | `save_selection`            |

### Changes

| Key            | Description            | Command                   |
| -------------- | ---------------------- | ------------------------- |
| `r`<char>      | Replace with char      | `replace`                 |
| `R`            | Replace with yanked    | `replace_with_yanked`     |
| `~`            | Switch case            | `switch_case`             |
| `` ` ``        | Lowercase              | `switch_to_lowercase`     |
| `Alt-` `` ` `` | Uppercase              | `switch_to_uppercase`     |
| `i`            | Insert before          | `insert_mode`             |
| `a`            | Append after           | `append_mode`             |
| `I`            | Insert at line start   | `insert_at_line_start`    |
| `A`            | Insert at line end     | `insert_at_line_end`      |
| `o`            | Open below             | `open_below`              |
| `O`            | Open above             | `open_above`              |
| `.`            | Repeat last insert     | N/A                       |
| `u`            | Undo                   | `undo`                    |
| `U`            | Redo                   | `redo`                    |
| `Alt-u`        | Earlier in history     | `earlier`                 |
| `Alt-U`        | Later in history       | `later`                   |
| `y`            | Yank                   | `yank`                    |
| `p`            | Paste after            | `paste_after`             |
| `P`            | Paste before           | `paste_before`            |
| `"`<reg>       | Select register        | `select_register`         |
| `>`            | Indent                 | `indent`                  |
| `<`            | Unindent               | `unindent`                |
| `=`            | Format (**LSP**)       | `format_selections`       |
| `d`            | Delete                 | `delete_selection`        |
| `Alt-d`        | Delete no yank         | `delete_selection_noyank` |
| `c`            | Change (delete+insert) | `change_selection`        |
| `Alt-c`        | Change no yank         | `change_selection_noyank` |
| `Ctrl-a`       | Increment              | `increment`               |
| `Ctrl-x`       | Decrement              | `decrement`               |

### Shell Commands

| Key      | Description            | Command               |
| -------- | ---------------------- | --------------------- |
| `\|`     | Pipe through shell     | `shell_pipe`          |
| `Alt-\|` | Pipe to shell (ignore) | `shell_pipe_to`       |
| `!`      | Insert output          | `shell_insert_output` |
| `Alt-!`  | Append output          | `shell_append_output` |
| `$`      | Keep if exit 0         | `shell_keep_pipe`     |

### Selection Manipulation

| Key      | Description               | Command                              |
| -------- | ------------------------- | ------------------------------------ |
| `s`      | Select regex matches      | `select_regex`                       |
| `S`      | Split on regex            | `split_selection`                    |
| `Alt-s`  | Split on newlines         | `split_selection_on_newline`         |
| `Alt--`  | Merge selections          | `merge_selections`                   |
| `Alt-_`  | Merge consecutive         | `merge_consecutive_selections`       |
| `&`      | Align columns             | `align_selections`                   |
| `_`      | Trim whitespace           | `trim_selections`                    |
| `;`      | Collapse to cursor        | `collapse_selection`                 |
| `Alt-;`  | Flip selection            | `flip_selections`                    |
| `Alt-:`  | Ensure forward            | `ensure_selections_forward`          |
| `,`      | Keep primary              | `keep_primary_selection`             |
| `Alt-,`  | Remove primary            | `remove_primary_selection`           |
| `C`      | Copy to next line         | `copy_selection_on_next_line`        |
| `Alt-C`  | Copy to prev line         | `copy_selection_on_prev_line`        |
| `(`      | Rotate backward           | `rotate_selections_backward`         |
| `)`      | Rotate forward            | `rotate_selections_forward`          |
| `Alt-(`  | Rotate contents back      | `rotate_selection_contents_backward` |
| `Alt-)`  | Rotate contents fwd       | `rotate_selection_contents_forward`  |
| `%`      | Select all                | `select_all`                         |
| `x`      | Extend line               | `extend_line_below`                  |
| `X`      | Line-wise                 | `extend_to_line_bounds`              |
| `Alt-x`  | Shrink line-wise          | `shrink_to_line_bounds`              |
| `J`      | Join lines                | `join_selections`                    |
| `Alt-J`  | Join with space           | `join_selections_space`              |
| `K`      | Keep matching             | `keep_selections`                    |
| `Alt-K`  | Remove matching           | `remove_selections`                  |
| `Ctrl-c` | Toggle comment            | `toggle_comments`                    |
| `Alt-o`  | Expand selection (**TS**) | `expand_selection`                   |
| `Alt-i`  | Shrink selection (**TS**) | `shrink_selection`                   |
| `Alt-p`  | Prev sibling (**TS**)     | `select_prev_sibling`                |
| `Alt-n`  | Next sibling (**TS**)     | `select_next_sibling`                |
| `Alt-a`  | All siblings (**TS**)     | `select_all_siblings`                |
| `Alt-I`  | All children (**TS**)     | `select_all_children`                |

### Search

| Key     | Description             | Command                                   |
| ------- | ----------------------- | ----------------------------------------- |
| `/`     | Search forward          | `search`                                  |
| `?`     | Search backward         | `rsearch`                                 |
| `n`     | Next match              | `search_next`                             |
| `N`     | Previous match          | `search_prev`                             |
| `*`     | Search selection (word) | `search_selection_detect_word_boundaries` |
| `Alt-*` | Search selection        | `search_selection`                        |

### Minor Modes

Accessed from normal mode:

| Key      | Mode    | Description              |
| -------- | ------- | ------------------------ |
| `v`      | Select  | Enter select/extend mode |
| `g`      | Goto    | Jump to locations        |
| `m`      | Match   | Surround/textobjects     |
| `:`      | Command | Typable commands         |
| `z`      | View    | Scrolling/view           |
| `Z`      | View    | Sticky view mode         |
| `Ctrl-w` | Window  | Split/window ops         |
| `Space`  | Space   | Pickers/LSP              |

#### Goto Mode (`g`)

| Key | Action                         |
| --- | ------------------------------ |
| `g` | File start                     |
| `e` | File end                       |
| `f` | Go to file                     |
| `d` | Go to definition (**LSP**)     |
| `y` | Go to type def (**LSP**)       |
| `r` | Go to references (**LSP**)     |
| `i` | Go to implementation (**LSP**) |
| `n` | Next buffer                    |
| `p` | Previous buffer                |
| `.` | Last modification              |

#### Match Mode (`m`)

| Key           | Action                    |
| ------------- | ------------------------- |
| `m`           | Matching bracket (**TS**) |
| `s`<char>     | Surround with char        |
| `r`<from><to> | Replace surround          |
| `d`<char>     | Delete surround           |
| `a`<obj>      | Select around textobject  |
| `i`<obj>      | Select inside textobject  |

Textobjects: `w` (word), `p` (paragraph), `(`, `[`, `'` (pairs), `m` (auto), `f` (function), `t` (type), `a` (arg), `c` (comment), `T` (test), `g` (change).

#### Window Mode (`Ctrl-w`)

| Key             | Action                  |
| --------------- | ----------------------- |
| `w`             | Rotate view             |
| `v`             | Vertical split          |
| `s`             | Horizontal split        |
| `h`/`j`/`k`/`l` | Jump left/down/up/right |
| `q`             | Close window            |
| `o`             | Only this window        |
| `H`/`J`/`K`/`L` | Swap left/down/up/right |

#### Space Mode (`Space`)

| Key  | Action                          |
| ---- | ------------------------------- |
| `f`  | File picker (root)              |
| `F`  | File picker (cwd)               |
| `b`  | Buffer picker                   |
| `j`  | Jumplist picker                 |
| `g`  | Changed file picker             |
| `s`  | Document symbols (**LSP**)      |
| `S`  | Workspace symbols (**LSP**)     |
| `d`  | Diagnostics (**LSP**)           |
| `D`  | Workspace diagnostics (**LSP**) |
| `k`  | Hover doc (**LSP**)             |
| `a`  | Code action (**LSP**)           |
| `r`  | Rename symbol (**LSP**)         |
| `h`  | Select references (**LSP**)     |
| `\|` | Global search                   |
| `?`  | Command palette                 |
| `y`  | Yank to clipboard               |
| `p`  | Paste clipboard                 |
| `c`  | Toggle comment                  |

### Unimpaired-style Navigation

| Key       | Action                      |
| --------- | --------------------------- |
| `]d`/`[d` | Next/prev diagnostic        |
| `]f`/`[f` | Next/prev function (**TS**) |
| `]t`/`[t` | Next/prev type (**TS**)     |
| `]a`/`[a` | Next/prev param (**TS**)    |
| `]c`/`[c` | Next/prev comment (**TS**)  |
| `]T`/`[T` | Next/prev test (**TS**)     |
| `]p`/`[p` | Next/prev paragraph         |
| `]g`/`[g` | Next/prev change            |

## Insert Mode

| Key      | Action           |
| -------- | ---------------- |
| `Esc`    | Normal mode      |
| `Ctrl-s` | Commit undo      |
| `Ctrl-x` | Autocomplete     |
| `Ctrl-r` | Insert register  |
| `Ctrl-w` | Delete prev word |
| `Alt-d`  | Delete next word |
| `Ctrl-u` | Delete to start  |
| `Ctrl-k` | Delete to end    |
| `Ctrl-h` | Delete prev char |
| `Ctrl-d` | Delete next char |
| `Ctrl-j` | Newline          |

## Select/Extend Mode

| Key           | Action                           |
| ------------- | -------------------------------- |
| `Esc`         | Exit select mode                 |
| `v`           | Exit select mode                 |
| `i`           | Insert before                    |
| `a`           | Append after                     |
| All movements | Extend selection instead of move |

## Picker Keys

| Key               | Action             |
| ----------------- | ------------------ |
| `j`/`k`           | Next/prev entry    |
| `Ctrl-n`/`Ctrl-p` | Next/prev          |
| `Enter`           | Open selected      |
| `Alt-Enter`       | Open in background |
| `Ctrl-s`          | Open horizontal    |
| `Ctrl-v`          | Open vertical      |
| `Ctrl-t`          | Toggle preview     |
| `Esc`             | Close              |

## Prompt Keys

| Key               | Action            |
| ----------------- | ----------------- |
| `Ctrl-a`/`Ctrl-e` | Start/end         |
| `Ctrl-w`          | Delete prev word  |
| `Ctrl-u`          | Delete to start   |
| `Ctrl-k`          | Delete to end     |
| `Ctrl-p`/`Ctrl-n` | Prev/next history |
| `Ctrl-r`          | Insert register   |
| `Tab`             | Next completion   |
