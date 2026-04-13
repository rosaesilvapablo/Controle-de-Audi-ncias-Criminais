import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Audiencia, CargoMagistrado, TipoAudiencia } from '../types'
import { TIPO_AUDIENCIA_LABELS } from '../types'
import type { IdentidadeVara } from './exportarRelatorios'

const MESES_CAIXA_ALTA = [
  'JANEIRO',
  'FEVEREIRO',
  'MARCO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
]

const CARGOS_LABELS: Record<CargoMagistrado, string> = {
  juiz_federal: 'Juiz Federal',
  juiz_federal_substituto: 'Juiz Federal Substituto',
  juiz_designado: 'Juiz Designado',
}

function tipoPorExtenso(tipo: TipoAudiencia) {
  return TIPO_AUDIENCIA_LABELS[tipo] ?? 'Audiencia'
}

function mascararSigiloso(audiencia: Audiencia, autorizado: boolean) {
  if (audiencia.sigiloso !== true) return audiencia.numeroProcesso
  if (autorizado) return `${audiencia.numeroProcesso} (SIGILOSO)`
  return 'PROCESSO SIGILOSO'
}

function cargoDaAudiencia(audiencia: Audiencia) {
  const cargo = (audiencia as Audiencia & { cargoMagistrado?: CargoMagistrado })
    .cargoMagistrado
  return cargo ? CARGOS_LABELS[cargo] : audiencia.magistradoNome ?? 'Magistrado'
}

function adicionarCabecalho(
  doc: jsPDF,
  identidade: IdentidadeVara,
  mes: number,
  ano: number,
) {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(identidade.nomeJuizo || 'Justica Federal', pageWidth / 2, 42, { align: 'center' })
  doc.setFontSize(14)
  doc.text(identidade.nomeVara || '4a Vara Federal Criminal', pageWidth / 2, 58, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${identidade.cidade || ''} - ${identidade.uf || ''}`.trim(), pageWidth / 2, 73, {
    align: 'center',
  })

  doc.line(40, 86, pageWidth - 40, 86)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('PAUTA DE AUDIENCIAS', pageWidth / 2, 110, { align: 'center' })
  doc.setFontSize(12)
  doc.text(`${MESES_CAIXA_ALTA[mes - 1]} DE ${ano}`, pageWidth / 2, 128, { align: 'center' })

  return 154
}

function adicionarRodape(doc: jsPDF, nomeUsuario: string) {
  const totalPages = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const dataGeracao = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  for (let pagina = 1; pagina <= totalPages; pagina += 1) {
    doc.setPage(pagina)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Gerado em ${dataGeracao} por ${nomeUsuario}`, 40, pageHeight - 18)
    doc.text(`Pagina ${pagina} de ${totalPages}`, pageWidth - 40, pageHeight - 18, {
      align: 'right',
    })
  }
}

export function exportarPautaRedigida(params: {
  audiencias: Audiencia[]
  mes: number
  ano: number
  identidade: IdentidadeVara
  usuarioAutorizadoSigiloso: boolean
  nomeUsuario: string
}): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 40
  const limiteY = pageHeight - 60
  let cursorY = adicionarCabecalho(doc, params.identidade, params.mes, params.ano)

  const audiencias = [...params.audiencias]
    .filter((item) => !['cancelada', 'redesignada'].includes(item.status))
    .sort((a, b) => a.dataHoraInicio.toDate().getTime() - b.dataHoraInicio.toDate().getTime())

  const agrupadas = audiencias.reduce<Record<string, Audiencia[]>>((acc, item) => {
    const chave = format(item.dataHoraInicio.toDate(), 'yyyy-MM-dd')
    acc[chave] = [...(acc[chave] ?? []), item]
    return acc
  }, {})

  const escreverLinha = (texto: string, destaque = false) => {
    const linhas = doc.splitTextToSize(texto, pageWidth - marginX * 2)
    const altura = linhas.length * 15

    if (cursorY + altura > limiteY) {
      doc.addPage()
      cursorY = adicionarCabecalho(doc, params.identidade, params.mes, params.ano)
    }

    doc.setFont('helvetica', destaque ? 'bold' : 'normal')
    doc.setFontSize(destaque ? 12 : 11)
    doc.text(linhas, marginX, cursorY)
    cursorY += altura + (destaque ? 6 : 4)
  }

  Object.entries(agrupadas).forEach(([chave, lista]) => {
    const data = new Date(`${chave}T12:00:00`)
    escreverLinha(
      `Dia ${format(data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} (${format(data, 'EEEE', { locale: ptBR })}):`,
      true,
    )

    lista.forEach((audiencia) => {
      const hora = format(audiencia.dataHoraInicio.toDate(), 'HH:mm')
      const sala = audiencia.salaNome ? `Sala ${audiencia.salaNome}` : 'Sala nao informada'
      const cargo = cargoDaAudiencia(audiencia)

      if (audiencia.sigiloso && !params.usuarioAutorizadoSigiloso) {
        escreverLinha(`• As ${hora}h, [PROCESSO SIGILOSO - ${sala}].`)
        return
      }

      escreverLinha(
        `• As ${hora}h, audiencia de ${tipoPorExtenso(audiencia.tipo)}, referente ao processo n.º ${mascararSigiloso(audiencia, params.usuarioAutorizadoSigiloso)}, ${sala}, a ser presidida pelo(a) ${cargo}.`,
      )
    })

    cursorY += 8
  })

  const hoje = new Date()
  cursorY += 24
  escreverLinha(
    `${params.identidade.cidade}, ${format(hoje, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`,
  )
  cursorY += 24
  escreverLinha('________________________________________')
  escreverLinha(params.identidade.nomeVara)

  adicionarRodape(doc, params.nomeUsuario)
  doc.save(`PautaRedigida_${String(params.mes).padStart(2, '0')}-${params.ano}.pdf`)
}
