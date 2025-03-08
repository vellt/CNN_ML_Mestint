const tf = require("@tensorflow/tfjs-node");
const { loadImagesFromTrainingData } = require("./training_dataset");
const { CHARACTERS } = require("./train_constants");

/**
 * **Modellt betanítja a kiválasztott dataset alapján**
 */
async function trainModel() {
    console.log("📥 Betöltés: Training dataset...");
    let dataset = await loadImagesFromTrainingData();  

    if (dataset.length === 0) {
        console.log("⚠️ Nincs elérhető adat a tanításhoz.");
        return;
    }

    const images = dataset.map(d => d.tensor);
    const labels = dataset.map(d => d.label);

    const xTrain = tf.stack(images);
    const yTrain = tf.oneHot(tf.tensor1d(labels, "int32"), CHARACTERS.length);

    // **Model felépítése**
    const model = tf.sequential();
    model.add(tf.layers.conv2d({ inputShape: [28, 28, 1], filters: 32, kernelSize: 3, activation: "relu" }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 128, activation: "relu" }));
    model.add(tf.layers.dense({ units: CHARACTERS.length, activation: "softmax" }));

    model.compile({
        optimizer: "adam",
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"]
    });

    console.log("🚀 Kezdődik a tanítás...");
    await model.fit(xTrain, yTrain, { epochs: 5 });

    console.log("✅ Modell betanítva!");

    try {
        await model.save("file://./model");
        console.log("📂 Új modell elmentve!");

    } catch (error) {
        console.error("❌ Hiba a modell mentése során, a training_data NEM lett áthelyezve!", error);
    }
}

trainModel();
