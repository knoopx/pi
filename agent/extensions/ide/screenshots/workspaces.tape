# VHS tape for /workspaces screenshot
Output workspaces.png

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

# Open workspaces with Ctrl+J
Ctrl+j
Sleep 1s

Screenshot workspaces.png

# Exit
Escape
Sleep 500ms
Type "q"
Enter
