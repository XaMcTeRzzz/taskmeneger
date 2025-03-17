import { Calendar, ListTodo, Settings as SettingsIcon, Mic } from "lucide-react";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onMicClick?: () => void;
  isListening?: boolean;
}

export function BottomNavigation({ activeTab, onTabChange, onMicClick, isListening = false }: BottomNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around z-10 md:hidden">
      <button
        onClick={() => onTabChange("calendar")}
        className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
          activeTab === "calendar" ? "text-neon-green animate-neon-glow" : "text-muted-foreground"
        }`}
      >
        <Calendar className="h-5 w-5" />
        <span className="text-xs mt-1">Календар моїх задач</span>
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
      
      {/* Кнопка мікрофона Джарвіса */}
      {onMicClick && (
        <button
          onClick={onMicClick}
          className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${
            isListening ? "text-yellow-400" : "text-neon-green"
          }`}
        >
          <Mic className="h-5 w-5" />
          <span className="text-xs mt-1">Джарвіс</span>
        </button>
      )}
      
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
