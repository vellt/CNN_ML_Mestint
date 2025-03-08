const sharp = require("sharp");
const Jimp = require("jimp");
const path = require("path");

/**
 * **Karakterhatárok detektálása és pontos kivágás (extra 20px fent és lent)**
 */
async function segmentImage(imagePath) {
    try {
        const processedImagePath = path.join(__dirname, "uploads", "processed_image.png");

        await sharp(imagePath)
            .greyscale()
            .threshold(160)
            .sharpen()
            .toFile(processedImagePath);

        console.log("✅ Kép előfeldolgozva");

        const image = await Jimp.read(processedImagePath);
        const width = image.bitmap.width;
        const height = image.bitmap.height;

        let columnSums = new Array(width).fill(0);
        let rowSums = new Array(height).fill(0);

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
                if (pixel.r < 128) {
                    columnSums[x]++;
                    rowSums[y]++;
                }
            }
        }

        let boundaries = [];
        let inChar = false;
        let start = 0;

        for (let x = 0; x < width; x++) {
            if (columnSums[x] > 2) {
                if (!inChar) {
                    start = Math.max(x - 60, 0);
                    inChar = true;
                }
            } else {
                if (inChar) {
                    let end = Math.min(x + 60, width);
                    if (end - start > 10) {
                        boundaries.push({ start, end });
                    }
                    inChar = false;
                }
            }
        }

        let extractedChars = [];
        for (let i = 0; i < boundaries.length; i++) {
            let { start, end } = boundaries[i];
            let charWidth = end - start;
            let charImagePath = path.join(__dirname, "uploads", `char_${i}.png`);

            await sharp(processedImagePath)
                .extract({
                    left: Math.max(start, 0),
                    top: 0,
                    width: Math.min(charWidth + 10, width - start),
                    height: height
                })
                .resize(28, 28)
                .toFile(charImagePath);

            extractedChars.push(charImagePath);
        }

        return { extractedChars };

    } catch (error) {
        console.error("❌ Hiba a karakterek kivágása során:", error);
        return { extractedChars: [] };
    }
}

module.exports = { segmentImage };