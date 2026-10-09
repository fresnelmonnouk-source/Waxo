/** Borne une promesse : un appel Supabase qui ne résout jamais ne doit pas figer la requête. */
export function withTimeout<T>(p: PromiseLike<T>, ms = 4000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([Promise.resolve(p), timeout]).finally(() => clearTimeout(timer));
}
