/** Derives the forwarding inbox address for a brand. */
export function forwardingAddressFor(inboxAlias: string | null): string | null {
  if (!inboxAlias) return null
  const domain = process.env.NEXT_PUBLIC_INBOUND_DOMAIN || "kb.punch.studio"
  return `${inboxAlias}@${domain}`
}
