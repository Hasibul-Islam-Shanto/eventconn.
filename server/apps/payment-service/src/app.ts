import {
  baseApp,
  finish,
  ok,
  authenticate,
  identity,
  role,
  uuid,
  requestId,
} from "../../../packages/config/src/http.js";
import { PaymentService } from "./modules/payments/payment.service.js";
import {
  paymentInput,
  paymentKey,
} from "./modules/payments/payment.validation.js";
export function createPaymentApp(service: PaymentService, secret: string) {
  const app = baseApp("payment-service");
  app.use("/payments", authenticate(secret), role("CUSTOMER"));
  app.post("/payments", async (req, res) =>
    ok(
      res,
      await service.create(
        identity(res).userId,
        paymentInput.parse(req.body),
        paymentKey.parse(req.get("idempotency-key")),
        requestId(res),
      ),
      "Mock payment processed",
      201,
    ),
  );
  app.get("/payments/:id", async (req, res) =>
    ok(res, await service.get(uuid.parse(req.params.id), identity(res).userId)),
  );
  return finish(app, "payment-service");
}
