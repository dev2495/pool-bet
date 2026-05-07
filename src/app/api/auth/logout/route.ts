import { clearSession } from "@/lib/auth";
import { handle, ok } from "@/lib/api";

export async function POST() {
  return handle(async () => {
    await clearSession();
    return ok({ done: true });
  });
}
