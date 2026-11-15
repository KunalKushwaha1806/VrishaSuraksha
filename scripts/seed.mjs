import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const DEMO_CIRCLE_ID = "demo-circle";
const DEMO_CODE = "DEMO24";
const DEMO_PASSCODE = "246810";

async function runSeed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === "") {
    console.log("No DATABASE_URL set. Attempting HTTP reset on localhost:3000/api/demo/reset...");
    try {
      const res = await fetch("http://localhost:3000/api/demo/reset", { method: "POST" });
      if (res.ok) {
        console.log("Successfully seeded demo data via localhost:3000/api/demo/reset!");
        return;
      }
    } catch {
      console.log("Local server is not running. Please set DATABASE_URL or run `npm run dev` first.");
      return;
    }
  }

  console.log("Connecting to PostgreSQL database via Prisma to seed demo data...");
  const prisma = new PrismaClient();

  try {
    const passcodeHash = await bcrypt.hash(DEMO_PASSCODE, 12);
    const now = new Date();
    const twentyDaysAgo = new Date(now.getTime() - 20 * 86400000);

    // 1. Create or update Demo Users
    const users = [
      { id: "demo-user-elder", name: "Ramesh Sharma (Dadaji)", email: "elder@example.com", language: "hi" },
      { id: "demo-user-caretaker", name: "Sunita", email: "caretaker@example.com", language: "en" },
      { id: "demo-user-arjun", name: "Arjun", email: "arjun@example.com", language: "en" },
      { id: "demo-user-riya", name: "Riya", email: "riya@example.com", language: "en" },
    ];

    for (const u of users) {
      await prisma.user.upsert({
        where: { email: u.email },
        create: {
          id: u.id,
          name: u.name,
          email: u.email,
          passcodeHash,
          language: u.language,
          createdAt: twentyDaysAgo,
        },
        update: {
          name: u.name,
          language: u.language,
          passcodeHash,
        },
      });
    }

    // 2. Create Circle
    await prisma.circle.upsert({
      where: { id: DEMO_CIRCLE_ID },
      create: {
        id: DEMO_CIRCLE_ID,
        name: "Sharma family",
        elderId: "demo-elder",
        inviteCodeHash: passcodeHash,
        createdAt: twentyDaysAgo,
      },
      update: {
        name: "Sharma family",
        elderId: "demo-elder",
      },
    });

    // 3. Create Members
    const members = [
      {
        id: "demo-elder",
        userId: "demo-user-elder",
        role: "ELDER",
        visibility: { doses: true, missedReasons: true, symptoms: true, appointments: true, stock: true },
      },
      {
        id: "demo-caretaker",
        userId: "demo-user-caretaker",
        role: "CARETAKER",
        visibility: { doses: true, missedReasons: true, symptoms: true, appointments: true, stock: true },
      },
      {
        id: "demo-arjun",
        userId: "demo-user-arjun",
        role: "FAMILY",
        visibility: { doses: true, missedReasons: true, symptoms: true, appointments: true, stock: true },
      },
      {
        id: "demo-riya",
        userId: "demo-user-riya",
        role: "FAMILY",
        visibility: { doses: true, missedReasons: false, symptoms: false, appointments: true, stock: true },
      },
    ];

    for (const m of members) {
      await prisma.member.upsert({
        where: { id: m.id },
        create: {
          id: m.id,
          circleId: DEMO_CIRCLE_ID,
          userId: m.userId,
          role: m.role,
          visibility: m.visibility,
          active: true,
          createdAt: twentyDaysAgo,
        },
        update: {
          role: m.role,
          visibility: m.visibility,
          active: true,
        },
      });
    }

    // 4. Create 6 Medications with one low-stock medicine
    const meds = [
      {
        id: "demo-metformin",
        name: "Metformin",
        doseText: "500 mg",
        form: "tablet",
        criticality: "normal",
        stock: 54,
        times: ["08:30", "20:30"],
        days: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        id: "demo-amlodipine",
        name: "Amlodipine",
        doseText: "5 mg",
        form: "tablet",
        criticality: "high",
        stock: 4, // LOW STOCK: 4 pills left (< 5 days)
        times: ["09:00"],
        days: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        id: "demo-atorvastatin",
        name: "Atorvastatin",
        doseText: "10 mg",
        form: "tablet",
        criticality: "normal",
        stock: 25,
        times: ["21:30"],
        days: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        id: "demo-aspirin",
        name: "Ecosprin",
        doseText: "75 mg",
        form: "tablet",
        criticality: "high",
        stock: 28,
        times: ["14:00"],
        days: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        id: "demo-pantoprazole",
        name: "Pantoprazole",
        doseText: "40 mg",
        form: "tablet",
        criticality: "low",
        stock: 30,
        times: ["07:30"],
        days: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        id: "demo-vitd",
        name: "Vitamin D3",
        doseText: "60,000 IU",
        form: "capsule",
        criticality: "low",
        stock: 6,
        times: ["10:00"],
        days: [0],
      },
    ];

    for (const med of meds) {
      await prisma.medication.upsert({
        where: { id: med.id },
        create: {
          id: med.id,
          circleId: DEMO_CIRCLE_ID,
          name: med.name,
          doseText: med.doseText,
          form: med.form,
          criticality: med.criticality,
          stock: med.stock,
          unitsPerDose: 1,
          active: true,
          createdAt: twentyDaysAgo,
          schedules: {
            create: {
              timesOfDay: med.times,
              daysOfWeek: med.days,
              startDate: twentyDaysAgo,
            },
          },
        },
        update: {
          name: med.name,
          doseText: med.doseText,
          form: med.form,
          criticality: med.criticality,
          stock: med.stock,
          active: true,
        },
      });
    }

    // 5. Create Appointments
    const appts = [
      {
        id: "demo-appt-cardio",
        circleId: DEMO_CIRCLE_ID,
        doctor: "Dr. Mehta (Cardiologist)",
        place: "City Heart Clinic, Lajpat Nagar",
        startsAt: new Date(now.getTime() + 4 * 86400000),
        reminderOffsets: [1440, 120],
      },
      {
        id: "demo-appt-diab",
        circleId: DEMO_CIRCLE_ID,
        doctor: "Dr. Gupta (Diabetologist)",
        place: "Apollo Hospital, Mathura Road",
        startsAt: new Date(now.getTime() + 18 * 86400000),
        reminderOffsets: [1440, 120],
      },
    ];

    for (const a of appts) {
      await prisma.appointment.upsert({
        where: { id: a.id },
        create: {
          id: a.id,
          circleId: a.circleId,
          doctor: a.doctor,
          place: a.place,
          startsAt: a.startsAt,
          reminderOffsets: a.reminderOffsets,
          createdAt: twentyDaysAgo,
        },
        update: {
          doctor: a.doctor,
          place: a.place,
          startsAt: a.startsAt,
        },
      });
    }

    console.log("Successfully seeded demo data into PostgreSQL!");
  } finally {
    await prisma.$disconnect();
  }
}

runSeed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
