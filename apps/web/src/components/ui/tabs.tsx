import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Sistema de abas próprio (sem dependência nova). Cada Tabs precisa de um TabsInner
 * interno — não usar o export Tabs default, ele está deprecated.
 *
 * Uso:
 *   <TabsInner defaultValue="resumo">
 *     <TabsList>
 *       <TabsTrigger value="resumo">Resumo</TabsTrigger>
 *       <TabsTrigger value="graficos">Gráficos</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="resumo">...</TabsContent>
 *   </TabsInner>
 */
const TabsContext = React.createContext<{
  value: string
  setValue: (v: string) => void
} | null>(null)

export function TabsInner({
  defaultValue,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { defaultValue: string }) {
  const [value, setValue] = React.useState(defaultValue)
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}
TabsInner.displayName = "TabsInner"

export const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500 gap-1",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value: triggerValue, ...props }, ref) => {
  const ctx = React.useContext(TabsContext)
  const active = ctx?.value === triggerValue

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => ctx?.setValue(triggerValue)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "hover:text-slate-900",
        className
      )}
      {...props}
    />
  )
})
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value: contentValue, ...props }, ref) => {
  const ctx = React.useContext(TabsContext)
  if (ctx?.value !== contentValue) return null

  return <div ref={ref} className={cn("mt-4", className)} {...props} />
})
TabsContent.displayName = "TabsContent"
