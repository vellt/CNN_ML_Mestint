const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const tf = require("@tensorflow/tfjs-node");
const math = require("mathjs");
const cors=require("cors")
const { segmentImage } = require("./imageProcessing");
const { CHARACTERS } = require("./train_constants");

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
 * **Karakterek felismerése a betanított modellel**
 */
async function recognizeCharacter(imagePath) {
    try {
        const imageBuffer = fs.readFileSync(imagePath);
        let tensor = tf.node.decodeImage(imageBuffer,1) // kép átalakítása 1 csatornássá
            .toFloat().div(255) // Normalizálás [0,1] közötti számokkal
            .expandDims(); // (1,28,28,1) alakra hozás

        const prediction = model.predict(tensor);
        const predictedIndex = prediction.argMax(1).dataSync()[0];
        
        return CHARACTERS[predictedIndex] || "?"; // Ha nem található, akkor "?"
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
        const { extractedChars } = await segmentImage(req.file.path);

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
    const { image: imageName, correct_label } = req.body;

    if (!imageName || !correct_label) {
        return res.status(400).json({ error: "Hiányzó adatok a tanításhoz." });
    }

    // **Az uploads mappából keressük meg a fájlt**
    const imagePath = path.join(__dirname, "uploads", imageName);

    if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ error: "A megadott kép nem található." });
    }

    try {
        // **Új hely a tanulási mappában**
        const trainingPath = path.join("training_data", `${Date.now()}_${correct_label}.png`);

        // **Fájl másolása a tanulási mappába**
        fs.copyFileSync(imagePath, trainingPath);
        console.log(`📝 Tanítási adatokhoz hozzáadva: ${trainingPath}`);

        res.json({ message: "Tanítási adat mentve!", image: imageName, correct_label });
    } catch (error) {
        console.error("❌ Hiba a tanítási adat mentése során:", error);
        res.status(500).json({ error: "Nem sikerült menteni a tanításhoz." });
    }
});


// **Szerver indítása**
app.listen(port, () => {
    console.log(`✅ Szerver fut: http://localhost:${port}`);
});
