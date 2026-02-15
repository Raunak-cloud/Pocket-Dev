import { useState, useMemo } from "react";
import type { SupportTicket, SavedProject } from "@/app/types";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

interface UseSupportTicketsProps {
  user: any; // auth user object
  savedProjects: SavedProject[];
}

export function useSupportTickets({ user, savedProjects }: UseSupportTicketsProps) {
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [adminTickets, setAdminTickets] = useState<SupportTicket[]>([]);
  const [ticketCategory, setTicketCategory] = useState<SupportTicket["category"]>("general");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketProjectId, setTicketProjectId] = useState("");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [adminResponse, setAdminResponse] = useState("");
  const [respondingToTicketId, setRespondingToTicketId] = useState<string | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [userReplyText, setUserReplyText] = useState("");
  const [replyingToTicketId, setReplyingToTicketId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketSubmittedNotice, setTicketSubmittedNotice] = useState(false);

  const unreadTicketCount = useMemo(
    () =>
      supportTickets.reduce(
        (sum, t) => sum + ((t as any).unreadAdminMessageCount || 0),
        0
      ),
    [supportTickets]
  );

  const loadSupportTickets = async () => {
    if (!user) return;
    setLoadingTickets(true);
    try {
      const response = await fetch("/api/support-tickets/list");
      if (response.ok) {
        const tickets: SupportTicket[] = await response.json();
        setSupportTickets(tickets);
      }
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const loadAdminTickets = async () => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    setLoadingTickets(true);
    try {
      const response = await fetch("/api/support-tickets/admin-list");
      if (response.ok) {
        const tickets: SupportTicket[] = await response.json();
        setAdminTickets(tickets);
      }
    } catch (error) {
      console.error("Error loading admin tickets:", error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const submitSupportTicket = async () => {
    if (!user || !ticketSubject.trim() || !ticketDescription.trim()) return;
    setIsSubmittingTicket(true);
    try {
      const proj = ticketProjectId ? savedProjects.find((p) => p.id === ticketProjectId) : null;

      const response = await fetch("/api/support-tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: ticketCategory,
          subject: ticketSubject.trim(),
          description: ticketDescription.trim(),
          projectId: ticketProjectId || null,
          projectName: proj ? proj.prompt.substring(0, 60) : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit ticket");
      }

      setTicketSubject("");
      setTicketDescription("");
      setTicketCategory("general");
      setTicketProjectId("");
      setTicketSubmittedNotice(true);
      setTimeout(() => setTicketSubmittedNotice(false), 6000);

      await loadSupportTickets();
    } catch (error) {
      console.error("Error submitting ticket:", error);
      alert("Failed to submit ticket. Please try again.");
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const respondToTicket = async (
    ticketId: string,
    response: string,
    newStatus: SupportTicket["status"],
  ) => {
    if (!user || user.email !== ADMIN_EMAIL || !response.trim()) return;
    try {
      const apiResponse = await fetch("/api/support-tickets/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          response: response.trim(),
          status: newStatus,
        }),
      });

      if (!apiResponse.ok) {
        throw new Error("Failed to respond to ticket");
      }

      setAdminResponse("");
      setRespondingToTicketId(null);
      await loadAdminTickets();
    } catch (error) {
      console.error("Error responding to ticket:", error);
      alert("Failed to send response. Please try again.");
    }
  };

  const handleTicketClick = async (ticketId: string) => {
    const newSelectedId = ticketId === selectedTicketId ? null : ticketId;
    setSelectedTicketId(newSelectedId);

    if (newSelectedId && user) {
      try {
        await fetch("/api/support-tickets/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId }),
        });
        await loadSupportTickets();
      } catch (error) {
        console.error("Error marking ticket as read:", error);
      }
    }
  };

  const userReplyToTicket = async (ticketId: string) => {
    if (!user || !userReplyText.trim()) return;
    try {
      const response = await fetch("/api/support-tickets/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          text: userReplyText.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send reply");
      }

      setUserReplyText("");
      setReplyingToTicketId(null);
      setTicketSubmittedNotice(true);
      setTimeout(() => setTicketSubmittedNotice(false), 6000);
      await loadSupportTickets();
    } catch (error) {
      console.error("Error replying to ticket:", error);
      alert("Failed to send reply. Please try again.");
    }
  };

  return {
    supportTickets,
    adminTickets,
    ticketCategory,
    ticketSubject,
    ticketDescription,
    ticketProjectId,
    isSubmittingTicket,
    adminResponse,
    respondingToTicketId,
    loadingTickets,
    userReplyText,
    replyingToTicketId,
    selectedTicketId,
    ticketSubmittedNotice,
    unreadTicketCount,
    setTicketCategory,
    setTicketSubject,
    setTicketDescription,
    setTicketProjectId,
    setAdminResponse,
    setRespondingToTicketId,
    setUserReplyText,
    setReplyingToTicketId,
    setSelectedTicketId,
    loadSupportTickets,
    loadAdminTickets,
    submitSupportTicket,
    respondToTicket,
    handleTicketClick,
    userReplyToTicket,
  };
}

