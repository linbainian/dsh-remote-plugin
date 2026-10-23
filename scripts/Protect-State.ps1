param([Parameter(Mandatory=$true)][string]$StateDirectory)
$ErrorActionPreference = 'Stop'
$StateDirectory = [IO.Path]::GetFullPath($StateDirectory).TrimEnd([IO.Path]::DirectorySeparatorChar)
if ($StateDirectory -eq [IO.Path]::GetPathRoot($StateDirectory).TrimEnd([IO.Path]::DirectorySeparatorChar) -or $StateDirectory -eq $env:USERPROFILE -or $StateDirectory -eq (Join-Path $env:USERPROFILE '.dsh')) {
    throw 'Refusing to change ACLs on a root or user data directory.'
}
New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
$dshIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$dshSecurity = New-Object Security.AccessControl.DirectorySecurity
$dshSecurity.SetOwner($dshIdentity)
$dshSecurity.SetAccessRuleProtection($true, $false)
foreach ($dshSid in @($dshIdentity, (New-Object Security.Principal.SecurityIdentifier('S-1-5-18')))) {
    $dshRule = New-Object Security.AccessControl.FileSystemAccessRule($dshSid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $dshSecurity.AddAccessRule($dshRule)
}
if ([IO.Directory].GetMethods().Name -contains 'SetAccessControl') {
    [IO.Directory]::SetAccessControl($StateDirectory, $dshSecurity)
} else {
    [IO.FileSystemAclExtensions]::SetAccessControl((New-Object IO.DirectoryInfo($StateDirectory)), $dshSecurity)
}
