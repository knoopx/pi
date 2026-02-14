# VHS tape for /changes screenshot
Output changes.png

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

# Open changes browser using the command
Type "/changes"
Enter
Sleep 2s

Screenshot changes.png

# Exit
Escape
Sleep 500ms
Type "q"
Enter
