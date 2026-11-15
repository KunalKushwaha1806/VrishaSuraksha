-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passcodeHash" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "elderId" TEXT NOT NULL,
    "inviteCodeHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Circle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "visibility" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "doseText" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "criticality" TEXT NOT NULL DEFAULT 'normal',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "unitsPerDose" INTEGER NOT NULL DEFAULT 1,
    "notesEnc" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "timesOfDay" TEXT[],
    "daysOfWeek" INTEGER[],
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoseEvent" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "loggedById" TEXT,
    "loggedAt" TIMESTAMP(3),
    "missedReason" TEXT,
    "note" TEXT,

    CONSTRAINT "DoseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "doctor" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "notesEnc" TEXT,
    "reminderOffsets" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceNote" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "fromMemberId" TEXT NOT NULL,
    "medicationId" TEXT,
    "audioData" BYTEA,
    "blobUrl" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "circleId" TEXT,
    "doseId" TEXT,
    "appointmentId" TEXT,
    "medicationId" TEXT,
    "kind" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefillClaim" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "claimedByMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RefillClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymptomEntry" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "textEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedDoseEventId" TEXT,

    CONSTRAINT "SymptomEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareToken" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "actorMemberId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentLog" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "change" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "fromMemberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentStore" (
    "collection" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentStore_pkey" PRIMARY KEY ("collection","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Circle_elderId_idx" ON "Circle"("elderId");

-- CreateIndex
CREATE INDEX "Member_circleId_idx" ON "Member"("circleId");

-- CreateIndex
CREATE INDEX "Member_userId_idx" ON "Member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_circleId_userId_key" ON "Member"("circleId", "userId");

-- CreateIndex
CREATE INDEX "Medication_circleId_idx" ON "Medication"("circleId");

-- CreateIndex
CREATE INDEX "Medication_active_idx" ON "Medication"("active");

-- CreateIndex
CREATE INDEX "Schedule_medicationId_idx" ON "Schedule"("medicationId");

-- CreateIndex
CREATE INDEX "DoseEvent_medicationId_idx" ON "DoseEvent"("medicationId");

-- CreateIndex
CREATE INDEX "DoseEvent_scheduledFor_idx" ON "DoseEvent"("scheduledFor");

-- CreateIndex
CREATE INDEX "DoseEvent_status_idx" ON "DoseEvent"("status");

-- CreateIndex
CREATE INDEX "Appointment_circleId_idx" ON "Appointment"("circleId");

-- CreateIndex
CREATE INDEX "Appointment_startsAt_idx" ON "Appointment"("startsAt");

-- CreateIndex
CREATE INDEX "VoiceNote_circleId_idx" ON "VoiceNote"("circleId");

-- CreateIndex
CREATE INDEX "VoiceNote_fromMemberId_idx" ON "VoiceNote"("fromMemberId");

-- CreateIndex
CREATE INDEX "VoiceNote_medicationId_idx" ON "VoiceNote"("medicationId");

-- CreateIndex
CREATE INDEX "ScheduledJob_status_dueAt_idx" ON "ScheduledJob"("status", "dueAt");

-- CreateIndex
CREATE INDEX "ScheduledJob_circleId_idx" ON "ScheduledJob"("circleId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJob_doseId_kind_dueAt_key" ON "ScheduledJob"("doseId", "kind", "dueAt");

-- CreateIndex
CREATE INDEX "RefillClaim_medicationId_idx" ON "RefillClaim"("medicationId");

-- CreateIndex
CREATE INDEX "RefillClaim_claimedByMemberId_idx" ON "RefillClaim"("claimedByMemberId");

-- CreateIndex
CREATE INDEX "SymptomEntry_circleId_idx" ON "SymptomEntry"("circleId");

-- CreateIndex
CREATE INDEX "SymptomEntry_linkedDoseEventId_idx" ON "SymptomEntry"("linkedDoseEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareToken_tokenHash_key" ON "ShareToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ShareToken_circleId_idx" ON "ShareToken"("circleId");

-- CreateIndex
CREATE INDEX "ShareToken_tokenHash_idx" ON "ShareToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ActivityLog_circleId_idx" ON "ActivityLog"("circleId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ConsentLog_circleId_idx" ON "ConsentLog"("circleId");

-- CreateIndex
CREATE INDEX "ConsentLog_memberId_idx" ON "ConsentLog"("memberId");

-- CreateIndex
CREATE INDEX "Reaction_circleId_idx" ON "Reaction"("circleId");

-- CreateIndex
CREATE INDEX "Reaction_fromMemberId_idx" ON "Reaction"("fromMemberId");

-- CreateIndex
CREATE INDEX "DocumentStore_collection_idx" ON "DocumentStore"("collection");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoseEvent" ADD CONSTRAINT "DoseEvent_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceNote" ADD CONSTRAINT "VoiceNote_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceNote" ADD CONSTRAINT "VoiceNote_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceNote" ADD CONSTRAINT "VoiceNote_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_doseId_fkey" FOREIGN KEY ("doseId") REFERENCES "DoseEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefillClaim" ADD CONSTRAINT "RefillClaim_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefillClaim" ADD CONSTRAINT "RefillClaim_claimedByMemberId_fkey" FOREIGN KEY ("claimedByMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomEntry" ADD CONSTRAINT "SymptomEntry_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomEntry" ADD CONSTRAINT "SymptomEntry_linkedDoseEventId_fkey" FOREIGN KEY ("linkedDoseEventId") REFERENCES "DoseEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareToken" ADD CONSTRAINT "ShareToken_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorMemberId_fkey" FOREIGN KEY ("actorMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

