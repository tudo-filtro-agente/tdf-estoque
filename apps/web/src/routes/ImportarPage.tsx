import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Download, Table, Layers } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'

interface SheetInfo {
  name: string
  rowCount: number
  columns: string[]
}

interface SheetResult {
  sheet: string
  total: number
  importados: number
  duplicados: number
  erros: Array<{ linha: number; coluna: string; mensagem: string }>
  produtos: Array<{ codigo: string; nome: string; categoria?: string; localizacao?: string }>
}

interface ImportResult {
  total: number
  importados: number
  duplicados: number
  erros: Array<{ linha: number; coluna: string; mensagem: string }>
  produtos: Array<{ codigo: string; nome: string; categoria?: string; localizacao?: string }>
  sheet?: string
  results?: SheetResult[]
  summary?: { total: number; importados: number; erros: number }
  dryRun: boolean
  message?: string
}

export default function ImportarPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
    })
  }

  const previewMutation = useMutation({
    mutationFn: async ({ file, allSheets = false }: { file: File; allSheets?: boolean }) => {
      const base64 = await fileToBase64(file)
      return fetch('/api/produtos/importar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ file: base64.split(',')[1], dryRun: true, allSheets }),
      }).then(r => r.json())
    },
    onSuccess: (data) => {
      setPreview(data)
      // Selecionar todas as abas por padrão se for allSheets
      if (data.results) {
        setSelectedSheets(data.results.map((r: SheetResult) => r.sheet))
      }
    },
  })

  const importMutation = useMutation({
    mutationFn: async ({ file, allSheets = false }: { file: File; allSheets?: boolean }) => {
      const base64 = await fileToBase64(file)
      return fetch('/api/produtos/importar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ file: base64.split(',')[1], dryRun: false, allSheets }),
      }).then(r => r.json())
    },
    onSuccess: (data) => {
      setPreview(data)
    },
  })

  const downloadTemplate = async (tdf = false) => {
    try {
      const endpoint = tdf ? '/api/produtos/importar/template-tdf' : '/api/produtos/importar/template'
      const filename = tdf ? 'template-tdf-estoque.xlsx' : 'template-importacao.xlsx'

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      alert('Erro ao baixar template')
    }
  }

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      alert('Apenas arquivos .xlsx ou .xls são aceitos')
      return
    }
    setFile(selectedFile)
    setPreview(null)
    // Preview com todas as abas
    previewMutation.mutate({ file: selectedFile, allSheets: true })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFile(droppedFile)
  }

  const handleImport = () => {
    if (!file) return
    importMutation.mutate({ file, allSheets: true })
  }

  const resetImport = () => {
    setFile(null)
    setPreview(null)
    setSelectedSheets([])
  }

  const getCategoryBadgeColor = (categoria?: string) => {
    switch (categoria?.toLowerCase()) {
      case 'elementos': return 'bg-amber-100 text-amber-800'
      case 'purificadores': return 'bg-blue-100 text-blue-800'
      case 'refis': return 'bg-green-100 text-green-800'
      case 'tanks': return 'bg-purple-100 text-purple-800'
      case 'valvulas': return 'bg-red-100 text-red-800'
      case 'conexoes': return 'bg-orange-100 text-orange-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Importar Planilha</h1>
          <p className="text-sm text-slate-500">Importe produtos do inventário Excel</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadTemplate(false)}>
            <Download className="mr-2 h-4 w-4" />
            Template Genérico
          </Button>
          <Button variant="outline" onClick={() => downloadTemplate(true)}>
            <Download className="mr-2 h-4 w-4" />
            Template TDF
          </Button>
        </div>
      </div>

      {!file ? (
        <Card>
          <CardContent className="pt-6">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-slate-300'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-lg font-medium">Arraste e solte seu arquivo aqui</h3>
              <p className="mt-1 text-sm text-slate-500">ou clique para selecionar</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                Selecionar Arquivo
              </Button>
              <p className="mt-2 text-xs text-slate-400">Apenas arquivos .xlsx ou .xls (máx. 5MB)</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* File info */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={resetImport}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {preview && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-slate-900">
                        {preview.summary?.total || preview.total}
                      </p>
                      <p className="text-sm text-slate-500">Total de Linhas</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">
                        {preview.summary?.importados || preview.importados}
                      </p>
                      <p className="text-sm text-slate-500">Prontos para Importar</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-amber-600">
                        {(preview.summary?.erros || preview.erros.length) + preview.duplicados}
                      </p>
                      <p className="text-sm text-slate-500">Com Problemas</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">
                        {preview.results?.length || 1}
                      </p>
                      <p className="text-sm text-slate-500">Abas</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Multi-sheet results */}
              {preview.results && preview.results.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      Abas a Importar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {preview.results.map((result, idx) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className={getCategoryBadgeColor(result.sheet)}>
                                {result.sheet}
                              </Badge>
                              <span className="text-sm text-slate-500">
                                {result.total} linhas • {result.importados} prontas
                              </span>
                            </div>
                            {result.erros.length > 0 && (
                              <Badge variant="destructive">
                                {result.erros.length} erros
                              </Badge>
                            )}
                          </div>

                          {/* Preview products from this sheet */}
                          {result.produtos.length > 0 && (
                            <div className="overflow-x-auto mt-2">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b">
                                  <tr>
                                    <th className="px-3 py-1 text-left text-xs font-medium text-slate-500">Código</th>
                                    <th className="px-3 py-1 text-left text-xs font-medium text-slate-500">Nome</th>
                                    <th className="px-3 py-1 text-left text-xs font-medium text-slate-500">Localização</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {result.produtos.slice(0, 5).map((p, i) => (
                                    <tr key={i}>
                                      <td className="px-3 py-1 font-mono text-xs">{p.codigo || '-'}</td>
                                      <td className="px-3 py-1">{p.nome}</td>
                                      <td className="px-3 py-1 text-slate-500">{p.localizacao || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {result.produtos.length > 5 && (
                                <p className="text-xs text-slate-400 mt-1">
                                  ... e mais {result.produtos.length - 5} produtos
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Single sheet preview (fallback) */}
              {!preview.results && preview.produtos && preview.produtos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Table className="h-5 w-5" />
                      Preview (primeiros 10)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Código</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Nome</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Categoria</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Localização</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {preview.produtos.slice(0, 10).map((p, i) => (
                            <tr key={i}>
                              <td className="px-4 py-2 text-sm font-mono">{p.codigo || '-'}</td>
                              <td className="px-4 py-2 text-sm">{p.nome}</td>
                              <td className="px-4 py-2 text-sm">
                                <Badge className={getCategoryBadgeColor(p.categoria)}>
                                  {p.categoria || '-'}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-500">{p.localizacao || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Errors */}
              {(preview.erros.length > 0 || preview.results?.some(r => r.erros.length > 0)) && (
                <Card className="border-red-200">
                  <CardHeader className="bg-red-50 border-b">
                    <CardTitle className="text-lg text-red-700 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Erros de Validação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-red-50/50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-600">Aba</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-600">Linha</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-600">Problema</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(preview.results || [{ erros: preview.erros, sheet: preview.sheet }])
                            .flatMap((r: any) => r.erros.map((err: any) => ({ ...err, sheet: r.sheet })))
                            .slice(0, 20)
                            .map((err: any, i: number) => (
                              <tr key={i} className="text-sm">
                                <td className="px-4 py-2">
                                  <Badge variant="outline">{err.sheet}</Badge>
                                </td>
                                <td className="px-4 py-2">{err.linha || '-'}</td>
                                <td className="px-4 py-2 text-red-600">{err.mensagem}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Success message */}
              {!preview.dryRun && preview.importados > 0 && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 text-green-700">
                      <CheckCircle className="h-6 w-6" />
                      <div>
                        <p className="font-medium">Importação concluída!</p>
                        <p className="text-sm">{preview.message}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={resetImport}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importMutation.isPending || (preview.summary?.importados || preview.importados) === 0}
                >
                  {importMutation.isPending ? (
                    'Importando...'
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Importar {preview.summary?.importados || preview.importados} produtos
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
