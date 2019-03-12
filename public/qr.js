function startQRCode() {
    generateQRCode({"u":"Berk Ott","mn":73,"am":"CrossHAB2","at":"middle","as":"true","tc1":0,"tc2":2,"tc3":1,"tp1":2,"tp2":0,"tp3":1,"eg":"climb3","ac":"ss","ec":"vd","dc":"c","c":"xc","pd":"Fri, Mar 8, 2019 6:15 PM","ts":1552086908635,"tn":1683});
}

function generateQRCode(_data, id){
    var typeNumber = 0;
    var errorCorrectionLevel = 'L';
    var qr = qrcode(typeNumber, errorCorrectionLevel);

    data = JSON.stringify(_data);

    console.log("Creating QR Code");
    console.log(data);

    qr.addData(data);
    qr.make();
    document.getElementById(id).innerHTML = qr.createImgTag();
}

function scanQRCode(){
    console.log("pressed");
    document.getElementById("appNavigator").pushPage("pic-qr.html");
}


// let video = document.getElementById("video");
// let canvas = document.getElementById("canvasMain");

// if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
//     // Not adding `{ audio: true }` since we only want video now

//     video.addEventListener('loadedmetadata', function () {
//         console.log(video.videoWidth);
//         console.log(video.videoHeight);
//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//     });
//     navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (stream) {
//         video.src = window.URL.createObjectURL(stream);
//         video.play();
//     }).catch(function (err) {
//         console.error(err);
//     });

//     document.getElementById("snap").onclick = function () {
//         canvas.style.display = "block";
//         var context = canvas.getContext("2d");
//         context.drawImage(video, 0, 0);
//     };
// }
// let btn = document.querySelector("#submit-pic");
// btn.onclick = function (e) {
//     e.preventDefault();
//     canvas.toBlob((blobby) => {

//         btn.querySelector("#submit-load").style.display = "initial";
//         btn.querySelector("#submit-text").style.display = "none";
//         writeImage(blobby, page.data.team).then(downloadURL => {
//             db.ref("pitimgs").child(page.data.team.team_number).child(currentEventKey()).set(downloadURL).then(function () {
//                 btn.querySelector("#submit-load").style.display = "none";
//                 btn.querySelector("#submit-done").style.display = "initial";
//                 btn.style.backgroundColor = "green";
//             });
//         });
//     });

// }

