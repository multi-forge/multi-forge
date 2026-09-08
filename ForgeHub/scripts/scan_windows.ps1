Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Devices.WiFi.WiFiAdapter,Windows.Devices.WiFi,ContentType=WindowsRuntime] | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
})[0]

$asTask = $asTaskGeneric.MakeGenericMethod([System.Collections.Generic.IReadOnlyList[Windows.Devices.WiFi.WiFiAdapter]])
$op = [Windows.Devices.WiFi.WiFiAdapter]::FindAllAdaptersAsync()
$adapters = $asTask.Invoke($null, @($op)).Result

if ($adapters.Count -gt 0) {
    $adapter = $adapters[0]
    Write-Host "Triggering hardware scan on $($adapter.NetworkAdapter.NetworkAdapterId)..."
    $scanOp = $adapter.ScanAsync()
    $scanTask = [System.WindowsRuntimeSystemExtensions]::AsTask($scanOp)
    $scanTask.Wait()
    Write-Host "Scan completed. Found $($adapter.NetworkReport.AvailableNetworks.Count) networks:"
    $adapter.NetworkReport.AvailableNetworks | Select-Object Ssid, Bssid, SignalBars, NetworkRssiInDecibelMilliwatts, ChannelCenterFrequencyInKilohertz | Format-Table
} else {
    Write-Host "No WiFi adapter found."
}
