// ============================================
// INSTRUCTIONS: Update your app/page.tsx file
// ============================================

// 1. ADD THIS IMPORT at the top of app/page.tsx (around line 13):
import MaintenanceToggle from './components/MaintenanceToggle';

// 2. ADD THIS STATE variable with your other useState declarations (around line 60-100):
const [adminTab, setAdminTab] = useState<'support' | 'maintenance'>('support');

// 3. REPLACE the entire AdminContent function (around line 5404) with this:
const AdminContent = () => (
  <div className="max-w-3xl mx-auto w-full p-4 h-full flex flex-col overflow-hidden">
    {/* Tab Navigation */}
    <div className="flex gap-2 mb-4 flex-shrink-0">
      <button
        onClick={() => setAdminTab('support')}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          adminTab === 'support'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        Support Tickets
      </button>
      <button
        onClick={() => setAdminTab('maintenance')}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          adminTab === 'maintenance'
            ? 'bg-orange-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        Maintenance Mode
      </button>
    </div>

    {/* Tab Content */}
    {adminTab === 'maintenance' ? (
      <div className="flex-1 overflow-y-auto">
        <MaintenanceToggle />
      </div>
    ) : (
      <>
        {/* EXISTING SUPPORT TICKETS CODE STARTS HERE */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">Support Tickets</h2>
          <button
            onClick={loadAdminTickets}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3 flex-shrink-0">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-blue-400">{adminTickets.filter(t => t.status === "open").length}</p>
            <p className="text-[10px] text-slate-400">Open</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-amber-400">{adminTickets.filter(t => t.status === "in-progress").length}</p>
            <p className="text-[10px] text-slate-400">In Progress</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-emerald-400">{adminTickets.filter(t => t.status === "resolved").length}</p>
            <p className="text-[10px] text-slate-400">Resolved</p>
          </div>
        </div>

        {loadingTickets ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : adminTickets.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-500">No support tickets yet.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {adminTickets.map(ticket => (
              <div key={ticket.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white">{ticket.subject}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] text-slate-400">{ticket.userEmail}</span>
                      <span className="text-[10px] text-slate-600">|</span>
                      <span className="text-[10px] text-slate-400 capitalize">{ticket.category.replace("-", " ")}</span>
                      <span className="text-[10px] text-slate-600">|</span>
                      <span className="text-[10px] text-slate-500">
                        {ticket.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {ticket.projectName && (
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                        </svg>
                        {ticket.projectName}
                      </span>
                    )}
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                    ticket.status === "resolved"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : ticket.status === "in-progress"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-blue-500/15 text-blue-400"
                  }`}>
                    {ticket.status === "in-progress" ? "In Progress" : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                  </span>
                </div>

                {/* Conversation thread */}
                <div className="mb-3 space-y-1.5 max-h-40 overflow-y-auto">
                  {ticket.messages && ticket.messages.length > 0 ? (
                    ticket.messages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs ${
                          msg.sender === "admin"
                            ? "bg-emerald-500/10 border border-emerald-500/20 text-slate-200"
                            : "bg-blue-600/10 border border-blue-500/20 text-slate-300"
                        }`}>
                          <p className={`text-[9px] font-medium mb-0.5 ${msg.sender === 'admin' ? 'text-emerald-400' : 'text-blue-400'}`}>{msg.sender === "admin" ? "You" : ticket.userName}</p>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          <p className="text-[8px] text-slate-500 mt-0.5 text-right">{new Date(msg.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{ticket.description}</p>
                  )}
                </div>

                {/* Response form */}
                {respondingToTicketId === ticket.id ? (
                  <div className="space-y-2 border-t border-slate-800 pt-3">
                    <textarea
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      placeholder="Type your response..."
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500/50 resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => respondToTicket(ticket.id, adminResponse, "in-progress")}
                        disabled={!adminResponse.trim()}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition disabled:opacity-40"
                      >
                        Send (In Progress)
                      </button>
                      <button
                        onClick={() => respondToTicket(ticket.id, adminResponse, "resolved")}
                        disabled={!adminResponse.trim()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition disabled:opacity-40"
                      >
                        Send & Resolve
                      </button>
                      <button
                        onClick={() => { setRespondingToTicketId(null); setAdminResponse(""); }}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
                    <button
                      onClick={() => { setRespondingToTicketId(ticket.id); setAdminResponse(""); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                      </svg>
                      Respond
                    </button>
                    {ticket.status !== "resolved" && (
                      <button
                        onClick={() => respondToTicket(ticket.id, "Resolved.", "resolved")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Mark Resolved
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {/* EXISTING SUPPORT TICKETS CODE ENDS HERE */}
      </>
    )}
  </div>
);

// That's it! Save the file and you're done.
