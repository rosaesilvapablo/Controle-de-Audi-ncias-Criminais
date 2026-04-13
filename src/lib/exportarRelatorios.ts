import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface IdentidadeVara {
  nomeVara: string
  nomeJuizo: string
  cidade: string
  uf: string
  brasaoUrl?: string
}

async function carregarImagemComoDataUrl(url: string): Promise<string | null> {
  try {
    const resposta = await fetch(url)
    const blob = await resposta.blob()

    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function adicionarCabecalho(params: {
  doc: jsPDF
  identidade: IdentidadeVara
  titulo: string
  subtitulo?: string
  brasaoDataUrl?: string | null
}) {
  const { doc, identidade, titulo, subtitulo, brasaoDataUrl } = params
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40
  let cursorY = 36

  if (brasaoDataUrl) {
    doc.addImage(brasaoDataUrl, 'PNG', marginX, cursorY - 4, 42, 42)
  }

  const textoX = brasaoDataUrl ? marginX + 54 : marginX
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(identidade.nomeJuizo || 'Justica Federal', textoX, cursorY + 6)
  doc.setFontSize(14)
  doc.text(identidade.nomeVara || '4a Vara Federal Criminal', textoX, cursorY + 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${identidade.cidade || ''} - ${identidade.uf || ''}`.trim(), textoX, cursorY + 36)

  cursorY += 58
  doc.setDrawColor(84, 74, 183)
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY)
  cursorY += 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(titulo, pageWidth / 2, cursorY, { align: 'center' })

  if (subtitulo) {
    cursorY += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(subtitulo, pageWidth / 2, cursorY, { align: 'center' })
  }

  return cursorY + 18
}

function adicionarRodape(doc: jsPDF, nomeUsuario: string) {
  const totalPages = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const dataTexto = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  for (let pagina = 1; pagina <= totalPages; pagina += 1) {
    doc.setPage(pagina)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Gerado em ${dataTexto} por ${nomeUsuario}`, 40, pageHeight - 18)
    doc.text(`Pagina ${pagina} de ${totalPages}`, pageWidth - 40, pageHeight - 18, {
      align: 'right',
    })
  }
}

export function exportarRelatorioPDF(params: {
  titulo: string
  subtitulo?: string
  colunas: string[]
  linhas: string[][]
  blocos?: { titulo: string; linhas: string[][] }[]
  identidade: IdentidadeVara
  nomeUsuario: string
  nomeArquivo: string
}): void {
  void (async () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const brasaoDataUrl = params.identidade.brasaoUrl
      ? await carregarImagemComoDataUrl(params.identidade.brasaoUrl)
      : null

    const startY = adicionarCabecalho({
      doc,
      identidade: params.identidade,
      titulo: params.titulo,
      subtitulo: params.subtitulo,
      brasaoDataUrl,
    })

    autoTable(doc, {
      startY,
      head: [params.colunas],
      body: params.linhas.length ? params.linhas : [['Nenhum registro encontrado.']],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [84, 74, 183] },
      margin: { left: 40, right: 40, bottom: 34 },
    })

    let cursorY =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      startY

    for (const bloco of params.blocos ?? []) {
      cursorY += 22
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(bloco.titulo, 40, cursorY)
      cursorY += 10

      autoTable(doc, {
        startY: cursorY,
        body: bloco.linhas.length ? bloco.linhas : [['Nenhum dado.']],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 5 },
        margin: { left: 40, right: 40, bottom: 34 },
      })

      cursorY =
        (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
        cursorY
    }

    adicionarRodape(doc, params.nomeUsuario)
    doc.save(params.nomeArquivo.endsWith('.pdf') ? params.nomeArquivo : `${params.nomeArquivo}.pdf`)
  })()
}
