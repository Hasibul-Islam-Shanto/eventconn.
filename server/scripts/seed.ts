import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { PrismaClient as EventClient } from "../apps/event-service/generated/client/index.js";
import { PrismaClient as AuthClient } from "../apps/auth-service/generated/client/index.js";
import { PrismaClient as BookingClient } from "../apps/booking-service/generated/client/index.js";

const authDb = new AuthClient();
const eventDb = new EventClient();
const bookingDb = new BookingClient();

const internalSecret =
  process.env.INTERNAL_SECRET || "local-only-change-this-32-character-internal-secret";

async function main() {
  console.log("🌱 Starting EventConn demo database seeding...\n");

  // 1. Seed Categories
  console.log("📁 Seeding event categories...");
  const categories = new Map<string, string>();
  for (const [name, slug] of [
    ["Technology", "technology"],
    ["Music", "music"],
    ["Business", "business"],
    ["Arts & Culture", "arts"],
    ["Sports & Fitness", "sports"],
  ] as const) {
    const cat = await eventDb.eventCategory.upsert({
      where: { slug },
      create: { name, slug },
      update: { name },
    });
    categories.set(slug, cat.id);
  }
  console.log("   ✓ Categories seeded.");

  // 2. Seed Demo Users
  console.log("👥 Seeding demo accounts (Organizer & Customer)...");
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const organizer = await authDb.user.upsert({
    where: { email: "organizer@eventconn.com" },
    create: {
      id: "11111111-1111-4111-a111-111111111111",
      name: "Demo Organizer",
      email: "organizer@eventconn.com",
      passwordHash,
      role: "ORGANIZER",
    },
    update: {
      name: "Demo Organizer",
      passwordHash,
      role: "ORGANIZER",
    },
  });

  const customer = await authDb.user.upsert({
    where: { email: "customer@eventconn.com" },
    create: {
      id: "22222222-2222-4222-a222-222222222222",
      name: "Demo Customer",
      email: "customer@eventconn.com",
      passwordHash,
      role: "CUSTOMER",
    },
    update: {
      name: "Demo Customer",
      passwordHash,
      role: "CUSTOMER",
    },
  });
  console.log("   ✓ Organizer: organizer@eventconn.com / Password123!");
  console.log("   ✓ Customer:  customer@eventconn.com / Password123!");

  // 3. Seed Venues
  console.log("📍 Seeding demo venues in Dhaka...");
  const venueBicc = await eventDb.venue.upsert({
    where: { id: "33333333-3333-4333-a333-333333333331" },
    create: {
      id: "33333333-3333-4333-a333-333333333331",
      name: "Bangabandhu International Conference Center (BICC)",
      address: "Begum Rokeya Sarani, Agargaon",
      city: "Dhaka",
      timezone: "Asia/Dhaka",
    },
    update: {
      name: "Bangabandhu International Conference Center (BICC)",
      address: "Begum Rokeya Sarani, Agargaon",
      city: "Dhaka",
      timezone: "Asia/Dhaka",
    },
  });

  const venueRadisson = await eventDb.venue.upsert({
    where: { id: "33333333-3333-4333-a333-333333333332" },
    create: {
      id: "33333333-3333-4333-a333-333333333332",
      name: "Radisson Blu Water Garden Grand Ballroom",
      address: "Airport Road, Dhaka Cantonment",
      city: "Dhaka",
      timezone: "Asia/Dhaka",
    },
    update: {
      name: "Radisson Blu Water Garden Grand Ballroom",
      address: "Airport Road, Dhaka Cantonment",
      city: "Dhaka",
      timezone: "Asia/Dhaka",
    },
  });

  const venueStadium = await eventDb.venue.upsert({
    where: { id: "33333333-3333-4333-a333-333333333333" },
    create: {
      id: "33333333-3333-4333-a333-333333333333",
      name: "Bangladesh Army Stadium",
      address: "New Airport Road, Banani",
      city: "Dhaka",
      timezone: "Asia/Dhaka",
    },
    update: {
      name: "Bangladesh Army Stadium",
      address: "New Airport Road, Banani",
      city: "Dhaka",
      timezone: "Asia/Dhaka",
    },
  });
  console.log("   ✓ Venues created.");

  // 4. Seed Events & Ticket Types
  console.log("🎟️  Seeding published events and ticket tiers...");

  const now = new Date();
  const salesStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const salesEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  // Event 1: Tech Summit
  const event1 = await eventDb.event.upsert({
    where: { slug: "dhaka-tech-summit-2026" },
    create: {
      id: "44444444-4444-4444-a444-444444444441",
      organizerId: organizer.id,
      title: "Dhaka Tech Summit 2026",
      slug: "dhaka-tech-summit-2026",
      shortDescription: "The premier developer & engineering conference in South Asia.",
      description:
        "Join 1,000+ software engineers, founders, and distributed systems architects for two full days of keynotes, breakout tracks on microservices, cloud native architectures, and live tech demos.",
      coverImageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1400&q=85",
      categoryId: categories.get("technology")!,
      venueId: venueBicc.id,
      startDateTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      endDateTime: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
      status: "PUBLISHED",
    },
    update: {
      status: "PUBLISHED",
    },
  });

  const t1_early = await eventDb.ticketType.upsert({
    where: { id: "55555555-5555-4555-a555-555555555551" },
    create: {
      id: "55555555-5555-4555-a555-555555555551",
      eventId: event1.id,
      name: "Early Bird Pass",
      description: "Full summit access with keynote admissions and swag bag.",
      price: 150000, // 1,500 BDT
      capacity: 50,
      salesStartAt: salesStart,
      salesEndAt: salesEnd,
      isActive: true,
    },
    update: { capacity: 50, price: 150000 },
  });

  const t1_standard = await eventDb.ticketType.upsert({
    where: { id: "55555555-5555-4555-a555-555555555552" },
    create: {
      id: "55555555-5555-4555-a555-555555555552",
      eventId: event1.id,
      name: "Standard Delegate",
      description: "Full summit access including workshop labs and lunch.",
      price: 300000, // 3,000 BDT
      capacity: 150,
      salesStartAt: salesStart,
      salesEndAt: salesEnd,
      isActive: true,
    },
    update: { capacity: 150, price: 300000 },
  });

  const t1_vip = await eventDb.ticketType.upsert({
    where: { id: "55555555-5555-4555-a555-555555555553" },
    create: {
      id: "55555555-5555-4555-a555-555555555553",
      eventId: event1.id,
      name: "VIP Executive Pass",
      description: "VIP front seating, speaker lounge access & private networking dinner.",
      price: 600000, // 6,000 BDT
      capacity: 25,
      salesStartAt: salesStart,
      salesEndAt: salesEnd,
      isActive: true,
    },
    update: { capacity: 25, price: 600000 },
  });

  // Event 2: Music Festival
  const event2 = await eventDb.event.upsert({
    where: { slug: "dhaka-indie-rock-festival" },
    create: {
      id: "44444444-4444-4444-a444-444444444442",
      organizerId: organizer.id,
      title: "Dhaka Indie & Rock Festival",
      slug: "dhaka-indie-rock-festival",
      shortDescription: "An electrifying open-air evening celebrating the best indie bands.",
      description:
        "Six live acts performing back-to-back under the lights of Bangladesh Army Stadium. Food stalls, merchandise, and unforgettable music.",
      coverImageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1400&q=85",
      categoryId: categories.get("music")!,
      venueId: venueStadium.id,
      startDateTime: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
      endDateTime: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000 + 6 * 3600 * 1000),
      status: "PUBLISHED",
    },
    update: {
      status: "PUBLISHED",
    },
  });

  const t2_reg = await eventDb.ticketType.upsert({
    where: { id: "55555555-5555-4555-a555-555555555554" },
    create: {
      id: "55555555-5555-4555-a555-555555555554",
      eventId: event2.id,
      name: "General Admission",
      description: "Open-field entry to the festival grounds.",
      price: 80000, // 800 BDT
      capacity: 400,
      salesStartAt: salesStart,
      salesEndAt: salesEnd,
      isActive: true,
    },
    update: { capacity: 400, price: 80000 },
  });

  // Event 3: Startup Conclave
  const event3 = await eventDb.event.upsert({
    where: { slug: "national-startup-conclave" },
    create: {
      id: "44444444-4444-4444-a444-444444444443",
      organizerId: organizer.id,
      title: "National Startup Conclave 2026",
      slug: "national-startup-conclave",
      shortDescription: "Where high-growth venture founders meet regional Angel and VC investors.",
      description:
        "Pitch competitions, live investor deal-making rounds, fireside chats with unicorn operators, and exhibition booths for 50 vetted seed-stage startups.",
      coverImageUrl: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1400&q=85",
      categoryId: categories.get("business")!,
      venueId: venueRadisson.id,
      startDateTime: new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000),
      endDateTime: new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000),
      status: "PUBLISHED",
    },
    update: {
      status: "PUBLISHED",
    },
  });

  const t3_pass = await eventDb.ticketType.upsert({
    where: { id: "55555555-5555-4555-a555-555555555555" },
    create: {
      id: "55555555-5555-4555-a555-555555555555",
      eventId: event3.id,
      name: "Founder All-Access",
      description: "Access to pitching sessions and investor lounges.",
      price: 120000, // 1,200 BDT
      capacity: 100,
      salesStartAt: salesStart,
      salesEndAt: salesEnd,
      isActive: true,
    },
    update: { capacity: 100, price: 120000 },
  });
  console.log("   ✓ 3 Published Events and ticket tiers configured.");

  // 5. Initialize Booking Inventory
  console.log("📦 Synchronizing inventory in booking_db...");
  const ticketsToSync = [t1_early, t1_standard, t1_vip, t2_reg, t3_pass];
  for (const t of ticketsToSync) {
    await bookingDb.ticketInventory.upsert({
      where: { ticketTypeId: t.id },
      create: {
        eventId: t.eventId,
        ticketTypeId: t.id,
        organizerId: organizer.id,
        totalQuantity: t.capacity,
        availableQuantity: t.id === t1_standard.id ? t.capacity - 2 : t.capacity,
      },
      update: {
        totalQuantity: t.capacity,
      },
    });
  }
  console.log("   ✓ Inventory synchronized.");

  // 6. Seed a Confirmed Booking with QR passes for customer
  console.log("🎫 Generating a sample confirmed booking with signed QR codes for Customer...");
  const bookingId = "66666666-6666-4666-a666-666666666661";
  const holdId = "77777777-7777-4777-a777-777777777771";

  await bookingDb.ticketHold.upsert({
    where: { id: holdId },
    create: {
      id: holdId,
      userId: customer.id,
      eventId: event1.id,
      ticketTypeId: t1_standard.id,
      organizerId: organizer.id,
      ticketName: t1_standard.name,
      unitPrice: t1_standard.price,
      quantity: 2,
      expiresAt: new Date(now.getTime() + 3600 * 1000),
      status: "CONVERTED",
    },
    update: { status: "CONVERTED" },
  });

  const booking = await bookingDb.booking.upsert({
    where: { id: bookingId },
    create: {
      id: bookingId,
      userId: customer.id,
      organizerId: organizer.id,
      eventId: event1.id,
      holdId,
      status: "CONFIRMED",
      subtotal: t1_standard.price * 2,
      fees: 0,
      total: t1_standard.price * 2,
      currency: "BDT",
      paymentStatus: "SUCCEEDED",
      expiresAt: new Date(now.getTime() + 3600 * 1000),
    },
    update: {
      status: "CONFIRMED",
      paymentStatus: "SUCCEEDED",
    },
  });

  await bookingDb.bookingItem.deleteMany({ where: { bookingId: booking.id } });
  await bookingDb.bookingItem.create({
    data: {
      bookingId: booking.id,
      ticketTypeId: t1_standard.id,
      ticketName: t1_standard.name,
      quantity: 2,
      unitPrice: t1_standard.price,
    },
  });

  // Create 2 issued tickets with HMAC signatures
  await bookingDb.issuedTicket.deleteMany({ where: { bookingId: booking.id } });
  for (let n = 1; n <= 2; n++) {
    const codeSuffix = `DEMO${n}`;
    const ticketCode = `EC-${booking.id.slice(0, 4).toUpperCase()}-${codeSuffix}-${n}`;
    const qrSignature = crypto
      .createHmac("sha256", internalSecret)
      .update(`${ticketCode}:${event1.id}:${booking.id}:${n}`)
      .digest("hex");

    await bookingDb.issuedTicket.create({
      data: {
        bookingId: booking.id,
        eventId: event1.id,
        organizerId: organizer.id,
        ticketTypeId: t1_standard.id,
        ticketName: t1_standard.name,
        ticketNumber: n,
        ticketCode,
        qrSignature,
        status: "VALID",
      },
    });
  }
  console.log("   ✓ Sample booking created with 2 scannable passes for customer@eventconn.com.\n");

  console.log("🎉 Seeding complete! You are ready to test:\n");
  console.log("   👉 Organizer Login: organizer@eventconn.com / Password123!");
  console.log("      - Manage events, inspect sales, and open /organizer/scan\n");
  console.log("   👉 Customer Login:  customer@eventconn.com / Password123!");
  console.log("      - View bookings, inspect QR tickets, or purchase new tickets\n");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await authDb.$disconnect();
    await eventDb.$disconnect();
    await bookingDb.$disconnect();
  });
