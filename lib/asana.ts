type AsanaTaskInput = {
  name: string
  notes: string
  workspaceId: string
  projectIds?: string[]
}

export type AsanaTask = { gid: string; permalink_url: string }

export async function createAsanaTask(input: AsanaTaskInput): Promise<AsanaTask> {
  const token = process.env.ASANA_PERSONAL_ACCESS_TOKEN
  if (!token) throw new Error("ASANA_PERSONAL_ACCESS_TOKEN is not set")

  const body = {
    data: {
      name: input.name,
      notes: input.notes,
      workspace: input.workspaceId,
      ...(input.projectIds && input.projectIds.length > 0 ? { projects: input.projectIds } : {}),
    },
  }

  const res = await fetch("https://app.asana.com/api/1.0/tasks?opt_fields=gid,permalink_url", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Asana API ${res.status}: ${text.slice(0, 240)}`)
  }

  const json = (await res.json()) as { data: AsanaTask }
  return json.data
}
