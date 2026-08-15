import { Check, Copy, FileText, Sparkles } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CurrentUser } from "@/features/auth/types";
import { McpConnectionDetails } from "@/features/mcp/connection-dialog";

type AgentConnectionDialogProps = {
  open: boolean;
  restoreFocusRef: React.RefObject<HTMLButtonElement | null>;
  user: CurrentUser;
  onOpenChange: (open: boolean) => void;
};

export function AgentConnectionDialog({
  open,
  restoreFocusRef,
  user,
  onOpenChange
}: AgentConnectionDialogProps): React.ReactElement {
  const [readOnlyEndpoint, setReadOnlyEndpoint] = React.useState("/mcp");
  const [fullEndpoint, setFullEndpoint] = React.useState("/mcp/full");
  const [instructionsUrl, setInstructionsUrl] = React.useState("/AGENTS.md");
  const readOnlyEndpointId = React.useId();
  const fullEndpointId = React.useId();
  const instructionsUrlId = React.useId();

  React.useEffect(() => {
    setReadOnlyEndpoint(new URL("/mcp", window.location.origin).toString());
    setFullEndpoint(new URL("/mcp/full", window.location.origin).toString());
    setInstructionsUrl(new URL("/AGENTS.md", window.location.origin).toString());
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[calc(env(safe-area-inset-top)+(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))/2)] max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] w-[min(92vw,560px)] gap-3 overflow-y-auto overscroll-contain p-4 sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:gap-4 sm:p-5"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocusRef.current?.focus();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
              <Sparkles aria-hidden="true" className="size-4" />
            </span>
            <DialogTitle>Connect AI agent</DialogTitle>
          </div>
          <DialogDescription>
            Connect through MCP or give an agent this installation&apos;s API instructions.
          </DialogDescription>
        </DialogHeader>

        <AgentConnectionDetails
          fullEndpoint={fullEndpoint}
          fullEndpointId={fullEndpointId}
          instructionsUrl={instructionsUrl}
          instructionsUrlId={instructionsUrlId}
          readOnlyEndpoint={readOnlyEndpoint}
          readOnlyEndpointId={readOnlyEndpointId}
          user={user}
        />
      </DialogContent>
    </Dialog>
  );
}

export function AgentConnectionDetails({
  fullEndpoint,
  fullEndpointId,
  instructionsUrl,
  instructionsUrlId,
  readOnlyEndpoint,
  readOnlyEndpointId,
  user
}: {
  fullEndpoint: string;
  fullEndpointId: string;
  instructionsUrl: string;
  instructionsUrlId: string;
  readOnlyEndpoint: string;
  readOnlyEndpointId: string;
  user: CurrentUser;
}): React.ReactElement {
  return (
    <>
      <ConnectionIdentity user={user} />

      <Tabs defaultValue="mcp">
        <TabsList
          aria-label="Connection method"
          className="grid h-9 w-full grid-cols-2 rounded-full"
        >
          <TabsTrigger className="rounded-full px-2 text-xs" value="mcp">
            MCP
          </TabsTrigger>
          <TabsTrigger className="rounded-full px-2 text-xs" value="agents-md">
            AGENTS.md
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-3" value="mcp">
          <McpConnectionDetails
            fullEndpoint={fullEndpoint}
            fullEndpointId={fullEndpointId}
            readOnlyEndpoint={readOnlyEndpoint}
            readOnlyEndpointId={readOnlyEndpointId}
          />
        </TabsContent>
        <TabsContent className="mt-3" value="agents-md">
          <AgentInstructionsDetails
            instructionsUrl={instructionsUrl}
            instructionsUrlId={instructionsUrlId}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

export function AgentInstructionsDetails({
  instructionsUrl,
  instructionsUrlId
}: {
  instructionsUrl: string;
  instructionsUrlId: string;
}): React.ReactElement {
  const [copied, setCopied] = React.useState(false);

  async function copyUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(instructionsUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <section className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
            <FileText aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-foreground">Deployment-local instructions</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Give this URL to an agent that can fetch documentation and make HTTP requests.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={instructionsUrlId}>
            AGENTS.md URL
          </label>
          <Input
            className="min-w-0 font-mono text-base sm:text-xs"
            id={instructionsUrlId}
            readOnly
            value={instructionsUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button
            aria-label="Copy AGENTS.md URL"
            onClick={() => void copyUrl()}
            size="sm"
            type="button"
            variant="outline"
          >
            {copied ? (
              <Check aria-hidden="true" data-icon="inline-start" />
            ) : (
              <Copy aria-hidden="true" data-icon="inline-start" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-xs leading-4 text-muted-foreground">
        <p className="font-medium text-foreground">What happens next</p>
        <p>
          The agent reads the API and safety instructions, then gives you a short code and a link to
          approve in your normal browser. This URL grants no access and contains no account or mail
          data.
        </p>
      </section>
    </div>
  );
}

function ConnectionIdentity({ user }: { user: CurrentUser }): React.ReactElement {
  return (
    <section className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
      <p className="text-xs font-medium text-muted-foreground">Connecting as</p>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="font-medium">{user.name}</p>
        <p className="text-xs text-muted-foreground">
          {user.email} · {user.role}
        </p>
      </div>
      <p className="mt-1 text-xs leading-4 text-muted-foreground">
        After consent, HQBase rechecks this user&apos;s current workspace role and live mailbox
        grants.
      </p>
    </section>
  );
}
