# VHS tape for /symbols screenshot
Output symbols.png

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

# Open symbol picker with Ctrl+T
Ctrl+t
Sleep 2s

Screenshot symbols.png

# Exit
Escape
Sleep 500ms
Type "q"
Enter
