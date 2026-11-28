import "dotenv/config";
import { parseArgs } from "node:util";
import { env } from "../config/env.js";
import Book from "../modules/books/book.model.js";
import DigitalBookOrder from "../modules/orders/order.model.js";
import DigitalBookPaymentAttempt from "../modules/orders/payment-attempt.model.js";
import prepareTestCheckout from "../modules/orders/test-checkout.service.js";
import User from "../modules/users/user.model.js";

import { sandboxCatalogueId as catalogueId, withRazorpaySandbox } from "./razorpay-sandbox.js";

const title = { en: "Sandbox eBook", gu: "સૅન્ડબૉક્સ ઇબુક", hi: "सैंडबॉक्स ईबुक" };
const description = {
  en: "Sample listing for Razorpay test orders.",
  gu: "રેઝરપે ટેસ્ટ ઓર્ડર માટેનું નમૂનાનું પુસ્તક.",
  hi: "रेज़रपे टेस्ट ऑर्डर के लिए नमूना पुस्तक।",
};

async function prepareSandboxOrder() {
  const { values } = parseArgs({
    options: {
      "test-database": { type: "string" },
      "reader-email": { type: "string" },
      "idempotency-key": { type: "string" },
      "referral-code": { type: "string" },
    },
  });

  const database = values["test-database"]?.trim();
  const email = values["reader-email"]?.trim().toLowerCase();
  const idempotencyKey = values["idempotency-key"];
  const referralCode = values["referral-code"];
  if (!database || !email || !idempotencyKey) {
    throw new Error("--test-database, --reader-email and --idempotency-key are required.");
  }
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128 || idempotencyKey.trim() !== idempotencyKey) {
    throw new Error("The idempotency key must have 16–128 characters without surrounding spaces.");
  }
  if (referralCode !== undefined && (!referralCode || referralCode.length > 80 || referralCode.trim() !== referralCode)) {
    throw new Error("Enter a valid referral code without surrounding spaces.");
  }

  await withRazorpaySandbox(database, async () => {
    const buyer = await User.findOne({
      email, role: "reader", accountStatus: "active", emailVerifiedAt: { $type: "date" },
    }).select("_id").lean();
    if (!buyer) {
      throw new Error("No active, verified reader was found in the sandbox database.");
    }

    await Promise.all([Book, DigitalBookOrder, DigitalBookPaymentAttempt].map(model => model.createIndexes()));
    await Book.findOneAndUpdate({ catalogueId }, {
      $setOnInsert: {
        catalogueId, title, description, price: 100, availableForSale: true, language: "Gujarati",
        author: "Rasbhav Books", category: "Novel", tone: "sage", badge: "Sandbox",
      },
    }, { upsert: true, runValidators: true, setDefaultsOnInsert: true, timestamps: false });

    const checkout = await prepareTestCheckout({
      mode: env.razorpayMode, buyerId: buyer._id, bookId: catalogueId, idempotencyKey, referralCode,
    });
    const order = await DigitalBookOrder.findById(checkout.orderId).lean();
    console.info(JSON.stringify({
      ...checkout,
      gstPaise: order.gstPaise,
      gatewayFeePaise: order.gatewayFeePaise,
      authorSharePaise: order.authorPricePaise,
      platformSharePaise: order.platformCommissionPaise,
      referralSharePaise: order.referrerRewardPaise,
    }, null, 2));
  });
}

prepareSandboxOrder().catch((error) => {
  const message = error.name === "Error" && error.code === undefined
    ? error.message
    : String(error.code ?? error.name);
  console.error("Razorpay sandbox order failed.", message);
  process.exitCode = 1;
});
