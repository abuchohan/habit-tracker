CREATE TABLE "push_subscriptions" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "endpoint" TEXT NOT NULL, "data" JSONB NOT NULL,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");
CREATE TABLE "push_deliveries" (
  "subscriptionId" TEXT NOT NULL, "habitId" TEXT NOT NULL, "date" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("subscriptionId", "habitId", "date"),
  CONSTRAINT "push_deliveries_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "push_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
