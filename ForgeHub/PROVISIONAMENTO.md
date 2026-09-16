# Provisionamento opcional da TV box

A entrada do ForgeHub apresenta “Provisionar TV box” e “Continuar sem provisionar”, preservando o tema e os componentes existentes. Continuar abre o Hub sem alterar a rede. A configuração também permanece acessível em Hardware.

## Redes

- Aberta, WPA/WPA2 pessoal (senha ou PSK hexadecimal), WPA3 SAE e OWE.
- EAP PEAP (MSCHAPV2/GTC), TTLS (MSCHAPV2/PAP/GTC), PWD e TLS.
- SSID manual para redes ocultas.
- PEAP/TTLS/TLS exigem domínio do servidor e verificação de CA: certificados confiáveis do sistema ou CA PEM enviada pelo usuário.
- TLS exige certificado de cliente e chave privada PEM sem senha, com correspondência validada.

A disponibilidade de WPA3/OWE e dos métodos EAP depende do wpa_supplicant, adaptador e driver. Não representa equivalência universal ao Android: SIM/AKA, TEAP, WEP, certificados DER/P12 e chaves PEM criptografadas não foram implementados.

## Aplicação

A API valida a configuração antes de alterar o rádio, impede tentativas simultâneas e grava perfis em /etc/wpa_supplicant/forge-profiles com diretório 0700 e arquivos 0600. O script recebe apenas o caminho do perfil; credenciais não aparecem nos argumentos de processos. Perfis de tentativas com falha são removidos. Perfis bem-sucedidos são retidos para os certificados continuarem disponíveis; não há coleta automática de perfis antigos.

O script limita associação e DHCP a 55 segundos e solicita restauração do AP em caso de falha. Sucesso requer saída com IP real; não usa mais IP fictício. O navegador acompanha /api/status e informa quando a mudança de rede impede confirmar a conexão. A restauração depende do controlador forge-ap-ctrl instalado e funcional.

## Validação e entrega

- npm run build: passou (TypeScript e Vite); artefatos incorporados em backend/cmd/forgehub/web_assets.
- go test ./...: passou, incluindo validação de redes, certificados TLS, rejeição de credenciais inválidas, concorrência, permissões e falhas de aplicação.
- bash -n hardware/network/apply_client.sh: passou.
- git diff --check: passou.
- go build: executável em /root/work/forgehub-provision.

A versão foi implantada e os endpoints HTTP e assets foram verificados. Foram capturadas as telas desktop e mobile. Não foi feita associação real a uma rede nem teste automatizado completo de interação. O backend e apply_client.sh devem ser implantados juntos, pois o script agora recebe um arquivo de configuração, em vez dos argumentos antigos. O destino esperado do script é /opt/forgehub/hardware/network/apply_client.sh. O serviço forgehub foi atualizado com backup prévio. A árvore de trabalho original /opt/multi-forge foi preservada.

Referência de configuração: https://android.googlesource.com/platform/external/wpa_supplicant_8/+/refs/heads/main/wpa_supplicant/wpa_supplicant.conf
