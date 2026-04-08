Set WshShell = CreateObject("WScript.Shell") 
WshShell.Run "cmd /c cd /d C:\dreamlab ^&^& npx next start", 0, False 
