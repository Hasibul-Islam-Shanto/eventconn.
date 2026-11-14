import { beforeAll, afterAll, describe, it, expect } from "vitest";
import amqp, { type ChannelModel, type ConfirmChannel } from "amqplib";
import {
  connectBroker,
  confirmedPublish,
} from "../packages/config/src/messaging.js";
import { eventMessage } from "../packages/shared-types/src/index.js";
// Dedicated test broker/vhost only. These tests create and delete their own queues.
describe.skipIf(!process.env.TEST_RABBITMQ_URL)(
  "real RabbitMQ ack retry and dead-letter",
  () => {
    let broker: Awaited<ReturnType<typeof connectBroker>>;
    let connection: ChannelModel;
    let channel: ConfirmChannel;
    const queues: string[] = [];
    const queue = () => {
      const q = `eventconn.test.${crypto.randomUUID()}`;
      queues.push(q);
      return q;
    };
    beforeAll(async () => {
      const url = process.env.TEST_RABBITMQ_URL;
      if (!url) throw Error("TEST_RABBITMQ_URL required");
      broker = await connectBroker(url, "test");
      connection = await amqp.connect(url);
      channel = await connection.createConfirmChannel();
    });
    afterAll(async () => {
      for (const q of queues)
        for (const suffix of ["", ".retry", ".dead"])
          await channel.deleteQueue(q + suffix);
      await channel.close();
      await connection.close();
      await broker.close();
    });
    async function waitFor(check: () => Promise<boolean>) {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (await check()) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw Error("Timed out waiting for RabbitMQ");
    }
    it("retries transient failures, acknowledges success, and preserves envelopes", async () => {
      const q = queue();
      let attempts = 0;
      let received = "";
      await broker.consume(q, [], async (event) => {
        attempts++;
        if (attempts < 2) throw Error("temporary failure");
        received = event.eventId;
      });
      const event = eventMessage(
        "booking.confirmed",
        { bookingId: crypto.randomUUID(), userId: crypto.randomUUID() },
        crypto.randomUUID(),
      );
      await confirmedPublish(
        channel,
        "",
        q,
        Buffer.from(JSON.stringify(event)),
      );
      await waitFor(async () => received === event.eventId);
      expect(attempts).toBe(2);
      expect((await channel.checkQueue(q)).messageCount).toBe(0);
    });
    it("rejects invalid JSON to the dead-letter queue without invoking the consumer", async () => {
      const q = queue();
      let called = false;
      await broker.consume(q, [], async () => {
        called = true;
      });
      await confirmedPublish(channel, "", q, Buffer.from("invalid"));
      await waitFor(
        async () => (await channel.checkQueue(`${q}.dead`)).messageCount === 1,
      );
      expect(called).toBe(false);
    });
    it("dead-letters a persistently failing message after bounded retries", async () => {
      const q = queue();
      let attempts = 0;
      await broker.consume(q, [], async () => {
        attempts++;
        throw Error("persistent failure");
      });
      await confirmedPublish(
        channel,
        "",
        q,
        Buffer.from(
          JSON.stringify(
            eventMessage(
              "booking.cancelled",
              { bookingId: crypto.randomUUID(), userId: crypto.randomUUID() },
              crypto.randomUUID(),
            ),
          ),
        ),
      );
      await waitFor(
        async () => (await channel.checkQueue(`${q}.dead`)).messageCount === 1,
      );
      expect(attempts).toBe(4);
    });
  },
);
