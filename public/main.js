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
var currentEventKey = () => year + state + eventCode;
var eventCodes = {'Gainesville': 'gai', 'Houston': 'cmptx', 'Peachtree': 'cmp', 'Albany': 'alb'};
var allTeams = [];
var allTeamElems = [];
var allTeamData = null;
var teamDataDirty = true;
var teamListDirty = true;

var writeScoutingData = function (data, isPit) {
    console.log('sent data for team' + data.teamName, data);
    return db.ref("data").child(data.teamNum.toString()).child(data.eventKey).child(isPit ? 'pit' : 'match').push().set(data);
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
}


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

var enableButtons = function (container, enabled) {
    var btns = container.querySelectorAll("ons-button");
    for (let button of btns) {
        button.disabled = !enabled;
        if (button.classList.contains("chosen")) button.classList.remove("chosen");
    }
};

var makeSuccessFailureMenu = function (main, succ, isCheckbox) {
    var callback = function (enabled) {
        enableButtons(succ, enabled);
        if (!enabled) {
            main.dataset.chosen = "";
            succ.dataset.chosen = "";
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
    allTeamElems = [];
    teamList.innerHTML = ''; // hacky way to delete previous teams
    for (let team of teams) {
        if (query.every(term => team.nickname.toLowerCase().indexOf(term) !== -1
                || team.team_number.toString().indexOf(term) !== -1)
            || (query.join(" ") === "the best team" && team.team_number === 1683)) { // lol easter egg
            // page.querySelector("#teams-list").appendChild(createTeam(team));
            teamList.appendChild(createTeam(team));
        }
        //allTeamElems.forEach(teamEl => {
        //    teamList.appendChild(teamEl);
        //});
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
    return elem;
    // allTeamElems.push(elem);
};

var teamClick = function () {
    var teamNumber = this.dataset.teamNum;
    document.getElementById("appNavigator").pushPage("team-scout.html", {data: {num: teamNumber}});
};

var fetchTeams = function (page) {
    return getTeams().then(function (teams) {
        addTeams(teams, [], page);
        page.querySelector("#loading").style.display = "none";
    }).catch(function (error) {
        page.querySelector("#loading").innerHTML = `<p style="color: red;">Could not load data<br />${error}<br />Check internet connection</p>`;
    });
};


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
        // this.querySelector('ons-toolbar div.center').textContent = this.data.title;
        fetchTeams(page);
        // pullHook.onaction = fetchTeams;
        var searchBar = page.querySelector("ons-search-input");
        searchBar.onkeyup = function () {
            page.querySelector("#teams-list").innerHTML = "";
            var terms = this.value.toLowerCase().split(" ");
            addTeams(allTeams, terms, page);
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
        let team = page.data.team;
        page.querySelector("#team-num").innerHTML = team.team_number;
        page.querySelector("#team-name").innerHTML = team.nickname;
        // autonomous
        //page.querySelector("#team-title").innerHTML = team.nickname;
        //createSelectMenu(targetBtnsContainer, chosen => enableButtons(resultBtnsContainer, chosen != null));
        //createSelectMenu(resultBtnsContainer);
        let autoMove = page.querySelector("#auto-move"), autoTarget = page.querySelector("#auto-target"), autoSucc = page.querySelector("#auto-target-result");
        createSelectMenu(autoMove, chosen => {
            if (chosen.dataset.select === "dline") {
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
        page.querySelectorAll("p").forEach(p => createNumInput(p));
        let submitted = false;
        page.querySelector("form").onsubmit = function (e) {
            e.preventDefault();
            if (submitted) return false;
            submitted = true;
            var data = {};
            data.user = firebase.auth().currentUser.displayName;
            data.autoMove = page.querySelector("#auto-move").dataset.selected;
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
            data.eventKey = currentEventKey();
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
        page.querySelector("form").onsubmit = function (e) {
            e.preventDefault();
            if (submitted) return false;
            submitted = true;
            var data = {};
            data.user = firebase.auth().currentUser.displayName;
            data.teamName = team.nickname.trim();
            data.teamNum = team.team_number;
            data.eventKey = currentEventKey();
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
            teamListDirty = teamDataDirty = true;
            var homePage = document.querySelector("#home");
            homePage.querySelector("#loading").display = "block";
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
                backgroundColor: "rgba(0, 0, 255, 0.7)",
                data: [teleopData.switch, teleopData.scale, teleopData.vault],
                padding: 10,
                itemBackgroundColor: "rgb(255, 0, 0)",
                borderWidth: 3,
                strokeColor: "blue"
            }]
        };
        console.log("Box plot", boxplotData);
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
                            beginAtZero: true,
                            step: 1
                        }
                    }]
                }
            }
        });
    }
});

document.addEventListener("show", function (event) {
    var page = event.target;
    var settings = document.querySelector("#settingsPage");
    if (page.matches("#rank-teams") && teamDataDirty) {
        var settings = document.querySelector("#settingsPage");
        var teamSubScores = {};
        var teamScores = {};
        var averageStats = {
            autoSwitch: 0,
            autoScale: 0,
            teleopSwitch: 0,
            teleopScale: 0,
            vault: 0,
            endGame: 0
        };
        var totalMatches = 0;
        var calculateScore = function (team, number) {
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
                if (mt.autoTarget && mt.autoSuccess) {
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
                subScores.endGame += +(mt.endGameSuccess === "true") / matches.length;
                score += (mt.endGameSuccess === "true" ? +settings.querySelector("#endgame-crit ons-range").value : 0) / getAverage("endGame");
                totalScore += score * weight;
                totalWeight += weight;
            }
            teamScores[number] = totalScore / totalWeight;
            teamSubScores[number] = subScores;
        };
        var getAverage = function (s) {
            // hack to prevent NaNs
            return averageStats[s] === 0 ? 1e-50 : (averageStats[s] / totalMatches);
        };
        var addToAverages = function (team) {
            var matches = Object.values(team[currentEventKey()].match);
            for (let mt of matches) {
                averageStats.autoSwitch += mt.autoTarget.indexOf("switch") !== -1;
                averageStats.autoScale += mt.autoTarget.indexOf("scale") !== -1;
                averageStats.teleopSwitch += mt.teleopSwitch;
                averageStats.teleopScale += mt.teleopScale;
                averageStats.vault += mt.teleopVault;
                averageStats.endGame += mt.endGameSuccess === "true";
            }
            totalMatches += matches.length;
        };
        Promise.all([getTeams(), getAllTeamData()]).then(function (values) {
            teamDataDirty = false;
            var teams = values[0].slice(), teamData = values[1];
            var teamsWithData = [], teamsWOData = [];
            var teamExists = function (team) {
                // must be != (not !==) so that we check for undefined as well
                return teamData[team.team_number] != null
                    && teamData[team.team_number][currentEventKey()] != null
                    && teamData[team.team_number][currentEventKey()].match != null;
            }
            for (let team of teams) {
                if (teamExists(team)) {
                    addToAverages(teamData[team.team_number]);
                    teamsWithData.push(team);
                }
                else teamsWOData.push(team);
            }
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
                for (let i = 0; i < teamsWithData.length; ++i) {
                    let team = subScoreSorted[i];
                    subScoreRanks[team.team_number][key] = i + 1;
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
                    // TODO: choose colors
                    // why hsv? because hsv interpolation is better than rgb
                    if (teamsWithData.length <= 1) return `background-color: black;`
                    let interp = (rank - 1) / (teamsWithData.length - 1), color;
                    if (interp > DEAD_ZONE) color = HSVtoRGB(hsvRed); // everything past 60% is red so we have better resolution on better teams
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
    }
});
