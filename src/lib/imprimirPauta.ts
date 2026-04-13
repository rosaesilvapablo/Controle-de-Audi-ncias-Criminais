import { isSameDay } from 'date-fns'
import {
  ADVOGADO_TIPO_LABELS,
  TIPO_AUDIENCIA_LABELS,
  type Audiencia,
  type Configuracoes,
  type StatusAudiencia,
} from '../types'
import {
  formatarDataExtenso,
  formatarDataHora,
  formatarHorario,
} from './audienciaHelpers'

export function imprimirPautaDia(
  audiencias: Audiencia[],
  data: Date,
  configuracoes?: Configuracoes | null,
): void {
  const nomeVara = configuracoes?.nomeVara ?? '4ª Vara Federal Criminal'
  const dataExtenso = formatarDataExtenso(data)
  const agora = formatarDataHora(new Date())

  const STATUS_VISIVEIS: StatusAudiencia[] = [
    'agendada',
    'em_andamento',
    'realizada',
    'suspensa',
  ]

  const audsDoDia = audiencias
    .filter((a) => {
      const d = a.dataHoraInicio.toDate()
      return isSameDay(d, data) && STATUS_VISIVEIS.includes(a.status)
    })
    .sort(
      (a, b) =>
        a.dataHoraInicio.toDate().getTime() - b.dataHoraInicio.toDate().getTime(),
    )

  const blocosHtml = audsDoDia.map((a) => {
    const inicio = formatarHorario(a.dataHoraInicio)
    const fim = formatarHorario(a.dataHoraFim)
    const tipo = TIPO_AUDIENCIA_LABELS[a.tipo]

    const linhaReu = (a.reus ?? [])
      .map((r) => `${r.nome}${r.preso ? ' <span style="color:red">(preso)</span>' : ''}`)
      .join(', ') || '—'

    const linhaAdv = (a.advogados ?? [])
      .map((adv) => `${adv.nome} — OAB ${adv.oab} (${ADVOGADO_TIPO_LABELS[adv.tipo]})`)
      .join('<br>') || '—'

    const linhaVit = (a.vitimas ?? []).join(', ')

    return `
      <div style="page-break-inside:avoid;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #ccc">
        <div style="font-size:14pt;font-weight:bold;margin-bottom:6px">
          ${inicio} – ${fim} &nbsp;|&nbsp; ${tipo}
        </div>
        <table style="width:100%;font-size:11pt;border-collapse:collapse">
          <tr><td style="width:140px;color:#555;padding:2px 0">Processo</td><td style="font-family:monospace">${a.numeroProcesso}</td></tr>
          <tr><td style="color:#555;padding:2px 0">Magistrado</td><td>${a.magistradoNome ?? '—'}</td></tr>
          <tr><td style="color:#555;padding:2px 0">Sala</td><td>${a.salaNome ?? '—'}</td></tr>
          ${a.reuPreso ? `<tr><td></td><td style="color:red;font-weight:bold">RÉU PRESO</td></tr>` : ''}
          <tr><td style="color:#555;padding:2px 0">Réus</td><td>${linhaReu}</td></tr>
          ${linhaVit ? `<tr><td style="color:#555;padding:2px 0">Vítimas</td><td>${linhaVit}</td></tr>` : ''}
          <tr><td style="color:#555;padding:2px 0;vertical-align:top">Advogados</td><td>${linhaAdv}</td></tr>
        </table>
      </div>`
  }).join('')

  const semAudiencias = audsDoDia.length === 0
    ? '<p style="color:#888;font-style:italic">Nenhuma audiência para este dia.</p>'
    : ''

  const html = `<!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Pauta — ${dataExtenso}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12pt; margin: 2cm; color: #000; }
      table.header { width: 100%; border-collapse: collapse; }
      thead { display: table-header-group; }
      @media print {
        @page { margin: 2cm; }
        body * { visibility: hidden; }
        .print-root, .print-root * { visibility: visible; }
        .print-root { position: absolute; left: 0; top: 0; width: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="print-root">
      <table class="header">
        <thead>
          <tr>
            <td>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div>
                  <div style="font-size:10pt;color:#555">${nomeVara}</div>
                  <div style="font-size:16pt;font-weight:bold">PAUTA DE AUDIÊNCIAS</div>
                  <div style="font-size:12pt">${dataExtenso}</div>
                </div>
                <div style="font-size:9pt;color:#888;text-align:right">Impresso em ${agora}</div>
              </div>
              <hr style="border:1px solid #000;margin:12px 0 20px">
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              ${semAudiencias}
              ${blocosHtml}
              <div style="margin-top:32px;font-size:9pt;color:#888;border-top:1px solid #ccc;padding-top:8px">
                Documento gerado pelo SCAC em ${agora}<br>
                Uso interno — não é documento oficial
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>`

  const janela = window.open('', '_blank')
  if (!janela) return
  janela.document.write(html)
  janela.document.close()
  janela.focus()
  window.setTimeout(() => janela.print(), 500)
}
