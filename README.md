# SCAC v2.0 — Sistema de Controle de Audiências Criminais

> 4ª Vara Federal Criminal · Tema Aurora · React 19 + TypeScript + Firebase

---

## Stack

| Camada       | Tecnologia |
|---|---|
| Frontend     | React 19 + TypeScript + Vite |
| Estilo       | Tailwind CSS (tema Aurora customizado) |
| Auth         | Firebase Authentication |
| Banco        | Cloud Firestore |
| Calendário   | React Big Calendar + DnD |
| Formulários  | React Hook Form + Zod |
| Estado UI    | Zustand |
| Gráficos     | Recharts |
| Busca global | cmdk |

---

## Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar Firebase
cp .env.example .env
# Preencher .env com credenciais do Firebase Console

# 3. Rodar em dev
npm run dev
```

---

## Estrutura de diretórios

```
src/
├── components/
│   ├── layout/    # AppShell (topnav flutuante), CommandPalette
│   └── ui/        # Design system Aurora: Button, Badge, Card, Modal…
├── contexts/
│   ├── AuthContext.tsx    # CORRIGIDO: busca por uid real
│   └── ToastContext.tsx   # Notificações globais Zustand
├── hooks/
│   ├── useAudiencias.ts   # CORRIGIDO: valida feriados antes de criar
│   ├── index.ts           # Todos os outros hooks
│   └── useAuditoria.ts    # Log de auditoria
├── lib/
│   └── firebase.ts        # CORRIGIDO: app secundária para criar usuários
├── pages/
│   ├── Login/             # Tela Aurora com recuperação de senha
│   ├── Pauta/             # Calendário DnD + QuickActionPanel
│   ├── MinhaAgenda/       # Calendário pessoal por magistrado
│   ├── Procedimentos/     # Lista + Detalhes com stepper 5 fases
│   ├── Estatisticas/      # Gráficos Recharts tema Aurora
│   ├── Usuarios/          # CRUD com Firebase Auth real
│   ├── Salas/             # Gestão de locais
│   ├── Feriados/          # Datas bloqueadas para agendamento
│   └── Configuracoes/     # Preferências do sistema
├── styles/globals.css     # Variáveis Aurora + override React Big Calendar
├── types/index.ts         # Tipos centralizados
├── App.tsx                # CORRIGIDO: sem AuthProvider duplicado
└── main.tsx               # CORRIGIDO: AuthProvider único aqui
```

---

## Bugs corrigidos nesta versão

| # | Bug | Correção |
|---|---|---|
| 1 | Usuários criados com `addDoc` (id aleatório) sem conta real | Usa `createUserWithEmailAndPassword` via `secondaryAuth` |
| 2 | `AuthProvider` duplicado em `main.tsx` e `App.tsx` | Provider apenas em `main.tsx` |
| 3 | Feriados não bloqueavam agendamento | `validarAgendamento()` consulta coleção `feriados` antes de criar |
| 4 | `idsPje` descartado no handler do checklist | Handler recebe e persiste os 4 parâmetros incluindo `idsPje` |

---

## Funcionalidades modernas

- **Drag & drop no calendário** — arraste audiências para redesignar com validação em tempo real (verde = ok, vermelho = conflito)
- **Quick Action Panel** — clique em audiência → painel lateral com ações (iniciar, encerrar, redesignar, cancelar, ver procedimento)
- **Command Palette** — `⌘K` ou `Ctrl+K` em qualquer tela para busca global e ações rápidas
- **Checklist por fases** — stepper visual das 5 fases do procedimento com indicadores de progresso e itens críticos
- **Micro-animações** — fade-in, slide-in, pulse para itens críticos, toast de confirmação
- **Topnav flutuante** — sem sidebar, navegação horizontal, conteúdo 100% da largura

---

## Coleções Firestore necessárias

```
usuarios              — perfis de acesso
audiencias            — audiências agendadas
procedimentos         — procedimentos vinculados às audiências
procedimento_itens    — itens do checklist
procedimento_participantes
procedimento_documentos
salas
feriados
disponibilidades
configuracoes         — documento único: 'sistema'
audit_logs
```

---

## Variáveis de ambiente

Veja `.env.example`. Todas as variáveis começam com `VITE_FIREBASE_`.
