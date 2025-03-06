const fs = require("fs");
const path = require("path");
const tf = require("@tensorflow/tfjs-node");
const { createCanvas, loadImage } = require("canvas");
const Jimp = require("jimp");

const TRAINING_PATH = "./training_data";  
const IMAGE_SIZE = 28;

const FIXED_CLASSES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "-"]; 
const NUM_CLASSES = FIXED_CLASSES.length;

/**
 * **Kép augmentáció (forgatás, elmosás)**
 */
async function augmentImage(image) {
    let augmentedImages = [];

    // 1️⃣ Eredeti kép mentése
    augmentedImages.push(image.clone());

    // 2️⃣ Forgatás (±15 fok)
    let rotatedClockwise = image.clone().rotate(15); // Jobbra forgatás
    let rotatedCounterClockwise = image.clone().rotate(-15); // Balra forgatás
    augmentedImages.push(rotatedClockwise);
    augmentedImages.push(rotatedCounterClockwise);

    // 3️⃣ Elmosás (Gaussian blur)
    let blurred = image.clone().blur(1);
    augmentedImages.push(blurred);

    return augmentedImages;
}

/**
 * **Képek betöltése és augmentálása**
 */
async function loadImagesFromTrainingData() {
    let dataset = [];
    console.log("📥 Manuális tanítási adatok betöltése...");

    const trainingFiles = fs.readdirSync(TRAINING_PATH);

    for (const file of trainingFiles) {
        if (file.endsWith(".png")) {
            const character = file.split('_').pop().split('.')[0]; // Karakter kinyerése

            if (!FIXED_CLASSES.includes(character)) {
                console.warn(`⚠️ Figyelmeztetés: Ismeretlen címke "${character}" a fájlban: ${file}`);
                continue;
            }

            const label = FIXED_CLASSES.indexOf(character); // Fix osztály indexelése

            // **Eredeti kép betöltése Jimp-pel**
            const jimpImage = await Jimp.read(path.join(TRAINING_PATH, file));

            // **Augmentáció alkalmazása**
            const augmentedImages = await augmentImage(jimpImage);

            for (const augImage of augmentedImages) {
                // **Kép átalakítása TensorFlow formátumra**
                const canvas = createCanvas(IMAGE_SIZE, IMAGE_SIZE);
                const ctx = canvas.getContext("2d");

                const buffer = await augImage.getBufferAsync(Jimp.MIME_PNG);
                const loadedImage = await loadImage(buffer);
                ctx.drawImage(loadedImage, 0, 0, IMAGE_SIZE, IMAGE_SIZE);

                const imageData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;
                const grayscaleData = new Float32Array(IMAGE_SIZE * IMAGE_SIZE);

                for (let i = 0; i < grayscaleData.length; i++) {
                    grayscaleData[i] = imageData[i * 4] / 255;
                }

                dataset.push({ tensor: tf.tensor(grayscaleData, [IMAGE_SIZE, IMAGE_SIZE, 1]), label });
            }
        }
    }

    console.log(`📊 Betöltött training dataset mérete (eredeti + augmentált): ${dataset.length} kép`);
    return dataset;
}

module.exports = { loadImagesFromTrainingData, NUM_CLASSES };
