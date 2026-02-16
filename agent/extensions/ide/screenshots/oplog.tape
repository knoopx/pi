# VHS tape for /oplog screenshot
Output oplog.png

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

# Open oplog browser using the command
Type "/oplog"
Enter
Sleep 2s

Screenshot oplog.png

# Exit
Escape
Sleep 500ms
Type "q"
Enter
