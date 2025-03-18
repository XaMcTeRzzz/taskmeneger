import { Calendar, ListTodo, Settings as SettingsIcon, Mic } from "lucide-react";
import { cn } from "../lib/utils";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onMicClick?: () => void;
  isListening?: boolean;
}

export function BottomNavigation({ activeTab, onTabChange, onMicClick, isListening = false }: BottomNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-sm border-t flex items-center justify-around z-10 md:hidden">
      <button
        onClick={() => onTabChange("calendar")}
        className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
          activeTab === "calendar" ? "text-neon-green animate-neon-glow" : "text-muted-foreground"
        }`}
      >
        <Calendar className="h-5 w-5" />
        <span className="text-xs mt-1">Календар задач</span>
      </button>
      
      <button
        onClick={() => onTabChange("tasks")}
        className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
          activeTab === "tasks" ? "text-neon-green animate-neon-glow" : "text-muted-foreground"
        }`}
      >
        <ListTodo className="h-5 w-5" />
        <span className="text-xs mt-1">Мої задачі</span>
      </button>
      
      {/* Оновлена кнопка Siri AI з покращеними ефектами */}
      <div className="relative">
        {/* Фонова підсвітка */}
        <div className={cn(
          "absolute -inset-1 bg-gradient-to-r from-primary/30 via-primary/10 to-primary/30",
          "rounded-full blur-xl group-hover:blur-2xl transition-all duration-500",
          isListening && "animate-pulse-slow"
        )} />
        
        <button
          onClick={onMicClick}
          className={cn(
            "relative flex flex-col items-center justify-center -translate-y-6 group",
            "w-20 h-20 rounded-full",
            "bg-gradient-to-br from-primary via-primary/90 to-primary/80",
            "shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30",
            "transition-all duration-300 ease-out transform hover:scale-105",
            "hover:from-primary/90 hover:via-primary hover:to-primary/90",
            isListening && [
              "animate-pulse",
              "ring-4 ring-primary/50",
              "from-primary/80 via-primary to-primary/90"
            ]
          )}
        >
          {/* Внутрішнє кільце */}
          <div className={cn(
            "absolute inset-1 rounded-full",
            "bg-gradient-to-br from-background/20 via-background/10 to-transparent",
            "backdrop-blur-sm group-hover:bg-background/20",
            "transition-all duration-300"
          )} />
          
          {/* Іконка та текст */}
          <div className="relative flex flex-col items-center">
            <Mic className={cn(
              "w-8 h-8 text-background drop-shadow-lg",
              "transition-all duration-300",
              "group-hover:scale-110 group-hover:drop-shadow-xl",
              isListening && "animate-bounce-gentle"
            )} />
            <span className={cn(
              "text-xs font-medium text-background/90 mt-1",
              "transition-all duration-300",
              "group-hover:text-background group-hover:font-semibold",
              "drop-shadow-md"
            )}>
              Siri AI
            </span>
          </div>
          
          {/* Анімовані кільця при активації */}
          {isListening && (
            <>
              <div className="absolute -inset-2 rounded-full border-2 border-background/30 animate-ping" />
              <div className="absolute -inset-3 rounded-full border border-background/20 animate-ping animation-delay-200" />
            </>
          )}
        </button>
      </div>
      
      <button
        onClick={() => onTabChange("settings")}
        className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
          activeTab === "settings" ? "text-neon-green animate-neon-glow" : "text-muted-foreground"
        }`}
      >
        <SettingsIcon className="h-5 w-5" />
        <span className="text-xs mt-1">Налаштування</span>
      </button>
    </div>
  );
}
