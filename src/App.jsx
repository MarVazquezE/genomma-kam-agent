import { useState } from "react"
import Dashboard from "./pages/Dashboard"
import Account360 from "./pages/Account360"
import AgentPage from "./pages/AgentPage"
import MarketSignals from "./pages/MarketSignals"
import PresentacionCliente from "./pages/PresentacionCliente"
import OnePager from "./pages/OnePager"

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [subView, setSubView] = useState(null)

  function handleSelectAccount(accountId) {
    setSelectedAccount(accountId)
    setSubView("360")
    setActiveTab("dashboard")
  }

  function handleGoToAgent() { setSubView("agent") }
  function handleGoToPresentacion() { setSubView("presentacion") }
  function handleGoToOnePager() { setSubView("onepager") }

  function handleBack() {
    if (subView === "agent" || subView === "presentacion" || subView === "onepager") { setSubView("360") }
    else { setSubView(null); setSelectedAccount(null) }
  }

  function handleTabChange(tab) {
    setActiveTab(tab)
    setSubView(null)
    setSelectedAccount(null)
  }

  const showAccountNav = selectedAccount && subView === "360"
  const showAgentNav = selectedAccount && subView === "agent"
  const showPresNav = selectedAccount && subView === "presentacion"

  const navItems = showAccountNav
    ? [{ id: "back", label: "â† Volver" }, { id: "360", label: "Vista 360", active: true }, { id: "agent", label: "Agente IA" }, { id: "presentacion", label: "Presentacion" }]
    : showAgentNav
    ? [{ id: "back", label: "â† Volver" }, { id: "360", label: "Vista 360" }, { id: "agent", label: "Agente IA", active: true }, { id: "presentacion", label: "Presentacion" }, { id: "onepager", label: "One-Pager" }]
    : showPresNav
    ? [{ id: "back", label: "â† Volver" }, { id: "360", label: "Vista 360" }, { id: "agent", label: "Agente IA" }, { id: "presentacion", label: "Presentacion", active: true }, { id: "onepager", label: "One-Pager" }]
    : selectedAccount && subView === "onepager"
    ? [{ id: "back", label: "â† Volver" }, { id: "360", label: "Vista 360" }, { id: "agent", label: "Agente IA" }, { id: "presentacion", label: "Presentacion" }, { id: "onepager", label: "One-Pager", active: true }]
    : [
        { id: "dashboard", label: "Dashboard", active: activeTab === "dashboard" },
        { id: "signals", label: "Senales Bursatiles", active: activeTab === "signals" },
      ]

  function handleNavClick(id) {
    if (id === "back") handleBack()
    else if (id === "360") setSubView("360")
    else if (id === "agent") setSubView("agent")
    else if (id === "presentacion") setSubView("presentacion")
    else if (id === "onepager") setSubView("onepager")
    else handleTabChange(id)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="header-logo"><span>G09</span></div>
          <div>
            <div className="header-title">Genomma KAM Agent</div>
            <div className="header-subtitle">Area 09 Â· Plataforma Inteligente de Cuentas Clave</div>
          </div>
        </div>
        <div className="header-kam">
          <span style={{ fontSize: 12, color: "var(--silver)" }}>Semana 47, 2024</span>
          <div style={{ width: 1, height: 16, background: "var(--slate)" }} />
          <div className="kam-avatar">AD</div>
          <span>Alan Donatto Â· Director Canal Moderno</span>
        </div>
      </header>
      <nav className="nav">
        {navItems.map(item => (
          <button key={item.id} className={`nav-btn ${item.active ? "active" : ""}`} onClick={() => handleNavClick(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      <main className="main">
        {activeTab === "signals" && !selectedAccount && <MarketSignals />}
        {activeTab === "dashboard" && !selectedAccount && <Dashboard onSelectAccount={handleSelectAccount} onModuleClick={(module) => {
          if (module === "signals") { handleTabChange("signals") }
          else {
            setSelectedAccount("wmt")
            setSubView(module)
            setActiveTab("dashboard")
          }
        }} />}
        {selectedAccount && subView === "360" && <Account360 accountId={selectedAccount} onBack={handleBack} onGoToAgent={handleGoToAgent} onGoToPresentacion={handleGoToPresentacion} onGoToOnePager={handleGoToOnePager} />}
        {selectedAccount && subView === "agent" && <AgentPage accountId={selectedAccount} onBack={handleBack} />}
        {selectedAccount && subView === "presentacion" && <PresentacionCliente accountId={selectedAccount} onBack={handleBack} />}
        {selectedAccount && subView === "onepager" && <OnePager accountId={selectedAccount} onBack={handleBack} />}
      </main>
    </div>
  )
}


