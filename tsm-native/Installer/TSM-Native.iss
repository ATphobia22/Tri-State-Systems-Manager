#define MyAppName "Tri-State Systems Manager"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Tri-State Systems Manager"
#define MyAppExeName "TSMNative.exe"

[Setup]
AppId={{8D31A4E8-6B8C-4C4C-A6F5-000000000001}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Tri-State Systems Manager
DefaultGroupName=Tri-State Systems Manager
OutputDir=..\..\dist\installer
OutputBaseFilename=TSM-Native-Setup-{#MyAppVersion}-windows-x64
Compression=lzma2
SolidCompression=yes
SetupArchitecture=x64
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardStyle=modern

[Files]
Source: "..\..\dist\tsm-native\Windows\TSMNative\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\Tri-State Systems Manager"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Tri-State Systems Manager"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Registry]
Root: HKCR; Subkey: ".tsmproj"; ValueType: string; ValueName: ""; ValueData: "TSMNative.Project"; Flags: uninsdeletevalue
Root: HKCR; Subkey: "TSMNative.Project"; ValueType: string; ValueName: ""; ValueData: "Tri-State Systems Manager Project"; Flags: uninsdeletekey
Root: HKCR; Subkey: "TSMNative.Project\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"
Root: HKCR; Subkey: "TSMNative.Project\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKCR; Subkey: ".pmtiles"; ValueType: string; ValueName: ""; ValueData: "TSMNative.PMTiles"; Flags: uninsdeletevalue
Root: HKCR; Subkey: "TSMNative.PMTiles"; ValueType: string; ValueName: ""; ValueData: "PMTiles Archive"; Flags: uninsdeletekey
Root: HKCR; Subkey: "TSMNative.PMTiles\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"
Root: HKCR; Subkey: "TSMNative.PMTiles\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""

[UninstallDelete]
Type: filesandordirs; Name: "{app}\Saved"
