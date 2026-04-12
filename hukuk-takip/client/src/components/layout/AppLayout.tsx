import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileBottomNav from './MobileBottomNav'
import ActionSearchBar from '@/components/shared/ActionSearchBar'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={toggleSidebar} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-20 sm:p-4 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
      <ActionSearchBar />
    </div>
  )
}
