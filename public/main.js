'use strict';


// import * as firebase from "firebase";

var config = {
    apiKey: "AIzaSyAyrHz96bV4nR3SoyMsyPQ__MdOrYHdaEk",
    authDomain: "scouting-data.firebaseapp.com",
    databaseURL: "https://scouting-data.firebaseio.com/",
    storageBucket: "bucket.appspot.com"
};

firebase.initializeApp(config);
console.log('fb conslog', firebase);
var db = firebase.database();

var state = 'ga', eventCode = 'alb', year = 2018; // todo determine eventcode by date
var currentEventKey = () => year + state + eventCode;
var eventCodes = {'Gainesville': 'gai', 'Houston': 'cmptx', 'Peachtree': 'cmp', 'Albany': 'alb'};
var allTeams = [];
// var allTeamElems = [];
var allBusyTeams = {};
var allBusyTeamsBuffer = [];
var allTeamData = null;
var teamDataDirty = true;
var teamListDirty = true;
var matchListDirty = true;
var allScouters = {};

var writeScoutingData = function (data, isPit) {
    if(!data) {
        console.log('tried to send invalid data');
        return;
    }
    console.log('sent data for team' + data.teamName, data);
    return db.ref("data").child(data.teamNum.toString()).child(currentEventKey()).child(isPit ? 'pit' : 'match').push().set(data);
};


var getPrettyTimestamp = function () {
    return moment.unix(Date.now() / 1000).format('llll');
};

var writeSessionData = function (teamNum) {
    var data = {};
    var currentUser = firebase.auth().currentUser;
    if(!currentUser) {
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
        headers: {'X-TBA-Auth-Key': 'S59CP2qkqLt0DuimRWKRByClsvqzgib2lyCJAUhIfdb59Mmxd54WAcK0B2vs6D0e'}
    }).then(function (response) {
        teamListDirty = false;
        allTeams = response.data;
        return response.data;
    });
};

var getMatches = function (teamNum) {
    return axios({
        method: 'get',
        url: "https://www.thebluealliance.com/api/v3/" + (teamNum ? `team/frc${teamNum}/` : "") + `event/${currentEventKey()}/matches`,
        headers: {'X-TBA-Auth-Key': 'S59CP2qkqLt0DuimRWKRByClsvqzgib2lyCJAUhIfdb59Mmxd54WAcK0B2vs6D0e'}
    }).then(function (response) {
        return response.data;
    });
};

var getStatus = function(teamNum) {
    return axios({
        method: 'get',
        url: `https://www.thebluealliance.com/api/v3/team/frc${teamNum}/event/${currentEventKey()}/status`,
        headers: {'X-TBA-Auth-Key': 'S59CP2qkqLt0DuimRWKRByClsvqzgib2lyCJAUhIfdb59Mmxd54WAcK0B2vs6D0e'}
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

var createMatchArr = function(match) {
        var strMap = {
            "dline": "Drove across line",
            "move": "Moved but did not cross",
            "none": "Did not move",
            "sswitch": "Same-side switch",
            "sscale": "Same-side scale",
            "cswitch": "Cross-side switch",
            "cscale": "Cross-side scale",
            "": "None",
            "climb": "Climbed",
            "ramps": "Deployed ramps",
            "other": "Other lifting mechanism",
            "parked": "Parked on platforms"
        };
    return [
                    match.matchNum || 0,
                    strMap[match.autoMove],
                    strMap[match.autoTarget],
                    match.autoSuccess,
                    match.teleopSwitch,
                    match.teleopScale,
                    match.teleopVault,
                    strMap[match.endGame],
                    match.endGameSuccess,
                    match.comments
                ];
};
var matchesExport = function() { // TODO: use settings, maybe make configurable?
    return Promise.all([getTeams(), getAllTeamData(), getMatches()]).then(function (values) {
        let allTeams = values[0], allTeamData = values[1];
        let wb = {SheetNames: [], Sheets: {}};
        var header = "Team,Match Number,Movement in Autonomous,Autonomous Target,Autonomous Success,Teleop Switch,Teleop Scale,Teleop Vault,End Game,End Game Success,Comments".split(",");

        let teamsWithData = getTeamsWithData(allTeams, allTeamData);
        let finalMatchWs = [header];
        for (let i = 0; i < teamsWithData.length; ++i) {
            let team = allTeams[i];
            let teamData = allTeamData[team.team_number][currentEventKey()].match;
            let isFirst = true;
            for (let matchKey in teamData) {
                let match = teamData[matchKey];
                let matchArr = (isFirst ? [team.nickname + " -- " + team.team_number] : [""]).concat(createMatchArr(match));
                finalMatchWs.push(matchArr);
                isFirst = false;
            }
        }
        wb.SheetNames.push("Teams");
        wb.Sheets.Teams = XLSX.utils.aoa_to_sheet(finalMatchWs);
        return wb;
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

var getTeamsWithData = function(teams, teamData) {
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
        button.disabled = !enabled;
        if (button.classList.contains("chosen")) button.classList.remove("chosen");
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
    };
    if (isCheckbox) createSelectCheckboxMenu(main, selected => callback(selected.length > 0));
    else createSelectMenu(main, chosen => callback(chosen != null));
    createSelectMenu(succ);
};

var createNumInput = function (container) {
    var inp = container.querySelector("ons-input");
    var plus = container.querySelector(".plus"), minus = container.querySelector(".minus");
    plus.onclick = function () {
        var v = parseInt(inp.value, 10);
        if (isNaN(v)) v = 0;
        inp.value = v + 1;
    };
    minus.onclick = function () {
        var v = parseInt(inp.value, 10);
        if (isNaN(v)) v = 0;
        inp.value = v - 1;
    };
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
        //    teamList.appendChild(teamEl);
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
                    Match ${mt.match_number} <em>(${mom.fromNow()} at ${mom.format('ddd h:s A')})</em>
                </div>
            </ons-list-item>
    `);
    elem.onclick = matchClick(mt);
    return elem;
}

var teamClick = function () {
    var teamNumber = this.dataset.teamNum;
    document.getElementById("appNavigator").pushPage("team-scout.html", {data: {num: teamNumber}});
    writeSessionData(teamNumber);
};

var matchClick = function (match) {
    return function() {
        document.getElementById("appNavigator").pushPage("view-match-scout.html", {data: {mt: match}});
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

var getDisplayTableTeam = function(teamNum) {
    var displayTable = document.querySelectorAll(".tdteam");
    if (displayTable) {
        return _.find(displayTable, td => td.dataset.teamNum === teamNum.toString());
    }
};

var setTeamBusy = function (teamNum, username) {
    if(allBusyTeams[teamNum]){
        console.log('already there');
    } else {
        allBusyTeams[teamNum] = username;
        let team = getElemByTeamNum(teamNum);
        if (team) team.appendChild(makeBusyMarker(username));
        let team2 = getDisplayTableTeam(teamNum);
        if (team2) team2.appendChild(makeBusyMarker(username));
    }
};

var makeBusyMarker = function(username) {
    return ons.createElement(`<div class="in-progress right list-item__right">
        <ons-icon icon="fa-circle"></ons-icon><span class="list-item__subtitle" style="margin-left: 5px;">${username}</span>
    </div>`);
}

var releaseTeamBusy = function (teamNum) {
    var team = getElemByTeamNum(teamNum);
    console.log('team to release', teamNum);
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

var createMatchViewElem = function(teamNum, blueMatch, ourMatch) {
    console.log(ourMatch);
    let matchArr = createMatchArr(ourMatch);
    console.log(matchArr);
    var div = ons.createElement(`<div>
        <div class="section-head">Match ${ourMatch.matchNum}</div>
        <div class="section-content table-view-data">
            <table>
                <thead>
                    <th>Item</th><th>Value</th>
                </thead>
                <tbody>
                    <tr><td>Scouter</td><td>${ourMatch.user}</td></tr>
                    <tr><td>Comments</td><td>${matchArr[9]}</td></tr>
                    <tr><td>Auto Move</td><td>${matchArr[1]}</td></tr>
                    <tr><td>Auto Target</td><td>${matchArr[2]}</td></tr>
                    <tr><td>Auto Success</td><td>${matchArr[3]}</td></tr>
                    <tr><td>Teleop Switch</td><td>${matchArr[4]}</td></tr>
                    <tr><td>Teleop Scale</td><td>${matchArr[5]}</td></tr>
                    <tr><td>Teleop Vault</td><td>${matchArr[6]}</td></tr>
                    <tr><td>End Game</td><td>${matchArr[7]}</td></tr>
                    <tr><td>End Game Success</td><td>${matchArr[8]}</td></tr>
                </tbody>
            </table>
            <a href="https://www.thebluealliance.com/match/${currentEventKey()}_qm${ourMatch.matchNum}" target="_blank">Blue Alliance View</a>
        </div>
    </div>`);
    div.querySelector(".section-head").onclick = function() {
        div.querySelector(".section-content").classList.toggle("active");
    };
    return div;
};

document.addEventListener('destroy', function (event) {
    var page = event.target;
    let num = page.data.num;
    if(page.matches('#team-scout')){
        // releaseTeamBusy(team.teamNum);
        // releaseTeamBusy(num); // this will already be called when from remove session data
        removeSessionData(num);
    } else if (page.matches('#match-scout') && _.find(document.getElementById("appNavigator").pages, d => d.matches("#view-match-scout"))) { // hack
        console.log("Removing data for", page.data.team);
        removeSessionData(page.data.team.team_number);
    }
});

document.addEventListener('init', function (event) {
    console.log("Init", event.target.id);
    var page = event.target;

    if (page.matches("#login")) {
        let ui = new firebaseui.auth.AuthUI(firebase.auth());
        let uiConfig = {
          callbacks: {
              signInSuccess: function(currentUser, credential, redirectUrl) {
                  return false;
              }
          },
          signInOptions: [
            firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            firebase.auth.EmailAuthProvider.PROVIDER_ID,
          ],
        };
        ui.start('#firebaseui-auth-container', uiConfig);
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) document.getElementById('appNavigator').pushPage('tabbar.html');
        });
    }

    // this.querySelector('ons-toolbar div.center').textContent = this.data.title;
    if (page.matches("#home")) {
        db.ref('current-scouting').on('child_added', function (snapshot) {
            var team = snapshot.val();
            console.log('curr scout data', team);
            setTeamBusy(team.teamNum, team.username);
        });
        db.ref('current-scouting').on("child_removed", function(snapshot) {
            const unscoutedTeam = snapshot.val();
            console.log(unscoutedTeam, 'unscout');
            releaseTeamBusy(unscoutedTeam.teamNum)
        });
        // this.querySelector('ons-toolbar div.center').textContent = this.data.title;
        fetchTeams(page).then(function() {
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
        //    console.log('team has data');
        //    page.querySelector("#prev-data-icon").style.visibility = "visible";
        //}
        for (let button of buttons) {
            button.onclick = function () {
                document.getElementById("appNavigator").pushPage(`${this.id}-scout.html`, {data: {team: teamObj}});
            }
        }
    } else if (page.matches("#match-scout")) {
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
                    let dist = Math.abs(Date.now()/1000 - tm);
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
            if (chosen && chosen.dataset.select === "dline") {
                enableButtons(autoTarget, true);
            } else {
                enableButtons(autoTarget, false);
                enableButtons(autoSucc, false);
                autoTarget.dataset.selected = "";
                autoSucc.dataset.selected = "";
            }
        });
        createSelectMenu(autoTarget, chosen => {
            if (chosen != null) {
                enableButtons(autoSucc, true);
            } else {
                enableButtons(autoSucc, false);
                autoSucc.dataset.selected = "";
            }
        });
        createSelectMenu(autoSucc);
        makeSuccessFailureMenu(page.querySelector("#end-game-menu"), page.querySelector("#end-game-result"), false);
        page.querySelectorAll("#teleop-run p").forEach(p => createNumInput(p));
        let submitted = false;
        page.querySelector("form").onsubmit = function (e) {
            e.preventDefault();
            if (submitted) return false;
            submitted = true;
            var data = {};
            data.user = firebase.auth().currentUser.displayName;
            data.matchNum = parseInt(page.querySelector("#match-num").value);
            data.autoMove = page.querySelector("#auto-move").dataset.selected;
            data.autoTarget = page.querySelector("#auto-target").dataset.selected;
            data.autoSuccess = page.querySelector("#auto-target-result").dataset.selected;
            data.teleopSwitch = parseInt(page.querySelector("#teleop-switch ons-input").value, 10);
            data.teleopScale = parseInt(page.querySelector("#teleop-scale ons-input").value, 10);
            data.teleopVault = parseInt(page.querySelector("#teleop-vault ons-input").value, 10);
            data.endGame = page.querySelector("#end-game-menu").dataset.selected;
            data.endGameSuccess = page.querySelector("#end-game-result").dataset.selected;
            data.comments = page.querySelector("textarea").value;
            data.prettydate = getPrettyTimestamp();
            data.timestamp = Date.now();
            data.teamNum = team.team_number;
            var btn = this.querySelector("#submit-match");
            btn.style.width = btn.offsetWidth + "px"; // keep width fixed
            btn.querySelector("#submit-load").style.display = "initial";
            btn.querySelector("#submit-text").style.display = "none";
            writeScoutingData(data, false).then(() => {
                btn.querySelector("#submit-load").style.display = "none";
                btn.querySelector("#submit-done").style.display = "initial";
                btn.style.backgroundColor = "green";
            });
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
            data.driveTrain = page.querySelector("#drivetrain-select").dataset.selected;
            data.focus = page.querySelector("#focus").dataset.selected;
            data.capabilities = page.querySelector("#capabilities").dataset.selected;
            data.maxLiftHeight = parseInt(page.querySelector("#heightInput").value);
            data.comment = page.querySelector("#more-comments").value;
            data.endGameStrategy = page.querySelector("#endgame-strategy").dataset.selected;
            var btn = this.querySelector("#submit-pit");

            writeScoutingData(data, true).then(() => {
                btn.querySelector("#submit-load").style.display = "none";
                btn.querySelector("#submit-done").style.display = "initial";
                btn.style.backgroundColor = "green";
            });
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
            console.log(event.target.value);
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
        }
    } else if (page.matches("#inspect-team-data")) {
        var data = page.data, team = data.team;
        page.querySelector("#team-num").innerHTML = team.team_number;
        page.querySelector("#team-name").innerHTML = team.nickname;
        page.querySelectorAll("canvas").forEach(canvas => {
            canvas.height = canvas.width = Math.min(300, window.innerWidth - 20);
        });
        let autoData = {sswitch: [0, 0], sscale: [0, 0], cswitch: [0, 0], cscale: [0, 0]};
        let autoMoveData = {dline: 0, move: 0, none: 0};
        var matches = Object.values(data.teamData[team.team_number][currentEventKey()].match); // should always exist
        matches.sort((x, y) => y.timestamp - x.timestamp);
        for (let match of matches) {
            if (match.autoTarget) {
                if (match.autoSuccess === "true") autoData[match.autoTarget][0]++;
                else autoData[match.autoTarget][1]++;
            }
            autoMoveData[match.autoMove ? match.autoMove : "none"] += 1;
        }
        let autoConfig = {
            type: 'bar',
            data: {
                datasets: [{
                    data: [
                        autoData.sswitch[0], autoData.cswitch[0], autoData.sscale[0], autoData.cscale[0]
                    ],
                    backgroundColor: "green",
                    label: 'Successful autos'
                }, {
                    data: [
                        autoData.sswitch[1], autoData.cswitch[1], autoData.sscale[1], autoData.cscale[1]
                    ],
                    backgroundColor: "rgba(0, 255, 0, 0.5)",
                    label: 'Failed autos'
                }],
                labels: [
                    "Same-side switch",
                    "Cross-side switch",
                    "Same-side scale",
                    "Cross-side scale"
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
                        ticks: {autoSkip: false}
                    }],
                    yAxes: [{
                        stacked: true,
                        ticks: {min: 0, max: matches.length, stepSize: 1},
                        scaleLabel: {display: true, labelString: "Number of Matches"}
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
                labels: ['Drive line', 'Moved', 'None']
            },
            
        });
        let autoChart = new Chart(page.querySelector("#autochart").getContext("2d"), autoConfig);
        let teleopData = {switch: [], scale: [], vault: []};
        for (let match of matches) {
            teleopData.switch.push(match.teleopSwitch);
            teleopData.scale.push(match.teleopScale);
            teleopData.vault.push(match.teleopVault);
        }
        let boxplotData = {
            labels: ["Switch", "Scale", "Vault"],
            datasets: [{
                label: "Teleop",
                backgroundColor: "rgba(54, 162, 235, 0.5)",
                data: [teleopData.switch, teleopData.scale, teleopData.vault],
                padding: 10,
                itemBackgroundColor: "rgb(255, 0, 0)",
                borderWidth: 2,
                borderColor: "rgba(54, 162, 235, 0.5)",
            }]
        };
        new Chart(page.querySelector("#teleopchart"), {
            type: 'boxplot',
            data: boxplotData,
            options: {
                responsive: true,
                legend: {
                    display: false,
                },
                title: {
                    display: true,
                    text: 'Teleop scores'
                },
                scales: {
                    yAxes: [{
                        display: true,
                        ticks: {
                            min: -2,
                            suggestedMax: 10,
                            step: 1
                        }
                    }]
                },
	            tooltips: {
		            callbacks: {
			            label: function label(item, data) {
				            var datasetLabel = data.datasets[item.datasetIndex].label || '';
				            var value = data.datasets[item.datasetIndex].data[item.index];
				            var b = value.__stats; // kind of sketchy
				            var label = datasetLabel + ' ' + (typeof item.xLabel === 'string' ? item.xLabel : item.yLabel);
				            if (!b) {
					            return label + 'NaN';
				            }
				            return [`q1 ${b.q1}`, `median: ${b.median}`, `q3: ${b.q3}`];
			            }
		            }
	            }
            }
        });
        let endGameData = {parked: [0, 0], ramps: [0, 0], none: 0, climb: [0, 0], other: [0, 0]};
        for (let mt of matches) {
            let ind = mt.endGameSuccess === "true" ? 0 : 1;
            if (mt.endGame) endGameData[mt.endGame][ind]++;
            else endGameData.none++;
        }
        let endGameDataArray = [endGameData.none, endGameData.parked[0], endGameData.parked[1], endGameData.ramps[0], endGameData.ramps[1],
                            endGameData.climb[0], endGameData.climb[1], endGameData.other[0], endGameData.other[1]];
        let endGameLabels = ['None', 'Parked', 'Attempted park', 'Ramps', 'Attempted ramps', 'Climbed', 'Attempted climb', 'Other', 'Attempted other'];
        let endGameColors = ['red', 'rgb(255, 173, 51)', 'rgba(255, 173, 51, 0.5)',
                                        'rgb(6, 198, 6)', 'rgba(6, 198, 6, 0.5)',
                                        'rgb(51, 153, 255)', 'rgba(51, 153, 255, 0.5)',
                                        'rgb(204, 102, 153)', 'rgba(204, 102, 153, 0.5)'];
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
        Promise.all([getMatches(team.team_number), getStatus(team.team_number)]).then(function(values) {
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
        getTeams().then(function(teams) {
            let mt = page.data.mt;
            console.log(mt);
            page.querySelector("#match-number").innerHTML = mt.match_number;
            let allianceMembers = mt.alliances.red.team_keys.concat(mt.alliances.blue.team_keys).map(key => _.find(teams, team => team.key === key));
            console.log(allianceMembers)
            for (let i = 0; i < allianceMembers.length; ++i) {
                let team = allianceMembers[i];
                let td = page.querySelectorAll(".tdteam")[i];
                td.innerHTML = `${team.team_number}<br/>${team.nickname}`;
                td.dataset.teamNum = team.team_number;
                if (allBusyTeams[team.team_number]) {
                    td.appendChild(makeBusyMarker(allBusyTeams[team.team_number]));
                }
                page.querySelectorAll("tbody tr")[i].onclick = function() {
                    console.log("Going to team scout team", team.team_number, "match #", mt.match_number);
                    writeSessionData(team.team_number);
                    document.getElementById("appNavigator").pushPage("match-scout.html", {data: {team: team, matchNum: mt.match_number}});
                };
            }
        });
    }
});

document.addEventListener("show", function (event) {
    var page = event.target;
    if (page.matches("#rank-teams") && teamDataDirty) {
        let settings = document.querySelector("#settingsPage");
        let teamSubScores = {};
        let teamScores = {};
        let averageStats = {
            autoSwitch: 0,
            autoScale: 0,
            teleopSwitch: 0,
            teleopScale: 0,
            vault: 0,
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
                "cswitch": "auto-switch-crit"
            };
            var expWeight = -parseInt(settings.querySelector("#bias-crit ons-range").value) / 250;
            var totalScore = 0, totalWeight = 0;
            var subScores = {autoSwitch: 0, autoScale: 0, teleopSwitch: 0, teleopScale: 0, endGame: 0, vault: 0};
            for (let i = 0; i < matches.length; ++i) {
                let weight = Math.exp(expWeight * i);
                let mt = matches[i];
                let score = 0;
                if (mt.autoTarget && mt.autoSuccess === "true") {
                    // so sketchy, relies on the fact that "scale" and "switch" both start with "s"
                    score += +settings.querySelector(`#auto-${mt.autoTarget.slice(1)}-crit ons-range`).value / getAverage("autoS" + mt.autoTarget.slice(2));
                    subScores.autoSwitch += mt.autoTarget.indexOf("switch") !== -1;
                    subScores.autoScale += mt.autoTarget.indexOf("scale") !== -1;
                } else if (mt.autoMove === "dline") {
                    score += ((+settings.querySelector("#auto-switch-crit ons-range").value) + (+settings.querySelector("#auto-scale-crit ons-range").value)) / 8;
                }
                score += mt.teleopSwitch * (+settings.querySelector("#teleop-switch-crit ons-range").value) / getAverage("teleopSwitch");
                subScores.teleopSwitch += mt.teleopSwitch / matches.length;
                score += mt.teleopScale * (+settings.querySelector("#teleop-scale-crit ons-range").value) / getAverage("teleopScale");
                subScores.teleopScale += mt.teleopScale / matches.length;
                score += mt.teleopVault * (+settings.querySelector("#vault-crit ons-range").value) / getAverage("vault");
                subScores.vault += mt.teleopVault / matches.length;
                let climbed = mt.endGameSuccess === "true" && mt.endGame !== "parked";
                subScores.endGame += +climbed / matches.length;
                score += (climbed ? +settings.querySelector("#endgame-crit ons-range").value : 0) / getAverage("endGame");
                totalScore += score * weight;
                totalWeight += weight;
            }
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
                averageStats.autoSwitch += mt.autoTarget.indexOf("switch") !== -1;
                averageStats.autoScale += mt.autoTarget.indexOf("scale") !== -1;
                averageStats.teleopSwitch += mt.teleopSwitch;
                averageStats.teleopScale += mt.teleopScale;
                averageStats.vault += mt.teleopVault;
                averageStats.endGame += mt.endGameSuccess === "true" && mt.endGame !== "parked";
            }
            totalMatches += matches.length;
        };
        Promise.all([getTeams(), getAllTeamData()]).then(function (values) {
            teamDataDirty = false;
            var teams = values[0].slice(), teamData = values[1];
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
            console.log(averageStats, teamSubScores, teamScores, subScoreRanks);
            var createTeamCard = function (team, rank, subScoreRanks) {
                var DEAD_ZONE = 0.8; // if you are in bottom 80%, you are red, so the top 80% has more resolution
                var subScoreColors = {};
                var createColor = function (rank) {
                    var hsvGreen = {h: 1 / 3, s: 0.8796, v: 0.847},
                        hsvYellow = {h: 1 / 6, s: 1, v: 1},
                        hsvRed = {h: 0, s: 1, v: 0.914};
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
                for (let key in subScoreRanks) {
                    subScoreColors[key] = createColor(subScoreRanks[key]);
                }
                var elem = ons.createElement(`<ons-card>
                <h3>${rank}. ${team.team_number} ${team.nickname}</h3>
                <ons-row>
                    <ons-col>Auto Switch <div class="indicator" style="${subScoreColors.autoSwitch}"></div></ons-col>
                    <ons-col>Auto Scale <div class="indicator" style="${subScoreColors.autoScale}"></div></ons-col>
                </ons-row>
                <ons-row>                    
                    <ons-col>Teleop Switch <div class="indicator" style="${subScoreColors.teleopSwitch}"></div></ons-col>
                    <ons-col>Teleop Scale <div class="indicator" style="${subScoreColors.teleopScale}"></div></ons-col>
                </ons-row>
                <ons-row>
                    <ons-col>Vault <div class="indicator" style="${subScoreColors.vault}"></div></ons-col>
                    <ons-col>End Game <div class="indicator" style="${subScoreColors.endGame}"></div></ons-col>
                </ons-row>
                </ons-card>`);
                elem.onclick = function () {
                    document.getElementById("appNavigator").pushPage("inspect-team-data.html", {
                        data: {averageStats, teamSubScores, teamScores, subScoreRanks, team, teamData}
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
            page.querySelector("ons-switch").onchange = function() {
                page.querySelector("#matches-list").innerHTML = "";
                addMatches(matches, page);
            };
            matchListDirty = false;
        });
    } 
});
setInterval(function() { matchListDirty = true; }, 60 * 1000 * 5); // refresh the match list once at least every 5 minutes
