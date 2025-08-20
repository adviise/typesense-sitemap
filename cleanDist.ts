import fs from 'fs-extra';

async function main() {
    await fs.remove('./dist');
}

main();
