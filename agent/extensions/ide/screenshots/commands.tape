# VHS tape for /commands screenshot
Output commands.png

Set Shell "bash"
Set FontSize 14
Set Width 1400
Set Height 800
Set Theme "Catppuccin Mocha"

Hide
Type "cd /home/knoopx/.pi && pi"
Enter
Sleep 3s
Show

# Open command palette with slash command
Type "/commands"
Enter
Sleep 1s
Type "work"
Sleep 500ms

Screenshot commands.png

# Exit
Escape
Sleep 500ms
Type "q"
Enter
