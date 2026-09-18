import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError, type ZodType } from "zod";
import {
  buildEducatorReport,
  courseDeliverySchema,
  reportRequestSchema,
  sendCourseDelivery,
} from "./course_campaign";
import { createInfraiClient, InfraiError } from "./infrai_email";

async function readJson<T>(request: IncomingMessage, schema: ZodType<T>): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const client = createInfraiClient();

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/course-deliveries") {
      const input = await readJson(request, courseDeliverySchema);
      return json(response, 202, await sendCourseDelivery(client, input));
    }
    if (request.method === "POST" && request.url === "/educator-reports") {
      const input = await readJson(request, reportRequestSchema);
      return json(response, 200, await buildEducatorReport(client, input));
    }
    return json(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return json(response, 400, { error: "invalid_request" });
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 && error.status !== 429 ? error.status : 503;
      return json(response, status, { error: error.code, message: error.message });
    }
    console.error(error);
    return json(response, 500, { error: "internal_error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Educator delivery service listening on http://localhost:${port}`));
