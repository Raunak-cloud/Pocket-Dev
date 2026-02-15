"use client";

import { SavedProject, SupportTicket } from "@/app/types";

interface SupportContentProps {
  supportTickets: SupportTicket[];
  selectedTicketId: string | null;
  ticketSubmittedNotice: boolean;
  ticketCategory: SupportTicket["category"];
  ticketProjectId: string;
  ticketSubject: string;
  ticketDescription: string;
  savedProjects: SavedProject[];
  isSubmittingTicket: boolean;
  loadingTickets: boolean;
  replyingToTicketId: string | null;
  userReplyText: string;
  setTicketCategory: (value: SupportTicket["category"]) => void;
  setTicketProjectId: (value: string) => void;
  setTicketSubject: (value: string) => void;
  setTicketDescription: (value: string) => void;
  submitSupportTicket: () => void;
  loadSupportTickets: () => void;
  handleTicketClick: (id: string) => void;
  setReplyingToTicketId: (id: string | null) => void;
  setUserReplyText: (text: string) => void;
  userReplyToTicket: (ticketId: string) => void;
}

export default function SupportContent({
  supportTickets,
  selectedTicketId,
  ticketSubmittedNotice,
  ticketCategory,
  ticketProjectId,
  ticketSubject,
  ticketDescription,
  savedProjects,
  isSubmittingTicket,
  loadingTickets,
  replyingToTicketId,
  userReplyText,
  setTicketCategory,
  setTicketProjectId,
  setTicketSubject,
  setTicketDescription,
  submitSupportTicket,
  loadSupportTickets,
  handleTicketClick,
  setReplyingToTicketId,
  setUserReplyText,
  userReplyToTicket,
}: SupportContentProps) {
  const toDate = (value: Date | string | number | null | undefined) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (
    value: Date | string | number | null | undefined,
    options: Intl.DateTimeFormatOptions,
  ) => {
    const date = toDate(value);
    if (!date) return "Unknown date";
    return date.toLocaleDateString("en-US", options);
  };

  const formatTime = (
    value: Date | string | number | null | undefined,
    options: Intl.DateTimeFormatOptions,
  ) => {
    const date = toDate(value);
    if (!date) return "Unknown time";
    return date.toLocaleTimeString("en-US", options);
  };

  const selectedTicket = supportTickets.find(
    (t) => t.id === selectedTicketId,
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 12-hour notice banner */}
      {ticketSubmittedNotice && (
        <div className="flex-shrink-0 mx-4 mt-3 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2">
          <svg
            className="w-4 h-4 text-blue-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs text-blue-300">
            Sent! Expect a reply within{" "}
            <span className="font-semibold">12 hours</span>.
          </p>
        </div>
      )}

      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Left: Create Ticket + Ticket List */}
        <div className="w-[60%] flex-shrink-0 flex flex-col gap-3 min-h-0">
          {/* Create Ticket */}
          <div className="bg-bg-secondary/50 border border-border-primary rounded-xl p-4 flex-shrink-0">
            <h3 className="text-base font-semibold text-text-primary mb-3">
              New Ticket
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    {
                      value: "project-issue",
                      label: "Project",
                      icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z",
                    },
                    {
                      value: "billing",
                      label: "Billing",
                      icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
                    },
                    {
                      value: "feature-request",
                      label: "Feature",
                      icon: "M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18",
                    },
                    {
                      value: "general",
                      label: "General",
                      icon: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z",
                    },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setTicketCategory(cat.value)}
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition border ${
                      ticketCategory === cat.value
                        ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                        : "bg-bg-tertiary/50 text-text-muted border-border-secondary/50 hover:text-text-secondary"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={cat.icon}
                      />
                    </svg>
                    {cat.label}
                  </button>
                ))}
              </div>
              {ticketCategory === "project-issue" &&
                savedProjects.length > 0 && (
                  <select
                    value={ticketProjectId}
                    onChange={(e) => setTicketProjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-tertiary/50 border border-border-secondary rounded-lg text-text-primary text-sm focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="">Select project (optional)</option>
                    {savedProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.prompt.length > 50
                          ? p.prompt.substring(0, 50) + "..."
                          : p.prompt}
                      </option>
                    ))}
                  </select>
                )}
              <input
                type="text"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Subject"
                className="w-full px-3 py-2 bg-bg-tertiary/50 border border-border-secondary rounded-lg text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-blue-500/50"
              />
              <textarea
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                placeholder="Describe your issue..."
                rows={3}
                className="w-full px-3 py-2 bg-bg-tertiary/50 border border-border-secondary rounded-lg text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-blue-500/50 resize-none"
              />
              <button
                onClick={submitSupportTicket}
                disabled={
                  isSubmittingTicket ||
                  !ticketSubject.trim() ||
                  !ticketDescription.trim()
                }
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmittingTicket ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </div>

          {/* Ticket List */}
          <div className="flex-1 bg-bg-secondary/50 border border-border-primary rounded-xl flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-secondary">
                My Tickets
              </h3>
              <button
                onClick={loadSupportTickets}
                className="text-xs text-text-muted hover:text-text-primary transition"
              >
                Refresh
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingTickets ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : supportTickets.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-6">
                  No tickets yet
                </p>
              ) : (
                <div className="divide-y divide-border-primary/50">
                  {supportTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => handleTicketClick(ticket.id)}
                      className={`w-full text-left px-4 py-3 transition hover:bg-bg-tertiary/40 ${
                        selectedTicketId === ticket.id
                          ? "bg-bg-tertiary/60"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-text-primary truncate">
                            {ticket.subject}
                          </h4>
                          {ticket.unreadAdminMessageCount &&
                            ticket.unreadAdminMessageCount > 0 && (
                              <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            )}
                        </div>
                        <span
                          className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            ticket.status === "resolved"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : ticket.status === "in-progress"
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-blue-500/15 text-blue-400"
                          }`}
                        >
                          {ticket.status === "in-progress"
                            ? "In Progress"
                            : ticket.status.charAt(0).toUpperCase() +
                              ticket.status.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-text-muted">
                          {formatDate(ticket.createdAt, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="text-xs text-text-faint">-</span>
                        <span className="text-xs text-text-muted capitalize">
                          {ticket.category.replace("-", " ")}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Selected Ticket Detail / Conversation */}
        <div className="w-[40%] bg-bg-secondary/50 border border-border-primary rounded-xl flex flex-col min-h-0">
          {selectedTicket ? (
            <>
              {/* Ticket Header */}
              <div className="flex-shrink-0 px-4 py-3 border-b border-border-primary">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-text-primary truncate">
                      {selectedTicket.subject}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted">
                        {formatDate(selectedTicket.createdAt, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-xs text-text-muted capitalize">
                        {selectedTicket.category.replace("-", " ")}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      selectedTicket.status === "resolved"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : selectedTicket.status === "in-progress"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-blue-500/15 text-blue-400"
                    }`}
                  >
                    {selectedTicket.status === "in-progress"
                      ? "In Progress"
                      : selectedTicket.status.charAt(0).toUpperCase() +
                        selectedTicket.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Conversation Thread */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                {/* Original description as first message */}
                {!(
                  selectedTicket.messages &&
                  selectedTicket.messages.length > 0
                ) ? (
                  <>
                    <div className="flex justify-end">
                      <div className="max-w-[80%] px-3 py-2 bg-blue-600/20 border border-blue-500/20 rounded-xl rounded-tr-sm">
                        <p className="text-sm text-text-secondary whitespace-pre-wrap">
                          {selectedTicket.description}
                        </p>
                        <p className="text-[11px] text-text-muted mt-1 text-right">
                          {formatTime(selectedTicket.createdAt, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    {selectedTicket.adminResponse && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] px-3 py-2 bg-bg-tertiary/80 border border-border-secondary rounded-xl rounded-tl-sm">
                          <p className="text-xs font-medium text-emerald-400 mb-0.5">
                            Admin
                          </p>
                          <p className="text-sm text-text-secondary whitespace-pre-wrap">
                            {selectedTicket.adminResponse}
                          </p>
                          {selectedTicket.respondedAt && (
                            <p className="text-[11px] text-text-muted mt-1">
                              {formatTime(selectedTicket.respondedAt, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  selectedTicket.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-xl ${
                          msg.sender === "user"
                            ? "bg-blue-600/20 border border-blue-500/20 rounded-tr-sm"
                            : "bg-bg-tertiary/80 border border-border-secondary rounded-tl-sm"
                        }`}
                      >
                        {msg.sender === "admin" && (
                          <p className="text-xs font-medium text-emerald-400 mb-0.5">
                            Admin
                          </p>
                        )}
                        <p className="text-sm text-text-secondary whitespace-pre-wrap">
                          {msg.text}
                        </p>
                        <p className="text-[11px] text-text-muted mt-1 text-right">
                          {new Date(msg.timestamp).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply input (if not resolved) */}
              {selectedTicket.status !== "resolved" ? (
                <div className="flex-shrink-0 px-4 py-3 border-t border-border-primary">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={
                        replyingToTicketId === selectedTicket.id
                          ? userReplyText
                          : ""
                      }
                      onChange={(e) => {
                        setReplyingToTicketId(selectedTicket.id);
                        setUserReplyText(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          userReplyText.trim() &&
                          replyingToTicketId === selectedTicket.id
                        )
                          userReplyToTicket(selectedTicket.id);
                      }}
                      placeholder="Type a reply..."
                      className="flex-1 px-3 py-2 bg-bg-tertiary/50 border border-border-secondary rounded-lg text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-blue-500/50"
                    />
                    <button
                      onClick={() => {
                        if (replyingToTicketId === selectedTicket.id)
                          userReplyToTicket(selectedTicket.id);
                      }}
                      disabled={
                        !userReplyText.trim() ||
                        replyingToTicketId !== selectedTicket.id
                      }
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-40"
                    >
                      Send
                    </button>
                  </div>
                  <p className="text-xs text-text-muted mt-1.5">
                    Expect a reply within 12 hours
                  </p>
                </div>
              ) : (
                <div className="flex-shrink-0 px-4 py-2.5 border-t border-border-primary bg-emerald-500/5">
                  <p className="text-sm text-emerald-400 text-center">
                    This ticket has been resolved
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg
                  className="w-10 h-10 text-border-secondary mx-auto mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
                <p className="text-sm text-text-muted">
                  Select a ticket to view conversation
                </p>
                <p className="text-xs text-text-faint mt-1">
                  or create a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
