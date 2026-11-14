ALTER TABLE "Payment" ADD CONSTRAINT "payment_amount" CHECK ("amount" >= 0 AND "currency" = 'BDT');
