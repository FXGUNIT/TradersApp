import { createHash } from "node:crypto";

const DEFAULT_MASTER_SALT = "TR_SECURITY_SALT_2024_REGIMENT";

const getArgValue = (flagName) => {
  const match = process.argv.find((arg) => arg.startsWith(`${flagName}=`));
  return match ? match.slice(flagName.length + 1) : "";
};

const hashAdminPassword = (password, salt) =>
  createHash("sha256").update(`${password}${salt}`).digest("hex");

const readFromStdin = async () => {
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
};

const readHiddenPassword = (promptText) =>
  new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      resolve("");
      return;
    }

    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = "";

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    const onData = (chunk) => {
      const key = String(chunk);

      if (key === "\u0003") {
        cleanup();
        reject(new Error("Cancelled."));
        return;
      }

      if (key === "\r" || key === "\n") {
        stdout.write("\n");
        cleanup();
        resolve(value.trim());
        return;
      }

      if (key === "\u0008" || key === "\u007f") {
        value = value.slice(0, -1);
        return;
      }

      value += key;
    };

    stdout.write(promptText);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
  });

const main = async () => {
  const customSalt =
    getArgValue("--salt") ||
    process.env.MASTER_SALT ||
    process.env.VITE_MASTER_SALT ||
    "";
  const salt = customSalt || DEFAULT_MASTER_SALT;
  const passwordFromArg = process.argv[2]?.startsWith("--")
    ? ""
    : process.argv[2] || "";
  const password =
    process.env.ADMIN_PASSWORD_PLAIN ||
    passwordFromArg ||
    (await readFromStdin()) ||
    (await readHiddenPassword("Admin password: "));

  if (!password) {
    throw new Error(
      "No password provided. Pass it as the first argument, pipe stdin, set ADMIN_PASSWORD_PLAIN, or enter it interactively.",
    );
  }

  const hash = hashAdminPassword(password, salt);

  console.log("");
  console.log("Admin password hash generated.");
  console.log("");
  console.log(`BFF_ADMIN_PASS_HASH=${hash}`);
  if (customSalt) {
    console.log(`MASTER_SALT=${salt}`);
  } else {
    console.log(`# MASTER_SALT is using the default: ${DEFAULT_MASTER_SALT}`);
  }
  console.log("");
  console.log("Store these in Infisical for the BFF runtime.");
};

main().catch((error) => {
  console.error(error.message || "Failed to generate admin password hash.");
  process.exit(1);
});
