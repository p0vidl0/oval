export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduledPublisher } = await import(
    "@/lib/feed/scheduled-publisher"
  );
  startScheduledPublisher();
}
