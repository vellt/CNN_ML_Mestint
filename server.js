const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const Jimp = require("jimp");
const tf = require("@tensorflow/tfjs-node");
const math = require("mathjs");
const cors=require("cors")

const app = express();
const port = 5000;

app.use(cors())

// **Fájlfeltöltés beállítása**
const upload = multer({ dest: "uploads/" });

// **TensorFlow modell betöltése**
let model;
(async () => {
    try {
        model = await tf.loadLayersModel("file://model/model.json");
        console.log("✅ Saját betanított modell betöltve!");
    } catch (error) {
        console.error("❌ Hiba a modell betöltése során:", error);
    }
})();

/**
 * **Karakterhatárok detektálása és pontos kivágás (extra 20px fent és lent)**
 */
async function segmentImage(imagePath) {
    try {
        const processedImagePath = path.join(__dirname,"uploads", "processed_image.png");

        // **1️⃣ Kép előfeldolgozása**
        await sharp(imagePath)
            .greyscale()
            .threshold(160) // Küszöbölés fekete-fehér átalakításhoz
            .sharpen()
            .toFile(processedImagePath);

        console.log("✅ Kép előfeldolgozva:", processedImagePath);

        // **2️⃣ Kép betöltése Jimp-pel**
        const image = await Jimp.read(processedImagePath);
        const width = image.bitmap.width;
        const height = image.bitmap.height;

        let columnSums = new Array(width).fill(0);
        let rowSums = new Array(height).fill(0);

        // **3️⃣ Oszloponként és soronként végigmegyünk a képen**
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
                if (pixel.r < 128) { // Ha a pixel fekete
                    columnSums[x]++;
                    rowSums[y]++;
                }
            }
        }

        // **4️⃣ Határok keresése a karakterek között (vízszintesen)**
        let boundaries = [];
        let inChar = false;
        let start = 0;

        for (let x = 0; x < width; x++) {
            if (columnSums[x] > 2) { // Ha van fekete pixel az oszlopban
                if (!inChar) {
                    start = Math.max(x - 60, 0); // Kis ráhagyás balra
                    inChar = true;
                }
            } else {
                if (inChar) {
                    let end = Math.min(x + 60, width); // Kis ráhagyás jobbra
                    if (end - start > 10) { // Ha túl keskeny, ne vágjuk meg
                        boundaries.push({ start, end });
                    }
                    inChar = false;
                }
            }
        }

        // **5️⃣ Karakterek magasságának meghatározása (extra 20px fent és lent)**
        let minY = 0, maxY = height;
        for (let y = 0; y < height; y++) {
            if (rowSums[y] > 2) {
                minY = Math.max(y - 30, 0); // Extra 20px fent
                break;
            }
        }
        for (let y = height - 1; y >= 0; y--) {
            if (rowSums[y] > 2) {
                maxY = Math.min(y + 30, height); // Extra 20px lent
                break;
            }
        }

        // **💡 Ha túl keskeny a bounding box, adjunk minimális magasságot**
        if (maxY - minY < 50) {
            let centerY = (minY + maxY) / 2;
            minY = Math.max(centerY - 25, 0);
            maxY = Math.min(centerY + 25, height);
        }

        // **6️⃣ Debug kép generálása (Piros vonalakkal a határoknál)**
        for (let i = 0; i < boundaries.length; i++) {
            let { end } = boundaries[i];
            for (let y = 0; y < height; y++) {
                image.setPixelColor(Jimp.rgbaToInt(255, 0, 0, 255), end, y);
            }
        }

        const debugImagePath = path.join(__dirname, "uploads", "debug_boundaries.png");
        await image.writeAsync(debugImagePath);
        console.log("✅ Debug kép mentve:", debugImagePath);

        // **7️⃣ Karakterek kivágása (extra 20px fent és lent, minimum magassággal)**
        let extractedChars = [];
        for (let i = 0; i < boundaries.length; i++) {
            let { start, end } = boundaries[i];

            let charWidth = end - start;
            let charImagePath = path.join(__dirname,"uploads",  `char_${i}.png`);
            
            await sharp(processedImagePath)
                .extract({
                    left: Math.max(start, 0),
                    top: minY,
                    width: Math.min(charWidth + 10, width - start), // Extra szélesség
                    height: Math.min(maxY - minY, height) // Extra 20px fent és lent
                })
                .resize(28, 28) // Neurális hálóhoz igazítás
                .toFile(charImagePath);

            extractedChars.push(charImagePath);
        }

        console.log("✅ Kivágott karakterek:", extractedChars);
        return { extractedChars, debugImagePath };

    } catch (error) {
        console.error("❌ Hiba a karakterek kivágása során:", error);
        return { extractedChars: [], debugImagePath: null };
    }
}

/**
 * **Karakterek felismerése a betanított modellel**
 */
async function recognizeCharacter(imagePath) {
    try {
        const imageBuffer = fs.readFileSync(imagePath);
        let tensor = tf.node.decodeImage(imageBuffer)
            .resizeNearestNeighbor([28, 28])
            .mean(2) // Szürkeárnyalatossá konvertálás
            .expandDims(0)
            .expandDims(-1) // Egycsatornás kép (grayscale)
            .toFloat()
            .div(255); // Normalizálás [0,1] közé

        const prediction = model.predict(tensor);
        const predictedIndex = prediction.argMax(1).dataSync()[0];

        const ALLOWED_CHARACTERS = "0123456789+-*/=";
        return ALLOWED_CHARACTERS[predictedIndex] || "?"; // Ha nem található, akkor "?"
    } catch (error) {
        console.error("❌ Hiba a karakter felismerése során:", error);
        return "?";
    }
}

app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// **API végpont a kép feldolgozásához**
app.post("/recognize", upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Nincs feltöltött kép." });
    }

    try {
        const { extractedChars, debugImagePath } = await segmentImage(req.file.path);

        if (extractedChars.length === 0) {
            return res.json({ message: "Nem talált karaktereket a képen." });
        }

        let recognizedText = "";
        let recognizedCharacters = [];

        // **Karakterek felismerése saját modellel**
        for (let i = 0; i < extractedChars.length; i++) {
            let recognizedChar = await recognizeCharacter(extractedChars[i]);
            recognizedText += recognizedChar;
            recognizedCharacters.push({ image: path.basename(extractedChars[i]), recognized: recognizedChar });
        }

        console.log("✅ Felismert kifejezés:", recognizedText);
        

        let parsedFormula;
        try {
            parsedFormula = math.evaluate(recognizedText);
        } catch (err) {
            parsedFormula = "Hibás kifejezés";
        }

        // **Visszaküldjük az eredményt**
        res.json({
            raw_text: recognizedText,
            parsed_formula: parsedFormula,
            characters: recognizedCharacters
        });

        // **Feltöltött fájl törlése**
        fs.unlinkSync(req.file.path);

    } catch (error) {
        console.error("❌ Hiba a feldolgozás során:", error);
        res.status(500).json({ error: "Feldolgozási hiba." });
    }
});

/**
 * **Új tanulási adat hozzáadása**
 */
app.post("/train", express.json(), (req, res) => {
    const { image, correct_label } = req.body;

    if (!image || !correct_label) {
        return res.status(400).json({ error: "Hiányzó adatok a tanításhoz." });
    }

    // **Az uploads mappából keressük meg a fájlt**
    const imagePath = path.join(__dirname, "uploads", image);

    if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ error: "A megadott kép nem található." });
    }

    try {
        // **Új hely a tanulási mappában**
        const trainingPath = path.join("training_data", `${Date.now()}_${correct_label}.png`);

        // **Fájl másolása a tanulási mappába**
        fs.copyFileSync(imagePath, trainingPath);
        console.log(`📝 Tanítási adatokhoz hozzáadva: ${trainingPath}`);

        res.json({ message: "Tanítási adat mentve!", image, correct_label });
    } catch (error) {
        console.error("❌ Hiba a tanítási adat mentése során:", error);
        res.status(500).json({ error: "Nem sikerült menteni a tanításhoz." });
    }
});


// **Szerver indítása**
app.listen(port, () => {
    console.log(`✅ Szerver fut: http://localhost:${port}`);
});
