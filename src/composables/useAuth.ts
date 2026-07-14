import type { AuthProfile } from "@/types/auth";
import { supabase } from "@/utils/supabase";

function handleError(error: any) {
  if (error) {
    throw new Error(error.message ?? "Supabase request failed");
  }
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  handleError(error);
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  handleError(error);
}

export async function getProfile(userId: string): Promise<AuthProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", userId)
    .single();
  handleError(error);
  if (!data) {
    throw new Error("Profile not found");
  }
  return data as AuthProfile;
}
