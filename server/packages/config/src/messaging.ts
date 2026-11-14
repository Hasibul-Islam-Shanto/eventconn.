import amqp, {
  type ConfirmChannel,
  type ChannelModel,
  type ConsumeMessage,
} from "amqplib";
import {
  envelopeSchema,
  type DomainEvent,
} from "../../shared-types/src/index.js";
import { logger } from "../../logger/src/index.js";
const exchange = "eventconn.events";
export function confirmedPublish(
  channel: ConfirmChannel,
  exchangeName: string,
  key: string,
  body: Buffer,
  headers: Record<string, unknown> = {},
) {
  return new Promise<void>((resolve, reject) => {
    channel.publish(
      exchangeName,
      key,
      body,
      { persistent: true, contentType: "application/json", headers },
      (err) => (err ? reject(err) : resolve()),
    );
  });
}
export async function connectBroker(url: string, service: string) {
  const log = logger(service);
  const connection: ChannelModel = await amqp.connect(url, { timeout: 5000 });
  const channel = await connection.createConfirmChannel();
  await channel.assertExchange(exchange, "topic", { durable: true });
  await channel.prefetch(10);
  // Declare durable subscriber queues before any producer can publish.
  for (const [queue, patterns] of [
    ["eventconn.booking-payments", ["payment.*"]],
    ["eventconn.notifications", ["booking.*", "payment.*"]],
  ] as const) {
    await channel.assertQueue(`${queue}.dead`, { durable: true });
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": `${queue}.dead`,
      },
    });
    for (const pattern of patterns)
      await channel.bindQueue(queue, exchange, pattern);
  }
  const consumers: string[] = [];
  const active = new Set<Promise<void>>();
  let closing = false;
  connection.on("error", () => log.error("RabbitMQ connection error"));
  connection.on("close", () => {
    if (!closing) {
      log.fatal("RabbitMQ disconnected; restart the service to reconnect");
      process.exit(1);
    }
  });
  return {
    publish: async (event: DomainEvent) => {
      const validated = envelopeSchema.parse(event);
      await confirmedPublish(
        channel,
        exchange,
        validated.eventType,
        Buffer.from(JSON.stringify(validated)),
      );
    },
    consume: async (
      queue: string,
      patterns: string[],
      handler: (event: DomainEvent) => Promise<void>,
    ) => {
      await channel.assertQueue(`${queue}.dead`, { durable: true });
      await channel.assertQueue(`${queue}.retry`, {
        durable: true,
        arguments: {
          "x-message-ttl": 1000,
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": queue,
        },
      });
      await channel.assertQueue(queue, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": `${queue}.dead`,
        },
      });
      for (const pattern of patterns)
        await channel.bindQueue(queue, exchange, pattern);
      const consumer = await channel.consume(
        queue,
        (message) => {
          if (message) {
            const task = deliver(channel, queue, message, handler, log);
            active.add(task);
            void task
              .finally(() => active.delete(task))
              .catch(() => log.error("Consumer channel failed"));
          }
        },
        { noAck: false },
      );
      consumers.push(consumer.consumerTag);
    },
    close: async () => {
      closing = true;
      for (const tag of consumers) await channel.cancel(tag);
      await Promise.allSettled([...active]);
      await channel.close();
      await connection.close();
    },
  };
}
async function deliver(
  channel: ConfirmChannel,
  queue: string,
  message: ConsumeMessage,
  handler: (event: DomainEvent) => Promise<void>,
  log: ReturnType<typeof logger>,
) {
  let event: DomainEvent;
  try {
    event = envelopeSchema.parse(JSON.parse(message.content.toString()));
  } catch {
    log.warn({ queue }, "Invalid domain message sent to dead-letter queue");
    channel.nack(message, false, false);
    return;
  }
  try {
    await handler(event);
    channel.ack(message);
  } catch {
    const attempts = Number(message.properties.headers?.["x-retry-count"] ?? 0);
    log.warn(
      { eventId: event.eventId, correlationId: event.correlationId, attempts },
      "Consumer failed",
    );
    if (attempts >= 3) {
      channel.nack(message, false, false);
      return;
    }
    try {
      await confirmedPublish(channel, "", `${queue}.retry`, message.content, {
        "x-retry-count": attempts + 1,
      });
      channel.ack(message);
    } catch {
      channel.nack(message, false, true);
    }
  }
}
