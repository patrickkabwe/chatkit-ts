import { useState, useEffect } from "react";
import "./index.css";
import { ChatKitPanel } from "./components/ChatKitPanel";
import { AuthPage } from "./components/AuthPage";
import { ProfileSetup } from "./components/ProfileSetup";

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      checkProfileComplete();
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      setIsAuthenticated(response.ok);
    } catch {
      setIsAuthenticated(false);
    }
  };

  const checkProfileComplete = async () => {
    try {
      const response = await fetch("/api/profile/complete", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setIsProfileComplete(data.complete);
      } else {
        setIsProfileComplete(false);
      }
    } catch {
      setIsProfileComplete(false);
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleProfileComplete = () => {
    setIsProfileComplete(true);
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  if (isProfileComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!isProfileComplete) {
    return <ProfileSetup onComplete={handleProfileComplete} />;
  }

  return (
    <div className="">
      <ChatKitPanel
        onChatKitReady={(chatkit) => {
          console.log("ChatKit is ready", chatkit);
        }}
      />
    </div>
  );
}

export default App;
