# Meu raio-x financeiro

Aplicação Next.js com login por Supabase, persistência por usuário, máscaras financeiras por localidade/moeda e reordenação por drag and drop.

## Configuração

1. Crie um projeto no Supabase.
2. Execute o SQL em `supabase/schema.sql` no SQL editor do Supabase.
3. Copie `.env.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Instale as dependências e rode:

```bash
npm install
npm run dev
```

## Banco

A tabela `finance_states` usa `user_id` como chave primária e armazena o cenário financeiro em `data jsonb`. As políticas RLS garantem que cada usuário leia e altere apenas o próprio registro.
