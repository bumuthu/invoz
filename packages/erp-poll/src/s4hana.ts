import { runPoll } from "./poll";

export async function handler(): Promise<void> {
  await runPoll("s4hana");
}
