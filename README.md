![GitHub followers](https://img.shields.io/github/followers/multi-forge?style=social) ![GitHub User's stars](https://img.shields.io/github/stars/multi-forge?style=social) <img src="https://img.shields.io/badge/Linux-FCC624?style=social&logo=linux&logoColor=black" alt="multiforge" />

<p align="center">
  <img src="https://github.com/multi-forge/multiforge/blob/main/imagens/logo.png?raw=true" width="1280" alt="MultiForge Logo/Banner">
</p>

<h4 align="center">O projeto "MultiForge" visa transformar TV Boxes e hardware reaproveitado em infraestrutura digital modular. <a href="https://github.com/multi-forge/multiforge" target="_blank">MultiForge</a>.</h4>

> Acreditamos que milhares de TV Boxes descartadas ou apreendidas podem deixar de ser lixo eletrônico e se tornar equipamentos úteis. Ao detectar automaticamente o hardware e provisionar o sistema correto, estamos democratizando o acesso a servidores de borda, bibliotecas digitais e nós IoT, transformando hardware reaproveitado em ferramentas ativas para escolas, universidades e makerspaces.



### Ajustes e melhorias

O projeto está em pleno desenvolvimento. As próximas etapas incluem:

- [x] Criação da estrutura de módulos base (Mina, Scraping, NoNail).
- [x] Estruturação do repositório MultiForge.
- [ ] Construção do ForgeDB (Banco de compatibilidade de hardware).
- [ ] Desenvolvimento da CLI para detecção automática (SoC, Memória, Wi-Fi).
- [ ] Automação de provisionamento inteligente (ForgeOS / Armbian).
- [ ] Disponibilização de catálogo expansível no ForgeHub.

## 📗 Sumário

 1. 🌍 [Sobre a Plataforma](#sobre)
 2. 🎯 [Objetivos Principais](#objetivos)
 3. ✨ [Recursos e Funcionamento](#recursos)
 4. 📦 [Ecossistema](#ecossistema)
 5. 🔍 [Banco de Compatibilidade (Exemplo)](#compatibilidade)
 6. 🤝 [Contribuindo](#contribuindo)
 7. 📜 [Licença](#licenca)

---

## 🌍 <a id="sobre"/>Sobre a Plataforma

O **MultiForge** é uma plataforma open source criada para simplificar o reaproveitamento de TV Boxes e outros dispositivos ARM. Seu objetivo é eliminar a complexidade na instalação de sistemas, oferecendo uma arquitetura onde: **Você constrói uma vez, detecta automaticamente e implanta em qualquer lugar.**

## 🎯 <a id="objetivos"/>Objetivos Principais

- 🔍 **Detectar automaticamente** o hardware da TV Box.
- ⚙️ **Selecionar a imagem Linux** mais compatível baseada na base de dados.
- 📦 **Automatizar o processo** de instalação de forma amigável.
- 🧩 **Oferecer módulos** instaláveis facilmente (Assistentes IA, Dashboards, MQTT, etc).

## ✨ <a id="recursos"/>Recursos e Funcionamento

```text
TV Box ➔ Detecção ➔ Banco de Compatibilidade ➔ Imagem Recomendada ➔ Instalação ➔ Marketplace (Hub)
```
- **Detecção H/W**: Identificação de SoC, memória, Wi-Fi e periféricos essenciais.
- **Instalação Simplificada**: Fluxos consistentes para gravação via eMMC, SD, ou MaskROM.
- **Provisionamento Inteligente**: Configuração aplicada automaticamente baseada na board detectada.

## 📦 <a id="ecossistema"/>Ecossistema

| Projeto | Descrição |
|---------|-----------|
| **MultiForge CLI** | Interface de linha de comando (`multi detect`, `multi install`). |
| **ForgeDB** | Banco robusto de compatibilidade de hardware (DTBs, drivers). |
| **ForgeHub** | Catálogo de módulos e serviços de software open-source. |
| **ForgeOS** | Imagens Linux otimizadas nativamente para hardware legado. |

## 🔍 <a id="compatibilidade"/>Banco de Compatibilidade

> Este é um exemplo de como documentaremos as TV Boxes suportadas pelo projeto e sua viabilidade de hardware.

| TV BOX      | Processador     | Memória | Wi-Fi       | Instalação / Status |
|-------------|-----------------|:-------:|-------------|:-------------------:|
| BTV E10     | Rockchip RK3566 | 2GB     | ✅ AP6256   | Suportado ✅        |
**Mais em breve...**

## 🤝 <a id="contribuindo"/>Contribuindo

Toda contribuição é bem-vinda para catalogar e suportar novos hardwares! Colabore testando TV Boxes, relatando bugs, descobrindo DTBs compatíveis ou criando novos módulos.

## 📜 <a id="licenca"/>Licença

Projeto distribuído sob a licença **MIT**.
