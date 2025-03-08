const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

canvas.width = canvas.parentElement.clientWidth;
canvas.height = canvas.parentElement.clientHeight;

let drawing = false;
let history = []; // Rajz előzmények

// **Alapértelmezett fehér háttér**
function clearCanvas() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
clearCanvas(); // Indításkor

// **Állapot mentése visszavonáshoz**
function saveState() {
    history.push(canvas.toDataURL());
}

// **Rajzolás kezelése**
canvas.addEventListener("mousedown", (e) => {
    saveState();
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener("mousemove", (e) => {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();
});

canvas.addEventListener("mouseup", () => (drawing = false));
canvas.addEventListener("mouseleave", () => (drawing = false));

// **Visszavonás funkció**
function undoLast() {
    if (!history.length) return;
    const img = new Image();
    img.src = history.pop();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

// **Törlés funkció**
function clearAll() {
    clearCanvas();
    history = [];
    document.getElementById("characters").innerHTML = "";
    document.getElementById("parsed_formula").textContent = "";
}

// **Gombok eseménykezelői**
document.getElementById("clearBtn").addEventListener("click", clearAll);
document.getElementById("undoBtn").addEventListener("click", undoLast);
