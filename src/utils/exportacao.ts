import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import {
  FormaIntimacao,
  StatusIntimacao,
  TipoParticipante,
  type Intimacao,
  type Processo,
} from '../types/core'

type Linha = Record<string, string | number | boolean>

export function formatarDataRelatorio(data: Date | null | undefined): string {
  if (!data) return '—'
  return format(data, 'dd/MM/yyyy')
}

function escaparValorCSV(valor: string | number | boolean): string {
  const texto = String(valor ?? '')
  const normalizado = texto.replace(/"/g, '""')
  return `"${normalizado}"`
}

export function exportarParaCSV(dados: Linha[], nomeArquivo: string): void {
  if (!dados.length) return

  const cabecalhos = Object.keys(dados[0])
  const linhas = dados.map((linha) =>
    cabecalhos.map((chave) => escaparValorCSV(linha[chave] ?? '')).join(';'),
  )
  const conteudo = [cabecalhos.join(';'), ...linhas].join('\n')
  const blob = new Blob([`\uFEFF${conteudo}`], { type: 'text/csv;charset=utf-8;' })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportarParaExcel(
  abas: {
    nome: string
    dados: Record<string, string | number>[]
  }[],
  nomeArquivo: string,
): Promise<void> {
  // Fallback sem xlsx/exceljs instalado.
  if (!abas.length) return
  // eslint-disable-next-line no-console
  console.warn('Excel indisponivel no projeto. Exportando a primeira aba em CSV.')
  exportarParaCSV(abas[0].dados, nomeArquivo)
}

export function exportarParaPDF(
  dados: Record<string, string | number | boolean>[],
  titulo: string,
  nomeArquivo: string,
): void {
  if (!dados.length) return
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(14)
  doc.text(titulo, 40, 40)

  const colunas = Object.keys(dados[0])
  const linhas = dados.map((linha) => colunas.map((chave) => String(linha[chave] ?? '')))
  autoTable(doc, {
    startY: 55,
    head: [colunas],
    body: linhas,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [83, 74, 183] },
  })

  doc.save(nomeArquivo.endsWith('.pdf') ? nomeArquivo : `${nomeArquivo}.pdf`)
}

const TIPO_INTIMACAO_LABEL: Record<FormaIntimacao, string> = {
  [FormaIntimacao.MANDADO_CEMAN_LOCAL]: 'Mandado CEMAN local',
  [FormaIntimacao.MANDADO_CEMAN_DIVERSA]: 'Mandado CEMAN diversa',
  [FormaIntimacao.CARTA_PRECATORIA]: 'Carta precatoria',
  [FormaIntimacao.NAO_REQUER_INTIMACAO]: 'Nao requer intimacao',
}

const STATUS_INTIMACAO_LABEL: Record<StatusIntimacao, string> = {
  [StatusIntimacao.PENDENTE]: 'Pendente',
  [StatusIntimacao.POSITIVA]: 'Cumprida',
  [StatusIntimacao.NEGATIVA_NAO_LOCALIZADO]: 'Negativa - nao localizado',
  [StatusIntimacao.NEGATIVA_DEVOLVIDA]: 'Negativa - devolvida',
}

const TIPO_PARTICIPANTE_LABEL: Record<TipoParticipante, string> = {
  [TipoParticipante.REU]: 'Reu',
  [TipoParticipante.VITIMA]: 'Vitima',
  [TipoParticipante.TESTEMUNHA]: 'Testemunha',
  [TipoParticipante.PERITO]: 'Perito',
  [TipoParticipante.TRADUTOR]: 'Tradutor',
  [TipoParticipante.INFORMANTE]: 'Informante',
  [TipoParticipante.ASSISTENTE_ACUSACAO]: 'Assistente de acusacao',
  [TipoParticipante.OUTRO]: 'Outro',
}

export function processosParaCSV(processos: Processo[]): Record<string, string>[] {
  return processos.map((processo) => ({
    numeroProcesso: processo.numeroProcesso,
    tipoAudiencia: processo.tipoAudiencia,
    cargoMagistrado: processo.cargoMagistrado,
    naturezaCrime: processo.naturezaCrime ?? '—',
    metaCNJ: processo.metaCNJ,
    prioridades: processo.prioridades.join(', ') || '—',
    etiquetas: processo.etiquetas.join(', ') || '—',
    statusFase1: processo.fases.fase1,
    statusFase2: processo.fases.fase2,
    statusFase3: processo.fases.fase3,
    prescricao: formatarDataRelatorio(processo.prescricao.dataLimite),
    criadoEm: formatarDataRelatorio(processo.criadoEm),
  }))
}

export function intimacoesParaCSV(
  intimacoes: (Intimacao & { numeroProcesso: string })[],
): Record<string, string>[] {
  return intimacoes.map((item) => ({
    numeroProcesso: item.numeroProcesso,
    participante: item.participanteNome,
    tipoParticipante: TIPO_PARTICIPANTE_LABEL[item.participanteTipo],
    tipoIntimacao: TIPO_INTIMACAO_LABEL[item.tipo],
    status: STATUS_INTIMACAO_LABEL[item.status],
    dataRemessa: formatarDataRelatorio(item.dataRemessa),
    dataCumprimento: formatarDataRelatorio(item.dataCumprimento),
    dataDevolvida: formatarDataRelatorio(item.dataDevolvida),
  }))
}

