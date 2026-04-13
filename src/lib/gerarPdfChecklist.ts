import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type {
  Procedimento,
  Audiencia,
  ProcedimentoItem,
  ProcedimentoParticipante,
  ProcedimentoDocumento,
  FaseProcedimento,
} from '../types'
import {
  TIPO_AUDIENCIA_LABELS,
  CLASSE_PROCESSUAL_LABELS,
  OBJETO_FEITO_LABELS,
  FASES_LABELS,
  TIPO_PARTICIPANTE_LABELS,
  ADVOGADO_TIPO_LABELS,
} from '../types'

function respostaParaTexto(resposta: ProcedimentoItem['resposta']): string {
  if (resposta === undefined || resposta === null || resposta === '') return '[ Em aberto ]'
  if (resposta === true) return 'Sim'
  if (resposta === false) return 'Não'
  return String(resposta)
}

function tipoDocumentoParaTexto(tipo: ProcedimentoDocumento['tipo']): string {
  return tipo.charAt(0).toUpperCase() + tipo.slice(1)
}

export async function gerarPdfChecklist(
  procedimento: Procedimento,
  audiencia: Audiencia,
  itens: ProcedimentoItem[],
  participantes: ProcedimentoParticipante[],
  documentos: ProcedimentoDocumento[],
): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40
  let cursorY = 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('CHECKLIST DE AUDIÊNCIA', pageWidth / 2, cursorY, { align: 'center' })
  cursorY += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('4ª Vara Federal Criminal', pageWidth / 2, cursorY, { align: 'center' })
  cursorY += 16

  doc.setDrawColor(84, 74, 183)
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY)
  cursorY += 18

  const inicio = audiencia.dataHoraInicio.toDate()
  const fim = audiencia.dataHoraFim.toDate()
  const col2X = pageWidth / 2 + 10

  doc.setFontSize(10)
  doc.text(`Processo: ${audiencia.numeroProcesso}`, marginX, cursorY)
  doc.text(`Data: ${format(inicio, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, col2X, cursorY)
  cursorY += 14
  doc.text(`Tipo: ${TIPO_AUDIENCIA_LABELS[audiencia.tipo]}`, marginX, cursorY)
  doc.text(`Horário: ${format(inicio, 'HH:mm')} às ${format(fim, 'HH:mm')}`, col2X, cursorY)
  cursorY += 14
  doc.text(`Classe: ${CLASSE_PROCESSUAL_LABELS[audiencia.classeProcessual]}`, marginX, cursorY)
  doc.text(`Sala: ${audiencia.salaNome ?? '—'}`, col2X, cursorY)
  cursorY += 14
  doc.text(`Objeto: ${OBJETO_FEITO_LABELS[audiencia.objetoDoFeito]}`, marginX, cursorY)
  doc.text(`Magistrado: ${audiencia.magistradoNome ?? '—'}`, col2X, cursorY)
  cursorY += 20

  if (audiencia.reuPreso) {
    doc.setFillColor(253, 236, 236)
    doc.setDrawColor(226, 75, 74)
    doc.roundedRect(marginX, cursorY, pageWidth - marginX * 2, 24, 6, 6, 'FD')
    doc.setTextColor(180, 38, 38)
    doc.setFont('helvetica', 'bold')
    doc.text('ATENÇÃO: Réu preso', marginX + 10, cursorY + 16)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    cursorY += 34
  }

  if (audiencia.juizoDeprecante) {
    doc.text(`Juízo Deprecante: ${audiencia.juizoDeprecante}`, marginX, cursorY)
    cursorY += 18
  }

  const linhasReusAdvogados: string[][] = []
  const totalLinhas = Math.max(audiencia.reus.length, audiencia.advogados.length)
  for (let i = 0; i < totalLinhas; i += 1) {
    const reu = audiencia.reus[i]
    const advogado = audiencia.advogados[i]
    linhasReusAdvogados.push([
      reu?.nome || '—',
      reu ? (reu.preso ? 'Preso' : 'Solto') : '—',
      advogado?.nome || '—',
      advogado?.oab || '—',
      advogado ? ADVOGADO_TIPO_LABELS[advogado.tipo] : '—',
    ])
  }

  autoTable(doc, {
    startY: cursorY,
    head: [['Réu', 'Situação', 'Advogado', 'OAB', 'Tipo']],
    body: linhasReusAdvogados.length ? linhasReusAdvogados : [['—', '—', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [84, 74, 183] },
    margin: { left: marginX, right: marginX },
  })

  cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY
  cursorY += 18

  if (audiencia.vitimas.length) {
    doc.setFont('helvetica', 'bold')
    doc.text('Vítimas:', marginX, cursorY)
    doc.setFont('helvetica', 'normal')
    doc.text(audiencia.vitimas.join(', '), marginX + 48, cursorY)
    cursorY += 20
  }

  for (const fase of [1, 2, 3, 4, 5] as FaseProcedimento[]) {
    const itensFase = itens
      .filter((item) => item.fase === fase)
      .sort((a, b) => a.ordem - b.ordem)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`Fase ${fase} — ${FASES_LABELS[fase]}`, marginX, cursorY)
    cursorY += 8

    autoTable(doc, {
      startY: cursorY,
      head: [['Item', 'Obrigatório', 'Resposta', 'Observações']],
      body: itensFase.map((item) => [
        item.descricao,
        item.obrigatorio ? 'Sim' : '—',
        respostaParaTexto(item.resposta),
        item.observacao || '—',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [29, 158, 117] },
      margin: { left: marginX, right: marginX },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2 && data.cell.raw === '[ Em aberto ]') {
          data.cell.styles.textColor = [180, 38, 38]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY
    const concluidos = itensFase.filter((item) => item.resposta !== undefined && item.resposta !== null && item.resposta !== '').length
    const criticos = itensFase.filter((item) => item.critico && (item.resposta === undefined || item.resposta === null || item.resposta === '')).length
    cursorY += 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`${concluidos} de ${itensFase.length} itens · ${criticos} obrigatório(s) pendente(s)`, marginX, cursorY)
    cursorY += 20
  }

  if (participantes.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Participantes', marginX, cursorY)
    cursorY += 8

    autoTable(doc, {
      startY: cursorY,
      head: [['Nome', 'Tipo', 'Documento', 'OAB', 'Presente']],
      body: participantes.map((participante) => [
        participante.nome,
        TIPO_PARTICIPANTE_LABELS[participante.tipo],
        participante.documento || '—',
        participante.oab || '—',
        participante.presente === true ? 'Sim' : participante.presente === false ? 'Não' : '—',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [84, 74, 183] },
      margin: { left: marginX, right: marginX },
    })

    cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY
    cursorY += 18
  }

  if (documentos.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Documentos vinculados', marginX, cursorY)
    cursorY += 8

    autoTable(doc, {
      startY: cursorY,
      head: [['Nome', 'Tipo', 'Identificação no sistema']],
      body: documentos.map((documento) => [
        documento.nome,
        tipoDocumentoParaTexto(documento.tipo),
        documento.idPje,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [29, 158, 117] },
      margin: { left: marginX, right: marginX },
    })
  }

  const totalPages = doc.getNumberOfPages()
  const dataGeracao = format(new Date(), 'dd/MM/yyyy HH:mm')
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('SCAC · 4ª Vara Federal Criminal', marginX, pageHeight - 18)
    doc.text(`${page} / ${totalPages}`, pageWidth / 2, pageHeight - 18, { align: 'center' })
    doc.text(dataGeracao, pageWidth - marginX, pageHeight - 18, { align: 'right' })
  }

  const dataArquivo = format(inicio, 'yyyy-MM-dd')
  const numeroNormalizado = audiencia.numeroProcesso.replace(/[^\d.-]/g, '_')
  doc.save(`checklist_${numeroNormalizado}_${dataArquivo}.pdf`)
}
