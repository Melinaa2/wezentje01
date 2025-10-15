(async () => {
    // Controle: tmImage moet geladen zijn
    if (typeof tmImage === "undefined") {
        console.error("tmImage is not loaded! Check your internet connection and script tag.");
        alert("Teachable Machine library niet geladen. Zorg dat je internet hebt.");
        return;
    }

    const URL = "my_model/"; // map met model.json en metadata.json

    // Afbeeldingen voor de ogen / start
    const images = {
        "Start": "my_images/eyes_start.png",
        "Neutral": "my_images/eyes_neutral.png",
        "Happy": "my_images/eyes_happy.png",
        "Sad": "my_images/eyes_sad.png"
    };

    // --- instellingen
    let model = null, webcam = null;
    const bufferSize = 5;
    const confidenceThreshold = 0.85; // aanpasbaar
    const holdTime = 1000; // ms dat de detectie consistent moet zijn
    const displayHoldDuration = 3000; // ms dat we blij beeld laten zien
    const sadAfterMs = 60 * 1000; // 60 seconden geen eten -> somber
    const predictionBuffer = {};
    let currentDetectedClass = null;
    let lastFedTime = Date.now(); // starttijd
    let lastDetectionTime = 0;

    // DOM elementen
    const imageDiv = document.getElementById("image-display");
    const overlay = document.getElementById("overlay");
    const statusText = document.getElementById("status-text");

    // zet startbeeld
    imageDiv.innerHTML = `<img src="${images["Start"]}" alt="Start">`;
    statusText.innerText = "Zeg hallo! (startscherm)";

    // Start webcam (probeer, maar als het faalt kunnen we nog steeds handmatig testen)
    try {
        webcam = new tmImage.Webcam(400, 300, true, { facingMode: "user" });
        await webcam.setup();
        await webcam.play();
        document.getElementById("webcam-container").appendChild(webcam.canvas);
        console.log("Webcam klaar");
    } catch (err) {
        console.warn("Webcam init mislukte:", err);
    }

    // Load model (als het bestaat)
    try {
        model = await tmImage.load(URL + "model.json", URL + "metadata.json");
        console.log("Model geladen");
        statusText.innerText = "Model geladen. Wacht op object...";
    } catch (err) {
        console.warn("Model kon niet geladen worden:", err);
        statusText.innerText = "Model niet geladen (test met knoppen)";
        model = null;
    }

    // Hulpfunctie: toon image
    function showImage(key) {
        const src = images[key] || images["Neutral"];
        imageDiv.innerHTML = `<img src="${src}" alt="${key}">`;
    }

    // Reset naar neutraal (bij opstart en na displayHoldDuration)
    function goNeutral() {
        showImage("Neutral");
        currentDetectedClass = null;
        statusText.innerText = "Wachten...";
    }

    // Als het gevoed is: laat blije ogen en reset timer
    function fedAction() {
        showImage("Happy");
        statusText.innerText = "Dank je! 🥕";
        lastFedTime = Date.now();
        currentDetectedClass = "Fed";
        lastDetectionTime = Date.now();

        // Na korte tijd terug naar neutraal (maar rekening houden met somber timer)
        setTimeout(() => {
            // als inmiddels alweer somber zou moeten zijn, laat sad
            const sinceFed = Date.now() - lastFedTime;
            if (sinceFed >= sadAfterMs) {
                showImage("Sad");
                statusText.innerText = "Ik wil eten... 😔";
            } else {
                goNeutral();
            }
        }, displayHoldDuration);
    }

    // Maak knoppen klikbaar (voor testen / voor kind)
    document.querySelectorAll(".icon-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cls = btn.dataset.class; // bijv "Wortel" of "Appel"
            // Simuleer: als het een eetbaar ding is -> voer actie
            // Hier gaan we uit van dat "Wortel" eten is.
            if (cls === "Wortel" || cls.toLowerCase().includes("wortel") || cls.toLowerCase().includes("eat")) {
                fedAction();
                overlay.classList.add("hidden"); // verberg startkaart
            } else {
                // Als niet-eten: toon kort neutraal/geen verandering
                statusText.innerText = `Gezien: ${cls} (niet eten)`;
                setTimeout(goNeutral, 1500);
            }
        });
    });

    // Controleer elke seconde of we somber moeten zijn (geen voeding)
    setInterval(() => {
        const now = Date.now();
        if (now - lastFedTime >= sadAfterMs) {
            // alleen wisselen als we nog niet somber zijn
            const cur = imageDiv.querySelector("img")?.getAttribute("alt");
            if (cur !== "Sad") {
                showImage("Sad");
                statusText.innerText = "Ik mis eten... 😔";
            }
        }
    }, 2000);

    // Voorspellingsloop (webcam + model)
    async function loop() {
        if (webcam) webcam.update();
        if (model && webcam) await predict();
        requestAnimationFrame(loop);
    }

    async function predict() {
        try {
            const prediction = await model.predict(webcam.canvas);
            // neem hoogste
            let highest = prediction.reduce((a,b) => a.probability > b.probability ? a : b);
            const className = highest.className;
            const prob = highest.probability;

            if (!predictionBuffer[className]) predictionBuffer[className] = [];
            predictionBuffer[className].push(prob);
            if (predictionBuffer[className].length > bufferSize) predictionBuffer[className].shift();
            const avgProb = predictionBuffer[className].reduce((a,b) => a+b, 0)/predictionBuffer[className].length;

            // Als startkaart nog zichtbaar: verberg als detectie sterk is (contact)
            if (!overlay.classList.contains("hidden") && avgProb >= confidenceThreshold) {
                overlay.classList.add("hidden");
            }

            // alleen handelen bij voldoende zekerheid
            if (avgProb >= confidenceThreshold) {
                // we gaan ervan uit dat jouw model een class heeft die staat voor 'wortel' of 'food'
                // VERVANG hieronder "Wortel" door de exacte naam van de class uit jouw model als nodig.
                if (className === "Wortel" || className.toLowerCase().includes("wortel") || className.toLowerCase().includes("carrot")) {
                    const now = Date.now();
                    // houd consistentie (holdTime)
                    if (!lastDetectionTime) lastDetectionTime = now;
                    if (now - lastDetectionTime >= holdTime) {
                        fedAction();
                        lastDetectionTime = 0;
                    }
                } else {
                    // andere class: toon kort dat iets is herkend
                    statusText.innerText = `Gezien: ${className} (${(avgProb*100).toFixed(0)}%)`;
                    lastDetectionTime = Date.now();
                }
            } else {
                // onvoldoende zekerheid -> niets doen
            }
        } catch (err) {
            console.error("Predict error:", err);
        }
    }

    loop();
})();
