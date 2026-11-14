import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

function generateTicketSignature(
  secret: string,
  ticketCode: string,
  eventId: string,
  bookingId: string,
  ticketNumber: number,
) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${ticketCode}:${eventId}:${bookingId}:${ticketNumber}`)
    .digest("hex");
}

function verifyTicketSignature(
  secret: string,
  signature: string,
  ticketCode: string,
  eventId: string,
  bookingId: string,
  ticketNumber: number,
) {
  const expected = generateTicketSignature(
    secret,
    ticketCode,
    eventId,
    bookingId,
    ticketNumber,
  );
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

describe("Cryptographic Ticket Signing & Verification", () => {
  const secret = "test-internal-secret-for-signing-tickets-1234";
  const eventId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const bookingId = "7ca18b52-1234-4562-b3fc-2c963f66afa6";
  const ticketCode = "EC-7CA1-A8B9C0-1";
  const ticketNumber = 1;

  it("generates a valid deterministic HMAC-SHA256 signature", () => {
    const sig1 = generateTicketSignature(secret, ticketCode, eventId, bookingId, ticketNumber);
    const sig2 = generateTicketSignature(secret, ticketCode, eventId, bookingId, ticketNumber);
    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64);
  });

  it("verifies a legitimate ticket signature successfully", () => {
    const sig = generateTicketSignature(secret, ticketCode, eventId, bookingId, ticketNumber);
    const isValid = verifyTicketSignature(secret, sig, ticketCode, eventId, bookingId, ticketNumber);
    expect(isValid).toBe(true);
  });

  it("rejects tampered ticket codes", () => {
    const sig = generateTicketSignature(secret, ticketCode, eventId, bookingId, ticketNumber);
    const isValid = verifyTicketSignature(secret, sig, "EC-FORGED-CODE-1", eventId, bookingId, ticketNumber);
    expect(isValid).toBe(false);
  });

  it("rejects ticket signatures presented for a different event", () => {
    const sig = generateTicketSignature(secret, ticketCode, eventId, bookingId, ticketNumber);
    const otherEventId = "00000000-0000-0000-0000-000000000000";
    const isValid = verifyTicketSignature(secret, sig, ticketCode, otherEventId, bookingId, ticketNumber);
    expect(isValid).toBe(false);
  });

  it("rejects signatures signed with an incorrect secret", () => {
    const forgedSig = generateTicketSignature("wrong-secret", ticketCode, eventId, bookingId, ticketNumber);
    const isValid = verifyTicketSignature(secret, forgedSig, ticketCode, eventId, bookingId, ticketNumber);
    expect(isValid).toBe(false);
  });
});

