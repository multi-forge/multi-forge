# 🗺️ Roadmap do MultiForge

Desenvolvimento estruturado em fases de maturidade da plataforma:

---

## 🎯 Phase 1 — Hackathon MVP
* **Foco**: Prova de conceito funcional e validação da arquitetura piloto (BTV E10).
* **Entregáveis**:
  * ForgeDB estruturado de forma simplificada em arquivos YAML declarativos.
  * ForgeImager compilável e capaz de gravar e injetar configurações via `forge.yaml`.
  * Criação do Forge Provisioner básico capaz de ler o manifesto e configurar usuário/rede.
  * Suporte inicial a imagens parceiras (Armbian/ForgeOS).

## 🚀 Phase 2 — Community
* **Foco**: Expansão do ecossistema e ferramentas automatizadas de inventário.
* **Entregáveis**:
  * Lançamento do Forge Agent para inventário dinâmico pós-boot.
  * Envio automático de conformidade e detecção real de barramentos para o ForgeDB.
  * Suporte a múltiplos dispositivos de outras famílias de SoCs (Rockchip, Allwinner).
  * Criação de templates de CI para o build e teste automático das aplicações.

## 💎 Phase 3 — Production Ecosystem
* **Foco**: Lançamento comercial da plataforma e expansão de mercado.
* **Entregáveis**:
  * ForgeHub totalmente interativo (interface web e marketplace com assinaturas).
  * Imagem de sistema operacional unificada (ForgeOS nativo).
  * Gestão de frotas e automação de atualizações Over-the-Air (OTA).
  * Integração nativa com nós de inteligência artificial de borda (Edge AI).
