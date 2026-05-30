"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

export default function AgendaPage() {
  const now = new Date();
  const [current, setCurrent] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const daysInMonth = getDaysInMonth(current.year, current.month);
  const firstDay = getFirstDayOfMonth(current.year, current.month);
  const today = now.getDate();
  const isCurrentMonth = current.year === now.getFullYear() && current.month === now.getMonth();

  const prev = () => setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
  const next = () => setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EADD]">Agenda</h1>
          <p className="text-sm text-[#87938F] mt-1">Gerencie seus horários e sessões</p>
        </div>
        <button className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-all">
          <Plus size={16} />
          Bloquear Horário
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6">
        {/* Nav */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prev} className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-[#243337] text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] transition-all">
            <ChevronLeft size={16} />
          </button>
          <h2 className="font-semibold text-[#F0EADD]">
            {MONTHS[current.month]} {current.year}
          </h2>
          <button onClick={next} className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-[#243337] text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] transition-all">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Days header */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-medium text-[#87938F] pb-2">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = isCurrentMonth && day === today;
            return (
              <button
                key={day}
                className={`aspect-square flex items-center justify-center text-sm rounded-[10px] transition-all
                  ${isToday
                    ? "bg-[#2F9285] text-[#050B12] font-bold"
                    : "text-[#87938F] hover:bg-[#102128] hover:text-[#F0EADD]"
                  }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sessões do dia */}
      <div className="mt-6 bg-[#0B171C] border border-[#243337] rounded-[18px] p-6">
        <h3 className="font-semibold text-[#F0EADD] text-sm mb-4">
          {isCurrentMonth ? `Hoje, ${today} de ${MONTHS[current.month]}` : `${MONTHS[current.month]} ${current.year}`}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar size={36} className="text-[#243337] mb-3" />
          <p className="text-sm text-[#87938F]">Nenhuma sessão neste dia</p>
        </div>
      </div>
    </div>
  );
}
