import { useState } from "react"
import Dashboard from "./pages/Dashboard"
import Account360 from "./pages/Account360"
import AgentPage from "./pages/AgentPage"
import MarketSignals from "./pages/MarketSignals"

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

  function handleBack() {
    if (subView === "agent") { setSubView("360") }
    else { setSubView(null); setSelectedAccount(null) }
  }

  function handleTabChange(tab) {
    setActiveTab(tab)
    setSubView(null)
    setSelectedAccount(null)
  }

  const showAccountNav = selectedAccount && subView === "360"
  const showAgentNav = selectedAccount && subView === "agent"

  const navItems = showAccountNav
    ? [{ id: "back", label: "← Volver" }, { id: "360", label: "Vista 360°", active: true }, { id: "agent", label: "Agente IA" }]
    : showAgentNav
    ? [{ id: "back", label: "← Volver" }, { id: "360", label: "Vista 360°" }, { id: "agent", label: "Agente IA", active: true }]
    : [{ id: "dashboard", label: "Dashboard", active: activeTab === "dashboard" }, { id: "signals", label: "Senales Bursatiles", active: activeTab === "signals" }]

  function handleNavClick(id) {
    if (id === "back") handleBack()
    else if (id === "360") setSubView("360")
    else if (id === "agent") setSubView("agent")
    else handleTabChange(id)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="header-logo"><span>G09</span></div>
          <div>
            <div className="header-title">Genomma KAM Agent</div>
            <div className="header-subtitle">Area 09 · Plataforma Inteligente de Cuentas Clave</div>
          </div>
        </div>
        <div className="header-kam">
          <span style={{ fontSize: 12, color: "var(--gray-400)" }}>Semana 47, 2024</span>
          <div style={{ width: 1, height: 16, background: "var(--gray-200)" }} />
          <div className="kam-avatar">ST</div>
          <span>Sofia Torres · KAM Senior</span>
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
        {activeTab === "dashboard" && !selectedAccount && <Dashboard onSelectAccount={handleSelectAccount} />}
        {selectedAccount && subView === "360" && <Account360 accountId={selectedAccount} onBack={handleBack} onGoToAgent={handleGoToAgent} />}
        {selectedAccount && subView === "agent" && <AgentPage accountId={selectedAccount} onBack={handleBack} />}
      </main>
    </div>
  )
}
