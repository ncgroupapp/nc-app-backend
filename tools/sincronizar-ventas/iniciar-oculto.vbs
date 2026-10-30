' Corre el sincronizador sin ventana. Lo usa instalar-inicio.bat para que arranque con Windows.
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = here
shell.Run "node """ & here & "\sincronizar-ventas.mjs""", 0, False
