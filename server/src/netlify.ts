import serverless from "serverless-http";
import { getConnectionString } from "@netlify/database";
import { createDb } from "./db.js";
import { createApp } from "./app.js";

export const handler = serverless(createApp(createDb(getConnectionString())));
