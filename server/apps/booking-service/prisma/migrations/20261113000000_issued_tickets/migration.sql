-- CreateTable
CREATE TABLE "IssuedTicket" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "organizerId" UUID NOT NULL,
    "ticketTypeId" UUID NOT NULL,
    "ticketName" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "qrSignature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "checkedInAt" TIMESTAMPTZ(3),
    "checkedInBy" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IssuedTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssuedTicket_ticketCode_key" ON "IssuedTicket"("ticketCode");

-- CreateIndex
CREATE INDEX "IssuedTicket_bookingId_idx" ON "IssuedTicket"("bookingId");

-- CreateIndex
CREATE INDEX "IssuedTicket_eventId_ticketCode_idx" ON "IssuedTicket"("eventId", "ticketCode");

-- CreateIndex
CREATE INDEX "IssuedTicket_organizerId_idx" ON "IssuedTicket"("organizerId");

-- AddForeignKey
ALTER TABLE "IssuedTicket" ADD CONSTRAINT "IssuedTicket_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

