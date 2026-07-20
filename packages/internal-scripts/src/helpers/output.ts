/**
 * Output sink for scripts run via `bun run --filter`, which prefixes stdout
 * with a package label. Write to `outFile` when set (the workflow points it at a
 * temp file it reads back); otherwise print to stdout for local runs.
 */
export async function writeOutput({
  outFile,
  content,
}: {
  outFile: string | undefined;
  content: string;
}) {
  if (outFile) {
    await Bun.write(outFile, content);
  } else {
    console.log(content);
  }
}
