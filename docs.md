# Atualização da Stack

## Backend

* Node.js
* TypeScript
* Fastify
* Axios
* Zod
* simple-git

## IA

Toda a camada de IA será construída utilizando o **Vercel AI SDK**, desacoplando completamente a aplicação do provedor do modelo.

Benefícios:

* Troca de modelos sem alterar regras de negócio.
* Suporte nativo a streaming.
* Ferramentas (Tool Calling).
* Estrutura única para qualquer LLM.
* Facilidade para adicionar novos providers.

---

# Providers Suportados

## OpenRouter

Principal provider utilizado em produção.

Permite acesso a diversos modelos através de uma única API.

Exemplos:

* GPT-5.5
* Claude
* Gemini
* DeepSeek
* Qwen
* Mistral
* Llama

Configuração:

```env
AI_PROVIDER=openrouter

OPENROUTER_API_KEY=

OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

---

## Ollama (Localhost)

Permite executar modelos localmente.

Ideal para:

* Desenvolvimento
* Empresas com restrições de dados
* Testes
* Redução de custos

Exemplo:

```env
AI_PROVIDER=ollama

OLLAMA_BASE_URL=http://localhost:11434

OLLAMA_MODEL=qwen3:32b
```

Modelos recomendados:

* qwen3
* deepseek-r1
* llama3
* mistral
* gemma

---

## OpenAI

Opcional.

Configuração:

```env
AI_PROVIDER=openai

OPENAI_API_KEY=

OPENAI_MODEL=gpt-5.5
```

---

# Arquitetura da IA

Toda comunicação com modelos será centralizada em um único serviço.

```text
ReviewService

↓

AIService

↓

Provider

↓

Modelo
```

O restante da aplicação nunca deve conhecer qual modelo está sendo utilizado.

---

# Estrutura

```text
src/

services/

    ai/

        ai.service.ts

        provider.factory.ts

        providers/

            openrouter.provider.ts

            ollama.provider.ts

            openai.provider.ts

        prompts/

        schemas/

        types/
```

---

# Interface

Todos os providers deverão implementar a mesma interface.

```ts
interface AIProvider {

    review(
        context: ReviewContext
    ): Promise<ReviewResult>

}
```

Isso permite adicionar novos modelos sem alterar nenhuma regra de negócio.

---

# Provider Factory

O provider será escolhido através das variáveis de ambiente.

```env
AI_PROVIDER=ollama
```

ou

```env
AI_PROVIDER=openrouter
```

A aplicação instancia automaticamente o provider correto.

---

# Modelos

O nome do modelo nunca será fixo no código.

Sempre utilizar configuração.

Exemplo:

```env
AI_MODEL=qwen3:32b
```

ou

```env
AI_MODEL=anthropic/claude-sonnet-4
```

ou

```env
AI_MODEL=openai/gpt-5.5
```

---

# Prompt Builder

Os prompts deverão ser independentes do modelo.

O Prompt Builder será responsável por montar:

* Contexto do PR
* Diff
* Arquivos alterados
* Regras da empresa
* Regras da linguagem
* Contexto adicional

O provider apenas recebe o prompt final.

---

# Structured Output

Todos os modelos deverão responder utilizando um formato estruturado.

A resposta será validada com Zod antes do processamento.

Caso o modelo retorne uma estrutura inválida:

* solicitar nova geração automaticamente;
* registrar erro caso exceda o número máximo de tentativas.

---

# Streaming

Toda comunicação utilizará streaming através do Vercel AI SDK.

Benefícios:

* Feedback imediato.
* Logs em tempo real.
* Possibilidade futura de interface Web acompanhando a geração do review.

---

# Futuras Evoluções

A arquitetura deverá permitir facilmente:

* múltiplos modelos trabalhando simultaneamente;
* fallback automático entre providers;
* comparação entre modelos;
* balanceamento por custo;
* seleção automática do modelo conforme o tamanho do PR;
* uso de modelos locais para PRs pequenos e modelos mais avançados para revisões complexas;
* cache de respostas para reduzir consumo de tokens.

---

# Princípio Arquitetural

Toda a aplicação deverá depender apenas do **Vercel AI SDK**.

Nenhum serviço de negócio poderá conhecer APIs específicas da OpenAI, OpenRouter ou Ollama.

Adicionar um novo provider deverá exigir apenas:

1. Criar um novo provider na pasta `providers/`;
2. Implementar a interface `AIProvider`;
3. Registrar o provider na `ProviderFactory`;
4. Configurar as variáveis de ambiente.

Nenhuma outra parte da aplicação deverá ser modificada.
