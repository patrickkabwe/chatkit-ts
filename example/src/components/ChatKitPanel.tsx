import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";

import {
  ChatKit,
  useChatKit,
  type HeaderOption,
  type StartScreenPrompt,
} from "@openai/chatkit-react";

export type ChatKitInstance = ReturnType<typeof useChatKit>;

type ChatKitPanelProps = {
  onChatKitReady?: (chatkit: ChatKitInstance) => void;
  className?: string;
};

const useStartScreenOption = (): {
  prompts: StartScreenPrompt[];
  greeting: string;
} => {
  const prompts = useMemo<StartScreenPrompt[]>(() => {
    return [
      {
        label: "12-week plan",
        prompt: "Create a 12-week workout plan for half marathon training.",
      },
      {
        label: "Nutrition plan",
        prompt: "Build a nutrition plan for muscle gain with 21 meals per week.",
      },
      {
        label: "Workout ideas",
        prompt: "Recommend some cardio workouts that fit my schedule.",
      },
    ];
  }, []);

  const greeting = useMemo(() => {
    return "Fitness & Wellness Assistant: ask for a workout plan, nutrition guide, or activity recommendations. Widgets will appear as we go.";
  }, []);

  return { prompts, greeting };
};

export function ChatKitPanel({ onChatKitReady, className }: ChatKitPanelProps) {
  const [scheme, setScheme] = useState<"light" | "dark">("dark");

  const headerRightAction = useMemo<HeaderOption["rightAction"]>(() => {
    if (scheme === "dark") {
      return {
        icon: "dark-mode",
        onClick: () => setScheme("light"),
      };
    }
    return {
      icon: "light-mode",
      onClick: () => setScheme("dark"),
    };
  }, [scheme]);

  const handleClientEffect = useCallback(
    ({ name, data }: { name: string; data?: Record<string, unknown> }) => {
      console.log("Client effect:", name, data);
      
      // Handle navigation via client effect
      if (name === "navigate") {
        const url = data?.url as string | undefined;
        if (url) {
          // Use window.location for full page navigation
          window.location.href = url;
        } else {
          console.warn("Navigation effect missing 'url' in data:", data);
        }
      }
    },
    [],
  );

  // Handle widget actions on the client (for actions with handler: "client")
  const handleWidgetAction = useCallback(
    async (action: { type: string; payload?: Record<string, unknown> }) => {
      console.log("Widget action received:", action);
      
      // Handle sample_action
      if (action.type === "sample_action") {
        console.log("Sample action triggered on client");
        // Add your client-side logic here
        // For example, show a notification, update UI, etc.
        alert("Button clicked! This is handled on the client side.");
        return;
      }
      
      // Handle navigation action
      if (action.type === "navigate") {
        const url = action.payload?.url as string | undefined;
        if (url) {
          // Use window.location for full page navigation
          window.location.href = url;
        } else {
          console.warn("Navigation action missing 'url' in payload:", action.payload);
        }
        return;
      }
      
      // Handle other action types as needed
      console.log("Unhandled widget action:", action);
    },
    [],
  );

  const startScreenOption = useStartScreenOption();

  if (!process.env.PUBLIC_DOMAIN_KEY || !process.env.PUBLIC_BASE_URL) {
    throw new Error("PUBLIC_DOMAIN_KEY and PUBLIC_BASE_URL are not set");
  }

  const chatkit = useChatKit({
    api: {
      url: `${process.env.PUBLIC_BASE_URL}/api/chatkit`,
      domainKey: process.env.PUBLIC_DOMAIN_KEY,
      uploadStrategy: {
        type: "two_phase",
      },
    },
    history: {
      enabled: true,
      showDelete: true,
    },
    header: {
      title: { enabled: false },
      rightAction: headerRightAction,
    },
    theme: {
      density: "spacious",
      colorScheme: scheme,
      color: {
        accent: {
          primary: "#0ea5e9",
          level: 1,
        },
      },
      radius: "pill",
    },
    startScreen: startScreenOption,
    composer: {
      placeholder: "Ask for a workout plan, nutrition guide, or activity recommendations…",
      attachments: {
        enabled: true,
        maxCount: 1,
      },
      tools: [{
        id: "file_upload",
        label: "Upload a file",
        icon: "document",
      }]
    },
    threadItemActions: {
      feedback: false,
    },
    onClientTool: ({ name, params }) => {
      console.log("Client tool:", name, params);
      // Default response for unknown tools
      return {
        success: false,
        error: `Unknown tool: ${name}`,
      };
    },
    onError: ({ error }) => {
      console.error("ChatKit error", error);
    },
    onReady: () => {
      console.log("ChatKit is ready");
      onChatKitReady?.(chatkit);
    },
    onEffect: handleClientEffect,
    widgets: {
      onAction: handleWidgetAction,
    },
    onResponseStart: (event) => {
      console.log("Response started", event);
    },
    onResponseEnd: () => {
      console.log("Response ended");
    },
  });

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.reload();
  };

  return (
    <div className={clsx("h-screen w-screen overflow-hidden flex flex-col", className)}>
      <div className="flex justify-end p-2 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="mr-2"
        >
          Logout
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatKit control={chatkit?.control} className="block h-full w-full" />
      </div>
    </div>
  );
}

export default ChatKitPanel;
