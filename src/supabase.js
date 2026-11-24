import { createClient } from "@supabase/supabase-js";

// Need väärtused tulevad failist .env.local (vt .env.example).
// "anon" võti on avalik ja tohib olla veebilehe koodis: andmeid kaitsevad
// andmebaasi reeglid (Row Level Security), mitte võtme salajasus.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

// Loeb kasutaja andmed (päevik + spikker). Tagastab { diary, notes }.
export async function loadUserData(userId) {
  const { data, error } = await supabase.from("user_data").select("diary, notes").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return { diary: data?.diary || null, notes: data?.notes || [] };
}

export async function saveDiary(userId, diary) {
  const { error } = await supabase.from("user_data").upsert({ user_id: userId, diary, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function saveNotes(userId, notes) {
  const { error } = await supabase.from("user_data").upsert({ user_id: userId, notes, updated_at: new Date().toISOString() });
  if (error) throw error;
}
