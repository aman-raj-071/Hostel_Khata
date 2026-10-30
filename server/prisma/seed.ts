import { createDb } from "../src/db.js";
import { equalSplit, toPaise } from "../src/money.js";
import { indiaToday } from "../src/parser.js";

const db = createDb();
try {
  const code = process.env.GROUP_CODE || "flat-302";
  await db.$transaction(
    async (tx) => {
      const group = await tx.group.upsert({
        where: { code },
        update: {},
        create: { name: "Flat 302", code },
      });
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
          await tx.member.upsert({
            where: { groupId_name: { groupId: group.id, name: names[i]! } },
            update: {},
            create: { groupId: group.id, name: names[i]!, upiId: upis[i]! },
          }),
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
        [
          0,
          6200,
          "Month-start house supplies",
          "groceries",
          29,
          all,
          "Kabir ne ghar ka samaan 6200 ka liya sabke liye",
        ],
        [1, 100, "Tapri chai", "food", 28, all, "Aman ne tapri chai 100 ki sabko pilayi"],
        [2, 80, "Coffee after class", "food", 27, [1, 2], "Riya ne Aman ke saath coffee 80 ki"],
        [0, 3500, "Gang dinner", "food", 26, all, "Kabir ne poori gang ka dinner 3500 pay kiya"],
        [4, 240, "Sabzi mandi", "groceries", 25, all, "Sneha sabzi 240 ki laayi sabke liye"],
        [
          3,
          180,
          "Auto from campus",
          "travel",
          24,
          [0, 3, 4],
          "Dev ne auto 180 diya Kabir Sneha ke saath",
        ],
        [1, 125, "Chai break", "food", 23, all, "Aman ne sabke liye chai 125 ki li"],
        [2, 450, "Atta and dal", "groceries", 22, all, "Riya ne atta dal 450 ka liya sabke liye"],
        [
          0,
          800,
          "Cleaning supplies",
          "other",
          21,
          all,
          "Kabir ne cleaning ka samaan 800 ka liya sabke liye",
        ],
        [4, 220, "Breakfast poha", "food", 20, all, "Sneha ne poha 220 ka mangaya sabke liye"],
        [1, 100, "Evening chai", "food", 18, all, "Aman ne shaam ki chai 100 pay ki sabke liye"],
        [
          3,
          450,
          "Ola to movie",
          "travel",
          16,
          [1, 2, 3],
          "Dev ne Ola 450 pay ki Aman Riya ke saath",
        ],
        [
          2,
          399,
          "Shared extension board",
          "other",
          0,
          all,
          "Riya ne extension board 399 ka liya sabke liye",
        ],
      ];
      for (const [
        index,
        [payer, amount, description, category, days, people, rawText],
      ] of rows.entries()) {
        if (await tx.expense.findFirst({ where: { groupId: group.id, rawText } })) continue;
        const payerId = members[payer]!.id;
        const date = new Date(indiaToday() + "T12:00:00Z");
        date.setUTCDate(date.getUTCDate() - days);
        await tx.expense.upsert({
          where: { id: `demo-${group.id}-${index}` },
          update: {},
          create: {
            id: `demo-${group.id}-${index}`,
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
    },
    { timeout: 60000 },
  );
  console.log(
    "Seeded Flat 302: 5 members and 25 expenses over 30 days. Existing data preserved. UPI IDs are examples, not verified payment addresses.",
  );
} finally {
  await db.$disconnect();
}
