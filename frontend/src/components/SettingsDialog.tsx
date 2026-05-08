import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/lib/settings";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export function SettingsDialog({ open, onOpenChange }: Props) {
  const { agentUrl, useMock, set } = useSettings();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Connect this UI to any AG-UI compatible agent backend.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="url">Agent URL</Label>
            <Input id="url" value={agentUrl} onChange={(e) => set({ agentUrl: e.target.value })} placeholder="http://localhost:8000/agent" />
            <p className="text-xs text-muted-foreground">SSE-over-POST endpoint. Override with <span className="mono">VITE_AGENT_URL</span>.</p>
          </div>
          <div className="flex items-center justify-between gap-4 panel p-3">
            <div>
              <Label className="text-sm">Use mock transcript</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Replays a pre-recorded AG-UI run in-browser. Disable to hit the real backend.</p>
            </div>
            <Switch checked={useMock} onCheckedChange={(v) => set({ useMock: v })} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
