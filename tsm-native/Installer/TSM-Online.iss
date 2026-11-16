; TSM optional online bootstrapper. Does not install the application itself.
; Built only with an exact release tag and SHA-256 of an already signed offline Setup.
#ifndef TSMVersion
  #error TSMVersion must be provided by Build-TSMOnlineInstaller.ps1
#endif
#ifndef TSMReleaseTag
  #error TSMReleaseTag must be provided by Build-TSMOnlineInstaller.ps1
#endif
#ifndef TSMOfflineSha256
  #error TSMOfflineSha256 must be provided by Build-TSMOnlineInstaller.ps1
#endif
#define TSMOfflineFile "TSM-Native-Setup-" + TSMVersion + "-windows-x64.exe"
#define TSMReleaseURL "https://github.com/ATphobia22/Tri-State-Systems-Manager/releases/download/" + TSMReleaseTag + "/" + TSMOfflineFile

[Setup]
AppId={{3CB6FF0E-D8AA-422C-8A77-9D4B24F8B976}
AppName=Tri-State Systems Manager Online Installer
AppVersion={#TSMVersion}
AppPublisher=Tri-State Systems Manager
DefaultDirName={autopf}\Tri-State Systems Manager
OutputBaseFilename=TSM-Online-Setup-{#TSMVersion}-windows-x64
OutputDir=..\..\dist\online-installer
SetupArchitecture=x64
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CreateAppDir=no
Uninstallable=no
CreateUninstallRegKey=no
PrivilegesRequired=lowest
CloseApplications=no
WizardStyle=modern
DisableProgramGroupPage=yes
Compression=lzma2
SolidCompression=yes

[Code]
var
  DownloadPage: TDownloadWizardPage;

procedure InitializeWizard;
begin
  DownloadPage := CreateDownloadPage(
    'Download the verified offline installation package',
    'An internet connection is required for this download only. The installed TSM application operates offline.',
    nil);
  DownloadPage.ShowBaseNameInsteadOfUrl := True;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  InstalledSetup: String;
  ExitCode: Integer;
begin
  Result := '';
  DownloadPage.Clear;
  DownloadPage.Add('{#TSMReleaseURL}', '{#TSMOfflineFile}', '{#TSMOfflineSha256}');
  DownloadPage.Show;
  try
    try
      DownloadPage.Download;
    except
      Result := 'Download failed or the pinned SHA-256 did not match. ' +
        'No downloaded executable was run. Use the full offline installer as an alternative.';
      Log('TSM online installer download/hash verification failed: ' + GetExceptionMessage);
      Exit;
    end;
  finally
    DownloadPage.Hide;
  end;

  InstalledSetup := ExpandConstant('{tmp}\{#TSMOfflineFile}');
  if not FileExists(InstalledSetup) then
  begin
    Result := 'The verified offline setup file is unavailable. No installer was launched.';
    Exit;
  end;

  // The offline installer has been SHA-256-verified against the immutable
  // digest compiled into this bootstrapper. It retains its own native
  // Authenticode and UE prerequisite checks.
  if not Exec(InstalledSetup, '', '', SW_SHOWNORMAL, ewWaitUntilTerminated, ExitCode) then
  begin
    Result := 'The offline installer could not be launched.';
    Exit;
  end;
  if (ExitCode = 3010) or (ExitCode = 1641) then
  begin
    NeedsRestart := True;
    Exit;
  end;
  if ExitCode <> 0 then
    Result := Format('The offline installer exited with code %d. Review the installation log.', [ExitCode]);
end;
