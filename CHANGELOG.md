# Changelog

## Não lançado

### Adicionado
- Tela inicial com as opções **Provisionar TV box** e **Continuar sem provisionar**, mantendo o tema do ForgeHub e o acesso posterior por Hardware.
- Configuração de redes abertas, WPA/WPA2 pessoal, WPA3 SAE e OWE, incluindo entrada manual de SSID.
- Formulário EAP para PEAP, TTLS, PWD e TLS, com identidade, autenticação interna, domínio e upload de certificados PEM.
- Validação de certificados e correspondência entre certificado e chave privada em EAP-TLS.
- Acompanhamento do provisionamento pela interface e documentação em `ForgeHub/PROVISIONAMENTO.md`.

### Corrigido
- Instalação do AP cria os arquivos Wi-Fi/DHCP ausentes, preserva configurações existentes e instala o controlador wpa_supplicant usado pela TV box.
- Controlador do AP valida os arquivos antes de iniciar, interrompe em erros e aguarda confirmação de modo AP antes de anunciar sucesso.
- Regra de retorno de tráfego do AP inclui o destino ACCEPT.
- Aplicação de Wi-Fi passa um perfil privado ao script, evitando a ordem incorreta dos argumentos e a exposição de senhas na linha de comando.
- Estado de conexão usa o IP retornado pela aplicação; remove confirmação fictícia de sucesso.
- Tentativas simultâneas, inclusive EAP, são rejeitadas durante o provisionamento.
- Perfis usam permissões restritas e os de tentativas malsucedidas são removidos.
- Associação e DHCP têm prazo limitado, com tentativa de restauração do ponto de acesso em caso de falha.
- Lista de redes começa vazia, sem redes fictícias; uma única rede detectada também é aceita.

### Validação
- Build TypeScript/Vite e build Go concluídos.
- `go test ./...`, `bash -n` e `git diff --check` aprovados.
- Interface desktop e mobile capturada na TV box; serviço HTTP e assets verificados após implantação.
- Conexão real com EAP/WPA3 ainda não validada. Compatibilidade depende do adaptador, driver e wpa_supplicant. Detalhes e formatos suportados constam na documentação.
