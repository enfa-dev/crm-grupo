"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type Estado = { erro?: string; aviso?: string } | undefined;

export async function entrar(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await createClient();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("senha") ?? "");

  if (form.get("modo") === "criar") {
    const origem = (await headers()).get("origin") ?? "";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome: String(form.get("nome") ?? "") }, emailRedirectTo: `${origem}/` },
    });
    if (error) return { erro: error.message };
    if (!data.session) return { aviso: "Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre." };
    redirect("/");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { erro: "E-mail ou senha incorretos." };
  redirect("/");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
