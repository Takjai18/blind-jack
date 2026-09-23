import type { QuestionBank } from "./bank";
import type { Room } from "./room";

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  BANK: DurableObjectNamespace<QuestionBank>;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
}
