"use client";

import { Code, History, Cpu, Terminal, Sparkles, Upload } from "lucide-react";

interface SideNavBarProps {
  onOpenExamples?: () => void;
}

export function SideNavBar({ onOpenExamples }: SideNavBarProps) {
  return (
    <nav className="fixed left-0 top-[65px] h-[calc(100vh-65px)] w-16 bg-[#181a20]/90 backdrop-blur-lg border-r border-white/5 flex flex-col items-center py-6 gap-6 z-40 hidden md:flex">
      <div
        title="Editor"
        className="flex flex-col items-center justify-center text-[#47d6ff] bg-[#47d6ff]/10 rounded-xl p-2.5 shadow-[0_0_15px_rgba(71,214,255,0.2)] cursor-pointer"
      >
        <Code className="w-5 h-5" />
      </div>
      <div
        title="Timeline"
        className="flex flex-col items-center justify-center text-zinc-400 hover:text-[#47d6ff] hover:bg-white/5 transition-colors p-2.5 rounded-xl cursor-pointer"
      >
        <History className="w-5 h-5" />
      </div>
      <div
        title="Graph View"
        className="flex flex-col items-center justify-center text-zinc-400 hover:text-[#47d6ff] hover:bg-white/5 transition-colors p-2.5 rounded-xl cursor-pointer"
      >
        <Cpu className="w-5 h-5" />
      </div>
      <div
        title="Console"
        className="flex flex-col items-center justify-center text-zinc-400 hover:text-[#47d6ff] hover:bg-white/5 transition-colors p-2.5 rounded-xl cursor-pointer"
      >
        <Terminal className="w-5 h-5" />
      </div>
      <div
        title="AI Intelligence"
        className="flex flex-col items-center justify-center text-zinc-400 hover:text-[#47d6ff] hover:bg-white/5 transition-colors p-2.5 rounded-xl cursor-pointer"
      >
        <Sparkles className="w-5 h-5" />
      </div>
      <div className="mt-auto mb-2">
        <button
          type="button"
          onClick={onOpenExamples}
          title="Browse Examples"
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#47d6ff] to-[#17e0b1] text-black flex items-center justify-center shadow-lg magnetic-btn"
        >
          <Upload className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
