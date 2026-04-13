import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const PROJECT_ID = 'audienciascriminais4vara'
const DATABASE = '(default)'
const MAPEAMENTO = {
  admin: 'diretor',
  juiz: 'magistrado',
  servidor: 'servidor',
  secretaria: 'supervisor',
  visualizador: 'convidado',
}

async function obterToken() {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json')
  const raw = await fs.readFile(configPath, 'utf8')
  const json = JSON.parse(raw)
  return json?.tokens?.access_token
}

async function chamar(url, init = {}) {
  const token = await obterToken()
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Falha ${resp.status} em ${url}: ${body}`)
  }

  if (resp.status === 204) return null
  return resp.json()
}

function extrairPerfil(documento) {
  return documento?.fields?.perfil?.stringValue ?? null
}

async function listarUsuarios() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}/documents/usuarios?pageSize=1000`
  const data = await chamar(url)
  return data.documents ?? []
}

async function atualizarPerfil(documento, perfilNovo) {
  const url = `https://firestore.googleapis.com/v1/${documento.name}?updateMask.fieldPaths=perfil`
  return chamar(url, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: {
        perfil: { stringValue: perfilNovo },
      },
    }),
  })
}

function incrementar(mapa, chave) {
  mapa[chave] = (mapa[chave] ?? 0) + 1
}

const documentos = await listarUsuarios()
const relatorio = {
  encontradosPorOrigem: {},
  atualizadosPorOrigem: {},
  jaCompativeisPorOrigem: {},
  semMapeamento: {},
}

for (const documento of documentos) {
  const perfilAtual = extrairPerfil(documento)
  if (!perfilAtual) continue

  incrementar(relatorio.encontradosPorOrigem, perfilAtual)
  const perfilNovo = MAPEAMENTO[perfilAtual]

  if (!perfilNovo) {
    incrementar(relatorio.semMapeamento, perfilAtual)
    continue
  }

  if (perfilNovo === perfilAtual) {
    incrementar(relatorio.jaCompativeisPorOrigem, perfilAtual)
    continue
  }

  await atualizarPerfil(documento, perfilNovo)
  incrementar(relatorio.atualizadosPorOrigem, perfilAtual)
}

const finais = await listarUsuarios()
const finaisPorPerfil = {}
for (const documento of finais) {
  const perfil = extrairPerfil(documento)
  if (!perfil) continue
  incrementar(finaisPorPerfil, perfil)
}

console.log(JSON.stringify({
  totalDocumentos: documentos.length,
  relatorio,
  finaisPorPerfil,
}, null, 2))
