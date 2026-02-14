# VHS tape for /bookmarks screenshot
Output bookmarks.png

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

# Open bookmarks browser using the command
Type "/bookmarks"
Enter
Sleep 2s

Screenshot bookmarks.png

# Exit
Escape
Sleep 500ms
Type "q"
Enter
