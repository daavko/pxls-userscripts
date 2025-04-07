import * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';

// first argument is the filename (e.g., 'src/scripts/my-script.user.ts')
const filename = process.argv[2];

if (!filename) {
    console.error('Usage: node build.js <filename>');
    process.exit(1);
}

// gather the rest of the arguments
const args = process.argv.slice(3);
const options = {
    minify: true,
    sourcemap: false,
    watch: false,
};

for (const arg of args) {
    if (arg === '--no-minify') {
        options.minify = false;
    } else if (arg === '--sourcemap') {
        options.sourcemap = true;
    } else if (arg === '--watch') {
        options.watch = true;
    } else {
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
}

// banner file is derived from the filename (e.g., 'src/scripts/my-script.user.ts' => 'src/scripts/my-script.banner.txt')
const bannerFilename = filename.replace(/\.user\.ts$/, '.banner.txt');

// read the banner file (Node.js)
let banner;
try {
    banner = await readFile(bannerFilename, 'utf-8');
} catch (e) {
    console.error(`Error reading banner file: ${bannerFilename}`);
    console.error(e);
    process.exit(1);
}

const esbuildOptions = {
    entryPoints: [filename],
    bundle: true,
    minify: options.minify,
    outdir: 'dist',
    banner: {
        js: banner,
    },
    sourcemap: options.sourcemap ? 'inline' : false,
};

// build the script using esbuild
if (options.watch) {
    console.log(`Watching ${filename}...`);
    const plugins = [
        {
            name: 'watch-plugin',
            setup(build) {
                build.onStart(() => {
                    console.log('Building...');
                });
                build.onEnd(() => {
                    console.log('Build complete.');
                });
            },
        },
    ];
    const context = await esbuild.context({
        ...esbuildOptions,
        plugins,
    });
    await context.rebuild();
    console.log('Watching for changes...');
    await context.watch();
} else {
    console.log(`Building ${filename}...`);
    await esbuild.build({
        ...esbuildOptions,
    });
    console.log(`Build complete. Output in 'dist' directory.`);
}
