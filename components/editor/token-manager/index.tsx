"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Key, Eye, EyeOff, ExternalLink, HelpCircle } from "lucide-react";
import { useLocalStorage } from "react-use";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function TokenManager() {
  const [token, setToken] = useLocalStorage("hf_token", "");
  const [showToken, setShowToken] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [open, setOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Prevent hydration mismatch by only showing token status after client-side render
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setTempToken(token || "");
  }, [token, open]);

  const handleSaveToken = () => {
    if (!tempToken.trim()) {
      toast.error("Please enter a valid Hugging Face token");
      return;
    }
    
    setToken(tempToken.trim());
    setOpen(false);
    toast.success("Hugging Face token saved successfully!");
  };

  const handleClearToken = () => {
    setToken("");
    setTempToken("");
    toast.success("Token cleared successfully!");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Key className="size-4" />
          <span className="max-lg:hidden">
            {isClient && token ? "HF Token ✓" : "HF Token"}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hugging Face Token</DialogTitle>
          <DialogDescription>
            Enter your Hugging Face token to use your own API quota. 
            This token is stored locally in your browser and never sent to our servers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Token</label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                placeholder="hf_..."
                value={tempToken}
                onChange={(e) => setTempToken(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </div>
          </div>
          
          <Collapsible open={showTutorial} onOpenChange={setShowTutorial}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-blue-600 hover:text-blue-700">
                <HelpCircle className="size-4" />
                How to get a Hugging Face token?
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="text-sm space-y-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                <p className="font-medium">Step-by-step guide:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Go to <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Hugging Face Tokens <ExternalLink className="size-3" /></a></li>
                  <li>Sign in or create a free account</li>
                  <li>Click &quot;New token&quot;</li>
                  <li>Give it a name (e.g., &quot;Hypersites AI&quot;)</li>
                  <li>Select &quot;Read&quot; role (minimum required)</li>
                  <li>Click &quot;Generate token&quot;</li>
                  <li>Copy the token (starts with &quot;hf_&quot;)</li>
                  <li>Paste it in the field above</li>
                </ol>
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded mt-2">
                  ⚠️ Keep your token secure! Never share it publicly.
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex gap-2">
            <Button onClick={handleSaveToken} className="flex-1">
              Save Token
            </Button>
            {token && (
              <Button 
                variant="outline" 
                onClick={handleClearToken}
                className="flex-1"
              >
                Clear Token
              </Button>
            )}
          </div>
          {token && (
            <div className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 p-2 rounded">
              ✓ Token is saved and will be used for API calls.
            </div>
          )}
          <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 p-2 rounded">
            💡 Your token stays in your browser - we never see it!
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 