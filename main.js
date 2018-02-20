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
var currentEventKey = year + state + eventCode;
var eventCodes = ['gai', 'col' , 'dul', 'dal', 'cmp', 'alb'];
var allTeams = [];

var writeScoutingData = function(data, isPit) {
    console.log('sent data for team' + data.teamName, data);
    return db.ref("data").child(data.teamNum.toString()).child(data.eventKey).child(isPit ? 'pit' : 'match').push().set(data);
};

var writePitData = function (data){
    console.log('sent data for team' + data.teamName, data);
    return db.ref("data").child(data.teamNum.toString()).child(data.eventKey).push().set(data);
};

var teamHasData = function (teamNum) {
    db.ref('/data/' + teamNum).once('value').then(snapshot => {
        // console.log(snapshot.val());
        console.log('returning data');
        return snapshot.val() !== null;
    })
};

var getTeamByNumber = function(num) {
    num = num.toString();
    for (let team of allTeams) {
        if (team.team_number.toString() === num) {
            return team;
        }
    }
};

var createSelectMenu = function(div, onchange) {
    var chosen = null;
    var btns = div.querySelectorAll("ons-button");
    div.dataset.selected = "";
    for (let button of btns) {
        button.onclick = function() {
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

var makeSuccessFailureMenu = function(main, succ) {
    var enableButtons = function(enabled) {
        var btns = succ.querySelectorAll("ons-button");
        for (let button of btns) {
            button.disabled = !enabled;
            if (button.classList.contains("chosen") && !enabled) button.classList.remove("chosen");
        }
        if (!enabled) main.dataset.chosen = "";
    };
    createSelectMenu(main, chosen => enableButtons(chosen != null));
    createSelectMenu(succ);
};

var createNumInput = function(container) {
    var inp = container.querySelector("ons-input");
    var plus = container.querySelector(".plus"), minus = container.querySelector(".minus");
    plus.onclick = function() {
        var v = parseInt(inp.value, 10);
        if (isNaN(v)) v = 0;
        inp.value = v + 1;
    };
    minus.onclick = function() {
        var v = parseInt(inp.value, 10);
        if (isNaN(v)) v = 0;
        inp.value = v - 1;
    };
};

document.addEventListener('init', function (event) {
    console.log("Init", event.target.id);
    var page = event.target;
    // this.querySelector('ons-toolbar div.center').textContent = this.data.title;
    if (page.matches("#home")) {
        var page = event.target;
        var getTeams = function () {
            var randomPage = 1;
            return axios({
                method: 'get',
                url: `https://www.thebluealliance.com/api/v3/event/${year}${state}${eventCode}/teams/simple`,
                headers: {'X-TBA-Auth-Key': 'S59CP2qkqLt0DuimRWKRByClsvqzgib2lyCJAUhIfdb59Mmxd54WAcK0B2vs6D0e'}
            }).then(function (response) {
                allTeams = response.data;
                return response.data;
            });
        };

        var teamClick = function () {
            var teamNumber = this.dataset.teamNum;
            document.getElementById("appNavigator").pushPage("team-scout.html", {data: {num: teamNumber}});
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
        };
        var fetchTeams = function () {
            getTeams().then(function(teams) {
                addTeams(teams, []);
                page.querySelector("#loading").style.display = "none";
            }).catch(function(error) {
                page.querySelector("#loading").innerHTML = `<p style="color: red;">Could not load dat<br />${error}<br />Check internet connection</p>`;
            });
        };

        var addTeams = function(teams, query) {
            for (let team of teams) {
                if (query.every(term => team.nickname.toLowerCase().indexOf(term) !== -1
                        || team.team_number.toString().indexOf(term) !== -1)
                    || (query.join(" ")==="the best team" && team.team_number === 1683)) { // lol easter egg
                    page.querySelector("#teams-list").appendChild(createTeam(team));
                }
            }
        };
        fetchTeams();
        // pullHook.onaction = fetchTeams;

        var searchBar = page.querySelector("ons-search-input");
        searchBar.onkeyup = function() {
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
        if(teamHasData(teamNum)){
            console.log('team has data');
            page.querySelector("#prev-data-icon").style.visibility = "visible";
        }
        for (let button of buttons) {
            button.onclick = function() {
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
        makeSuccessFailureMenu(page.querySelector("#auto-target"), page.querySelector("#auto-target-result"));
        makeSuccessFailureMenu(page.querySelector("#end-game-menu"), page.querySelector("#end-game-result"));
        page.querySelectorAll("p").forEach(p => createNumInput(p));
        var submitted = false;
        page.querySelector("form").onsubmit = function(e) {
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
            data.eventKey = currentEventKey;
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
    } else if (page.id === "pit-scout") {
        var team = page.data.team;
        page.querySelector("#team-num").innerHTML = team.team_number;
        page.querySelector("#team-name").innerHTML = team.nickname;
        page.querySelectorAll(".select-one").forEach(x => createSelectMenu(x));
        var team = page.data.team;
        page.querySelector("form").onsubmit = function(e) {
            e.preventDefault();
            if (submitted) return false;
            submitted = true;
            var data = {};
            data.teamName = team.nickname.trim();
            data.teamNum = team.team_number;
            data.eventKey = currentEventKey;
            data.driveTrain = page.querySelector("#drivetrain-select").dataset.selected;
            data.focus = page.querySelector("#focus").dataset.selected;
            data.capabilities = page.querySelector("#capabilities").dataset.selected;
            data.maxLiftHeight = page.querySelector("#height").dataset.selected;
            data.endGameStrategy = page.querySelector("#endgame-strategy").dataset.selected;
            var btn = this.querySelector("#submit-pit");

            writeScoutingData(data, true).then(() => {
                btn.querySelector("#submit-load").style.display = "none";
                btn.querySelector("#submit-done").style.display = "initial";
                btn.style.backgroundColor = "green";
            })
        }
    }
});
