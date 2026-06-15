import { spawn } from "node:child_process";

import { saveInteractiveUberSession } from "../lib/integrations/uber-report-downloader";

const DEFAULT_REMOTE = "root@13.140.187.148";
const DEFAULT_REMOTE_APP_DIR = "/var/www/vivounionvtc";

async function main() {
  const remote = getCliValue("--remote") ?? process.env.CONTABO_SSH_TARGET ?? DEFAULT_REMOTE;
  const remoteAppDir = getCliValue("--remote-app") ?? process.env.CONTABO_APP_DIR ?? DEFAULT_REMOTE_APP_DIR;
  const email = getCliValue("--email");

  console.log("Ouverture de Chromium pour Uber Supplier.");
  console.log("Cliquez sur Continuer avec Google, connectez-vous manuellement, puis laissez la page reports se charger.");
  console.log("Aucun mot de passe Google n'est lu ni stocke par ce script.");

  const result = await saveInteractiveUberSession({
    email,
    waitForReportsPage: true,
    timeoutMs: 10 * 60_000,
  });

  console.log(`Session Uber sauvegardee localement: ${result.sessionFile}`);
  console.log(`Cookies sauvegardes: ${result.cookies}`);

  const remoteSessionDir = `${remoteAppDir}/storage`;
  const remoteSessionFile = `${remoteSessionDir}/uber-session.json`;

  await run("ssh", [remote, `mkdir -p ${shellQuote(remoteSessionDir)} && chmod 700 ${shellQuote(remoteSessionDir)}`]);
  await run("scp", [result.sessionFile, `${remote}:${remoteSessionFile}`]);
  await run("ssh", [remote, `chmod 600 ${shellQuote(remoteSessionFile)}`]);

  console.log(`Session Uber transferee sur Contabo: ${remote}:${remoteSessionFile}`);
  console.log("Vous pouvez maintenant cliquer sur Telecharger dernier rapport Uber dans le dashboard.");
}

function getCliValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index >= 0) {
    return process.argv[index + 1];
  }

  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return inline?.slice(name.length + 1);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} a echoue avec le code ${code ?? "inconnu"}.`));
    });
  });
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
