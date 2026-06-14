import { saveInteractiveUberSession } from "../lib/integrations/uber-report-downloader";

async function main() {
  const email = getCliValue("--email") ?? process.env.UBER_LOGIN_EMAIL;
  const result = await saveInteractiveUberSession({
    email,
  });

  console.log(`Session Uber sauvegardee: ${result.sessionFile}`);
  console.log(`Cookies sauvegardes: ${result.cookies}`);
}

function getCliValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index >= 0) {
    return process.argv[index + 1];
  }

  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return inline?.slice(name.length + 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
