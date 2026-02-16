# VHS tape for /skills screenshot
Output skills.png

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

# Open skill browser with slash command
Type "/skills"
Enter
Sleep 2s

Screenshot skills.png

# Exit
Escape
Sleep 500ms
Type "q"
Enter
