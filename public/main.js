'use strict';


// import * as firebase from "firebase";

var config = {
    apiKey: "AIzaSyAyrHz96bV4nR3SoyMsyPQ__MdOrYHdaEk",
    authDomain: "scouting-data.firebaseapp.com",
    databaseURL: "https://scouting-data.firebaseio.com/",
    storageBucket: "gs://scouting-data.appspot.com"
};

firebase.initializeApp(config);
console.log('fb conslog', firebase);
var db = firebase.database();
var storage = firebase.storage().ref();

//change event code back to dalton or whatever the f***
var state = '', eventCode = 'tur', year = 2019; // todo determine eventcode by date
// var state = 'ga', eventCode = 'for', year = 2019;
var currentEventKey = () => year + state + eventCode;
var eventCodes = { 'Gainesville': 'gai', 'Turing': 'tur', 'Peachtree': 'cmp', 'Albany': 'alb', 'Columbus': 'col', 'GRITS': 'gr' };
var allTeams = [];
// var allTeamElems = [];
var allBusyTeams = {};
var allBusyTeamsBuffer = [];
var allTeamData = null;
var teamDataDirty = true;
var teamListDirty = true;
var matchListDirty = true;
var allScouters = {};
var allTeamPicURLs = {};

// team pic structure {
// <team_num>: ['<link1>', '<link2>'], ...
// }

var writeScoutingData = function (data, isPit) {
    if (!data) {
        console.log('tried to send invalid data');
        return;
    }
    console.log('sent data for team' + data.teamName, data);
    return db.ref("data").child(data.teamNum.toString()).child(currentEventKey()).child(isPit ? 'pit' : 'match').push().set(data);
};

var imageProgress = -1;

var writeImage = function (blob, team) {
    var metadata = {
        contentType: blob.type,
        team: team.teamNum
    };
    console.log('team is', team);
    if (!blob) {
        console.log('No image! WTF r u doin boi');
    }
    var upload = storage.child('images/' + team.team_number + '_' + moment().format("YYYY_MM_DD-HH-mm-ss-" + Math.random().toString().slice(2))
    ).put(blob, metadata);
    console.log(upload);
    return new Promise((resolve, reject) => {
        upload.on(firebase.storage.TaskEvent.STATE_CHANGED, // or 'state_changed'
            function (snapshot) {
                // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
                imageProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + imageProgress + '% done');
                switch (snapshot.state) {
                    case firebase.storage.TaskState.PAUSED: // or 'paused'
                        console.log('Upload is paused');
                        break;
                    case firebase.storage.TaskState.RUNNING: // or 'running'
                        console.log('Upload is running');
                        break;
                }
            }, function (error) {

                // A full list of error codes is available at
                // https://firebase.google.com/docs/storage/web/handle-errors
                console.log("Error uploading: ", error)
                reject(error);
            }, function () {
                // Upload completed successfully, now we can get the download URL
                resolve(upload.snapshot.downloadURL);
            });
    });
};


var getPrettyTimestamp = function () {
    return moment.unix(Date.now() / 1000).format('llll');
};

var writeSessionData = function (teamNum) {
    var data = {};
    var currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        console.log("Error: no user signed in");
        return;
    }
    data.username = currentUser.displayName;
    data.timestamp = getPrettyTimestamp();
    data.unix = Date.now();
    data.teamNum = teamNum;
    var tm = db.ref('current-scouting').child("Team " + teamNum);
    return Promise.all([tm.onDisconnect().remove(), tm.set(data)]);
};

var removeSessionData = function (teamNum) {
    return db.ref('current-scouting').child(`Team ${teamNum}`).remove();
};


var getTeams = function () {
    if (allTeams.length > 0 && !teamListDirty) return Promise.resolve(allTeams);
    return axios({
        method: 'get',
        url: `https://www.thebluealliance.com/api/v3/event/${currentEventKey()}/teams/simple`,
        headers: { 'X-TBA-Auth-Key': 'S59CP2qkqLt0DuimRWKRByClsvqzgib2lyCJAUhIfdb59Mmxd54WAcK0B2vs6D0e' }
    }).then(function (response) {
        teamListDirty = false;
        allTeams = response.data;
        if (eventCode == 'gr' && !_.find(allTeams, key => key.team_number === 1311)) {
            // kell joined
            allTeams.push({
                city: "idk",
                country: "USA",
                key: "frc832",
                name: "lol Oscar idk",
                nickname: "Oscar",
                state_prov: "Georgia",
                team_number: 832
            });
        }
        return response.data;
    });
};

var getMatches = function (teamNum) {
    return axios({
        method: 'get',
        url: "https://www.thebluealliance.com/api/v3/" + (teamNum ? `team/frc${teamNum}/` : "") + `event/${currentEventKey()}/matches`,
        headers: { 'X-TBA-Auth-Key': 'S59CP2qkqLt0DuimRWKRByClsvqzgib2lyCJAUhIfdb59Mmxd54WAcK0B2vs6D0e' }
    }).then(function (response) {
        return response.data;
    });
};

var getStatus = function (teamNum) {
    return axios({
        method: 'get',
        url: `https://www.thebluealliance.com/api/v3/team/frc${teamNum}/event/${currentEventKey()}/status`,
        headers: { 'X-TBA-Auth-Key': 'S59CP2qkqLt0DuimRWKRByClsvqzgib2lyCJAUhIfdb59Mmxd54WAcK0B2vs6D0e' }
    }).then(function (response) {
        return response.data;
    });
};

// source: https://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0:
            r = v, g = t, b = p;
            break;
        case 1:
            r = q, g = v, b = p;
            break;
        case 2:
            r = p, g = v, b = t;
            break;
        case 3:
            r = p, g = q, b = v;
            break;
        case 4:
            r = t, g = p, b = v;
            break;
        case 5:
            r = v, g = p, b = q;
            break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
};

var createMatchArr = function (match) {
    var strMap = {
        "CrossHAB1": "Exited HAB 1", // Change auto statsff
        "CrossHAB2": "Exited HAB 2",
        "move": "Moved but no cross HAB",
        "none": "Did not move",
        "CL1": "Ball Level 1",
        "CL2": "Ball Level 2",
        "CL3": "Ball Level 3",
        "PL1": "Hatch Level 1",
        "PL2": "Hatch Level 2",
        "PL3": "Hatch Level 3",
        "CL4": "Cargo Ship Ball",
        "PL4": "Cargo Ship Hatch",
        "twoBlocks": "Two thing auto (see comments)", // Change
        "": "None",
        "climb1": "Platform",
        "climb2": "Level 2",
        "climb3": "Level 3",
        "otherClimb": "Used teammate to climb",
        "ramps": "Deployed ramps",
        "other": "Other lifting mechanism",
        "parked": "Parked on platforms" // Change
    };
    return [
        match.matchNum || 0,
        strMap[match.autoMove],
        strMap[match.autoTarget],
        match.autoSuccess,
        match.teleopCL1,
        match.teleopCL2,
        match.teleopCL3,
        match.teleopCL4,
        match.teleopPL1,
        match.teleopPL2,
        match.teleopPL3,
        match.teleopPL4,
        strMap[match.endGame],
        match.autoComments,
        match.efficiencyComments,
        match.defenseComments,
        match.endGameComments,
        match.comments
    ];
};

var mapPitStrs = function (str) {
    var strMap = {
        'dline': "Drive across line",
        "middle": "Switch from middle",
        "sswitch": "Switch from same side",
        "cswitch": "Switch from opposite side",
        "sscale": "Scale from same side",
        "cscale": "Scale from opposite side",
        "switch": "Switch",
        "scale": "Hatch",
        "vault": "Cargo",
        "groundCubes": "Pick up cubes on the ground",
        "exchangeCubes": "Get cubes from exchange zone",
    };
    return strMap[str];
};

var getPictureData = function () {
    return db.ref("pitimgs").once('value').then(function (snapshot) {
        var teams = snapshot.val();
        var teamNums = [], urls = [];
        for (let teamKey in teams) {
            if (teams[teamKey][currentEventKey()]) {
                teamNums.push(teamKey);
                urls.push(teams[teamKey][currentEventKey()]);
            }
        }
        return urls.map(function (url, ind) {
            return new Promise((resolve, reject) => {
                var oReq = new XMLHttpRequest();
                oReq.open("GET", url);
                oReq.responseType = "arraybuffer";

                oReq.onload = function (oEvent) {
                    var imgBlob = new Blob([oReq.response], { type: "image/png" });
                    resolve({ blob: imgBlob, teamNum: teamNums[ind] });
                };

                oReq.onerror = reject;
                console.log("Loaded", ind);
                oReq.send();
            });
        });
    }).then(function (promises) {
        return Promise.all(promises);
    });
};

var matchesExport = function () { // TODO: use settings, maybe make configurable?
    return Promise.all([getTeams(), getAllTeamData(), getPictureData()]).then(function (values) {
        if (!window.ExcelJS) return alert('Excel exporting library not loaded. Check internet connection or wait until it loads.');
        let allTeams = values[0], allTeamData = values[1];
        let wb = new ExcelJS.Workbook();
        let header = [
            "Team",
            "Scouter",
            "Match Number",
            "Movement in Autonomous",
            "Autonomous Target",
            "Autonomous Success",
            "Teleop Cargo Level 1",
            "Teleop Cargo Level 2",
            "Teleop Cargo Level 3",
            "Teleop Cargo Level 4",
            "Teleop Hatch Level 1",
            "Teleop Hatch Level 2",
            "Teleop Hatch Level 3",
            "Teleop Hatch Level 4",
            "End Game",
            "Auto Comments",
            "Efficiency Comments",
            "Defense Comments",
            "End Game Comments",
            "General Comments",
        ];
        let allScores = calculateAllScores(allTeams, allTeamData);
        let teamsWithData = allScores.teamsWithData;
        let sheet = wb.addWorksheet('Teams');
        sheet.addRow(header);
        for (let i = 0; i < teamsWithData.length; ++i) {
            let team = teamsWithData[i];
            let teamData = allTeamData[team.team_number][currentEventKey()].match;
            for (let matchKey in teamData) {
                let match = teamData[matchKey];
                sheet.addRow(([team.nickname + " -- " + team.team_number, match.user]).concat(createMatchArr(match)));
            }
        }
        let calcSheet = wb.addWorksheet('Calculated values');
        let teamSubScores = allScores.teamSubScores;
        let scoresHeaders = ['Team', '% Auto Cargo', '% Auto Panels', 'Auto Consistency (%)', '% Teleop Cargo L1 (Mean)', '% Teleop Cargo L2 (Mean)',
            '% Teleop Cargo L3 (Mean)', '% Teleop Cargo L4 (Mean)', '% Teleop Panels L1 (Mean)', '% Teleop Panels L2 (Mean)',
            '% Teleop Panels L3 (Mean)', '% Teleop Panels L4 (Mean)', 'Robots lifted during end game (Mean)', 'General Score',
            'Cargo Score', 'Hatch Score', 'Avg cargo', 'Avg hatch'];
        // available data: {averageStats, teamSubScores, teamScores, subScoreRanks, teamsWithData};
        for (let col of [1, 2, 3]) calcSheet.getColumn(col + 1).numFmt = '0.00%';
        calcSheet.addRow(scoresHeaders);
        for (let i = 0; i < teamsWithData.length; ++i) {
            let team = teamsWithData[i], row = calcSheet.getRow(i + 2);
            let teamSubScore = teamSubScores[team.team_number];
            row.getCell(1).value = team.nickname + " -- " + team.team_number;
            row.getCell(2).value = teamSubScore.autoCargo;
            row.getCell(3).value = teamSubScore.autoHatch;
            let total = teamSubScore.autoConsistency[0] + teamSubScore.autoConsistency[1];
            row.getCell(4).value = total === 0 ? 0 : (teamSubScore.autoConsistency[1] / total);
            row.getCell(5).value = teamSubScore.teleopCL1;
            row.getCell(6).value = teamSubScore.teleopCL2;
            row.getCell(7).value = teamSubScore.teleopCL3;
            row.getCell(8).value = teamSubScore.teleopCL4;
            row.getCell(9).value = teamSubScore.teleopPL1;
            row.getCell(10).value = teamSubScore.teleopPL2;
            row.getCell(11).value = teamSubScore.teleopPL3;
            row.getCell(12).value = teamSubScore.teleopPL4;
            row.getCell(13).value = teamSubScore.endGame;
            row.getCell(14).value = allScores.teamScores[team.team_number];
            row.getCell(15).value = teamSubScore.fixedCargo/3;
            row.getCell(16).value = teamSubScore.fixedPanel/3;
            row.getCell(17).value = teamSubScore.teleopCL1 + teamSubScore.teleopCL2
                                  + teamSubScore.teleopCL2 + teamSubScore.teleopCL4;
            row.getCell(18).value = teamSubScore.teleopPL1 + teamSubScore.teleopPL2
                                  + teamSubScore.teleopPL2 + teamSubScore.teleopPL4;
        }

        let pitSheet = wb.addWorksheet('Pit Data');
        pitSheet.addRow(['Team', 'Scouter', 'Autonomous', 'Teleop', 'Drive Train', 'End Game', 'Systems that were being changed', 'Comments and Other Systems'])
        let pitRowNum = 0;
        let imgs = values[2], imgKeys = {};
        console.log("Imgs", imgs);
        for (let img of imgs) {
            let imgKey = wb.addImage({
                buffer: img.blob,
                extension: 'png',
            });
            imgKeys[img.teamNum] = imgKey;
        }
        for (let team of allTeams) {
            let ourData = allTeamData[team.team_number];
            if (!ourData) continue;
            let forEvent = ourData[currentEventKey()];
            if (forEvent && forEvent.pit) {
                for (let pitKey in forEvent.pit) {
                    let d = forEvent.pit[pitKey];

                    pitSheet.getRow(pitRowNum + 2).values = [team.nickname + " -- " + team.team_number, d.user,
                    d.day,
                    d.changes,
                    d.autoCapabilities.split(",").map(mapPitStrs).join("; "),
                    d.teleCapabilities.split(",").map(mapPitStrs).join("; "),
                    d.endGameCapabilities.split(",").map(mapPitStrs).join("; "),
                    d.driveTrain,
                    d.driverExperience,
                    d.comment];
                    if (imgKeys[team.team_number] != null) {
                        pitSheet.addImage(imgKeys[team.team_number], `O${pitRowNum * 10 + 2}:Q${pitRowNum * 10 + 11}`);
                    }
                    pitRowNum++;
                }
            }
        }
        return wb;
    });
};

var downloadWb = function (wb) {
    return wb.xlsx.writeBuffer().then(function (buffer) {
        var blob = new Blob([buffer], { type: "application/xlsx" });

        var link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = Math.random() < 0.2 ? "we-should-get-paid-more.xlsx" : "scouting.xlsx";
        link.click();
    });
};

var getAllTeamData = function () {
    if (allTeamData) return Promise.resolve(allTeamData);
    return new Promise((resolve, reject) => {
        db.ref("data").on("value", function (snapshot) {
            allTeamData = snapshot.val();
            teamDataDirty = true;
            resolve(allTeamData);
        });
    });
};

var getTeamsWithData = function (teams, teamData) {
    var teamExists = function (team) {
        // must be != (not !==) so that we check for undefined as well
        return teamData[team.team_number] != null
            && teamData[team.team_number][currentEventKey()] != null
            && teamData[team.team_number][currentEventKey()].match != null;
    }
    return teams.filter(t => teamExists(t));
};

var teamHasData = function (teamNum) {
    db.ref('/data/' + teamNum).once('value').then(snapshot => {
        return snapshot.val() !== null;
    })
};

var getTeamByNumber = function (num) {
    num = num.toString();
    for (let team of allTeams) {
        if (team.team_number.toString() === num) {
            return team;
        }
    }
};

var createSelectMenu = function (div, onchange) {
    var chosen = null;
    var btns = div.querySelectorAll("ons-button");
    div.dataset.selected = "";
    let requiredInp = div.querySelector(".select-required");
    // if it is required and some are not disabled
    if (requiredInp && _.some(btns, x => !x.disabled)) requiredInp.setCustomValidity("Please select one");
    for (let button of btns) {
        button.onclick = function () {
            this.classList.add("chosen");
            if (chosen) chosen.classList.remove("chosen");
            if (this !== chosen) {
                chosen = this;
                if (requiredInp) requiredInp.setCustomValidity("");
            } else {
                chosen = null;
                if (requiredInp) requiredInp.setCustomValidity("Please select one");
            }
            div.dataset.selected = chosen ? chosen.dataset.select : "";
            if (onchange) onchange(chosen);
        };
    }
};

var createSelectCheckboxMenu = function (div, onchange) {
    var btns = div.querySelectorAll("ons-button");
    var selected = {};
    div.dataset.selected = "";
    for (let button of btns) {
        button.onclick = function () {
            if (this.classList.contains("chosen")) {
                this.classList.remove("chosen");
                delete selected[this.dataset.select];
            } else {
                this.classList.add("chosen");
                selected[this.dataset.select] = true;
            }
            div.dataset.selected = Object.keys(selected).join(",");
            if (onchange) onchange(Object.keys(selected));
        }
    }
};

var enableButtons = function (container, enabled) {
    var btns = container.querySelectorAll("ons-button");
    for (let button of btns) {
        if (button.classList.contains("chosen")) button.onclick();
        button.disabled = !enabled;
    }
    let requiredInp = container.querySelector(".select-required");
    if (requiredInp) requiredInp.setCustomValidity(enabled ? "Please select one" : "");
};

var makeSuccessFailureMenu = function (main, succ, isCheckbox) {
    var callback = function (enabled) {
        enableButtons(succ, enabled);
        if (!enabled) {
            main.dataset.selected = "";
            succ.dataset.selected = "";
        }
    }; enable
    if (isCheckbox) createSelectCheckboxMenu(main, selected => callback(selected.length > 0));
    else createSelectMenu(main, chosen => callback(chosen != null));
    createSelectMenu(succ);
};

var createNumInput = function (container) {
    var inp = container.querySelector("ons-input");
    var plus = container.querySelector(".plus");
    // , minus = container.querySelector(".minus");
    plus.onclick = function () {
        var v = parseInt(inp.value, 10);
        if (isNaN(v)) v = 0;
        inp.value = v + 1;
    };
    // minus.onclick = function () {
    //     var v = parseInt(inp.value, 10);
    //     if (isNaN(v)) v = 0;
    //     inp.value = v - 1;
    // };
};

var addTeams = function (teams, query, page) {
    // we need to remove the teams that are not present at the event
    var teamList = page.querySelector("#teams-list");
    // allTeamElems = [];
    teamList.innerHTML = ''; // hacky way to delete previous teams
    for (let team of teams) {
        if (query.every(term => team.nickname.toLowerCase().indexOf(term) !== -1
            || team.team_number.toString().indexOf(term) !== -1)
            || (query.join(" ") === "the best team" && team.team_number === 1683)) { // lol easter egg
            // page.querySelector("#teams-list").appendChild(createTeam(team));
            let created = createTeam(team);
            if (allBusyTeams[team.team_number]) {
                created.appendChild(makeBusyMarker(allBusyTeams[team.team_number]));
            }
            teamList.appendChild(created);
        }
        //allTeamElems.forEach(teamEl => {
        // teamList.appendChild(teamEl);
        //});
    }
    if (teamList.innerHTML === '') {
        teamList.innerHTML = '<div>No results</div>'; // todo fix styling
    }

};

var addMatches = function (mts, page) {
    if (mts.length === 0) {
        page.querySelector("#matches-list").innerHTML = 'No match data found';
    }
    let showPassed = page.querySelector("ons-switch").checked;
    for (let mt of mts) {
        if (!mt.actual_time || showPassed) { // hasn't happened yet
            page.querySelector("#matches-list").appendChild(createMatch(mt));
        }
    };
};

var createTeam = function (team) {
    var elem = ons.createElement(`
     <ons-list-item data-team-num="${team.team_number}">
     <div>
     ${team.nickname} - ${team.team_number}
     </div>
     </ons-list-item>
     `
    );
    elem.onclick = teamClick;
    return elem;
    // allTeamElems.push(elem);
};

var createMatch = function (mt) {
    let mom = moment.unix(mt.actual_time || mt.predicted_time || mt.time);
    var elem = ons.createElement(`
     <ons-list-item data-match-num="${mt.match_number}">
         <div>
            Match ${mt.match_number} <em>(${mom.fromNow()} at ${mom.format('ddd h:mm A')})</em>
         </div>
     </ons-list-item>
     `);
    elem.onclick = matchClick(mt);
    return elem;
}

var teamClick = function () {
    var teamNumber = this.dataset.teamNum;
    document.getElementById("appNavigator").pushPage("team-scout.html", { data: { num: teamNumber } });
    writeSessionData(teamNumber);
};

var matchClick = function (match) {
    return function () {
        document.getElementById("appNavigator").pushPage("view-match-scout.html", { data: { mt: match } });
    };
};

var fetchTeams = function (page) {
    return getTeams().then(function (teams) {
        addTeams(teams, [], page);
        page.querySelector(".loading").style.display = "none";
    }).catch(function (error) {
        page.querySelector(".loading").innerHTML = `<p style="color: red;">Could not load data<br />${error}<br />Check internet connection</p>`;
    });
};

var getElemByTeamNum = function (teamNum) {
    return document.querySelector(`[data-team-num~="${teamNum}"]`); //https://stackoverflow.com/a/13449757/3807967
};

var getDisplayTableTeam = function (teamNum) {
    var displayTable = document.querySelectorAll(".tdteam");
    if (displayTable) {
        return _.find(displayTable, td => td.dataset.teamNum === teamNum.toString());
    }
};

var setTeamBusy = function (teamNum, username) {
    if (allBusyTeams[teamNum]) {
        // console.log('already there');
    } else {
        allBusyTeams[teamNum] = username;
        let team = getElemByTeamNum(teamNum);
        if (team) team.appendChild(makeBusyMarker(username));
        let team2 = getDisplayTableTeam(teamNum);
        if (team2) team2.appendChild(makeBusyMarker(username));
    }
};

var makeBusyMarker = function (username) {
    return ons.createElement(`<div class="in-progress right list-item__right">
     <ons-icon icon="fa-circle"></ons-icon><span class="list-item__subtitle" style="margin-left: 5px;">${username}</span>
     </div>`);
}

var releaseTeamBusy = function (teamNum) {
    var team = getElemByTeamNum(teamNum);
    // console.log('team to release', teamNum);
    if (team) { // we may have moved to a different event
        let toRemove = team.querySelector(".in-progress");
        if (toRemove) team.removeChild(toRemove);
    }
    var displayTable = document.querySelectorAll(".tdteam");
    if (displayTable) {
        displayTable.forEach(td => {
            if (td.dataset.teamNum === teamNum.toString()) {
                let toRemove = td.querySelector(".in-progress");
                if (toRemove) td.removeChild(toRemove);
            }
        });
    }
    delete allBusyTeams[teamNum];
};

var createMatchViewElem = function (teamNum, blueMatch, ourMatch) {
    // console.log(ourMatch);
    /* match.matchNum || 0,
    strMap[match.autoMove],
    strMap[match.autoTarget],
    match.autoSuccess,
    match.teleopSwitch,
    match.teleopScale,
    match.teleopVault,
    strMap[match.endGame],
    match.autoComments,
    match.efficiencyComments,
    match.defenseComments,
    match.endGameComments,
    match.comments*/
    let matchArr = createMatchArr(ourMatch);
    // console.log(matchArr);
    var div = ons.createElement(`<div>
     <div class="section-head">Match ${ourMatch.matchNum}</div>
     <div class="section-content table-view-data">
     <table>
     <thead>
     <th>Item</th><th>Value</th>
     </thead>
     <tbody>
     <tr><td>Scouter</td><td>${ourMatch.user}</td></tr>
     <tr><td>Auto Comments</td><td>${matchArr[8]}</td></tr>
     <tr><td>Efficiency Comments</td><td>${matchArr[9]}</td></tr>
     <tr><td>Defense Comments</td><td>${matchArr[10]}</td></tr>
     <tr><td>End Game Comments</td><td>${matchArr[11]}</td></tr>
     <tr><td>General Comments</td><td>${matchArr[12]}</td></tr>
     <tr><td>Auto Move</td><td>${matchArr[1]}</td></tr>
     <tr><td>Auto Target</td><td>${matchArr[2]}</td></tr>
     <tr><td>Auto Success</td><td>${matchArr[3]}</td></tr>
     <tr><td>Teleop Switch</td><td>${matchArr[4]}</td></tr>
     <tr><td>Teleop Scale</td><td>${matchArr[5]}</td></tr>
     <tr><td>Teleop Vault</td><td>${matchArr[6]}</td></tr>
     <tr><td>End Game</td><td>${matchArr[7]}</td></tr>
     </tbody>
     </table>
     <a href="https://www.thebluealliance.com/match/${currentEventKey()}_qm${ourMatch.matchNum}" target="_blank">Blue Alliance View</a>
     </div>
     </div>`);
    div.querySelector(".section-head").onclick = function () {
        div.querySelector(".section-content").classList.toggle("active");
    };
    return div;
};

document.addEventListener('destroy', function (event) {
    var page = event.target;
    let num = page.data.num;
    if (page.matches('#team-scout')) {
        // releaseTeamBusy(team.teamNum);
        // releaseTeamBusy(num); // this will already be called when from remove session data
        removeSessionData(num);
    } else if (page.matches('#match-scout') && _.find(document.getElementById("appNavigator").pages, d => d.matches("#view-match-scout"))) { // hack
        console.log("Removing data for", page.data.team);
        removeSessionData(page.data.team.team_number);
    }
});

document.addEventListener('init', function (event) {
    // console.log("Init", event.target.id);
    var page = event.target;

    if (page.matches("#login")) {
        let ui = new firebaseui.auth.AuthUI(firebase.auth());
        let uiConfig = {
            callbacks: {
                signInSuccess: function (currentUser, credential, redirectUrl) {
                    return false;
                }
            },
            signInOptions: [
                firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                firebase.auth.EmailAuthProvider.PROVIDER_ID,
            ],
        };
        ui.start('#firebaseui-auth-container', uiConfig);
        firebase.auth().onAuthStateChanged(function (user) {
            if (user) document.getElementById('appNavigator').pushPage('tabbar.html');
        });
    }

    // this.querySelector('ons-toolbar div.center').textContent = this.data.title;
    if (page.matches("#home")) {
        db.ref('current-scouting').on('child_added', function (snapshot) {
            var team = snapshot.val();
            // console.log('curr scout data', team);
            setTeamBusy(team.teamNum, team.username);
        });
        db.ref('current-scouting').on("child_removed", function (snapshot) {
            const unscoutedTeam = snapshot.val();
            // console.log(unscoutedTeam, 'unscout');
            releaseTeamBusy(unscoutedTeam.teamNum)
        });
        // this.querySelector('ons-toolbar div.center').textContent = this.data.title;
        fetchTeams(page).then(function () {
            while (allBusyTeamsBuffer.length > 0) {
                let team = allBusyTeamsBuffer.pop();
                setTeamBusy(team.num, team.user);
            }
        });
        // pullHook.onaction = fetchTeams;
        var searchBar = page.querySelector("ons-search-input");
        searchBar.onkeyup = function () {
            page.querySelector("#teams-list").innerHTML = "";
            var terms = this.value.toLowerCase().split(" ");
            addTeams(allTeams, terms, page);
        };
    } else if (page.matches("#team-scout")) {
        var teamNum = page.data.num;
        var teamObj = getTeamByNumber(teamNum);
        if (!teamObj) {
            alert("Could not find team"); // should never happen anyway
            return;
        }
        page.querySelector("#team-title").innerHTML = `${teamObj.nickname}`
            + `<div style="color: #4c6ef5; padding-left: 0.2em;"><i class="fas fa-circle" style="visibility: hidden;" id="prev-data-icon"></i></div>`;
        var buttons = page.querySelectorAll("ons-card");

        // give indication of previous data
        //if (teamHasData(teamNum)) {
        // console.log('team has data');
        // page.querySelector("#prev-data-icon").style.visibility = "visible";
        //}

        for (let button of buttons) {
            button.onclick = function () {
                document.getElementById("appNavigator").pushPage(`${this.id}-scout.html`, { data: { team: teamObj } });
            }
        }
    } else if (page.matches("#match-scout")) {
        let time = new timer();
        let timeData;

        let startButton = page.querySelector("#start-button");
        startButton.onclick = function() {
            page.querySelector('#start-button').disabled = true;
            page.querySelector('#end-button').disabled = false;
            time.start();
            page.querySelectorAll('.plus').forEach(function(e){e.disabled = false});
            page.querySelectorAll('.idle-buttons').forEach(function(e){e.disabled = false});
            console.log("started");
        };

        let endButton = page.querySelector("#end-button");
        endButton.onclick = function() {
            timeData = time.getTimes();
            page.querySelectorAll('.plus').forEach(function(e){e.disabled = true});
            console.log("ended");
            console.log(timeData);
            page.querySelector("#validateTimes").innerHTML = "Please check (sec): " + JSON.stringify(timeData);
        };
        
        let imSoSorry = 1;

        let idleButton = page.querySelector("#idle-button");
        idleButton.onclick = function() {addIdleTimes(idleButton, "idle")};
        
        let defendingButton = page.querySelector("#defending-button");
        defendingButton.onclick = function() {addIdleTimes(defendingButton, "defending")};
        let defendedButton = page.querySelector("#defended-button");
        defendedButton.onclick = function() {addIdleTimes(defendedButton, "defended")};

        var addIdleTimes = function(button, typeThing) {
            time.addIntermissionTimes(imSoSorry, typeThing);
            // REEEEEEEEEEEEEE HAHAHA oops this is *a*
            if (imSoSorry == 1) {
                button.classList.add("chosen");
            } else {
                button.classList.remove("chosen");
            }

            if(typeThing == "defended" && imSoSorry == 1){
                page.querySelector('#idle-button').disabled = true;
                page.querySelector('#defending-button').disabled = true;
                page.querySelector('#end-button').disabled = true;
            } else if(typeThing == "defending" && imSoSorry == 1){
                page.querySelector('#idle-button').disabled = true;
                page.querySelector('#defended-button').disabled = true;
                page.querySelector('#end-button').disabled = true;
            } else if(typeThing == "idle" && imSoSorry == 1){
                page.querySelector('#defended-button').disabled = true;
                page.querySelector('#defending-button').disabled = true;
                page.querySelector('#end-button').disabled = true;
            }

            if(typeThing == "defended" && imSoSorry == -1){
                page.querySelectorAll('.idle-buttons').forEach(function(e){e.disabled = false});
                page.querySelector('#end-button').disabled = false;
            } else if(typeThing == "defending" && imSoSorry == -1){
                page.querySelectorAll('.idle-buttons').forEach(function(e){e.disabled = false});
                page.querySelector('#end-button').disabled = false;
            } else if(typeThing == "idle" && imSoSorry == -1){
                page.querySelectorAll('.idle-buttons').forEach(function(e){e.disabled = false});
                page.querySelector('#end-button').disabled = false;
            }

            imSoSorry *= -1;
        };

        let balls = page.querySelectorAll(".ball-placed");
        balls.forEach(function(e){
            e.addEventListener('click', function() {time.updateCycle("ball")}); 
        });

        let panels = page.querySelectorAll(".panel-placed");
        panels.forEach(function(e){
            e.addEventListener('click', function() {time.updateCycle("panel")}); 
        });

        // --------------------------

        let team = page.data.team;
        page.querySelector("#team-num").innerHTML = team.team_number;
        page.querySelector("#team-name").innerHTML = team.nickname;
        // autonomous
        //page.querySelector("#team-title").innerHTML = team.nickname;
        //createSelectMenu(targetBtnsContainer, chosen => enableButtons(resultBtnsContainer, chosen != null));
        //createSelectMenu(resultBtnsContainer);
        let mtNum = page.data.matchNum;
        if (!mtNum) {
            getMatches(team.team_number).then(matches => {
                let minDist = Infinity, minMatch = -1;
                for (let match of matches) {
                    if (match.comp_level !== "qm") continue;
                    let tm = match.actual_time || match.predicted_time || match.time;
                    if (!tm) continue;
                    let dist = Math.abs(Date.now() / 1000 - tm);
                    if (dist < minDist) {
                        minDist = dist;
                        minMatch = match.match_number;
                    }
                };
                if (minMatch >= 0) page.querySelector("#match-num").value = minMatch;
                else page.querySelector("#match-num").value = 0;
            });
        } else {
            page.querySelector("#match-num").value = mtNum;
        }
        let autoMove = page.querySelector("#auto-move"), autoTarget = page.querySelector("#auto-target"), autoSucc = page.querySelector("#auto-target-result");
        createSelectMenu(autoMove, chosen => {
            if (chosen.dataset.select === "CrossHAB1" || chosen.dataset.select === "CrossHAB2") {
                enableButtons(autoTarget, true);
            } else if (chosen.dataset.select === "move" || chosen.dataset.select === "none") {
                enableButtons(autoTarget, false);
                enableButtons(autoSucc, false);
                autoTarget.dataset.selected = "";
                autoSucc.dataset.selected = "";
            }
        });
        // HERE is the bug
        console.log("AutoTarget: " + autoTarget);
        createSelectMenu(autoTarget, chosen => {
            if (chosen != null) {
                enableButtons(autoSucc, true);
                if (chosen.dataset.select === "twoBlocks") {
                    autoSucc.querySelector('ons-button[data-select=true]').onclick();
                    autoSucc.querySelector('ons-button[data-select=false]').disabled = true;
                }
            } else {
                enableButtons(autoSucc, false);
                autoSucc.dataset.selected = "";
            }
        });
        createSelectMenu(autoSucc);
        createSelectMenu(page.querySelector("#end-game-menu"));
        page.querySelectorAll("#teleop-run p").forEach(p => createNumInput(p));
        let submitted = false;
        page.querySelector("form").onsubmit = function (e) {
            e.preventDefault();
            if (submitted) return false;
            submitted = true;
            var data = {};
            var dataMin = {};

            data.user = firebase.auth().currentUser.displayName;
            data.matchNum = parseInt(page.querySelector("#match-num").value);
            data.autoMove = page.querySelector("#auto-move").dataset.selected;
            data.autoTarget = page.querySelector("#auto-target").dataset.selected;
            data.autoSuccess = page.querySelector("#auto-target-result").dataset.selected;
            data.teleopCL1 = parseInt(page.querySelector("#teleop-cargo1 ons-input").value, 10);
            data.teleopCL2 = parseInt(page.querySelector("#teleop-cargo2 ons-input").value, 10);
            data.teleopCL3 = parseInt(page.querySelector("#teleop-cargo3 ons-input").value, 10);
            data.teleopCL4 = parseInt(page.querySelector("#teleop-cargo4 ons-input").value, 10);
            data.teleopPL1 = parseInt(page.querySelector("#teleop-panel1 ons-input").value, 10);
            data.teleopPL2 = parseInt(page.querySelector("#teleop-panel2 ons-input").value, 10);
            data.teleopPL3 = parseInt(page.querySelector("#teleop-panel3 ons-input").value, 10);
            data.teleopPL4 = parseInt(page.querySelector("#teleop-panel4 ons-input").value, 10);
            data.endGame = page.querySelector("#end-game-menu").dataset.selected;
            data.autoComments = page.querySelector("#auto-textarea").value;
            data.efficiencyComments = page.querySelector("#efficiency-textarea").value;
            data.defenseComments = page.querySelector("#defense-textarea").value;
            data.endGameComments = page.querySelector("#endgame-textarea").value;
            data.comments = page.querySelector("#general-textarea").value;
            data.prettydate = getPrettyTimestamp();
            data.timestamp = Date.now();
            data.teamNum = team.team_number;
            data.broken = page.querySelector("#broken").checked;
            data.dEdTime = parseInt(timeData.defended);
            data.dIngTime = parseInt(timeData.defending);
            data.idleTime = parseInt(timeData.idle);
            let totalBalls = data.teleopCL1 + data.teleopCL2 + data.teleopCL3 + data.teleopCL4;
            let totalPanels = data.teleopPL1 + data.teleopPL2 + data.teleopPL3 + data.teleopPL4;
            if (totalBalls == 0){
                totalBalls = 1;
            }
            if (totalPanels == 0){
                totalPanels = 1;
            }
            data.avgBallTime = timeData.ball/totalBalls;
            data.avgPanelTime = timeData.panel/totalPanels;
            
            // defended: this.defendedTime, defending: this.defendingTime,
            // idle: this.thinkingTime, ball: this.ballTime, 
            // panel: this.panelTime};

            console.log("BROKEN: " + data.broken)
            
            // dataMin.u = firebase.auth().currentUser.displayName;
            // dataMin.mn = parseInt(page.querySelector("#match-num").value);
            // dataMin.am = page.querySelector("#auto-move").dataset.selected;
            // dataMin.at = page.querySelector("#auto-target").dataset.selected;
            // dataMin.as = page.querySelector("#auto-target-result").dataset.selected;
            // dataMin.tc1 = parseInt(page.querySelector("#teleop-cargo1 ons-input").value, 10);
            // dataMin.tc2 = parseInt(page.querySelector("#teleop-cargo2 ons-input").value, 10);
            // dataMin.tc3 = parseInt(page.querySelector("#teleop-cargo3 ons-input").value, 10);
            // dataMin.tp1 = parseInt(page.querySelector("#teleop-panel1 ons-input").value, 10);
            // dataMin.tp2 = parseInt(page.querySelector("#teleop-panel2 ons-input").value, 10);
            // dataMin.tp3 = parseInt(page.querySelector("#teleop-panel3 ons-input").value, 10);
            // dataMin.eg = page.querySelector("#end-game-menu").dataset.selected;
            // dataMin.ac = page.querySelector("#auto-textarea").value;
            // dataMin.ec = page.querySelector("#efficiency-textarea").value;
            // dataMin.dc = page.querySelector("#defense-textarea").value;
            // dataMin.ec = page.querySelector("#endgame-textarea").value;
            // dataMin.c = page.querySelector("#general-textarea").value;
            // dataMin.pd = getPrettyTimestamp();
            // dataMin.ts = Date.now();
            // dataMin.teamNum = team.team_number;

            // generateQRCode(dataMin);
            // doesConnectionExist();
            var btn = this.querySelector("#submit-match");
            btn.style.width = btn.offsetWidth + "px"; // keep width fixed
            btn.querySelector("#submit-load").style.display = "initial";
            btn.querySelector("#submit-text").style.display = "none";

            if (navigator.onLine) {
                console.log('online');
                writeScoutingData(data, false).then(() => {
                    btn.querySelector("#submit-load").style.display = "none";
                    btn.querySelector("#submit-done").style.display = "initial";
                    btn.style.backgroundColor = "green";
                });
            } else {
                console.log('offline');
                generateQRCode(data, 'placeHolder');
                btn.querySelector("#submit-load").style.display = "none";
                btn.querySelector("#submit-done").style.display = "initial";
                btn.style.backgroundColor = "red";
            }
            return false;
        };
    } else if (page.matches("#pit-scout")) {
        let team = page.data.team;
        page.querySelector("#team-num").innerHTML = team.team_number;
        page.querySelector("#team-name").innerHTML = team.nickname;
        page.querySelectorAll(".select-one").forEach(x => createSelectMenu(x));
        page.querySelectorAll(".select-many").forEach(x => createSelectCheckboxMenu(x));
        let submitted = false;
        page.querySelector("form").onsubmit = function (e) {
            e.preventDefault();
            if (submitted) return false;
            submitted = true;
            var data = {};

            data.user = firebase.auth().currentUser.displayName;
            data.teamNum = team.team_number;
            data.day = page.querySelector("#dayOfComp").dataset.selected;
            data.changes = page.querySelector("#changesDuringComp").dataset.selected;
            data.driveTrain = page.querySelector("#drivetrain-describe").value;
            data.autoCapabilities = page.querySelector("#autoCapabilities").dataset.selected;
            data.teleCapabilities = page.querySelector("#teleCapabilities").dataset.selected;
            data.endGameCapabilities = page.querySelector("#endgame-capabilities").dataset.selected;
            data.driverExperience = page.querySelector("#driverExperienceRange").value;
            data.comment = page.querySelector("#more-comments").value;

            var btn = this.querySelector("#submit-pit");
            btn.querySelector("#submit-load").style.display = "initial";
            btn.querySelector("#submit-text").style.display = "none";

            if (navigator.onLine) {
                console.log('online');
                writeScoutingData(data, true).then(() => {
                    btn.querySelector("#submit-load").style.display = "none";
                    btn.querySelector("#submit-done").style.display = "initial";
                    btn.style.backgroundColor = "green";
                });
            } else {
                console.log('offline');
                generateQRCode(data, 'pitQRCode');
                btn.querySelector("#submit-load").style.display = "none";
                btn.querySelector("#submit-done").style.display = "initial";
                btn.style.backgroundColor = "red";
            }
        }
    } else if (page.matches("#settingsPage")) {
        page.querySelectorAll("#rank-criteria p").forEach(function (p) {
            var range = p.querySelector("ons-range");
            range.oninput = range.onchange = function () {
                teamDataDirty = true;
                p.querySelector("span").innerHTML = this.value;
            };
            p.querySelector("span").innerHTML = range.value;
            p.querySelector("ons-button").onclick = function () {
                page.querySelectorAll("#rank-criteria p").forEach(function (x) {
                    var r = x.querySelector("ons-range");
                    if (x !== p) r.value = 0;
                    else r.value = 100;
                    r.onchange();
                });
            };
        });
        var tournamentCode = page.querySelector("#tournament");
        tournamentCode.onchange = function (event) {
            // console.log(event.target.value);
            eventCode = eventCodes[event.target.value];
            teamListDirty = teamDataDirty = matchListDirty = true;
            var homePage = document.querySelector("#home");
            document.querySelectorAll(".loading").forEach(x => x.style.display = "block");
            fetchTeams(homePage).then(function () {
                ons.notification.toast('Successfully loaded teams', {
                    timeout: 1620,
                    buttonLabel: 'Dismiss',
                    animation: 'fall'
                });
            });
        };
        page.querySelector("#excel-export").onclick = function () {
            this.querySelector("#submit-load").style.display = "initial";
            this.querySelector("#submit-text").style.display = "none";
            matchesExport().then(downloadWb).then(() => {
                this.querySelector("#submit-load").style.display = "none";
                this.querySelector("#submit-text").style.display = "initial";
            });
        };
    } else if (page.matches("#inspect-team-data")) {
        var data = page.data, team = data.team;
        page.querySelector("#team-num").innerHTML = team.team_number;
        page.querySelector("#team-name").innerHTML = team.nickname;
        page.querySelectorAll("canvas").forEach(canvas => {
            canvas.height = canvas.width = Math.min(300, window.innerWidth - 20);
        });
        let autoData = [0, 0];
        let autoDataArray = [[],[]];
        let autoMoveData = { dline: 0, move: 0, none: 0 };
        var matches = Object.values(data.teamData[team.team_number][currentEventKey()].match); // should always exist
        matches.sort((x, y) => y.timestamp - x.timestamp);
        
        // console.log("-------------START----------------");

        let timeDatas = [[],[]];

        let defenseTimes = [[],[]];

        for (let match of matches) {
            // console.log(match);
            // autoData[0] += match.teleopCL1;
            // autoData[0] += match.teleopCL2;
            // autoData[0] += match.teleopCL3;
            // autoData[0] += match.teleopCL4;

            autoDataArray[0].push(match.teleopCL1);
            autoDataArray[0].push(match.teleopCL2);
            autoDataArray[0].push(match.teleopCL3);
            autoDataArray[0].push(match.teleopCL4);

            // autoData[1] += match.teleopPL1;
            // autoData[1] += match.teleopPL2;
            // autoData[1] += match.teleopPL3;
            // autoData[1] += match.teleopPL4;

            autoDataArray[1].push(match.teleopPL1);
            autoDataArray[1].push(match.teleopPL2);
            autoDataArray[1].push(match.teleopPL3);
            autoDataArray[1].push(match.teleopPL4);

            timeDatas[0].push(match.avgBallTime);
            timeDatas[1].push(match.avgPanelTime);

            // data.dEdTime = timeData.defended;
            // data.dIngTime = timeData.defending;
            // data.idleTime = timeData.idle;

            defenseTimes[0].push(match.dEdTime);
            defenseTimes[1].push(match.dIngTime);

            autoMoveData[match.autoMove ? match.autoMove : "none"] += 1;
        }

        //Avg of top 75%

        autoDataArray[0].sort();
        autoDataArray[1].sort();
        // console.log(autoDataArray[0].length);
        let median = Math.round((autoDataArray[0].length/4) * 10)/10;
        // console.log(median);

        autoDataArray[0].splice(0,median);
        autoDataArray[1].splice(0,median);

        // console.log(autoDataArray[0].length);

        for (let i = 0; i < autoDataArray[0].length; i++){
            autoData[0] += autoDataArray[0][i];
            autoData[1] += autoDataArray[1][i];    
        }
        // Hatch, Cargo
        console.log(team.team_number + "," + autoData[0]/matches.length + "," + autoData[1]/matches.length);
        // console.log("-------------END----------------");

        // console.log()

        let autoConfig = {
            type: 'bar',
            data: {
                datasets: [{
                    data: [
                        autoData[1]/matches.length, autoData[0]/matches.length
                    ],
                    backgroundColor: "green",
                    label: "Completed"
                }],
                labels: [
                    "Hatches",
                    "Cargos"
                ]
            },
            options: {
                title: {
                    display: false,
                    text: "Autonomous"
                },
                tooltips: {
                    mode: 'index',
                    intersect: true
                },
                responsive: true,
                scales: {
                    xAxes: [{
                        stacked: true,
                        ticks: {
                            autoSkip: false
                        }
                    }],
                    yAxes: [{
                        stacked: true,
                        ticks: { 
                            min: 0, 
                            max: parseInt(Math.max(autoData[0]/matches.length, autoData[1]/matches.length), 10) + 1 
                        },
                        scaleLabel: { display: true, labelString: "Average Per Match" },
                    }]
                }
            }
        };
        new Chart(page.querySelector("#autoMove").getContext("2d"), {
            type: 'pie',
            data: {
                datasets: [{
                    data: [autoMoveData.dline, autoMoveData.move, autoMoveData.none],
                    backgroundColor: ['green', 'orange', 'red']
                }],
                labels: ['Cross HAB 1', 'Cross HAB 2', 'Moved but did not cross', 'None']
            },

        });
        let autoChart = new Chart(page.querySelector("#autochart").getContext("2d"), autoConfig);
        let teleopData = { CL1: [], CL2: [], CL3: [], CL4: [], PL1: [], PL2: [], PL3: [], PL4: [] };
        for (let match of matches) {
            teleopData.CL1.push(match.teleopCL1);
            teleopData.CL2.push(match.teleopCL2);
            teleopData.CL3.push(match.teleopCL3);
            teleopData.CL4.push(match.teleopCL4);
            teleopData.PL1.push(match.teleopPL1);
            teleopData.PL2.push(match.teleopPL2);
            teleopData.PL3.push(match.teleopPL3);
            teleopData.PL4.push(match.teleopPL4);
        }
        // let boxplotData = {
        //     // labels: ["CL1", "CL2", "CL3", "Ship Car", "PL1", "PL2", "PL3", "Ship Pan"],
        //     labels: "CL1",
        //     datasets: [{
        //         label: "Teleop",
        //         backgroundColor: "rgba(54, 162, 235, 0.5)",
        //         // data: [teleopData.CL1, teleopData.CL2, teleopData.CL3, teleopData.CL4, teleopData.PL1, teleopData.PL2, teleopData.PL3, teleopData.PL4],
        //         data: teleopData.CL1,
        //         padding: 10,
        //         itemBackgroundColor: "rgb(255, 0, 0)",
        //         borderWidth: 2,
        //         borderColor: "rgba(54, 162, 235, 0.5)",
        //     }]
        // };

        // console.log(boxplotData.datasets[0].data);

        let lineChartData = [teleopData.CL1, teleopData.CL2, 
                            teleopData.CL3, teleopData.CL4, 
                            teleopData.PL1, teleopData.PL2, 
                            teleopData.PL3, teleopData.PL4];

        let totalLineChartData = [];
        let lineChartLabels = [];

        for (let i = 0; i < lineChartData.length; i++) {
            totalLineChartData.push([]);
        }

        for (let i = 0; i < lineChartData[0].length; i++) {
            lineChartLabels.push([i]);
        }

        for (let j = 0; j < lineChartData.length; j++) {
            for (let i = 0; i < lineChartData[j].length; i++) {
                totalLineChartData[j].push({x: i, y: lineChartData[j][i]});
                // console.log({x: i, y: lineChartData[j][i]});
            }
            totalLineChartData[j].reverse();
        }

        let totalBalls = [];
        let totalpanels = [];

        for (let i = 0; i < teleopData.CL1.length; i++){
            totalBalls.push(0);
            totalpanels.push(0);
        }

        for (let i = 0; i < teleopData.CL1.length; i++){
            totalBalls[i] += teleopData.CL1[i];
            totalBalls[i] += teleopData.CL2[i];
            totalBalls[i] += teleopData.CL3[i];
            totalBalls[i] += teleopData.CL4[i];

            totalpanels[i] += teleopData.PL1[i];
            totalpanels[i] += teleopData.PL2[i];
            totalpanels[i] += teleopData.PL3[i];
            totalpanels[i] += teleopData.PL4[i];
        }
        
        console.log(totalBalls)

        let scatterData = [];
        let cargoData = [];
        let hatchData = [];
        let cargoTimeData = [];
        let hatchTimeData =[];

        for (let i = 0; i < totalBalls.length; i++) {
            scatterData.push({x: totalBalls[i], y: totalpanels[i]});
            cargoData.push({x: i, y:  totalBalls[i]});
            hatchData.push({x: i, y: totalpanels[i]});
            cargoTimeData.push({x: i, y: timeDatas[0][i]});
            hatchTimeData.push({x: i, y: timeDatas[1][i]});
        }

        cargoData.reverse();
        hatchData.reverse();

        let totalBallTime = 0;
        let totalHatchTime = 0;
        let numberOfBall = 0;
        let numberOfHatch = 0;

        let totalDefendedTime = 0;
        let totalDefendingTime = 0;
        let numberOfDefended = 0;
        let numberOfDefending = 0;

        for (let i = 0; i < timeDatas[0].length; i++){
            console.log("hey babye" + timeDatas[0][i]);
            if(timeDatas[0][i] > 0){
                totalBallTime += timeDatas[0][i];
                numberOfBall++;
            }
            if(timeDatas[1][i] > 0){
                totalHatchTime += timeDatas[1][i];
                numberOfHatch++;
            }

            if(defenseTimes[0][i] > 0){
                totalDefendedTime += defenseTimes[0][i];
                numberOfDefended++;
            }
            if(defenseTimes[1][i] > 0){
                totalDefendingTime += defenseTimes[1][i];
                numberOfDefending++;
            }
        }
        console.log(totalBallTime)

        document.getElementById("time-defended").innerHTML += Math.round(totalDefendedTime/numberOfBall * 10)/10;
        document.getElementById("time-defending").innerHTML += Math.round(totalDefendingTime/numberOfDefending * 10)/10;

        document.getElementById("time-balls").innerHTML += Math.round(totalBallTime/numberOfBall * 10)/10;
        document.getElementById("time-hatch").innerHTML += Math.round(totalHatchTime/numberOfHatch * 10)/10;

        // cargoTimeData.reverse();
        // hatchTimeData.reverse();

        let meanX = autoData[0]/totalBalls.length; // Balls
        let meanY = autoData[1]/totalBalls.length; // panels
        // autoData[0]

        let yChange = 0;
        let xChange = 0;

        for (let i = 0; i < totalBalls.length; i++) {
            yChange += (totalBalls[i] - meanX) * (totalpanels[i] - meanY)
            xChange += (totalBalls[i] - meanX) * (totalBalls[i] - meanX)
        }

        let slope = yChange/xChange;

        let yIntercept = totalpanels[0] - (slope*totalBalls[0]);
        console.log("y=" + slope + "x+" + yIntercept)
        let xIntercept = -yIntercept/slope

        let maxX = Math.max(...totalBalls);
        let maxY = Math.max(...totalpanels);

        console.log(totalBalls)
        console.log("ASDHF" + maxX)

        if (xIntercept < 0) {
            xIntercept *= -1;
        }
        if (yIntercept < 0) {
            yIntercept *= -1;
        }

        if (xIntercept > maxX*1.5) {
            xIntercept = maxX*1.5;
        }
        if (yIntercept > maxY*1.5) {
            yIntercept = maxY*1.5;
        }
        
        if (xIntercept < maxX) {
            xIntercept = maxX;
        }
        if (yIntercept < maxY) {
            yIntercept = maxY;
        }

        let lineOfBestFit = [{x: 0, y: yIntercept}, {x: xIntercept, y: 0}];

        document.getElementById("max-balls").innerHTML += Math.round(xIntercept * 10)/10;
        document.getElementById("max-panels").innerHTML += Math.round(yIntercept * 10)/10;

        console.log(scatterData)

        new Chart(page.querySelector("#scatterChart"), {
            type: 'scatter',
            data: {
                datasets: [{
                        label: 'Data',
                        backgroundColor: "red",
                        borderColor: "red",
                        data: scatterData,
                        fill: false,
                    }, {
                        // type: 'line',
                        label: 'Trendline',
                        borderColor: "blue",
                        backgroundColor: "blue",
                        data: lineOfBestFit,
                        showLine: true,
                        fill: false
                    }]
			},

            options: {
                responsive: true,
                legend: {
                    display: true,
                },
                title: {
                    display: true,
                    text: 'Cargo Scores'
                },
                scales: {
                    xAxes: [{
                        type: 'linear',
                        position: 'bottom',
                        scaleLabel: { display: true, labelString: "Balls" },
                        ticks: {
                            step: 1
                        }
                    }],
                    yAxes: [{
                        scaleLabel: { display: true, labelString: "panels" },
                        ticks: {
                            step: 1
                        }
                    }]
                }
            }
        });

        new Chart(page.querySelector("#timeCargo"), {
            type: 'line',
            data: {
                labels: lineChartLabels,
                datasets: [{
                        label: 'Cargo',
                        backgroundColor: "red",
                        borderColor: "red",
                        data: cargoTimeData,
                        fill: false,
                    }]
            },

            options: {
                responsive: true,
                legend: {
                    display: true,
                },
                title: {
                    display: true,
                    text: 'Avg Cargo Times'
                },
                scales: {
                    yAxes: [{
                        display: true,
                        ticks: {
                            min: 0,
                            suggestedMax: 8,
                            step: 1
                        }
                    }]
                }
            }
        });

        new Chart(page.querySelector("#timeHatch"), {
            type: 'line',
            data: {
                labels: lineChartLabels,
                datasets: [{
                        label: 'Hatch',
                        backgroundColor: "red",
                        borderColor: "red",
                        data: hatchTimeData,
                        fill: false,
                    }]
            },

            options: {
                responsive: true,
                legend: {
                    display: true,
                },
                title: {
                    display: true,
                    text: 'Avg Hatch Times'
                },
                scales: {
                    yAxes: [{
                        display: true,
                        ticks: {
                            min: 0,
                            suggestedMax: 8,
                            step: 1
                        }
                    }]
                }
            }
        });

        new Chart(page.querySelector("#totalChartCargo"), {
            type: 'line',
            data: {
                labels: lineChartLabels,
                datasets: [{
                        label: 'Cargo',
                        backgroundColor: "red",
                        borderColor: "red",
                        data: cargoData,
                        fill: false,
                    }]
            },

            options: {
                responsive: true,
                legend: {
                    display: true,
                },
                title: {
                    display: true,
                    text: 'Cargo Scores'
                },
                scales: {
                    yAxes: [{
                        display: true,
                        ticks: {
                            min: 0,
                            suggestedMax: 8,
                            step: 1
                        }
                    }]
                }
            }
        });

        new Chart(page.querySelector("#totalChartHatch"), {
            type: 'line',
            data: {
                labels: lineChartLabels,
                datasets: [{
                        label: 'Hatch',
                        backgroundColor: "red",
                        borderColor: "red",
                        data: hatchData,
                        fill: false,
                    }]
            },

            options: {
                responsive: true,
                legend: {
                    display: true,
                },
                title: {
                    display: true,
                    text: 'Hatch Scores'
                },
                scales: {
                    yAxes: [{
                        display: true,
                        ticks: {
                            min: 0,
                            suggestedMax: 8,
                            step: 1
                        }
                    }]
                }
            }
        });

        new Chart(page.querySelector("#teleopChartCargo"), {
            type: 'line',
            data: {
                labels: lineChartLabels,
                datasets: [{
                        label: 'CL1',
                        backgroundColor: "red",
                        borderColor: "red",
                        data: totalLineChartData[0],
                        fill: false,
                    },{
                        label: 'CL2',
                        backgroundColor: "blue",
                        borderColor: "blue",
                        data: totalLineChartData[1],
                        fill: false,
                    },{
                        label: 'CL3',
                        backgroundColor: "green",
                        borderColor: "green",
                        data: totalLineChartData[2],
                        fill: false,
                    },{
                        label: 'ShipC',
                        backgroundColor: "purple",
                        borderColor: "purple",
                        data: totalLineChartData[3],
                        fill: false,
                    }]
			},

            options: {
                responsive: true,
                legend: {
                    display: true,
                },
                title: {
                    display: true,
                    text: 'Cargo Scores'
                },
                scales: {
                    yAxes: [{
                        display: true,
                        ticks: {
                            min: 0,
                            suggestedMax: 8,
                            step: 1
                        }
                    }]
                }
            }
        });

        new Chart(page.querySelector("#teleopChartHatch"), {
            type: 'line',
            data: {
                labels: lineChartLabels,
                datasets: [{
                        label: 'PL1',
                        backgroundColor: "red",
                        borderColor: "red",
                        data: totalLineChartData[4],
                        fill: false,
                    },{
                        label: 'PL2',
                        backgroundColor: "blue",
                        borderColor: "blue",
                        data: totalLineChartData[5],
                        fill: false,
                    },{
                        label: 'PL3',
                        backgroundColor: "green",
                        borderColor: "green",
                        data: totalLineChartData[6],
                        fill: false,
                    },{
                        label: 'ShipP',
                        backgroundColor: "purple",
                        borderColor: "purple",
                        data: totalLineChartData[7],
                        fill: false,
                    }]
			},

            options: {
                responsive: true,
                legend: {
                    display: true,
                },
                title: {
                    display: true,
                    text: 'Panel Scores'
                },
                scales: {
                    yAxes: [{
                        display: true,
                        ticks: {
                            min: 0,
                            suggestedMax: 8,
                            step: 1
                        }
                    }]
                }
            }
        });

        // new Chart(page.querySelector("#teleopchart"), {
        //     type: 'line',
        //     data: boxplotData,
        //     options: {
        //         responsive: true,
        //         legend: {
        //             display: false,
        //         },
        //         title: {
        //             display: true,
        //             text: 'Teleop scores'
        //         },
        //         scales: {
        //             yAxes: [{
        //                 display: true,
        //                 ticks: {
        //                     min: -0.5,
        //                     suggestedMax: 4,
        //                     step: 1
        //                 }
        //             }]
        //         },
        //         tooltips: {
        //             callbacks: {
        //                 label: function label(item, data) {
        //                     var datasetLabel = data.datasets[item.datasetIndex].label || '';
        //                     var value = data.datasets[item.datasetIndex].data[item.index];
        //                     var b = value.__stats; // kind of sketchy
        //                     var label = datasetLabel + ' ' + (typeof item.xLabel === 'string' ? item.xLabel : item.yLabel);
        //                     if (!b) {
        //                         return label + 'NaN';
        //                     }
        //                     return [`q1 ${b.q1}`, `median: ${b.median}`, `q3: ${b.q3}`];
        //                 }
        //             }
        //         }
        //     }
        // });

        let endGameData = { climb1: [0, 0], climb2: [0, 0], none: 0, climb: [0, 0], climb3: [0, 0], otherClimb: [0, 0], ramps: [0, 0], other: [0, 0] };
        for (let mt of matches) {
            let ind = (mt.endGameSuccess === "true" || mt.endGameSuccess === undefined) ? 0 : 1;
            if (mt.endGame) endGameData[mt.endGame][ind]++;
            else endGameData.none++;
        }

        let endGameDataArray, endGameLabels, endGameColors;

        if (matches[0] && matches[0].endGameSuccess !== undefined) {
            endGameDataArray = [endGameData.none, endGameData.parked[0], endGameData.parked[1], endGameData.ramps[0], endGameData.ramps[1],
            endGameData.climb[0], endGameData.climb[1], endGameData.other[0], endGameData.other[1]];
            endGameLabels = ['None', 'Parked', 'Attempted park', 'Ramps', 'Attempted ramps', 'Climbed', 'Attempted climb', 'Other', 'Attempted other'];
            endGameColors = ['red', 'rgb(255, 173, 51)', 'rgba(255, 173, 51, 0.5)',
                'rgb(6, 198, 6)', 'rgba(6, 198, 6, 0.5)',
                'rgb(51, 153, 255)', 'rgba(51, 153, 255, 0.5)',
                'rgb(204, 102, 153)', 'rgba(204, 102, 153, 0.5)'];
        } else {
            endGameDataArray = [endGameData.none, endGameData.climb1[0], endGameData.climb2[0],
            endGameData.climb3[0], endGameData.otherClimb[0]];
            endGameLabels = ['None', 'Parked', 'Level 2', 'Level 3', 'Participated in teammate\'s climb'];
            endGameColors = ['red', 'rgb(255, 173, 51)',
                'rgb(6, 198, 6)',
                'rgb(51, 153, 255)',
                'rgb(204, 102, 153)',
                'yellow'];
        }
        let inds = [];
        for (let i = 0; i < endGameDataArray.length; ++i)
            if (endGameDataArray[i] !== 0)
                inds.push(i);

        new Chart(page.querySelector("#endgamechart").getContext("2d"), {
            type: 'pie',
            data: {
                datasets: [{
                    data: inds.map(x => endGameDataArray[x]),
                    backgroundColor: inds.map(x => endGameColors[x])
                }],
                labels: inds.map(x => endGameLabels[x])
            },

        });
        Promise.all([getMatches(team.team_number), getStatus(team.team_number)]).then(function (values) {
            var blueMatches = values[0], stats = values[1];
            page.querySelector("#record-win").innerHTML = stats.qual.ranking.record.wins;
            page.querySelector("#record-loss").innerHTML = stats.qual.ranking.record.losses;
            page.querySelector("#qual-rank").innerHTML = stats.qual.ranking.rank;
            blueMatches.sort((a, b) => a.match_number - b.match_number);
            blueMatches.forEach(match => {
                if (match.comp_level !== "qm") return;
                let scoutMatch = matches.filter(m => m.matchNum === match.match_number);
                if (scoutMatch.length > 0) page.querySelector("#match-view").appendChild(createMatchViewElem(team.team_number, match, scoutMatch[0]));
            });
        });
    } else if (page.matches("#view-match-scout")) {
        getTeams().then(function (teams) {
            let mt = page.data.mt;
            // console.log(mt);
            page.querySelector("#match-number").innerHTML = mt.match_number;
            let allianceMembers = mt.alliances.red.team_keys.concat(mt.alliances.blue.team_keys).map(key => _.find(teams, team => team.key === key));
            // console.log(allianceMembers)
            for (let i = 0; i < allianceMembers.length; ++i) {
                let team = allianceMembers[i];
                let td = page.querySelectorAll(".tdteam")[i];
                td.innerHTML = `${team.team_number}<br/>${team.nickname}`;
                td.dataset.teamNum = team.team_number;
                if (allBusyTeams[team.team_number]) {
                    td.appendChild(makeBusyMarker(allBusyTeams[team.team_number]));
                }
                page.querySelectorAll("tbody tr")[i].onclick = function () {
                    // console.log("Going to team scout team", team.team_number, "match #", mt.match_number);
                    writeSessionData(team.team_number);
                    document.getElementById("appNavigator").pushPage("match-scout.html", { data: { team: team, matchNum: mt.match_number } });
                };
            }
        });
    } else if (page.matches("#pic-scout")) {

        let video = document.getElementById("video");
        let canvas = document.getElementById("canvasMain");

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // Not adding `{ audio: true }` since we only want video now

            video.addEventListener('loadedmetadata', function () {
                console.log(video.videoWidth);
                console.log(video.videoHeight);
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            });
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (stream) {
                video.src = window.URL.createObjectURL(stream);
                video.play();
            }).catch(function (err) {
                console.error(err);
            });

            document.getElementById("snap").onclick = function () {
                canvas.style.display = "block";
                var context = canvas.getContext("2d");
                context.drawImage(video, 0, 0);
            };
        }
        let btn = document.querySelector("#submit-pic");
        btn.onclick = function (e) {
            e.preventDefault();
            canvas.toBlob((blobby) => {

                btn.querySelector("#submit-load").style.display = "initial";
                btn.querySelector("#submit-text").style.display = "none";
                writeImage(blobby, page.data.team).then(downloadURL => {
                    db.ref("pitimgs").child(page.data.team.team_number).child(currentEventKey()).set(downloadURL).then(function () {
                        btn.querySelector("#submit-load").style.display = "none";
                        btn.querySelector("#submit-done").style.display = "initial";
                        btn.style.backgroundColor = "green";
                    });
                });
            });

        }

        document.querySelector("#file").onchange = function (e) {
            var img = new Image();
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.style.display = "block";
                canvas.getContext("2d").drawImage(img, 0, 0);
            }
            img.src = URL.createObjectURL(e.target.files[0]);
        };
    } else if (page.matches("#pic-qr")) {
        console.log("right page");
        let scanner = new Instascan.Scanner({ video: document.getElementById('preview') });
        scanner.addListener('scan', function (content) {
            console.log(content);

            var btn = page.querySelector("#submit-qr-data");
            btn.style.width = btn.offsetWidth + "px"; // keep width fixed
            btn.querySelector("#submit-load").style.display = "initial";
            btn.querySelector("#submit-text").style.display = "none";

            if (navigator.onLine) {
                console.log(btn.value);
                console.log('online');
                writeScoutingData(JSON.parse(content), false).then(() => {
                    btn.querySelector("#submit-load").style.display = "none";
                    btn.querySelector("#submit-done").style.display = "initial";
                    btn.style.backgroundColor = "green";
                });
            } else {
                console.log('offline');
                generateQRCode(JSON.parse(content), 'QRErrorArea');
                btn.querySelector("#submit-load").style.display = "none";
                btn.querySelector("#submit-done").style.display = "initial";
                btn.style.backgroundColor = "red";
            }
        });
        Instascan.Camera.getCameras().then(function (cameras) {
            if (cameras.length > 0) {
                scanner.start(cameras[0]);
                console.log("scanning");
            } else {
                console.error('No cameras found.');
            }
        }).catch(function (e) {
            console.error(e);
        });
    }
});

function doesConnectionExist() {
    var xhr = new XMLHttpRequest();
    var file = "https://www.kirupa.com/blank.png";
    var randomNum = Math.round(Math.random() * 10000);

    xhr.open('HEAD', file + "?rand=" + randomNum, true);
    xhr.send();

    xhr.addEventListener("readystatechange", processRequest, false);

    function processRequest(e) {
        if (xhr.readyState == 4) {
            if (xhr.status >= 200 && xhr.status < 304) {
                alert("connection exists!");
            } else {
                alert("connection doesn't exist!");
            }
        }
    }
}

var calculateAllScores = function (teams, teamData) {
    let settings = document.querySelector("#settingsPage");
    let teamSubScores = {};
    let teamScores = {};
    let averageStats = {
        autoSwitch: 0,
        autoScale: 0,
        teleopCL1: 0,
        teleopCL2: 0,
        teleopCL3: 0,
        teleopCL4: 0,
        teleopPL1: 0,
        teleopPL2: 0,
        teleopPanels3: 0,
        teleopPanels4: 0,
        endGame: 0
    };

    let totalMatches = 0;
    let calculateScore = function (team, number) {
        var matches = Object.values(team[currentEventKey()].match);
        matches.sort((x, y) => y.timestamp - x.timestamp);
        var autoMap = {
            "sscale": "auto-scale-crit",
            "cscale": "auto-scale-crit",
            "sswitch": "auto-switch-crit",
            "cswitch": "auto-switch-crit",
            "middle": "auto-switch-crit",
            "twoBlocks": "auto-switch-crit"
        };
        var expWeight = -parseInt(settings.querySelector("#bias-crit ons-range").value) / 250;
        var totalScore = 0, totalWeight = 0;
        var subScores = { autoSwitch: 0, autoScale: 0, teleopCL1: 0, teleopCL2: 0, teleopCL3: 0, teleopCL4: 0, teleopPL1: 0, teleopPL2: 0, teleopPL3: 0, teleopPL4: 0, endGame: 0, autoConsistency: [0, 0], 
                        fixedPanel: 0, fixedCargo: 0};

        // console.log(matches);
        for (let i = 0; i < matches.length; ++i) {
            if(matches[i].broken == false){
                let weight = Math.exp(expWeight * i);
                let mt = matches[i];
                let score = 0;
                let fixedScore = [0, 0];
                if (mt.autoTarget && autoMap[mt.autoTarget] && autoMap[mt.autoTarget] != "" && mt.autoSuccess === "truee") {
                    // so sketchy, relies on the fact that "scale" and "switch" both start with "s"
                    score += (+settings.querySelector(`#${autoMap[mt.autoTarget]} ons-range`).value / getAverage("auto" + (mt.autoTarget.slice(1) === "scale" ? "Scale" : "Switch")))
                        * (mt.autoTarget === "twoBlocks" ? 2 : 1);
                    subScores.autoSwitch += ((mt.autoTarget.indexOf("switch") !== -1) + (mt.autoTarget === "middle") + (mt.autoTarget === "twoBlocks") * 2) / matches.length;
                    subScores.autoScale += (mt.autoTarget.indexOf("scale") !== -1) / matches.length;
                } else if (mt.autoMove === "dline") {
                    score += ((+settings.querySelector("#auto-switch-crit ons-range").value) + (+settings.querySelector("#auto-scale-crit ons-range").value)) / 8;
                }
                if (mt.autoTarget) subScores.autoConsistency[+(mt.autoSuccess === "true")]++;
                
                

                // console.log("Score: " + score);

                if (isNaN(mt.teleopCL1)) mt.teleopCL1 = 0;
                if (isNaN(mt.teleopCL2)) mt.teleopCL2 = 0;
                if (isNaN(mt.teleopCL3)) mt.teleopCL3 = 0;
                if (isNaN(mt.teleopCL4)) mt.teleopCL4 = 0;
                if (isNaN(mt.teleopPL1)) mt.teleopPL1 = 0;
                if (isNaN(mt.teleopPL2)) mt.teleopPL2 = 0;
                if (isNaN(mt.teleopPL3)) mt.teleopPL3 = 0;
                if (isNaN(mt.teleopPL4)) mt.teleopPL4 = 0;


                // console.log("teleopCL1 : " + mt.teleopCL1 + "mt.teleopCL2 " + mt.teleopCL2 + "mt.teleopCL3 " + mt.teleopCL3 + "mt.teleopCL4 " + mt.teleopCL4);

                // console.log("teleopPL1 : " + mt.teleopPL1 + "mt.teleopPL2 " + mt.teleopPL2 + "mt.teleopPL3 " + mt.teleopPL3 + "mt.teleopPL4 " + mt.teleopPL4);

                score += mt.teleopCL1 * (+settings.querySelector("#teleop-cargo1-crit ons-range").value);
                fixedScore[0] += mt.teleopCL1;
                subScores.teleopCL1 += mt.teleopCL1 / matches.length;
                score += mt.teleopCL2 * (+settings.querySelector("#teleop-cargo2-crit ons-range").value);
                fixedScore[0] += mt.teleopCL2;
                subScores.teleopCL2 += mt.teleopCL2 / matches.length;
                score += mt.teleopCL3 * (+settings.querySelector("#teleop-cargo3-crit ons-range").value);
                fixedScore[0] += mt.teleopCL3;
                subScores.teleopCL3 += mt.teleopCL3 / matches.length;
                score += mt.teleopCL4 * (+settings.querySelector("#teleop-cargo4-crit ons-range").value);
                fixedScore[0] += mt.teleopCL4;
                subScores.teleopCL4 += mt.teleopCL4 / matches.length;
                score += mt.teleopPL1 * (+settings.querySelector("#teleop-panel1-crit ons-range").value);
                fixedScore[1] += mt.teleopPL1;
                subScores.teleopPL1 += mt.teleopPL1 / matches.length;
                score += mt.teleopPL2 * (+settings.querySelector("#teleop-panel2-crit ons-range").value);
                fixedScore[1] += mt.teleopPL2;
                subScores.teleopPL2 += mt.teleopPL2 / matches.length;
                score += mt.teleopPL3 * (+settings.querySelector("#teleop-panel3-crit ons-range").value);
                fixedScore[1] += mt.teleopPL3;
                subScores.teleopPL3 += mt.teleopPL3 / matches.length;
                score += mt.teleopPL4 * (+settings.querySelector("#teleop-panel4-crit ons-range").value);
                fixedScore[1] += mt.teleopPL4;
                subScores.teleopPL4 += mt.teleopPL4 / matches.length;

                if (i >= matches.length - 3){
                    subScores.fixedCargo += fixedScore[0];
                    subScores.fixedPanel += fixedScore[1];
                    // console.log("Fixed score: " + fixedScore);
                    //  += mt.teleopPL4 * (+settings.querySelector("#teleop-panel4-crit ons-range").value);

                }

                //subScores.vault += mt.teleopVault / matches.length;
                let climbed = (mt.endGame !== "" && mt.endGame !== "parked" && mt.endGame !== "otherClimb") ? 1 : 0;
                // if (climbed && mt.endGame.startsWith("climb") && mt.endGame !== "climb") climbed = parseInt(mt.endGame.replace("climb", ""), 10);
                subScores.endGame += climbed / matches.length;
                score += (+settings.querySelector("#endgame-crit ons-range").value) * climbed / getAverage("endGame");
                totalScore += score * weight;
                if (isNaN(totalScore)) totalScore = 0;
                totalWeight += weight;
            }
        }
        // console.log("TOTAL SCORE: " + totalScore);
        teamScores[number] = totalScore / totalWeight;
        teamSubScores[number] = subScores;
    };

    let getAverage = function (s) {
        // hack to prevent NaNs
        return averageStats[s] === 0 ? 1e-50 : (averageStats[s] / totalMatches);
    };
    let addToAverages = function (team) {
        var matches = Object.values(team[currentEventKey()].match);
        for (let mt of matches) {
            // averageStats.autoSwitch += (mt.autoTarget.indexOf("switch") !== -1) + 2 * (mt.autoTarget === "twoBlocks") + (mt.autoTarget === "middle");
            // averageStats.autoScale += (mt.autoTarget.indexOf("scale") !== -1);
            averageStats.teleopCL1 += mt.teleopCL1;
            averageStats.teleopCL2 += mt.teleopCL2;
            averageStats.teleopCL3 += mt.teleopCL3;
            averageStats.teleopCL4 += mt.teleopCL4;
            averageStats.teleopPL1 += mt.teleopPL1;
            averageStats.teleopPL2 += mt.teleopPL2;
            averageStats.teleopPL3 += mt.teleopPL3;
            averageStats.teleopPL4 += mt.teleopPL4;
            averageStats.endGame += (mt.endGame && mt.endGame !== "parked" && mt.endGame !== "otherClimb") ? (+mt.endGame["climb".length] || 1) : 0;
        }
        totalMatches += matches.length;
    };
    var teamsWithData = getTeamsWithData(teams, teamData);

    for (let team of teamsWithData) {
        addToAverages(teamData[team.team_number]);
    }
    // all averages must be calculated before scores
    for (let team of teamsWithData) {
        calculateScore(teamData[team.team_number], team.team_number);
    }
    teamsWithData.sort((team1, team2) => teamScores[team2.team_number] - teamScores[team1.team_number]);
    var subScoreRanks = {};
    for (let team of teamsWithData) subScoreRanks[team.team_number] = {};
    for (let key in averageStats) {
        let subScoreSorted = teamsWithData.slice().sort((team1, team2) => {
            var subScore1 = teamSubScores[team1.team_number][key],
                subScore2 = teamSubScores[team2.team_number][key];
            return subScore2 - subScore1;
        });
        let prevRank = teamsWithData.length, prevScore = -Infinity;
        for (let i = teamsWithData.length - 1; i >= 0; --i) {
            let team = subScoreSorted[i];
            let newScore = teamSubScores[team.team_number][key];
            if (newScore - prevScore < 0.0001) {
                subScoreRanks[team.team_number][key] = prevRank;
            } else {
                subScoreRanks[team.team_number][key] = i + 1;
                prevScore = newScore;
                prevRank = i + 1;
            }
        }
    }
    return { averageStats, teamSubScores, teamScores, subScoreRanks, teamsWithData };
};

document.addEventListener("show", function (event) {
    var page = event.target;
    teamDataDirty = 1; // Temp only. remove  
    if (page.matches("#rank-teams") && teamDataDirty) {
        Promise.all([getTeams(), getAllTeamData()]).then(function (values) {
            teamDataDirty = false;
            var teams = values[0].slice(), teamData = values[1];
            var allScores = calculateAllScores(teams, teamData);
            // var allScores = 12;
            var averageStats = allScores.averageStats, teamSubScores = allScores.teamSubScores,
                teamScores = allScores.teamScores, subScoreRanks = allScores.subScoreRanks,
                teamsWithData = allScores.teamsWithData;

            var createTeamCard = function (team, rank, subScoreRanks) {
                var DEAD_ZONE = 0.8; // if you are in bottom 80%, you are red, so the top 80% has more resolution
                var subScoreColors = {};
                var createColor = function (rank) {
                    var hsvGreen = { h: 1 / 3, s: 0.8796, v: 0.847 },
                        hsvYellow = { h: 1 / 6, s: 1, v: 1 },
                        hsvRed = { h: 0, s: 1, v: 0.914 };
                    // why hsv? because hsv interpolation is better than rgb
                    if (teamsWithData.length <= 1) return `background-color: black;`
                    let interp = (rank - 1) / (teamsWithData.length - 1), color;
                    if (interp > DEAD_ZONE) color = HSVtoRGB(hsvRed); // everything past 80% is red so we have better resolution on better teams
                    else {
                        interp /= DEAD_ZONE;
                        let h, s, v;
                        if (interp < 0.5) {
                            h = (hsvGreen.h * (0.5 - interp) + hsvYellow.h * interp) * 2;
                            s = (hsvGreen.s * (0.5 - interp) + hsvYellow.s * interp) * 2;
                            v = (hsvGreen.v * (0.5 - interp) + hsvYellow.v * interp) * 2;
                        } else {
                            h = (hsvYellow.h * (1 - interp) + hsvRed.h * (interp - 0.5)) * 2;
                            s = (hsvYellow.s * (1 - interp) + hsvRed.s * (interp - 0.5)) * 2;
                            v = (hsvYellow.v * (1 - interp) + hsvRed.v * (interp - 0.5)) * 2;
                        }
                        color = HSVtoRGB(h, s, v);
                    }
                    return `background-color: rgb(${color.r}, ${color.g}, ${color.b});`;
                };

                //WORKING HERE

                for (let key in subScoreRanks) {
                    // console.log("KEYS: " + key);
                    subScoreColors[key] = createColor(subScoreRanks[key]);
                }
                // console.log(team);
                // console.log(teamSubScores[team.team_number]);
                var elem = ons.createElement(`<ons-card>
 <h3>${rank}. ${team.team_number} ${team.nickname}</h3>
 <ons-row>
 <ons-col>Auto C (${Math.round(teamSubScores[team.team_number].autoSwitch * 100) / 100})<div class="indicator" style="${subScoreColors.autoSwitch}"></div></ons-col>
 <ons-col>Auto P (${Math.round(teamSubScores[team.team_number].autoScale * 100) / 100})<div class="indicator" style="${subScoreColors.autoScale}"></div></ons-col>
 </ons-row>
 <ons-row> 
 <ons-col>Teleop CL1 (${Math.round(teamSubScores[team.team_number].teleopCL1 * 100) / 100})<div class="indicator" style="${subScoreColors.teleopCL1}"></div></ons-col>
 <ons-col>Teleop PL1 (${Math.round(teamSubScores[team.team_number].teleopPL1 * 100) / 100})<div class="indicator" style="${subScoreColors.teleopPL1}"></div></ons-col>
 </ons-row>
 <ons-row>
 <ons-col>Teleop CL2 (${Math.round(teamSubScores[team.team_number].teleopCL2 * 100) / 100})<div class="indicator" style="${subScoreColors.teleopCL2}"></div></ons-col>
 <ons-col>Teleop PL2 (${Math.round(teamSubScores[team.team_number].teleopPL2 * 100) / 100})<div class="indicator" style="${subScoreColors.teleopPL2}"></div></ons-col>
 </ons-row>
 <ons-row>
 <ons-col>Teleop CL3 (${Math.round(teamSubScores[team.team_number].teleopCL3 * 100) / 100})<div class="indicator" style="${subScoreColors.teleopCL3}"></div></ons-col>
 <ons-col>Teleop PL3 (${Math.round(teamSubScores[team.team_number].teleopPL3 * 100) / 100})<div class="indicator" style="${subScoreColors.teleopPL3}"></div></ons-col>
 </ons-row>
 <ons-row>
 <ons-col>Teleop ShipC (${Math.round(teamSubScores[team.team_number].teleopCL4 * 100) / 100})<div class="indicator" style="${subScoreColors.teleopCL4}"></div></ons-col>
 <ons-col>Teleop ShipP (${Math.round(teamSubScores[team.team_number].teleopPL4 * 100) / 100})<div class="indicator" style="${subScoreColors.teleopPL4}"></div></ons-col>
 </ons-row>
 <ons-row>
 <ons-col>End Game (${Math.round(teamSubScores[team.team_number].endGame * 100) / 100})<div class="indicator" style="${subScoreColors.endGame}"></div></ons-col>
 </ons-row>
 </ons-card>`);
                elem.onclick = function () {
                    document.getElementById("appNavigator").pushPage("inspect-team-data.html", {
                        data: { averageStats, teamSubScores, teamScores, subScoreRanks, team, teamData }
                    });
                };
                return elem;
            };
            var ranks = page.querySelector("#teams-ranked");
            ranks.innerHTML = "";
            for (var i = 0; i < teamsWithData.length; ++i) {
                let team = teamsWithData[i];
                ranks.appendChild(createTeamCard(team, i + 1, subScoreRanks[team.team_number]));
            }
        });
    } else if (page.matches("#scout-matches") && matchListDirty) {
        getMatches().then(function (result) {
            page.querySelector(".loading").style.display = "none";
            page.querySelector("#matches-list").innerHTML = "";
            let matches = result.filter(x => x.comp_level === 'qm').sort((a, b) => a.match_number - b.match_number);
            addMatches(matches, page);
            page.querySelector("ons-switch").onchange = function () {
                page.querySelector("#matches-list").innerHTML = "";
                addMatches(matches, page);
            };
            matchListDirty = false;
        });
    }
});

// document.getElementById("idle-button").addEventListener("mousedown", console.log("hi"));
// window.addEventListener("mouseup", console.log("mouse up"));
        
setInterval(function () { matchListDirty = true; }, 60 * 1000 * 5); // refresh the match list once at least every 5 minutes  
