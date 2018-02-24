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

var state = 'ga', eventCode = 'gai', year = 2018; // todo determine eventcode by date
var currentEvent = {
    get key() {
        return year + state + eventCode;
    }
};
var eventCodes = {'Gainesville': 'gai', 'Houston': 'cmptx', 'Peachtree': 'cmp', 'Albany': 'alb'}; // TODO find actual value
var allTeams = [];
var allTeamElems = [];
var allTeamData = null;
var teamDataDirty = true;
var homePage;

var writeScoutingData = function (data, isPit) {
    console.log('sent data for team' + data.teamName, data);
    return db.ref("data").child(data.teamNum.toString()).child(data.eventKey).child(isPit ? 'pit' : 'match').push().set(data);
};

var getTeams = function () {
    // if (allTeams.length > 0) return Promise.resolve(allTeams); // this was messing up the code to get new teams
    // if you uncomment, it does not properly change the teams because it thinks there are already teams present
    return axios({
        method: 'get',
        url: `https://www.thebluealliance.com/api/v3/event/${currentEvent.key}/teams/simple`,
        headers: {'X-TBA-Auth-Key': 'S59CP2qkqLt0DuimRWKRByClsvqzgib2lyCJAUhIfdb59Mmxd54WAcK0B2vs6D0e'}
    }).then(function (response) {
        allTeams = response.data;
        return response.data;
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

var teamHasData = function (teamNum) {
    db.ref('/data/' + teamNum).once('value').then(snapshot => {
        // console.log(snapshot.val());
        console.log('returning data');
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
    for (let button of btns) {
        button.onclick = function () {
            this.classList.add("chosen");
            if (chosen) chosen.classList.remove("chosen");
            if (this !== chosen) {
                chosen = this;
            } else {
                chosen = null;
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

var makeSuccessFailureMenu = function (main, succ, isCheckbox) {
    var enableButtons = function (enabled) {
        var btns = succ.querySelectorAll("ons-button");
        for (let button of btns) {
            button.disabled = !enabled;
            if (button.classList.contains("chosen") && !enabled) button.classList.remove("chosen");
        }
        if (!enabled) main.dataset.chosen = "";
    };
    if (isCheckbox) createSelectCheckboxMenu(main, selected => enableButtons(selected.length > 0));
    else createSelectMenu(main, chosen => enableButtons(chosen != null));
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
    allTeamElems = [];
    teamList.innerHTML = ''; // hacky way to delete previous teams
    for (let team of teams) {
        if (query.every(term => team.nickname.toLowerCase().indexOf(term) !== -1
                || team.team_number.toString().indexOf(term) !== -1)
            || (query.join(" ") === "the best team" && team.team_number === 1683)) { // lol easter egg
            // page.querySelector("#teams-list").appendChild(createTeam(team));
            createTeam(team);
        }
        allTeamElems.forEach(teamEl => {
            teamList.appendChild(teamEl);
        });
    }
    if (teamList.innerHTML === '') {
        teamList.innerHTML = '<div>No competition data for this event yet</div>'; // todo fix styling
    }

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
    allTeamElems.push(elem);
    return elem;
};

var teamClick = function () {
    var teamNumber = this.dataset.teamNum;
    document.getElementById("appNavigator").pushPage("team-scout.html", {data: {num: teamNumber}});
};

var fetchTeams = function (page) {
    getTeams().then(function (teams) {
        addTeams(teams, [], page);
        page.querySelector("#loading").style.display = "none";
    }).catch(function (error) {
        page.querySelector("#loading").innerHTML = `<p style="color: red;">Could not load dat<br />${error}<br />Check internet connection</p>`;
    });
};

document.addEventListener('init', function (event) {
        console.log("Init", event.target.id);
        var page = event.target;
        // this.querySelector('ons-toolbar div.center').textContent = this.data.title;
        if (page.matches("#home")) {
            homePage = page;
            // this.querySelector('ons-toolbar div.center').textContent = this.data.title;
            fetchTeams(page);
            // pullHook.onaction = fetchTeams;
            var searchBar = page.querySelector("ons-search-input");
            searchBar.onkeyup = function () {
                page.querySelector("#teams-list").innerHTML = "";
                var terms = this.value.toLowerCase().split(" ");
                addTeams(allTeams, terms);
            };
        } else if (page.matches("#team-scout")) {
            console.log(page.data);
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
            if (teamHasData(teamNum)) {
                console.log('team has data');
                page.querySelector("#prev-data-icon").style.visibility = "visible";
            }
            for (let button of buttons) {
                button.onclick = function () {
                    document.getElementById("appNavigator").pushPage(`${this.id}-scout.html`, {data: {team: teamObj}});
                }
            }
        } else if (page.matches("#match-scout")) {
            var team = page.data.team;
            page.querySelector("#team-num").innerHTML = team.team_number;
            page.querySelector("#team-name").innerHTML = team.nickname;
            // autonomous
            //page.querySelector("#team-title").innerHTML = team.nickname;
            var target = -1, success = false, chosen = null;
            //var enableButtons = function(btnContainer, enabled) {
            //    var btns = btnCoontainer.querySelectorAll("ons-button");
            //    for (let button of btns) {
            //        button.disabled = !enabled;
            //        if (button.classList.contains("chosen") && !enabled) button.classList.remove("chosen");
            //    }
            //    if (!enabled) btnContainer.dataset.chosen = "";
            //};
            //createSelectMenu(targetBtnsContainer, chosen => enableButtons(resultBtnsContainer, chosen != null));
            //createSelectMenu(resultBtnsContainer);
            makeSuccessFailureMenu(page.querySelector("#auto-target"), page.querySelector("#auto-target-result"), true);
            makeSuccessFailureMenu(page.querySelector("#end-game-menu"), page.querySelector("#end-game-result"), false);
            page.querySelectorAll("p").forEach(p => createNumInput(p));
            var submitted = false;
            page.querySelector("form").onsubmit = function (e) {
                e.preventDefault();
                if (submitted) return false;
                submitted = true;
                var data = {};
                data.autoTarget = page.querySelector("#auto-target").dataset.selected;
                data.autoSuccess = page.querySelector("#auto-target-result").dataset.selected;
                data.teleopSwitch = parseInt(page.querySelector("#teleop-switch ons-input").value, 10);
                data.teleopScale = parseInt(page.querySelector("#teleop-scale ons-input").value, 10);
                data.teleopVault = parseInt(page.querySelector("#teleop-vault ons-input").value, 10);
                data.endGame = page.querySelector("#end-game-menu").dataset.selected;
                data.endGameSuccess = page.querySelector("#end-game-result").dataset.selected;
                data.comments = page.querySelector("textarea").value;
                data.timestamp = Date.now(); // just for fun idk
                data.teamName = team.nickname.trim();
                data.teamNum = team.team_number;
                data.eventKey = currentEvent.key;
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
            var team = page.data.team;
            page.querySelector("#team-num").innerHTML = team.team_number;
            page.querySelector("#team-name").innerHTML = team.nickname;
            page.querySelectorAll(".select-one").forEach(x => createSelectMenu(x));
            page.querySelectorAll(".select-many").forEach(x => createSelectCheckboxMenu(x));
            page.querySelector("form").onsubmit = function (e) {
                e.preventDefault();
                if (submitted) return false;
                submitted = true;
                var data = {};
                data.teamName = team.nickname.trim();
                data.teamNum = team.team_number;
                data.eventKey = currentEvent.key;
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
                fetchTeams(homePage);
                ons.notification.toast('Successfully loaded teams', {
                    timeout: 1620,
                    buttonLabel: 'Dismiss'
                });
            }
        }
    }
);

document.addEventListener("show", function (event) {
    var page = event.target;
    var settings = document.querySelector("#settingsPage");
    if (page.matches("#rank-teams") && teamDataDirty) {
        var teamSubScores = {};
        var teamScores = {};
        var calculateScore = function (team, number) {
            var matches = Object.values(team[currentEvent.key]);
            matches.sort((x, y) => y.timestamp - x.timestamp);
            var autoMap = {
                "sscale": "auto-scale-crit",
                "cscale": "auto-scale-crit",
                "sswitch": "auto-switch-crit",
                "cswitch": "auto-switch-crit"
            };
            var expWeight = -parseInt(settings.querySelector("#bias-crit ons-range").value) / 250;
            var totalScore = 0, totalWeight = 0;
            var subScores = {auto: 0, teleopSwitch: 0, teleopScale: 0, endGame: 0};
            for (let i = 0; i < matches.length; ++i) {
                let weight = Math.exp(expWeight * i);
                let mt = matches[i];
                let score = 0;
                let nonLines = mt.autoTarget.split(",").filter(x => x !== "dline");
                if (mt.autoSuccess === "1" && nonLines.length > 0) {
                    score += nonLines.map(target => +settings.querySelector(`#${autoMap[target]} ons-range`).value).reduce((x, y) => x + y);
                    subScores.auto += nonLines.length / matches.length;
                } else if ((nonLines.length === 0) !== (mt.autoSuccess === "0")) {
                    score += (+settings.querySelector("#auto-switch-crit ons-range").value) + (+settings.querySelector("#auto-scale-crit ons-range").value) / 10;
                    subScores.auto += 0.2 / matches.length;
                }
                score += mt.teleopSwitch * (+settings.querySelector("#teleop-switch-crit ons-range").value) / 5;
                subScores.teleopSwitch += mt.teleopSwitch / matches.length;
                score += mt.teleopScale * (+settings.querySelector("#teleop-scale-crit ons-range").value) / 5;
                subScores.teleopScale += mt.teleopScale / matches.length;
                score += mt.teleopVault * (+settings.querySelector("#vault-crit ons-range").value) / 3;
                subScores.endGame += +(mt.endGameSuccess === "true") / matches.length;
                score += mt.endGameSuccess === "true" ? +settings.querySelector("#endgame-crit ons-range").value : 0;
                totalScore += score * weight;
                totalWeight += weight;
            }
            teamScores[number] = totalScore / totalWeight;
            teamSubScores[number] = subScores;
        };
        Promise.all([getTeams(), getAllTeamData()]).then(function (values) {
            teamDataDirty = false;
            var teams = values[0].slice(), teamData = values[1];
            var teamsWithData = [], teamsWOData = [];
            for (let team of teams) {
                if (teamData[team.team_number] != null) {
                    calculateScore(teamData[team.team_number], team.team_number);
                    teamsWithData.push(team);
                }
                else teamsWOData.push(team);
            }
            teamsWithData.sort((team1, team2) => teamScores[team2.team_number] - teamScores[team1.team_number]);
            console.log(teamsWithData, teamScores);
        });
    }
});
