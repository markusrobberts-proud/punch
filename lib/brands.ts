import { cache } from "react"
import { createSupabaseServerClient } from "./supabase/server"

export type Brand = {
  id: string
  slug: string
  name: string
  industry: string | null
  website_url: string | null
  primary_color: string | null
  scrape_status: "pending" | "running" | "done" | "error"
  status: "active" | "inactive"
}

export const listAccessibleBrands = cache(async (): Promise<Brand[]> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("brands")
    .select("id,slug,name,industry,website_url,primary_color,scrape_status,status")
    .eq("status", "active")
    .order("name", { ascending: true })
  if (error) return []
  return (data ?? []) as Brand[]
})

export const getBrandBySlug = cache(async (slug: string) => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .maybeSingle()
  if (error) return null
  return data
})

export function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64)
}
