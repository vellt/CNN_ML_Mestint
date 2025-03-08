const fs = require("fs");
const path = require("path");
const tf = require("@tensorflow/tfjs-node");
const Jimp = require("jimp");
const { CHARACTERS  } = require("./train_constants");

const TRAINING_PATH = "./training_data";  



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

            if (!CHARACTERS.includes(character)) {
                console.warn(`⚠️ Figyelmeztetés: Ismeretlen címke "${character}" a fájlban: ${file}`);
                continue;
            }

            const label = CHARACTERS.indexOf(character); // label készítése

            // **Eredeti kép betöltése Jimp-pel**
            const jimpImage = await Jimp.read(path.join(TRAINING_PATH, file));

            // **Augmentáció alkalmazása**
            const augmentedImages = await augmentImage(jimpImage);

            for (const augImage of augmentedImages) {
                // Kép beolvasása és átalakítása TensorFlow formátumra
                const buffer = await augImage.getBufferAsync(Jimp.MIME_PNG);
                let tensor = tf.node.decodeImage(buffer,1) // 1 = grayscale formátum közvetlenül
                    .resizeNearestNeighbor([28, 28]) 
                    .toFloat() .div(255) // Normalizálás 0-1 közé
            
                dataset.push({ tensor, label });
            }
        }
    }

    console.log(`📊 Betöltött training dataset mérete (eredeti + augmentált): ${dataset.length} kép`);
    return dataset;
}

module.exports = { loadImagesFromTrainingData };
