$dest = "C:\Users\Aluno\Documents\Fases_Provisionamento_ForgeOS"
$srcCore = "C:\Users\Aluno\Documents\multi-forge\ForgeCore\docs\design-shots"
$srcBrain = "C:\Users\Aluno\.gemini\antigravity-cli\brain\4c3e4e04-77da-4835-921b-f9e8ebb7f036"

if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
}

# 1. Kiosk TV Box HDMI (/dev/fb0 - 1080p Framebuffer)
Copy-Item -Path "$srcCore\shot-ap_solo.png" -Destination "$dest\Fase_01_TVBox_HDMI_Modo_AP_Pareamento.png" -Force
Copy-Item -Path "$srcCore\shot-peer.png" -Destination "$dest\Fase_02_TVBox_HDMI_Dispositivo_Conectado.png" -Force
Copy-Item -Path "$srcCore\shot-applying.png" -Destination "$dest\Fase_03_TVBox_HDMI_Aplicando_Credenciais.png" -Force
Copy-Item -Path "$srcCore\shot-connected.png" -Destination "$dest\Fase_04_TVBox_HDMI_Operacional_Conectado.png" -Force
Copy-Item -Path "$srcCore\shot-failed.png" -Destination "$dest\Fase_05_TVBox_HDMI_Contingencia_Rollback_AP.png" -Force

# 2. Portal de Provisionamento no Dispositivo (Web / Celular)
Copy-Item -Path "$srcBrain\forgehub_hardware_ap_robust.png" -Destination "$dest\Fase_06_Portal_Web_Descoberta_Redes.png" -Force
Copy-Item -Path "$srcCore\portal-eap.png" -Destination "$dest\Fase_07_Portal_Web_Configuracao_EAP_PSK.png" -Force
Copy-Item -Path "$srcCore\portal-dark.png" -Destination "$dest\Fase_08_Portal_Web_Portal_Dark_Mobile.png" -Force

# 3. Servidor Central ForgeHub (Edge Appliance & Telemetria)
Copy-Item -Path "$srcBrain\forgehub_ap_robust_live.png" -Destination "$dest\Fase_09_ForgeHub_Servidor_Dashboard_Telemetria.png" -Force
Copy-Item -Path "$srcBrain\forgehub_modules_screen_live.png" -Destination "$dest\Fase_10_ForgeHub_Servidor_Gestao_Modulos_Edge.png" -Force

Write-Host "Arquivos copiados com sucesso para ${dest}:"
Get-ChildItem -Path $dest | Select-Object Name, Length, LastWriteTime | Format-Table
