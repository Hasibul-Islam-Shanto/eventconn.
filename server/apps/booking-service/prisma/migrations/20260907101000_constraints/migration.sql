ALTER TABLE "TicketInventory" ADD CONSTRAINT "inventory_bounds" CHECK ("availableQuantity" >= 0 AND "availableQuantity" <= "totalQuantity" AND "totalQuantity" > 0);
ALTER TABLE "TicketHold" ADD CONSTRAINT "hold_quantity_price" CHECK ("quantity" > 0 AND "unitPrice" >= 0);
ALTER TABLE "BookingItem" ADD CONSTRAINT "item_quantity_price" CHECK ("quantity" > 0 AND "unitPrice" >= 0);
ALTER TABLE "Booking" ADD CONSTRAINT "booking_money" CHECK ("subtotal" >= 0 AND "fees" >= 0 AND "total" = "subtotal" + "fees");
