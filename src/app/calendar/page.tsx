"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2, Loader2,
  Calendar, Clock, Users, AlignLeft, Zap, ArrowLeft, Info
} from "lucide-react";

const EVENT_TYPES: Record<string, { label: string; color: string; bg: string; dot: string; border: string }> = {
  meeting:  { label: "Meeting",  color: "text-blue-700",    bg: "bg-blue-100",    dot: "bg-blue-500",    border: "border-blue-200" },
  review:   { label: "Review",   color: "text-amber-700",   bg: "bg-amber-100",   dot: "bg-amber-500",   border: "border-amber-200" },
  deadline: { label: "Deadline", color: "text-red-700",     bg: "bg-red-100",     dot: "bg-red-500",     border: "border-red-200" },
  training: { label: "Training", color: "text-emerald-700", bg: "bg-emerald-100", dot: "bg-emerald-500", border: "border-emerald-200" },
  other:    { label: "Other",    color: "text-slate-700",   bg: "bg-slate-100",   dot: "bg-slate-400",   border: "border-slate-200" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const EMPTY_FORM = { title: "", description: "", event_date: "", start_time: "", end_time: "", type: "meeting", attendees: "" };

type CalEvent = {
  id: number;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  type: string;
  attendees?: string;
  created_by_name?: string;
};

export default function CalendarPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "manager";

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?month=${monthKey}`);
      const data = await res.json();
      if (res.ok) setEvents(Array.isArray(data) ? data : []);
      else toast.error(data.error || "Failed to load events");
    } catch {
      toast.error("Network error loading calendar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [monthKey]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    const cells: { date: string | null; day: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const pm = viewMonth === 0 ? 12 : viewMonth;
      const py = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({ date: `${py}-${String(pm).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, isCurrentMonth: false, isToday: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const isToday = dateStr === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
      cells.push({ date: dateStr, day: d, isCurrentMonth: true, isToday });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nm = viewMonth === 11 ? 1 : viewMonth + 2;
      const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({ date: `${ny}-${String(nm).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, isCurrentMonth: false, isToday: false });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    events.forEach(e => {
      if (!map[e.event_date]) map[e.event_date] = [];
      map[e.event_date].push(e);
    });
    return map;
  }, [events]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const todayEvents = eventsByDate[todayStr] || [];

  const upcomingEvents = useMemo(() => {
    return events
      .filter(e => e.event_date >= todayStr)
      .sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.start_time || "").localeCompare(b.start_time || ""))
      .slice(0, 8);
  }, [events, todayStr]);

  const monthStats = useMemo(() => {
    const counts: Record<string, number> = { meeting: 0, review: 0, deadline: 0, training: 0, other: 0 };
    events.forEach(e => { if (counts[e.type] !== undefined) counts[e.type]++; });
    return counts;
  }, [events]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }
  function goToToday() { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }

  function openCreate(date?: string) {
    setForm({ ...EMPTY_FORM, event_date: date || todayStr });
    setEditMode(false);
    setShowCreate(true);
  }
  function openEdit(ev: CalEvent) {
    setForm({ title: ev.title, description: ev.description || "", event_date: ev.event_date, start_time: ev.start_time || "", end_time: ev.end_time || "", type: ev.type, attendees: ev.attendees || "" });
    setEditMode(true);
    setDetailEvent(ev);
    setShowDetail(false);
    setShowCreate(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.event_date) { toast.error("Title and date are required"); return; }
    setSaving(true);
    try {
      const url = editMode && detailEvent ? `/api/calendar/${detailEvent.id}` : "/api/calendar";
      const method = editMode ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { toast.success(editMode ? "Event updated" : "Event created"); setShowCreate(false); fetchEvents(); }
      else toast.error(data.error || "Failed to save event");
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) { toast.success("Event deleted"); setShowDetail(false); fetchEvents(); }
      else toast.error(data.error || "Failed to delete");
    } catch { toast.error("Network error"); }
    finally { setDeleting(false); }
  }

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-");
    return `${MONTHS[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
  }
  function formatDay(dateStr: string) {
    const dt = new Date(dateStr + "T00:00:00");
    return DAYS[dt.getDay()];
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Dashboard
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight">Team Calendar</span>
              <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] leading-none">Schedule &amp; Events</span>
            </div>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => openCreate()} className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-sm">
            <Plus className="h-3.5 w-3.5" /> New Event
          </Button>
        )}
      </div>

      <div className="flex" style={{ height: "calc(100vh - 65px)" }}>
        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
                <ChevronLeft className="h-4 w-4 text-slate-500" />
              </button>
              <h2 className="text-xl font-bold text-slate-900 min-w-[200px] text-center">{MONTHS[viewMonth]} {viewYear}</h2>
              <button onClick={nextMonth} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <button onClick={goToToday} className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">Today</button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest py-2">{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="grid grid-cols-7 border-l border-t border-slate-100">
              {calendarDays.map((cell, idx) => {
                const dayEvents = cell.date ? (eventsByDate[cell.date] || []) : [];
                const isSelected = cell.date === selectedDate;
                return (
                  <div
                    key={idx}
                    onClick={() => cell.isCurrentMonth && cell.date && setSelectedDate(cell.date === selectedDate ? null : cell.date)}
                    className={`border-r border-b border-slate-100 min-h-[100px] p-1.5 transition-colors cursor-pointer
                      ${!cell.isCurrentMonth ? "bg-slate-50/50" : "bg-white hover:bg-blue-50/30"}
                      ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
                        ${cell.isToday ? "bg-blue-600 text-white font-bold" : ""}
                        ${!cell.isCurrentMonth ? "text-slate-300" : cell.isToday ? "" : "text-slate-700"}`}>
                        {cell.day}
                      </span>
                      {canEdit && cell.isCurrentMonth && cell.date && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openCreate(cell.date!); }}
                          className="h-4 w-4 rounded flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-100 transition-all"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => {
                        const t = EVENT_TYPES[ev.type] || EVENT_TYPES.other;
                        return (
                          <button
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); setDetailEvent(ev); setShowDetail(true); }}
                            className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate flex items-center gap-1 ${t.bg} ${t.color} hover:opacity-80 transition-opacity`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${t.dot}`} />
                            {ev.title}
                          </button>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[9px] text-slate-400 font-bold px-1">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Event Types:</span>
            {Object.entries(EVENT_TYPES).map(([key, t]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                <span className="text-[10px] font-semibold text-slate-500">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 shrink-0 border-l border-slate-100 bg-white flex flex-col overflow-y-auto">
          {/* Today */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today</p>
                <p className="text-base font-bold text-slate-900">{formatDay(todayStr)}, {formatDate(todayStr)}</p>
              </div>
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{today.getDate()}</span>
              </div>
            </div>
            {todayEvents.length === 0 ? (
              <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-slate-50 border border-slate-100">
                <Info className="h-3.5 w-3.5 text-slate-300" />
                <span className="text-xs text-slate-400 font-medium">No events today</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {todayEvents.map(ev => {
                  const t = EVENT_TYPES[ev.type] || EVENT_TYPES.other;
                  return (
                    <button key={ev.id} onClick={() => { setDetailEvent(ev); setShowDetail(true); }}
                      className={`w-full text-left p-2.5 rounded-lg border ${t.bg} ${t.border} hover:opacity-80 transition-opacity`}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${t.dot}`} />
                        <span className={`text-xs font-bold ${t.color} truncate`}>{ev.title}</span>
                      </div>
                      {ev.start_time && (
                        <p className="text-[10px] text-slate-500 mt-0.5 ml-4">{ev.start_time}{ev.end_time ? ` \u2013 ${ev.end_time}` : ""}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Agenda */}
          <div className="p-5 border-b border-slate-100 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Upcoming Agenda</p>
            {upcomingEvents.length === 0 ? (
              <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-slate-50 border border-slate-100">
                <Info className="h-3.5 w-3.5 text-slate-300" />
                <span className="text-xs text-slate-400 font-medium">No upcoming events</span>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(ev => {
                  const t = EVENT_TYPES[ev.type] || EVENT_TYPES.other;
                  const isTdy = ev.event_date === todayStr;
                  return (
                    <button key={ev.id} onClick={() => { setDetailEvent(ev); setShowDetail(true); }}
                      className="w-full text-left p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-slate-200 transition-all group">
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 mt-0.5 h-8 w-8 rounded-lg ${t.bg} flex flex-col items-center justify-center border ${t.border}`}>
                          <span className={`text-[8px] font-bold uppercase ${t.color}`}>{formatDay(ev.event_date).slice(0,3)}</span>
                          <span className={`text-[11px] font-black ${t.color}`}>{parseInt(ev.event_date.split("-")[2])}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${t.dot}`} />
                            <p className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-700 transition-colors">{ev.title}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isTdy && <Badge className="text-[8px] bg-blue-100 text-blue-700 border-blue-200 px-1.5 py-0 font-bold">Today</Badge>}
                            {ev.start_time && <span className="text-[9px] text-slate-400 font-medium">{ev.start_time}{ev.end_time ? ` \u2013 ${ev.end_time}` : ""}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Monthly Stats */}
          <div className="p-5 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{MONTHS[viewMonth]} Stats</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(EVENT_TYPES).map(([key, t]) => (
                <div key={key} className={`p-2.5 rounded-lg ${t.bg} border ${t.border}`}>
                  <p className={`text-lg font-black ${t.color}`}>{monthStats[key] || 0}</p>
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${t.color} opacity-70`}>{t.label}s</p>
                </div>
              ))}
            </div>
            <div className="mt-2 p-2.5 rounded-lg bg-slate-100 border border-slate-200">
              <p className="text-lg font-black text-slate-700">{events.length}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Total Events</p>
            </div>
          </div>

          {canEdit && (
            <div className="p-5">
              <div className="p-4 rounded-xl bg-blue-600 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 fill-white" />
                  <p className="text-xs font-bold uppercase tracking-widest">Quick Actions</p>
                </div>
                <p className="text-[11px] opacity-75 mb-3">Schedule events visible to the entire team.</p>
                <Button onClick={() => openCreate()} className="w-full h-8 bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-lg">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Create New Event
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogTitle className="sr-only">Event Details</DialogTitle>
          {detailEvent && (() => {
            const t = EVENT_TYPES[detailEvent.type] || EVENT_TYPES.other;
            return (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl ${t.bg} border ${t.border} flex items-center justify-center shrink-0`}>
                      <span className={`h-3 w-3 rounded-full ${t.dot}`} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-tight">{detailEvent.title}</h3>
                      <Badge className={`mt-1 text-[9px] font-bold ${t.bg} ${t.color} border ${t.border}`}>{t.label}</Badge>
                    </div>
                  </div>
                  <button onClick={() => setShowDetail(false)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2.5 bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-700">{formatDay(detailEvent.event_date)}, {formatDate(detailEvent.event_date)}</span>
                  </div>
                  {(detailEvent.start_time || detailEvent.end_time) && (
                    <div className="flex items-center gap-2.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700">{detailEvent.start_time || "\u2013"}{detailEvent.end_time ? ` \u2013 ${detailEvent.end_time}` : ""}</span>
                    </div>
                  )}
                  {detailEvent.attendees && (
                    <div className="flex items-start gap-2.5">
                      <Users className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-xs font-semibold text-slate-700">{detailEvent.attendees}</span>
                    </div>
                  )}
                  {detailEvent.description && (
                    <div className="flex items-start gap-2.5">
                      <AlignLeft className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-600 leading-relaxed">{detailEvent.description}</span>
                    </div>
                  )}
                  {detailEvent.created_by_name && (
                    <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">Created by {detailEvent.created_by_name}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => openEdit(detailEvent)} variant="outline" className="flex-1 h-9 text-xs font-bold border-slate-200 rounded-lg flex items-center gap-1.5">
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button onClick={() => handleDelete(detailEvent.id)} disabled={deleting} variant="outline"
                      className="flex-1 h-9 text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1.5">
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Modal */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) setShowCreate(false); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogTitle className="text-base font-bold text-slate-900">
            {editMode ? "Edit Event" : "Create New Event"}
          </DialogTitle>
          <div className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Title *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" className="h-10 rounded-lg border-slate-200 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Date *</label>
                <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} className="h-10 rounded-lg border-slate-200 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="h-10 rounded-lg border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPES).map(([key, t]) => (
                      <SelectItem key={key} value={key}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Start Time</label>
                <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="h-10 rounded-lg border-slate-200 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">End Time</label>
                <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="h-10 rounded-lg border-slate-200 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Attendees</label>
              <Input value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} placeholder="e.g. Sales Team, John, Marketing" className="h-10 rounded-lg border-slate-200 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Description / Agenda</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Add agenda or notes..." rows={3}
                className="w-full rounded-lg border border-slate-200 text-sm px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => setShowCreate(false)} variant="outline" className="flex-1 h-10 text-sm font-semibold border-slate-200 rounded-lg">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editMode ? "Save Changes" : "Create Event")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
