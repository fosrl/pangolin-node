import { Router } from "express";
import * as badger from "./badger";
import { proxyToRemote } from "@server/lib/remoteProxy";
import HttpCode from "@server/types/HttpCode";

// Root routes
export const internalRouter = Router();

internalRouter.get("/", (_, res) => {
    res.status(HttpCode.OK).json({ message: "Healthy" });
});

// Gerbil routes
const gerbilRouter = Router();
internalRouter.use("/gerbil", gerbilRouter);

// Use proxy router to forward requests to remote cloud server
// Proxy endpoints for each gerbil route
gerbilRouter.post("/receive-bandwidth", (req, res, next) =>
    proxyToRemote(req, res, next, "hybrid/gerbil/receive-bandwidth")
);

gerbilRouter.post("/update-hole-punch", (req, res, next) =>
    proxyToRemote(req, res, next, "hybrid/gerbil/update-hole-punch")
);

gerbilRouter.post("/get-all-relays", (req, res, next) =>
    proxyToRemote(req, res, next, "hybrid/gerbil/get-all-relays")
);

gerbilRouter.post("/get-resolved-hostname", (req, res, next) =>
    proxyToRemote(req, res, next, `hybrid/gerbil/get-resolved-hostname`)
);

gerbilRouter.post("/get-config", (req, res, next) =>
    proxyToRemote(req, res, next, "hybrid/gerbil/get-config")
);

// Badger routes
const badgerRouter = Router();
internalRouter.use("/badger", badgerRouter);

badgerRouter.post("/verify-session", badger.verifyResourceSession);

badgerRouter.post("/exchange-session", (req, res, next) =>
    proxyToRemote(req, res, next, "hybrid/badger/exchange-session")
);
