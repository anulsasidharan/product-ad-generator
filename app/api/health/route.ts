export async function GET(): Promise<Response> {
  const ideogramEnabledRaw = (process.env.IDEOGRAM_ENABLED ?? "").toLowerCase();
  const ideogramEnabled =
    ideogramEnabledRaw === "1" || ideogramEnabledRaw === "true" || ideogramEnabledRaw === "yes";
  const replicateConfigured = Boolean(process.env.REPLICATE_API_TOKEN);
  const ideogramModel = process.env.IDEOGRAM_REPLICATE_MODEL ?? "ideogram-ai/ideogram-v2";
  const warnings: string[] = [];
  if (ideogramEnabled && !replicateConfigured) {
    warnings.push("ideogram_enabled_but_replicate_token_missing");
  }

  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    capabilities: {
      ideogramEnabled,
      replicateConfigured,
      ideogramModel,
      warnings,
    },
  });
}
