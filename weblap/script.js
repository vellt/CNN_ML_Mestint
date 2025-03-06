const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

// Beállítjuk a canvas méretét
canvas.width = canvas.parentElement.clientWidth;
canvas.height = canvas.parentElement.clientHeight;

let drawing = false;
let history = []; // Előzmények tárolása

// ** Fehér háttér beállítása **
function setWhiteBackground() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
setWhiteBackground(); // Indításkor állítsuk be

function saveState() {
    history.push(canvas.toDataURL()); // Mentjük az állapotot
}

function startDrawing(e) {
    saveState(); // Mentjük az állapotot az első vonal előtt
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
}

function draw(e) {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();
}

function stopDrawing() {
    drawing = false;
}

// ** Visszavonás funkció **
function undoLast() {
    if (history.length > 0) {
        let lastState = history.pop();
        let img = new Image();
        img.src = lastState;
        img.onload = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setWhiteBackground(); // Visszavonás után fehér háttér biztosítása
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
    }
}

// ** Event listenerek **
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

// ** Törlés gomb **
document.getElementById("clearBtn").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setWhiteBackground(); // Törlés után is fehér háttér biztosítása
    history = []; // Előzményeket is töröljük
    const characters=document.getElementById('characters');
    const parsed_formula=document.getElementById('parsed_formula');
    parsed_formula.textContent=""
    characters.innerHTML='';
});

// ** Mentés gomb (Fehér háttérrel mentés) **
document.getElementById("saveBtn").addEventListener("click", async () => {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    const parsed_formula=document.getElementById('parsed_formula');
    const characters=document.getElementById('characters');

    // Set canvas size
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Fill background with white
    tempCtx.fillStyle = "white";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw the actual content
    tempCtx.drawImage(canvas, 0, 0);

    // Convert canvas to blob
    tempCanvas.toBlob(async (blob) => {
        let formData = new FormData();
        formData.append("image", blob, "drawing.png");

        try {
            let response = await fetch("http://localhost:5000/recognize", {
                method: "POST",
                body: formData
            });

            if (response.ok) {
                let result = await response.json();
                console.log(result);
                parsed_formula.textContent=result.parsed_formula
                characters.innerHTML='';
                result.characters.forEach(element => {
                    characters.innerHTML+=card(element);
                });
            } else {
                alert("Hiba történt a feltöltés során!");
            }
        } catch (error) {
            console.error("Hálózati hiba:", error);
        }
    }, "image/png");
});

function card({image, recognized}){
    return `
        <div class="d-flex my-3">
            <img src="http://localhost:5000/uploads/${image}?t=${Date.now()}" alt="" width="50">
            <input id="${image}" type="text" value="${recognized}" name="" class="form-control fs-3 mx-2 zzz">
            <button onclick="sendCorrection('${image}')" class="btn btn-warning">Javítás</button>
            <div id="${image}${image}" class="mt-3 ms-2 text-secondary"><div>
        </div>
    `;
}

async function sendCorrection(id){
    const element=document.getElementById(id);
    const message=document.getElementById(`${id}${id}`);
    console.log(element.value);

    try {
        const response = await fetch("http://localhost:5000/train", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "image": id,
                "correct_label": element.value
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        message.textContent=data.message;
        console.log("Success:", data);
    } catch (error) {
        console.error("Error:", error);
    }
}


// ** Visszavonás gomb **
document.getElementById("undoBtn").addEventListener("click", undoLast);