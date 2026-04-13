import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Select } from '../ui'
import { TipoModelo, type ModeloDocumento } from '../../types/core'
import { EditorModelo } from './EditorModelo'

interface FormularioModeloProps {
  modelo?: ModeloDocumento
  onSalvar: (dados: Omit<ModeloDocumento, 'id' | 'criadoEm' | 'atualizadoEm' | 'versao' | 'arquivado' | 'criadoPor'>) => Promise<void>
  onCancelar: () => void
  carregando?: boolean
}

const schema = z.object({
  nome: z.string().trim().min(3, 'Informe ao menos 3 caracteres.').max(100, 'Maximo de 100 caracteres.'),
  tipo: z.nativeEnum(TipoModelo),
  visivelPara: z.enum(['todos', 'magistrado', 'servidor']),
  conteudo: z.string().trim().min(10, 'O conteudo precisa ter ao menos 10 caracteres.'),
  variaveis: z.array(z.string()).default([]),
})

type FormData = z.infer<typeof schema>

const TIPOS_MODELO_LABEL: Record<TipoModelo, string> = {
  [TipoModelo.ATA_AIJ]: 'Ata de AIJ',
  [TipoModelo.ATA_CUSTODIA]: 'Ata de Custodia',
  [TipoModelo.ATA_PRELIMINAR]: 'Ata de Audiencia Preliminar',
  [TipoModelo.ATA_ANPP]: 'Ata de ANPP',
  [TipoModelo.ATA_GENERICA]: 'Ata Generica',
  [TipoModelo.OUTRO]: 'Outro',
}

export function FormularioModelo({
  modelo,
  onSalvar,
  onCancelar,
  carregando = false,
}: FormularioModeloProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: modelo?.nome ?? '',
      tipo: modelo?.tipo ?? TipoModelo.ATA_GENERICA,
      visivelPara: modelo?.visivelPara ?? 'todos',
      conteudo: modelo?.conteudo ?? '',
      variaveis: modelo?.variaveis ?? [],
    },
  })

  useEffect(() => {
    form.reset({
      nome: modelo?.nome ?? '',
      tipo: modelo?.tipo ?? TipoModelo.ATA_GENERICA,
      visivelPara: modelo?.visivelPara ?? 'todos',
      conteudo: modelo?.conteudo ?? '',
      variaveis: modelo?.variaveis ?? [],
    })
  }, [form, modelo])

  const conteudo = form.watch('conteudo')
  const variaveis = form.watch('variaveis')

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        await onSalvar({
          nome: values.nome.trim(),
          tipo: values.tipo,
          visivelPara: values.visivelPara,
          conteudo: values.conteudo,
          variaveis: values.variaveis,
        })
      })}
    >
      <Input
        label="Nome do modelo"
        placeholder="Ex: Ata AIJ - Instrucao completa"
        error={form.formState.errors.nome?.message}
        {...form.register('nome')}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Tipo"
          error={form.formState.errors.tipo?.message}
          {...form.register('tipo')}
        >
          {Object.entries(TIPOS_MODELO_LABEL).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>{rotulo}</option>
          ))}
        </Select>

        <div className="space-y-2">
          <div className="text-xs font-medium text-aurora-text-secondary">Visivel para</div>
          <label className="flex items-center gap-2 text-sm text-aurora-text-secondary">
            <input
              type="radio"
              value="todos"
              checked={form.watch('visivelPara') === 'todos'}
              onChange={() => form.setValue('visivelPara', 'todos', { shouldValidate: true })}
            />
            Todos os usuarios
          </label>
          <label className="flex items-center gap-2 text-sm text-aurora-text-secondary">
            <input
              type="radio"
              value="magistrado"
              checked={form.watch('visivelPara') === 'magistrado'}
              onChange={() => form.setValue('visivelPara', 'magistrado', { shouldValidate: true })}
            />
            Apenas magistrados
          </label>
          <label className="flex items-center gap-2 text-sm text-aurora-text-secondary">
            <input
              type="radio"
              value="servidor"
              checked={form.watch('visivelPara') === 'servidor'}
              onChange={() => form.setValue('visivelPara', 'servidor', { shouldValidate: true })}
            />
            Apenas servidores
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-aurora-text-secondary">Conteudo</div>
        <EditorModelo
          conteudo={conteudo}
          variaveis={variaveis}
          onChange={(novoConteudo, novasVariaveis) => {
            form.setValue('conteudo', novoConteudo, { shouldValidate: true, shouldDirty: true })
            form.setValue('variaveis', novasVariaveis, { shouldDirty: true })
          }}
        />
        {form.formState.errors.conteudo?.message && (
          <p className="text-2xs text-aurora-red">{form.formState.errors.conteudo.message}</p>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-aurora-border pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={carregando}>
          Salvar modelo
        </Button>
      </div>
    </form>
  )
}

