const api="http://localhost:5000";

document.getElementById("saveBtn").addEventListener("click", async () => {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.drawImage(canvas, 0, 0);
    
    tempCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append("image", blob, "drawing.png");
    
        try {
            const response = await fetch(`${api}/recognize`, { method: "POST", body: formData });
            if (!response.ok) throw new Error("Hiba történt a feltöltés során!");
            
            const result = await response.json();
            parsed_formula.textContent = `${result.raw_text} = ${result.parsed_formula}`;
            characters.innerHTML='';
            result.characters.forEach(element => {
                characters.innerHTML+=card(element);
            });
        } catch (error) {
            console.error("Hálózati hiba:", error);
            alert(error.message);
        }
    }, "image/png");
});

function card({image, recognized}){
    return `
        <div class="col">
            <div class="d-flex my-3">
                <img src="${api}/uploads/${image}?t=${Date.now()}" alt="" width="50">
                <input id="${image}" type="text" value="${recognized}" name="" class="form-control fs-3 mx-2">
                <button onclick="sendCorrection('${image}')" class="btn btn-dark">Tanítás</button>
            </div>
            <div id="${image}${image}" class="mt-3 ms-2 fs-4 text-light"><div>
        </div>
    `;
}

async function sendCorrection(id){
    const element=document.getElementById(id);
    const message=document.getElementById(`${id}${id}`);
    console.log(element.value);

    try {
        const response = await fetch(`${api}/train`, {
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


