import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'

interface ImportResult {
  total: number
  importados: number
  duplicados: number
  erros: Array<{ linha: number; coluna: string; mensagem: string }>
  produtos: Array<{ codigo: string; nome: string; categoria?: string }>
}

export default function ImportarPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const importMutation = useMutation({
    mutationFn: async ({ file, dryRun }: { file: File; dryRun: boolean }) => {
      const base64 = await fileToBase64(file)
      return fetch('/api/produtos/importar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ file: base64.split(',')[1], dryRun }),
      }).then(r => r.json())
    },
    onSuccess: (data) => {
      setPreview(data)
    },
  })

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/produtos/importar/template', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'template-importacao.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      alert('Erro ao baixar template')
    }
  }

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      alert('Apenas arquivos .xlsx ou .xls são aceitos')
      return
    }
    setFile(selectedFile)
    importMutation.mutate({ file: selectedFile, dryRun: true })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFile(droppedFile)
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
    })
  }

  const handleImport = () => {
    if (!file) return
    importMutation.mutate({ file, dryRun: false })
  }

  const resetImport = () => {
    setFile(null)
    setPreview(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Importar Planilha</h1>
          <p className="text-sm text-slate-500">Importe produtos via arquivo Excel</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Baixar Template
        </Button>
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
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-slate-900">{preview.total}</p>
                      <p className="text-sm text-slate-500">Total de Linhas</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">{preview.importados}</p>
                      <p className="text-sm text-slate-500">Prontos para Importar</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-amber-600">{preview.duplicados + preview.erros.length}</p>
                      <p className="text-sm text-slate-500">Com Problemas</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Preview table */}
              {preview.produtos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Preview (primeiros 10)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Código</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Nome</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Categoria</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {preview.produtos.slice(0, 10).map((p, i) => (
                            <tr key={i}>
                              <td className="px-4 py-2 text-sm">{p.codigo}</td>
                              <td className="px-4 py-2 text-sm">{p.nome}</td>
                              <td className="px-4 py-2 text-sm text-slate-600">{p.categoria || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Errors */}
              {preview.erros.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader className="bg-red-50 border-b">
                    <CardTitle className="text-lg text-red-700 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Erros de Validação ({preview.erros.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-red-50/50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-600">Linha</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-600">Coluna</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-600">Problema</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {preview.erros.slice(0, 20).map((err, i) => (
                            <tr key={i} className="text-sm">
                              <td className="px-4 py-2">{err.linha || '-'}</td>
                              <td className="px-4 py-2">{err.coluna || '-'}</td>
                              <td className="px-4 py-2 text-red-600">{err.mensagem}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                  disabled={importMutation.isPending || preview.importados === 0}
                >
                  {importMutation.isPending ? (
                    'Importando...'
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Importar {preview.importados} produtos
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
