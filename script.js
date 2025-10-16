(async () => {

    document.querySelectorAll(".icon-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    alert("Je hebt geklikt op " + btn.dataset.class);
  });
});

    const tmImageCheck = typeof tmImage !== "undefined";
    if (!tmImageCheck) { alert("Teachable Machine library niet geladen."); return; }

    const URL = "https://melinaa2.github.io/wezentje01/my_model/";


    const images = {
        "Start": "https://melinaa2.github.io/wezentje01/my_images/eyes_start.png",
        "Neutral": "https://melinaa2.github.io/wezentje01/my_images/eyes_neutral.png",
        "Happy": "https://melinaa2.github.io/wezentje01/my_images/eyes_happy.png",
        "Sad": "https://melinaa2.github.io/wezentje01/my_images/eyes_sad.png"
    };

    let model = null, webcam = null;
    const bufferSize = 5, confidenceThreshold = 0.85, holdTime = 1000, displayHoldDuration = 3000, sadAfterMs = 60000;
    const predictionBuffer = {};
    let currentDetectedClass = null, lastFedTime = Date.now(), lastDetectionTime = 0;

    const imageDiv = document.getElementById("image-display");
    const overlay = document.getElementById("overlay");
    const statusText = document.getElementById("status-text");

    imageDiv.innerHTML = `<img src="${images["Start"]}" alt="Start">`;
    statusText.innerText = "Zeg hallo! (startscherm)";

    try {
        webcam = new tmImage.Webcam(400, 300, true, { facingMode: "user" });
        await webcam.setup();
        await webcam.play();
        document.getElementById("webcam-container").appendChild(webcam.canvas);
    } catch(err) { console.warn("Webcam init mislukte:", err); }

    try { model = await tmImage.load(URL + "model.json", URL + "metadata.json"); }
    catch(err){ console.warn("Model kon niet geladen:", err); statusText.innerText="Model niet geladen."; model=null; }

    function showImage(key){ imageDiv.innerHTML=`<img src="${images[key] || images["Neutral"]}" alt="${key}">`; }
    function goNeutral(){ showImage("Neutral"); currentDetectedClass=null; statusText.innerText="Wachten..."; }

    function fedAction(){
        showImage("Happy");
        statusText.innerText="Dank je! 🥕";
        lastFedTime=Date.now();
        currentDetectedClass="Fed";
        lastDetectionTime=Date.now();
        setTimeout(()=>{
            const sinceFed=Date.now()-lastFedTime;
            if(sinceFed>=sadAfterMs){ showImage("Sad"); statusText.innerText="Ik wil eten... 😔"; }
            else{ goNeutral(); }
        }, displayHoldDuration);
    }

    document.querySelectorAll(".icon-btn").forEach(btn=>{
        btn.addEventListener("click",()=>{
            const cls = btn.dataset.class;
            if(cls.toLowerCase().includes("wortel")) { fedAction(); overlay.classList.add("hidden"); }
            else { statusText.innerText=`Gezien: ${cls} (niet eten)`; setTimeout(goNeutral,1500); }
        });
    });

    setInterval(()=>{
        const now = Date.now();
        if(now-lastFedTime>=sadAfterMs){
            const cur=imageDiv.querySelector("img")?.getAttribute("alt");
            if(cur!=="Sad"){ showImage("Sad"); statusText.innerText="Ik mis eten... 😔"; }
        }
    },2000);

    async function loop(){ if(webcam) webcam.update(); if(model && webcam) await predict(); requestAnimationFrame(loop); }

    async function predict(){
        try{
            const prediction = await model.predict(webcam.canvas);
            let highest = prediction.reduce((a,b)=>a.probability>b.probability?a:b);
            const className=highest.className, prob=highest.probability;
            if(!predictionBuffer[className]) predictionBuffer[className]=[];
            predictionBuffer[className].push(prob);
            if(predictionBuffer[className].length>bufferSize) predictionBuffer[className].shift();
            const avgProb = predictionBuffer[className].reduce((a,b)=>a+b,0)/predictionBuffer[className].length;

            if(!overlay.classList.contains("hidden") && avgProb>=confidenceThreshold){ overlay.classList.add("hidden"); }

            if(avgProb>=confidenceThreshold){
                if(className.toLowerCase().includes("wortel")){
                    const now=Date.now();
                    if(!lastDetectionTime) lastDetectionTime=now;
                    if(now-lastDetectionTime>=holdTime){ fedAction(); lastDetectionTime=0; }
                } else { statusText.innerText=`Gezien: ${className} (${(avgProb*100).toFixed(0)}%)`; lastDetectionTime=Date.now(); }
            }
        } catch(err){ console.error("Predict error:", err); }
    }

    loop();
})();

