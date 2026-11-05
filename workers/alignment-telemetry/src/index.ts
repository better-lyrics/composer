import { type Env, handle } from "./handler";

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
