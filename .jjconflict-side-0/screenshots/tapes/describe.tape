Output describe.png
Set Shell "bash"
Set FontSize 14
Set Width 1400
Set Height 800
Set Theme { "name": "custom", "black": "#101033", "red": "#ff628c", "green": "#a5ff90", "yellow": "#fad000", "blue": "#ff6565", "purple": "#faefa5", "cyan": "#2feeda", "white": "#f8f8f8", "brightBlack": "#3e3e76", "brightRed": "#ff628c", "brightGreen": "#a5ff90", "brightYellow": "#fad000", "brightBlue": "#ff6565", "brightPurple": "#faefa5", "brightCyan": "#2feeda", "brightWhite": "#fad000", "background": "#101033", "foreground": "#f8f8f8", "selectionBackground": "#24245d", "cursorAccent": "#f8f8f8", "cursor": "#f8f8f8" }

Type "cd /tmp/pi-demo && pi -ne --no-tools --no-session --no-skills --no-prompt-templates -e ~/.pi/agent/extensions/ide"
Enter
Wait+Screen /\[Extensions\]/

Type "/changes"
Enter
Wait+Screen /Stack/
Space
Down
Space
Type "d"
Wait+Screen /Descri/
Screenshot describe.png
