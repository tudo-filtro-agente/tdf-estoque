import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Package,
  Upload,
  Activity,
  Tag,
  Users,
  LogOut,
  Menu,
  LayoutDashboard,
  BarChart3,
  X,
  ClipboardList,
  Database,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, perfil: ['administrador', 'estoquista', 'financeiro'] },
  { name: 'Produtos', href: '/produtos', icon: Package, perfil: ['administrador', 'estoquista'] },
  { name: 'Movimentações', href: '/movimentacoes', icon: Activity, perfil: ['administrador', 'estoquista'] },
  { name: 'Importar', href: '/importar', icon: Upload, perfil: ['administrador', 'estoquista'] },
  { name: 'Categorias', href: '/categorias', icon: Tag, perfil: ['administrador'] },
  { name: 'Cadastros', href: '/cadastros', icon: ClipboardList, perfil: ['administrador', 'estoquista'] },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3, perfil: ['administrador', 'financeiro'] },
  { name: 'Fontes', href: '/fontes', icon: Database, perfil: ['administrador'] },
  { name: 'Usuários', href: '/usuarios', icon: Users, perfil: ['administrador'] },
]

export default function Layout() {
  const { usuario, logout } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  const visibleNavigation = navigation.filter(
    (item) => usuario && item.perfil.includes(usuario.perfil)
  )

  const sideContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500">
          <span className="text-sm font-bold text-white">TDF</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">TDF Estoque</div>
          <div className="text-xs text-white/60">Controle</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {visibleNavigation.map((item) => {
          const isActive = location.pathname === item.href ||
            location.pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'nav-item-ativo'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? 'text-teal-300' : ''}`} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/20 text-teal-300">
            {usuario?.nome?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {usuario?.nome || 'Usuário'}
            </p>
            <p className="text-xs text-white/60 capitalize">
              {usuario?.perfil || 'estoquista'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-white/70 hover:text-white hover:bg-white/10"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-64 lg:flex-col lg:bg-navy lg:shadow-lg">
        {sideContent}
      </div>

      {/* Overlay mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Drawer mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-navy transform transition-transform lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          className="absolute right-3 top-3 text-white/70 hover:text-white"
          onClick={() => setMobileMenuOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
        {sideContent}
      </div>

      {/* Topbar mobile */}
      <div className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-white px-4 shadow-sm lg:hidden">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-slate-700"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex-1 text-lg font-semibold text-slate-900">
          TDF Estoque
        </div>
      </div>

      <div className="lg:pl-64">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}