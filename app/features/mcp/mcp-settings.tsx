import * as React from "react";
import type { CurrentUser } from "@/features/auth/types";
import { SettingsSection } from "@/features/settings/settings-section";
import { McpConnectionDetails } from "./connection-dialog";

type McpSettingsProps = {
  user: CurrentUser;
};

export function McpSettings({ user }: McpSettingsProps): React.ReactElement {
  const [readOnlyEndpoint, setReadOnlyEndpoint] = React.useState("/mcp");
  const [fullEndpoint, setFullEndpoint] = React.useState("/mcp/full");
  const readOnlyEndpointId = React.useId();
  const fullEndpointId = React.useId();

  React.useEffect(() => {
    setReadOnlyEndpoint(new URL("/mcp", window.location.origin).toString());
    setFullEndpoint(new URL("/mcp/full", window.location.origin).toString());
  }, []);

  return (
    <SettingsSection
      description="Choose a permission profile, then copy its Streamable HTTP endpoint."
      title="MCP"
    >
      <McpConnectionDetails
        fullEndpoint={fullEndpoint}
        fullEndpointId={fullEndpointId}
        readOnlyEndpoint={readOnlyEndpoint}
        readOnlyEndpointId={readOnlyEndpointId}
        user={user}
      />
    </SettingsSection>
  );
}
