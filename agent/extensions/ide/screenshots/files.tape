# VHS tape for /files screenshot
Output files.png

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

# Open file picker with Ctrl+P
Ctrl+p
Sleep 1s

Screenshot files.png

# Exit
Escape
Sleep 500ms
Type "q"
Enter
