export interface AlertaAudienciaEmailItem {
  numeroProcesso: string
  tipoAudiencia: string
  horario: string
  sala: string
  itensCriticosPendentes: number
  motivo: string
}

export interface AlertaAudienciasEmailPayload {
  dataReferencia: string
  vara: string
  itens: AlertaAudienciaEmailItem[]
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function gerarAssuntoAlertaAudiencias(
  quantidade: number,
  dataReferencia: string,
): string {
  return quantidade === 1
    ? `[SCAC] 1 audiência com pendência crítica em ${dataReferencia}`
    : `[SCAC] ${quantidade} audiências com pendência crítica em ${dataReferencia}`
}

export function gerarHtmlAlertaAudiencias(
  payload: AlertaAudienciasEmailPayload,
): string {
  const linhas = payload.itens
    .map(
      (item) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:14px;color:#0f172a;">${escapeHtml(item.numeroProcesso)}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:14px;color:#334155;">${escapeHtml(item.tipoAudiencia)}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:14px;color:#334155;">${escapeHtml(item.horario)}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:14px;color:#334155;">${escapeHtml(item.sala)}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:14px;color:#c2410c;font-weight:700;">${item.itensCriticosPendentes}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:14px;color:#334155;">${escapeHtml(item.motivo)}</td>
        </tr>
      `,
    )
    .join('')

  return `
    <div style="background:#f8f9fb;padding:32px;">
      <div style="max-width:880px;margin:0 auto;background:#ffffff;border:1px solid #d7deea;border-radius:18px;overflow:hidden;">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#3730a3 0%,#4f46e5 100%);color:#ffffff;">
          <div style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.82;">SCAC</div>
          <h1 style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:22px;line-height:1.3;">Alertas de audiências com pendências críticas</h1>
          <p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;opacity:.92;">${escapeHtml(payload.vara)} · referência ${escapeHtml(payload.dataReferencia)}</p>
        </div>

        <div style="padding:24px 28px;">
          <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#334155;">
            O SCAC identificou audiências agendadas com checklist crítico pendente. Revise os itens abaixo e regularize o procedimento antes do horário da audiência.
          </p>

          <table style="width:100%;border-collapse:collapse;border-spacing:0;background:#ffffff;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:12px;text-align:left;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;">Processo</th>
                <th style="padding:12px;text-align:left;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;">Tipo</th>
                <th style="padding:12px;text-align:left;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;">Horário</th>
                <th style="padding:12px;text-align:left;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;">Sala</th>
                <th style="padding:12px;text-align:left;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;">Pendências</th>
                <th style="padding:12px;text-align:left;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;">Motivo do alerta</th>
              </tr>
            </thead>
            <tbody>
              ${linhas}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
}
