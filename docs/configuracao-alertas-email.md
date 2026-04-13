# Alertas por e-mail do SCAC

## Implementação adotada

O projeto usa **Cloud Function agendada** com `nodemailer`, executada diariamente às **07:00** no fuso `America/Sao_Paulo`.

Função criada:
- `enviarAlertasAudienciasCriticas`

Arquivos principais:
- `functions/src/index.ts`
- `src/lib/emailTemplates.ts`

## Eventos que disparam alerta

O e-mail é enviado quando houver ao menos uma audiência com `itensCriticosPendentes > 0` e que se enquadre em um dos cenários abaixo:

1. Audiência de réu preso agendada nas próximas 48 horas
2. Audiência agendada para o dia seguinte com checklist incompleto

Cada mensagem lista:
- número do processo
- tipo de audiência
- horário
- sala
- quantidade de itens críticos pendentes
- motivo do alerta

O destinatário é lido do campo:
- `configuracoes/sistema.emailNotificacoes`

## Segredos SMTP necessários

Antes do deploy da Function, configure os segredos no Firebase:

```powershell
npx -y firebase-tools@latest functions:secrets:set SMTP_HOST
npx -y firebase-tools@latest functions:secrets:set SMTP_PORT
npx -y firebase-tools@latest functions:secrets:set SMTP_USER
npx -y firebase-tools@latest functions:secrets:set SMTP_PASS
npx -y firebase-tools@latest functions:secrets:set SMTP_FROM
npx -y firebase-tools@latest functions:secrets:set SMTP_SECURE
```

Valores esperados:
- `SMTP_HOST`: host do servidor SMTP
- `SMTP_PORT`: porta do SMTP, por exemplo `587` ou `465`
- `SMTP_USER`: usuário da conta remetente
- `SMTP_PASS`: senha da conta remetente
- `SMTP_FROM`: remetente exibido no e-mail, por exemplo `SCAC <no-reply@dominio.gov.br>`
- `SMTP_SECURE`: `true` para SSL direto, `false` para STARTTLS

## Deploy

Instalar dependências das Functions:

```powershell
cd functions
npm install
```

Voltar para a raiz do projeto e publicar:

```powershell
npx -y firebase-tools@latest deploy --only functions --project audienciascriminais4vara
```

## Observações

- Se `emailNotificacoes` estiver vazio, a Function não envia nada.
- Se não houver audiências elegíveis no dia, a execução termina sem e-mail.
- O template HTML do aviso está centralizado em `src/lib/emailTemplates.ts`.
- O caminho com **Firebase Extension Trigger Email** não foi adotado nesta implementação. A solução atual usa envio direto por SMTP via Cloud Function.
