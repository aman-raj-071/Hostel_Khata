import { createDb } from "../src/db.js";
import { equalSplit, toPaise } from "../src/money.js";
import { indiaToday } from "../src/parser.js";

const db = createDb();
try {
  const code = process.env.GROUP_CODE || "flat-302";
  if (await db.group.findUnique({ where: { code } })) {
    console.log("Group already exists; seed skipped to preserve user data.");
  } else {
    await db.$transaction(async (tx) => {
      const group = await tx.group.create({ data: { name: "Flat 302", code } });
      const names = ["Kabir", "Aman", "Riya", "Dev", "Sneha"];
      const upis = [
        "kabir@okaxis",
        "aman.raj@ybl",
        "riya99@oksbi",
        "dev@okhdfcbank",
        "sneha@paytm",
      ];
      const members = [];
      for (let i = 0; i < names.length; i++)
        members.push(
          await tx.member.create({ data: { groupId: group.id, name: names[i]!, upiId: upis[i]! } }),
        );
      const all = [0, 1, 2, 3, 4];
      const rows: [number, number, string, string, number, number[], string][] = [
        [0, 150, "Chai aur samosa", "food", 13, all, "Kabir ne sabke liye chai samosa liya 150"],
        [1, 999, "WiFi bill (Airtel)", "utilities", 12, all, "Wifi ka bill 999 Aman ne bhara"],
        [2, 1100, "Gas cylinder", "utilities", 11, all, "Riya ne cylinder 1100 ka liya"],
        [
          3,
          840,
          "Swiggy biryani",
          "food",
          10,
          [0, 1, 3],
          "Dev ne biryani mangayi 840 Kabir Aman ke saath",
        ],
        [4, 336, "Doodh (week)", "groceries", 9, all, "Sneha doodh laayi 336"],
        [
          1,
          600,
          "Dinner at Dhaba",
          "food",
          8,
          [1, 2, 4],
          "Aman ne 600 ka dinner kiya Riya Sneha ke saath",
        ],
        [
          0,
          450,
          "Auto to station",
          "travel",
          7,
          [0, 3, 4],
          "Kabir ne auto 450 diya Dev Sneha ke saath",
        ],
        [
          2,
          120,
          "Raat ki maggi",
          "food",
          5,
          [0, 2, 3, 4],
          "Raat ko maggi 120 Riya ne li Aman nahi tha",
        ],
        [
          4,
          780,
          "Big Basket groceries",
          "groceries",
          4,
          all,
          "Sneha ne sabke liye groceries 780 ki",
        ],
        [3, 250, "Bijli recharge", "utilities", 3, all, "Dev ne bijli recharge 250 kiya"],
        [
          0,
          520,
          "Zomato pizza",
          "food",
          2,
          [0, 1, 2, 3],
          "Kabir ne pizza 520 mangaya Sneha nahi thi",
        ],
        [1, 200, "Paani ke cans", "utilities", 1, all, "Aman ne paani 200 ka liya"],
      ];
      for (const [payer, amount, description, category, days, people, rawText] of rows) {
        const payerId = members[payer]!.id;
        const date = new Date(indiaToday() + "T12:00:00Z");
        date.setUTCDate(date.getUTCDate() - days);
        await tx.expense.create({
          data: {
            groupId: group.id,
            payerId,
            amountPaise: toPaise(amount),
            description,
            category,
            date: date.toISOString().slice(0, 10),
            rawText,
            shares: {
              create: equalSplit(
                toPaise(amount),
                people.map((i) => members[i]!.id),
                payerId,
              ),
            },
          },
        });
      }
    });
    console.log(
      "Seeded Flat 302: 5 members and 12 expenses. UPI IDs are examples, not verified payment addresses.",
    );
  }
} finally {
  await db.$disconnect();
}
