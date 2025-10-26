import esbuild from "esbuild";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import path from "path";
import fs from "fs";
// import { glob } from "glob";

const banner = `
// patch __dirname
// import { fileURLToPath } from "url";
// import path from "path";
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// allow top level await
import { createRequire as topLevelCreateRequire } from "module";
const require = topLevelCreateRequire(import.meta.url);
`;

const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0 -entry [string] -out [string] -build [string]")
    .option("entry", {
        alias: "e",
        describe: "Entry point file",
        type: "string",
        demandOption: true,
    })
    .option("out", {
        alias: "o",
        describe: "Output file path",
        type: "string",
        demandOption: true,
    })
    .help()
    .alias("help", "h").argv;

// generate a list of all package.json files in the monorepo
function getPackagePaths() {
    // const packagePaths = [];
    // const packageGlob = "package.json";
    // const packageJsonFiles = glob.sync(packageGlob);
    // for (const packageJsonFile of packageJsonFiles) {
    //     packagePaths.push(path.dirname(packageJsonFile) + "/package.json");
    // }
    // return packagePaths;
    return ["package.json"];
}

esbuild
    .build({
        entryPoints: [argv.entry],
        bundle: true,
        outfile: argv.out,
        format: "esm",
        minify: false,
        banner: {
            js: banner,
        },
        platform: "node",
        external: ["body-parser"],
        plugins: [
            nodeExternalsPlugin({
                packagePath: getPackagePaths(),
            }),
        ],
        sourcemap: "inline",
        target: "node24",
    })
    .then(() => {
        console.log("Build completed successfully");
    })
    .catch((error) => {
        console.error("Build failed:", error);
        process.exit(1);
    });
